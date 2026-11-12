/**
 * Player brokerages (config `brokerage`; Jeff, 2026-11-02: "Brokerages and carriers should be different companies.
 * Each player can have 1 of each at most"; studio/specs/brokerage-rule.md). Off by default.
 *
 * A player's carrier forms its one brokerage once the ladder's brokerage layer opens: a broker company of its own
 * (formCompany, no grant, fresh credit) with the licence, the bond as its stake and the surety premium as an AI broker
 * has them, funded by the owner's capital from the carrier. The two companies are linked (`partnerId`), and between
 * them:
 * - the owner's capital moves either way as equity, never revenue, guarded, for `transferFeePct` to the reserve;
 * - Rule A: the carrier may pass a direct contract tender to its brokerage inside the tender's window, the shipper's
 *   payable moving with it; the brokerage never tenders it back to that carrier;
 * - Rule B: the brokerage may tender its shipper freight straight to its own carrier, the hauler's pay inside the
 *   lane's band (`band` × the load's reference rate);
 * - a load counts once per person (logbook loads, the broker's Miles: trips.ts), payments stay out of credit, own
 *   paper is never factored and the own carrier stands last in the bond's queue (receivables.ts), one profit-tax
 *   allowance and one airdrop share per person (token.ts).
 */
import { dayOf } from "./clock.js";
import { coverPassed } from "./contracts.js";
import { layerBlock } from "./ladder.js";
import { companyAccount } from "./ledger.js";
import { apCapBlock, brokerBooks } from "./receivables.js";
import { brokerLicensed, stakeFd } from "./staking.js";
import type { BrokerageLog, Company, Load } from "./types.js";
import { formCompany, type World } from "./world.js";
import { openWindow, windowsOn } from "./windows.js";


export const brokerageOn = (w: World): boolean => w.cfg.brokerage.enabled;

/** The owner's other company, with the rule on. */
export function partnerOf(w: World, c: Company): Company | null {
  if (!w.cfg.brokerage.enabled || c.partnerId === undefined) return null;
  return w.companies[c.partnerId - 1] ?? null;
}

/** Whether two companies (ids) are one owner's carrier and brokerage, with the rule on. */
export function samePerson(w: World, a: number, b: number): boolean {
  if (!w.cfg.brokerage.enabled || a === b || a <= 0 || b <= 0) return false;
  return w.companies[a - 1]?.partnerId === b;
}

/**
 * The launch reset and a player brokerage's beta bond (the director's brief): the bond burns at the reset like every
 * beta stake, except the part standing behind paper still open, which burns only once that paper is paid, so no
 * carrier goes unpaid across the launch. Returns what to keep in the stake account through the reset (token.ts),
 * and starts the hold.
 */
export function launchHold(w: World, c: Company): number {
  if (!w.cfg.brokerage.enabled || c.role !== "broker" || c.partnerId === undefined) return 0;
  // Arm's-length paper only: the owner's own carrier is never paid from the beta bond across the reset (the red team's E3-LAUNCHHOLD).
  const paper = w.receivables.filter((r) => r.payer === c.id && r.amountFd > 0.005 && !r.shipperPaper && !samePerson(w, c.id, r.payeeId));
  const owed = paper.reduce((x, r) => x + r.amountFd, 0);
  const held = Math.min(owed, c.stakedFd, Math.max(0, w.ledger.balance(`co:stake:${c.id}`)));
  if (held <= 0.005) return 0;
  c.launchBond = { heldFd: held, drawnFd: 0, paper: paper.map((r) => r.id) };
  brokerageLog(w).launchHeldFd += held;
  return held;
}

/** A launch hold's paper drew on the bond (receivables.ts). */
export function launchDraw(c: Company, receivableId: number, fd: number, w: World): void {
  const h = c.launchBond;
  if (!h || !h.paper.includes(receivableId)) return;
  h.drawnFd += fd;
  brokerageLog(w).launchDrawnFd += fd;
}

