// Chess vs a friend: the minigame runs on both devices in lockstep and only the
// players' inputs travel. This is an ordered, resendable message channel over
// PeerJS: each side numbers its messages and resends the whole log whenever a
// connection (re)opens; the receiver drops what it already applied.

import type { LinkPeer, LinkStatus } from "../progression/starterLink";

export interface ChessLinkOptions {
  runId: string;
  /** Separates the links of different minigames of the same run. */
  channel: string;
  me: 0 | 1;
  createPeer: (id: string | undefined, config: RTCConfiguration) => LinkPeer;
  iceConfig: () => Promise<RTCConfiguration>;
  onMessage: (msg: unknown) => void;
  onStatus: (status: LinkStatus) => void;
}

export interface ChessLink {
  send(msg: unknown): void;
  close(): void;
}

type Conn = ReturnType<LinkPeer["connect"]>;
const FALLBACK_ICE: RTCConfiguration = { iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }, { urls: "stun:stun.l.google.com:19302" }] };

export function openChessLink(o: ChessLinkOptions): ChessLink {
  const tag = (o.runId + o.channel).replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
  const myId = `rogueforgechess1-${tag}-${o.me}`;
  const otherId = `rogueforgechess1-${tag}-${1 - o.me}`;
  const sent: string[] = [];
  let received = 0;
  // Each opening of the link is a new session: when the other side reloads, its
  // numbering restarts and this side starts counting again from zero.
  const sid = Math.random().toString(36).slice(2, 10);
  let otherSid: string | null = null;
  let closed = false;
  let peer: LinkPeer | null = null;
  let pending: Conn | null = null;
  let timer = 0;
  let idTries = 0;
  const conns = new Set<Conn>();
  const isOpen = () => [...conns].some((c) => c.open);
  const status = () => o.onStatus(isOpen() ? "connected" : "connecting");
  const sendAll = (c: Conn) => {
    for (const m of sent) {
      try {
        c.send(m);
      } catch {
        // resent on the next connection
      }
    }
  };
  const attach = (c: Conn) => {
    c.on("open", () => {
      conns.add(c);
      if (pending === c) pending = null;
      status();
      sendAll(c);
    });
    c.on("data", (raw: never) => {
      try {
        const env = JSON.parse(String(raw)) as { s?: number; d?: unknown; r?: number; n?: string };
        if (typeof env.n === "string" && env.n !== otherSid) {
          otherSid = env.n;
          received = 0;
        }
        // The other side missed something: send the whole log again.
        if (typeof env.r === "number") {
          sendAll(c);
          return;
        }
        if (typeof env.s !== "number" || env.s < received) return; // duplicate
        if (env.s > received) {
          // A gap (a message sent before this side's channel was open): ask for a resend.
          try {
            c.send(JSON.stringify({ r: received, n: sid }));
          } catch {
            // the next connection resends anyway
          }
          return;
        }
        received += 1;
        o.onMessage(env.d);
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
    p.on("connection", (c: never) => attach(c as Conn));
    p.on("error", (e: never) => {
      const type = (e as { type?: string } | null)?.type;
      if (type === "unavailable-id" && fixedId) {
        p.destroy();
        idTries += 1;
        window.setTimeout(() => start(config, idTries < 4), 2500);
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
  status();
  void o
    .iceConfig()
    .catch(() => FALLBACK_ICE)
    .then((config) => {
      if (closed) return;
      start(config, true);
      timer = window.setInterval(dial, 3000);
    });
  return {
    send(msg) {
      const env = JSON.stringify({ s: sent.length, d: msg, n: sid });
      sent.push(env);
      for (const c of conns) {
        if (!c.open) continue;
        try {
          c.send(env);
        } catch {
          // resent on reconnect
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
