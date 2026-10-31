import { logbookCount } from "./logbook.js";
import type { Equipment } from "@lanes/config";
import { dlog, marketMix, originWeights, destWeights as placeDestWeights, PLACE_OF_HUB } from "@lanes/data";
import { dayOf } from "./clock.js";
import { EQUIPMENT, planIndex } from "./demand.js";
import { clamp, fscPerMile, fuelPrice } from "./economics.js";
import { laneDestWeights, reloadFactor } from "./freight.js";
import { dispatchProfile, salesContracts, salesRatePremium } from "./labor.js";
import { companyAccount } from "./ledger.js";
import { resting } from "./standingOrders.js";
import type { Company, Contract, Load, StandingOrder, Truck } from "./types.js";
import { crewed, hubMiles, placeMiles, type World } from "./world.js";

/**
 * Shipper leverage, local-first tendering and contracts (Jeff's design, 2026-10-28).
 *
 * The fewer trucks a market has per load, the more its shippers open to outside
 * carriers; the more trucks pile up, the more they work with carriers based nearby:
 * a share of each market's loads is tendered to local carriers only for the first
 * round. Local shippers also offer contract lanes to local carriers: a weekly volume
 * at a fixed rate priced off the market's trailing level, for a term. Each tender can
 * be accepted or left for the spot board; rejecting to chase spot costs trust, volume,
 * and for a while the local-first access that earns the next contract.
 */

const today = (w: World) => dayOf(w.t, w.cfg);
const LN2 = 0.6931471805599453;

/** The share of a market's loads its shippers tender to local carriers first, by trailer. */
export function localShare(w: World, hub: number, eq: Equipment): number {
  const k = w.cfg.leverage;
  const ratio = w.reloadIndex[planIndex(hub, EQUIPMENT.indexOf(eq))] ?? 1;
  return clamp(k.localShareAtBalance - (k.localShareSlope * dlog(Math.max(0.01, ratio))) / LN2, k.localShareClamp[0], k.localShareClamp[1]);
}

/** A load still in its local-first window. */
export const localOnly = (w: World, load: Load): boolean => load.localUntilRound > 0 && w.round <= load.localUntilRound;

/** A carrier counts as local to a market when it's based within the nearby radius and hasn't burned its shippers lately. */
export function isLocal(w: World, c: Company, hub: number): boolean {
  return hubMiles(w, c.homeHub, hub) <= w.cfg.map.nearbyRadiusMi && c.localBanUntilDay <= today(w);
}

/** Whether this company may take a load at all: the local-first window and tenders to someone else keep others off. */
export function mayTake(w: World, c: Company, load: Load): boolean {
  if (load.tenderedTo !== 0 && load.tenderedTo !== c.id) return false;
  if (localOnly(w, load) && !isLocal(w, c, load.origin)) return false;
  return true;
}

/** What a local shipper offers per mile on a lane: the market's trailing contract level, like the brokers get. */
export function contractRate(w: World, origin: number, dest: number, eq: Equipment): number {
  const { cfg, net } = w;
  const lane = net.lanesFrom[origin]!.find((l) => l.dest === dest);
  if (!lane) return 0;
  const idx = w.contractIndex[planIndex(origin, EQUIPMENT.indexOf(eq))];
  const level = idx === undefined || Number.isNaN(idx) ? 1 : idx;
  const fsc = fscPerMile(cfg, fuelPrice(w));
  const toll = cfg.roads.tollsInRates ? lane.tollFd / lane.miles : 0;
  return lane.baseRate * level * cfg.rates.equipmentPremium[eq] * reloadFactor(w, dest, eq) * cfg.contracts.rateVsIndex + fsc + toll;
}

const contractOrder = (c: Company) => c.orders.find((o): o is Extract<StandingOrder, { kind: "contracts" }> => o.kind === "contracts");

export const activeContracts = (w: World, companyId: number): Contract[] => w.contracts.filter((k) => k.carrierId === companyId && k.status === "active");

/** Direct freight (contracts.direct): the contracts a carrier can carry, its sales reps' book; else the flat cap. */
export function contractSlots(w: World, c: Company): number {
  return w.cfg.contracts.direct.enabled ? salesContracts(w, c) : w.cfg.contracts.maxPerCompany;
}

