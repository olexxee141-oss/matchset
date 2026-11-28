import { useEffect, useMemo, useState } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type { FormEvent } from 'react';
import { resolveAppRoute, type AppPage } from './navigation';
import { api } from './lib/api';
import { extractCode } from './lib/codes';
import { ActionButton, SectionTabs, StatusMessage } from './components/ui';
import { LiveMatchCard } from './components/LiveMatchCard';

type SetGroup = { id: number; players: string[] };
type Session = { id: string; name: string; players: string[]; playersPerSet: number; sets: SetGroup[]; createdAt: string; updatedAt: string };
type Member = { id: string; name: string; joined_at?: string; role?: 'MEMBER' | 'ADMIN' };
type TournamentTeam = { id: string; name: string; members: Array<{ id: string; name: string }> };
type TournamentGroup = { id: string; name: string; teams: TournamentTeam[] };
type Tournament = { id: string; name: string; createdAt: string; groups: TournamentGroup[] };
type DraftTournamentTeam = { name: string; memberIds: string[] };
type Team = { id: number; players: Array<{ id: string; name: string }> };
type RotationGoal = { teamId: number; scorerId: string; scorerName: string; assisterId: string | null; assisterName: string | null; scoredAt: string };
type RotationGame = { number: number; teamAId: number; teamBId: number; outcome: 'TEAM_A_WIN' | 'TEAM_B_WIN' | 'DRAW'; winnerTeamId: number | null; playedAt: string; goals?: RotationGoal[]; score?: [number, number] };
type RotationState = { status: 'ACTIVE' | 'ENDED'; activeTeamIds: number[]; waitingTeamIds: number[]; games: RotationGame[]; goalsToWin?: number; durationSeconds?: number; score?: [number, number]; goals?: RotationGoal[]; timerStartedAt?: string; timerPausedAt?: string | null; pausedRemainingMs?: number | null };
type CommunityMatch = { id: string; title: string; teams: Team[]; winningTeamId: number | null; rotationState?: RotationState | null; createdAt: string; completedAt: string | null };
type LeaderboardEntry = { memberId: string; name: string; wins: number; losses: number; draws?: number; matchesPlayed: number; winRate: number };
type Community = { slug: string; name: string; createdAt: string };
type CommunityPayload = { community: Community; members: Member[]; matches: CommunityMatch[]; leaderboard: LeaderboardEntry[]; tournaments: Tournament[]; access: { role: 'OWNER' | 'ADMIN' | 'VIEWER' } };