/** Daily: a launch hold whose paper is all paid burns what is left of the beta bond it kept. */
export function releaseLaunchHolds(w: World): void {
  if (!w.cfg.brokerage.enabled) return;
  for (const c of w.companies) {
    const h = c.launchBond;
    if (!h) continue;
    if (w.receivables.some((r) => r.amountFd > 0.005 && h.paper.includes(r.id))) continue;
    const left = Math.min(Math.max(0, h.heldFd - h.drawnFd), c.stakedFd, Math.max(0, w.ledger.balance(`co:stake:${c.id}`)));
    if (left > 0.005) {
      w.ledger.post(w.t, `co:stake:${c.id}`, "sink:launch_reset", left, `launch:${c.id}`);
      c.stakedFd -= left;
    }
    const log = brokerageLog(w);
    log.launchLateBurnFd += left;
    if (w.token.launchDay !== null) log.launchHoldDays.push(dayOf(w.t, w.cfg) - w.token.launchDay);
    c.launchBond = undefined;
  }
}

/** A player's brokerage wound down: no stake and no paper, so its licence has lapsed (no surety premium, no renewal). */
export function lapsedBrokerage(w: World, c: Company): boolean {
  return w.cfg.brokerage.enabled && c.role === "broker" && c.partnerId !== undefined && c.stakedFd < 0.01 && c.openBrokerLoads <= 0 && !w.receivables.some((r) => r.payer === c.id);
}

/** The world's brokerage log, made on first use. */
export function brokerageLog(w: World): BrokerageLog {
  return (w.brokerageLog ??= {
    formed: [],
    controls: [],
    transfers: 0,
    transferFd: 0,
    feeFd: 0,
    rescues: 0,
    rescueFd: 0,
    refused: {},
    passes: 0,
    passesBooked: 0,
    passesFellOff: 0,
    ownTenders: 0,
    ownTendersBooked: 0,
    ownTenderFd: 0,
    ownRateOverRef: 0,
    ownAtEdge: 0,
    ownBoardWins: 0,
    ownBoardRateOverRef: 0,
    clears: 0,
    clearsRateOverRef: 0,
    countedOnce: 0,
    laneRates: {},
    hubRates: {},
    holds: { held: 0, postedByOrder: 0, postedByHand: 0, declined: 0, toOwn: 0, passedPosted: 0 },
    launchHeldFd: 0,
    launchDrawnFd: 0,
    launchLateBurnFd: 0,
    launchHoldDays: [],
  });
}

function refuse(w: World, why: string): string {
  const log = brokerageLog(w);
  log.refused[why] = (log.refused[why] ?? 0) + 1;
  return why;
}

/** Why this carrier can't form a brokerage now, or null. */
export function canFormBrokerage(w: World, carrier: Company): string | null {
  const k = w.cfg.brokerage;
  if (!k.enabled) return "brokerages aren't open to players";
  if (carrier.role !== "carrier") return "a brokerage is formed by a carrier";
  if (carrier.partnerId !== undefined) return "one carrier and one brokerage per owner";
  const closed = layerBlock(w, "brokerage");
  if (closed) return closed;
  const today = dayOf(w.t, w.cfg);
  if (carrier.authority.status !== "active" || (carrier.authority.barredUntil ?? 0) > today) return "the carrier's authority isn't active";
  if (carrier.liquidatingSince !== null) return "the carrier is being wound up";
  // The starting capital is a transfer out of the carrier: refused where transferCapital would refuse it (the red team's
  // E2-FORM, where a refusal after the brokerage was formed left a half-formed pair).
  if (carrier.weeksInDebt > 0) return "the carrier has paper overdue";
  if (carrier.tierGraceDay !== null) return "the carrier is under its stake";
  if (today - carrier.createdDay < k.minCarrierAgeDays) return `the carrier must be ${k.minCarrierAgeDays} days old`;
  return null;
}

