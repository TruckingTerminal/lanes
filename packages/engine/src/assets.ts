/**
 * Destruction (assets.enabled; the EVE plan, step 4, Jeff 2026-10-30). Nothing lasts forever: a tractor
 * takes two rebuilds or a million miles and then runs until it's worn out, a trailer runs out its own
 * miles, a bad crash writes the rig off, and a trailer left in a yard can be stolen. What's destroyed
 * leaves the game: scrap pays a sliver of its list price and nothing goes back into dealer supply, so
 * every truck and trailer on the road was bought new at some point. Physical-damage cover
 * (insurance.ts payPhysicalDamage) pays an insured loss at its value less the deductible.
 */
import { trailerValue, truckValue } from "./dealer.js";
import { econDestroyed } from "./econMonth.js";
import { activeLoanOn, settleLoanFromSale } from "./finance.js";
import { payPhysicalDamage } from "./insurance.js";
import { companyAccount } from "./ledger.js";
import { notice } from "./safety.js";
import { fitTrailer, handBack, hookedTrailer, scrapTrailer, trailerGone, trailerScrapFd, trailersOf, trailerWornOut, unhook, yardTheftTonight } from "./trailers.js";
import type { Company, Trailer, Truck } from "./types.js";
import { tractorWornOut } from "./wear.js";
import { detachTruck, type World } from "./world.js";

const TRAILER_NAME = { van: "dry van", reefer: "reefer", flatbed: "flatbed" } as const;

/** A tractor's scrap value: a share of its list price. */
export function tractorScrapFd(w: World, t: Truck): number {
  return w.cfg.assets.tractor.scrapShare * w.cfg.dealerFd.tractor[t.tier];
}

/**
 * Scraps a tractor: the scrapyard pays `payTo` its scrap value (a small faucet), and with `withTrailer`
 * its own trailer's too; otherwise its own trailer is dropped in the owner's yard and a rental handed
 * back. The caller settles any loan on it. The tractor leaves the game.
 */
export function scrapTractor(w: World, truck: Truck, payTo: string, withTrailer: boolean): void {
  let scrap = tractorScrapFd(w, truck);
  const tr = hookedTrailer(w, truck);
  // The monthly report's value destroyed (econMonth.ts): the tractor's book value, and its own trailer's when it goes too.
  econDestroyed(w, truckValue(w, truck) + (tr && tr.lease === "owned" && withTrailer ? trailerValue(w, tr) : 0), true);
  if (tr && tr.lease === "owned" && withTrailer) {
    scrap += trailerScrapFd(w, tr);
    for (const l of w.listings) if (l.trailerId === tr.id && l.status === "open") l.status = "withdrawn";
    trailerGone(w, tr);
    w.metrics.onScrap("trailer");
  } else if (tr && truck.companyId) unhook(w, truck);
  else if (tr) handBack(w, tr);
  for (const l of w.listings) if (l.truckId === truck.id && l.status === "open") l.status = "withdrawn";
  if (truck.companyId) detachTruck(w, truck);
  truck.status = "retired";
  truck.remainingMi = 0;
  truck.legKey = -1;
  if (scrap > 0.01) {
    w.ledger.post(w.t, "faucet:scrap", payTo, scrap, `scrap:truck:${truck.id}`);
    w.ledger.lock(payTo, Math.min(scrap, truck.lockedBasisFd ?? 0)); // bought with spend-only FD: scrapped for the same
  }
  w.metrics.onScrap("tractor");
}

/** An owner scraps its tractor: the scrap value pays down any loan on it first. A leased-out tractor's scrap is its owner's. */
export function scrapOwnedTractor(w: World, c: Company, truck: Truck): void {
  const acct = companyAccount(truck.lessorId || c.id);
  const loan = activeLoanOn(w, truck.id);
  scrapTractor(w, truck, acct, false);
  if (loan) settleLoanFromSale(w, loan, acct, tractorScrapFd(w, truck));
}

/**
 * A rig written off in a crash: the tractor and its own trailer are destroyed (a rental is the lessor's
 * loss), cover pays their value less the deductible, and a loan on it is settled from the payout.
 */
