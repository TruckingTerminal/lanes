import { layerBlock } from "./ladder.js";
import { logbookCount } from "./logbook.js";
import { convictionForfeit } from "./token.js";
import { dayOf } from "./clock.js";
import { fmtInt } from "./economics.js";
import { companyAccount } from "./ledger.js";
import { criminal, loseLoad, notice, record, restitute, revoke } from "./safety.js";
import { abandonLeg, legKeyOf } from "./trips.js";
import type { Company, FraudCase, Load, Truck } from "./types.js";
import { companyById, staffById, type World } from "./world.js";

/**
 * Fraud (design proposal, Jeff 2026-10-28): double brokering and freight theft,
 * against players and AI alike, and the vetting posters use to stay clear of it.
 *
 * Money rules: a theft never creates more FD than delivering the load would have.
 * A broker's loss on a stolen load is held while police investigate; if the case
 * goes cold the fence pays the thief out of it (and keeps a cut, burned), if the
 * thief is caught it goes back to the broker. A player shipper's or an NPC's loss
 * is goods, not FD: the fence's payout is new FD, but only a share of what the
 * honest delivery would have paid, and only if the thief gets away with it.
 */

const today = (w: World) => dayOf(w.t, w.cfg);
/** A company-side account, so escrowed claims stay inside the money supply while a case is open. */
const ESCROW = "co:escrow:theft";

export function openClaims(w: World, c: Company): number {
  const day = today(w);
  return c.claims.filter((k) => k.until > day).length;
}

/** Why this carrier can't take a load with the poster's vetting, or null if it can. */
export function vettingBlock(w: World, c: Company, load: Load): string | null {
  if (load.vet === 0) return null;
  const v = w.cfg.fraud.vetting;
  const day = today(w);
  const age = day - c.authority.since;
  if (openClaims(w, c) > 0) return "an open cargo claim";
  if (c.safety.rating === "unsatisfactory") return "an unsatisfactory safety rating";
  if (load.vet === 1) return age < v.standard.minAuthorityDays ? `authority under ${v.standard.minAuthorityDays} days old` : null;
  if (age < v.strict.minAuthorityDays) return `authority under ${v.strict.minAuthorityDays} days old`;
  if (c.delivered < v.strict.minDelivered && age < v.strict.orAuthorityDays) return `fewer than ${v.strict.minDelivered} loads delivered`;
  if (c.safety.rating === "conditional") return "a conditional safety rating";
  if (c.safety.alerts.length > 0) return "a safety alert";
  if (c.authority.lastRevokedDay !== null && day - c.authority.lastRevokedDay < v.strict.revokedLookbackDays) return "linked to a revoked authority";
  return null;
}

export const VETTING_NAMES = ["Open", "Standard", "Strict"] as const;

function newCase(w: World, k: Omit<FraudCase, "id">): FraudCase {
  const c: FraudCase = { id: w.cases.length + 1, ...k };
  w.cases.push(c);
  return c;
}

// --- Double brokering -----------------------------------------------------------------

/**
 * A carrier re-posts a load it won (before pickup) at a lower rate and keeps the
 * spread, without a broker's license. Its truck is freed where it stands. If it
 * then doesn't pay the carrier who hauled it, that's theft from that carrier.
 */
export function rebrokerLoad(w: World, c: Company, load: Load, rate: number, pays: boolean): string | null {
  if (c.role !== "carrier") return "brokers broker legally";
  // Player brokerages (brokerage.ts): a player brokers through a brokerage of its own; the re-post stays the AI's (the Back Lot's).
  if (w.cfg.brokerage.enabled && w.cfg.brokerage.closeDoubleBrokering && (c.human || c.partnerId !== undefined)) return "a carrier brokers through its own brokerage";
  const closed = layerBlock(w, "brokerage"); // the unlock ladder (ladder.ts)
  if (closed) return closed;
  if (c.authority.status !== "active") return "your authority isn't active";
  if (load.carrierId !== c.id || load.status !== "assigned") return "only a load you won and haven't picked up yet";
  if (load.doubleBroker) return "that load was already re-posted";
  if (load.shipperId === c.id) return "that's your own freight";
  if (!(rate > 0) || rate >= load.clearedRate) return "re-post it below the rate you won it at";
  const truck = load.truckId !== null ? w.trucks[load.truckId - 1] : undefined;
  if (!truck || truck.status !== "toPickup") return "the truck is already loading";
  abandonLeg(w, truck);
  load.doubleBroker = { companyId: c.id, upstreamRate: load.clearedRate, pays };
  load.status = "open";
  load.carrierId = null;
  load.truckId = null;
  load.clearedRate = 0;
  load.ceiling = rate;
  load.bookNow = rate;
  load.postedRound = w.round;
  load.roundsUnfilled = 0;
  w.metrics.onFraud("doubleBroker");
  return null;
}

/**
 * Settles a re-posted load after the upstream payer has paid the double broker:
 * it pays the hauler (or doesn't), and the fraud may come out.
 */
