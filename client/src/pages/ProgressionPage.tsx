// Progression — Rogue Forge mode.
//
// Pick a start year, an end year and how many years each block covers (1–5).
// Every block: open a sealed pool of boosters printed in those years, build a
// deck (Rogue Forge deck builder), play a best of three (vs the AI or a friend).
// The loser opens 3 random cards that were on The List; the winner spins the
// Wheel of Fortune over the rarities in the pool and takes 1 card of that
// rarity out of 30 from the block's years. Then the timeline moves on.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";

import { AI_DIFFICULTIES } from "../constants/ai";
import { parseRoomCode } from "../network/connection";
import { useCardDataStore } from "../stores/cardDataStore";
import { useMultiplayerStore } from "../stores/multiplayerStore";
import { ForgeDeckBuilder } from "../progression/ForgeDeckBuilder";
import { PackOpening } from "../progression/PackOpening";
import { Timeline } from "../progression/Timeline";
import { WheelOfFortune } from "../progression/WheelOfFortune";
import type { ProgData, ProgPrint, Rarity } from "../progression/data";
import { RARITY_COLOR, RARITY_LABEL, loadProgressionData, printImage } from "../progression/data";
import { advanceBlock, applyResult, applySealed, claimReward, prepareBlock, rarityOrder, sealedFor } from "../progression/flow";
import { deckSize, hostFriendMatch, joinFriendMatch, launchAiMatch } from "../progression/launch";
import type { Pack } from "../progression/packs";
import type { Basics, Owned, PlayerState, RunSettings, RunState, Slot } from "../progression/run";
import {
  autosave,
  blockYears,
  blocksOf,
  createRun,
  decodeRun,
  encodeRun,
  exportList,
  importList,
  loadAutosave,
  yearsLabel,
} from "../progression/run";
import "../progression/progression.css";

const SETTINGS_KEY = "phase-progression-settings";
const THIS_YEAR = new Date().getFullYear();

