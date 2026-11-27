import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { Pool } from 'pg';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { distributePlayers } from '../src/shared/distribute.js';

// Neon CLI writes .env when it already exists, otherwise .env.local.
dotenv.config({ path: existsSync('.env') ? '.env' : '.env.local' });

const app = express();
const port = Number(process.env.PORT || 4000);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json({ limit: '100kb' }));

const inputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  players: z.array(z.string().trim().min(1).max(60)).min(2).max(500),
  playersPerSet: z.number().int().min(2).max(20),
});

async function initializeDatabase() {
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
    )
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

app.get('/api/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) { next(error); }
});

app.post('/api/sessions', async (req, res, next) => {
  try {
    const input = inputSchema.parse(req.body);
    const uniqueNames = input.players.map((name) => name.trim()).filter(Boolean);
    if (uniqueNames.length !== input.players.length) return res.status(400).json({ error: 'Player names cannot be empty.' });
    const slug = randomBytes(9).toString('base64url');
    const editToken = randomBytes(32).toString('base64url');
    const sets = distributePlayers(uniqueNames, input.playersPerSet);
    const result = await pool.query(
      'INSERT INTO match_sessions (id, slug, edit_token_hash, name, players, players_per_set, sets) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [randomUUID(), slug, hashToken(editToken), input.name, JSON.stringify(uniqueNames), input.playersPerSet, JSON.stringify(sets)],
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

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0]?.message || 'Invalid input.' });
  console.error(error);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

if (process.env.NODE_ENV === 'production') {
  const { default: path } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = path.dirname(fileURLToPath(import.meta.url));
  app.use(express.static(path.resolve(root, '../../dist')));
  app.get('*', (_req, res) => res.sendFile(path.resolve(root, '../../dist/index.html')));
}

initializeDatabase().then(() => {
  app.listen(port, () => console.log(`MatchSet API listening on :${port}`));
}).catch((error) => {
  console.error('Could not start MatchSet:', error);
  process.exit(1);
});
