import type { Company, Truck, World } from "@lanes/engine";
import { boardRows, type BoardRow } from "./board.js";
import { FIGURE_ACT } from "./copy.js";
import { bestLoad, cushion, freeTrucks, gapToTruck } from "./figures.js";
import type { FigureCtx } from "./explain.js";

/**
 * The explain sheet's foot (guidance-ux.md section 3, ruled 2026-11-03): "What can I do about it?" answers about the tapped
 * figure. A figure with a lever this company can pull now gets one action, one reason in this figure's numbers and one
 * button; a figure with none says why in one line. Read from the world, saving nothing, like figures.ts.
 */
export type FigureAnswer =
  | { kind: "act"; action: string; reason: string; button: string; truckId: number; loadId: number }
  | { kind: "none"; line: string };

const place = (w: World, id: number): string => w.net.places[id]!.name;
/** The next board round's hour, "18:00". */
function nextRoundHH(w: World): string {
  const hour = (w.t % w.cfg.time.gameMinutesPerDay) / 60;
  const h = w.cfg.time.boardRoundHours.find((x) => x > hour) ?? w.cfg.time.boardRoundHours[0]!;
  return `${String(h).padStart(2, "0")}:00`;
}
const n = (x: number): string => Math.round(x).toLocaleString("en-US");

/** The paying load with the fewest empty miles to it: the break-even's biggest lever this round. */
function nearestPaying(w: World, c: Company, truck: Truck): BoardRow | null {
  let best: BoardRow | null = null;
  for (const r of boardRows(w, c, truck, { dest: "any", maxDh: 300, query: "" })) {
    if (r.block || r.profitBook <= 0) continue;
    if (!best || r.dh < best.dh || (r.dh === best.dh && r.profitBook > best.profitBook)) best = r;
  }
  return best;
}

/** The figure's own answer, or null when the key has none of its own and the entry's "what moves it" stands instead. */
export function figureAct(w: World, c: Company, key: string, ctx: FigureCtx): FigureAnswer | null {
  const free = freeTrucks(w, c);
  const truck = (ctx.truckId !== undefined ? free.find((t) => t.id === ctx.truckId) : undefined) ?? free[0];
  const load = (row: BoardRow | null): FigureAnswer | null =>
    row ? { kind: "act", action: FIGURE_ACT.fewerEmpty(place(w, row.l.originPlace), n(row.dh)), reason: FIGURE_ACT.loadReason(place(w, row.l.originPlace), place(w, row.l.destPlace), n(row.profitBook)), button: FIGURE_ACT.showLoad, truckId: truck!.id, loadId: row.l.id } : null;
  switch (key) {
    case "truck.breakEven":
    case "board.profitChip":
    case "board.deadhead":
      if (!truck) return { kind: "none", line: FIGURE_ACT.busy };
      return load(nearestPaying(w, c, truck)) ?? { kind: "none", line: FIGURE_ACT.nothingPays(nextRoundHH(w)) };
    case "guide.cushion": {
      const cu = cushion(w, c);
      if (cu.weeks === null) return { kind: "none", line: FIGURE_ACT.noSpending };
      if (cu.weeks >= w.cfg.guide.gapCushionWeeks) return { kind: "none", line: FIGURE_ACT.healthy(cu.weeks.toFixed(1)) };
      if (!truck) return { kind: "none", line: FIGURE_ACT.busy };
      const row = bestLoad(w, c, truck);
      return row ? { ...(load(row) as Extract<FigureAnswer, { kind: "act" }>), action: FIGURE_ACT.haulForCushion } : { kind: "none", line: FIGURE_ACT.nothingPays(nextRoundHH(w)) };
    }
    case "guide.gapToTruck": {
      if (gapToTruck(w, c).gapFd <= 0) return { kind: "none", line: FIGURE_ACT.gapClosed };
      if (!truck) return { kind: "none", line: FIGURE_ACT.busy };
      const row = bestLoad(w, c, truck);
      return row ? { ...(load(row) as Extract<FigureAnswer, { kind: "act" }>), action: FIGURE_ACT.haulForTruck } : { kind: "none", line: FIGURE_ACT.nothingPays(nextRoundHH(w)) };
    }
    case "truck.value":
      return { kind: "none", line: FIGURE_ACT.value };
    case "pay.fuel":
      return { kind: "none", line: FIGURE_ACT.diesel };
    case "truck.leaseDeposit":
      return { kind: "none", line: FIGURE_ACT.held };
    default:
      return key.endsWith(".other") ? { kind: "none", line: FIGURE_ACT.theirs } : null;
  }
}
