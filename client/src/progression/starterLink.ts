// Starter vs a friend: a small peer-to-peer channel used outside the match, so
// the booster grid stays in sync (one player picks, the other sees it at once).
//
// Both devices know the run id (it travels in the save code) and their seat, so
// no room code is needed: each registers `rogueforge1-<run>-<seat>` on the
// PeerJS signaling server and keeps dialing the other seat until a connection
// opens. Messages carry the whole list of picks, so a late or repeated message
// is harmless (the receiver only adds what it is missing).

export interface LinkPick {
  i: number;
  slot: number;
  round: number | null;
}

export interface LinkState {
  run: string;
  game: number;
  picks: LinkPick[];
}

export type LinkStatus = "connecting" | "connected";

/** The bits of a PeerJS Peer / DataConnection this module uses. */
export interface LinkConn {
  open: boolean;
  on(event: string, handler: (...args: never[]) => void): unknown;
  send(data: unknown): void;
  close(): void;
}
export interface LinkPeer {
  destroyed: boolean;
  on(event: string, handler: (...args: never[]) => void): unknown;
  connect(id: string, options: { reliable: boolean; serialization?: string }): LinkConn;
  reconnect?: () => void;
  destroy(): void;
}

export interface LinkOptions {
  runId: string;
  me: 0 | 1;
  createPeer: (id: string | undefined, config: RTCConfiguration) => LinkPeer;
  iceConfig: () => Promise<RTCConfiguration>;
  onState: (state: LinkState) => void;
  onStatus: (status: LinkStatus) => void;
}

export interface StarterLink {
  send(state: LinkState): void;
  close(): void;
}

const FALLBACK_ICE: RTCConfiguration = { iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }, { urls: "stun:stun.l.google.com:19302" }] };
const REDIAL_MS = 3000;

export function openStarterLink(o: LinkOptions): StarterLink {
  const tag = o.runId.replace(/[^A-Za-z0-9]/g, "").slice(0, 32);
  const myId = `rogueforge1-${tag}-${o.me}`;
  const otherId = `rogueforge1-${tag}-${1 - o.me}`;
  let closed = false;
  let peer: LinkPeer | null = null;
  let pending: LinkConn | null = null;
  let last: string | null = null;
  let timer = 0;
  let idTries = 0;
  const conns = new Set<LinkConn>();
  const isOpen = () => [...conns].some((c) => c.open);
  const status = () => o.onStatus(isOpen() ? "connected" : "connecting");

  const attach = (c: LinkConn) => {
    c.on("open", () => {
      conns.add(c);
      if (pending === c) pending = null;
      status();
      if (last) c.send(last);
    });
    c.on("data", (raw: never) => {
      try {
        const msg = (typeof raw === "string" ? JSON.parse(raw) : raw) as LinkState | null;
        if (msg && msg.run === o.runId && Array.isArray(msg.picks)) o.onState(msg);
      } catch {
        // not ours
      }
    });
    const drop = () => {
      conns.delete(c);
      if (pending === c) pending = null;
      if (!closed) status();
    };
    c.on("close", drop);
    c.on("error", drop);
  };

  const dial = () => {
    if (closed || !peer || peer.destroyed || isOpen()) return;
    try {
      pending?.close();
    } catch {
      // ignore
    }
    try {
      pending = peer.connect(otherId, { reliable: true });
      attach(pending);
    } catch {
      pending = null;
    }
  };

  const start = (config: RTCConfiguration, fixedId: boolean) => {
    if (closed) return;
    const p = o.createPeer(fixedId ? myId : undefined, config);
    peer = p;
    p.on("open", () => dial());
    p.on("connection", (c: never) => attach(c as LinkConn));
    p.on("error", (e: never) => {
      const type = (e as { type?: string } | null)?.type;
      if (type === "unavailable-id" && fixedId) {
        // A previous tab of ours may still hold the id for a few seconds.
        p.destroy();
        idTries += 1;
        window.setTimeout(() => start(config, idTries < 4), 2500);
      }
      // "peer-unavailable": the other device is not on this screen yet; we redial.
    });
    p.on("disconnected", () => {
      try {
        if (!closed && !p.destroyed) p.reconnect?.();
      } catch {
        // ignore
      }
    });
  };

  status();
  void o
    .iceConfig()
    .catch(() => FALLBACK_ICE)
    .then((config) => {
      if (closed) return;
      start(config, true);
      timer = window.setInterval(dial, REDIAL_MS);
    });

  return {
    send(state) {
      last = JSON.stringify(state);
      for (const c of conns) {
        if (!c.open) continue;
        try {
          c.send(last);
        } catch {
          // dropped; it is resent on the next change or reconnect
        }
      }
    },
    close() {
      closed = true;
      window.clearInterval(timer);
      for (const c of conns) {
        try {
          c.close();
        } catch {
          // ignore
        }
      }
      try {
        pending?.close();
        peer?.destroy();
      } catch {
        // ignore
      }
    },
  };
}
