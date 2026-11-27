import { describe, expect, it } from 'vitest';
import { distributePlayers } from '../src/shared/distribute';

describe('distributePlayers', () => {
  it('keeps every player and respects the maximum group size', () => {
    const names = Array.from({ length: 24 }, (_, index) => `Player ${index + 1}`);
    const sets = distributePlayers(names, 4);
    expect(sets).toHaveLength(6);
    expect(sets.every((group) => group.players.length === 4)).toBe(true);
    expect(sets.flatMap((group) => group.players).sort()).toEqual(names.sort());
  });

  it('balances uneven groups without dropping players', () => {
    const names = Array.from({ length: 22 }, (_, index) => `Player ${index + 1}`);
    const sets = distributePlayers(names, 4);
    const sizes = sets.map((group) => group.players.length).sort((a, b) => b - a);
    expect(sizes).toEqual([4, 4, 4, 4, 3, 3]);
    expect(sets.flatMap((group) => group.players)).toHaveLength(22);
  });

  it('rejects fewer than two players', () => {
    expect(() => distributePlayers(['Only one'], 4)).toThrow('at least two');
  });
});
