import { describe, expect, it } from 'vitest';
import { buildCommunityLeaderboard } from '../src/shared/leaderboard';

describe('buildCommunityLeaderboard', () => {
  it('credits every player on the winning team and counts appearances', () => {
    const rows = buildCommunityLeaderboard([
      {
        winning_team_id: 1,
        teams: [
          { id: 1, players: [{ id: 'a', name: 'Alex' }, { id: 'b', name: 'Blair' }] },
          { id: 2, players: [{ id: 'c', name: 'Casey' }, { id: 'd', name: 'Drew' }] },
        ],
      },
      {
        winning_team_id: 2,
        teams: [
          { id: 1, players: [{ id: 'a', name: 'Alex' }, { id: 'c', name: 'Casey' }] },
          { id: 2, players: [{ id: 'b', name: 'Blair' }, { id: 'd', name: 'Drew' }] },
        ],
      },
    ]);
    expect(rows.find((row) => row.memberId === 'a')).toMatchObject({ wins: 1, losses: 1, matchesPlayed: 2, winRate: 50 });
    expect(rows.find((row) => row.memberId === 'b')).toMatchObject({ wins: 1, losses: 1, matchesPlayed: 2, winRate: 50 });
    expect(rows.find((row) => row.memberId === 'c')).toMatchObject({ wins: 1, losses: 1, matchesPlayed: 2, winRate: 50 });
    expect(rows.find((row) => row.memberId === 'd')).toMatchObject({ wins: 1, losses: 1, matchesPlayed: 2, winRate: 50 });
  });

  it('does not award wins for matches without a recorded result', () => {
    const rows = buildCommunityLeaderboard([{
      winning_team_id: null,
      teams: [
        { id: 1, players: [{ id: 'a', name: 'Alex' }] },
        { id: 2, players: [{ id: 'b', name: 'Blair' }] },
      ],
    }]);
    expect(rows.find((row) => row.memberId === 'a')).toMatchObject({ wins: 0, losses: 1, matchesPlayed: 1, winRate: 0 });
  });

  it('sorts by wins, then matches played, then name', () => {
    const rows = buildCommunityLeaderboard([
      { winning_team_id: 1, teams: [{ id: 1, players: [{ id: 'a', name: 'Alex' }] }, { id: 2, players: [{ id: 'b', name: 'Blair' }] }] },
      { winning_team_id: 1, teams: [{ id: 1, players: [{ id: 'a', name: 'Alex' }] }, { id: 2, players: [{ id: 'c', name: 'Casey' }] }] },
    ]);
    expect(rows[0].memberId).toBe('a');
  });
});