function loadSettings(): RunSettings & { names: [string, string] } {
  const base: RunSettings & { names: [string, string] } = {
    mode: "ai",
    startYear: 1993,
    endYear: 1999,
    blockSize: 1,
    packs: 6,
    cumulative: true,
    allowPartial: false,
    difficulty: "Medium",
    startingLife: null,
    names: ["Player", "Forge AI"],
  };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) Object.assign(base, JSON.parse(raw));
  } catch {
    // ignore
  }
  return base;
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function ProgressionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState<ProgData | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [run, setRunState] = useState<RunState | null>(() => loadAutosave());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(() => {
    const st = location.state as { setupError?: string; deckRejected?: boolean; reason?: string } | null;
    if (st?.setupError) return st.setupError;
    if (st?.deckRejected) return `The host rejected your deck${st.reason ? `: ${st.reason}` : "."}`;
    return null;
  });
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "save" | "share">(null);
  const [whoFor, setWhoFor] = useState<RunState | null>(null);
  const [packs, setPacks] = useState<Pack[] | null>(null);

  const setRun = useCallback((next: RunState | null) => {
    setRunState(next);
    autosave(next);
  }, []);

  const say = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2700);
  };

  useEffect(() => {
    void useCardDataStore.getState().warm();
    loadProgressionData()
      .then(setData)
      .catch((err: unknown) => setDataError(err instanceof Error ? err.message : String(err)));
  }, []);

  // Pick up a result the watcher stored while the match was being played.
  useEffect(() => {
    const onFocus = () => {
      const saved = loadAutosave();
      if (saved && run && saved.id === run.id && saved.pendingResult && !run.pendingResult) setRunState(saved);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [run]);

  // Opening phase: resolve engine support for the block, then roll my packs.
  const openingKey = run && run.phase === "opening" ? `${run.id}|${run.block}|${run.me}` : null;
  useEffect(() => {
    if (!openingKey || !data || !run) return;
    let cancelled = false;
    setPacks(null);
    setBusy(`Gathering the cards of ${yearsLabel(blockYears(run))}…`);
    prepareBlock(data, run)
      .then(() => {
        if (cancelled) return;
        setPacks(sealedFor(data, run, run.me));
        setBusy(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setBusy(null);
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openingKey, data]);

  const me = run ? run.players[run.me] : null;
  const opp = run ? run.players[(1 - run.me) as Slot] : null;
  const blocks = run ? blocksOf(run) : [];

  const updateMe = (patch: Partial<PlayerState>) => {
    if (!run) return;
    const players = run.players.slice() as [PlayerState, PlayerState];
    players[run.me] = { ...players[run.me], ...patch };
    setRun({ ...run, players });
  };

  // ── screens ──────────────────────────────────────────────────────────────
  let body: ReactNode;
  if (!run) {
    body = (
      <SetupScreen
        data={data}
        onStart={(settings, names) => {
          const next = createRun(settings, names);
          setRun(next);
          if (settings.mode === "friend") setSheet("share");
        }}
        onLoad={() => setSheet("save")}
      />
    );
  } else if (!data) {
    body = <Centered>{dataError ? <div className="pf-error">Could not load the card index: {dataError}</div> : <p className="pf-hint-pulse">Loading the card index…</p>}</Centered>;
  } else if (run.phase === "opening") {
    body = (
      <div className="pf-stage">
        <div className="pf-eyebrow">Block {run.block + 1} of {blocks.length}</div>
        <h1 className="pf-title">The boosters of {yearsLabel(blockYears(run))}</h1>
        {busy || !packs ? (
          <Centered>
            <p className="pf-hint-pulse">{busy ?? "Preparing…"}</p>
            <p className="pf-hint">The first time this also loads the rules engine's card database.</p>
          </Centered>
        ) : packs.length === 0 ? (
          <Centered>
            <div className="pf-error">No playable boosters were found for these years.</div>
            <div className="pf-row">
              <button type="button" className="pf-btn" onClick={() => setRun(applySealed(data, run, []))}>
                Continue without packs
              </button>
            </div>
          </Centered>
        ) : (
          <PackOpening
            packs={packs}
            onDone={() => {
              setRun(applySealed(data, run, packs));
              setPacks(null);
            }}
          />
        )}
      </div>
    );
  } else if (run.phase === "pool" && me) {
    body = (
      <div className="pf-stage">
        <div className="pf-eyebrow">Block {run.block + 1} · {yearsLabel(blockYears(run))}</div>
        <h1 className="pf-title">Your sealed pool</h1>
        <p className="pf-sub">
          {me.opened.length} new cards{run.cumulative && (me.pool?.length ?? 0) > me.opened.length ? ` · ${me.pool?.length} in your collection` : ""}. Take a look, then build your deck.
        </p>
        <OpenedPool data={data} cards={me.opened} />
        <div className="pf-row">
          <button type="button" className="pf-btn" onClick={() => setRun({ ...run, phase: "build" })}>
            Build your deck ▸
          </button>
        </div>
      </div>
    );
  } else if (run.phase === "build" && me) {
    body = (
      <ForgeDeckBuilder
        data={data}
        player={me}
        title={`${me.name} · ${yearsLabel(blockYears(run))}`}
        onChange={(main: number[], basics: Basics) => updateMe({ main, basics })}
        actions={
          <>
            <button type="button" className="pf-btn-mini" onClick={() => setRun({ ...run, phase: "pool" })}>
              ◂ Pool
            </button>
            <button
              type="button"
              className="pf-btn-mini"
              onClick={() => {
                void navigator.clipboard?.writeText(exportList(me)).then(() => say("Deck list copied (main + sideboard)"));
              }}
            >
              ⤓ Copy list
            </button>
            <button
              type="button"
              className="pf-btn small"
              onClick={() => {
                const n = deckSize(me);
                if (n < 40) {
                  say(`Limited decks need at least 40 cards — you have ${n}. Add cards or basic lands.`);
                  return;
                }
                const players = run.players.slice() as [PlayerState, PlayerState];
                players[run.me] = { ...me, ready: true };
                setRun({ ...run, players, phase: "match" });
              }}
            >
              Ready ▸
            </button>
          </>
        }
      />
    );
  } else if (run.phase === "match" && me && opp) {
    body = (
      <MatchStep
        run={run}
        data={data}
        setRun={setRun}
        onError={setError}
        navigate={navigate}
      />
    );
  } else if (run.phase === "reward" && me && opp) {
    body = <RewardStep run={run} data={data} setRun={setRun} />;
  } else if (run.phase === "timeline") {
    const last = run.block + 1 >= blocks.length;
    body = (
      <div className="pf-stage">
        <div className="pf-eyebrow">{last ? "The end of the road" : "Time moves on"}</div>
        <Timeline blocks={blocks} from={run.block} to={last ? run.block : run.block + 1} />
        <div className="pf-row">
          <button type="button" className="pf-btn" onClick={() => setRun(advanceBlock(run))}>
            {last ? "See the final standings ▸" : `Open the boosters of ${yearsLabel(blocks[run.block + 1])} ▸`}
          </button>
        </div>
      </div>
    );
  } else if (run.phase === "done" && me && opp) {
    body = <FinalScreen run={run} onNew={() => setRun(null)} onCopy={() => void navigator.clipboard?.writeText(exportList(me)).then(() => say("Deck list copied"))} />;
  } else {
    body = <Centered><p className="pf-hint">Nothing to show.</p></Centered>;
  }

  return (
    <div className="pf-root">
      <div className="pf-topbar">
        <button type="button" className="pf-btn-mini" onClick={() => navigate("/")} title="Back to the mode select">
          ◂ Modes
        </button>
        <div className="pf-brand">
          Progression
          <small>Rogue Forge</small>
        </div>
        {run && (
          <div className="pf-record">
            {run.players.map((p, i) => (
              <div key={i} className={`pf-rec${i === run.me ? " me" : ""}`} title={i === run.me ? "You" : p.kind === "ai" ? "AI" : "Opponent"}>
                <b>{p.name}</b>
                <i>
                  {p.wins}–{p.losses}
                </i>
              </div>
            ))}
          </div>
        )}
        {run && run.phase !== "done" && (
          <div className="pf-block">
            Block <b>{run.block + 1}</b>/{blocks.length} · <b>{yearsLabel(blockYears(run))}</b>
          </div>
        )}
        <button type="button" className="pf-btn-mini" style={run ? undefined : { marginLeft: "auto" }} onClick={() => setSheet("save")}>
          ⛁ Save / Load
        </button>
      </div>
      <div className="pf-main">
        {error && (
          <div className="pf-stage" style={{ paddingBottom: 0 }}>
            <div className="pf-error" onClick={() => setError(null)} role="button" tabIndex={0}>
              {error} <span className="pf-hint">(click to dismiss)</span>
            </div>
          </div>
        )}
        {body}
      </div>
      {sheet && (
        <SaveSheet
          run={run}
          data={data}
          share={sheet === "share"}
          onClose={() => setSheet(null)}
          onLoaded={(loaded) => {
            setSheet(null);
            setWhoFor(loaded);
          }}
          onAbandon={() => {
            setSheet(null);
            setRun(null);
          }}
          onImportList={(slot, text) => {
            if (!run || !data) return;
            const res = importList(text, data);
            const players = run.players.slice() as [PlayerState, PlayerState];
            players[slot] = { ...players[slot], pool: res.pool, main: res.main, basics: res.basics };
            setRun({ ...run, players });
            say(`List imported: ${res.pool.length} cards${res.unknown.length ? ` (${res.unknown.length} unknown skipped)` : ""}`);
          }}
          say={say}
        />
      )}
      {whoFor && (
        <WhoSheet
          run={whoFor}
          onPick={(slot) => {
            const players = whoFor.players.slice() as [PlayerState, PlayerState];
            if (!players[slot].pool) players[slot] = { ...players[slot], pool: [] };
            const next = { ...whoFor, me: slot, players, pendingGameId: null };
            setWhoFor(null);
            setRun(next);
            if (!whoFor.players[slot].pool && whoFor.phase !== "opening") {
              setError("This save does not hold your collection. Open ⛁ Save / Load → Import my list to restore it.");
            } else say(`Loaded — you are ${players[slot].name}`);
          }}
          onCancel={() => setWhoFor(null)}
        />
      )}
      {toast && <div className="pf-toast">{toast}</div>}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.8rem", padding: "3rem 1rem" }}>{children}</div>;
}

// ── setup ───────────────────────────────────────────────────────────────────

function SetupScreen({ data, onStart, onLoad }: { data: ProgData | null; onStart: (s: RunSettings, names: [string, string]) => void; onLoad: () => void }) {
  const [s, setS] = useState(loadSettings);
  const first = data?.firstYear ?? 1993;
  const last = Math.min(data?.lastYear ?? THIS_YEAR, THIS_YEAR);
  const years = useMemo(() => Array.from({ length: last - first + 1 }, (_, i) => first + i), [first, last]);
  const blocks = blocksOf(s);
  const set = (patch: Partial<typeof s>) => setS((cur) => ({ ...cur, ...patch }));

  const start = () => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch {
      // ignore
    }
    const { names, ...settings } = s;
    onStart(settings, [names[0].trim() || "Player 1", names[1].trim() || (s.mode === "ai" ? "Forge AI" : "Player 2")]);
  };

  return (
    <div className="pf-stage">
      <div className="pf-eyebrow">Rogue Forge</div>
      <h1 className="pf-title">Progression</h1>
      <p className="pf-sub">
        Travel through Magic's history one block of years at a time. Open sealed boosters printed in those years, build a deck, play a best of three.
        The loser opens three cards from The List; the winner spins the Wheel of Fortune.
      </p>
      <div className="pf-grid2">
        <div className="pf-panel">
          <div className="pf-field">
            <span>Opponent</span>
            <div className="pf-seg">
              <button type="button" className={s.mode === "ai" ? "sel" : ""} onClick={() => set({ mode: "ai", names: [s.names[0], s.names[1] === "Player 2" ? "Forge AI" : s.names[1]] })}>
                Vs AI
              </button>
              <button type="button" className={s.mode === "friend" ? "sel" : ""} onClick={() => set({ mode: "friend", names: [s.names[0], s.names[1] === "Forge AI" ? "Player 2" : s.names[1]] })}>
                Vs a friend (online)
              </button>
            </div>
          </div>
          <div className="pf-fields" style={{ marginTop: "1rem" }}>
            <label className="pf-field">
              <span>Your name</span>
              <input value={s.names[0]} maxLength={24} onChange={(e) => set({ names: [e.target.value, s.names[1]] })} />
            </label>
            <label className="pf-field">
              <span>{s.mode === "ai" ? "AI name" : "Friend's name"}</span>
              <input value={s.names[1]} maxLength={24} onChange={(e) => set({ names: [s.names[0], e.target.value] })} />
            </label>
            {s.mode === "ai" && (
              <label className="pf-field">
                <span>AI difficulty</span>
                <select value={s.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>
                  {AI_DIFFICULTIES.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id.replace(/([a-z])([A-Z])/g, "$1 $2")}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="pf-field">
              <span>Starting life</span>
              <input type="number" min={1} max={999} placeholder="20" value={s.startingLife ?? ""} onChange={(e) => set({ startingLife: e.target.value ? Math.max(1, Number(e.target.value)) : null })} />
            </label>
          </div>
          {s.mode === "friend" && (
            <p className="pf-hint" style={{ marginTop: "0.9rem" }}>
              You get a run code to send to your friend: they open Progression, Save / Load → Load, and pick their name. Each of you opens your own packs on your own device;
              matches use a room code like the Test match.
            </p>
          )}
        </div>
        <div className="pf-panel">
          <div className="pf-fields">
            <label className="pf-field">
              <span>From year</span>
              <select value={s.startYear} onChange={(e) => { const v = Number(e.target.value); set({ startYear: v, endYear: Math.max(v, s.endYear) }); }}>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
            <label className="pf-field">
              <span>To year</span>
              <select value={s.endYear} onChange={(e) => set({ endYear: Number(e.target.value) })}>
                {years.filter((y) => y >= s.startYear).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
            <label className="pf-field">
              <span>Years per block</span>
              <select value={s.blockSize} onChange={(e) => set({ blockSize: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="pf-field">
              <span>Packs per sealed</span>
              <select value={s.packs} onChange={(e) => set({ packs: Number(e.target.value) })}>
                {[3, 4, 5, 6, 7, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="pf-check">
            <input type="checkbox" checked={s.cumulative} onChange={(e) => set({ cumulative: e.target.checked })} />
            <span>
              Keep your collection between blocks
              <small>Off = every block starts from a fresh sealed pool (rewards are lost too).</small>
            </span>
          </label>
          <label className="pf-check">
            <input type="checkbox" checked={s.allowPartial} onChange={(e) => set({ allowPartial: e.target.checked })} />
            <span>
              Include partially implemented cards
              <small>Off = only cards the rules engine fully supports appear in packs and rewards.</small>
            </span>
          </label>
          <div className="pf-summary">
            <b>{blocks.length}</b> block{blocks.length === 1 ? "" : "s"} → <b>{blocks.length}</b> best-of-three match{blocks.length === 1 ? "" : "es"}
            {blocks.length > 0 && (
              <>
                {" "}· {blocks.slice(0, 6).map(yearsLabel).join(", ")}
                {blocks.length > 6 ? ", …" : ""}
              </>
            )}
            <br />
            Early years use their original boosters (8- and 12-card packs, no mythics before 2008). Smaller packs are topped up so every sealed holds about {s.packs * 14} cards.
          </div>
        </div>
      </div>
      <div className="pf-row">
        <button type="button" className="pf-btn secondary" onClick={onLoad}>
          Load a save code
        </button>
        <button type="button" className="pf-btn" onClick={start} disabled={blocks.length === 0}>
          Start the journey ▸
        </button>
      </div>
    </div>
  );
}

// ── pool view ───────────────────────────────────────────────────────────────

function OpenedPool({ data, cards }: { data: ProgData; cards: Owned[] }) {
  const [zoom, setZoom] = useState<ProgPrint | null>(null);
  const groups = useMemo(() => {
    const by = new Map<Rarity, ProgPrint[]>();
    for (const o of cards) {
      const p = data.byKey.get(o.k);
      if (!p) continue;
      const arr = by.get(p.rarity);
      if (arr) arr.push(p);
      else by.set(p.rarity, [p]);
    }
    return rarityOrder(by.keys()).map((r) => [r, by.get(r)!.sort((a, b) => a.card.cmc - b.card.cmc || a.card.name.localeCompare(b.card.name))] as const);
  }, [data, cards]);
  return (
    <>
      {groups.map(([r, list]) => (
        <div key={r} className="pf-pool-group">
          <h3 style={{ color: RARITY_COLOR[r] }}>
            {RARITY_LABEL[r]} <i>{list.length}</i>
          </h3>
          <div className="pf-cardgrid">
            {list.map((p, i) => (
              <div key={`${p.key}-${i}`} className="pf-gcard" onClick={() => setZoom(p)}>
                <img loading="lazy" src={printImage(p, "normal")} alt={p.card.name} />
              </div>
            ))}
          </div>
        </div>
      ))}
      {zoom && (
        <div className="pf-modal" onClick={() => setZoom(null)}>
          <div className="pf-zoom">
            <img src={printImage(zoom, "large")} alt={zoom.card.name} />
            <div className="pf-zoom-meta">
              <b>{zoom.card.name}</b>
              <span style={{ color: RARITY_COLOR[zoom.rarity] }}>
                {RARITY_LABEL[zoom.rarity]}
                {zoom.set ? ` · ${zoom.set.name} (${zoom.set.year})` : " · The List"}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── match ───────────────────────────────────────────────────────────────────

function MatchStep({
  run,
  data,
  setRun,
  onError,
  navigate,
}: {
  run: RunState;
  data: ProgData;
  setRun: (r: RunState) => void;
  onError: (e: string | null) => void;
  navigate: (to: string, opts?: { state?: unknown }) => void;
}) {
  const me = run.players[run.me];
  const opp = run.players[(1 - run.me) as Slot];
  const hostingStatus = useMultiplayerStore((s) => s.hostingStatus);
  const hostGameCode = useMultiplayerStore((s) => s.hostGameCode);
  const cardStatus = useCardDataStore((s) => s.status);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const years = yearsLabel(blockYears(run));

  const claim = async (myWins: number, oppWins: number) => {
    setBusy(true);
    try {
      await prepareBlock(data, run);
      setRun(applyResult(data, run, myWins, oppWins));
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (run.pendingResult) {
    const { myWins, oppWins } = run.pendingResult;
    const won = myWins > oppWins;
    return (
      <div className="pf-stage">
        <div className="pf-eyebrow">Best of three · {years}</div>
        <div className={`pf-result ${won ? "win" : "loss"}`}>{won ? "Victory" : "Defeat"}</div>
        <p className="pf-sub">
          {me.name} {myWins} – {oppWins} {opp.name}
        </p>
        <div className="pf-row">
          <button type="button" className="pf-btn" disabled={busy} onClick={() => void claim(myWins, oppWins)}>
            {won ? "Spin the Wheel of Fortune ▸" : "Open three cards from The List ▸"}
          </button>
        </div>
      </div>
    );
  }

  const start = async (fn: () => Promise<unknown>, pending: string) => {
    if (busy) return;
    setBusy(true);
    onError(null);
    const marked = { ...run, pendingGameId: pending };
    setRun(marked);
    try {
      await fn();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const loading = cardStatus === "loading";
  const myDeck = deckSize(me);

  return (
    <div className="pf-stage">
      <div className="pf-eyebrow">Best of three · {years}</div>
      <h1 className="pf-title">To battle</h1>
      <div className="pf-panel" style={{ maxWidth: 760, margin: "0 auto" }}>
        <div className="pf-versus">
          <div className="side">
            <b>{me.name}</b>
            <span>{myDeck}-card deck · {me.wins}–{me.losses}</span>
          </div>
          <div className="x">VS</div>
          <div className="side">
            <b>{opp.name}</b>
            <span>
              {opp.kind === "ai" ? `${deckSize(opp)}-card deck · ` : ""}
              {opp.wins}–{opp.losses}
            </span>
          </div>
        </div>

        {run.pendingGameId && hostingStatus === "idle" && (
          <p className="pf-hint" style={{ textAlign: "center", marginTop: "1rem" }}>
            A match was started but no final result came back. Play it again, or record the result by hand below.
          </p>
        )}

        {run.mode === "ai" ? (
          <div className="pf-row">
            <button type="button" className="pf-btn secondary small" onClick={() => setRun({ ...run, phase: "build" })}>
              ◂ Edit deck
            </button>
            <button
              type="button"
              className="pf-btn"
              disabled={busy || loading}
              onClick={() => {
                const gameId = crypto.randomUUID();
                void start(() => launchAiMatch({ ...run, pendingGameId: gameId }, data, gameId, navigate), gameId);
              }}
            >
              {loading ? "Loading cards…" : "Start best of three ▸"}
            </button>
          </div>
        ) : (
          <div style={{ marginTop: "1.2rem", display: "grid", gap: "1.2rem", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
            <div>
              <div className="pf-field"><span>Host the room</span></div>
              {hostingStatus !== "idle" ? (
                <div style={{ textAlign: "center" }}>
                  {hostGameCode ? (
                    <>
                      <button type="button" className="pf-code" title="Copy" onClick={() => void navigator.clipboard?.writeText(hostGameCode).catch(() => {})}>
                        {hostGameCode}
                      </button>
                      <p className="pf-hint">Tell {opp.name} this code. The match starts as soon as they join.</p>
                    </>
                  ) : (
                    <p className="pf-hint-pulse">Opening the room…</p>
                  )}
                  <button type="button" className="pf-btn secondary small" onClick={() => useMultiplayerStore.getState().cancelHosting()}>
                    Cancel room
                  </button>
                </div>
              ) : (
                <div className="pf-row" style={{ justifyContent: "flex-start", marginTop: "0.6rem" }}>
                  <button type="button" className="pf-btn" disabled={busy || loading} onClick={() => void start(() => hostFriendMatch(run, data), "*")}>
                    Create room ▸
                  </button>
                </div>
              )}
            </div>
            {hostingStatus === "idle" && (
              <div>
                <div className="pf-field"><span>Or join your friend's room</span></div>
                <div className="pf-row" style={{ justifyContent: "flex-start", marginTop: "0.6rem" }}>
                  <input
                    value={joinCode}
                    maxLength={5}
                    placeholder="CODE"
                    style={{ width: 130, textTransform: "uppercase", letterSpacing: "0.3em", fontFamily: "Cinzel" }}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  />
                  <button
                    type="button"
                    className="pf-btn secondary"
                    disabled={busy || loading}
                    onClick={() => {
                      const code = parseRoomCode(joinCode);
                      if (!code) {
                        onError("Enter the 5-character room code your friend sees.");
                        return;
                      }
                      const gameId = crypto.randomUUID();
                      void start(() => joinFriendMatch(run, data, code, gameId, navigate), "*");
                    }}
                  >
                    Join ▸
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "1.4rem" }}>
          {!manual ? (
            <button type="button" className="pf-btn-mini" onClick={() => setManual(true)}>
              Record the result by hand
            </button>
          ) : (
            <div className="pf-row">
              {([[2, 0], [2, 1], [1, 2], [0, 2]] as const).map(([a, b]) => (
                <button key={`${a}${b}`} type="button" className={`pf-btn small ${a > b ? "" : "secondary"}`} disabled={busy} onClick={() => void claim(a, b)}>
                  {a > b ? "I won" : "I lost"} {a}–{b}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── rewards ─────────────────────────────────────────────────────────────────

function RewardStep({ run, data, setRun }: { run: RunState; data: ProgData; setRun: (r: RunState) => void }) {
  const me = run.players[run.me];
  const opp = run.players[(1 - run.me) as Slot];
  const r = me.reward;
  const [picked, setPicked] = useState<string | null>(null);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [zoom, setZoom] = useState<ProgPrint | null>(null);

  const oppNote = (() => {
    const o = opp.reward;
    if (!o || opp.kind !== "ai") return null;
    if (o.kind === "list") return `${opp.name} opened ${o.list?.map((c) => c.n).join(", ")} from The List.`;
    return `${opp.name} spun ${o.rarity ? RARITY_LABEL[o.rarity] : "the wheel"} and took a card.`;
  })();

  if (!r) {
    return (
      <Centered>
        <button type="button" className="pf-btn" onClick={() => setRun({ ...run, phase: "timeline" })}>
          Continue ▸
        </button>
      </Centered>
    );
  }

  if (r.kind === "list") {
    const cards = (r.list ?? []).map((o) => data.byKey.get(o.k)).filter((p): p is ProgPrint => Boolean(p));
    const allUp = flipped.size >= cards.length;
    return (
      <div className="pf-stage">
        <div className="pf-eyebrow">Defeat · consolation</div>
        <h1 className="pf-title">Three cards from The List</h1>
        <p className="pf-sub">Every card that was ever on The List can turn up. Click each card to reveal it — all three join your collection.</p>
        <div className="pf-listcards">
          {cards.map((p, i) => {
            const up = flipped.has(i);
            return (
              <div key={p.key} className={`pf-dealt${up ? " up" : ""}`} style={{ animationDelay: `${i * 160}ms` }}>
                <div className={`pf-flip r${up ? " up" : ""}`} onClick={() => (up ? setZoom(p) : setFlipped((f) => new Set(f).add(i)))}>
                  <div className="face back">
                    <div className="pf-listback">
                      <i>✦</i>
                      <b>THE LIST</b>
                    </div>
                  </div>
                  <div className="face front">
                    <img src={printImage(p, "normal")} alt={p.card.name} />
                  </div>
                  <div className="burst" />
                </div>
                <div className="tag" style={{ color: "#c9b6ff" }}>{p.card.name}</div>
              </div>
            );
          })}
        </div>
        {oppNote && <p className="pf-hint" style={{ textAlign: "center" }}>{oppNote}</p>}
        <div className="pf-row">
          {!allUp && (
            <button type="button" className="pf-btn secondary small" onClick={() => setFlipped(new Set(cards.map((_, i) => i)))}>
              Reveal all
            </button>
          )}
          <button type="button" className="pf-btn" disabled={!allUp} onClick={() => setRun(claimReward(data, run))}>
            Add them to my collection ▸
          </button>
        </div>
        {zoom && <ZoomModal print={zoom} onClose={() => setZoom(null)} />}
      </div>
    );
  }

  const choices = (r.choices ?? []).map((k) => data.byKey.get(k)).filter((p): p is ProgPrint => Boolean(p));
  return (
    <div className="pf-stage">
      <div className="pf-eyebrow">Victory · {yearsLabel(blockYears(run))}</div>
      <h1 className="pf-title">Wheel of Fortune</h1>
      <p className="pf-sub">One slice for every rarity you opened this block. Wherever it stops, choose one card of that rarity out of 30 from these years.</p>
      <WheelOfFortune
        wheel={r.wheel ?? ["c", "u", "r"]}
        landing={r.rarity ?? "c"}
        spun={Boolean(r.spun)}
        onSpun={() => {
          const players = run.players.slice() as [PlayerState, PlayerState];
          players[run.me] = { ...me, reward: { ...r, spun: true } };
          setRun({ ...run, players });
        }}
      />
      {r.spun && (
        <>
          <p className="pf-sub" style={{ marginTop: "1.2rem" }}>
            Pick your {RARITY_LABEL[r.rarity ?? "c"].toLowerCase()} — it goes straight into your deck. Right-click to zoom.
          </p>
          <div className="pf-cardgrid">
            {choices.map((p) => (
              <div
                key={p.key}
                className={`pf-gcard pick${picked === p.key ? " sel" : ""}`}
                onClick={() => setPicked(p.key)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setZoom(p);
                }}
                title={p.card.name}
              >
                <img loading="lazy" src={printImage(p, "normal")} alt={p.card.name} />
              </div>
            ))}
          </div>
          {oppNote && <p className="pf-hint" style={{ textAlign: "center" }}>{oppNote}</p>}
          <div className="pf-row">
            <button type="button" className="pf-btn" disabled={!picked} onClick={() => picked && setRun(claimReward(data, run, picked))}>
              {picked ? `Take ${data.byKey.get(picked)?.card.name ?? "it"} ▸` : "Choose a card"}
            </button>
          </div>
        </>
      )}
      {zoom && <ZoomModal print={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

function ZoomModal({ print, onClose }: { print: ProgPrint; onClose: () => void }) {
  return (
    <div className="pf-modal" onClick={onClose}>
      <div className="pf-zoom">
        <img src={printImage(print, "large")} alt={print.card.name} />
      </div>
    </div>
  );
}

// ── end of the run ──────────────────────────────────────────────────────────

function FinalScreen({ run, onNew, onCopy }: { run: RunState; onNew: () => void; onCopy: () => void }) {
  const [a, b] = run.players;
  const champion = a.wins === b.wins ? null : a.wins > b.wins ? a : b;
  return (
    <div className="pf-stage">
      <div className="pf-eyebrow">
        {run.startYear}–{run.endYear} · {blocksOf(run).length} blocks
      </div>
      <h1 className="pf-title">{champion ? `${champion.name} conquers history` : "A perfectly even rivalry"}</h1>
      <p className="pf-sub">
        {a.name} {a.wins}–{a.losses} · {b.name} {b.wins}–{b.losses}
      </p>
      <div className="pf-panel" style={{ maxWidth: 760, margin: "0 auto" }}>
        <table className="pf-table">
          <thead>
            <tr>
              <th>Block</th>
              <th>Years</th>
              <th>Winner</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {run.history.map((h) => (
              <tr key={h.block}>
                <td>{h.block + 1}</td>
                <td>{yearsLabel(h.years)}</td>
                <td>{h.winner === null ? "—" : run.players[h.winner].name}</td>
                <td>{h.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pf-row">
        <button type="button" className="pf-btn secondary" onClick={onCopy}>
          Copy my final list
        </button>
        <button type="button" className="pf-btn" onClick={onNew}>
          New journey ▸
        </button>
      </div>
    </div>
  );
}

// ── save / load ─────────────────────────────────────────────────────────────

function SaveSheet({
  run,
  data,
  share,
  onClose,
  onLoaded,
  onAbandon,
  onImportList,
  say,
}: {
  run: RunState | null;
  data: ProgData | null;
  share: boolean;
  onClose: () => void;
  onLoaded: (r: RunState) => void;
  onAbandon: () => void;
  onImportList: (slot: Slot, text: string) => void;
  say: (m: string) => void;
}) {
  const [code, setCode] = useState("");
  const [loadText, setLoadText] = useState("");
  const [listText, setListText] = useState("");
  const [listSlot, setListSlot] = useState<Slot>(run?.me ?? 0);
  const [err, setErr] = useState<string | null>(null);
  const me = run ? run.players[run.me] : null;
  const myList = me ? exportList(me) : "";

  useEffect(() => {
    if (run) void encodeRun(run).then(setCode);
  }, [run]);

  const copy = (text: string, msg: string) => {
    void navigator.clipboard?.writeText(text).then(() => say(msg)).catch(() => say("Copy failed — select the text and copy it by hand"));
  };

  return (
    <div className="pf-modal" onClick={onClose}>
      <div className="pf-sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{share ? "Invite your friend" : "Save / Load"}</h2>
        {share && (
          <p style={{ textAlign: "center" }}>
            Send this run code to your friend. They open <b>Progression → Save / Load → Load</b>, paste it and choose their name. You can carry on: each of you opens your own packs.
          </p>
        )}
        {run && (
          <>
            <h3>Run code {share ? "" : "· the whole journey"}</h3>
            <p>Years, seed, current block and phase, records, the pools this device knows and any pending reward. Load it later to continue exactly from here.</p>
            <textarea readOnly value={code || "Encoding…"} />
            <div className="pf-row" style={{ marginTop: "0.6rem" }}>
              <button type="button" className="pf-btn small" disabled={!code} onClick={() => copy(code, "Run code copied")}>
                Copy run code
              </button>
              <button type="button" className="pf-btn secondary small" disabled={!code} onClick={() => download(`progression-${run.startYear}-${run.endYear}-block${run.block + 1}.txt`, code)}>
                Download .txt
              </button>
            </div>
          </>
        )}
        {!share && (
          <>
            {run && me && (
              <>
                <h3>My list · main + sideboard</h3>
                <p>Your deck and the rest of your collection as a normal decklist. Keep it separately: it restores your cards on any device (Import below).</p>
                <textarea readOnly value={myList} />
                <div className="pf-row" style={{ marginTop: "0.6rem" }}>
                  <button type="button" className="pf-btn small" onClick={() => copy(myList, "List copied")}>
                    Copy my list
                  </button>
                  <button type="button" className="pf-btn secondary small" onClick={() => download(`progression-${me.name}-list.txt`, myList)}>
                    Download .txt
                  </button>
                </div>
              </>
            )}

            <h3>Load a run code</h3>
            <textarea placeholder="PROG1-…" value={loadText} onChange={(e) => setLoadText(e.target.value)} />
            <div className="pf-row" style={{ marginTop: "0.6rem" }}>
              <button
                type="button"
                className="pf-btn small"
                disabled={!loadText.trim()}
                onClick={() => {
                  setErr(null);
                  decodeRun(loadText)
                    .then(onLoaded)
                    .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
                }}
              >
                Load
              </button>
            </div>

            {run && (
              <>
                <h3>Import a list into this run</h3>
                <p>Replaces that player's collection and deck with the list (main = deck, sideboard = rest of the collection).</p>
                <div className="pf-seg" style={{ marginBottom: "0.6rem" }}>
                  {run.players.map((p, i) => (
                    <button key={i} type="button" className={listSlot === i ? "sel" : ""} onClick={() => setListSlot(i as Slot)}>
                      {p.name}
                    </button>
                  ))}
                </div>
                <textarea placeholder={"1 Llanowar Elves\n…\n\nSideboard\n1 …"} value={listText} onChange={(e) => setListText(e.target.value)} />
                <div className="pf-row" style={{ marginTop: "0.6rem" }}>
                  <button
                    type="button"
                    className="pf-btn small"
                    disabled={!listText.trim() || !data}
                    onClick={() => {
                      onImportList(listSlot, listText);
                      setListText("");
                    }}
                  >
                    Import list
                  </button>
                </div>
                <h3>Start over</h3>
                <div className="pf-row" style={{ justifyContent: "flex-start" }}>
                  <button
                    type="button"
                    className="pf-btn danger small"
                    onClick={() => {
                      if (window.confirm("Abandon this run? Copy the run code first if you may want it back.")) onAbandon();
                    }}
                  >
                    Abandon this run
                  </button>
                </div>
              </>
            )}
          </>
        )}
        {err && <div className="pf-error">{err}</div>}
        <div className="pf-row">
          <button type="button" className="pf-btn secondary small" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function WhoSheet({ run, onPick, onCancel }: { run: RunState; onPick: (s: Slot) => void; onCancel: () => void }) {
  return (
    <div className="pf-modal" onClick={onCancel}>
      <div className="pf-sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Who are you?</h2>
        <p style={{ textAlign: "center" }}>
          {yearsLabel([run.startYear, run.endYear])} · block {Math.min(run.block + 1, blocksOf(run).length)} of {blocksOf(run).length} · {run.mode === "ai" ? "vs AI" : "vs a friend"}. Pick the player whose cards you play on this device.
        </p>
        <div className="pf-who">
          {run.players.map((p, i) => (
            <button key={i} type="button" disabled={p.kind === "ai"} onClick={() => onPick(i as Slot)} style={p.kind === "ai" ? { opacity: 0.45 } : undefined}>
              <b>{p.name}</b>
              <small>
                {p.kind === "ai" ? "AI" : "Player"} · {p.wins}–{p.losses}
                <br />
                {p.pool ? `${p.pool.length} cards on this save` : "collection not on this save"}
              </small>
            </button>
          ))}
        </div>
        <div className="pf-row">
          <button type="button" className="pf-btn secondary small" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
