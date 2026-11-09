// Mode rooms (vs a friend): one room per mode, opened before anything is chosen.
// The host creates it and reads out a 5-character code, the friend joins with it.
// The room is a small peer-to-peer channel (chessLink: ordered, resent after a
// reconnect or a reload) that carries everything the two devices must share
// outside the game itself:
//   {k:"me", name, deck?, cos}  each player's name, chosen deck and cosmetics
//   {k:"run", run}              the host started the run (the guest takes seat 2)
//   {k:"match", key, code}      the host opened the game room for this match:
//                               the guest joins it by itself
// The room stays open (localStorage "pt1-room-<mode>") until a player leaves it.

import { useCallback, useEffect, useRef, useState } from "react";

import { openChessLink } from "../chess/chessLink";
import { fetchFreshTurnConfig, parseRoomCode } from "../network/connection";
import { createPeer } from "../network/transport";
import { useMultiplayerStore } from "../stores/multiplayerStore";
import type { SharedCosmetics } from "./cosmetics";
import { sharedCosmetics } from "./cosmetics";
import { rememberLobbyOpponent } from "./cosmeticsLink";
import type { LinkPeer, LinkStatus } from "./starterLink";

export type RoomMode = "chess" | "starter" | "progression" | "test";
export interface Room {
  mode: RoomMode;
  code: string;
  role: "host" | "guest";
}
export interface RoomMe {
  name: string;
  deck?: string | null;
  cos?: SharedCosmetics;
  /** An imported list (deckImport): the deck itself travels, the other device has no copy. */
  custom?: unknown;
  /** Test match: the rules this player chose (Commander or not). */
  commander?: boolean;
}
export interface RoomState {
  room: Room | null;
  status: LinkStatus | null;
  /** The other player's latest "me" message. */
  peer: RoomMe | null;
  /** Latest message of each kind received from the other player. */
  latest: Record<string, Record<string, unknown>>;
  send: (msg: Record<string, unknown>) => void;
  open: (room: Room | null) => void;
}

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newRoomCode(): string {
  const a = new Uint32Array(5);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => ALPHABET[x % ALPHABET.length]).join("");
}

const key = (mode: RoomMode) => `pt1-room-${mode}`;
export function loadRoom(mode: RoomMode): Room | null {
  try {
    const r = JSON.parse(localStorage.getItem(key(mode)) ?? "null") as Room | null;
    if (r && r.mode === mode && parseRoomCode(r.code) && (r.role === "host" || r.role === "guest")) return r;
  } catch {
    // ignore
  }
  return null;
}
function saveRoom(mode: RoomMode, r: Room | null): void {
  try {
    if (r) localStorage.setItem(key(mode), JSON.stringify(r));
    else localStorage.removeItem(key(mode));
  } catch {
    // ignore
  }
}

/** The room of a mode: open while `room` is set; `me` is re-sent whenever it changes. */
export function useRoom(mode: RoomMode, me: RoomMe | null): RoomState {
  const [room, setRoom] = useState<Room | null>(() => loadRoom(mode));
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [latest, setLatest] = useState<Record<string, Record<string, unknown>>>({});
  const linkRef = useRef<ReturnType<typeof openChessLink> | null>(null);
  const meJson = me ? JSON.stringify(me) : "";
  const lastMe = useRef("");

  useEffect(() => {
    setLatest({});
    setStatus(null);
    lastMe.current = "";
    if (!room) return;
    const link = openChessLink({
      runId: `room${room.mode}${room.code}`,
      channel: "L",
      me: room.role === "host" ? 0 : 1,
      createPeer: (id, config) => createPeer(id, { config }) as unknown as LinkPeer,
      iceConfig: () => fetchFreshTurnConfig(),
      onMessage: (m) => {
        const msg = m as Record<string, unknown> | null;
        if (!msg || typeof msg.k !== "string") return;
        if (msg.k === "me" && msg.cos) rememberLobbyOpponent(msg.cos as SharedCosmetics);
        setLatest((prev) => ({ ...prev, [msg.k as string]: msg }));
      },
      onStatus: setStatus,
    });
    linkRef.current = link;
    return () => {
      link.close();
      linkRef.current = null;
    };
  }, [room]);

  // My name / deck / cosmetics: sent when the room opens and whenever they change.
  useEffect(() => {
    if (!room || !meJson || meJson === lastMe.current || !linkRef.current) return;
    lastMe.current = meJson;
    linkRef.current.send({ k: "me", ...(JSON.parse(meJson) as RoomMe), cos: sharedCosmetics() });
  }, [room, meJson]);
  useEffect(() => {
    const on = () => {
      if (!linkRef.current || !meJson) return;
      linkRef.current.send({ k: "me", ...(JSON.parse(meJson) as RoomMe), cos: sharedCosmetics() });
    };
    window.addEventListener("rf-cosmetics-mine", on);
    return () => window.removeEventListener("rf-cosmetics-mine", on);
  }, [meJson]);

  const send = useCallback((msg: Record<string, unknown>) => linkRef.current?.send(msg), []);
  const open = useCallback(
    (r: Room | null) => {
      saveRoom(mode, r);
      setRoom(r);
    },
    [mode],
  );
  return { room, status, peer: (latest.me as unknown as RoomMe) ?? null, latest, send, open };
}

