/**
 * The population dial (config population.dial; Jeff, 2026-11-02: "Load to truck ratio should maintain within a band so
 * that the game always welcomes new players. Boom and bust cycles still persist though, so there must be variance so
 * that players who are prudent businessmen win in the long run").
 *
 * The measure is national: NPC loads posted a day per truck in service, averaged over a window of days. Inside the band
 * the dial does nothing, so the seasons and the cycle swing the ratio as before. Outside it the dial changes how many
 * simulated carriers (rule-bot carriers) stand in the market, slowly: under the floor a bot that goes under retires
 * instead of restarting and the weakest bots wind down; over the ceiling new bot companies enter on the free path. It
 * never touches freight, cash, rates or costs: nobody is bailed out, and the dial itself posts nothing to the ledger
 * but the ordinary return of a retiring bot's own lease deposit. Players, and the wave's newcomers standing in for
 * them, are never touched.
 */
import { dayOf } from "./clock.js";
import { returnLease } from "./capacity.js";
import { releaseAll } from "./labor.js";
import type { Company, PopulationState } from "./types.js";
import { detachTruck, type World } from "./world.js";
import { ordersOf } from "./dealer.js";
import { endPlayerLease, leasedOut } from "./playerLeases.js";

export const dialOn = (w: World) => w.cfg.population.dial.enabled;

/** A simulated carrier the dial may act on: a rule-bot carrier, not a person and not a wave newcomer standing in for one. */
export const dialBot = (c: Company) => c.role === "carrier" && !c.human && !c.strategy.startsWith("player:") && !c.strategy.startsWith("wave:");

function state(w: World): PopulationState {
  return (w.population ??= { daily: [], mean: 0, state: "within", retired: 0, woundDown: 0, entered: 0, daysUnder: 0, daysOver: 0 });
}

/** Where the window's mean sits against the band (pure, for the tests): under the floor, over the ceiling, or within. */
export function bandState(mean: number, band: readonly [number, number]): PopulationState["state"] {
  return mean < band[0] ? "under" : mean > band[1] ? "over" : "within";
}

/**
 * Daily, after the day's metrics close: the day's loads posted per truck in service joins the window, and once the
 * window is full and the opening is past, the window's mean sets the state the bots and the restarts read.
 */
export function dailyPopulationDial(w: World, day: number): void {
  if (!dialOn(w)) return;
  const k = w.cfg.population.dial;
  const s = state(w);
  const m = w.metrics.days.at(-1);
  if (!m) return;
  s.daily.push(m.posted / Math.max(1, m.trucksInService));
  while (s.daily.length > k.windowDays) s.daily.shift();
  s.mean = s.daily.reduce((a, b) => a + b, 0) / s.daily.length;
  s.state = day < k.startDay || s.daily.length < k.windowDays ? "within" : bandState(s.mean, k.band);
  if (s.state === "under") s.daysUnder++;
  if (s.state === "over") s.daysOver++;
}

/** The dial's reading now: "within" when it is off. */
export const dialState = (w: World): PopulationState["state"] => (dialOn(w) ? (w.population?.state ?? "within") : "within");

/** Under the floor a bot carrier that went under is not restarted: it leaves the market, its debt unwritten (no write-off faucet). */
export const holdsRestart = (w: World, c: Company) => dialState(w) === "under" && dialBot(c);

/**
 * A simulated carrier leaves the market: what it still runs on a lease goes back (the NPC lease's deposit, the company's
 * own FD, comes back as when any lease ends), its staff go, its orders stop, and it is never restarted. Owned trucks are
 * sold before this by the wind-down; a bankrupt's were fire-sold by its liquidation.
 */
export function retireCompany(w: World, c: Company, why: "held" | "wound down"): void {
  for (const t of [...(w.trucksByCompany.get(c.id) ?? [])]) {
    if (t.lease === "npc") {
      detachTruck(w, t); // the lease's deposit comes back with it (world.ts)
      t.status = "retired";
    } else if (t.lease === "lessor" && t.status === "idle") returnLease(w, c, t);
  }
  releaseAll(w, c);
  c.orders = [];
  c.suspendedOrders = [];
  c.retiredDay = dayOf(w.t, w.cfg);
  c.windingDownDay = undefined;
  if (why === "held") state(w).retired++;
  else state(w).woundDown++;
  w.listener?.({ kind: "notice", companyId: c.id, topic: "board", text: `${c.name} has left the market.`, tone: "info" });
}

/** A bot carrier starts to wind down: no more orders, so its trucks come home idle and go (population.ts windDownStep). */
export function startWindDown(w: World, c: Company): void {
  c.windingDownDay = dayOf(w.t, w.cfg);
  c.orders = [];
}

/**
 * Daily for a bot winding down: leases go back as their trucks come idle; once nothing it runs is on the road or for
 * sale, it retires. Selling the owned trucks is the bot's (agents), through the used market like any sale.
 */
export function windDownStep(w: World, c: Company): void {
  const fleet = w.trucksByCompany.get(c.id) ?? [];
  for (const t of [...fleet]) {
    if (t.status !== "idle") continue;
    if (leasedOut(t)) endPlayerLease(w, t); // a player's tractor it leases goes back to its owner
    else if (t.lease === "npc") {
      detachTruck(w, t); // the lease's deposit comes back with it (world.ts)
      t.status = "retired";
    } else if (t.lease === "lessor") returnLease(w, c, t);
  }
  // It leaves once nothing it runs is on the road or for sale and no truck it ordered is still to come.
  const left = (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status !== "retired" && t.status !== "parked");
  if (left.length === 0 && ordersOf(w, c.id).length === 0) retireCompany(w, c, "wound down");
}

/** The dial's entrants and wave newcomers are counted here; the bots add them (agents). */
export function countEntrant(w: World): void {
  state(w).entered++;
}