/** Direct freight: the loads a week this carrier's own trucks of this trailer can still take on (no limit when off). */
export function contractRoom(w: World, c: Company, eq: Equipment): number {
  if (!w.cfg.contracts.direct.enabled) return Infinity;
  let trucks = 0;
  for (const t of w.trucksByCompany.get(c.id) ?? []) if (t.trailer === eq && t.status !== "retired" && t.status !== "listed" && t.status !== "parked") trucks++;
  const held = w.contracts.filter((k) => k.carrierId === c.id && k.equipment === eq && (k.status === "active" || k.status === "offered")).reduce((s, k) => s + k.loadsPerWeek, 0);
  return trucks * w.cfg.contracts.direct.loadsPerTruckWeek - held;
}

export const contractStakeAccount = (id: number): string => `co:contractstake:${id}`;

/** A contract's freight for a week at its rate, on its lane's miles. */
function weeklyValue(w: World, k: Contract): number {
  const lane = w.net.lanesFrom[k.origin]!.find((l) => l.id === k.laneId);
  return k.loadsPerWeek * (lane?.miles ?? 0) * k.ratePerMile;
}

/** A contract ends: its performance stake (what's left of it) goes back to the carrier. */
function endContract(w: World, k: Contract): void {
  k.status = "ended";
  const left = w.ledger.balance(contractStakeAccount(k.id));
  if (left > 0.005) w.ledger.post(w.t, contractStakeAccount(k.id), companyAccount(k.carrierId), left, `contract:${k.id}`);
  k.stakeFd = 0;
}
export const offeredContracts = (w: World, companyId: number): Contract[] => w.contracts.filter((k) => k.carrierId === companyId && k.status === "offered");

function note(w: World, companyId: number, text: string, tone: "good" | "bad" | "info"): void {
  w.listener?.({ kind: "notice", companyId, topic: "contracts", text, tone });
}

