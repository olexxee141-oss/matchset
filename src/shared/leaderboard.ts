export type TeamPlayer = { id: string; name: string };
export type TeamRecord = { id: number; players: TeamPlayer[] };
export type CompletedMatch = { teams: TeamRecord[]; winning_team_id: number | null };
export type LeaderboardRow = {
  memberId: string;
  name: string;
  wins: number;
  losses: number;
  matchesPlayed: number;
  winRate: number;
};

export function buildCommunityLeaderboard(matches: CompletedMatch[]): LeaderboardRow[] {
  const stats = new Map<string, { memberId: string; name: string; wins: number; matchesPlayed: number }>();
  for (const match of matches) {
    for (const team of match.teams) {
      for (const player of team.players) {
        const current = stats.get(player.id) || { memberId: player.id, name: player.name, wins: 0, matchesPlayed: 0 };
        current.matchesPlayed += 1;
        if (match.winning_team_id === team.id) current.wins += 1;
        stats.set(player.id, current);
      }
    }
  }
  return [...stats.values()]
    .map((item) => ({
      ...item,
      losses: item.matchesPlayed - item.wins,
      winRate: item.matchesPlayed ? Math.round((item.wins / item.matchesPlayed) * 100) : 0,
    }))
    .sort((a, b) => b.wins - a.wins || b.matchesPlayed - a.matchesPlayed || a.name.localeCompare(b.name));
}
