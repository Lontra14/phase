// Mode select: Test match (MatchLab), Progression, Starter, Chess.
//
// Old MatchLab deep links (`/#you=…&opp=…`) are forwarded to /test, and a
// Progression match that just ended sends the player straight back to the run.

import { Navigate, useLocation, useNavigate } from "react-router";

import { CHESS_RUN_KEY, STARTER_AUTOSAVE_KEY, blockLabel, blocksOf, loadAutosave, pendingMatchRoute } from "../progression/run";
import "../progression/progression.css";
import { CardBackButton } from "../progression/CardBackPicker";

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  if (/(^|[#&])(you|opp)=/.test(location.hash)) {
    return <Navigate to={{ pathname: "/test", hash: location.hash }} replace />;
  }
  const pending = pendingMatchRoute();
  if (pending) {
    return <Navigate to={pending} replace />;
  }
  const run = loadAutosave();
  const blocks = run ? blocksOf(run) : [];
  const chess = (() => {
    try {
      return JSON.parse(localStorage.getItem(CHESS_RUN_KEY) ?? "null") as { phase: string; match: number; matches: number } | null;
    } catch {
      return null;
    }
  })();
  const starter = (() => {
    try {
      return JSON.parse(localStorage.getItem(STARTER_AUTOSAVE_KEY) ?? "null") as { phase: string; game: number } | null;
    } catch {
      return null;
    }
  })();

  return (
    <div className="pf-root">
      <div className="pf-main">
        <div className="pf-stage" style={{ paddingTop: "8vh" }}>
          <div className="pf-eyebrow">Pay the 1 pt1</div>
          <h1 className="pf-title">Choose your path</h1>
          <p className="pf-sub">Arena-style board, a full rules engine, peer-to-peer play with a friend: no accounts, no servers of ours.</p>
          <div className="pf-modes">
            <button type="button" className="pf-mode" onClick={() => navigate("/test")}>
              <span className="glyph">{"\u2694\uFE0E"}</span>
              <div className="pf-eyebrow">One match</div>
              <h2>Test match</h2>
              <p>Paste two decklists (or pick test decks) and play: vs the AI or a friend online with a room code.</p>
              <span className="tag">Start ▸</span>
            </button>
            <button type="button" className="pf-mode" onClick={() => navigate("/progression")}>
              <span className="glyph">{"\u29D7"}</span>
              <div className="pf-eyebrow">A journey through Magic's history</div>
              <h2>Progression</h2>
              <p>
                Sealed boosters year by year (or the sets you choose), deck builder, tables of 2 to 4 with best of 1, 3 or 5. Losers open The List, winners spin the Wheel of Fortune.
              </p>
              <span className="tag">
                {run && run.phase !== "done"
                  ? `Continue · block ${run.block + 1}/${blocks.length} · ${blockLabel(run, run.block)} ▸`
                  : "Begin ▸"}
              </span>
            </button>
            <button type="button" className="pf-mode" onClick={() => navigate("/starter")}>
              <span className="glyph">{"\u2726"}</span>
              <div className="pf-eyebrow">Precons and boosters at stake</div>
              <h2>Starter</h2>
              <p>
                Both pick a 60-card precon. After every game the winner opens a booster first, then the loser: draft, set and collector boosters of any era, until the pile is gone.
              </p>
              <span className="tag">{starter && starter.phase !== "done" ? `Continue · game ${starter.game + 1} ▸` : "Begin ▸"}</span>
            </button>
            <button type="button" className="pf-mode" onClick={() => navigate("/chess")}>
              <span className="glyph">{"\u265E"}</span>
              <div className="pf-eyebrow">Boosters on a battlefield board</div>
              <h2>Chess</h2>
              <p>
                Pick a precon or a meta deck. Before every game, fight a Chess minigame for each booster: hidden cards on a 4×6 board, reach the enemy land. The cards you win join your deck.
              </p>
              <span className="tag">{chess && chess.phase !== "done" ? `Continue · game ${Math.min(chess.match + 1, chess.matches)} ▸` : "Begin ▸"}</span>
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: "1.4rem" }}>
            <CardBackButton label="Your card back" />
          </div>
          <p className="pf-hint" style={{ textAlign: "center", marginTop: "1.6rem", opacity: 0.6 }}>
            Rules engine: open source (MIT / Apache-2.0) · <a href="/LICENSE-phase.txt" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>licence</a>
          </p>
        </div>
      </div>
    </div>
  );
}
