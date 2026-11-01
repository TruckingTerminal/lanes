import { PLACE_OF_HUB } from "@lanes/data";
import { breakEvenPerMile, expectedReloadDeadheadMi, fuelPrice, placeMiles, placeToll, type Load, type TruckSpec, type World } from "@lanes/engine";

/**
 * The one break-even every screen shows (the director's ruling 5, 2026-11-02): the profit chip on a load card, S3's
 * "Your break-even" row, S7's pay line and the hub card's season line all call this, so no two of them disagree.
 * It is the dispatcher's arithmetic without its noise (apps/sim/src/firstBoard.ts trueBreakEven): the lessor's share,
 * fuel, tolls and the climb, and the expected empty run out of the destination, at the dispatcher's foresight and
 * reload weight. `dhMi` is the empty run to the pickup.
 */
export function trueBreakEven(w: World, truck: TruckSpec, load: Load, dhMi: number, tollsToPickupFd: number, foresightDays: number, reloadWeight: number): number {
  const fuel = fuelPrice(w);
  const reloadMi = expectedReloadDeadheadMi(w, load.dest, load.equipment, foresightDays);
  const tr = w.cfg.roads.terrain;
  const lane = w.net.lanes[load.laneId];
  const climbFd = tr.enabled && lane ? tr.fuelGalPerClimbM * lane.climbM * fuel : 0;
  return breakEvenPerMile(w.cfg, truck, fuel, load.miles, dhMi + reloadWeight * reloadMi, tollsToPickupFd + load.routeTollFd + climbFd);
}

/** A new owner's dispatch: the human owner's skill on the dispatcher's ranges (labor.ts dispatchProfile, alone). */
export function newOwnerDispatch(w: World): { foresightDays: number; reloadWeight: number } {
  const { labor, board } = w.cfg;
  const skill = labor.owner.humanSkill;
  const lerp = (r: readonly [number, number]) => r[0] + (r[1] - r[0]) * skill;
  return { foresightDays: Math.round(lerp(labor.dispatcher.foresightDays)), reloadWeight: board.reloadWeight * lerp(labor.dispatcher.reloadAware) };
}

/** The starter: the free path's leased Workhorse with a dry van, new to the road. */
export const STARTER_TRUCK: TruckSpec = { tier: "workhorse", trailer: "van", lease: "npc", odometer: 0, milesSinceRebuild: 0 };

/** A starter's break-even on a load, the truck standing at the hub. */
export function starterBreakEven(w: World, hub: number, load: Load): number {
  const at = PLACE_OF_HUB[hub]!;
  const d = newOwnerDispatch(w);
  return trueBreakEven(w, STARTER_TRUCK, load, placeMiles(w, at, load.originPlace), placeToll(w, at, load.originPlace), d.foresightDays, d.reloadWeight);
}
