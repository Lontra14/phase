// Mode select: Test match (MatchLab) or Progression.
//
// Old MatchLab deep links (`/#you=…&opp=…`) are forwarded to /test, and a
// Progression match that just ended sends the player straight back to the run.

import { Navigate, useLocation, useNavigate } from "react-router";

import { blockYears, blocksOf, loadAutosave, yearsLabel } from "../progression/run";
import "../progression/progression.css";

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  if (/(^|[#&])(you|opp)=/.test(location.hash)) {
    return <Navigate to={{ pathname: "/test", hash: location.hash }} replace />;
  }
  const run = loadAutosave();
  if (run && run.phase === "match" && run.pendingGameId) {
    return <Navigate to="/progression" replace />;
  }
  const blocks = run ? blocksOf(run) : [];

  return (
    <div className="pf-root">
      <div className="pf-main">
        <div className="pf-stage" style={{ paddingTop: "8vh" }}>
          <div className="pf-eyebrow">Rogue Forge</div>
          <h1 className="pf-title">Choose your path</h1>
          <p className="pf-sub">Arena-style board, the phase.rs rules engine, peer-to-peer play with a friend — no accounts, no servers of ours.</p>
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
                Sealed boosters year by year from 1993 to today, Rogue Forge deck builder, best-of-three matches. Losers open The List, winners spin the Wheel of Fortune.
              </p>
              <span className="tag">
                {run && run.phase !== "done"
                  ? `Continue · block ${run.block + 1}/${blocks.length} · ${yearsLabel(blockYears(run))} ▸`
                  : "Begin ▸"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
