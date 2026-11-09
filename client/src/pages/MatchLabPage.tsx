// Test match — one game, 2 to 4 players, same look and flow as the other modes.
//
// Every list is read like any imported list (deckImport.ts: newest printing for
// cards without a set, basic lands to the tray, unknown cards block, "may not
// work" cards are listed); any ready-made deck of the app (precons, meta decks of
// every year) can fill a seat. Rules: Normal (Freeform: any cards, any number),
// Commander (Freeform Commander), Two-Headed Giant, Archenemy, Planechase — no
// card-pool legality anywhere (the multiplayer variants keep the engine's
// 60-card minimum). Vs the AI: every other seat is an AI. Online: open the room
// (roomHub.tsx, up to 4 players), the friends join with its code and paste their
// lists, the seats nobody takes can be AIs; the host presses Start and the game
// room is opened and joined by itself.
//
// Deep link (used to hand a battle over):
//   /#you=<b64url decklist>&opp=<b64url decklist>&life=20&ai=Medium&first=play&auto=1
// Any key may be omitted; `auto=1` starts the match as soon as the cards are ready.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";

import { AI_DIFFICULTIES } from "../constants/ai";
import { useCardDataStore } from "../stores/cardDataStore";
import { useMultiplayerStore } from "../stores/multiplayerStore";
import { CardBackButton } from "../progression/CardBackPicker";
import type { ProgData } from "../progression/data";
import { loadProgressionData } from "../progression/data";
import type { ImportedDeck } from "../progression/deckImport";
import { DeckCatalogPicker } from "../progression/DeckCatalogPicker";
import { DeckImportPanel, importReady } from "../progression/DeckImportPanel";
import type { MatchSpec, TableSeat } from "../progression/launch";
import { engineDeckMinimum, hostFriendMatchSpec, joinFriendMatchSpec, launchAiMatchSpec, roomCosmetics } from "../progression/launch";
import type { RoomMe } from "../progression/room";
import { RoomPanel, RoomToasts, useAutoMatchRoom } from "../progression/room";
import { useRoomHub } from "../progression/roomHub";
import type { PlayerState } from "../progression/run";
import { emptyBasics } from "../progression/run";
import { foldBasics } from "../progression/starter";
import "../progression/progression.css";

const YOU_DECK = "MatchLab · You";
const OPP_DECK = "MatchLab · Opponent";
const SETTINGS_KEY = "phase-matchlab-draft";
const CUSTOM = "__custom__";

type First = "random" | "play" | "draw";
type LabFormat = "normal" | "commander" | "2hg" | "2hgc" | "archenemy" | "planechase" | "planechasec";
/** Formats phase.rs's AI cannot play (team turns, the planar die): friends online only. */
const NO_AI = (f: LabFormat | undefined) => f === "2hg" || f === "2hgc" || f === "planechase" || f === "planechasec";
/** Team formats: always 4 players, seats 1+2 against 3+4. */
const TEAMS = (f: LabFormat | undefined) => f === "2hg" || f === "2hgc";
const FORMATS: { id: LabFormat; label: string; spec: NonNullable<MatchSpec["format"]>; note: string }[] = [
  { id: "normal", label: "Normal (free for all)", spec: "Freeform", note: "Any cards, any number of copies. At 3-4 players everyone plays for themselves." },
  { id: "commander", label: "👑 Commander", spec: "Commander", note: "Each deck has a commander in the command zone (commander damage, 40 life unless you set another). Any cards, any number of copies." },
  { id: "planechase", label: "Planechase", spec: "Planechase", note: "2 to 4 players, a shared planar deck (supplied by the engine), roll the planar die. Friends online only: the AI cannot play Planechase. Any cards, any deck size." },
  { id: "planechasec", label: "👑 Planechase Commander", spec: "PlanechaseCommander", note: "Planechase with commanders: 2 to 4 players, command zone, shared planar deck. Friends online only. Any cards, any number of copies, any deck size." },
];

