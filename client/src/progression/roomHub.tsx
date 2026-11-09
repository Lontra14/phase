// Test match rooms for up to 4 players: the host's device is the hub, every
// friend's device connects to it with the room code (PeerJS, no server). The
// host keeps the lobby (who is in, with which deck) and sends it to everyone;
// the friends send their name and whether their list is ready. Messages are
// whole states, so a reconnect or a reload simply sends them again.
//   friend → host  {k:"me", id, name, deck, commander}
//   host → all     {k:"lobby", players:[…]}  {k:"match", key, code}  (+ any other kind)
//   friend → all   any message with fwd:true is passed on by the host to the
//                  other friends (Starter: each player's booster picks)
// The returned state has the same shape as useRoom's, so useAutoMatchRoom and
// RoomPanel work with it unchanged.

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchFreshTurnConfig } from "../network/connection";
import { createPeer } from "../network/transport";
import { rememberLobbyOpponent } from "./cosmeticsLink";
import type { SharedCosmetics } from "./cosmetics";
import { sharedCosmetics } from "./cosmetics";
import type { Room, RoomMe, RoomMode, RoomState } from "./room";
import { loadRoom } from "./room";
import type { LinkConn, LinkPeer, LinkStatus } from "./starterLink";

export interface HubPlayer extends RoomMe {
  id: string;
}

const FALLBACK_ICE: RTCConfiguration = { iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }, { urls: "stun:stun.l.google.com:19302" }] };
const hostId = (mode: RoomMode, code: string) => (mode === "test" ? `pt1hub1-${code}-host` : `pt1hub1-${mode}-${code}-host`);

