// Rogue Forge cosmetics: the card back each player chooses (every mode, the Chess
// minigame too) and the basic land arts (localStorage "rogue-forge-land-art",
// picked in the deck builder). Each player sees their own choices on their cards
// and the opponent's choices on the opponent's cards: in online games the two
// devices swap them at the start (cosmeticsLink.ts); the in-game swap of images
// is done by public/rogue-forge-patch.js.

export const COSMETICS_KEY = "rogue-forge-cosmetics";
export const LAND_ART_KEY = "rogue-forge-land-art";
/** Scryfall's classic Magic card back (the one phase.rs draws by default). */
export const CLASSIC_BACK = "https://backs.scryfall.io/normal/0/a/0aeebaf5-8c7d-4636-9e82-8c27447861f7.jpg";

export interface CardBackChoice {
  /** "classic", one of the preset ids, or "custom" (a drawn image). */
  id: string;
  /** Custom drawings: a small JPEG data URL. */
  img?: string;
}

export interface Cosmetics {
  back: CardBackChoice;
}

export interface SharedCosmetics {
  /** Image URL of the card back (data URL for presets and drawings). */
  back: string | null;
  /** Basic land arts: { Plains: printing id (with dashes) }. */
  lands: Record<string, string>;
}

const svg = (body: string, bg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="488" height="680" viewBox="0 0 488 680"><defs><clipPath id="c"><rect x="0" y="0" width="488" height="680" rx="26"/></clipPath></defs><g clip-path="url(#c)"><rect width="488" height="680" fill="${bg}"/>${body}</g><rect x="14" y="14" width="460" height="652" rx="18" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="10"/><rect x="22" y="22" width="444" height="636" rx="14" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="3"/></svg>`,
  )}`;

function rays(n: number, colors: string[]): string {
  let out = "";
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 0.5) / n) * Math.PI * 2;
    const p = (a: number) => `${244 + Math.cos(a) * 700},${340 + Math.sin(a) * 700}`;
    out += `<polygon points="244,340 ${p(a0)} ${p(a1)}" fill="${colors[i % colors.length]}"/>`;
  }
  return out;
}
function grid(step: number, draw: (x: number, y: number, k: number) => string): string {
  let out = "";
  let k = 0;
  for (let y = -step; y < 680 + step; y += step) for (let x = -step; x < 488 + step; x += step) out += draw(x, y, k++);
  return out;
}

export interface BackPreset {
  id: string;
  name: string;
  url: string;
}