/** Create / join / leave the room, with the connection status. */
export function RoomPanel({ state, mode, peerLabel = "your friend", hint }: { state: RoomState; mode: RoomMode; peerLabel?: string; hint?: string }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const { room, status, peer } = state;
  if (!room) {
    return (
      <div className="pf-panel pf-room">
        <div className="pf-room-head">
          <b>Room</b>
          <span className="pf-hint">Open a room first: then choose decks and settings together.</span>
        </div>
        <div className="pf-room-row">
          <button type="button" className="pf-btn small" onClick={() => state.open({ mode, code: newRoomCode(), role: "host" })}>
            Create a room
          </button>
          <span className="pf-hint">or</span>
          <input
            value={code}
            maxLength={5}
            placeholder="CODE"
            style={{ width: 120, textTransform: "uppercase", letterSpacing: "0.3em", fontFamily: "Cinzel" }}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setErr(null);
            }}
          />
          <button
            type="button"
            className="pf-btn secondary small"
            onClick={() => {
              const c = parseRoomCode(code);
              if (!c) {
                setErr("Enter the 5-character code your friend sees.");
                return;
              }
              state.open({ mode, code: c, role: "guest" });
            }}
          >
            Join ▸
          </button>
        </div>
        {err && <div className="pf-error">{err}</div>}
      </div>
    );
  }
  const linked = status === "connected";
  return (
    <div className="pf-panel pf-room">
      <div className="pf-room-row">
        <span className="pf-hint">Room</span>
        <button type="button" className="pf-code pf-code-sm" title="Copy the code" onClick={() => void navigator.clipboard?.writeText(room.code).catch(() => {})}>
          {room.code}
        </button>
        <span className={`pf-room-dot${linked ? " on" : ""}`} />
        <span>
          {linked
            ? `Linked with ${peer?.name || peerLabel}`
            : room.role === "host"
              ? `Tell ${peerLabel} this code: they join with it.`
              : `Connecting to the room… (${peerLabel} must have it open)`}
        </span>
        <button type="button" className="pf-btn-mini" style={{ marginLeft: "auto" }} onClick={() => state.open(null)}>
          Leave room
        </button>
      </div>
      {hint && <p className="pf-hint" style={{ margin: "0.4rem 0 0" }}>{hint}</p>}
    </div>
  );
}

const TRIED_KEY = "pt1-joined";
function triedCodes(): string[] {
  try {
    return (sessionStorage.getItem(TRIED_KEY) ?? "").split(" ").filter(Boolean);
  } catch {
    return [];
  }
}
function rememberTried(id: string): void {
  try {
    sessionStorage.setItem(TRIED_KEY, [...triedCodes(), id].slice(-20).join(" "));
  } catch {
    // ignore
  }
}

/**
 * The game room of one match, opened by itself: the host hosts the phase.rs P2P
 * game and sends its code over the mode room once the room is really waiting;
 * the guest joins it a moment after it arrives (the same pause a person typing
 * the code used to give). `matchKey` names the match (run id + match number).
 * `restart()` (host) closes the game room and opens a new one; `retry()` (guest)
 * joins the last code again.
 */