function myHubId(): string {
  try {
    let id = sessionStorage.getItem("pt1-hub-id");
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem("pt1-hub-id", id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

export interface HubState extends RoomState {
  /** Everyone in the room, the host first (as the host last told it). */
  players: HubPlayer[];
  /** This device's id in the room ("host" for the host). */
  myId: string;
}

export function useRoomHub(mode: RoomMode, me: RoomMe | null): HubState {
  const [room, setRoom] = useState<Room | null>(() => loadRoom(mode));
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [latest, setLatest] = useState<Record<string, Record<string, unknown>>>({});
  const [guests, setGuests] = useState<HubPlayer[]>([]);
  const sendRef = useRef<(m: Record<string, unknown>) => void>(() => {});
  const meRef = useRef<RoomMe | null>(me);
  meRef.current = me;
  const meJson = me ? JSON.stringify(me) : "";
  const id = useRef(myHubId()).current;

  useEffect(() => {
    setLatest({});
    setGuests([]);
    setStatus(null);
    if (!room) return;
    let closed = false;
    let peer: LinkPeer | null = null;
    let timer = 0;
    const conns = new Map<LinkConn, string>();
    const sticky = new Map<string, Record<string, unknown>>();
    const players = new Map<string, HubPlayer>();
    const raw = (c: LinkConn, m: unknown) => {
      try {
        if (c.open) c.send(JSON.stringify(m));
      } catch {
        // sent again on the next connection
      }
    };
    const meMsg = (): Record<string, unknown> => ({ k: "me", id, ...(meRef.current ?? { name: "Player" }), cos: sharedCosmetics() });

    if (room.role === "host") {
      const lobby = () => {
        const list = [{ ...(meMsg() as unknown as HubPlayer), id: "host" }, ...players.values()];
        const msg = { k: "lobby", players: list.map(({ id: pid, name, deck, commander, custom }) => ({ id: pid, name, deck, commander, custom })) };
        sticky.set("lobby", msg);
        for (const c of conns.keys()) raw(c, msg);
        setGuests([...players.values()]);
      };
      sendRef.current = (m) => {
        if (typeof m.k === "string") sticky.set(m.k, m);
        for (const c of conns.keys()) raw(c, m);
        if (m.k === "me") lobby();
      };
      const attach = (c: LinkConn) => {
        c.on("open", () => {
          conns.set(c, "");
          for (const m of sticky.values()) raw(c, m);
          setStatus("connected");
        });
        c.on("data", (d: never) => {
          try {
            const m = JSON.parse(String(d)) as Record<string, unknown>;
            if (m.k === "me" && typeof m.id === "string") {
              conns.set(c, m.id);
              players.set(m.id, { id: m.id, name: String(m.name ?? "Player"), deck: (m.deck as string | null) ?? null, commander: !!m.commander, custom: m.custom });
              if (m.cos) rememberLobbyOpponent(m.cos as SharedCosmetics);
              lobby();
            }
            if (typeof m.k === "string") setLatest((prev) => ({ ...prev, [m.k as string]: m }));
            // A friend's message for everyone: passed on (and kept for whoever connects later).
            if (m.fwd === true && typeof m.k === "string") {
              sticky.set(m.k, m);
              for (const other of conns.keys()) if (other !== c) raw(other, m);
            }
          } catch {
            // not ours
          }
        });
        const drop = () => {
          const pid = conns.get(c);
          conns.delete(c);
          if (pid && ![...conns.values()].includes(pid)) {
            players.delete(pid);
            lobby();
          }
          if (!conns.size) setStatus("connecting");
        };
        c.on("close", drop);
        c.on("error", drop);
      };
      const start = (config: RTCConfiguration, tries: number) => {
        if (closed) return;
        const p = createPeer(hostId(mode, room.code), { config }) as unknown as LinkPeer;
        peer = p;
        p.on("open", () => {
          setStatus(conns.size ? "connected" : "connecting");
          lobby();
        });
        p.on("connection", (c: never) => attach(c as LinkConn));
        p.on("error", (e: never) => {
          if ((e as { type?: string } | null)?.type === "unavailable-id" && tries < 6) {
            p.destroy();
            window.setTimeout(() => start(config, tries + 1), 2500);
          }
        });
        p.on("disconnected", () => {
          try {
            if (!closed && !p.destroyed) p.reconnect?.();
          } catch {
            // ignore
          }
        });
      };
      setStatus("connecting");
      void fetchFreshTurnConfig()
        .catch(() => FALLBACK_ICE)
        .then((config) => start(config, 0));
    } else {
      let conn: LinkConn | null = null;
      sendRef.current = (m) => {
        if (conn) raw(conn, m);
      };
      const dial = () => {
        if (closed || !peer || peer.destroyed || (conn && conn.open)) return;
        try {
          conn?.close();
        } catch {
          // ignore
        }
        const c = peer.connect(hostId(mode, room.code), { reliable: true });
        conn = c;
        c.on("open", () => {
          setStatus("connected");
          raw(c, meMsg());
        });
        c.on("data", (d: never) => {
          try {
            const m = JSON.parse(String(d)) as Record<string, unknown>;
            if (typeof m.k !== "string") return;
            if (m.k === "me" && m.cos) rememberLobbyOpponent(m.cos as SharedCosmetics);
            setLatest((prev) => ({ ...prev, [m.k as string]: m }));
          } catch {
            // not ours
          }
        });
        const drop = () => {
          if (conn === c) setStatus("connecting");
        };
        c.on("close", drop);
        c.on("error", drop);
      };
      setStatus("connecting");
      void fetchFreshTurnConfig()
        .catch(() => FALLBACK_ICE)
        .then((config) => {
          if (closed) return;
          const p = createPeer(undefined, { config }) as unknown as LinkPeer;
          peer = p;
          p.on("open", () => dial());
          p.on("disconnected", () => {
            try {
              if (!closed && !p.destroyed) p.reconnect?.();
            } catch {
              // ignore
            }
          });
          timer = window.setInterval(dial, 3000);
        });
    }
    return () => {
      closed = true;
      window.clearInterval(timer);
      for (const c of conns.keys()) {
        try {
          c.close();
        } catch {
          // ignore
        }
      }
      try {
        peer?.destroy();
      } catch {
        // ignore
      }
      sendRef.current = () => {};
    };
  }, [room, id, mode]);

  // My name / deck: sent again whenever it changes.
  useEffect(() => {
    if (!room || !meJson) return;
    sendRef.current({ k: "me", id, ...(JSON.parse(meJson) as RoomMe), cos: sharedCosmetics() });
  }, [room, meJson, id, status]);

  const send = useCallback((m: Record<string, unknown>) => sendRef.current(m), []);
  const open = useCallback((r: Room | null) => {
    try {
      if (r) localStorage.setItem(`pt1-room-${mode}`, JSON.stringify(r));
      else localStorage.removeItem(`pt1-room-${mode}`);
    } catch {
      // ignore
    }
    setRoom(r);
  }, [mode]);

  const lobby = (latest.lobby as { players?: HubPlayer[] } | undefined)?.players;
  const players: HubPlayer[] =
    room?.role === "host" ? [{ id: "host", ...(me ?? { name: "Player" }) }, ...guests] : (lobby ?? []);
  const peer: RoomMe | null = room?.role === "host" ? (guests[0] ?? null) : (players.find((p) => p.id === "host") ?? null);
  return { room, status, peer, latest, send, open, players, myId: room?.role === "host" ? "host" : id };
}
