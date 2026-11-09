import { useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { useCardHover } from "../../hooks/useCardHover.ts";
import { useGameStore } from "../../stores/gameStore.ts";
import { CardImage } from "../card/CardImage.tsx";

type SchemeObject = {
  id: number;
  name: string;
  printed_ref?: { oracle_id?: string | null; face_name?: string | null } | null;
  printing?: Parameters<typeof CardImage>[0]["ownerPrinting"];
  face_down?: boolean;
};

/** One face-up scheme: hover (or long-press) shows the big preview like any card. */
function SchemeCard({ scheme, big }: { scheme: SchemeObject; big: boolean }) {
  const { handlers } = useCardHover(scheme.id);
  const h = big ? 126 : 84;
  const w = Math.round((h * 5) / 7);
  return (
    <div {...handlers} data-object-id={scheme.id} title={scheme.name} className="shrink-0 cursor-zoom-in" style={{ height: h, width: w, "--card-h": `${h}px`, "--card-w": `${w}px` } as CSSProperties}>
      <CardImage
        cardName={scheme.name}
        oracleId={scheme.printed_ref?.oracle_id ?? undefined}
        faceName={scheme.printed_ref?.face_name ?? undefined}
        ownerPrinting={scheme.printing}
        faceDown={scheme.face_down}
        size="small"
      />
    </div>
  );
}

/**
 * Archenemy: the face-up schemes (the latest first, ongoing ones next to it),
 * on the left edge of the board between the two halves so it covers no
 * player's header; it folds into a small tab.
 */
export function ArchenemyPanel() {
  const { t } = useTranslation("game");
  const gameState = useGameStore((s) => s.gameState);
  const [open, setOpen] = useState(true);
  const archenemy = gameState?.derived?.archenemy;
  const activeSchemes = (archenemy?.active_scheme_ids?.flatMap((id) => {
    const scheme = gameState?.objects[id];
    return scheme ? [scheme as unknown as SchemeObject] : [];
  }) ?? []);

  if (!archenemy) return null;

  return (
    <div className="pointer-events-auto absolute left-2 top-1/2 z-30 flex max-w-[min(70vw,24rem)] -translate-y-1/2 flex-col gap-2 rounded-md border border-amber-700/60 bg-slate-950/90 px-2 py-2 text-slate-100 shadow-lg backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-3 text-left text-[11px] uppercase tracking-wide text-amber-300"
        title={open ? "Hide" : "Show"}
      >
        <span>
          {t("archenemy.active")}
          {activeSchemes.length > 1 ? ` · ${activeSchemes.length}` : ""}
        </span>
        <span className="text-slate-400">{open ? "◂" : "▸"}</span>
      </button>
      {open && (
        <>
          <div className="flex items-end gap-2 overflow-x-auto">
            {activeSchemes.length ? (
              activeSchemes.map((scheme, i) => <SchemeCard key={scheme.id} scheme={scheme} big={i === 0} />)
            ) : (
              <div className="flex h-[84px] w-[60px] items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-center text-[10px] text-slate-400">
                {t("archenemy.noScheme")}
              </div>
            )}
          </div>
          <div className="max-w-64 truncate text-xs font-semibold">{activeSchemes[0]?.name ?? t("archenemy.none")}</div>
          <div className="flex items-center justify-between gap-4 text-[11px] text-slate-300">
            <span>{t("archenemy.deckCount", { count: archenemy.scheme_deck_count })}</span>
            <span>{t("archenemy.heroCount", { count: archenemy.hero_player_ids?.length ?? 0 })}</span>
          </div>
        </>
      )}
    </div>
  );
}
