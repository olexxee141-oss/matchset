import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

type SetGroup = { id: number; players: string[] };
type Session = { id: string; name: string; players: string[]; playersPerSet: number; sets: SetGroup[]; createdAt: string; updatedAt: string };
const api = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
};

export default function App() {
  const [page, setPage] = useState<'home' | 'create' | 'view'>('home');
  const [session, setSession] = useState<Session | null>(null);
  const [name, setName] = useState('');
  const [playersText, setPlayersText] = useState('');
  const [playersPerSet, setPlayersPerSet] = useState(4);
  const [viewLink, setViewLink] = useState('');
  const [showViewInput, setShowViewInput] = useState(false);
  const [editToken, setEditToken] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const players = useMemo(() => playersText.split('\n').map((item) => item.trim()).filter(Boolean), [playersText]);
  const isOwner = Boolean(session && editToken);

  async function loadSession(value: string) {
    setError(''); setNotice('');
    let slug = value.trim();
    try {
      if (slug.includes('://')) slug = new URL(slug).pathname.split('/').filter(Boolean).at(-1) || '';
    } catch { setError('Enter a valid MatchSet link or set code.'); return; }
    slug = slug.replace(/^set\//, '').trim();
    if (!/^[a-zA-Z0-9_-]{6,40}$/.test(slug)) { setError('Enter a valid MatchSet link or set code.'); return; }
    setLoading(true);
    try {
      const result = await api(`/api/sessions/${encodeURIComponent(slug)}`);
      setSession(result.session);
      const token = localStorage.getItem(`matchset-owner:${slug}`) || '';
      setEditToken(token);
      setName(result.session.name);
      setPlayersText(result.session.players.join('\n'));
      setPlayersPerSet(result.session.playersPerSet);
      setEditing(false);
      setPage('view');
      window.history.pushState({}, '', `/set/${slug}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load this set.'); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const slug = window.location.pathname.split('/').filter(Boolean)[1];
    if (slug) void loadSession(slug);
  }, []);

  function startCreate() {
    window.history.pushState({}, '', '/');
    setSession(null); setEditToken(''); setName(''); setPlayersText(''); setPlayersPerSet(4);
    setError(''); setNotice(''); setEditing(false); setPage('create');
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setNotice('');
    if (players.length < 2) { setError('Add at least two player names, one per line.'); return; }
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
        setPage('view'); setNotice('Your set is ready. Share the link with everyone.');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this set.'); }
    finally { setLoading(false); }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); setNotice('Link copied.'); }
    catch { setNotice(`Share this link: ${window.location.href}`); }
  }

  function openHome() {
    window.history.pushState({}, '', '/');
    setPage('home'); setSession(null); setError(''); setNotice(''); setShowViewInput(false);
  }

  return <main className="shell">
    <header className="topbar"><button className="brand" onClick={openHome} aria-label="MatchSet home"><span className="brand-mark">M</span> matchset</button><span className="top-note">PLAYER ARRANGEMENTS, MADE SIMPLE</span></header>
    {page === 'home' && <section className="hero">
      <div className="eyebrow"><span className="pulse" /> LESS TIME ORGANISING. MORE TIME PLAYING.</div>
      <h1>Make the lineup.<br /><em>Get into the game.</em></h1>
      <p className="intro">Put players into balanced sets in seconds. Share one link so everyone knows where they belong.</p>
      <div className="choices">
        <button className="choice create-choice" onClick={startCreate}><span className="choice-icon">＋</span><span><strong>Create a set</strong><small>Add players and arrange them into groups.</small></span><span className="arrow">↗</span></button>
        <button className="choice view-choice" onClick={() => { setShowViewInput((value) => !value); setError(''); }}><span className="choice-icon">⌕</span><span><strong>View a set</strong><small>Open the link shared by the organiser.</small></span><span className="arrow">↗</span></button>
      </div>
      {showViewInput && <form className="lookup-form" onSubmit={(event) => { event.preventDefault(); void loadSession(viewLink); }}><label htmlFor="view-link">PASTE THE SHARED LINK OR SET CODE</label><div><input id="view-link" value={viewLink} onChange={(event) => setViewLink(event.target.value)} placeholder="https://…/set/abc123" autoFocus /><button className="primary-btn" disabled={loading}>{loading ? 'Opening…' : 'Open set ↗'}</button></div></form>}
      <div className="hero-foot"><span>NO ACCOUNT NEEDED</span><span>·</span><span>FREE TO USE</span><span>·</span><span>SHARE INSTANTLY</span></div>
      {error && <p className="error">{error}</p>}
    </section>}

    {page === 'create' && <section className="workspace">
      <button className="back" onClick={openHome}>← Back</button>
      <div className="section-kicker">{editing ? 'EDIT ARRANGEMENT / 02' : 'NEW ARRANGEMENT / 01'}</div><h1 className="page-title">{editing ? 'Update your' : 'Create your'} <em>set.</em></h1>
      <p className="subcopy">Add everyone playing. We’ll split the list into balanced groups.</p>
      <form className="form-card" onSubmit={submit}>
        <label>ARRANGEMENT NAME<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Saturday court session" maxLength={80} required /></label>
        <label>PLAYER NAMES <span className="label-hint">ONE NAME PER LINE</span><textarea value={playersText} onChange={(e) => setPlayersText(e.target.value)} placeholder={'Alex\nJordan\nSam\nTaylor'} rows={9} required /></label>
        <div className="form-bottom"><span className="count">{players.length} PLAYERS ADDED</span><label className="size-label">PLAYERS PER SET<select value={playersPerSet} onChange={(e) => setPlayersPerSet(Number(e.target.value))}>{Array.from({ length: 19 }, (_, i) => i + 2).map((n) => <option key={n} value={n}>{n} players</option>)}</select></label></div>
        <p className="hint">All players are included. If the numbers don’t divide evenly, groups will differ by no more than one player.</p>
        <button className="primary-btn" disabled={loading}>{loading ? 'Saving…' : editing ? 'Save changes' : 'Generate arrangement'} <span>↗</span></button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>}

    {page === 'view' && session && <section className="workspace">
      <button className="back" onClick={openHome}>← Home</button>
      <div className="view-heading"><div><div className="section-kicker">SHARED ARRANGEMENT</div><h1 className="page-title">{session.name}</h1><p className="subcopy">{session.players.length} players <span>·</span> {session.sets.length} sets <span>·</span> {session.playersPerSet} per set max</p></div><button className="share-btn" onClick={copyLink}>↗ Share link</button></div>
      <div className="sets-grid">{session.sets.map((group) => <article className="set-card" key={group.id}><div className="set-card-head"><span>SET {String(group.id).padStart(2, '0')}</span><span>{group.players.length} PLAYERS</span></div><ol>{group.players.map((player, index) => <li key={`${player}-${index}`}><span className="player-number">{String(index + 1).padStart(2, '0')}</span>{player}</li>)}</ol></article>)}</div>
      <div className="view-actions"><span className="muted">EVERY PLAYER ACCOUNTED FOR · BALANCED GROUPS</span>{isOwner && <button className="edit-btn" onClick={() => { setEditing(true); setError(''); setNotice(''); setPage('create'); }}>Edit arrangement</button>}</div>
    </section>}

    {loading && page === 'view' && !session && <p className="muted">Loading set…</p>}
    {error && page === 'view' && !session && <section className="workspace"><p className="error">{error}</p><button className="back" onClick={openHome}>← Back home</button></section>}
    {notice && <div className="toast" role="status">{notice}</div>}
    <footer><span>© {new Date().getFullYear()} MATCHSET</span><span>KEEP THE GAME MOVING.</span></footer>
  </main>;
}
