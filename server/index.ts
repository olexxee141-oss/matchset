import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { Pool } from 'pg';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { distributePlayers } from '../src/shared/distribute.js';
import { buildCommunityLeaderboard } from '../src/shared/leaderboard.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: existsSync('.env') ? '.env' : '.env.local' });
}

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Vercel may run several instances concurrently; keep each instance's pool small.
  max: 2,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
});

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Cache the connectivity check per warm instance. Production schema is managed in Neon;
// never run DDL on a Vercel Function cold start.
let databaseReady: Promise<void> | undefined;
async function ensureDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  databaseReady ??= pool.query('SELECT 1').then(() => undefined).catch((error) => {
    databaseReady = undefined;
    throw error;
  });
  await databaseReady;
}
app.use('/api', (_req, _res, next) => {
  void ensureDatabase().then(() => next()).catch(next);
});

const inputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  players: z.array(z.string().trim().min(1).max(60)).min(2).max(500),
  playersPerSet: z.number().int().min(2).max(20),
});
const communitySchema = z.object({
  name: z.string().trim().min(2).max(60),
  creatorName: z.string().trim().min(2).max(40),
});
const memberSchema = z.object({ name: z.string().trim().min(2).max(40) });
const matchSchema = z.object({
  title: z.string().trim().min(2).max(80),
  memberIds: z.array(z.string().uuid()).min(4).max(500),
  playersPerTeam: z.number().int().min(2).max(20),
  createdByMemberId: z.string().uuid(),
  ownerToken: z.string().min(20),
});
const resultSchema = z.object({
  resultToken: z.string().min(20),
  winningTeamId: z.number().int().positive(),
});

