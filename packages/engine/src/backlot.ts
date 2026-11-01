/**
 * The Back Lot v2 (config `robbery.lot`; Jeff, 2026-11-01, the morning after the switch-on).
 *
 * Crews are hired on the lot's own board, not on Channel 19: NPC crews with a skill, a discretion and a price,
 * refreshed weekly from the seed. The fee is prepaid and burned, keyed to what the boards would pay for the truck
 * as it stands, so a load of paper never pays and a load of electronics pays when the truck is bare. The victim
 * is a victim: the claim less the deductible, the rig at its cover less the deductible. A bare truck sleeping
 * outside a truck stop or a secured yard is an easy mark; every fitting, a security manager and the yard's own
 * security cut the odds, and the hirer can't see any of it. A caught crew may talk, and a crew that talks is the
 * biggest heat event for its hirer: heat is the law's interest, private to the company, decaying with time and
 * faster when it lays low, feeding weigh-station pull-ins and compliance reviews, which become investigations
 * at `investigateAt`; a conviction forfeits the criminal unlocks, fines a multiple of the last quarter's fees
 * and suspends the authority. The NPC fence and chop shop are the only buyers, at a public demand board that
 * sags as stolen supply of a kind comes in and recovers over the weeks. Channel 19 is a forum: it hears of hits
 * and caught crews after the fact, never of a hire. No cooldown, no newcomer shield: the free path's rigs carry
 * the lessor's tracker and its policy carries the cargo deductible instead.
 */
import { COMMODITIES } from "@lanes/data";
import type { TractorTier } from "@lanes/config";
import { dayOf } from "./clock.js";
import { truckValue } from "./dealer.js";
import { fmtInt } from "./economics.js";
import { securityTheftMult } from "./labor.js";
import { companyAccount } from "./ledger.js";
import { fine, record } from "./safety.js";
import { convictionForfeit } from "./token.js";
import type { Company, Load, Truck, YardItem } from "./types.js";
import type { World } from "./world.js";
import type { CrewJob } from "./robbery.js";

export interface Crew {
  id: number;
  name: string;
  skill: number;
  discretion: number;
  priceMult: number;
}

export interface BackLotState {
  crews: Crew[];
  nextCrewId: number;
  refreshedDay: number;
  /** The demand board: commodities (and a tier) paying `hotMult` this week, and the stolen supply of each kind lately. */
  hot: string[];
  hotTier: TractorTier | null;
  supply: Record<string, number>;
  supplyTier: Record<string, number>;
  lastHireDay: Map<number, number>;
}

export const newBackLotState = (): BackLotState => ({ crews: [], nextCrewId: 1, refreshedDay: -1, hot: [], hotTier: null, supply: {}, supplyTier: {}, lastHireDay: new Map() });

export const lotOn = (w: World): boolean => w.cfg.robbery.enabled && w.cfg.robbery.lot.enabled;
const today = (w: World) => dayOf(w.t, w.cfg);
export const YARD_ITEMS: YardItem[] = ["yardGate", "yardCameras", "yardLighting", "yardGuard"];
export const isYardItem = (item: string): item is YardItem => (YARD_ITEMS as string[]).includes(item);
const TOWNS = ["Memphis", "Laredo", "Jersey", "Bakersfield", "Tulsa", "Gary", "Mobile", "Reno", "Fresno", "Toledo", "Macon", "Odessa"];
const GANGS = ["boys", "crew", "brothers", "outfit", "cousins", "twins", "regulars"];
const TIERS: TractorTier[] = ["workhorse", "highwayPro", "flagship"];
const round2 = (x: number) => Math.round(x * 100) / 100;

/** The boards refresh: new crews, this week's hot commodities, maybe a hot tier. */
export function refreshBoard(w: World): void {
  const k = w.cfg.robbery.lot;
  const day = today(w);
  if (w.backlot.refreshedDay >= 0 && day - w.backlot.refreshedDay < k.crews.refreshDays) return;
  const rng = w.rng.fraud;
  const between = (r: readonly [number, number]) => r[0] + rng.next() * (r[1] - r[0]);
  w.backlot.refreshedDay = day;
  w.backlot.crews = [];
  for (let i = 0; i < k.crews.count; i++) {
    const name = `the ${TOWNS[Math.floor(rng.next() * TOWNS.length)]} ${GANGS[Math.floor(rng.next() * GANGS.length)]}`;
    w.backlot.crews.push({ id: w.backlot.nextCrewId++, name, skill: round2(between(k.crews.skill)), discretion: round2(between(k.crews.discretion)), priceMult: round2(between(k.crews.priceMult)) });
  }
  const ids = COMMODITIES.map((c) => c.id);
  const hot: string[] = [];
  while (hot.length < Math.min(k.board.hotCount, ids.length)) {
    const id = ids[Math.floor(rng.next() * ids.length)]!;
    if (!hot.includes(id)) hot.push(id);
  }
  w.backlot.hot = hot;
  w.backlot.hotTier = rng.next() < 0.5 ? TIERS[Math.floor(rng.next() * TIERS.length)]! : null;
}