export function useAutoMatchRoom(opts: {
  state: RoomState;
  matchKey: string;
  enabled: boolean;
  host: () => Promise<unknown>;
  join: (code: string) => Promise<unknown>;
  onError: (e: string) => void;
  /**
   * Tables of 3-4 (Starter, Progression): the guest's place among the friends
   * (1 = first friend). Friends enter the game one after the other, in this
   * order, so each one gets the same seat in the game as in the run.
   */
  seat?: number;
}): { waiting: string; restart: () => void; retry: () => void; stuck: boolean } {
  const { state, matchKey, enabled } = opts;
  const hostingStatus = useMultiplayerStore((s) => s.hostingStatus);
  const hostGameCode = useMultiplayerStore((s) => s.hostGameCode);
  const joinedGuests = useMultiplayerStore((s) => (s.playerSlots ?? []).filter((p: { kind?: { type?: string } }) => p?.kind?.type === "JoinedHuman").length);
  const [round, setRound] = useState(0);
  const [stuck, setStuck] = useState(false);
  const started = useRef<string>("");
  const sentCode = useRef<string>("");
  const joined = useRef<string>("");
  const fns = useRef(opts);
  fns.current = opts;
  const role = state.room?.role;
  const send = state.send;
  const runKey = `${matchKey}#${round}`;

  // Host: open the game room once per match (and per restart).
  useEffect(() => {
    if (!enabled || role !== "host" || hostingStatus !== "idle" || started.current === runKey) return;
    started.current = runKey;
    setStuck(false);
    fns.current.host().catch((e: unknown) => {
      started.current = "";
      fns.current.onError(e instanceof Error ? e.message : String(e));
    });
  }, [enabled, role, hostingStatus, runKey]);
  // Host: send the code once the room is waiting for the guest.
  useEffect(() => {
    if (!enabled || role !== "host" || hostingStatus !== "waiting" || !hostGameCode) return;
    const id = `${matchKey}:${hostGameCode}`;
    if (sentCode.current === id) return;
    const t = window.setTimeout(() => {
      sentCode.current = id;
      send({ k: "match", key: matchKey, code: hostGameCode });
    }, 1200);
    return () => window.clearTimeout(t);
  }, [enabled, role, hostingStatus, hostGameCode, matchKey, send]);
  // Host: how many friends are already in the game room (the next one enters after them).
  useEffect(() => {
    if (!enabled || role !== "host" || hostingStatus !== "waiting" || !hostGameCode) return;
    send({ k: "seated", key: matchKey, code: hostGameCode, n: joinedGuests });
  }, [enabled, role, hostingStatus, hostGameCode, matchKey, send, joinedGuests]);
  // Host: still waiting long after the code went out (the friend is stuck): offer a restart.
  useEffect(() => {
    if (role !== "host" || hostingStatus !== "waiting" || !hostGameCode) {
      setStuck(false);
      return;
    }
    const t = window.setTimeout(() => setStuck(true), 25000);
    return () => window.clearTimeout(t);
  }, [role, hostingStatus, hostGameCode]);
  // Guest: join the code of this match, after a short pause.
  const m = state.latest.match as { key?: string; code?: string } | undefined;
  const mKey = m?.key;
  const mCode = m?.code;
  const seated = state.latest.seated as { key?: string; code?: string; n?: number } | undefined;
  const myTurn = !opts.seat || opts.seat <= 1 || (seated?.key === mKey && seated?.code === mCode && (seated?.n ?? 0) >= opts.seat - 1);
  useEffect(() => {
    if (!enabled || role !== "guest" || !mKey || mKey !== matchKey || !mCode || !myTurn) return;
    const id = `${mKey}:${mCode}`;
    // A code is joined by itself only once, also after coming back from the game
    // page (a failed game would otherwise send the guest back in, in a loop).
    if (joined.current === id || triedCodes().includes(id)) {
      joined.current = id;
      return;
    }
    const t = window.setTimeout(() => {
      joined.current = id;
      rememberTried(id);
      fns.current.join(mCode).catch((e: unknown) => {
        joined.current = "";
        fns.current.onError(e instanceof Error ? e.message : String(e));
      });
    }, 1500);
    return () => window.clearTimeout(t);
  }, [enabled, role, mKey, mCode, matchKey, round, myTurn]);

  const restart = () => {
    if (hostingStatus !== "idle") useMultiplayerStore.getState().cancelHosting();
    sentCode.current = "";
    setRound((r) => r + 1);
  };
  const retry = () => {
    joined.current = "";
    try {
      sessionStorage.removeItem(TRIED_KEY);
    } catch {
      // ignore
    }
    setRound((r) => r + 1);
  };

  if (!enabled || !state.room) return { waiting: "", restart, retry, stuck: false };
  if (role === "host")
    return {
      waiting:
        hostingStatus === "waiting" && hostGameCode
          ? "Game room open: the game starts as soon as your friend joins it."
          : "Opening the game room…",
      restart,
      retry,
      stuck,
    };
  return {
    waiting: m && m.key === matchKey ? (myTurn ? "Joining the game…" : "Waiting for the friends before you to enter the game…") : "Waiting for the host to open the game room…",
    restart,
    retry,
    stuck: false,
  };
}

/** Messages of the online play (errors, the room did not open…), on the mode pages too. */
export function RoomToasts() {
  const toasts = useMultiplayerStore((s) => s.toasts);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!toasts?.size) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [toasts]);
  const live = toasts ? [...toasts.entries()].filter(([, t]) => t.expiresAt > now) : [];
  if (!live.length) return null;
  return (
    <>
      {live.map(([k, t]) => (
        <div key={k} className="pf-toast" role="status" onClick={() => useMultiplayerStore.getState().clearToast(k)}>
          {t.message}
        </div>
      ))}
    </>
  );
}