/** The capital a brokerage needs at formation: its bond, its licence, and the transfer's fee on both. */
export function formationCostFd(w: World, workingFd = 0): number {
  const need = w.cfg.token.staking.roles.broker + w.cfg.permits.brokerLicenseRenewalFd + workingFd;
  return need * (1 + w.cfg.brokerage.transferFeePct);
}

/**
 * Forms the carrier's brokerage: a broker company of its own at the carrier's home hub, no grant, fresh credit, its
 * licence paid, `capitalFd` moved in from the carrier as the owner's capital (less the fee), and the bond staked out of
 * it. Returns the brokerage, or why not.
 */
export function formBrokerage(w: World, carrier: Company, name: string, capitalFd: number): Company | string {
  const why = canFormBrokerage(w, carrier);
  if (why) return refuse(w, why);
  const bond = w.cfg.token.staking.roles.broker;
  const fee = capitalFd * w.cfg.brokerage.transferFeePct;
  if (!(capitalFd > 0) || capitalFd - w.cfg.permits.brokerLicenseRenewalFd < bond) return refuse(w, `the capital must cover the ${bond} FD bond and the licence`);
  if (w.ledger.balance(companyAccount(carrier.id)) < capitalFd + fee) return refuse(w, "the carrier hasn't that much FD");
  // Everything the transfer and the stake below check has been checked by now: nothing is created unless the whole form
  // goes through (canFormBrokerage covers the transfer's guards on the carrier, the lines above its amount).
  const b = formCompany(w, { name, role: "broker", homeHubId: w.net.hubs[carrier.homeHub]!.id, strategy: `brokerage:${carrier.strategy}`, orders: [], freePath: false, human: carrier.human, grant: false });
  b.partnerId = carrier.id;
  carrier.partnerId = b.id;
  // Its first standing order (§5c): shippers tender only to a broker that has one.
  b.orders = [{ kind: "broker", marginPct: w.cfg.brokerage.defaultMarginPct, maxOpenLoads: w.cfg.brokerage.defaultOpenLoads }];
  b.vetting = w.cfg.brokerage.defaultVetting as Company["vetting"];
  brokerageLog(w).formed.push({ day: dayOf(w.t, w.cfg), carrierId: carrier.id, brokerId: b.id, capitalFd, toBrokerFd: 0, toCarrierFd: 0, feeFd: 0 });
  const moved = transferCapital(w, carrier, b, capitalFd, true);
  if (moved) throw new Error(`brokerage capital: ${moved}`); // checked above
  if (w.cfg.token.staking.enabled) {
    const staked = stakeFd(w, b, bond);
    if (staked) throw new Error(`brokerage bond: ${staked}`);
  }
  // The starting capital is the pair's `capitalFd`; later transfers count apart from it.
  brokerageLog(w).formed.find((f) => f.brokerId === b.id)!.toBrokerFd -= capitalFd;
  return b;
}

/**
 * The owner's capital transfer to its other company: equity, never revenue (no operating result, Miles, logbook, tax or
 * credit sees it), for the fee to the reserve. Refused out of a company being wound up, in its grace under its stake,
 * a brokerage under its bond with paper open, one in debt (overdue), or one the transfer and its fee would leave
 * negative.
 */