/** Weekly: offers expire or are taken, terms end or renew, unreliable carriers lose volume, and new offers go out. */
export function weeklyContracts(w: World): void {
  const { cfg } = w;
  const k = cfg.contracts;
  const day = today(w);
  const rng = w.rng.contracts;
  for (const c of w.contracts) {
    if (c.status === "offered") {
      const carrier = w.companies[c.carrierId - 1]!;
      const order = contractOrder(carrier);
      const taken = order?.acceptOffers && carrier.authority.status === "active" && activeContracts(w, carrier.id).length < contractSlots(w, carrier) && acceptOffer(w, carrier, c) === null;
      if (!taken && day >= c.offerExpiresDay) c.status = "ended";
      continue;
    }
    if (c.status !== "active") continue;
    const carrier = w.companies[c.carrierId - 1]!;
    if (carrier.authority.status !== "active" || carrier.liquidatingSince !== null) {
      endContract(w, c);
      continue;
    }
    if (day >= c.endDay) {
      endContract(w, c);
      if (c.acceptance >= k.renewAbove) logbookCount(carrier, "contractsKept");
      if (c.acceptance >= k.renewAbove) {
        const rate = contractRate(w, c.origin, c.dest, c.equipment);
        offer(w, carrier, c.origin, c.dest, c.equipment, c.originPlace, c.destPlace, c.loadsPerWeek, rate);
        note(w, carrier.id, `Your ${w.net.hubs[c.origin]!.id}→${w.net.hubs[c.dest]!.id} ${c.equipment} contract ended with ${Math.round(c.acceptance * 100)}% acceptance; the shipper offers a new term at ${rate.toFixed(2)}/mi.`, "good");
      } else note(w, carrier.id, `Your ${w.net.hubs[c.origin]!.id}→${w.net.hubs[c.dest]!.id} ${c.equipment} contract ended; at ${Math.round(c.acceptance * 100)}% acceptance the shipper isn't renewing.`, "bad");
      continue;
    }
    // Rejections cost volume, and the shippers talk.
    if (c.tendered >= k.afterTenders && c.acceptance < k.cutBelow && !c.cut) {
      c.cut = true;
      c.loadsPerWeek--;
      carrier.localBanUntilDay = day + cfg.leverage.unreliableDays;
      if (c.loadsPerWeek <= 0) {
        endContract(w, c);
        note(w, carrier.id, `The shipper pulled your ${w.net.hubs[c.origin]!.id}→${w.net.hubs[c.dest]!.id} contract: too many tenders turned down. Local shippers will pass you over for ${cfg.leverage.unreliableDays} days.`, "bad");
      } else note(w, carrier.id, `Your ${w.net.hubs[c.origin]!.id}→${w.net.hubs[c.dest]!.id} contract was cut to ${c.loadsPerWeek} a week for turning down tenders, and local shippers will pass you over for ${cfg.leverage.unreliableDays} days.`, "bad");
    }
  }
  w.contracts = w.contracts.filter((c) => c.status !== "ended" || day - c.endDay < 60);

  // New offers: at each market, shippers pick local carriers in good standing, more of them where trucks pile up.
  const month = Math.floor(((day % cfg.time.daysPerSeason) / cfg.time.daysPerSeason) * 12);
  for (let m = 0; m < w.net.hubs.length; m++) {
    const locals = w.companies.filter((c) => c.role === "carrier" && c.authority.status === "active" && c.liquidatingSince === null && isLocal(w, c, m) && activeContracts(w, c.id).length + offeredContracts(w, c.id).length < contractSlots(w, c));
    if (locals.length === 0) continue;
    for (const eq of EQUIPMENT) {
      // Only carriers that run this trailer.
      const fit = locals.filter((c) => w.trucksByCompany.get(c.id)!.some((t) => t.trailer === eq && t.status !== "retired" && t.status !== "listed") && contractRoom(w, c, eq) >= 1);
      if (fit.length === 0) continue;
      const share = localShare(w, m, eq);
      // Expected offers this week; the fraction is a draw, so a market with one local carrier still sees offers.
      const expected = fit.length * k.offerShareOfLocals * share * 2;
      const n = Math.min(fit.length, Math.floor(expected) + (rng.next() < expected - Math.floor(expected) ? 1 : 0));
      if (n <= 0) continue;
      // Standing: reputation and how they've treated tenders before; a carrier with no contract yet gets a look first; a seeded draw breaks ties.
      const ranked = fit
        .map((c) => ({ c, s: c.reputation * (0.5 + 0.5 * c.tenderAcceptance) * (activeContracts(w, c.id).length === 0 ? k.newcomerBoost : 1) + rng.next() * 0.1 }))
        .sort((a, b) => b.s - a.s || a.c.id - b.c.id)
        .slice(0, n);
      const weights = laneDestWeights(cfg, w.net, m, eq);
      const lanes = w.net.lanesFrom[m]!;
      for (const { c } of ranked) {
        if (lanes.length === 0) break;
        const lane = lanes[rng.weighted(weights)]!;
        const mix = marketMix(w.net.economy, m, eq, month);
        let originPlace = PLACE_OF_HUB[m]!;
        let destPlace = PLACE_OF_HUB[lane.dest]!;
        if (mix.length > 0) {
          const commodity = mix[rng.weighted(mix.map((x) => x.weight))]!.commodity;
          const o = originWeights(w.net.economy, m, commodity, month);
          if (o.length > 0) originPlace = o[rng.weighted(o.map((x) => x.weight))]!.place;
          const d = placeDestWeights(w.net.economy, lane.dest, commodity);
          if (d.length > 0) destPlace = d[rng.weighted(d.map((x) => x.weight))]!.place;
        }
        // Direct freight: a sales rep wins a better rate, and the volume fits what the fleet can haul.
        const rate = contractRate(w, m, lane.dest, eq) * (k.direct.enabled ? 1 + salesRatePremium(w, c) : 1);
        if (!(rate > 0)) continue;
        offer(w, c, m, lane.dest, eq, originPlace, destPlace, Math.min(rng.int(k.loadsPerWeek[0], k.loadsPerWeek[1]), contractRoom(w, c, eq)), rate);
      }
    }
  }
}

