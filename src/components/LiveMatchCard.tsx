import type { Dispatch, SetStateAction } from 'react';

type Player = { id: string; name: string };
type Team = { id: number; players: Player[] };
type Goal = { teamId: number; scorerId: string; scorerName: string; assisterId: string | null; assisterName: string | null; scoredAt: string };
type Game = { number: number; teamAId: number; teamBId: number; outcome: 'TEAM_A_WIN' | 'TEAM_B_WIN' | 'DRAW'; winnerTeamId: number | null; playedAt: string; goals?: Goal[]; score?: [number, number] };
type Rotation = { status: 'ACTIVE' | 'ENDED'; activeTeamIds: number[]; waitingTeamIds: number[]; games: Game[]; goalsToWin?: number; durationSeconds?: number; score?: [number, number]; goals?: Goal[]; timerStartedAt?: string; timerPausedAt?: string | null; pausedRemainingMs?: number | null };
type Match = { id: string; title: string; teams: Team[]; winningTeamId: number | null; rotationState?: Rotation | null; createdAt: string; completedAt: string | null };
type GoalSelection = { teamId: number; scorerId: string; assisterId: string };
type TimerAction = 'TICK' | 'PAUSE' | 'RESUME';

type Props = {
  match: Match;
  isOwner: boolean;
  loading: boolean;
  clockNow: number;
  goalSelections: Record<string, GoalSelection>;
  setGoalSelections: Dispatch<SetStateAction<Record<string, GoalSelection>>>;
  onRecordGoal: (match: Match, teamId: number) => void;
  onControlTimer: (match: Match, action: TimerAction, key?: string) => Promise<void>;
  onRecordOutcome: (match: Match, outcome: 'TEAM_A_WIN' | 'TEAM_B_WIN' | 'DRAW') => void;
  onUndo: (match: Match) => void;
};