export function transferCapital(w: World, from: Company, to: Company, fd: number, formation = false): string | null {
  if (!w.cfg.brokerage.enabled) return "brokerages aren't open to players";
  if (from.partnerId !== to.id || to.partnerId !== from.id) return refuse(w, "only between an owner's own two companies");
  if (!(fd > 0.005)) return "bad amount";
  if (from.liquidatingSince !== null) return refuse(w, "the company is being wound up");
  // Under its stake: no transfer out during the grace, nor while a brokerage has paper open under its bond. Past the
  // grace with no paper (a brokerage winding down, its bond gone at the launch reset or drawn), its cash may go home.
  const paper = from.role === "broker" && (from.openBrokerLoads > 0 || w.receivables.some((r) => r.payer === from.id));
  if (from.tierGraceDay !== null && (dayOf(w.t, w.cfg) < from.tierGraceDay || paper || from.role !== "broker")) return refuse(w, "the company is under its stake");
  if (from.role === "broker" && !brokerLicensed(w, from) && paper) return refuse(w, "the brokerage is under its bond with paper open");
  if (from.weeksInDebt > 0) return refuse(w, "the company has paper overdue");
  const fee = fd * w.cfg.brokerage.transferFeePct;
  if (w.ledger.balance(companyAccount(from.id)) < fd + fee) return refuse(w, "that would leave the company negative");
  const log = brokerageLog(w);
  if (!formation && (w.ledger.balance(companyAccount(to.id)) < 0 || to.weeksInDebt > 0)) {
    log.rescues++;
    log.rescueFd += fd;
  }
  const ref = `capital:${from.id}:${to.id}`;
  if (fee > 0.005) w.ledger.post(w.t, companyAccount(from.id), "sink:capital_transfer_fee", fee, ref);
  w.ledger.post(w.t, companyAccount(from.id), companyAccount(to.id), fd, ref);
  log.transfers++;
  log.transferFd += fd;
  log.feeFd += fee;
  const pair = log.formed.find((f) => f.brokerId === from.id || f.brokerId === to.id);
  if (pair) {
    if (to.role === "broker") pair.toBrokerFd += fd;
    else pair.toCarrierFd += fd;
    pair.feeFd += fee;
  }
  return null;
}

/** Clears a lane's trailing level needs before it is trusted; and the weight of each new clear (about the last 40). */
const LANE_MIN_CLEARS = 5;
const LANE_ALPHA = 1 / 40;

/**
 * The lane's market rate per mile: its trailing cleared rate (every booking since the rule went on, sealed bids,
 * book-nows and tenders alike), or its origin market's for this trailer while the lane has too few clears, or the
 * load's own board ceiling before either has any.
 */
export function laneRate(w: World, load: Load): number {
  const log = brokerageLog(w);
  const lane = log.laneRates[load.laneId];
  if (lane && lane[1] >= LANE_MIN_CLEARS) return lane[0];
  const hub = log.hubRates[`${load.origin}:${load.equipment}`];
  if (hub && hub[1] >= LANE_MIN_CLEARS) return hub[0];
  return load.ceiling;
}

function trackClear(table: Record<string, [number, number]>, key: string, rate: number): void {
  const x = table[key];
  if (!x) table[key] = [rate, 1];
  else {
    x[0] += (x[1] < 1 / LANE_ALPHA ? 1 / (x[1] + 1) : LANE_ALPHA) * (rate - x[0]); // a plain mean until 40 clears, then trailing
    x[1]++;
  }
}

/** The lane's band for a tender to the own carrier: the hauler's pay per mile, floor to ceiling, around the lane's market rate. */
export function ownBand(w: World, load: Load): [number, number] {
  const [lo, hi] = w.cfg.brokerage.band;
  const m = laneRate(w, load);
  // R17 (board.refuseOverCeiling): no load clears above its ceiling, the own-carrier tender included (red team pass 3).
  if (w.cfg.board.refuseOverCeiling) return [Math.min(m * lo, load.ceiling), Math.min(m * hi, load.ceiling)];
  return [m * lo, m * hi];
}

const marginOf = (b: Company) => {
  const order = b.orders.find((o) => o.kind === "broker");
  return order && order.kind === "broker" ? Math.min(0.9, Math.max(0, order.marginPct)) : 0;
};

/**
 * Rule A: a carrier passes a direct contract tender to its brokerage, inside the tender's window. The load is
 * re-papered: the shipper pays the brokerage the contract rate, the brokerage posts it to the board at its margin and
 * owes whoever hauls it, under its bond cap. The carrier neither bills nor owes anything on it, and its contract counts
 * it covered once it's booked (contracts.ts coverPassed).
 */