export const BACK_PRESETS: BackPreset[] = [
  { id: "classic", name: "Classic", url: CLASSIC_BACK },
  {
    id: "forge",
    name: "Forge",
    url: svg(
      `<radialGradient id="g" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#6a4a1c"/><stop offset=".45" stop-color="#3a2410"/><stop offset="1" stop-color="#140d07"/></radialGradient><rect width="488" height="680" fill="url(#g)"/><circle cx="244" cy="320" r="118" fill="none" stroke="#e9cf8f" stroke-opacity=".7" stroke-width="26" stroke-dasharray="74 18"/><circle cx="244" cy="320" r="78" fill="#2b1d0c" stroke="#c9a24b" stroke-width="6"/><text x="244" y="346" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="96" fill="#e9cf8f">1</text>`,
      "#1a1209",
    ),
  },
  {
    id: "nebula",
    name: "Nebula",
    url: svg(
      `<radialGradient id="a" cx="30%" cy="30%" r="60%"><stop offset="0" stop-color="#b24bf3" stop-opacity=".9"/><stop offset="1" stop-color="#b24bf3" stop-opacity="0"/></radialGradient><radialGradient id="b" cx="72%" cy="68%" r="60%"><stop offset="0" stop-color="#2fb3ff" stop-opacity=".85"/><stop offset="1" stop-color="#2fb3ff" stop-opacity="0"/></radialGradient><rect width="488" height="680" fill="url(#a)"/><rect width="488" height="680" fill="url(#b)"/>${grid(53, (x, y, k) => `<circle cx="${x + ((k * 37) % 41)}" cy="${y + ((k * 23) % 47)}" r="${(k % 3) + 1}" fill="#fff" fill-opacity="${0.35 + (k % 4) * 0.15}"/>`)}`,
      "#0b0820",
    ),
  },
  {
    id: "sunburst",
    name: "Sunburst",
    url: svg(`${rays(24, ["#f6b73c", "#e2652b"])}<circle cx="244" cy="340" r="70" fill="#fff2c4"/><circle cx="244" cy="340" r="52" fill="#f6b73c"/>`, "#e2652b"),
  },
  {
    id: "waves",
    name: "Waves",
    url: svg(
      Array.from({ length: 18 }, (_, i) => `<path d="M-20 ${i * 42} q 61 -32 122 0 t 122 0 t 122 0 t 122 0 t 122 0" fill="none" stroke="${i % 2 ? "#5ad1c6" : "#2b8fb8"}" stroke-width="16" stroke-linecap="round"/>`).join(""),
      "#0d3550",
    ),
  },
  {
    id: "chevron",
    name: "Chevron",
    url: svg(grid(68, (x, y, k) => `<path d="M${x} ${y + 34} l34 -34 l34 34 l0 22 l-34 -34 l-34 34 z" fill="${k % 2 ? "#c94f4f" : "#efe6d6"}"/>`), "#2d2a2e"),
  },
  {
    id: "mosaic",
    name: "Mosaic",
    url: svg(
      grid(44, (x, y, k) => `<rect x="${x + 3}" y="${y + 3}" width="38" height="38" rx="6" fill="${["#3d7a4f", "#6fb36b", "#a9d18e", "#2e5a3c", "#e8d77d"][(k * 7 + Math.floor(y / 44)) % 5]}"/>`),
      "#13261a",
    ),
  },
  {
    id: "lattice",
    name: "Midnight",
    url: svg(
      grid(61, (x, y) => `<path d="M${x} ${y} l30.5 30.5 l-30.5 30.5 l-30.5 -30.5 z" fill="none" stroke="#7d8cff" stroke-opacity=".55" stroke-width="3"/>`) +
        `<circle cx="244" cy="340" r="96" fill="#0c1030" stroke="#c7cdff" stroke-width="5"/><path d="M244 270 l20 50 l54 4 l-42 34 l14 52 l-46 -28 l-46 28 l14 -52 l-42 -34 l54 -4 z" fill="#c7cdff"/>`,
      "#0c1030",
    ),
  },
];

const PRESET_URL = new Map(BACK_PRESETS.map((p) => [p.id, p.url]));

export function loadCosmetics(): Cosmetics {
  try {
    const v = JSON.parse(localStorage.getItem(COSMETICS_KEY) ?? "null") as Partial<Cosmetics> | null;
    if (v && v.back && typeof v.back.id === "string") return { back: v.back };
  } catch {
    // ignore
  }
  return { back: { id: "classic" } };
}

export function saveCosmetics(c: Cosmetics): void {
  try {
    localStorage.setItem(COSMETICS_KEY, JSON.stringify({ ...c, backUrl: backUrlOf(c.back) }));
  } catch {
    // storage full or blocked: the choice lasts for this page only
  }
  window.dispatchEvent(new CustomEvent("rf-cosmetics"));
  window.dispatchEvent(new CustomEvent("rf-cosmetics-mine"));
}

/** Image URL of a back choice. */
export function backUrlOf(b: CardBackChoice | null | undefined): string {
  if (!b) return CLASSIC_BACK;
  if (b.id === "custom" && b.img) return b.img;
  return PRESET_URL.get(b.id) ?? CLASSIC_BACK;
}

/** A back for the computer opponent: a preset different from the player's. */
export function aiBackUrl(mine: CardBackChoice): string {
  const pick = BACK_PRESETS.find((p) => p.id !== mine.id && p.id !== "classic" && p.id !== "custom");
  return mine.id === "classic" ? PRESET_URL.get("forge")! : pick?.url ?? CLASSIC_BACK;
}

/** What this player shows to the opponent (card back + basic land arts). */
export function sharedCosmetics(): SharedCosmetics {
  const lands: Record<string, string> = {};
  try {
    const picks = JSON.parse(localStorage.getItem(LAND_ART_KEY) ?? "{}") as Record<string, { id?: string } | null>;
    for (const [b, v] of Object.entries(picks)) if (v && typeof v.id === "string" && v.id.length >= 32) lands[b] = v.id;
  } catch {
    // ignore
  }
  return { back: backUrlOf(loadCosmetics().back), lands };
}

/** The opponent's choices for the current game (read by rogue-forge-patch.js). */
export function setOpponentCosmetics(c: SharedCosmetics | null): void {
  (window as unknown as { __rfOpp?: SharedCosmetics | null }).__rfOpp = c;
  window.dispatchEvent(new CustomEvent("rf-cosmetics"));
}
