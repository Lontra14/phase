// Types for minigame.js (the Chess minigame engine + UI, plain JS).

export interface ChessFace {
  name: string;
  img: string;
  type: string;
  types: {
    creature?: boolean;
    instant?: boolean;
    sorcery?: boolean;
    enchantment?: boolean;
    artifact?: boolean;
    planeswalker?: boolean;
    land?: boolean;
    basic?: boolean;
  };
  colors: string[];
  power: number;
  toughness: number;
  loyalty: number;
  kw: boolean;
  trig: boolean;
  act: boolean;
  legendary: boolean;
  kwList?: string[];
}

export interface ChessCard {
  /** Printing key in the Progression index (`set:collector_number`). */
  key: string;
  name: string;
  rarity: "c" | "u" | "r" | "m";
  cmc: number;
  faces: ChessFace[];
  dfc: boolean;
  alt: boolean;
  foil: boolean;
}

export interface ChessBooster {
  cards: ChessCard[];
  land: ChessCard;
  setName?: string;
}

export interface ChessNet {
  send(msg: unknown): void;
  onMessage(cb: (msg: unknown) => void): void;
}

export interface ChessOptions {
  boosters: [ChessBooster, ChessBooster];
  names: [string, string];
  /** ai: seat 1 is the AI · hot: both on this screen · remote: the other seat plays on its own device. */
  mode: "ai" | "hot" | "remote";
  /** Remote games: the seat played on this device. */
  me?: 0 | 1;
  first: 0 | 1;
  seed: string;
  title?: string;
  curtain?: boolean;
  debug?: boolean;
  net?: ChessNet;
  /** Card back image of each seat (null = the Rogue Forge back). Remote games: the other seat's arrives from its device. */
  backs?: [string | null, string | null];
}

export interface ChessResult {
  winner: 0 | 1;
  why: string;
  turns: number;
  /** Printing keys each seat takes home (won cards + its own cards left on the board; no basic lands). */
  pools: [string[], string[]];
}

export const __debug: Record<string, unknown>;
export const CHESS_KEYWORDS: Record<string, { name: string; icon: string }>;
export function mountChess(root: HTMLElement, opts: ChessOptions): { done: Promise<ChessResult>; destroy(): void };
