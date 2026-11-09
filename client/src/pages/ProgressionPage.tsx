// Progression — Pay the 1 pt1 mode.
//
// Pick a start year, an end year and how many years each block covers (1–5),
// or pick the booster sets themselves. Every block: open a sealed pool of those
// boosters, build a deck (deck builder), play a best of 1, 3 or 5 at a table of
// 2 to 4 (AIs and friends online; at 4, everyone for themselves or two teams).
// The losers open 3 random cards that were on The List; the winner spins the
// Wheel of Fortune over the rarities in the pool and takes 1 card of that
// rarity out of 30 from the block's boosters. Then the timeline moves on.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";

import { AI_DIFFICULTIES } from "../constants/ai";
import { parseRoomCode } from "../network/connection";
import { useCardDataStore } from "../stores/cardDataStore";
import { useMultiplayerStore } from "../stores/multiplayerStore";
import { CardZoom } from "../progression/CardZoom";
import { ForgeDeckBuilder } from "../progression/ForgeDeckBuilder";
import { PackOpening } from "../progression/PackOpening";
import { Timeline } from "../progression/Timeline";
import { WheelOfFortune } from "../progression/WheelOfFortune";
import type { ProgData, ProgPrint, Rarity } from "../progression/data";
import { RARITY_COLOR, RARITY_LABEL, loadProgressionData, printImage } from "../progression/data";
import { advanceBlock, applyResult, applySealed, claimReward, prepareBlock, rarityOrder, repairReward, resultWinner, rewardNeedsRepair, sealedFor, seriesTarget } from "../progression/flow";
import { deckSize, hostFriendMatch, joinFriendMatch, launchAiMatch } from "../progression/launch";
import type { Pack } from "../progression/packs";
import type { Basics, Owned, PackSetRef, PlayerState, RunSettings, RunState, Slot } from "../progression/run";
import {
  autosave,
  blockLabel,
  blockTags,
  blocksOf,
  createRun,
  decodeRun,
  encodeRun,
  exportList,
  importList,
  loadAutosave,
  runLabel,
  sameSide,
  sideLead,
  sideName,
  yearsLabel,
} from "../progression/run";
import "../progression/progression.css";
import type { RoomMe, RoomState } from "../progression/room";
import { RoomPanel, RoomToasts, useAutoMatchRoom } from "../progression/room";
import type { HubState } from "../progression/roomHub";
import { useRoomHub } from "../progression/roomHub";

const SETTINGS_KEY = "phase-progression-settings";
const THIS_YEAR = new Date().getFullYear();

type SeatKind = "ai" | "friend";
interface ProgSetup extends RunSettings {
  names: [string, string];
  /** Players at the table (2-4). */
  players: number;
  /** Seats 2..4: a friend online or an AI. */
  seatKinds: SeatKind[];
  /** Boosters by year range or by chosen sets. */
  packMode: "years" | "sets";
}

function loadSettings(): ProgSetup {
  const base: ProgSetup = {
    mode: "ai",
    startYear: 1993,
    endYear: 1999,
    blockSize: 1,
    packs: 6,
    cumulative: true,
    allowPartial: false,
    difficulty: "Medium",
    startingLife: null,
    bestOf: 3,
    teams: false,
    names: ["Player", "Forge AI"],
    players: 2,
    seatKinds: ["friend", "friend", "friend"],
    packMode: "years",
    packBlocks: [[], [], []],
  };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) Object.assign(base, JSON.parse(raw));
  } catch {
    // ignore
  }
  if (!Array.isArray(base.seatKinds) || base.seatKinds.length < 3) base.seatKinds = ["friend", "friend", "friend"];
  if (!Array.isArray(base.packBlocks) || !base.packBlocks.length || !base.packBlocks.every(Array.isArray)) base.packBlocks = [[], [], []];
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

/** The players I face (everyone else at the table). */
const othersOf = (run: RunState) => run.players.map((p, i) => ({ p, i })).filter((x) => x.i !== run.me);

/** The run the host sent to the room, with the seat of every friend's device. */
interface RoomRun {
  run?: RunState;
  seats?: Record<string, number>;
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
  // Vs friends: the mode room (opened before choosing anything, kept for the whole run; up to 4 players).
  const [setupMe, setSetupMe] = useState<RoomMe | null>(null);
  const roomMe: RoomMe | null = run ? { name: run.players[run.me].name } : setupMe;
  const room = useRoomHub("progression", roomMe);
  const roomRun = room.latest.run as RoomRun | undefined;