const sagMult = (w: World, recentFd: number): number => Math.max(w.cfg.robbery.lot.board.minMult, 1 - recentFd * w.cfg.robbery.lot.board.sagPerFd);

/** What the fence board pays for a commodity, as a multiple of its share: hot this week, sagging with recent supply. */
export function fenceBoardMult(w: World, commodityId: string): number {
  return (w.backlot.hot.includes(commodityId) ? w.cfg.robbery.lot.board.hotMult : 1) * sagMult(w, w.backlot.supply[commodityId] ?? 0);
}

/** The fence board's price for a load aboard. */
export function fenceBoardPrice(w: World, load: Load): number {
  const k = w.cfg.robbery;
  const id = COMMODITIES[load.commodity]?.id ?? "";
  const share = k.fenceByCommodity[id] ?? k.fenceShare;
  return share * load.cargoValue * fenceBoardMult(w, id);
}

export function chopBoardMult(w: World, tier: TractorTier): number {
  return (w.backlot.hotTier === tier ? w.cfg.robbery.lot.board.hotMult : 1) * sagMult(w, w.backlot.supplyTier[tier] ?? 0);
}

/** The chop board's price for a rig. */
export function chopBoardPrice(w: World, truck: Truck): number {
  return w.cfg.robbery.lot.board.chopShareByTier[truck.tier] * truckValue(w, truck) * chopBoardMult(w, truck.tier);
}

/** A crew's fee for a truck as it stands: a share of what the boards would pay, never under the minimum, at the crew's price. */
export function lotFeeFd(w: World, truck: Truck, crew: Pick<Crew, "priceMult">): number {
  const k = w.cfg.robbery;
  const load = truck.loadId !== null ? w.loads.get(truck.loadId) : undefined;
  const expected = (load && truck.status === "loaded" ? fenceBoardPrice(w, load) : 0) + k.rigShare * chopBoardPrice(w, truck);
  return Math.max(k.lot.feeMinFd, k.lot.feeShareOfBoard * expected) * crew.priceMult;
}

/** A crew on the board by id, or the first one listed. */
export function crewById(w: World, id: number | undefined): Crew | undefined {
  if (w.backlot.crews.length === 0) refreshBoard(w);
  return id === undefined ? w.backlot.crews[0] : w.backlot.crews.find((c) => c.id === id);
}

/** The share of a crew's odds a company's yard security takes away (all of it at 1). */
export function yardCut(w: World, c: Company): number {
  if (!lotOn(w) || c.yard === "none") return 0;
  let cut = 0;
  for (const item of YARD_ITEMS) if (c.yardSecurity?.[item]) cut += w.cfg.robbery.lot.yard[item].cut;
  return Math.min(1, cut);
}

export type LotWhere = "road" | "yard" | "truckStop";

/** A crew's odds against a truck where it sleeps: bare, fitted, at a secured yard, with a security manager; the crew's skill. */
export function lotOdds(w: World, truck: Truck, victim: Company, crew: Pick<Crew, "skill">, where: LotWhere): number {
  if (where === "truckStop") return 0;
  const k = w.cfg.robbery.lot;
  const sec = truck.security ?? {};
  let cut = 0;
  if (sec.tracker || (k.lessorTracker && truck.lease !== "owned")) cut += k.cuts.tracker;
  if (sec.locks) cut += k.cuts.locks;
  if (sec.camera) cut += k.cuts.camera;
  if (where === "yard") cut += yardCut(w, victim);
  const skill = 1 - k.skillSpan * (1 - crew.skill);
  return Math.min(k.maxOdds, k.baseOdds * Math.max(0, 1 - cut) * skill * securityTheftMult(w, victim));
}

// --- Heat --------------------------------------------------------------------------------------

export const heatOf = (c: Company): number => c.heat ?? 0;