export function passTender(w: World, carrier: Company, load: Load, atWindowEnd = false): string | null {
  const b = partnerOf(w, carrier);
  if (!b || carrier.role !== "carrier") return refuse(w, "the carrier has no brokerage");
  if (load.status !== "open" || load.tenderedTo !== carrier.id || load.contractId === 0 || load.brokerId !== null) return refuse(w, "only a direct contract tender held for you");
  if (!atWindowEnd && w.t >= load.tenderUntil) return refuse(w, "the tender's window has closed");
  const contract = w.contracts.find((k) => k.id === load.contractId);
  if (!contract || contract.status !== "active") return refuse(w, "the contract is gone");
  if (b.liquidatingSince !== null || b.authority.status !== "active") return refuse(w, "the brokerage isn't trading");
  if (!brokerLicensed(w, b)) return refuse(w, "the brokerage isn't bonded at its stake");
  if (b.tierGraceDay !== null && dayOf(w.t, w.cfg) >= b.tierGraceDay) return refuse(w, "the brokerage's grace under its stake is over");
  const ceiling = contract.ratePerMile * (1 - marginOf(b));
  const cap = apCapBlock(w, b, brokerBooks(w).get(b.id), ceiling * load.miles, true);
  if (cap) return refuse(w, "over the brokerage's bond cap");
  load.brokerId = b.id;
  load.shipperRate = contract.ratePerMile;
  load.ceiling = ceiling;
  load.bookNow = Math.min(load.bookNow, ceiling);
  load.vet = Math.max(load.vet, b.vetting) as Load["vet"];
  load.passedBy = carrier.id;
  // Held for the rest of the carrier's window, then posted (it can't be declined): holdAtEnd.
  load.hold = { brokerId: b.id, until: Math.max(w.t, load.tenderUntil), declinable: false };
  load.tenderedTo = 0;
  load.tenderUntil = 0;
  load.localUntilRound = 0;
  b.openBrokerLoads++;
  const log = brokerageLog(w);
  log.passes++;
  log.holds.held++;
  return null;
}

/**
 * Rule B: a brokerage tenders one of its shipper loads (not yet booked, not a load its own carrier passed it) straight
 * to its own carrier at `rate`, inside the lane's band. The carrier takes it like any tender (contracts.ts autoTenders,
 * the accept_tender action) or lets it lapse back to the board.
 */
export function tenderOwn(w: World, broker: Company, load: Load, rate: number): string | null {
  const c = partnerOf(w, broker);
  if (!c || broker.role !== "broker") return refuse(w, "the brokerage has no carrier");
  if (load.brokerId !== broker.id || load.status !== "open" || load.tenderedTo !== 0 || load.doubleBroker || load.shipperId !== null) return refuse(w, "only an open load of the brokerage's own");
  if (load.hold && load.hold.brokerId !== broker.id) return refuse(w, "only an open load of the brokerage's own");
  if (load.passedBy === c.id) return refuse(w, "a passed load never goes back to the carrier that passed it");
  if (c.authority.status !== "active" || c.liquidatingSince !== null) return refuse(w, "the carrier isn't trading");
  const [lo, hi] = ownBand(w, load);
  if (!(rate >= lo - 1e-9 && rate <= hi + 1e-9)) return refuse(w, "the pay is outside the lane's band");
  if (load.hold) {
    endHold(w, load); // out of the hold: to the own carrier, then the board if it lapses
    load.postedRound = w.round;
    load.roundsUnfilled = 0;
    brokerageLog(w).holds.toOwn++;
  }
  load.tenderedTo = c.id;
  load.tenderUntil = w.t + w.cfg.contracts.tenderHours * 60;
  load.ownTenderRate = rate;
  load.localUntilRound = 0;
  brokerageLog(w).ownTenders++;
  return null;
}