function offer(w: World, c: Company, origin: number, dest: number, eq: Equipment, originPlace: number, destPlace: number, loadsPerWeek: number, rate: number): Contract {
  const k = w.cfg.contracts;
  const day = today(w);
  const lane = w.net.lanesFrom[origin]!.find((l) => l.dest === dest)!;
  const contract: Contract = {
    id: w.nextContractId++,
    carrierId: c.id,
    origin,
    dest,
    laneId: lane.id,
    equipment: eq,
    originPlace,
    destPlace,
    ratePerMile: rate,
    loadsPerWeek,
    startDay: 0,
    endDay: 0,
    offerExpiresDay: day + k.offerDays,
    tendered: 0,
    accepted: 0,
    acceptance: 1,
    cut: false,
    status: "offered",
    stakeFd: 0,
  };
  w.contracts.push(contract);
  note(w, c.id, `${w.net.places[originPlace]!.name} shipper offers a contract: ${w.net.hubs[origin]!.id}→${w.net.hubs[dest]!.id} ${eq}, ${loadsPerWeek} a week at ${rate.toFixed(2)}/mi for ${k.termDays} days.`, "info");
  return contract;
}

export function acceptOffer(w: World, c: Company, contract: Contract): string | null {
  if (contract.carrierId !== c.id || contract.status !== "offered") return "that offer isn't yours to take";
  const slots = contractSlots(w, c);
  if (activeContracts(w, c.id).length >= slots) return w.cfg.contracts.direct.enabled ? `your sales reps carry ${slots} contracts` : `you can hold ${slots} contracts at a time`;
  // Direct freight: a performance stake against the contract, slashed to make the shipper whole when a tender is turned down.
  const d = w.cfg.contracts.direct;
  if (d.enabled) {
    const stake = d.stakeWeeks * weeklyValue(w, contract);
    if (w.ledger.balance(companyAccount(c.id)) < stake) return "not enough FD for the contract's performance stake";
    if (stake > 0.005) w.ledger.post(w.t, companyAccount(c.id), contractStakeAccount(contract.id), stake, `contract:${contract.id}`);
    contract.stakeFd = stake;
  }
  const day = today(w);
  contract.status = "active";
  contract.startDay = day;
  contract.endDay = day + w.cfg.contracts.termDays;
  return null;
}

export function declineOffer(w: World, c: Company, contract: Contract): string | null {
  if (contract.carrierId !== c.id || contract.status !== "offered") return "that offer isn't yours";
  contract.status = "ended";
  return null;
}

/** Each round, after posting: a tender is a load created for the contract's lane, held for its carrier until the next round. */
export function tenderOdds(w: World, c: Contract): number {
  return c.loadsPerWeek / (7 * w.cfg.time.boardRoundHours.length);
}

/** Marks a freshly posted load as a tender under a contract. */
export function tender(w: World, load: Load, c: Contract): void {
  load.contractId = c.id;
  load.tenderedTo = c.carrierId;
  load.tenderUntil = w.t + w.cfg.contracts.tenderHours * 60;
  load.localUntilRound = 0;
  load.originPlace = c.originPlace;
  load.destPlace = c.destPlace;
  note(w, c.carrierId, `Tender: ${w.net.places[load.originPlace]!.name} → ${w.net.places[load.destPlace]!.name} at your contract rate ${c.ratePerMile.toFixed(2)}/mi (spot is ${load.bookNow.toFixed(2)}). Accept before ${w.cfg.contracts.tenderHours} h are up or it goes to the board.`, "info");
}

function record(w: World, c: Contract, accepted: boolean): void {
  const a = w.cfg.contracts.acceptanceAdjust;
  c.tendered++;
  if (accepted) c.accepted++;
  c.acceptance = c.acceptance * (1 - a) + (accepted ? 1 : 0) * a;
  const carrier = w.companies[c.carrierId - 1]!;
  carrier.tenderAcceptance = carrier.tenderAcceptance * (1 - a) + (accepted ? 1 : 0) * a;
}

/** Tenders nobody accepted in time go to the open board at spot. */
export function expireTenders(w: World): void {
  for (const load of w.loads.values()) {
    if (load.tenderedTo === 0 || load.status !== "open" || w.t < load.tenderUntil) continue;
    rejectTender(w, load);
  }
}