interface SeatCfg {
  kind: "ai" | "friend";
  pick: string;
  text: string;
  difficulty: string;
}
interface LabSettings {
  mode: "ai" | "friend";
  format: LabFormat;
  players: number;
  difficulty: string;
  life: number | null;
  first: First;
  name: string;
  you: { pick: string; text: string };
  seats: SeatCfg[];
}

const newSeat = (kind: "ai" | "friend" = "friend"): SeatCfg => ({ kind, pick: CUSTOM, text: "", difficulty: "Medium" });

function decodeB64Url(value: string): string {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function readHash(): (Partial<LabSettings> & { auto?: boolean; oppText?: string }) {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return {};
  const p = new URLSearchParams(hash);
  const out: Partial<LabSettings> & { auto?: boolean; oppText?: string } = {};
  try {
    const you = p.get("you");
    const opp = p.get("opp");
    if (you) out.you = { pick: CUSTOM, text: decodeB64Url(you) };
    if (opp) out.oppText = decodeB64Url(opp);
  } catch {
    // Malformed link: fall back to the saved settings.
  }
  const life = Number(p.get("life"));
  if (Number.isFinite(life) && life > 0) out.life = Math.round(life);
  const ai = p.get("ai");
  if (ai && AI_DIFFICULTIES.some((d) => d.id === ai)) out.difficulty = ai;
  const first = p.get("first");
  if (first === "play" || first === "draw") out.first = first;
  if (p.get("format") === "Commander") out.format = "commander";
  out.auto = p.get("auto") === "1";
  return out;
}

function loadSettings(): LabSettings {
  const base: LabSettings = { mode: "ai", format: "normal", players: 2, difficulty: "Medium", life: null, first: "random", name: "Player", you: { pick: CUSTOM, text: "" }, seats: [newSeat(), newSeat(), newSeat()] };
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as (Partial<LabSettings> & { commander?: boolean; opp?: { pick: string; text: string } }) | null;
    if (raw) {
      const { opp, commander, ...rest } = raw;
      Object.assign(base, rest);
      if (commander && !raw.format) base.format = "commander";
      if (!Array.isArray(raw.seats)) base.seats = [newSeat(), newSeat(), newSeat()];
      if (opp && !Array.isArray(raw.seats)) base.seats[0] = { ...newSeat(), pick: opp.pick, text: opp.text };
      while (base.seats.length < 3) base.seats.push(newSeat());
    }
  } catch {
    // corrupt: start clean
  }
  return base;
}

function playerOf(data: ProgData, name: string, kind: "human" | "ai", d: ImportedDeck, commander: boolean): PlayerState {
  const pool = d.owned.map((o) => ({ ...o }));
  const p: PlayerState = {
    name,
    kind,
    pool,
    main: pool.map((_, i) => i),
    basics: emptyBasics(),
    wins: 0,
    losses: 0,
    opened: [],
    ready: false,
    reward: null,
    ...(commander && d.commanders.length ? { commander: d.commanders.slice(0, 2) } : {}),
  };
  return foldBasics(data, p);
}

