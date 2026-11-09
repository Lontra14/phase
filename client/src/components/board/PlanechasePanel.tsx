import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCardHover } from "../../hooks/useCardHover.ts";

import { dispatchAction } from "../../game/dispatch.ts";
import { useGameStore } from "../../stores/gameStore.ts";
import { CardImage } from "../card/CardImage.tsx";
import { ManaCostSymbols } from "../mana/ManaCostSymbols.tsx";

export function PlanechasePanel() {
  const { t } = useTranslation("game");
  const gameState = useGameStore((s) => s.gameState);
  const legalActions = useGameStore((s) => s.legalActions);
  const planechase = gameState?.derived?.planechase;
  const activePlane =
    planechase?.active_plane != null ? gameState?.objects[planechase.active_plane] : undefined;
  const canRoll =
    planechase?.can_roll === true && legalActions.some((action) => action.type === "RollPlanarDie");

  // Hover / long-press on the plane opens the big preview like any card.
  const { handlers } = useCardHover(activePlane?.id ?? null);
  const [open, setOpen] = useState(true);

  if (!planechase) return null;

  // On the right edge between the two halves of the board: it covers no player's header.
  return (
    <div className="pointer-events-auto absolute right-2 top-1/2 z-30 flex -translate-y-1/2 items-center gap-3 rounded-md border border-slate-700 bg-slate-950/90 px-3 py-2 shadow-lg backdrop-blur">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs text-slate-400" title={open ? "Hide" : "Show"}>
        {open ? "▸" : "◂"}
      </button>
      {open && (
      <>
      <div {...handlers} className="h-[84px] w-[120px] shrink-0 cursor-zoom-in [--card-h:84px] [--card-w:120px]">
        {activePlane ? (
          <CardImage
            cardName={activePlane.name}
            oracleId={activePlane.printed_ref?.oracle_id ?? undefined}
            faceName={activePlane.printed_ref?.face_name ?? undefined}
            ownerPrinting={activePlane.printing}
            faceDown={activePlane.face_down}
            size="small"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-xs text-slate-400">
            {t("planechase.noPlane")}
          </div>
        )}
      </div>
      <div className="flex min-w-32 flex-col gap-2 text-sm text-slate-100">
        <div>
          <div className="text-xs uppercase text-slate-400">{t("planechase.active")}</div>
          <div className="max-w-44 truncate font-semibold">{activePlane?.name ?? t("planechase.none")}</div>
        </div>
        <div className="flex items-center justify-between gap-4 text-xs text-slate-300">
          <span>{t("planechase.deckCount", { count: planechase.planar_deck_count })}</span>
          <span className="flex items-center gap-1">
            {t("planechase.cost")}
            <ManaCostSymbols cost={planechase.current_roll_cost} size="sm" />
          </span>
        </div>
        {canRoll && (
          <button
            type="button"
            className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-amber-400"
            onClick={() => dispatchAction({ type: "RollPlanarDie" })}
          >
            {t("planechase.roll")}
          </button>
        )}
      </div>
      </>
      )}
    </div>
  );
}