export function writeOffRig(w: World, c: Company, truck: Truck): number {
  // A leased-out tractor: the operator's policy pays, the owner of the title is paid.
  const owner = truck.lessorId ? w.companies[truck.lessorId - 1]! : c;
  const acct = companyAccount(owner.id);
  const value = truckValue(w, truck);
  const tr = hookedTrailer(w, truck);
  econDestroyed(w, value + (tr && tr.lease === "owned" ? trailerValue(w, tr) : 0), true); // the monthly report (econMonth.ts)
  if (tr && tr.lease === "owned") trailerGone(w, tr);
  else if (tr) handBack(w, tr);
  const paid = payPhysicalDamage(w, c, value, `pd:truck:${truck.id}`, owner, truck.lockedBasisFd ?? 0);
  const loan = activeLoanOn(w, truck.id);
  if (loan) settleLoanFromSale(w, loan, acct, paid);
  detachTruck(w, truck);
  truck.status = "retired";
  truck.remainingMi = 0;
  truck.legKey = -1;
  w.metrics.onTotalLoss();
  return paid;
}

/**
 * When a truck stands at a hub (idle or parked): a trailer at the end of its life goes for scrap and the
 * truck takes a spare from the yard or a rental; a tractor at the end of its life goes for scrap.
 */
export function endOfLife(w: World, c: Company, truck: Truck): void {
  if (!w.cfg.assets.enabled || truck.lease !== "owned" || (truck.status !== "idle" && truck.status !== "parked")) return;
  // The tractor first: scrapped, its trailer drops into the yard (and goes for scrap there if it's done too).
  if (tractorWornOut(w.cfg, truck)) {
    scrapOwnedTractor(w, c, truck);
    notice(w, c.id, "fleet", `Truck ${truck.id} reached the end of its life (${Math.round(truck.odometer / 1000)}k miles, ${truck.rebuilds} rebuilds) and went for scrap.`, "info", truck.id);
    for (const tr of [...trailersOf(w, c.id)]) if (tr.status === "dropped" && trailerWornOut(w, tr)) scrapTrailer(w, tr);
    return;
  }
  const tr = hookedTrailer(w, truck);
  if (tr && trailerWornOut(w, tr)) {
    const type = tr.type;
    scrapTrailer(w, tr);
    const next = fitTrailer(w, truck, type);
    notice(w, c.id, "fleet", `Truck ${truck.id}'s ${TRAILER_NAME[type]} trailer reached the end of its life and went for scrap; it now pulls ${next.lease === "rental" ? "a rental" : "a spare from the yard"}.`, "info", truck.id);
  }
}

/** A trailer stolen from the yard: cover pays its value less the deductible. */
function stolenFromYard(w: World, c: Company, tr: Trailer): void {
  const value = trailerValue(w, tr);
  for (const l of w.listings) if (l.trailerId === tr.id && l.status === "open") l.status = "withdrawn";
  trailerGone(w, tr);
  const paid = payPhysicalDamage(w, c, value, `pd:trailer:${tr.id}`, c, tr.lockedBasisFd ?? 0);
  w.metrics.onYardTheft();
  notice(w, c.id, "fleet", `A ${TRAILER_NAME[tr.type]} trailer was stolen from your yard overnight; the insurer paid ${Math.round(paid)} FD.`, "bad");
}

/** Daily: refurbishments finish, trucks standing at hubs and trailers in yards meet the end of their life, and yards are robbed. */
export function dailyAssets(w: World): void {
  if (!w.cfg.assets.enabled) return;
  for (const list of w.trailersByCompany.values()) for (const tr of list) if (tr.refurbUntilT !== null && w.t >= tr.refurbUntilT) tr.refurbUntilT = null;
  for (const c of w.companies) {
    const fleet = w.trucksByCompany.get(c.id);
    if (fleet) for (const t of [...fleet]) endOfLife(w, c, t);
    for (const tr of [...trailersOf(w, c.id)]) if (tr.status === "dropped" && trailerWornOut(w, tr)) scrapTrailer(w, tr);
  }
  yardTheftTonight(w, (c, tr) => stolenFromYard(w, c, tr));
}
