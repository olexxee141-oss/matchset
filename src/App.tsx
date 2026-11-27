import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

type SetGroup = { id: number; players: string[] };
type Session = { id: string; name: string; players: string[]; playersPerSet: number; sets: SetGroup[]; createdAt: string; updatedAt: string };
type Member = { id: string; name: string; joined_at?: string };
type Team = { id: number; players: Array<{ id: string; name: string }> };
type CommunityMatch = { id: string; title: string; teams: Team[]; winningTeamId: number | null; createdAt: string; completedAt: string | null };
type LeaderboardEntry = { memberId: string; name: string; wins: number; losses: number; matchesPlayed: number; winRate: number };
type Community = { slug: string; name: string; createdAt: string };
type CommunityPayload = { community: Community; members: Member[]; matches: CommunityMatch[]; leaderboard: LeaderboardEntry[] };

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\\/+$/, '');

const api = async (url: string, options?: RequestInit) => {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const body = await response.text();
  let data: { error?: string } & Record<string, unknown> = {};
  try {
    data = body ? JSON.parse(body) : {};
  } catch {
    const preview = body.replace(/\\s+/g, ' ').slice(0, 180);
    const configurationHint = API_BASE_URL ? '' : ' Set VITE_API_BASE_URL in Vercel to https://matchset-backend.onrender.com.';
    throw new Error(`API returned non-JSON (HTTP ${response.status}).${configurationHint} Response: ${preview || '(empty response)'}`);
  }
  if (!response.ok) throw new Error(data.error || `Request failed (HTTP ${response.status}).`);
  return data;
};

function extractCode(value: string, kind: 'set' | 'community') {
  let slug = value.trim();
  try {
    if (slug.includes('://')) slug = new URL(slug).pathname.split('/').filter(Boolean).at(-1) || '';
  } catch { return ''; }
  slug = slug.replace(new RegExp('^' + kind + '/'), '').trim();
  return /^[a-zA-Z0-9_-]{6,40}$/.test(slug) ? slug : '';
}

