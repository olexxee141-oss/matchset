export type PlayerSet = { id: number; players: string[] };

export function distributePlayers(names: string[], playersPerSet: number): PlayerSet[] {
  if (!Number.isInteger(playersPerSet) || playersPerSet < 2 || playersPerSet > 20) {
    throw new Error('Players per set must be between 2 and 20.');
  }
  const players = names.map((name) => name.trim()).filter(Boolean);
  if (players.length < 2) throw new Error('Add at least two players.');
  if (players.length > 500) throw new Error('A set can contain at most 500 players.');

  // Shuffle once, then deal round-robin. This keeps groups balanced and never drops a player.
  for (let i = players.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }
  const setCount = Math.ceil(players.length / playersPerSet);
  const sets: PlayerSet[] = Array.from({ length: setCount }, (_, index) => ({ id: index + 1, players: [] }));
  players.forEach((player, index) => sets[index % setCount].players.push(player));
  return sets;
}