/**
 * The hold (the director's brief §3a, answer 1): a shipper's tender to a player's brokerage stays off the board for
 * contracts.tenderHours, an "offered to you" moment in which the owner posts it, tenders it to the own carrier or
 * declines it. AI brokers post at once, as before (freight.ts tenderToBroker).
 */
/**
 * `marginPct`: the margin the tender was drawn at (the broker's order when the shipper chose it); by default the order's
 * now. The bait-and-switch rule (the economy, 2026-11-12): the shipper's draw favors a broker by (0.25 + credit) ÷
 * margin², so a brokerage advertising 1% wins nearly every tender; it then posts the load at no more than that 1%.
 */
export function startHold(w: World, load: Load, broker: Company, marginPct?: number): void {
  if (!w.cfg.brokerage.enabled || broker.partnerId === undefined) return;
  const m = Math.min(0.9, Math.max(0, marginPct ?? brokerOrderOf(broker)?.marginPct ?? w.cfg.brokerage.defaultMarginPct));
  load.hold = { brokerId: broker.id, until: w.t + w.cfg.contracts.tenderHours * 60, declinable: true, marginPct: m };
  brokerageLog(w).holds.held++;
}

const brokerOrderOf = (b: Company) => b.orders.find((o): o is Extract<Company["orders"][number], { kind: "broker" }> => o.kind === "broker");

/**
 * A hold ends (posted, declined, or tendered to the own carrier). Delivery windows (batch 7, the economy): a shipper's
 * tender held for a player's brokerage had no window while held, and its pickup window opens now, with the lead it was
 * posted with (freight.ts), so the carriers get the window's whole 24 to 48 hours from the release.
 */
function endHold(w: World, load: Load): void {
  const lead = load.hold?.lead;
  load.hold = undefined;
  if (lead !== undefined && windowsOn(w)) openWindow(w, load, lead);
}

/**
 * Posts a held load to the board at this margin of the shipper's rate: priced and posted from this round. A shipper's
 * tender posts at no more than the margin it was drawn at (startHold), by hand or by the standing order.
 */
export function postHeld(w: World, broker: Company, load: Load, marginPct?: number, byHand = true): string | null {
  if (!load.hold || load.hold.brokerId !== broker.id || load.status !== "open") return "that tender isn't held for you";
  const asked = Math.min(0.9, Math.max(0, marginPct ?? brokerOrderOf(broker)?.marginPct ?? w.cfg.brokerage.defaultMarginPct));
  const m = load.hold.marginPct !== undefined ? Math.min(asked, load.hold.marginPct) : asked;
  load.ceiling = load.shipperRate * (1 - m);
  load.bookNow = Math.min(load.bookNow, load.ceiling);
  endHold(w, load);
  load.postedRound = w.round;
  load.roundsUnfilled = 0;
  const h = brokerageLog(w).holds;
  if (byHand) h.postedByHand++;
  else h.postedByOrder++;
  return null;
}

/** Declines a held tender: it goes on as the shipper's own spot freight on the open board, as when no broker takes one. */
export function declineHeld(w: World, broker: Company, load: Load): string | null {
  if (!load.hold || load.hold.brokerId !== broker.id || load.status !== "open") return "that tender isn't held for you";
  if (!load.hold.declinable) return "a load your carrier passed you can't be declined";
  load.brokerId = null;
  load.shipperRate = load.spotShipperRate;
  load.ceiling = load.spotShipperRate;
  load.bookNow = Math.min(load.bookNow, load.ceiling);
  endHold(w, load);
  load.postedRound = w.round;
  load.roundsUnfilled = 0;
  broker.openBrokerLoads--;
  brokerageLog(w).holds.declined++;
  return null;
}

/**
 * Each round (board.ts, after the tenders): holds whose window has ended. The standing order acts: tender to the own
 * carrier first when it says so and a truck of that trailer stands idle and crewed at the pickup's hub, inside the band;
 * else post at its margin. With no order a tender is declined; a passed load is posted at the default margin.
 */