export async function initializeDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS match_sessions (
      id UUID PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      edit_token_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      players JSONB NOT NULL,
      players_per_set INTEGER NOT NULL CHECK (players_per_set BETWEEN 2 AND 20),
      sets JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS communities (
      id UUID PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      owner_token_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS community_members (
      id UUID PRIMARY KEY,
      community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (community_id, normalized_name)
    );
    CREATE INDEX IF NOT EXISTS community_members_community_idx ON community_members(community_id);
    CREATE TABLE IF NOT EXISTS community_matches (
      id UUID PRIMARY KEY,
      community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      teams JSONB NOT NULL,
      created_by_member_id UUID NOT NULL REFERENCES community_members(id),
      result_token_hash TEXT NOT NULL,
      winning_team_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS community_matches_history_idx ON community_matches(community_id, created_at DESC);
  `);
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
function tokenMatches(token: string, stored: string) {
  const candidate = Buffer.from(hashToken(token));
  const expected = Buffer.from(stored);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
function publicSession(row: any) {
  return {
    id: row.slug,
    name: row.name,
    players: row.players,
    playersPerSet: row.players_per_set,
    sets: row.sets,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function normalizeName(name: string) {
  return name.trim().normalize('NFKC').toLocaleLowerCase('en').replace(/\s+/g, ' ');
}
app.get('/api/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) { next(error); }
});

app.post('/api/sessions', async (req, res, next) => {
  try {
    const input = inputSchema.parse(req.body);
    const players = input.players.map((name) => name.trim());
    if (players.some((name) => !name)) return res.status(400).json({ error: 'Player names cannot be empty.' });
    const slug = randomBytes(9).toString('base64url');
    const editToken = randomBytes(32).toString('base64url');
    const sets = distributePlayers(players, input.playersPerSet);
    const result = await pool.query(
      'INSERT INTO match_sessions (id, slug, edit_token_hash, name, players, players_per_set, sets) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [randomUUID(), slug, hashToken(editToken), input.name, JSON.stringify(players), input.playersPerSet, JSON.stringify(sets)],
    );
    res.status(201).json({ session: publicSession(result.rows[0]), editToken });
  } catch (error) { next(error); }
});

app.get('/api/sessions/:slug', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM match_sessions WHERE slug = $1', [req.params.slug]);
    if (!result.rowCount) return res.status(404).json({ error: 'This set could not be found.' });
    res.json({ session: publicSession(result.rows[0]) });
  } catch (error) { next(error); }
});

app.put('/api/sessions/:slug', async (req, res, next) => {
  try {
    const editSchema = inputSchema.extend({ editToken: z.string().min(20) });
    const input = editSchema.parse(req.body);
    const found = await pool.query('SELECT * FROM match_sessions WHERE slug = $1', [req.params.slug]);
    if (!found.rowCount) return res.status(404).json({ error: 'This set could not be found.' });
    if (!tokenMatches(input.editToken, found.rows[0].edit_token_hash)) return res.status(403).json({ error: 'Only the creator can edit this set.' });
    const names = input.players.map((name) => name.trim());
    if (names.some((name) => !name)) return res.status(400).json({ error: 'Player names cannot be empty.' });
    const sets = distributePlayers(names, input.playersPerSet);
    const updated = await pool.query(
      'UPDATE match_sessions SET name=$1, players=$2, players_per_set=$3, sets=$4, updated_at=NOW() WHERE slug=$5 RETURNING *',
      [input.name, JSON.stringify(names), input.playersPerSet, JSON.stringify(sets), req.params.slug],
    );
    res.json({ session: publicSession(updated.rows[0]) });
  } catch (error) { next(error); }
});

// Community creation returns a one-time owner token. The raw token is never stored in Postgres.
app.post('/api/communities', async (req, res, next) => {
  try {
    const input = communitySchema.parse(req.body);
    const communityId = randomUUID();
    const memberId = randomUUID();
    const slug = randomBytes(9).toString('base64url');
    const ownerToken = randomBytes(32).toString('base64url');
    const memberName = input.creatorName.trim();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const community = await client.query(
        'INSERT INTO communities (id, slug, name, owner_token_hash) VALUES ($1,$2,$3,$4) RETURNING id, slug, name, created_at',
        [communityId, slug, input.name, hashToken(ownerToken)],
      );
      const member = await client.query(
        'INSERT INTO community_members (id, community_id, display_name, normalized_name) VALUES ($1,$2,$3,$4) RETURNING id, display_name',
        [memberId, communityId, memberName, normalizeName(memberName)],
      );
      await client.query('COMMIT');
      res.status(201).json({ community: community.rows[0], member: member.rows[0], ownerToken });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  } catch (error) { next(error); }
});

app.get('/api/communities/:slug', async (req, res, next) => {
  try {
    const found = await pool.query('SELECT id, slug, name, created_at FROM communities WHERE slug=$1', [req.params.slug]);
    if (!found.rowCount) return res.status(404).json({ error: 'Community not found.' });
    const community = found.rows[0];
    const [membersResult, matchesResult, leaderboardResult] = await Promise.all([
      pool.query('SELECT id, display_name AS name, joined_at FROM community_members WHERE community_id=$1 ORDER BY display_name', [community.id]),
      pool.query('SELECT id, title, teams, winning_team_id, created_at, completed_at FROM community_matches WHERE community_id=$1 ORDER BY created_at DESC LIMIT 100', [community.id]),
      pool.query('SELECT teams, winning_team_id FROM community_matches WHERE community_id=$1 AND completed_at IS NOT NULL', [community.id]),
    ]);
    const matches = matchesResult.rows.map((row) => ({
      id: row.id, title: row.title, teams: row.teams, winningTeamId: row.winning_team_id,
      createdAt: row.created_at, completedAt: row.completed_at,
    }));
    res.json({
      community: { slug: community.slug, name: community.name, createdAt: community.created_at },
      members: membersResult.rows,
      matches,
      leaderboard: buildCommunityLeaderboard(leaderboardResult.rows),
    });
  } catch (error) { next(error); }
});

app.post('/api/communities/:slug/members', async (req, res, next) => {
  try {
    const input = memberSchema.parse(req.body);
    const community = await pool.query('SELECT id FROM communities WHERE slug=$1', [req.params.slug]);
    if (!community.rowCount) return res.status(404).json({ error: 'Community not found.' });
    const name = input.name.trim();
    const result = await pool.query(
      'INSERT INTO community_members (id, community_id, display_name, normalized_name) VALUES ($1,$2,$3,$4) ON CONFLICT (community_id, normalized_name) DO NOTHING RETURNING id, display_name AS name, joined_at',
      [randomUUID(), community.rows[0].id, name, normalizeName(name)],
    );
    if (!result.rowCount) return res.status(409).json({ error: 'That name is already in this community. Ask the member to share their member name or choose a distinct name.' });
    res.status(201).json({ member: result.rows[0] });
  } catch (error) { next(error); }
});

app.post('/api/communities/:slug/matches', async (req, res, next) => {
  try {
    const input = matchSchema.parse(req.body);
    const community = await pool.query('SELECT id, owner_token_hash FROM communities WHERE slug=$1', [req.params.slug]);
    if (!community.rowCount) return res.status(404).json({ error: 'Community not found.' });
    if (!tokenMatches(input.ownerToken, community.rows[0].owner_token_hash)) return res.status(403).json({ error: 'Only the community organiser can create matches.' });
    const membersResult = await pool.query(
      'SELECT id, display_name FROM community_members WHERE community_id=$1 AND id = ANY($2::uuid[])',
      [community.rows[0].id, input.memberIds],
    );
    if (membersResult.rowCount !== input.memberIds.length) return res.status(400).json({ error: 'Every selected player must belong to this community.' });
    if (!membersResult.rows.some((member: any) => member.id === input.createdByMemberId)) return res.status(400).json({ error: 'The match organiser must be a member of this community.' });
    if (Math.ceil(membersResult.rowCount / input.playersPerTeam) < 2) return res.status(400).json({ error: 'Add enough players to create at least two teams.' });
    const names = membersResult.rows.map((member) => member.display_name);
    const distributed = distributePlayers(names, input.playersPerTeam);
    const membersByName = new Map(membersResult.rows.map((member) => [normalizeName(member.display_name), member]));
    const teams = distributed.map((team) => ({
      id: team.id,
      players: team.players.map((name) => {
        const member = membersByName.get(normalizeName(name));
        if (!member) throw new Error('Could not resolve a team member.');
        return { id: member.id, name: member.display_name };
      }),
    }));
    const matchId = randomUUID();
    const resultToken = randomBytes(32).toString('base64url');
    const result = await pool.query(
      'INSERT INTO community_matches (id, community_id, title, teams, created_by_member_id, result_token_hash) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, title, teams, winning_team_id, created_at, completed_at',
      [matchId, community.rows[0].id, input.title, JSON.stringify(teams), input.createdByMemberId, hashToken(resultToken)],
    );
    res.status(201).json({ match: result.rows[0], resultToken });
  } catch (error) { next(error); }
});

app.post('/api/communities/:slug/matches/:matchId/result', async (req, res, next) => {
  try {
    const input = resultSchema.parse(req.body);
    const community = await pool.query('SELECT id FROM communities WHERE slug=$1', [req.params.slug]);
    if (!community.rowCount) return res.status(404).json({ error: 'Community not found.' });
    const found = await pool.query('SELECT * FROM community_matches WHERE id=$1 AND community_id=$2', [req.params.matchId, community.rows[0].id]);
    if (!found.rowCount) return res.status(404).json({ error: 'Match not found.' });
    const match = found.rows[0];
    if (!tokenMatches(input.resultToken, match.result_token_hash)) return res.status(403).json({ error: 'Only the match organiser can record its result.' });
    const teams = match.teams as Array<{ id: number }>;
    if (!teams.some((team) => team.id === input.winningTeamId)) return res.status(400).json({ error: 'Select a valid winning team.' });
    if (match.winning_team_id !== null) return res.status(409).json({ error: 'This match result has already been recorded.' });
    const updated = await pool.query(
      'UPDATE community_matches SET winning_team_id=$1, completed_at=NOW() WHERE id=$2 AND winning_team_id IS NULL RETURNING id, winning_team_id, completed_at',
      [input.winningTeamId, match.id],
    );
    if (!updated.rowCount) return res.status(409).json({ error: 'This match result has already been recorded.' });
    res.json({ match: updated.rows[0] });
  } catch (error) { next(error); }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0]?.message || 'Invalid input.' });
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') return res.status(409).json({ error: 'That name is already registered in this community.' });
  console.error(error);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

export default app;
