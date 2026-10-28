# Rogue Forge MatchLab

A one-screen test bench on top of phase.rs, open at **`/lab`**:

- **Vs AI** — paste your list and the opponent's (or pick a test deck for either side), choose AI difficulty,
  format, starting life and who starts, press **Start match**.
- **Vs a friend (online)** — each player opens `/lab` on their own device and pastes their own deck.
  One presses **Create room** and reads out the 5-character code; the other types it and presses **Join room**.
  Peer-to-peer (PeerJS) like the rest of phase.rs: no game server of yours is involved.

The match itself is the stock phase.rs board, rules engine and AI.

Files: `client/src/pages/MatchLabPage.tsx` · `deploy/matchlab/{.htaccess,turn.json}` ·
`scripts/build-matchlab-site.sh` · `.github/workflows/matchlab-pages.yml` · `Dockerfile.matchlab`

## Hosting on your own domain

The build output is a plain static folder (HTML, JS, WASM, JSON). Upload **the contents of the folder** to the
**document root of a domain or subdomain** — for example create `mtg.tuodominio.it` in the hosting panel and point it
to its own folder. It must be the root: the app does not work from a sub-path like `tuodominio.it/mtg/`.

- `.htaccess` (included) does the Apache/LiteSpeed work: routes `/lab`, `/game/…` to `index.html`, serves `.wasm` as
  `application/wasm`, compresses the card JSON, sets caching. On nginx use `try_files $uri /index.html;` and add the
  `application/wasm` type.
- HTTPS is required (browsers only allow WebAssembly workers, storage and WebRTC on secure origins) — turn on the free
  Let's Encrypt certificate in the hosting panel.
- `turn.json` lists the STUN/TURN relays for friend games (the same free relays Serata Chill uses), so players on
  mobile data or school/office Wi-Fi can still connect.

## Building the folder

Pick one:

1. **GitHub Actions (nothing to install).** Push this branch to any GitHub repository (a fork of phase-rs/phase),
   run **Actions → MatchLab site build**, then download the **matchlab-site** artifact (a ZIP). GitHub only compiles;
   nothing is published there.
2. **Docker on your PC.** `docker build -f Dockerfile.matchlab --output type=local,dest=matchlab-site .`
3. **Native toolchain.** Rust (rustup), `wasm-bindgen-cli@0.2.121`, Node 22, pnpm 9, jq, curl, then
   `./scripts/build-matchlab-site.sh`.

All three run the same script and produce the same folder.

## Deep link (hand a battle over from the roguelike)

```
/lab#you=<b64url decklist>&opp=<b64url decklist>&life=20&ai=Medium&format=Freeform&first=play&auto=1
```

All keys optional. `ai` = VeryEasy | Easy | Medium | Hard | VeryHard. `first` = random | play | draw.
`auto=1` starts the AI match as soon as the card database has loaded. Encoder for the roguelike page:

```js
function matchlabLink(base, youList, oppList, opts = {}) {
  const enc = (text) => {
    const bytes = new TextEncoder().encode(text);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const p = new URLSearchParams({ you: enc(youList), opp: enc(oppList) });
  for (const [k, v] of Object.entries(opts)) p.set(k, String(v));
  return `${base.replace(/\/$/, "")}/lab#${p}`;
}
// window.open(matchlabLink("https://mtg.tuodominio.it", myDeckText, bossDeckText, { life: 30, ai: "Hard", auto: 1 }));
```

Licence: phase.rs is MIT / Apache-2.0 — keep `LICENSE-*` and `NOTICE` in the repository.