export default function App() {
  const [page, setPageState] = useState<AppPage>(() => resolveAppRoute(window.location.pathname).page);
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
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [communityAccess, setCommunityAccess] = useState<'OWNER' | 'ADMIN' | 'VIEWER'>('VIEWER');
  const [recentCommunities, setRecentCommunities] = useState<Community[]>(() => {
    try { return JSON.parse(localStorage.getItem('matchset-recent-communities') || '[]') as Community[]; } catch { return []; }
  });
  const [adminInviteLink, setAdminInviteLink] = useState('');
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentGroupCount, setTournamentGroupCount] = useState(2);
  const [tournamentTeams, setTournamentTeams] = useState<DraftTournamentTeam[]>([{ name: 'Team 1', memberIds: [] }, { name: 'Team 2', memberIds: [] }]);
  const [communityName, setCommunityName] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [communityTab, setCommunityTab] = useState<'overview' | 'matches' | 'create-match' | 'tournaments'>('overview');
  const [communityMenuOpen, setCommunityMenuOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [currentMemberId, setCurrentMemberId] = useState('');
  const [ownerToken, setOwnerToken] = useState('');
  const [matchTitle, setMatchTitle] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [playersPerTeam, setPlayersPerTeam] = useState(4);
  const [goalsToWin, setGoalsToWin] = useState(1);
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [clockNow, setClockNow] = useState(Date.now());
  const [goalSelections, setGoalSelections] = useState<Record<string, { teamId: number; scorerId: string; assisterId: string }>>({});
  const [timerSyncing, setTimerSyncing] = useState<Record<string, boolean>>({});
  const [accountLoaded, setAccountLoaded] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountUserId, setAccountUserId] = useState('');
  const [accountCsrf, setAccountCsrf] = useState('');
  const [accountPasskeys, setAccountPasskeys] = useState<Array<{ credential_id: string; device_type: string | null; backed_up: boolean; created_at: string; last_used_at: string | null }>>([]);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryAcknowledged, setRecoveryAcknowledged] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [recoveryLinkToken, setRecoveryLinkToken] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');

  const setPage = (nextPage: AppPage) => {
    setPageState(nextPage);
    const nextPath = nextPage === 'home' ? '/' : nextPage === 'create' ? '/arrange' : nextPage === 'view' || nextPage === 'community' ? window.location.pathname : nextPage === 'create-community' ? '/community/new' : nextPage === 'join-community' ? '/community/join' : nextPage === 'account' ? '/account' : nextPage === 'recover' ? '/recover/verify' : window.location.pathname;
    if (nextPath !== window.location.pathname) window.history.pushState({ page: nextPage }, '', nextPath);
  };


  const players = useMemo(() => playerNames.map((item) => item.trim()).filter(Boolean), [playerNames]);
  const projectedSets = players.length >= 2 ? Math.ceil(players.length / playersPerSet) : 0;
  const isOwner = communityAccess === 'OWNER';
  const isAdmin = communityAccess === 'ADMIN';
  const canManageTournaments = isOwner || isAdmin;

  useEffect(() => {
    if (!communityMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setCommunityMenuOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [communityMenuOpen]);

  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!community || !isOwner) return;
    for (const match of matches) {
      const rotation = match.rotationState;
      if (!rotation || rotation.status !== 'ACTIVE' || rotation.timerPausedAt || !rotation.timerStartedAt) continue;
      const remaining = Math.max(0, (rotation.durationSeconds ?? 600) * 1000 - (clockNow - new Date(rotation.timerStartedAt).getTime()));
      const key = match.id + ':' + rotation.games.length;
      if (remaining === 0 && !timerSyncing[key]) void controlRotationTimer(match, 'TICK', key);
    }
  }, [clockNow, matches, community, isOwner, timerSyncing]);

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

  async function loadSession(value: string, updateUrl = true) {
    setError(''); setNotice('');
    const slug = extractCode(value, 'set');
    if (!slug) { setError('Enter a valid MatchSet link or set code.'); return; }
    setLoading(true);
    try {
      const result = await api<{ session: Session }>(`/api/sessions/${encodeURIComponent(slug)}`);
      setSession(result.session);
      const token = localStorage.getItem(`matchset-owner:${slug}`) || '';
      setEditToken(token);
      setName(result.session.name);
      setPlayerNames(result.session.players.length ? result.session.players : ['', '']);
      setPlayersPerSet(result.session.playersPerSet);
      setEditing(false);
      setPage('view');
      if (updateUrl && window.location.pathname !== `/set/${slug}`) window.history.pushState({}, '', `/set/${slug}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load this set.'); }
    finally { setLoading(false); }
  }

  async function loadCommunity(slug: string, updateUrl = false) {
    setLoading(true); setError(''); setNotice('');
    try {
      const url = new URL(window.location.href);
      const invitedAdminToken = url.searchParams.get('adminToken');
      if (invitedAdminToken) {
        localStorage.setItem(`matchset-admin:${slug}`, invitedAdminToken);
        url.searchParams.delete('adminToken');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      }
      const savedOwnerToken = localStorage.getItem(`matchset-community-owner:${slug}`) || '';
      const savedAdminToken = localStorage.getItem(`matchset-admin:${slug}`) || '';
      const result: CommunityPayload = await api<CommunityPayload>(`/api/communities/${encodeURIComponent(slug)}`, {
        headers: {
          ...(savedOwnerToken ? { 'X-Community-Owner-Token': savedOwnerToken } : {}),
          ...(savedAdminToken ? { 'X-Community-Admin-Token': savedAdminToken } : {}),
        },
      });
      setCommunity(result.community);
      setMembers(result.members);
      setMatches(result.matches);
      setLeaderboard(result.leaderboard);
      setTournaments(result.tournaments || []);
      setCommunityAccess(result.access?.role || (savedOwnerToken ? 'OWNER' : 'VIEWER'));
      setCurrentMemberId(localStorage.getItem(`matchset-member:${slug}`) || '');
      setOwnerToken(savedOwnerToken);
      setSelectedMemberIds(result.members.map((member) => member.id));
      setRecentCommunities((current) => {
        const next = [result.community, ...current.filter((item) => item.slug !== slug)].slice(0, 12);
        localStorage.setItem('matchset-recent-communities', JSON.stringify(next));
        return next;
      });
      setCommunityTab('overview');
      setCommunityMenuOpen(false);
      setPage('community');
      if (updateUrl) window.history.pushState({}, '', `/community/${slug}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open this community.'); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0] === 'recover' && parts[1] === 'verify') {
      const linkToken = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') || '';
      if (linkToken) {
        setRecoveryLinkToken(linkToken);
        window.history.replaceState({}, '', window.location.pathname);
        setPage('recover');
        return;
      }
    }
    if (parts[0] === 'set' && parts[1]) void loadSession(parts[1], false);
    if (parts[0] === 'community' && parts[1] && parts[1] !== 'new' && parts[1] !== 'join') void loadCommunity(parts[1]);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const route = resolveAppRoute(window.location.pathname);
      setError(''); setNotice('');
      if (route.page === 'community' && route.slug) { void loadCommunity(route.slug); return; }
      if (route.page === 'view' && route.slug) { void loadSession(route.slug, false); return; }
      if (route.page === 'home') { setCommunity(null); setSession(null); }
      if (route.page === 'recover') setRecoveryLinkToken(new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') || '');
      setPageState(route.page);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (page !== 'account') return;
    let active = true;
    setAccountLoaded(false);
    void api<{ userId: string; csrfToken: string; passkeys: Array<{ credential_id: string; device_type: string | null; backed_up: boolean; created_at: string; last_used_at: string | null }>; recoveryCodeAcknowledged: boolean }>('/api/auth/me')
      .then((result) => {
        if (!active) return;
        setAccountUserId(result.userId);
        setAccountCsrf(result.csrfToken);
        setAccountPasskeys(result.passkeys);
        setRecoveryAcknowledged(result.recoveryCodeAcknowledged);
      })
      .catch((e) => {
        if (!active) return;
        setAccountUserId('');
        if (!(e instanceof Error && e.message.includes('Sign in with a passkey'))) setError(e instanceof Error ? e.message : 'Could not load account.');
      })
      .finally(() => { if (active) setAccountLoaded(true); });
    return () => { active = false; };
  }, [page]);

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
        const result = await api<{ session: Session }>(`/api/sessions/${session.id}`, { method: 'PUT', body: JSON.stringify({ name, players, playersPerSet, editToken }) });
        setSession(result.session); setEditing(false); setPage('view'); setNotice('Arrangement updated.');
      } else {
        const result = await api<{ session: Session; editToken: string }>('/api/sessions', { method: 'POST', body: JSON.stringify({ name, players, playersPerSet }) });
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
      const result = await api<{ community: Community; member: Member; ownerToken: string }>('/api/communities', { method: 'POST', body: JSON.stringify({ name: communityName, creatorName }) });
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
    await loadCommunity(slug, true);
  }

  function adminHeaders(): Record<string, string> {
    const token = community ? localStorage.getItem(`matchset-admin:${community.slug}`) || '' : '';
    const headers: Record<string, string> = {};
    if (token) headers['X-Community-Admin-Token'] = token;
    return headers;
  }

  async function changeMemberRole(member: Member) {
    if (!community || !ownerToken) return;
    setError(''); setNotice(''); setAdminInviteLink(''); setLoading(true);
    try {
      if (member.role === 'ADMIN') {
        await api(`/api/communities/${community.slug}/members/${member.id}/admin`, {
          method: 'DELETE', body: JSON.stringify({ ownerToken }),
        });
        await loadCommunity(community.slug);
        setNotice(`${member.name} is now a regular member.`);
      } else {
        const result = await api<{ role: string; adminToken: string }>(`/api/communities/${community.slug}/members/${member.id}/admin`, {
          method: 'POST', body: JSON.stringify({ ownerToken }),
        });
        const invite = `${window.location.origin}/community/${community.slug}?adminToken=${encodeURIComponent(result.adminToken)}`;
        setAdminInviteLink(invite);
        await loadCommunity(community.slug);
        setNotice(`Admin access created for ${member.name}. Share the private admin link with them.`);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update this member role.'); }
    finally { setLoading(false); }
  }

  function updateDraftTeam(index: number, patch: Partial<DraftTournamentTeam>) {
    setTournamentTeams((current) => current.map((team, teamIndex) => teamIndex === index ? { ...team, ...patch } : team));
  }

  async function createTournament(event: FormEvent) {
    event.preventDefault();
    if (!community || !canManageTournaments) return;
    const teams = tournamentTeams.filter((team) => team.name.trim() && team.memberIds.length >= 2);
    if (teams.length < 2) { setError('Add at least two teams, with at least two community players per team.'); return; }
    if (teams.some((team) => team.memberIds.length !== new Set(team.memberIds).size)) { setError('A player cannot appear twice in the same team.'); return; }
    const allIds = teams.flatMap((team) => team.memberIds);
    if (new Set(allIds).size !== allIds.length) { setError('Each player can only be assigned to one team in a tournament.'); return; }
    const count = Math.min(tournamentGroupCount, teams.length);
    const groups = Array.from({ length: count }, (_, index) => ({
      name: `Group ${String.fromCharCode(65 + index)}`,
      teams: [] as Array<{ name: string; memberIds: string[] }>,
    }));
    teams.forEach((team, index) => groups[index % count].teams.push({ name: team.name.trim(), memberIds: team.memberIds }));
    setError(''); setLoading(true);
    try {
      await api(`/api/communities/${community.slug}/tournaments`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ name: tournamentName, groups, ...(isOwner ? { ownerToken } : {}) }),
      });
      setTournamentName('');
      setTournamentTeams([{ name: 'Team 1', memberIds: [] }, { name: 'Team 2', memberIds: [] }]);
      await loadCommunity(community.slug);
      setCommunityTab('tournaments');
      setNotice('Tournament groups created and saved.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create tournament.'); }
    finally { setLoading(false); }
  }

  async function moveTournamentTeam(tournament: Tournament, teamId: string, targetGroupId: string) {
    if (!community || !canManageTournaments) return;
    const moving = tournament.groups.flatMap((group) => group.teams.map((team) => ({ ...team, groupId: group.id }))).find((team) => team.id === teamId);
    if (!moving || moving.groupId === targetGroupId) return;
    const sourceGroup = tournament.groups.find((group) => group.id === moving.groupId);
    if (sourceGroup && sourceGroup.teams.length <= 1) { setError('Each tournament group must retain at least one team.'); return; }
    const groups = tournament.groups.map((group) => ({
      name: group.name,
      teams: group.teams.filter((team) => team.id !== teamId).map((team) => ({ name: team.name, memberIds: team.members.map((member) => member.id) })),
    }));
    const targetIndex = tournament.groups.findIndex((group) => group.id === targetGroupId);
    if (targetIndex < 0) return;
    groups[targetIndex].teams.push({ name: moving.name, memberIds: moving.members.map((member) => member.id) });
    setError(''); setLoading(true);
    try {
      await api(`/api/communities/${community.slug}/tournaments/${tournament.id}/groups`, {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify({ groups, ...(isOwner ? { ownerToken } : {}) }),
      });
      await loadCommunity(community.slug);
      setCommunityTab('tournaments');
      setNotice('Tournament grouping updated.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update tournament groups.'); }
    finally { setLoading(false); }
  }

  async function addMember(event: FormEvent) {
    event.preventDefault();
    if (!community) return;
    setError(''); setLoading(true);
    try {
      await api<{ member: Member }>(`/api/communities/${community.slug}/members`, { method: 'POST', body: JSON.stringify({ name: newMemberName, ownerToken }) });
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
      const result = await api<{ match: CommunityMatch; resultToken: string }>(`/api/communities/${community.slug}/matches`, {
        method: 'POST',
        body: JSON.stringify({ title: matchTitle, memberIds: selectedMemberIds, playersPerTeam, createdByMemberId: currentMemberId, ownerToken, goalsToWin, durationMinutes }),
      });
      localStorage.setItem(`matchset-result:${result.match.id}`, result.resultToken);
      setMatchTitle('');
      setGoalsToWin(1); setDurationMinutes(10);
      await loadCommunity(community.slug);
      setCommunityTab('matches');
      setNotice('Teams created and saved to community history.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create match.'); }
    finally { setLoading(false); }
  }

  async function recordGoal(match: CommunityMatch, teamId: number) {
    if (!community || !match.rotationState) return;
    const selection = goalSelections[match.id];
    if (!selection?.scorerId) { setError('Select the player who scored the goal.'); return; }
    const resultToken = localStorage.getItem(`matchset-result:${match.id}`) || '';
    if (!resultToken) { setError('Only the organiser who created this match can record goals.'); return; }
    setError(''); setLoading(true);
    try {
      await api<{ match: CommunityMatch }>(`/api/communities/${community.slug}/matches/${match.id}/rotation/goal`, {
        method: 'POST', body: JSON.stringify({ resultToken, teamId, scorerId: selection.scorerId, assisterId: selection.assisterId || null }),
      });
      await loadCommunity(community.slug);
      setNotice('Goal recorded.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not record this goal.'); }
    finally { setLoading(false); }
  }

  async function controlRotationTimer(match: CommunityMatch, action: 'PAUSE' | 'RESUME' | 'TICK', key = match.id) {
    if (!community) return;
    const resultToken = localStorage.getItem(`matchset-result:${match.id}`) || '';
    if (!resultToken) return;
    setTimerSyncing((current) => ({ ...current, [key]: true }));
    try {
      await api<{ match: CommunityMatch }>(`/api/communities/${community.slug}/matches/${match.id}/rotation/timer`, {
        method: 'POST', body: JSON.stringify({ resultToken, action }),
      });
      await loadCommunity(community.slug);
    } catch (e) {
      if (action !== 'TICK') setError(e instanceof Error ? e.message : 'Could not update the match timer.');
    } finally {
      setTimerSyncing((current) => { const next = { ...current }; delete next[key]; return next; });
    }
  }

  async function recordRotationOutcome(match: CommunityMatch, outcome: 'TEAM_A_WIN' | 'TEAM_B_WIN' | 'DRAW') {
    if (!community) return;
    const resultToken = localStorage.getItem(`matchset-result:${match.id}`) || '';
    if (!resultToken) { setError('Only the organiser who created this match can record its result.'); return; }
    setError(''); setLoading(true);
    try {
      await api<{ match: CommunityMatch }>(`/api/communities/${community.slug}/matches/${match.id}/rotation/result`, {
        method: 'POST', body: JSON.stringify({ resultToken, outcome }),
      });
      await loadCommunity(community.slug);
      setNotice(outcome === 'DRAW' ? 'Draw recorded. Both teams rotated out.' : 'Result recorded. The winning team stays on.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not record this result.'); }
    finally { setLoading(false); }
  }

  async function undoRotationOutcome(match: CommunityMatch) {
    if (!community) return;
    const resultToken = localStorage.getItem(`matchset-result:${match.id}`) || '';
    if (!resultToken) { setError('Only the organiser who created this match can undo its result.'); return; }
    setError(''); setLoading(true);
    try {
      await api<{ match: CommunityMatch }>(`/api/communities/${community.slug}/matches/${match.id}/rotation/undo`, {
        method: 'POST', body: JSON.stringify({ resultToken }),
      });
      await loadCommunity(community.slug);
      setNotice('The latest result was undone and the previous lineup restored.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not undo the latest result.'); }
    finally { setLoading(false); }
  }

  async function refreshAccount() {
    const result = await api<{ userId: string; csrfToken: string; passkeys: typeof accountPasskeys; recoveryCodeAcknowledged: boolean }>('/api/auth/me');
    setAccountUserId(result.userId); setAccountCsrf(result.csrfToken);
    setAccountPasskeys(result.passkeys); setRecoveryAcknowledged(result.recoveryCodeAcknowledged);
  }

  async function createPasskeyAccount() {
    setAccountBusy(true); setError(''); setRecoveryMessage('');
    try {
      const started = await api<{ options: unknown }>('/api/auth/register/options', { method: 'POST', body: '{}' });
      const credential = await startRegistration({ optionsJSON: started.options as Parameters<typeof startRegistration>[0]['optionsJSON'] });
      const completed = await api<{ csrfToken: string; recoveryCode: string }>('/api/auth/register/verify', { method: 'POST', body: JSON.stringify({ response: credential }) });
      setAccountCsrf(completed.csrfToken); setRecoveryCode(completed.recoveryCode);
      await refreshAccount(); setNotice('Passkey account created. Save your recovery code before continuing.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create your passkey account.'); }
    finally { setAccountBusy(false); }
  }

  async function signInWithPasskey() {
    setAccountBusy(true); setError('');
    try {
      const started = await api<{ options: unknown }>('/api/auth/login/options', { method: 'POST', body: '{}' });
      const credential = await startAuthentication({ optionsJSON: started.options as Parameters<typeof startAuthentication>[0]['optionsJSON'] });
      await api('/api/auth/login/verify', { method: 'POST', body: JSON.stringify({ response: credential }) });
      await refreshAccount(); setNotice('Signed in with your passkey.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Passkey sign-in failed.'); }
    finally { setAccountBusy(false); }
  }

  async function rotateUnacknowledgedRecoveryCode() {
    if (!accountCsrf) return;
    setAccountBusy(true); setError('');
    try {
      const result = await api<{ recoveryCode: string }>('/api/auth/recovery-code/rotate', {
        method: 'POST', headers: { 'X-CSRF-Token': accountCsrf }, body: '{}',
      });
      setRecoveryCode(result.recoveryCode);
      setNotice('A replacement recovery code is ready. Save it before continuing.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not replace the recovery code.'); }
    finally { setAccountBusy(false); }
  }

  async function acknowledgeRecoveryCode() {
    if (!recoveryCode || !accountCsrf) return;
    setAccountBusy(true); setError('');
    try {
      await api('/api/auth/recovery-code/acknowledge', { method: 'POST', headers: { 'X-CSRF-Token': accountCsrf }, body: JSON.stringify({ recoveryCode }) });
      setRecoveryCode(''); await refreshAccount(); setNotice('Recovery code acknowledgement saved.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not acknowledge the recovery code.'); }
    finally { setAccountBusy(false); }
  }

  async function addAccountPasskey() {
    setAccountBusy(true); setError('');
    try {
      const started = await api<{ options: unknown }>('/api/auth/passkeys/register/options', { method: 'POST', headers: { 'X-CSRF-Token': accountCsrf }, body: '{}' });
      const credential = await startRegistration({ optionsJSON: started.options as Parameters<typeof startRegistration>[0]['optionsJSON'] });
      await api('/api/auth/passkeys/register/verify', { method: 'POST', headers: { 'X-CSRF-Token': accountCsrf }, body: JSON.stringify({ response: credential }) });
      await refreshAccount(); setNotice('Additional passkey registered.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add a passkey.'); }
    finally { setAccountBusy(false); }
  }

  async function revokeAccountPasskey(credentialId: string) {
    setAccountBusy(true); setError('');
    try {
      await api('/api/auth/passkeys/' + encodeURIComponent(credentialId), { method: 'DELETE', headers: { 'X-CSRF-Token': accountCsrf } });
      await refreshAccount(); setNotice('Passkey revoked.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not revoke passkey.'); }
    finally { setAccountBusy(false); }
  }

  async function signOutAccount() {
    setAccountBusy(true); setError('');
    try {
      await api('/api/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': accountCsrf }, body: '{}' });
      setAccountUserId(''); setAccountCsrf(''); setAccountPasskeys([]); setRecoveryAcknowledged(false);
      setNotice('Signed out.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign out.'); }
    finally { setAccountBusy(false); }
  }

  async function requestAccountRecovery(event: FormEvent) {
    event.preventDefault(); setAccountBusy(true); setError(''); setRecoveryMessage('');
    try {
      const result = await api<{ message: string }>('/api/auth/recovery/start', { method: 'POST', body: JSON.stringify({ recoveryCode: recoveryCodeInput, email: recoveryEmail }) });
      setRecoveryMessage(result.message);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start account recovery.'); }
    finally { setAccountBusy(false); }
  }

  async function completeAccountRecovery() {
    if (!recoveryLinkToken) return;
    setAccountBusy(true); setError('');
    try {
      const started = await api<{ options: unknown }>('/api/auth/recovery/verify-email', { method: 'POST', body: JSON.stringify({ token: recoveryLinkToken }) });
      const credential = await startRegistration({ optionsJSON: started.options as Parameters<typeof startRegistration>[0]['optionsJSON'] });
      const completed = await api<{ csrfToken: string; recoveryCode: string }>('/api/auth/recovery/verify-passkey', { method: 'POST', body: JSON.stringify({ response: credential }) });
      window.history.replaceState({}, '', '/'); setRecoveryLinkToken(''); setPage('account');
      setAccountCsrf(completed.csrfToken); setRecoveryCode(completed.recoveryCode);
      await refreshAccount(); setNotice('Account recovered. Save your replacement recovery code.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not complete account recovery.'); }
    finally { setAccountBusy(false); }
  }

  async function copyText(value: string, success: string) {
    try { await navigator.clipboard.writeText(value); setNotice(success); }
    catch { setNotice(value); }
  }
  function openHome() {
    window.history.pushState({}, '', '/');
    setPage('home'); setSession(null); setCommunity(null); setCommunityAccess('VIEWER'); setRecentCommunities(() => { try { return JSON.parse(localStorage.getItem('matchset-recent-communities') || '[]') as Community[]; } catch { return []; } }); setError(''); setNotice(''); setShowViewInput(false);
  }

  return <main className="shell">
    <header className="topbar"><button className="brand" onClick={openHome} aria-label="MatchSet home"><span className="brand-mark">M</span> matchset</button><span className="top-note">PLAYER ARRANGEMENTS, MADE SIMPLE</span><ActionButton variant="secondary" className="account-top-button" onClick={() => { setError(''); setPage('account'); }}>Account</ActionButton></header>

    {page === 'home' && <section className="home-dashboard workspace">
      <header className="home-intro">
        <div className="eyebrow"><span className="pulse" /> MATCHDAY WORKSPACE</div>
        <h1>Make matchday <em>count.</em></h1>
        <p className="intro">Bring your players together, organise teams, run matches and keep the results.</p>
        <div className="home-primary-actions">
          <button className="home-action home-action-primary" onClick={() => { setError(''); setPage('create-community'); }}>
            <span className="home-action-icon">＋</span><span><strong>Create a community</strong><small>Start a group and manage its match history.</small></span><span className="home-action-arrow">↗</span>
          </button>
          <button className="home-action" onClick={() => { setError(''); setPage('join-community'); }}>
            <span className="home-action-icon">⌕</span><span><strong>Open a community</strong><small>Use an invite link or community code.</small></span><span className="home-action-arrow">↗</span>
          </button>
        </div>
      </header>

      <section className="home-section home-communities">
        <div className="home-section-heading">
          <div><span className="section-kicker">YOUR MATCHDAY SPACES</span><h2>My communities</h2></div>
          <span className="home-section-meta">{recentCommunities.length} RECENT</span>
        </div>
        {recentCommunities.length > 0 ? <div className="home-community-grid">
          {recentCommunities.map((item) => <button className="home-community-card" key={item.slug} onClick={() => void loadCommunity(item.slug, true)} disabled={loading}>
            <span className="home-community-mark">{item.name.slice(0, 1).toUpperCase()}</span>
            <span className="home-community-copy"><strong>{item.name}</strong><small>Open community workspace</small></span>
            <span className="home-action-arrow">↗</span>
          </button>)}
        </div> : <div className="home-empty-state">
          <span className="home-empty-icon">◎</span>
          <div><strong>No communities opened yet</strong><p>Open a community invite or create one to keep its players and match history together.</p></div>
          <button className="secondary-btn" onClick={() => setPage('join-community')}>Open invite link</button>
        </div>}
      </section>

      <section className="home-section home-tools">
        <div className="home-section-heading"><div><span className="section-kicker">STANDALONE TOOLS</span><h2>Quick actions</h2></div></div>
        <div className="home-tool-grid">
          <button className="home-tool-card" onClick={startCreate}>
            <span className="home-tool-icon">▦</span><span><strong>Quick arrangement</strong><small>Balance players into shareable sets.</small></span><span className="home-action-arrow">↗</span>
          </button>
          <button className="home-tool-card" onClick={() => { setShowViewInput((value) => !value); setError(''); }}>
            <span className="home-tool-icon">↗</span><span><strong>Open a saved set</strong><small>Return to a standalone arrangement.</small></span><span className="home-action-arrow">↗</span>
          </button>
        </div>
        {showViewInput && <form className="lookup-form" onSubmit={(event) => { event.preventDefault(); void loadSession(viewLink); }}>
          <label htmlFor="view-link">SHARED LINK OR SET CODE</label>
          <div><input id="view-link" value={viewLink} onChange={(event) => setViewLink(event.target.value)} placeholder="Paste a MatchSet link or code" autoFocus /><button className="primary-btn lookup-button" disabled={loading}>Open set ↗</button></div>
        </form>}
      </section>
      {loading && <StatusMessage tone="info">Opening your MatchSet workspace…</StatusMessage>}
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
    </section>}

    {page === 'account' && <section className="workspace account-workspace">
      <button className="back" onClick={openHome}>← Back</button>
      <div className="section-kicker">MATCHSET IDENTITY</div><h1 className="page-title">Your <em>account.</em></h1>
      <p className="subcopy">Use a passkey to access your MatchSet identity across communities. No account email or password is stored.</p>
      {!accountLoaded ? <p className="hint">Checking account session…</p> : accountUserId ? <>
        <div className="account-status"><strong>Signed in</strong><small>Account ID: {accountUserId}</small></div>
        {recoveryCode && <div className="recovery-code-panel">
          <strong>Save your recovery code now</strong>
          <p>This code is shown once. It is required together with an email address if you lose every passkey.</p>
          <code>{recoveryCode}</code>
          <button className="secondary-btn" onClick={() => void copyText(recoveryCode, 'Recovery code copied. Store it somewhere private.')}>Copy recovery code</button>
          <button className="primary-btn submit-button" disabled={accountBusy} onClick={() => void acknowledgeRecoveryCode()}>I saved my recovery code</button>
        </div>}
        {!recoveryCode && !recoveryAcknowledged && <div className="recovery-code-panel">
          <strong>Recovery code not saved yet</strong>
          <p>If you closed the setup screen before saving it, generate a replacement now.</p>
          <button className="primary-btn submit-button" disabled={accountBusy} onClick={() => void rotateUnacknowledgedRecoveryCode()}>Generate replacement recovery code</button>
        </div>}
        <div className="account-panel">
          <div className="panel-heading"><div><span className="section-kicker">SECURITY</span><h2>Passkeys</h2></div><span className="count">{accountPasskeys.length} REGISTERED</span></div>
          {accountPasskeys.map((key) => <div className="passkey-row" key={key.credential_id}>
            <span><strong>{key.device_type || 'Passkey'}</strong><small>{key.backed_up ? 'Synced / backed up' : 'Device-bound or backup status unavailable'}</small></span>
            <button className="text-button" disabled={accountBusy || accountPasskeys.length <= 1} onClick={() => void revokeAccountPasskey(key.credential_id)}>Revoke</button>
          </div>)}
          <button className="secondary-btn" disabled={accountBusy} onClick={() => void addAccountPasskey()}>＋ Add another passkey</button>
          <p className="hint">Keep at least two passkeys on separate devices where possible. You cannot revoke your last active passkey.</p>
        </div>
        <button className="secondary-btn" disabled={accountBusy} onClick={() => void signOutAccount()}>Sign out</button>
      </> : <>
        <div className="account-panel">
          <h2>Passkey access</h2>
          <p className="hint">Create a new identity or sign in using a passkey already registered with MatchSet.</p>
          <button className="primary-btn submit-button" disabled={accountBusy} onClick={() => void createPasskeyAccount()}>{accountBusy ? 'Please wait…' : 'Create account with passkey'} <span>↗</span></button>
          <button className="secondary-btn" disabled={accountBusy} onClick={() => void signInWithPasskey()}>Sign in with passkey</button>
        </div>
        <form className="form-card" onSubmit={requestAccountRecovery}>
          <h2>Recover an account</h2>
          <p className="hint">You need your one-time recovery code and access to an email address you can receive a verification link at. The address is not saved to your MatchSet account.</p>
          <label className="field-label">RECOVERY CODE<input value={recoveryCodeInput} onChange={(e) => setRecoveryCodeInput(e.target.value)} autoComplete="off" required /></label>
          <label className="field-label">CURRENT EMAIL ADDRESS<input type="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} autoComplete="email" required /></label>
          <button className="primary-btn submit-button" disabled={accountBusy}>Send recovery link <span>↗</span></button>
          {recoveryMessage && <p className="success-note">{recoveryMessage}</p>}
        </form>
      </>}
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
    </section>}

    {page === 'recover' && <section className="workspace account-workspace">
      <div className="section-kicker">ACCOUNT RECOVERY</div><h1 className="page-title">Restore your <em>access.</em></h1>
      <p className="subcopy">Your email link is valid for a short time. Continue to register a new passkey, then save the replacement recovery code.</p>
      <button className="primary-btn submit-button" disabled={accountBusy || !recoveryLinkToken} onClick={() => void completeAccountRecovery()}>{accountBusy ? 'Verifying…' : 'Verify and register new passkey'} <span>↗</span></button>
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
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
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
    </section>}

    {page === 'join-community' && <section className="workspace">
      <button className="back" onClick={openHome}>← Back</button>
      <div className="section-kicker">JOIN A COMMUNITY</div><h1 className="page-title">Find your <em>people.</em></h1>
      <p className="subcopy">Enter an invite link or code to view the community. The creator manages its roster.</p>
      <form className="form-card" onSubmit={joinCommunity}>
        <label className="field-label">COMMUNITY INVITE LINK OR CODE<input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Paste invite link or code" required /></label>
        <p className="hint">Invite links are read-only. Only the community creator can add players or manage matches.</p>
        <button className="primary-btn submit-button" disabled={loading}>{loading ? 'Opening…' : 'View community'} <span>↗</span></button>
      </form>
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
    </section>}

    {page === 'community' && community && <section className="workspace community-workspace">
      <div className="community-heading">
        <div><div className="section-kicker">COMMUNITY / {members.length} PLAYERS</div><h1 className="page-title">{community.name}</h1><p className="subcopy">Community standings, roster and match history.</p></div>
        <div className="community-menu-wrap">
          <button className="menu-toggle" aria-label="Open community menu" aria-expanded={communityMenuOpen} onClick={() => setCommunityMenuOpen((value) => !value)}><span></span><span></span><span></span></button>
          {communityMenuOpen && <div className="community-menu">
            <button onClick={() => { void copyText(window.location.origin + '/community/' + community.slug, 'Community invite link copied.'); setCommunityMenuOpen(false); }}>↗ Copy invite link</button>
            {isOwner && <button onClick={() => { setCommunityTab('create-match'); setCommunityMenuOpen(false); }}>＋ Create a match</button>}
            <button onClick={() => { openHome(); setCommunityMenuOpen(false); }}>⌂ Back to home</button>
          </div>}
        </div>
      </div>
      <div className="community-stats">
        <div><strong>{members.length}</strong><span>PLAYERS</span></div>
        <div><strong>{matches.length}</strong><span>MATCHES</span></div>
        <div><strong>{matches.reduce((total, match) => total + (match.rotationState?.games.length ?? (match.winningTeamId !== null ? 1 : 0)), 0)}</strong><span>RESULTS</span></div>
      </div>
      <SectionTabs ariaLabel="Community sections">
        <button className={communityTab === 'overview' ? 'active' : ''} onClick={() => setCommunityTab('overview')}>Overview</button>
        <button className={communityTab === 'matches' ? 'active' : ''} onClick={() => setCommunityTab('matches')}>Matches <span>{matches.length}</span></button>
        {isOwner && <button className={communityTab === 'create-match' ? 'active' : ''} onClick={() => setCommunityTab('create-match')}>Create match <span>＋</span></button>}
        <button className={communityTab === 'tournaments' ? 'active' : ''} onClick={() => setCommunityTab('tournaments')}>Tournaments <span>{tournaments.length}</span></button>
      </SectionTabs>
      {communityTab === 'create-match' && isOwner && <div className="community-panel">
        <div className="panel-heading"><div><span className="section-kicker">ORGANISER TOOLS</span><h2>Create a match</h2></div></div>
        <form className="community-form" onSubmit={createCommunityMatch}>
          <label className="field-label">MATCH NAME<input value={matchTitle} onChange={(e) => setMatchTitle(e.target.value)} placeholder="e.g. Saturday evening games" maxLength={80} required /></label>
          <div className="roster-heading"><span className="field-label">SELECT PLAYERS ({selectedMemberIds.length} SELECTED)</span><button type="button" className="text-button" onClick={() => setSelectedMemberIds(selectedMemberIds.length === members.length ? [] : members.map((member) => member.id))}>{selectedMemberIds.length === members.length ? 'Clear all' : 'Select all'}</button></div>
          <div className="roster-select">{members.map((member) => <label className="roster-option" key={member.id}><input type="checkbox" checked={selectedMemberIds.includes(member.id)} onChange={() => toggleMember(member.id)} disabled={member.id === currentMemberId} /><span>{member.name}</span></label>)}</div>
          <div className="form-bottom"><label className="size-label">PLAYERS PER TEAM<select value={playersPerTeam} onChange={(e) => setPlayersPerTeam(Number(e.target.value))}>{Array.from({ length: 19 }, (_, i) => i + 2).map((n) => <option key={n} value={n}>{n} players</option>)}</select></label><span className="count">{Math.ceil(selectedMemberIds.length / playersPerTeam)} TEAMS</span></div>
          <div className="form-bottom"><label className="size-label">GOALS TO WIN<select value={goalsToWin} onChange={(e) => setGoalsToWin(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} goal{n === 1 ? '' : 's'}</option>)}</select></label><label className="size-label">TIME PER GAME<select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}>{[5, 10, 15, 20, 25, 30, 45, 60].map((n) => <option key={n} value={n}>{n} minutes</option>)}</select></label></div>
          <p className="hint">Teams are balanced automatically. Each rotation game ends at the goal target or when its timer expires. Every selected player is assigned exactly once.</p>
          <button className="primary-btn submit-button" disabled={loading || Math.ceil(selectedMemberIds.length / playersPerTeam) < 2}>{loading ? 'Saving…' : 'Create teams'} <span>↗</span></button>
        </form>
      </div>}
      {communityTab === 'overview' && <div className="community-columns">
        <section className="community-panel">
          <div className="panel-heading"><div><span className="section-kicker">ALL-TIME</span><h2>Leaderboard</h2></div></div>
          {leaderboard.length === 0 ? <p className="empty-state">No results yet. Record a match winner to start the leaderboard.</p> : <div className="leaderboard">
            <div className="leader-row leader-head"><span>PLAYER</span><span>W</span><span>D</span><span>L</span><span>WIN %</span></div>
            {leaderboard.map((entry, index) => <div className="leader-row" key={entry.memberId}><span><b>{String(index + 1).padStart(2, '0')}</b>{entry.name}</span><strong>{entry.wins}</strong><span>{entry.draws || 0}</span><span>{entry.losses}</span><span>{entry.winRate}%</span></div>)}
          </div>}
        </section>
        <section className="community-panel">
          <div className="panel-heading"><div><span className="section-kicker">ROSTER</span><h2>Players</h2></div><span className="count">{members.length} MEMBERS</span></div>
          <div className="member-list">{members.map((member) => <div className="member-item" key={member.id}><span className="member-avatar">{member.name.slice(0,1).toUpperCase()}</span>{member.name}{member.id === currentMemberId && <span className="you-label">CREATOR</span>}</div>)}</div>
          {isOwner && <form className="add-member-form" onSubmit={addMember}><input value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="Add a player to the roster" maxLength={40} required /><button className="share-btn" disabled={loading}>Add player</button></form>}
          {isOwner && <div className="role-management"><span className="field-label">COMMUNITY ROLES</span>{members.filter((member) => member.id !== currentMemberId).map((member) => <div className="role-row" key={member.id}><span>{member.name}<small>{member.role === 'ADMIN' ? 'ADMIN' : 'MEMBER'}</small></span><button className="text-button" disabled={loading} onClick={() => void changeMemberRole(member)}>{member.role === 'ADMIN' ? 'Remove admin' : 'Make admin'}</button></div>)}</div>}
          {!isOwner && <p className="read-only-note">Roster and roles are managed by the community owner.</p>}
          {adminInviteLink && <div className="admin-invite"><strong>Private admin access link</strong><p>Send this link directly to the appointed admin. Anyone with it can manage tournament groups until the owner revokes their role.</p><div><input readOnly value={adminInviteLink} /><button className="share-btn" onClick={() => void copyText(adminInviteLink, 'Admin link copied.')}>Copy link</button></div></div>}
        </section>
      </div>}
      {communityTab === 'tournaments' && <div className="community-panel tournament-panel">
        <div className="panel-heading"><div><span className="section-kicker">COMPETITION MANAGEMENT</span><h2>Tournament groups</h2></div><span className="count">{tournaments.length} TOURNAMENTS</span></div>
        {canManageTournaments && <form className="community-form tournament-form" onSubmit={createTournament}>
          <h3>Create tournament</h3>
          <label className="field-label">TOURNAMENT NAME<input value={tournamentName} onChange={(event) => setTournamentName(event.target.value)} placeholder="e.g. MatchSet Cup" maxLength={80} required /></label>
          <label className="field-label">NUMBER OF GROUPS<select value={tournamentGroupCount} onChange={(event) => setTournamentGroupCount(Number(event.target.value))}>{[2, 3, 4, 5, 6, 8].map((count) => <option key={count} value={count}>{count} groups</option>)}</select></label>
          <div className="tournament-draft-teams">{tournamentTeams.map((team, index) => {
            const assignedElsewhere = new Set(tournamentTeams.flatMap((otherTeam, teamIndex) => teamIndex === index ? [] : otherTeam.memberIds));
            return <div className="tournament-draft-team" key={index}>
              <div className="tournament-team-heading"><span className="team-number">TEAM {index + 1}</span><span className="team-player-count">{team.memberIds.length} selected</span></div>
              <label className="field-label tournament-team-name">TEAM NAME<input value={team.name} onChange={(event) => updateDraftTeam(index, { name: event.target.value })} placeholder={`Team ${index + 1}`} maxLength={40} /></label>
              <fieldset className="tournament-player-picker">
                <legend>Choose players</legend>
                {members.length === 0 ? <p className="hint">Add players to the community roster first.</p> : <div className="tournament-player-options">{members.map((member) => {
                  const selected = team.memberIds.includes(member.id);
                  const used = assignedElsewhere.has(member.id);
                  return <label className={`tournament-player-option${selected ? ' selected' : ''}${used ? ' unavailable' : ''}`} key={member.id}>
                    <input type="checkbox" checked={selected} disabled={used} onChange={() => updateDraftTeam(index, { memberIds: selected ? team.memberIds.filter((id) => id !== member.id) : [...team.memberIds, member.id] })} />
                    <span>{member.name}</span>
                    {used && <small>Assigned</small>}
                  </label>;
                })}</div>}
              </fieldset>
              {tournamentTeams.length > 2 && <button type="button" className="text-button remove-tournament-team" onClick={() => setTournamentTeams((current) => current.filter((_, teamIndex) => teamIndex !== index))}>Remove team</button>}
            </div>;
          })}</div>
          <button type="button" className="text-button" onClick={() => setTournamentTeams((current) => [...current, { name: `Team ${current.length + 1}`, memberIds: [] }])}>＋ Add team</button>
          <p className="hint">Select at least two players per team. Teams are distributed across groups automatically; you can move teams between groups after creation.</p>
          <button className="primary-btn submit-button" disabled={loading}>{loading ? 'Saving…' : 'Create tournament groups'} <span>↗</span></button>
        </form>}
        {tournaments.length === 0 ? <p className="empty-state">No tournaments yet. {canManageTournaments ? 'Create the first tournament above.' : 'An owner or admin can create tournament groups.'}</p> : tournaments.map((tournament) => <section className="tournament-card" key={tournament.id}>
          <div className="panel-heading"><div><span className="section-kicker">TOURNAMENT</span><h3>{tournament.name}</h3></div><span className="count">{tournament.groups.length} GROUPS</span></div>
          <div className="tournament-groups">{tournament.groups.map((group) => <div className="tournament-group" key={group.id}>
            <h4>{group.name}</h4>
            {group.teams.map((team) => <div className="tournament-team" key={team.id}><span><strong>{team.name}</strong><small>{team.members.map((member) => member.name).join(' · ')}</small></span>
              {canManageTournaments && <select aria-label={`Move ${team.name} to group`} value={group.id} disabled={loading} onChange={(event) => void moveTournamentTeam(tournament, team.id, event.target.value)}>{tournament.groups.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>}
            </div>)}
          </div>)}</div>
        </section>)}
      </div>}
      {communityTab === 'matches' && <section className="community-panel history-panel">
        <div className="panel-heading"><div><span className="section-kicker">COMMUNITY RECORD</span><h2>Match history</h2></div><span className="count">LATEST 100</span></div>
        {matches.length === 0 ? <p className="empty-state">No matches yet. The community creator can create the first one.</p> : <div className="match-history">
          {matches.map((match) => <LiveMatchCard
            key={match.id}
            match={match}
            isOwner={isOwner}
            loading={loading}
            clockNow={clockNow}
            goalSelections={goalSelections}
            setGoalSelections={setGoalSelections}
            onRecordGoal={recordGoal}
            onControlTimer={controlRotationTimer}
            onRecordOutcome={recordRotationOutcome}
            onUndo={undoRotationOutcome}
          />)}
        </div>}
      </section>}
      {isAdmin && <p className="read-only-note">Admin access: you can create tournaments and manage groupings. The community owner controls members and roles.</p>}
      {!isOwner && !isAdmin && <p className="read-only-note">You are viewing this community in read-only mode. The creator manages its roster and matches.</p>}
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
