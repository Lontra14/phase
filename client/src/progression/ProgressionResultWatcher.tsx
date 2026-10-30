// Mounted once at app level. When a Progression Bo3 finishes (engine match
// phase "Completed"), it stores the final score in the autosaved run so the
// Progression page can pay out rewards when the player comes back.

import { useEffect } from "react";

import { useGameStore } from "../stores/gameStore";
import { useMultiplayerStore } from "../stores/multiplayerStore";
import { autosave, loadAutosave } from "./run";

export function ProgressionResultWatcher(): null {
  useEffect(() => {
    const check = () => {
      const { gameState, waitingFor, gameId } = useGameStore.getState();
      if (!gameState || waitingFor?.type !== "GameOver") return;
      if (gameState.match_phase && gameState.match_phase !== "Completed") return;
      const run = loadAutosave();
      if (!run || run.phase !== "match" || !run.pendingGameId || run.pendingResult) return;
      if (run.pendingGameId !== "*" && run.pendingGameId !== gameId) return;
      const score = gameState.match_score;
      const myId = run.mode === "ai" ? 0 : (useMultiplayerStore.getState().activePlayerId ?? 0);
      let myWins: number;
      let oppWins: number;
      if (score) {
        myWins = myId === 0 ? score.p0_wins : score.p1_wins;
        oppWins = myId === 0 ? score.p1_wins : score.p0_wins;
      } else {
        const winner = waitingFor.data.winner;
        if (winner == null) return;
        myWins = winner === myId ? 1 : 0;
        oppWins = winner === myId ? 0 : 1;
      }
      if (myWins === oppWins) return;
      autosave({ ...run, pendingResult: { myWins, oppWins } });
    };
    check();
    return useGameStore.subscribe(check);
  }, []);
  return null;
}