export default function App() {
  const [page, setPage] = useState<'home' | 'create' | 'view' | 'create-community' | 'join-community' | 'community'>('home');
  const [session, setSession] = useState<Session | null>(null);
  const [name, setName] = useState('');
  const [playerNames, setPlayerNames] = useState<string[]>(['', '']);
  const [playersPerSet, setPlayersPerSet] = useState(4);
  const [viewLink, setViewLink] = useState('');
  const [showViewInput, setShowViewInput] = useState(false);
  const [editToken, setEditToken] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [matches, setMatches] = useState<CommunityMatch[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [communityName, setCommunityName] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [currentMemberId, setCurrentMemberId] = useState('');
  const [ownerToken, setOwnerToken] = useState('');
  const [matchTitle, setMatchTitle] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [playersPerTeam, setPlayersPerTeam] = useState(4);

  const players = useMemo(() => playerNames.map((item) => item.trim()).filter(Boolean), [playerNames]);
  const projectedSets = players.length >= 2 ? Math.ceil(players.length / playersPerSet) : 0;
  const isOwner = Boolean(community && ownerToken);

  function updatePlayer(index: number, value: string) {
    setPlayerNames((current) => current.map((player, playerIndex) => playerIndex === index ? value : player));
  }
  function addPlayer() {
    if (playerNames.length >= 500) return;
    setPlayerNames((current) => [...current, '']);
    setError('');
  }
  function removePlayer(index: number) {
    setPlayerNames((current) => current.filter((_, playerIndex) => playerIndex !== index));
    setError('');
  }

  async function loadSession(value: string) {
    setError(''); setNotice('');
    const slug = extractCode(value, 'set');
    if (!slug) { setError('Enter a valid MatchSet link or set code.'); return; }
    setLoading(true);
    try {
      const result = await api(`/api/sessions/${encodeURIComponent(slug)}`);
      setSession(result.session);
      const token = localStorage.getItem(`matchset-owner:${slug}`) || '';
      setEditToken(token);
      setName(result.session.name);
      setPlayerNames(result.session.players.length ? result.session.players : ['', '']);
      setPlayersPerSet(result.session.playersPerSet);
      setEditing(false);
      setPage('view');
      window.history.pushState({}, '', `/set/${slug}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load this set.'); }
    finally { setLoading(false); }
  }

  async function loadCommunity(slug: string, updateUrl = false) {
    setLoading(true); setError(''); setNotice('');
    try {
      const result: CommunityPayload = await api(`/api/communities/${encodeURIComponent(slug)}`);
      setCommunity(result.community);
      setMembers(result.members);
      setMatches(result.matches);
      setLeaderboard(result.leaderboard);
      setCurrentMemberId(localStorage.getItem(`matchset-member:${slug}`) || '');
      setOwnerToken(localStorage.getItem(`matchset-community-owner:${slug}`) || '');
      setSelectedMemberIds(result.members.map((member) => member.id));
      setPage('community');
      if (updateUrl) window.history.pushState({}, '', `/community/${slug}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open this community.'); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0] === 'set' && parts[1]) void loadSession(parts[1]);
    if (parts[0] === 'community' && parts[1]) void loadCommunity(parts[1]);
  }, []);

  function startCreate() {
    window.history.pushState({}, '', '/');
    setSession(null); setEditToken(''); setName(''); setPlayerNames(['', '']); setPlayersPerSet(4);
    setError(''); setNotice(''); setEditing(false); setPage('create');
  }

  async function submitSession(event: FormEvent) {
    event.preventDefault(); setError(''); setNotice('');
    if (players.length < 2) { setError('Add at least two player names to create a set.'); return; }
    setLoading(true);
    try {
      if (editing && session && editToken) {
        const result = await api(`/api/sessions/${session.id}`, { method: 'PUT', body: JSON.stringify({ name, players, playersPerSet, editToken }) });
        setSession(result.session); setEditing(false); setPage('view'); setNotice('Arrangement updated.');
      } else {
        const result = await api('/api/sessions', { method: 'POST', body: JSON.stringify({ name, players, playersPerSet }) });
        setSession(result.session); setEditToken(result.editToken);
        localStorage.setItem(`matchset-owner:${result.session.id}`, result.editToken);
        window.history.pushState({}, '', `/set/${result.session.id}`);
        setPage('view'); setNotice('Your sets are ready. Share the link with everyone.');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this set.'); }
    finally { setLoading(false); }
  }

  async function createCommunity(event: FormEvent) {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const result = await api('/api/communities', { method: 'POST', body: JSON.stringify({ name: communityName, creatorName }) });
      localStorage.setItem(`matchset-community-owner:${result.community.slug}`, result.ownerToken);
      localStorage.setItem(`matchset-member:${result.community.slug}`, result.member.id);
      await loadCommunity(result.community.slug, true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create community.'); }
    finally { setLoading(false); }
  }

  async function joinCommunity(event: FormEvent) {
    event.preventDefault(); setError('');
    const slug = extractCode(joinCode, 'community');
    if (!slug) { setError('Enter a valid community invite link or code.'); return; }
    setLoading(true);
    try {
      const result = await api(`/api/communities/${slug}/members`, { method: 'POST', body: JSON.stringify({ name: joinName }) });
      localStorage.setItem(`matchset-member:${slug}`, result.member.id);
      await loadCommunity(slug, true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not join community.'); }
    finally { setLoading(false); }
  }

  async function addMember(event: FormEvent) {
    event.preventDefault();
    if (!community) return;
    setError(''); setLoading(true);
    try {
      await api(`/api/communities/${community.slug}/members`, { method: 'POST', body: JSON.stringify({ name: newMemberName }) });
      setNewMemberName('');
      await loadCommunity(community.slug);
      setNotice('Player added to the community roster.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add player.'); }
    finally { setLoading(false); }
  }

  function toggleMember(id: string) {
    setSelectedMemberIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function createCommunityMatch(event: FormEvent) {
    event.preventDefault();
    if (!community || !ownerToken) return;
    if (!currentMemberId) { setError('Your organiser player identity is missing. Rejoin this community before creating a match.'); return; }
    const teamCount = Math.ceil(selectedMemberIds.length / playersPerTeam);
    if (teamCount < 2) { setError('Select enough players to create at least two teams.'); return; }
    setError(''); setLoading(true);
    try {
      const result = await api(`/api/communities/${community.slug}/matches`, {
        method: 'POST',
        body: JSON.stringify({ title: matchTitle, memberIds: selectedMemberIds, playersPerTeam, createdByMemberId: currentMemberId, ownerToken }),
      });
      localStorage.setItem(`matchset-result:${result.match.id}`, result.resultToken);
      setMatchTitle('');
      await loadCommunity(community.slug);
      setNotice('Teams created and saved to community history.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create match.'); }
    finally { setLoading(false); }
  }

  async function recordWinner(match: CommunityMatch, teamId: number) {
    if (!community) return;
    const resultToken = localStorage.getItem(`matchset-result:${match.id}`) || '';
    if (!resultToken) { setError('Only the organiser who created this match can record its result.'); return; }
    setError(''); setLoading(true);
    try {
      await api(`/api/communities/${community.slug}/matches/${match.id}/result`, {
        method: 'POST', body: JSON.stringify({ resultToken, winningTeamId: teamId }),
      });
      await loadCommunity(community.slug);
      setNotice('Result saved. Winning players received a community win.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not record result.'); }
    finally { setLoading(false); }
  }

  async function copyText(value: string, success: string) {
    try { await navigator.clipboard.writeText(value); setNotice(success); }
    catch { setNotice(value); }
  }
  function openHome() {
    window.history.pushState({}, '', '/');
    setPage('home'); setSession(null); setCommunity(null); setError(''); setNotice(''); setShowViewInput(false);
  }

  return <main className="shell">
    <header className="topbar"><button className="brand" onClick={openHome} aria-label="MatchSet home"><span className="brand-mark">M</span> matchset</button><span className="top-note">PLAYER ARRANGEMENTS, MADE SIMPLE</span></header>

    {page === 'home' && <section className="hero">
      <div className="eyebrow"><span className="pulse" /> LESS TIME ORGANISING. MORE TIME PLAYING.</div>
      <h1>Make the lineup.<br /><em>Get into the game.</em></h1>
      <p className="intro">Put players into balanced teams, keep a record of every match, and see who wins most in your community.</p>
      <div className="choices">
        <button className="choice create-choice" onClick={() => { setError(''); setPage('create-community'); }}><span className="choice-icon">＋</span><span><strong>Create a community</strong><small>Start a group and keep its match history.</small></span><span className="arrow">↗</span></button>
        <button className="choice view-choice" onClick={() => { setError(''); setPage('join-community'); }}><span className="choice-icon">⌕</span><span><strong>Join a community</strong><small>Use an invite link or community code.</small></span><span className="arrow">↗</span></button>
        <button className="choice view-choice" onClick={startCreate}><span className="choice-icon">▦</span><span><strong>Quick arrangement</strong><small>Create a standalone shareable set.</small></span><span className="arrow">↗</span></button>
        <button className="choice view-choice" onClick={() => { setShowViewInput((value) => !value); setError(''); }}><span className="choice-icon">↗</span><span><strong>View a set</strong><small>Open a standalone arrangement link.</small></span><span className="arrow">↗</span></button>
      </div>
      {showViewInput && <form className="lookup-form" onSubmit={(event) => { event.preventDefault(); void loadSession(viewLink); }}><label htmlFor="view-link">PASTE THE SHARED LINK OR SET CODE</label><div><input id="view-link" value={viewLink} onChange={(event) => setViewLink(event.target.value)} placeholder="https://…/set/abc123" autoFocus /><button className="primary-btn lookup-button" disabled={loading}>Open set ↗</button></div></form>}
      <div className="hero-foot"><span>NO ACCOUNT NEEDED</span><span>·</span><span>COMMUNITY HISTORY</span><span>·</span><span>SHARE INSTANTLY</span></div>
      {error && <p className="error">{error}</p>}
    </section>}

    {page === 'create-community' && <section className="workspace">
      <button className="back" onClick={openHome}>← Back</button>
      <div className="section-kicker">NEW COMMUNITY</div><h1 className="page-title">Start your <em>community.</em></h1>
      <p className="subcopy">Create a shared home for your players, matches and results.</p>
      <form className="form-card" onSubmit={createCommunity}>
        <label className="field-label">COMMUNITY NAME<input value={communityName} onChange={(e) => setCommunityName(e.target.value)} placeholder="e.g. Friday Football Crew" maxLength={60} required /></label>
        <label className="field-label">YOUR PLAYER NAME<input value={creatorName} onChange={(e) => setCreatorName(e.target.value)} placeholder="Name other players know you by" maxLength={40} required /></label>
        <p className="hint">You become the community organiser. Keep your browser data safe: organiser permissions are stored on this device.</p>
        <button className="primary-btn submit-button" disabled={loading}>{loading ? 'Creating…' : 'Create community'} <span>↗</span></button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>}

    {page === 'join-community' && <section className="workspace">
      <button className="back" onClick={openHome}>← Back</button>
      <div className="section-kicker">JOIN A COMMUNITY</div><h1 className="page-title">Find your <em>people.</em></h1>
      <p className="subcopy">Enter the invite code and the player name your group knows you by.</p>
      <form className="form-card" onSubmit={joinCommunity}>
        <label className="field-label">COMMUNITY INVITE LINK OR CODE<input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Paste invite link or code" required /></label>
        <label className="field-label">YOUR PLAYER NAME<input value={joinName} onChange={(e) => setJoinName(e.target.value)} placeholder="e.g. Alex" maxLength={40} required /></label>
        <p className="hint">Names are unique within each community. This first version uses display names, not verified accounts.</p>
        <button className="primary-btn submit-button" disabled={loading}>{loading ? 'Joining…' : 'Join community'} <span>↗</span></button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>}

    {page === 'community' && community && <section className="workspace community-workspace">
      <button className="back" onClick={openHome}>← Home</button>
      <div className="community-heading">
        <div><div className="section-kicker">COMMUNITY / {members.length} PLAYERS</div><h1 className="page-title">{community.name}</h1><p className="subcopy">Shared roster, match history and team leaderboard.</p></div>
        <div className="community-heading-actions">{!currentMemberId && <button className="share-btn" onClick={() => { setJoinCode(window.location.href); setPage('join-community'); }}>Join this community</button>}<button className="share-btn" onClick={() => copyText(`${window.location.origin}/community/${community.slug}`, 'Community invite link copied.')}>↗ Invite players</button></div>
      </div>
      <div className="community-stats">
        <div><strong>{members.length}</strong><span>PLAYERS</span></div>
        <div><strong>{matches.length}</strong><span>MATCHES</span></div>
        <div><strong>{matches.filter((match) => match.winningTeamId !== null).length}</strong><span>RESULTS</span></div>
      </div>

      {isOwner && <div className="community-panel">
        <div className="panel-heading"><div><span className="section-kicker">ORGANISER TOOLS</span><h2>Create a match</h2></div></div>
        <form className="community-form" onSubmit={createCommunityMatch}>
          <label className="field-label">MATCH NAME<input value={matchTitle} onChange={(e) => setMatchTitle(e.target.value)} placeholder="e.g. Saturday evening games" maxLength={80} required /></label>
          <div className="roster-heading"><span className="field-label">SELECT PLAYERS ({selectedMemberIds.length} SELECTED)</span><button type="button" className="text-button" onClick={() => setSelectedMemberIds(selectedMemberIds.length === members.length ? [] : members.map((member) => member.id))}>{selectedMemberIds.length === members.length ? 'Clear all' : 'Select all'}</button></div>
          <div className="roster-select">{members.map((member) => <label className="roster-option" key={member.id}><input type="checkbox" checked={selectedMemberIds.includes(member.id)} onChange={() => toggleMember(member.id)} disabled={member.id === currentMemberId} /><span>{member.name}</span></label>)}</div>
          <div className="form-bottom"><label className="size-label">PLAYERS PER TEAM<select value={playersPerTeam} onChange={(e) => setPlayersPerTeam(Number(e.target.value))}>{Array.from({ length: 19 }, (_, i) => i + 2).map((n) => <option key={n} value={n}>{n} players</option>)}</select></label><span className="count">{Math.ceil(selectedMemberIds.length / playersPerTeam)} TEAMS</span></div>
          <p className="hint">Teams are balanced automatically. A match needs at least two teams. Every selected player is assigned exactly once.</p>
          <button className="primary-btn submit-button" disabled={loading || Math.ceil(selectedMemberIds.length / playersPerTeam) < 2}>{loading ? 'Saving…' : 'Create teams'} <span>↗</span></button>
        </form>
      </div>}

      <div className="community-columns">
        <section className="community-panel">
          <div className="panel-heading"><div><span className="section-kicker">ALL-TIME</span><h2>Leaderboard</h2></div></div>
          {leaderboard.length === 0 ? <p className="empty-state">No results yet. Record a match winner to start the leaderboard.</p> : <div className="leaderboard">
            <div className="leader-row leader-head"><span>PLAYER</span><span>W</span><span>L</span><span>WIN %</span></div>
            {leaderboard.map((entry, index) => <div className="leader-row" key={entry.memberId}><span><b>{String(index + 1).padStart(2, '0')}</b>{entry.name}</span><strong>{entry.wins}</strong><span>{entry.losses}</span><span>{entry.winRate}%</span></div>)}
          </div>}
        </section>
        <section className="community-panel">
          <div className="panel-heading"><div><span className="section-kicker">ROSTER</span><h2>Players</h2></div><span className="count">{members.length} MEMBERS</span></div>
          <div className="member-list">{members.map((member) => <div className="member-item" key={member.id}><span className="member-avatar">{member.name.slice(0,1).toUpperCase()}</span>{member.name}{member.id === currentMemberId && <span className="you-label">YOU</span>}</div>)}</div>
          <form className="add-member-form" onSubmit={addMember}><input value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="Add a player to the roster" maxLength={40} required /><button className="share-btn" disabled={loading}>Add</button></form>
        </section>
      </div>

      <section className="community-panel history-panel">
        <div className="panel-heading"><div><span className="section-kicker">COMMUNITY RECORD</span><h2>Match history</h2></div><span className="count">LATEST 100</span></div>
        {matches.length === 0 ? <p className="empty-state">No matches yet. The organiser can create the first one above.</p> : <div className="match-history">
          {matches.map((match) => {
            const resultToken = localStorage.getItem(`matchset-result:${match.id}`) || '';
            return <article className="history-match" key={match.id}>
              <div className="history-match-head"><div><h3>{match.title}</h3><span>{new Date(match.createdAt).toLocaleDateString()} · {match.teams.length} teams</span></div><span className={match.winningTeamId ? 'result-status complete' : 'result-status'}>{match.winningTeamId ? `TEAM ${match.winningTeamId} WON` : 'AWAITING RESULT'}</span></div>
              <div className="history-teams">{match.teams.map((team) => <div className={match.winningTeamId === team.id ? 'history-team winner' : 'history-team'} key={team.id}><div><b>TEAM {team.id}</b>{match.winningTeamId === team.id && <span>WINNER</span>}</div><p>{team.players.map((player) => player.name).join(' · ')}</p>{!match.winningTeamId && resultToken && <button className="record-win-btn" onClick={() => void recordWinner(match, team.id)} disabled={loading}>Record as winner</button>}</div>)}</div>
              {!match.winningTeamId && !resultToken && <p className="hint">The match organiser can record the winning team from the device used to create this match.</p>}
            </article>;
          })}
        </div>}
      </section>
      {!currentMemberId && <p className="hint">You are viewing this community without joining. Use the invite flow to add your player name.</p>}
    </section>}

    {page === 'create' && <section className="workspace">
      <button className="back" onClick={openHome}>← Back</button>
      <div className="section-kicker">{editing ? 'EDIT ARRANGEMENT / 02' : 'NEW ARRANGEMENT / 01'}</div><h1 className="page-title">{editing ? 'Update your' : 'Create your'} <em>set.</em></h1>
      <p className="subcopy">Add each player below. We’ll split everyone into balanced groups.</p>
      <form className="form-card" onSubmit={submitSession}>
        <label className="field-label">ARRANGEMENT NAME<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Saturday court session" maxLength={80} required /></label>
        <div className="players-field">
          <div className="players-field-heading"><span className="field-label">PLAYERS</span><span className="label-hint">ENTER EACH PLAYER SEPARATELY</span></div>
          <div className="player-input-list">
            {playerNames.map((player, index) => <div className="player-input-row" key={index}><label htmlFor={`player-${index}`}>Player {index + 1}</label><input id={`player-${index}`} value={player} onChange={(e) => updatePlayer(index, e.target.value)} placeholder={`Enter player ${index + 1} name`} maxLength={60} autoComplete="off" /><button type="button" className="remove-player" onClick={() => removePlayer(index)} disabled={playerNames.length <= 2} aria-label={`Remove player ${index + 1}`}>×</button></div>)}
          </div>
          <div className="player-list-footer"><button type="button" className="add-player-btn" onClick={addPlayer} disabled={playerNames.length >= 500}>＋ Add player</button><span className="count">{players.length} / 500 PLAYERS</span></div>
        </div>
        <div className="form-bottom"><label className="size-label">PLAYERS PER SET<select value={playersPerSet} onChange={(e) => setPlayersPerSet(Number(e.target.value))}>{Array.from({ length: 19 }, (_, i) => i + 2).map((n) => <option key={n} value={n}>{n} players</option>)}</select></label></div>
        <div className="live-preview"><span>{players.length < 2 ? 'Add at least 2 players to see your group preview.' : <><strong>{players.length} players</strong> will be arranged into <strong>{projectedSets} sets</strong>, with up to {playersPerSet} per set.</>}</span></div>
        <p className="hint">Every player is included. Groups will be as even as possible, with no more than one player difference.</p>
        <button className="primary-btn submit-button" disabled={loading}>{loading ? 'Saving…' : editing ? 'Save changes' : 'Create sets'} <span>↗</span></button>
      </form>
    </section>}

    {page === 'view' && session && <section className="workspace">
      <button className="back" onClick={openHome}>← Home</button>
      <div className="view-heading"><div><div className="section-kicker">SHARED ARRANGEMENT</div><h1 className="page-title">{session.name}</h1><p className="subcopy">{session.players.length} players <span>·</span> {session.sets.length} sets <span>·</span> {session.playersPerSet} per set max</p></div><div className="view-toolbar"><button className="share-btn" onClick={() => copyText(window.location.href, 'Link copied.')}>↗ Share link</button><button className="share-btn" onClick={() => copyText([session.name, ...session.sets.flatMap((group) => [`SET ${group.id}`, ...group.players])].join('\n'), 'All sets copied.')}>▤ Copy all sets</button><button className="share-btn print-btn" onClick={() => window.print()}>⎙ Print</button></div></div>
      <div className="sets-grid">{session.sets.map((group) => <article className="set-card" key={group.id}><div className="set-card-head"><span>SET {String(group.id).padStart(2, '0')}</span><span>{group.players.length} PLAYERS</span></div><ol>{group.players.map((player, index) => <li key={`${player}-${index}`}><span className="player-number">{String(index + 1).padStart(2, '0')}</span>{player}</li>)}</ol></article>)}</div>
      <div className="view-actions"><span className="muted">EVERY PLAYER ACCOUNTED FOR · BALANCED GROUPS</span>{Boolean(editToken) && <button className="edit-btn" onClick={() => { setEditing(true); setError(''); setNotice(''); setPage('create'); }}>Edit arrangement</button>}</div>
    </section>}

    {loading && page === 'view' && !session && <p className="muted">Loading set…</p>}
    {error && <p className="error global-error">{error}</p>}
    {notice && <div className="toast" role="status">{notice}</div>}
    <footer><span>© {new Date().getFullYear()} MATCHSET</span><span>KEEP THE GAME MOVING.</span></footer>
  </main>;
}