function Centered({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.8rem", padding: "3rem 1rem" }}>{children}</div>;
}

export function MatchLabPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const cardStatus = useCardDataStore((s) => s.status);
  const [fromHash] = useState(readHash);
  const [s, setS] = useState<LabSettings>(() => {
    const d = loadSettings();
    const { auto: _auto, oppText, ...h } = fromHash;
    void _auto;
    const seats = d.seats.slice();
    if (oppText) seats[0] = { ...seats[0], kind: "ai", pick: CUSTOM, text: oppText };
    return { ...d, ...h, you: h.you ?? d.you, seats, mode: oppText ? "ai" : d.mode, players: oppText ? 2 : d.players };
  });
  const set = (patch: Partial<LabSettings>) => setS((cur) => ({ ...cur, ...patch }));
  const setSeat = (i: number, patch: Partial<SeatCfg>) => setS((cur) => ({ ...cur, seats: cur.seats.map((x, k) => (k === i ? { ...x, ...patch } : x)) }));
  const [data, setData] = useState<ProgData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [you, setYou] = useState<ImportedDeck | null>(null);
  const [aiDecks, setAiDecks] = useState<(ImportedDeck | null)[]>([null, null, null]);
  const [busy, setBusy] = useState(false);
  const [matchKey, setMatchKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(() => {
    const st = location.state as { setupError?: string; deckRejected?: boolean; reason?: string } | null;
    if (st?.setupError) return st.setupError;
    if (st?.deckRejected) return `Your deck was rejected by the host${st.reason ? `: ${st.reason}` : "."}`;
    return null;
  });
  const autoStarted = useRef(false);

  useEffect(() => {
    void useCardDataStore.getState().warm();
    loadProgressionData()
      .then(setData)
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : String(err)));
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch {
      // convenience only
    }
  }, [s]);

  // Vs friends: the room (up to 4 players). The guests follow the host's rules.
  const [guestRules, setGuestRules] = useState<{ format?: LabFormat; players?: number } | null>(null);
  // Two-Headed Giant and Archenemy are hidden for now (team turns misbehave in this build): older settings fall back to Normal.
  const wanted: LabFormat = (s.mode === "friend" && guestRules?.format) || s.format;
  const format: LabFormat = FORMATS.some((f) => f.id === wanted) ? wanted : "normal";
  const fmt = FORMATS.find((f) => f.id === format) ?? FORMATS[0];
  const commander = format === "commander" || format === "2hgc" || format === "planechasec";

  const minDeck = engineDeckMinimum(fmt.spec, Math.max(2, guestRules?.players ?? s.players));
  const deckOk = (d: ImportedDeck | null) => importReady(d, commander) && (d?.size ?? 0) + (d?.commanders.length ?? 0) >= minDeck;
  const youReady = deckOk(you);
  const roomMe: RoomMe | null = s.mode === "friend" ? { name: s.name.trim() || "Player", deck: youReady && you ? you.id : null, commander } : null;
  const hub = useRoomHub("test", roomMe);
  const inRoom = s.mode === "friend" && !!hub.room;
  const host = hub.room?.role === "host";
  const hostSettings = hub.latest.settings as { format?: LabFormat; players?: number } | undefined;
  useEffect(() => {
    setGuestRules(!host && inRoom && hostSettings ? hostSettings : null);
  }, [host, inRoom, hostSettings]);
  const players = TEAMS(format) ? 4 : guestRules?.players ?? s.players;
  // Archenemy: the heroes share one turn, which the AI cannot play — AI heroes only 1 on 1.
  const noAi = NO_AI(format) || (format === "archenemy" && players > 2);

  // The table: seats 2..players. Vs AI they are all AIs; online each is a friend or an AI.
  const seats = s.seats.slice(0, players - 1).map((x) => ({ ...x, kind: s.mode === "ai" ? ("ai" as const) : noAi ? ("friend" as const) : x.kind }));
  const aiIdx = seats.map((x, i) => (x.kind === "ai" ? i : -1)).filter((i) => i >= 0);
  const friendSeats = seats.filter((x) => x.kind === "friend").length;
  const aisReady = aiIdx.every((i) => deckOk(aiDecks[i]));
  const friendsIn = hub.players.filter((p) => p.id !== "host");
  const friendsReady = friendsIn.filter((p) => !!p.deck).length;

  // The host tells the room its rules and table.
  const hubSend = hub.send;
  useEffect(() => {
    if (!inRoom || !host) return;
    hubSend({ k: "settings", format: s.format, players: TEAMS(s.format) ? 4 : s.players });
  }, [inRoom, host, s.format, s.players, hubSend, hub.status]);

  const spec = (): MatchSpec => {
    if (!data || !you) throw new Error("Your list is not ready.");
    const me = playerOf(data, s.name.trim() || "Player", "human", you, commander);
    // The AI seats belong to the table of the host (or of the game vs AI): a friend joining brings only their deck.
    const ownsTable = s.mode === "ai" || host;
    const aiSeats: TableSeat[] = ownsTable ? aiIdx.filter((i) => aiDecks[i]).map((i) => ({ player: playerOf(data, `AI ${i + 2}`, "ai", aiDecks[i]!, commander), difficulty: seats[i].difficulty, seatIndex: i + 1 })) : [];
    const opp = aiSeats[0]?.player ?? { ...me, name: "Friend", pool: [], main: [] };
    return {
      me,
      opp,
      difficulty: aiSeats[0]?.difficulty ?? s.difficulty,
      startingLife: s.life,
      matchType: "Bo1",
      first: s.mode === "ai" && s.first !== "random" && players === 2 ? s.first : null,
      hostFirst: null,
      youDeck: YOU_DECK,
      aiDeck: OPP_DECK,
      format: fmt.spec,
      players,
      aiSeats,
      tableCos: roomCosmetics(hub.players),
    };
  };

  const remoteKey = (hub.latest.match as { key?: string } | undefined)?.key ?? null;
  const auto = useAutoMatchRoom({
    state: hub,
    matchKey: (host ? matchKey : remoteKey) ?? "none",
    enabled: inRoom && youReady && !!data && cardStatus !== "loading" && (host ? !!matchKey : !!remoteKey),
    host: () => hostFriendMatchSpec(spec(), data!),
    join: (code) => joinFriendMatchSpec(spec(), data!, code, crypto.randomUUID(), navigate),
    onError: (e) => {
      setError(e);
      setMatchKey(null);
    },
    // Friends enter the game in the order they joined the room: each takes the seat the host sees for them.
    seat: host ? undefined : Math.max(1, hub.players.findIndex((p) => p.id === hub.myId)),
  });

  const startAi = async () => {
    if (busy || !data) return;
    setError(null);
    if (noAi) {
      setError(format === "archenemy" ? "Archenemy vs AI: 2 players only (the AI can't play the heroes' shared turn). With 3-4 players the heroes are friends online." : `${fmt.label}: the AI can't play it — play it online with friends.`);
      return;
    }
    if (!youReady || !aisReady) {
      setError(minDeck ? `Every deck needs recognised cards and at least ${minDeck} cards in ${fmt.label}.` : commander ? "Every list needs recognised cards and a commander (see the notes under each list)." : "Every list needs recognised cards (see the notes under each list).");
      return;
    }
    setBusy(true);
    try {
      await launchAiMatchSpec(spec(), data, crypto.randomUUID(), navigate);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  // Deep link with auto=1: start once everything is ready.
  useEffect(() => {
    if (!fromHash.auto || autoStarted.current || cardStatus !== "ready" || !data || s.mode !== "ai") return;
    if (!youReady || !aisReady) return;
    autoStarted.current = true;
    void startAi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardStatus, data, you, aiDecks, fromHash.auto, s.mode]);

  const deckEditor = (slot: string, cfg: { pick: string; text: string }, onText: (t: string, pick: string) => void, onDeck: (d: ImportedDeck | null) => void) =>
    data && (
      <>
        <div style={{ marginBottom: "0.5rem" }}>
          <DeckCatalogPicker data={data} commander={commander} onPick={(d) => onText(d.text, d.id)} />
        </div>
        <DeckImportPanel data={data} commander={commander} slot={slot} text={cfg.text} onText={(t) => onText(t, CUSTOM)} onDeck={onDeck} compact />
        {minDeck > 0 && <p className="pf-hint" style={{ margin: "0.2rem 0 0" }}>{fmt.label}: at least {minDeck} cards.</p>}
      </>
    );

  const loading = cardStatus === "loading" || !data;
  const canHostStart = inRoom && youReady && aisReady && friendsReady >= friendSeats && friendsIn.length >= friendSeats && !loading && !matchKey;
  let body: ReactNode;
  if (loadError) body = <Centered><div className="pf-error">Could not load the cards: {loadError}</div></Centered>;
  else
    body = (
      <div className="pf-stage" style={{ maxWidth: 1240 }}>
        <div className="pf-eyebrow">Pay the 1 pt1</div>
        <h1 className="pf-title">Test match</h1>
        <p className="pf-sub">Any decks, one game: 2 to 4 players, against the AI or friends online.</p>

        <div className="pf-room-row" style={{ justifyContent: "center", marginBottom: "0.8rem" }}>
          <button type="button" className={`pf-vchip${s.mode === "ai" ? " sel" : ""}`} onClick={() => set({ mode: "ai", format: NO_AI(s.format) ? (s.format === "2hgc" || s.format === "planechasec" ? "commander" : "normal") : s.format })}>
            Vs AI
          </button>
          <button type="button" className={`pf-vchip${s.mode === "friend" ? " sel" : ""}`} onClick={() => set({ mode: "friend" })}>
            Vs friends (online)
          </button>
        </div>
        {s.mode === "friend" && (
          <RoomPanel
            state={hub}
            mode="test"
            hint={
              !hub.room
                ? undefined
                : host
                  ? `Choose the rules and the seats below; your friends join with the code and paste their lists. ${friendsIn.length} friend${friendsIn.length === 1 ? "" : "s"} in the room.`
                  : "The host chooses the rules and the seats. Paste your list: the game opens on every device when the host presses Start."
            }
          />
        )}

        <div className="pf-panel" style={{ marginBottom: "1rem" }}>
          <div className="pf-fields">
            <label className="pf-field">
              <span>Rules</span>
              <select value={format} disabled={!!guestRules} onChange={(e) => set({ format: e.target.value as LabFormat, ...(TEAMS(e.target.value as LabFormat) ? { players: 4 } : {}) })}>
                {FORMATS.filter((f) => s.mode === "friend" || !NO_AI(f.id)).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="pf-field">
              <span>Players</span>
              <select value={players} disabled={TEAMS(format) || !!guestRules} onChange={(e) => set({ players: Number(e.target.value) })}>
                {[2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="pf-field">
              <span>Your name</span>
              <input value={s.name} maxLength={24} onChange={(e) => set({ name: e.target.value })} />
            </label>
            {(s.mode === "ai" || host) && (
              <label className="pf-field">
                <span>Starting life</span>
                <input type="number" min={1} max={999} placeholder="default" value={s.life ?? ""} onChange={(e) => set({ life: e.target.value ? Math.max(1, Number(e.target.value)) : null })} />
              </label>
            )}
            {s.mode === "ai" && players === 2 && (
              <label className="pf-field">
                <span>Who starts</span>
                <select value={s.first} onChange={(e) => set({ first: e.target.value as First })}>
                  <option value="random">Random</option>
                  <option value="play">You play first</option>
                  <option value="draw">You draw first</option>
                </select>
              </label>
            )}
          </div>
          <p className="pf-hint" style={{ marginBottom: 0 }}>
            {fmt.label}: {fmt.note}
          </p>
          <div style={{ marginTop: "0.6rem" }}>
            <CardBackButton label="Your card back" />
          </div>
        </div>

        <div className="pf-lab-sides">
          <div className="pf-panel">
            <div className="pf-eyebrow" style={{ textAlign: "left" }}>
              Seat 1{format === "archenemy" && (s.mode === "ai" || host) ? " · archenemy" : ""}
            </div>
            <h2 style={{ margin: "0.1rem 0 0.6rem" }}>Your deck</h2>
            {deckEditor("test-you", s.you, (t, pick) => set({ you: { pick, text: t } }), setYou)}
          </div>
          {(s.mode === "ai" || host || !inRoom) && (
            <div className="pf-panel">
              <div className="pf-seats">
                {seats.map((seat, i) => (
                  <div key={i} className="pf-seat">
                    <div className="pf-seat-head">
                      <b>Seat {i + 2}</b>
                      {TEAMS(format) && <span className="pf-hint">{i === 0 ? "your teammate" : "opponent team"}</span>}
                      {s.mode === "friend" && !noAi && (
                        <div className="pf-seg">
                          <button type="button" className={seat.kind === "friend" ? "sel" : ""} onClick={() => setSeat(i, { kind: "friend" })}>
                            Friend
                          </button>
                          <button type="button" className={seat.kind === "ai" ? "sel" : ""} onClick={() => setSeat(i, { kind: "ai" })}>
                            AI
                          </button>
                        </div>
                      )}
                      {seat.kind === "ai" && (
                        <select value={seat.difficulty} onChange={(e) => setSeat(i, { difficulty: e.target.value })}>
                          {AI_DIFFICULTIES.map((d) => (
                            <option key={d.id} value={d.id}>
                              AI · {d.id.replace(/([a-z])([A-Z])/g, "$1 $2")}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    {seat.kind === "ai" ? (
                      deckEditor(
                        `test-seat-${i}`,
                        seat,
                        (t, pick) => setSeat(i, { text: t, pick }),
                        (d) => setAiDecks((cur) => cur.map((x, k) => (k === i ? d : x))),
                      )
                    ) : (
                      <p className="pf-hint">
                        {(() => {
                          const p = friendsIn[seats.slice(0, i).filter((x) => x.kind === "friend").length];
                          return p ? (p.deck ? `✓ ${p.name} is ready.` : `${p.name} is pasting their list…`) : "Waiting for a friend to join the room…";
                        })()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {s.mode === "friend" && inRoom && !host && (
            <div className="pf-panel">
              <div className="pf-eyebrow" style={{ textAlign: "left" }}>
                In the room
              </div>
              <div className="pf-hub-list">
                {hub.players.map((p) => (
                  <div key={p.id}>
                    <span className={`pf-room-dot${p.deck ? " on" : ""}`} />
                    <span>
                      {p.name}
                      {p.id === "host" ? " (host)" : ""}
                    </span>
                  </div>
                ))}
              </div>
              <p className="pf-hint">
                {players} players{guestRules ? "" : " (waiting for the host's rules…)"}. {auto.waiting}
              </p>
              {auto.waiting && (
                <button type="button" className="pf-btn-mini" onClick={auto.retry}>
                  ⟳ Join again
                </button>
              )}
            </div>
          )}
        </div>

        <div className="pf-row" style={{ marginTop: "1rem" }}>
          {s.mode === "ai" ? (
            <button type="button" className="pf-btn" disabled={busy || loading} onClick={() => void startAi()}>
              {busy ? "Starting…" : loading ? "Loading cards…" : "Start the match ▸"}
            </button>
          ) : host ? (
            <>
              <button
                type="button"
                className="pf-btn"
                disabled={!canHostStart}
                onClick={() => {
                  setError(null);
                  setMatchKey(crypto.randomUUID().slice(0, 8));
                }}
              >
                {matchKey ? "Opening the game…" : "Start the match ▸"}
              </button>
              {!matchKey && (
                <span className="pf-hint">
                  {friendsReady}/{friendSeats} friends ready{aiIdx.length ? ` · ${aiIdx.length} AI` : ""}
                </span>
              )}
              {matchKey && (
                <>
                  <span className="pf-hint-pulse">{auto.waiting}</span>
                  <button type="button" className={auto.stuck ? "pf-btn small" : "pf-btn-mini"} onClick={auto.restart}>
                    ⟳ Open a new game room
                  </button>
                  <button
                    type="button"
                    className="pf-btn-mini"
                    onClick={() => {
                      useMultiplayerStore.getState().cancelHosting();
                      setMatchKey(null);
                    }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </>
          ) : inRoom ? (
            <span className="pf-hint-pulse">{youReady ? "Waiting for the host to start…" : "Paste your list to get ready."}</span>
          ) : null}
        </div>
        {error && (
          <div className="pf-error" style={{ marginTop: "1rem" }} onClick={() => setError(null)} role="button" tabIndex={0}>
            {error}
          </div>
        )}
      </div>
    );

  return (
    <div className="pf-root">
      <div className="pf-topbar">
        <button type="button" className="pf-btn-mini" onClick={() => navigate("/")}>
          ◂ Modes
        </button>
        <div className="pf-brand">
          Test match
          <small>Pay the 1 pt1</small>
        </div>
      </div>
      <div className="pf-main">{body}</div>
      <RoomToasts />
    </div>
  );
}