export function rejectTender(w: World, load: Load): void {
  const c = w.contracts.find((k) => k.id === load.contractId);
  if (c) {
    record(w, c, false);
    // Direct freight: the stake makes the shipper whole, what moving it at spot costs over the contract plus a fee.
    const d = w.cfg.contracts.direct;
    if (d.enabled && c.stakeFd > 0.005) {
      const owed = (Math.max(0, load.bookNow - c.ratePerMile) + d.failFee * c.ratePerMile) * load.miles;
      const slash = Math.min(owed, w.ledger.balance(contractStakeAccount(c.id)));
      if (slash > 0.005) w.ledger.post(w.t, contractStakeAccount(c.id), "sink:contract_failure", slash, `contract:${c.id}`);
      c.stakeFd = w.ledger.balance(contractStakeAccount(c.id));
      if (c.stakeFd <= 0.01 && c.status === "active") {
        endContract(w, c);
        note(w, c.carrierId, `The shipper pulled your ${w.net.hubs[c.origin]!.id}→${w.net.hubs[c.dest]!.id} contract: the performance stake is spent on loads you didn't cover.`, "bad");
      }
    }
  }
  load.tenderedTo = 0;
  load.tenderUntil = 0;
}

/** Takes a tender at the contract rate onto an idle truck within reach. */
/** A tendered load its carrier books through the ordinary board (a bid, a book-now) counts as the tender accepted. */
export function settleTender(w: World, company: Company, load: Load): void {
  if (load.tenderedTo !== company.id) return;
  const c = w.contracts.find((k) => k.id === load.contractId);
  if (c) record(w, c, true);
  load.tenderedTo = 0;
  load.tenderUntil = 0;
}

export function acceptTender(w: World, company: Company, load: Load, truck: Truck): string | null {
  const c = w.contracts.find((k) => k.id === load.contractId);
  if (!c || load.tenderedTo !== company.id || load.status !== "open") return "that tender isn't open to you";
  if (truck.companyId !== company.id || truck.status !== "idle" || !crewed(truck)) return "the truck isn't idle with a driver";
  if (truck.trailer !== load.equipment) return "wrong trailer";
  // Assignment is the board's job (bookLoad with the contract rate); the caller passes it on.
  record(w, c, true);
  load.tenderedTo = 0;
  load.tenderUntil = 0;
  return null;
}

/**
 * Hourly, with auto-booking: dispatchers with a contracts order take tenders onto an
 * idle truck within reach, unless the order says to chase spot and spot is far enough
 * above the contract. Returns the bookings to make (the board assigns them).
 */
export function autoTenders(w: World): { company: Company; load: Load; truck: Truck; rate: number; dh: number }[] {
  const out: { company: Company; load: Load; truck: Truck; rate: number; dh: number }[] = [];
  const taken = new Set<number>();
  for (const load of w.loads.values()) {
    if (load.tenderedTo === 0 || load.status !== "open") continue;
    const company = w.companies[load.tenderedTo - 1]!;
    const order = contractOrder(company);
    const c = w.contracts.find((k) => k.id === load.contractId);
    if (!order || !c) continue;
    if (order.spotAbovePct !== null && load.bookNow > c.ratePerMile * (1 + order.spotAbovePct)) continue; // chasing spot: let it lapse
    const fleet = w.trucksByCompany.get(company.id)!;
    const team = dispatchProfile(w, company, fleet.filter((t) => t.status !== "parked" && t.status !== "listed").length);
    let best: { truck: Truck; dh: number } | null = null;
    for (const truck of fleet) {
      if (truck.status !== "idle" || !crewed(truck) || resting(w, truck) || taken.has(truck.id) || truck.trailer !== load.equipment) continue;
      if (team.coverage < 1 && w.rng.dispatch.next() >= team.coverage) continue;
      const dh = placeMiles(w, truck.place, load.originPlace);
      if (dh > order.maxDeadheadMi) continue;
      if (!best || dh < best.dh) best = { truck, dh };
    }
    if (!best) continue;
    taken.add(best.truck.id);
    out.push({ company, load, truck: best.truck, rate: c.ratePerMile, dh: best.dh });
  }
  return out;
}
