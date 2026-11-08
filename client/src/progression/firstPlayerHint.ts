// Who starts the next P2P game (Starter mode: the loser of the previous game
// chooses). Set by the host right before opening the room; the P2P host
// adapter consumes it once when the game starts. Player 0 is the host.
let hint: number | null = null;

export function setP2PFirstPlayerHint(player: number | null): void {
  hint = player;
}

export function takeP2PFirstPlayerHint(): number | undefined {
  const value = hint;
  hint = null;
  return value ?? undefined;
}