  const setRun = useCallback((next: RunState | null) => {
    setRunState(next);
    autosave(next);
  }, []);
  useEffect(() => {
    // A friend receives the run the host started and plays the seat the host gave this device.
    const r = roomRun?.run;
    if (room.room?.role !== "guest" || !r || typeof r.id !== "string") return;
    if (run && run.id === r.id) return;
    const seat = roomRun?.seats?.[room.myId] ?? (r.players.length === 2 ? 1 : undefined);
    if (seat === undefined || !r.players[seat]) return;
    const players = r.players.map((p, i) => (i === seat && !p.pool ? { ...p, pool: [] } : p));
    setRun({ ...r, players, me: seat as Slot, pendingGameId: null, pendingResult: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.room?.role, roomRun, room.myId]);

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
    setBusy(`Gathering the cards of ${blockLabel(run, run.block)}…`);
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
  const blocks = run ? blocksOf(run) : [];
  const label = run ? blockLabel(run, run.block) : "";

  const updateMe = (patch: Partial<PlayerState>) => {
    if (!run) return;
    const players = run.players.slice();
    players[run.me] = { ...players[run.me], ...patch };
    setRun({ ...run, players });
  };

  // ── screens ──────────────────────────────────────────────────────────────
  let body: ReactNode;
  if (!run) {
    body = (
      <SetupScreen
        data={data}
        onStart={(settings, names, kinds, seats) => {
          const next = createRun(settings, names, kinds);
          setRun(next);
          if (settings.mode === "friend" && room.room?.role === "host") room.send({ k: "run", run: next, seats });
          else if (settings.mode === "friend") setSheet("share");
        }}
        onLoad={() => setSheet("save")}
        room={room}
        onMe={setSetupMe}
      />
    );
  } else if (!data) {
    body = <Centered>{dataError ? <div className="pf-error">Could not load the card index: {dataError}</div> : <p className="pf-hint-pulse">Loading the card index…</p>}</Centered>;
  } else if (run.phase === "opening") {
    body = (
      <div className="pf-stage">
        <div className="pf-eyebrow">Block {run.block + 1} of {blocks.length}</div>
        <h1 className="pf-title">The boosters of {label}</h1>
        {busy || !packs ? (
          <Centered>
            <p className="pf-hint-pulse">{busy ?? "Preparing…"}</p>
            <p className="pf-hint">The first time this also loads the rules engine's card database.</p>
          </Centered>
        ) : packs.length === 0 ? (
          <Centered>
            <div className="pf-error">No playable boosters were found for this block.</div>
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
        <div className="pf-eyebrow">Block {run.block + 1} · {label}</div>
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
        title={`${me.name} · ${label}`}
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
                const players = run.players.slice();
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
  } else if (run.phase === "match" && me) {
    body = <MatchStep run={run} data={data} setRun={setRun} onError={setError} navigate={navigate} room={room} />;
  } else if (run.phase === "reward" && me) {
    body = <RewardStep run={run} data={data} setRun={setRun} />;
  } else if (run.phase === "timeline") {
    const last = run.block + 1 >= blocks.length;
    body = (
      <div className="pf-stage">
        <div className="pf-eyebrow">{last ? "The end of the road" : "Time moves on"}</div>
        <Timeline blocks={blocks} labels={blockTags(run)} from={run.block} to={last ? run.block : run.block + 1} />
        <div className="pf-row">
          <button type="button" className="pf-btn" onClick={() => setRun(advanceBlock(run))}>
            {last ? "See the final standings ▸" : `Open the boosters of ${blockLabel(run, run.block + 1)} ▸`}
          </button>
        </div>
      </div>
    );
  } else if (run.phase === "done" && me) {
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
          <small>Pay the 1 pt1</small>
        </div>
        {run && (
          <div className="pf-record">
            {run.players.map((p, i) => (
              <div key={i} className={`pf-rec${i === run.me ? " me" : ""}`} title={i === run.me ? "You" : p.kind === "ai" ? "AI" : sameSide(run, i, run.me) ? "Teammate" : "Opponent"}>
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
            Block <b>{run.block + 1}</b>/{blocks.length} · <b>{label}</b>
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
        {run && run.mode === "friend" && room.room && run.phase !== "done" && (
          <div className="pf-stage" style={{ paddingBottom: 0, paddingTop: "0.6rem" }}>
            <RoomPanel state={room} mode="progression" peerLabel={othersOf(run).filter((x) => x.p.kind === "human").map((x) => x.p.name).join(", ") || "your friends"} />
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
            const players = run.players.slice();
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
            const players = whoFor.players.slice();
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
      <RoomToasts />
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.8rem", padding: "3rem 1rem" }}>{children}</div>;
}

// ── setup ───────────────────────────────────────────────────────────────────

const SET_PAGE = 48;

/** Search every booster set of the index (by pages) and add or remove the sets of one block. */
function SetPicker({ data, value, onChange }: { data: ProgData; value: PackSetRef[]; onChange: (v: PackSetRef[]) => void }) {
  const [query, setQuery] = useState("");
  const [newest, setNewest] = useState(false);
  const [page, setPage] = useState(0);
  const all = useMemo(
    () =>
      data.sets
        .filter((s) => (data.printsBySet.get(s.idx)?.length ?? 0) >= 8)
        .slice()
        .sort((a, b) => a.released.localeCompare(b.released)),
    [data],
  );
  const chosen = new Set(value.map((v) => v.code));
  const q = query.trim().toLowerCase();
  const matches = all.filter((s) => !q || `${s.name} ${s.code} ${s.year}`.toLowerCase().includes(q));
  const ordered = newest ? matches.slice().reverse() : matches;
  const pages = Math.max(1, Math.ceil(ordered.length / SET_PAGE));
  const pg = Math.min(page, pages - 1);
  const shown = ordered.slice(pg * SET_PAGE, pg * SET_PAGE + SET_PAGE);
  const ref = (s: (typeof all)[number]): PackSetRef => ({ code: s.code, name: s.name, year: s.year });
  const toggle = (s: (typeof all)[number]) => onChange(chosen.has(s.code) ? value.filter((v) => v.code !== s.code) : [...value, ref(s)]);
  return (
    <div className="pf-setpick">
      <div className="pf-setpick-chosen">
        {value.length ? (
          value.map((v) => (
            <span key={v.code} className="pf-setchip">
              {v.name} <i>{v.year}</i>
              <button type="button" aria-label={`Remove ${v.name}`} onClick={() => onChange(value.filter((x) => x.code !== v.code))}>
                ×
              </button>
            </span>
          ))
        ) : (
          <span className="pf-hint">No set in this block yet: click the boosters below (one or more — the pool mixes them).</span>
        )}
      </div>
      <div className="pf-row" style={{ justifyContent: "flex-start", gap: "0.4rem", margin: "0.4rem 0" }}>
        <input
          placeholder={`Search ${all.length} sets (name, code, year)…`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          style={{ flex: "1 1 180px" }}
        />
        <button type="button" className="pf-btn-mini" onClick={() => setNewest((v) => !v)} title="Order of the list">
          {newest ? "Newest first" : "Oldest first"}
        </button>
        <button
          type="button"
          className="pf-btn-mini"
          onClick={() => {
            const pool = all.filter((s) => !chosen.has(s.code));
            if (pool.length) onChange([...value, ref(pool[Math.floor(Math.random() * pool.length)])]);
          }}
        >
          + random
        </button>
        {value.length > 0 && (
          <button type="button" className="pf-btn-mini" onClick={() => onChange([])}>
            Clear
          </button>
        )}
      </div>
      <div className="pf-setpick-list">
        {shown.map((s) => (
          <button key={s.code} type="button" className={chosen.has(s.code) ? "sel" : ""} onClick={() => toggle(s)}>
            <b>{s.name}</b>
            <small>
              {s.code.toUpperCase()} · {s.year}
              {chosen.has(s.code) ? " · ✓ in this block" : ""}
            </small>
          </button>
        ))}
        {!shown.length && <p className="pf-hint">No set matches.</p>}
      </div>
      {pages > 1 && (
        <div className="pf-pager" style={{ marginTop: "0.4rem" }}>
          <button type="button" className="pf-vchip" disabled={pg === 0} onClick={() => setPage(pg - 1)}>
            ‹ Prev
          </button>
          <span className="pf-hint">
            page {pg + 1} / {pages} · {ordered.length} sets
          </span>
          <button type="button" className="pf-vchip" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}>
            Next ›
          </button>
        </div>
      )}
    </div>
  );
}

/** Runs by set: how many blocks (= series of games), and the boosters of each block. */
function BlockPools({ data, blocks, onChange }: { data: ProgData; blocks: PackSetRef[][]; onChange: (b: PackSetRef[][]) => void }) {
  const [active, setActive] = useState(0);
  const at = Math.min(active, blocks.length - 1);
  const resize = (n: number) => {
    const next = blocks.slice(0, n);
    while (next.length < n) next.push([]);
    onChange(next);
  };
  const setBlock = (i: number, v: PackSetRef[]) => onChange(blocks.map((b, k) => (k === i ? v : b)));
  return (
    <div style={{ marginTop: "0.8rem" }}>
      <div className="pf-fields">
        <label className="pf-field">
          <span>Blocks (one series each)</span>
          <select value={blocks.length} onChange={(e) => resize(Number(e.target.value))}>
            {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="pf-blocktabs">
        {blocks.map((b, i) => (
          <button key={i} type="button" className={`pf-vchip${i === at ? " sel" : ""}${b.length ? "" : " empty"}`} onClick={() => setActive(i)}>
            Block {i + 1}
            <small>{b.length ? b.map((x) => x.code.toUpperCase()).join("+") : "—"}</small>
          </button>
        ))}
      </div>
      <div className="pf-row" style={{ justifyContent: "flex-start", gap: "0.4rem", margin: "0.3rem 0 0" }}>
        {at > 0 && (
          <button type="button" className="pf-btn-mini" onClick={() => setBlock(at, blocks[at - 1].slice())}>
            Same as block {at}
          </button>
        )}
        {blocks[at].length > 0 && blocks.length > 1 && (
          <button type="button" className="pf-btn-mini" onClick={() => onChange(blocks.map((b, k) => (k === at || b.length ? b : blocks[at].slice())))}>
            Fill the empty blocks with these
          </button>
        )}
      </div>
      <SetPicker data={data} value={blocks[at]} onChange={(v) => setBlock(at, v)} />
    </div>
  );
}

function SetupScreen({
  data,
  onStart,
  onLoad,
  room,
  onMe,
}: {
  data: ProgData | null;
  onStart: (s: RunSettings, names: string[], kinds: ("human" | "ai")[], seats: Record<string, number>) => void;
  onLoad: () => void;
  room: HubState;
  onMe: (me: RoomMe | null) => void;
}) {
  const [s, setS] = useState(loadSettings);
  const inRoom = s.mode === "friend" && !!room.room;
  const guestWaiting = inRoom && room.room?.role === "guest";
  const hostName = room.players.find((p) => p.id === "host")?.name?.trim() || "Host";
  const friendsIn = room.players.filter((p) => p.id !== "host");
  const linked = room.status === "connected";
  useEffect(() => {
    onMe(inRoom ? { name: s.names[0].trim() || "Player" } : null);
  }, [inRoom, s.names, onMe]);
  const first = data?.firstYear ?? 1993;
  const last = Math.min(data?.lastYear ?? THIS_YEAR, THIS_YEAR);
  const years = useMemo(() => Array.from({ length: last - first + 1 }, (_, i) => first + i), [first, last]);
  const set = (patch: Partial<ProgSetup>) => setS((cur) => ({ ...cur, ...patch }));
  // Teams need four people: phase.rs's AI cannot play as part of a team.
  const teamsOn = s.players === 4 && !!s.teams && s.mode === "friend";
  const packBlocks = s.packBlocks ?? [[]];
  const effective: RunSettings = { ...s, packBlocks: s.packMode === "sets" ? packBlocks : undefined, teams: teamsOn };
  const emptyBlocks = s.packMode === "sets" ? packBlocks.filter((b) => !b.length).length : 0;
  const blocks = blocksOf(effective);
  const tags = blockTags(effective);
  const bestOf = s.bestOf ?? 3;

  // The table: me, then seats 2..players (vs AI all AIs; online a friend or an AI each).
  const seatKinds: SeatKind[] = s.seatKinds.slice(0, s.players - 1).map((k) => (s.mode === "ai" ? "ai" : teamsOn ? "friend" : k));
  const friendSeats = seatKinds.filter((k) => k === "friend").length;
  const aiName = (n: number) => {
    const base = s.names[1].trim() || "Forge AI";
    return n === 0 ? base : `${base} ${n + 1}`;
  };
  const seatName = (i: number) => {
    if (seatKinds[i] === "ai") return aiName(seatKinds.slice(0, i).filter((k) => k === "ai").length);
    const friend = friendsIn[seatKinds.slice(0, i).filter((k) => k === "friend").length];
    return friend?.name?.trim() || `Friend ${i + 1}`;
  };
  const roomReady = !inRoom || (linked && friendsIn.length >= friendSeats);
  const canStart = blocks.length > 0 && !emptyBlocks && (s.mode === "ai" || roomReady);

  const start = () => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch {
      // ignore
    }
    const { names: _n, players: _p, seatKinds: _k, packMode: _m, ...settings } = s;
    const runSettings: RunSettings = { ...settings, packBlocks: effective.packBlocks, teams: teamsOn, bestOf };
    const names = [s.names[0].trim() || "Player 1", ...seatKinds.map((_, i) => seatName(i))];
    const kinds: ("human" | "ai")[] = ["human", ...seatKinds.map((k) => (k === "ai" ? ("ai" as const) : ("human" as const)))];
    // Friends in the order they joined the room take the friend seats in order.
    const seats: Record<string, number> = {};
    let f = 0;
    seatKinds.forEach((k, i) => {
      if (k !== "friend") return;
      const friend = friendsIn[f++];
      if (friend) seats[friend.id] = i + 1;
    });
    // A run with no friend seat is a run vs AI (it needs no room).
    onStart({ ...runSettings, mode: friendSeats ? "friend" : "ai" }, names, kinds, seats);
  };

  return (
    <div className="pf-stage">
      <div className="pf-eyebrow">Pay the 1 pt1</div>
      <h1 className="pf-title">Progression</h1>
      <p className="pf-sub">
        Travel through Magic's history one block at a time. Open sealed boosters, build a deck, play a best of {bestOf} at a table of 2 to 4. The losers open three cards
        from The List; the winner spins the Wheel of Fortune.
      </p>
      {s.mode === "friend" && (
        <RoomPanel
          state={room}
          mode="progression"
          peerLabel={friendsIn.map((p) => p.name).join(", ") || "your friends"}
          hint={
            !room.room
              ? undefined
              : guestWaiting
                ? "The host chooses the boosters, the table and the rules: the run starts here when they press Start."
                : `Choose the boosters, the table and the rules, then start: the run opens on every device. ${friendsIn.length} friend${friendsIn.length === 1 ? "" : "s"} in the room.`
          }
        />
      )}
      {guestWaiting ? (
        <div className="pf-panel" style={{ maxWidth: 520, margin: "0 auto" }}>
          <div className="pf-seg" style={{ marginBottom: "0.8rem" }}>
            <button type="button" onClick={() => set({ mode: "ai" })}>
              Vs AI
            </button>
            <button type="button" className="sel">
              Vs friends (online)
            </button>
          </div>
          <label className="pf-field">
            <span>Your name</span>
            <input value={s.names[0]} maxLength={24} onChange={(e) => set({ names: [e.target.value, s.names[1]] })} />
          </label>
          <div className="pf-hub-list" style={{ marginTop: "0.8rem" }}>
            {room.players.map((p) => (
              <div key={p.id}>
                <span className="pf-room-dot on" />
                <span>
                  {p.name}
                  {p.id === "host" ? " (host)" : p.id === room.myId ? " (you)" : ""}
                </span>
              </div>
            ))}
          </div>
          <p className="pf-hint-pulse" style={{ marginTop: "0.8rem" }}>Waiting for {hostName} to start…</p>
        </div>
      ) : (
        <div className="pf-grid2">
          <div className="pf-panel">
            <div className="pf-field">
              <span>Opponents</span>
              <div className="pf-seg">
                <button type="button" className={s.mode === "ai" ? "sel" : ""} onClick={() => set({ mode: "ai" })}>
                  Vs AI
                </button>
                <button type="button" className={s.mode === "friend" ? "sel" : ""} onClick={() => set({ mode: "friend" })}>
                  Vs friends (online)
                </button>
              </div>
            </div>
            <div className="pf-fields" style={{ marginTop: "1rem" }}>
              <label className="pf-field">
                <span>Your name</span>
                <input value={s.names[0]} maxLength={24} onChange={(e) => set({ names: [e.target.value, s.names[1]] })} />
              </label>
              <label className="pf-field">
                <span>Players</span>
                <select value={s.players} onChange={(e) => set({ players: Number(e.target.value) })}>
                  {[2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pf-field">
                <span>Games per block</span>
                <select value={bestOf} onChange={(e) => set({ bestOf: Number(e.target.value) })}>
                  {[1, 3, 5].map((n) => (
                    <option key={n} value={n}>
                      Best of {n}
                    </option>
                  ))}
                </select>
              </label>
              {(s.mode === "ai" || seatKinds.includes("ai")) && (
                <>
                  <label className="pf-field">
                    <span>AI name</span>
                    <input value={s.names[1]} maxLength={24} onChange={(e) => set({ names: [s.names[0], e.target.value] })} />
                  </label>
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
                </>
              )}
              <label className="pf-field">
                <span>Starting life</span>
                <input type="number" min={1} max={999} placeholder={teamsOn ? "30 per team" : "20"} value={s.startingLife ?? ""} onChange={(e) => set({ startingLife: e.target.value ? Math.max(1, Number(e.target.value)) : null })} />
              </label>
            </div>
            {s.players === 4 && (
              <div className="pf-field" style={{ marginTop: "0.9rem" }}>
                <span>Table of 4</span>
                <div className="pf-seg">
                  <button type="button" className={!teamsOn ? "sel" : ""} onClick={() => set({ teams: false })}>
                    Free for all
                  </button>
                  <button type="button" className={teamsOn ? "sel" : ""} disabled={s.mode === "ai"} onClick={() => set({ teams: true })}>
                    Teams 2 vs 2
                  </button>
                </div>
                <small className="pf-hint">{s.mode === "ai" ? "Teams need four players online: the AI can't play in a team." : teamsOn ? "Teams: four friends (the AI can't play in a team)." : ""}</small>
              </div>
            )}
            <div className="pf-seats" style={{ marginTop: "0.9rem" }}>
              <div className="pf-seat">
                <div className="pf-seat-head">
                  <b>Seat 1 · you</b>
                  {teamsOn && <span className="pf-hint">team A</span>}
                </div>
              </div>
              {seatKinds.map((k, i) => (
                <div key={i} className="pf-seat">
                  <div className="pf-seat-head">
                    <b>
                      Seat {i + 2} · {seatName(i)}
                    </b>
                    {teamsOn && <span className="pf-hint">{i === 0 ? "team A · your teammate" : "team B"}</span>}
                    {s.mode === "friend" && !teamsOn && (
                      <div className="pf-seg">
                        <button type="button" className={k === "friend" ? "sel" : ""} onClick={() => set({ seatKinds: s.seatKinds.map((x, j) => (j === i ? "friend" : x)) })}>
                          Friend
                        </button>
                        <button type="button" className={k === "ai" ? "sel" : ""} onClick={() => set({ seatKinds: s.seatKinds.map((x, j) => (j === i ? "ai" : x)) })}>
                          AI
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {s.mode === "friend" && (
              <p className="pf-hint" style={{ marginTop: "0.9rem" }}>
                {inRoom
                  ? friendsIn.length >= friendSeats
                    ? "Everyone is in: friends take the friend seats in the order they joined."
                    : `Waiting for ${friendSeats - friendsIn.length} more friend${friendSeats - friendsIn.length === 1 ? "" : "s"} to join the room…`
                  : "Open a room above and give the code to your friends. Each of you opens your own packs on your own device; the AI seats play on yours."}
              </p>
            )}
          </div>
          <div className="pf-panel">
            <div className="pf-field">
              <span>Boosters</span>
              <div className="pf-seg">
                <button type="button" className={s.packMode === "years" ? "sel" : ""} onClick={() => set({ packMode: "years" })}>
                  By years
                </button>
                <button type="button" className={s.packMode === "sets" ? "sel" : ""} onClick={() => set({ packMode: "sets" })}>
                  Choose the sets
                </button>
              </div>
            </div>
            <div className="pf-fields" style={{ marginTop: "0.8rem" }}>
              {s.packMode === "years" && (
                <>
                  <label className="pf-field">
                    <span>From year</span>
                    <select
                      value={s.startYear}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        set({ startYear: v, endYear: Math.max(v, s.endYear) });
                      }}
                    >
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="pf-field">
                    <span>To year</span>
                    <select value={s.endYear} onChange={(e) => set({ endYear: Number(e.target.value) })}>
                      {years
                        .filter((y) => y >= s.startYear)
                        .map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              )}
              {s.packMode === "years" && (
                <label className="pf-field">
                  <span>Years per block</span>
                  <select value={s.blockSize} onChange={(e) => set({ blockSize: Number(e.target.value) })}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="pf-field">
                <span>Packs per sealed</span>
                <select value={s.packs} onChange={(e) => set({ packs: Number(e.target.value) })}>
                  {[3, 4, 5, 6, 7, 8, 10, 12].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {s.packMode === "sets" &&
              (data ? <BlockPools data={data} blocks={packBlocks} onChange={(v) => set({ packBlocks: v })} /> : <p className="pf-hint-pulse">Loading the sets…</p>)}
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
              <b>{blocks.length}</b> block{blocks.length === 1 ? "" : "s"} → <b>{blocks.length}</b> series of best of {bestOf} (
              {blocks.length * Math.ceil(bestOf / 2)}–{blocks.length * bestOf} games)
              {blocks.length > 0 && (
                <>
                  {" "}· {tags.slice(0, 6).join(", ")}
                  {tags.length > 6 ? ", …" : ""}
                </>
              )}
              <br />
              {s.packMode === "years"
                ? `Early years use their original boosters (8- and 12-card packs, no mythics before 2008). Smaller packs are topped up so every sealed holds about ${s.packs * 14} cards.`
                : emptyBlocks
                  ? `${emptyBlocks} block${emptyBlocks === 1 ? " has" : "s have"} no boosters yet: pick at least one set for every block.`
                  : `Each block opens about ${s.packs * 14} cards from its own sets, each with its booster layout.`}
            </div>
          </div>
        </div>
      )}
      <div className="pf-row">
        <button type="button" className="pf-btn secondary" onClick={onLoad}>
          Load a save code
        </button>
        {!guestWaiting && (
          <button type="button" className="pf-btn" onClick={start} disabled={!canStart}>
            Start the journey ▸
          </button>
        )}
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
      {zoom && <CardZoom print={zoom} onClose={() => setZoom(null)} />}
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
  room,
}: {
  run: RunState;
  data: ProgData;
  setRun: (r: RunState) => void;
  onError: (e: string | null) => void;
  navigate: (to: string, opts?: { state?: unknown }) => void;
  room: RoomState;
}) {
  const me = run.players[run.me];
  const others = othersOf(run);
  const hostingStatus = useMultiplayerStore((s) => s.hostingStatus);
  const hostGameCode = useMultiplayerStore((s) => s.hostGameCode);
  const cardStatus = useCardDataStore((s) => s.status);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const label = blockLabel(run, run.block);
  const bestOf = run.bestOf ?? 3;
  const target = seriesTarget(run);
  const series = run.players.map((_, i) => run.series?.[i] ?? 0);
  const gameNo = series.reduce((a, b) => a + b, 0) + 1;
  // The sides of the table (teams of two, or every player) with their games won.
  const sides = [...new Set(run.players.map((_, i) => sideLead(run, i)))];
  const scoreLine = sides.map((lead) => `${sideName(run, lead)} ${series[lead]}`).join(" · ");
  // Vs friends in a mode room: the game room opens and is joined by itself; friends
  // enter one after the other so that every device keeps its seat of the run.
  const [manualRoom, setManualRoom] = useState(false);
  const cardsLoading = cardStatus === "loading";
  const inRoom = run.mode === "friend" && !!room.room;
  const friendOrder = run.players.slice(0, run.me).filter((p) => p.kind === "human").length;
  const auto = useAutoMatchRoom({
    state: room,
    matchKey: `${run.id}:${run.block}:${gameNo}`,
    enabled: inRoom && !run.pendingResult && !manualRoom && !cardsLoading,
    host: async () => {
      setRun({ ...run, pendingGameId: "*" });
      await hostFriendMatch(run, data);
    },
    join: async (code) => {
      setRun({ ...run, pendingGameId: "*" });
      await joinFriendMatch(run, data, code, crypto.randomUUID(), navigate);
    },
    onError: (e) => onError(e),
    seat: run.me === 0 ? undefined : friendOrder,
  });

  const claim = async (winner: Slot | null) => {
    setBusy(true);
    try {
      await prepareBlock(data, run);
      setRun(applyResult(data, run, winner));
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (run.pendingResult) {
    const winner = resultWinner(run);
    const won = winner !== null && sameSide(run, winner, run.me);
    const decides = winner !== null && series[sideLead(run, winner)] + 1 >= target;
    const iTakeBlock = decides && won;
    return (
      <div className="pf-stage">
        <div className="pf-eyebrow">
          Best of {bestOf} · {label} · game {gameNo}
        </div>
        <div className={`pf-result ${won ? "win" : "loss"}`}>{won ? "Victory" : "Defeat"}</div>
        <p className="pf-sub">{winner === null ? "No winner." : `${sideName(run, winner)} won${bestOf > 1 ? " this game" : ""}.`}</p>
        {bestOf > 1 && (
          <p className="pf-hint" style={{ textAlign: "center" }}>
            Before this game: {scoreLine} — first to {target}.
          </p>
        )}
        <div className="pf-row">
          <button type="button" className="pf-btn" disabled={busy} onClick={() => void claim(winner)}>
            {!decides ? "Next game ▸" : iTakeBlock ? "Spin the Wheel of Fortune ▸" : "Open three cards from The List ▸"}
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
  const firstFriend = others.find((x) => x.p.kind === "human")?.p.name ?? "your friends";

  return (
    <div className="pf-stage">
      <div className="pf-eyebrow">
        Best of {bestOf} · {label}
        {bestOf > 1 ? ` · game ${gameNo}` : ""}
      </div>
      <h1 className="pf-title">To battle</h1>
      <div className="pf-panel" style={{ maxWidth: 760, margin: "0 auto" }}>
        <div className="pf-versus">
          <div className="side">
            <b>{run.teams && run.players.length === 4 ? sideName(run, run.me) : me.name}</b>
            <span>
              {myDeck}-card deck · {me.wins}–{me.losses}
            </span>
          </div>
          <div className="x">VS</div>
          <div className="side">
            {others
              .filter((x) => !sameSide(run, x.i, run.me))
              .map((x) => (
                <div key={x.i}>
                  <b>{x.p.name}</b>
                  <span>
                    {" "}
                    {x.p.kind === "ai" ? `AI · ${deckSize(x.p)} cards · ` : ""}
                    {x.p.wins}–{x.p.losses}
                  </span>
                </div>
              ))}
          </div>
        </div>
        {bestOf > 1 && (
          <p className="pf-hint" style={{ textAlign: "center", marginTop: "0.6rem" }}>
            {scoreLine} — first to {target} takes the block.
          </p>
        )}

        {run.pendingGameId && hostingStatus === "idle" && !(inRoom && !manualRoom) && (
          <p className="pf-hint" style={{ textAlign: "center", marginTop: "1rem" }}>
            A game was started but no final result came back. Play it again, or record the result by hand below.
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
              {loading ? "Loading cards…" : bestOf > 1 ? `Start game ${gameNo} ▸` : "Start the game ▸"}
            </button>
          </div>
        ) : inRoom && !manualRoom ? (
          <div style={{ marginTop: "1.2rem", textAlign: "center" }}>
            <p className="pf-hint-pulse">{auto.waiting}</p>
            {room.room?.role === "host" ? (
              <div className="pf-row">
                {auto.stuck && <span className="pf-hint">Someone has not entered yet?</span>}
                <button type="button" className={auto.stuck ? "pf-btn small" : "pf-btn-mini"} onClick={auto.restart}>
                  ⟳ Open a new game room
                </button>
              </div>
            ) : (
              <div className="pf-row">
                <button type="button" className="pf-btn-mini" onClick={auto.retry}>
                  ⟳ Join again
                </button>
              </div>
            )}
            <div className="pf-row">
              <button type="button" className="pf-btn secondary small" onClick={() => setRun({ ...run, phase: "build" })}>
                ◂ Edit deck
              </button>
              <button
                type="button"
                className="pf-btn-mini"
                onClick={() => {
                  if (room.room?.role === "host") useMultiplayerStore.getState().cancelHosting();
                  setManualRoom(true);
                }}
              >
                Use a room code by hand
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: "1.2rem", display: "grid", gap: "1.2rem", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
            {run.me === 0 && (
              <div>
                <div className="pf-field">
                  <span>Host the room</span>
                </div>
                {hostingStatus !== "idle" ? (
                  <div style={{ textAlign: "center" }}>
                    {hostGameCode ? (
                      <>
                        <button type="button" className="pf-code" title="Copy" onClick={() => void navigator.clipboard?.writeText(hostGameCode).catch(() => {})}>
                          {hostGameCode}
                        </button>
                        <p className="pf-hint">
                          Tell {firstFriend} this code{others.filter((x) => x.p.kind === "human").length > 1 ? " (friends enter in seat order)" : ""}. The game starts as soon as every seat is taken.
                        </p>
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
            )}
            {hostingStatus === "idle" && run.me !== 0 && (
              <div>
                <div className="pf-field">
                  <span>Join the host's room</span>
                </div>
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
                        onError("Enter the 5-character room code the host sees.");
                        return;
                      }
                      const gameId = crypto.randomUUID();
                      void start(() => joinFriendMatch(run, data, code, gameId, navigate), "*");
                    }}
                  >
                    Join ▸
                  </button>
                </div>
                {friendOrder > 1 && <p className="pf-hint">Join after the friends in the seats before yours, so that everyone keeps their seat.</p>}
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
              {sides.map((lead) => (
                <button key={lead} type="button" className={`pf-btn small ${sameSide(run, lead, run.me) ? "" : "secondary"}`} disabled={busy} onClick={() => void claim(lead)}>
                  {sameSide(run, lead, run.me) ? (run.teams && run.players.length === 4 ? "We won" : "I won") : `${sideName(run, lead)} won`}
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
  const r = me.reward;
  const [picked, setPicked] = useState<string | null>(null);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [zoom, setZoom] = useState<ProgPrint | null>(null);

  // Saves from the first version could hold a wheel with a "Special" slice and no cards: rebuild it.
  const broken = rewardNeedsRepair(run);
  useEffect(() => {
    if (!broken) return;
    let cancelled = false;
    void prepareBlock(data, run).then(() => {
      if (!cancelled) setRun(repairReward(data, run));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broken]);

  // What the AIs got (friends open theirs on their own devices).
  const oppNote = (() => {
    const notes = othersOf(run)
      .filter((x) => x.p.kind === "ai" && x.p.reward)
      .map(({ p }) => {
        const o = p.reward!;
        if (o.kind === "list") return `${p.name} opened ${o.list?.map((c) => c.n).join(", ")} from The List.`;
        return `${p.name} spun ${o.rarity ? RARITY_LABEL[o.rarity] : "the wheel"} and took a card.`;
      });
    return notes.length ? notes.join(" ") : null;
  })();

  if (broken) {
    return (
      <Centered>
        <p className="pf-hint-pulse">Re-spinning the wheel…</p>
      </Centered>
    );
  }

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
      <div className="pf-eyebrow">Victory · {blockLabel(run, run.block)}</div>
      <h1 className="pf-title">Wheel of Fortune</h1>
      <p className="pf-sub">One slice for every rarity you opened this block. Wherever it stops, choose one card of that rarity out of 30 from this block's boosters.</p>
      <WheelOfFortune
        wheel={r.wheel ?? ["c", "u", "r"]}
        landing={r.rarity ?? "c"}
        spun={Boolean(r.spun)}
        onSpun={() => {
          const players = run.players.slice();
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
  return <CardZoom print={print} onClose={onClose} />;
}

// ── end of the run ──────────────────────────────────────────────────────────

function FinalScreen({ run, onNew, onCopy }: { run: RunState; onNew: () => void; onCopy: () => void }) {
  // Standings by side (teams of two count together).
  const sides = [...new Set(run.players.map((_, i) => sideLead(run, i)))]
    .map((lead) => ({ lead, name: sideName(run, lead), wins: run.players[lead].wins, losses: run.players[lead].losses }))
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  const champion = sides.length > 1 && sides[0].wins > sides[1].wins ? sides[0] : null;
  const many = sides.length > 2 || (run.teams && run.players.length === 4);
  return (
    <div className="pf-stage">
      <div className="pf-eyebrow">
        {runLabel(run)} · {blocksOf(run).length} blocks
      </div>
      <h1 className="pf-title">{champion ? `${champion.name} conquer${many && run.teams ? "" : "s"} history` : "A perfectly even rivalry"}</h1>
      <p className="pf-sub">{sides.map((x) => `${x.name} ${x.wins}–${x.losses}`).join(" · ")}</p>
      <div className="pf-panel" style={{ maxWidth: 760, margin: "0 auto" }}>
        <table className="pf-table">
          <thead>
            <tr>
              <th>Block</th>
              <th>{run.packBlocks?.length ? "Boosters" : "Years"}</th>
              <th>Winner</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {run.history.map((h) => (
              <tr key={h.block}>
                <td>{h.block + 1}</td>
                <td>{run.packBlocks?.length ? blockLabel(run, h.block) : yearsLabel(h.years)}</td>
                <td>{h.winner === null ? "—" : sideName(run, h.winner)}</td>
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
              <button type="button" className="pf-btn secondary small" disabled={!code} onClick={() => download(`progression-block${run.block + 1}.txt`, code)}>
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
          {runLabel(run)} · block {Math.min(run.block + 1, blocksOf(run).length)} of {blocksOf(run).length} · {run.players.length} players{run.mode === "ai" ? " (vs AI)" : ""}. Pick the player whose cards you play on this device.
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