export function holdsAtEnd(w: World): void {
  if (!w.cfg.brokerage.enabled) return;
  for (const load of w.loads.values()) {
    const h = load.hold;
    if (!h || load.status !== "open" || w.t < h.until) continue;
    const b = w.companies[h.brokerId - 1]!;
    const order = b.liquidatingSince === null ? brokerOrderOf(b) : undefined;
    if (order?.ownFirst) {
      const c = partnerOf(w, b);
      const truck = c && load.passedBy !== c.id ? (w.trucksByCompany.get(c.id) ?? []).find((t) => t.status === "idle" && t.driverId !== 0 && t.trailer === load.equipment && t.hub === load.origin) : undefined;
      if (truck) {
        const [lo, hi] = ownBand(w, load);
        if (tenderOwn(w, b, load, Math.min(hi, Math.max(lo, load.shipperRate * (1 - order.marginPct)))) === null) continue;
      }
    }
    if (order) postHeld(w, b, load, order.marginPct, false);
    else if (h.declinable) declineHeld(w, b, load);
    else {
      postHeld(w, b, load, w.cfg.brokerage.defaultMarginPct, false);
      brokerageLog(w).holds.passedPosted++;
    }
  }
}

/**
 * A pair's mark a year and two years after forming (the reports): the brokerage's operating result since it formed,
 * and what it has made for its owner (its FD now, the bond and contract accounts included, plus capital sent home,
 * less capital put in: licence, surety, fees and losses all come out of it).
 */
export function markPairs(w: World): void {
  const log = w.brokerageLog;
  if (!log) return;
  const today = dayOf(w.t, w.cfg);
  for (const f of log.formed) {
    const age = today - f.day;
    if (age !== 365 && age !== 730) continue;
    const b = w.companies[f.brokerId - 1]!;
    const held = [companyAccount(b.id), `co:stake:${b.id}`, `co:exit:${b.id}`, `co:contract:${b.id}`].reduce((x, a) => x + w.ledger.balance(a), 0);
    (f.marks ??= []).push({ days: age, operatingFd: b.operating.revenueFd - b.operating.costFd, gainFd: held + f.toCarrierFd - f.capitalFd - f.toBrokerFd });
  }
}

/** A booking cleared (board.ts assign): the rate flag's figures, and a passed load counted covered. */
export function onAssign(w: World, load: Load, carrierId: number, rate: number): void {
  const log = brokerageLog(w);
  const r = rate / laneRate(w, load);
  if (r > 0.2 && r < 5) {
    log.clears++;
    log.clearsRateOverRef += r;
  }
  // The lane's trailing level, after the comparison (a clear is measured against the market before it joined it).
  if (!(load.brokerId !== null && samePerson(w, load.brokerId, carrierId))) {
    trackClear(log.laneRates, String(load.laneId), rate);
    trackClear(log.hubRates, `${load.origin}:${load.equipment}`, rate);
  }
  if (load.brokerId !== null && samePerson(w, load.brokerId, carrierId)) {
    if (load.ownTenderRate !== undefined) {
      const [lo, hi] = w.cfg.brokerage.band;
      log.ownTendersBooked++;
      log.ownTenderFd += rate * load.miles;
      log.ownRateOverRef += r;
      if (r <= lo + 0.005 || r >= hi - 0.005) log.ownAtEdge++;
    } else {
      log.ownBoardWins++;
      log.ownBoardRateOverRef += r;
    }
  }
  if (load.passedBy !== undefined) {
    log.passesBooked++;
    coverPassed(w, load, true);
  }
}

/** A passed load fell off (board.ts giveUp): the brokerage paid the fall-off; the carrier's contract loses trust only. */
export function onFallOff(w: World, load: Load): void {
  if (load.passedBy === undefined) return;
  brokerageLog(w).passesFellOff++;
  coverPassed(w, load, false);
}