export function addHeat(c: Company, amount: number): void {
  c.heat = Math.min(100, Math.max(0, heatOf(c) + amount));
}

/** What heat adds to the weigh-station pull-in odds (safety.ts). */
export function heatPullInAdd(w: World, c: Company): number {
  return lotOn(w) ? (heatOf(c) / 100) * w.cfg.robbery.lot.heat.pullInAtMax : 0;
}

/** What heat adds to the weekly odds of a compliance review (safety.ts). */
export function heatReviewOdds(w: World, c: Company): number {
  return lotOn(w) ? (heatOf(c) / 100) * w.cfg.robbery.lot.heat.reviewAtMax : 0;
}

/** Fees a company paid the lot in the last `days`. */
export function lotFeesRecent(w: World, c: Company, days: number): number {
  const since = today(w) - days;
  let fd = 0;
  for (const j of w.robbery.jobs) if (j.hirerId === c.id && j.hiredDay >= since) fd += j.feeFd ?? 0;
  return fd;
}

/**
 * A compliance review of a hot company becomes an investigation (safety.ts complianceReview): the auditor finds the
 * lot's books at odds rising with heat. A conviction forfeits the criminal unlocks, fines a multiple of the last
 * quarter's fees, suspends the authority and halves the heat; a clean file cools it a little. Returns the text for
 * the record.
 */
export function investigate(w: World, c: Company): string {
  const k = w.cfg.robbery.lot.heat;
  const heat = heatOf(c);
  if (!lotOn(w) || heat < k.investigateAt) return "";
  w.robbery.stats.investigations++;
  if (w.rng.safety.next() >= k.findAtMax * (heat / 100)) {
    addHeat(c, -k.investigateAt / 3);
    return " Investigated on suspicion of hiring crews: nothing stuck.";
  }
  const fineFd = Math.round(k.fineMultOfFees * lotFeesRecent(w, c, 90));
  if (fineFd > 0) fine(w, c, fineFd, `lot:${c.id}`);
  convictionForfeit(w, c);
  c.authority.status = "suspended";
  c.authority.suspendedUntil = today(w) + k.suspendDays;
  c.heat = heat / 2;
  w.robbery.stats.convictions++;
  w.robbery.stats.finesFd += fineFd;
  w.robbery.stats.suspensions++;
  w.metrics.onConviction();
  const text = ` Convicted of hiring crews: ${fmtInt(fineFd)} FD in fines, authority suspended ${k.suspendDays} days.`;
  record(w, c, `Investigation:${text}`);
  return text;
}

/**
 * Daily (robbery.ts dailyRobbery): the boards refresh and the stolen supply they saw fades; heat cools, faster for a
 * company that lays low; the guard is paid weekly; and a crew on a truck that spent the night standing at a hub
 * strikes there, past the yard's security at its owner's yard, in the open anywhere else.
 */
export function dailyBackLot(w: World, strike: (job: CrewJob, truck: Truck, victim: Company, where: LotWhere) => void): void {
  if (!lotOn(w)) return;
  const k = w.cfg.robbery.lot;
  const day = today(w);
  refreshBoard(w);
  const fade = 1 - 1 / k.board.recoverDays;
  for (const id of Object.keys(w.backlot.supply)) w.backlot.supply[id]! *= fade;
  for (const id of Object.keys(w.backlot.supplyTier)) w.backlot.supplyTier[id]! *= fade;
  for (const c of w.companies) {
    if (heatOf(c) > 0) {
      const last = w.backlot.lastHireDay.get(c.id);
      const quiet = last === undefined || day - last >= k.heat.quietDays;
      addHeat(c, -k.heat.decayPerDay * (quiet ? k.heat.quietMult : 1));
    }
    if (day % 7 === 0 && c.yardSecurity?.yardGuard && c.liquidatingSince === null) {
      const pay = k.yard.yardGuard.weeklyFd;
      if (pay > 0.005) {
        w.ledger.post(w.t, companyAccount(c.id), "sink:yard_security", pay, `yard:guard:${c.id}`);
        c.operating.costFd += pay;
        w.robbery.stats.yardSecurityFd += pay;
      }
    }
  }
  for (const j of w.robbery.jobs) {
    if (j.status !== "out") continue;
    const t = w.trucks[j.truckId - 1];
    if (!t || t.companyId !== j.victimId || (t.status !== "idle" && t.status !== "parked")) continue;
    const victim = w.companies[j.victimId - 1]!;
    strike(j, t, victim, t.hub === victim.homeHub ? "yard" : "road");
  }
}