export function settleDoubleBroker(w: World, load: Load, hauler: Company | null, gross: number, upstreamGross: number, coveredCostFd = 0): number {
  const db = load.doubleBroker!;
  const broker = companyById(w, db.companyId);
  const rng = w.rng.fraud;
  const d = w.cfg.fraud.doubleBroker;
  broker.operating.revenueFd += upstreamGross;
  let paid = 0;
  if (hauler && db.pays) {
    w.ledger.post(w.t, companyAccount(broker.id), companyAccount(hauler.id), gross, `rebroker:${load.id}`);
    broker.operating.costFd += gross;
    paid = gross;
  }
  // Since 0.13.1 the hauler's counter can clear above the rate the load was won at: then there's no spread to keep.
  const spread = Math.max(0, upstreamGross - paid - coveredCostFd);
  const unpaid = hauler !== null && !db.pays;
  if (unpaid) {
    broker.claims.push({ day: today(w), until: today(w) + w.cfg.fraud.theft.claimDays, kind: "unpaid" });
    notice(w, hauler.id, "fraud", `${broker.name} never paid you for load #${load.id} (${fmtInt(gross)} FD). You filed a claim; it's on their record.`, "bad");
  }
  const caught = rng.next() < (unpaid ? d.detect.unpaid : d.detect.paid);
  if (caught || unpaid) {
    const [lo, hi] = unpaid ? d.investigationDays.unpaid : d.investigationDays.paid;
    newCase(w, {
      kind: "doubleBroker",
      companyId: broker.id,
      victimId: unpaid ? hauler!.id : 0,
      loadId: load.id,
      resolveDay: today(w) + rng.int(lo, hi),
      caught,
      amountFd: spread,
      lossFd: unpaid ? gross : 0,
      escrowFd: 0,
      truckId: 0,
      driverId: 0,
      unpaidCarrierId: unpaid ? hauler!.id : 0,
    });
  }
  return paid;
}

// --- Theft -------------------------------------------------------------------------------------

/** Odds the police catch a thief: better with tracking on the load, and when the carrier is long established. */
export function catchOdds(w: World, c: Company, load: Load): number {
  const k = w.cfg.fraud.theft.caught;
  const established = today(w) - c.authority.since >= k.establishedDays;
  return Math.min(0.95, k.base + (load.vet === 2 ? k.tracked : 0) + (established ? k.established : 0));
}

/**
 * The truck's load never arrives. The broker on it pays its share of the cargo
 * claim at once (held in escrow); the police open a case; the carrier gets a theft
 * claim on its record either way. The fence pays only if the case goes cold.
 */
export function stealLoad(w: World, c: Company, truck: Truck): string | null {
  if (!w.cfg.fraud.theft.byCarrier) return "carriers can't steal the loads they haul";
  if (c.role !== "carrier") return "only a carrier hauling a load can steal it";
  if (c.authority.status === "revoked") return "your authority isn't active";
  if (truck.companyId !== c.id) return "not your truck";
  if (truck.status !== "loaded" || truck.loadId === null) return "the truck isn't hauling a load";
  const load = w.loads.get(truck.loadId);
  if (!load) return "no load on the truck";
  if (load.shipperId === c.id) return "that's your own freight";
  const rng = w.rng.fraud;
  const t = w.cfg.fraud.theft;
  let escrow = 0;
  let victimId = 0;
  let loss = 0;
  let payout = 0;
  if (load.brokerId !== null) {
    victimId = load.brokerId;
    escrow = t.brokerClaimShare * load.cargoValue;
    w.ledger.post(w.t, companyAccount(victimId), ESCROW, escrow, `theft:${load.id}`);
    payout = escrow * (1 - t.fenceCut);
    loss = escrow;
    notice(w, victimId, "fraud", `Load #${load.id} you brokered to ${c.name} was stolen. You paid a ${fmtInt(escrow)} FD cargo claim; it comes back if they're caught.`, "bad");
  } else if (load.shipperId !== null) {
    victimId = load.shipperId;
    loss = load.saleValue;
    payout = t.fenceShare * load.saleValue;
    notice(w, victimId, "fraud", `Your load #${load.id} was stolen by ${c.name}. The goods are gone; you'll be paid back out of what they have if they're caught.`, "bad");
  } else {
    payout = t.fenceShare * load.cargoValue;
  }
  if (load.doubleBroker) victimId = victimId || load.doubleBroker.companyId;
  loseLoad(w, load, "theft");
  // The truck runs on empty to where it was going, past the same scales.
  truck.loadId = null;
  truck.status = "repositioning";
  truck.legKey = legKeyOf(w, truck);
  c.claims.push({ day: today(w), until: today(w) + t.claimDays, kind: "theft" });
  c.delivered++;
  c.late++;
  const prior = w.cfg.reputation.priorLoads;
  c.reputation = (c.onTime + prior * w.cfg.reputation.start) / (c.delivered + prior);
  const [lo, hi] = t.investigationDays;
  newCase(w, {
    kind: "theft",
    companyId: c.id,
    victimId,
    loadId: load.id,
    resolveDay: today(w) + rng.int(lo, hi),
    caught: rng.next() < catchOdds(w, c, load),
    amountFd: payout,
    lossFd: loss,
    escrowFd: escrow,
    truckId: truck.id,
    driverId: truck.driverId,
    unpaidCarrierId: 0,
  });
  w.metrics.onFraud("theft");
  return null;
}