export function LiveMatchCard({ match, isOwner, loading, clockNow, goalSelections, setGoalSelections, onRecordGoal, onControlTimer, onRecordOutcome, onUndo }: Props) {
  const resultToken = localStorage.getItem('matchset-result:' + match.id) || '';
  const rotation = match.rotationState;
  const activeTeams = rotation?.activeTeamIds.map((id) => match.teams.find((team) => team.id === id)).filter((team): team is Team => Boolean(team)) || [];
  const waitingTeams = rotation?.waitingTeamIds.map((id) => match.teams.find((team) => team.id === id)).filter((team): team is Team => Boolean(team)) || [];

  return <article className="history-match" key={match.id}>
    <div className="history-match-head"><div><h3>{match.title}</h3><span>{new Date(match.createdAt).toLocaleDateString()} · {match.teams.length} teams · {rotation ? rotation.games.length + ' games played' : 'Legacy match'}</span></div><span className={rotation || match.winningTeamId ? 'result-status complete' : 'result-status'}>{rotation ? 'ROTATION ACTIVE' : match.winningTeamId ? 'TEAM ' + match.winningTeamId + ' WON' : 'AWAITING RESULT'}</span></div>
    {rotation ? <>
      <div className="rotation-current"><div className="rotation-label">ON THE PITCH · CURRENT GAME</div>
        <div className="timer-panel">
          <strong className="match-score">{(rotation.score?.[0] ?? 0)} — {(rotation.score?.[1] ?? 0)}</strong>
          <span className="timer-readout">{(() => { const remaining = rotation.timerPausedAt ? (rotation.pausedRemainingMs ?? 0) : Math.max(0, (rotation.durationSeconds ?? 600) * 1000 - (clockNow - new Date(rotation.timerStartedAt || match.createdAt).getTime())); return String(Math.floor(remaining / 60000)).padStart(2,'0') + ':' + String(Math.floor((remaining % 60000) / 1000)).padStart(2,'0'); })()}</span>
          <small>FIRST TO {rotation.goalsToWin ?? 1} · {Math.round((rotation.durationSeconds ?? 600) / 60)} MINUTES</small>
          {isOwner && resultToken && <button className="text-button" disabled={loading} onClick={() => void onControlTimer(match, rotation.timerPausedAt ? 'RESUME' : 'PAUSE')}>{rotation.timerPausedAt ? 'Resume timer' : 'Pause timer'}</button>}
        </div>
        <div className="history-teams">{activeTeams.map((team, index) => <div className="history-team active-team" key={team.id}><div><b>SET {team.id}</b><span>{index === 0 ? 'TEAM A' : 'TEAM B'}</span></div><p>{team.players.map((player) => player.name).join(' · ')}</p></div>)}</div>
        {isOwner && resultToken && <div className="goal-entry">
          <label className="field-label">SCORING TEAM<select value={goalSelections[match.id]?.teamId ?? activeTeams[0]?.id ?? ''} onChange={(e) => setGoalSelections((current) => ({ ...current, [match.id]: { teamId: Number(e.target.value), scorerId: '', assisterId: '' } }))}>{activeTeams.map((team) => <option key={team.id} value={team.id}>Set {team.id}</option>)}</select></label>
          {(() => { const team = match.teams.find((item) => item.id === (goalSelections[match.id]?.teamId ?? activeTeams[0]?.id)); const selection = goalSelections[match.id]; return team ? <><label className="field-label">GOAL SCORER<select value={selection?.scorerId ?? ''} onChange={(e) => setGoalSelections((current) => ({ ...current, [match.id]: { teamId: team.id, scorerId: e.target.value, assisterId: current[match.id]?.assisterId === e.target.value ? '' : (current[match.id]?.assisterId ?? '') } }))}><option value="">Select scorer</option>{team.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label><label className="field-label">ASSIST (OPTIONAL)<select value={selection?.assisterId ?? ''} onChange={(e) => setGoalSelections((current) => ({ ...current, [match.id]: { teamId: team.id, scorerId: current[match.id]?.scorerId ?? '', assisterId: e.target.value } }))}><option value="">No assist</option>{team.players.filter((player) => player.id !== selection?.scorerId).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label><button className="record-win-btn" disabled={loading || !selection?.scorerId} onClick={() => onRecordGoal(match, team.id)}>Record goal</button></> : null; })()}
        </div>}
        {isOwner && resultToken && <div className="rotation-controls"><button className="record-win-btn draw-btn" disabled={loading || activeTeams.length !== 2} onClick={() => onRecordOutcome(match, 'DRAW')}>Declare draw</button></div>}
      </div>
      <div className="rotation-queue"><strong>WAITING QUEUE</strong><span>{waitingTeams.length ? waitingTeams.map((team) => 'Set ' + team.id).join(' · ') : 'No teams waiting — next rotation will bring teams back in.'}</span></div>
      {rotation.goals && rotation.goals.length > 0 && <div className="rotation-goal-history"><strong>GOALS THIS GAME</strong>{rotation.goals.map((goal, index) => <p key={index}>Set {goal.teamId}: {goal.scorerName}{goal.assisterName ? ' · Assist: ' + goal.assisterName : ''}</p>)}</div>}
      {rotation.games.length > 0 && <div className="rotation-last-game"><span>LAST RESULT</span><strong>{rotation.games[rotation.games.length - 1].outcome === 'DRAW' ? 'Draw' : 'Set ' + rotation.games[rotation.games.length - 1].winnerTeamId + ' won'}</strong>{isOwner && resultToken && <button className="text-button" disabled={loading} onClick={() => onUndo(match)}>Undo last result</button>}</div>}
      <details className="rotation-history"><summary>Game history ({rotation.games.length})</summary>{rotation.games.length === 0 ? <p className="hint">No games recorded yet.</p> : <ol>{rotation.games.map((game) => <li key={game.number}>Game {game.number}: Set {game.teamAId} {game.score?.[0] ?? '—'}–{game.score?.[1] ?? '—'} Set {game.teamBId} — {game.outcome === 'DRAW' ? 'Draw' : 'Set ' + game.winnerTeamId + ' won'}{game.goals?.length ? ' · ' + game.goals.map((goal) => goal.scorerName + (goal.assisterName ? ' (A: ' + goal.assisterName + ')' : '')).join(', ') : ''}</li>)}</ol>}</details>
      {!isOwner && <p className="read-only-note">The organiser records results and controls rotation.</p>}
    </> : <div className="history-teams">{match.teams.map((team) => <div className={match.winningTeamId === team.id ? 'history-team winner' : 'history-team'} key={team.id}><div><b>TEAM {team.id}</b>{match.winningTeamId === team.id && <span>WINNER</span>}</div><p>{team.players.map((player) => player.name).join(' · ')}</p></div>)}</div>}
  </article>;
}