// --- Investigations --------------------------------------------------------------------------------

/** Daily: cases that are due resolve; claims past their time drop off records. */
export function dailyFraud(w: World): void {
  const day = today(w);
  for (const k of w.cases) {
    if (k.resolveDay !== day) continue;
    const c = companyById(w, k.companyId);
    if (k.kind === "theft") resolveTheft(w, k, c);
    else resolveDoubleBroker(w, k, c);
  }
  for (const c of w.companies) if (c.claims.length > 0) c.claims = c.claims.filter((x) => x.until > day);
}

function resolveTheft(w: World, k: FraudCase, c: Company): void {
  if (k.caught) {
    // The broker's claim comes back out of escrow; a shipper is paid back out of the thief's cash.
    if (k.escrowFd > 0) w.ledger.post(w.t, ESCROW, companyAccount(k.victimId), k.escrowFd, `theft:${k.loadId}`);
    // Whoever drove it that day, wherever they work now.
    const driver = k.driverId ? staffById(w, k.driverId) : null;
    if (k.victimId > 0) notice(w, k.victimId, "fraud", `Police caught ${c.name} for stealing load #${k.loadId}.${k.escrowFd > 0 ? " Your claim was refunded." : " You'll be paid back from what they had."}`, "good");
    w.metrics.onConviction();
    convictionForfeit(w, c);
    criminal(w, c, `Convicted of stealing load #${k.loadId}.`, driver, k.escrowFd > 0 ? 0 : k.victimId, k.escrowFd > 0 ? 0 : k.lossFd);
    return;
  }
  // Cold case: the fence pays, out of the broker's escrowed claim (keeping a cut, burned) or, for an NPC's or a shipper's goods, in new FD.
  const acct = companyAccount(c.id);
  if (k.escrowFd > 0) {
    w.ledger.post(w.t, ESCROW, acct, k.amountFd, `fence:${k.loadId}`);
    w.ledger.post(w.t, ESCROW, "sink:fence_cut", k.escrowFd - k.amountFd, `fence:${k.loadId}`);
  } else w.ledger.post(w.t, "faucet:fence", acct, k.amountFd, `fence:${k.loadId}`);
  logbookCount(c, "coldCases");
  logbookCount(c, "takeFd", k.amountFd);
  record(w, c, `Suspected in the theft of load #${k.loadId}; the case went cold.`);
  notice(w, c.id, "fraud", `The case on load #${k.loadId} went cold. A fence paid ${fmtInt(k.amountFd)} FD. The theft claim stays on your record for a year.`, "info");
}

function resolveDoubleBroker(w: World, k: FraudCase, c: Company): void {
  const d = w.cfg.fraud.doubleBroker;
  if (!k.caught) {
    // Unpaid and never caught: the hauler's loss stands, the claim stays on record.
    logbookCount(c, "coldCases");
    logbookCount(c, "takeFd", Math.max(0, k.amountFd));
    return;
  }
  w.metrics.onConviction();
  convictionForfeit(w, c);
  if (k.unpaidCarrierId > 0) {
    const back = restitute(w, c, k.unpaidCarrierId, k.lossFd);
    notice(w, k.unpaidCarrierId, "fraud", `${c.name} was caught double brokering load #${k.loadId}. ${back > 0 ? `${fmtInt(back)} FD of what they owed you was recovered.` : "There was nothing left to recover."}`, back > 0 ? "good" : "bad");
    c.authority.frauds++;
    revoke(w, c, `Double brokering load #${k.loadId} and not paying the carrier.`, w.cfg.safety.bars.fraud);
    return;
  }
  // Paid the hauler, but it's still double brokering: the spec's penalties — a fine in place of the bond claim, a 30-day suspension, and zero Miles.
  c.authority.frauds++;
  const amount = d.fineFd + d.spreadMult * Math.max(0, k.amountFd);
  w.ledger.post(w.t, companyAccount(c.id), "sink:fines", amount, `fine:doublebroker:${k.loadId}`);
  c.safety.finesFd += amount;
  c.milesTotal = 0;
  if (c.authority.frauds >= 2) {
    revoke(w, c, "Caught double brokering a second time.", w.cfg.safety.bars.fraud);
    return;
  }
  if (c.authority.status === "active") {
    c.authority.status = "suspended";
    c.authority.suspendedUntil = today(w) + d.suspensionDays;
  }
  record(w, c, `Caught double brokering load #${k.loadId}: ${fmtInt(amount)} FD fine, ${d.suspensionDays}-day suspension, Miles forfeited.`);
  notice(w, c.id, "authority", `Caught double brokering load #${k.loadId}: ${fmtInt(amount)} FD fine, authority suspended ${d.suspensionDays} days, Miles zeroed. Again and it's revoked.`, "bad");
}
