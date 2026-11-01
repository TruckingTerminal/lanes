/**
 * Hired robbers (config `robbery`; Jeff, 2026-10-31): player against player, in the open.
 *
 * A company hires a crew against one target truck: the fee is a sink, and the hire goes on the public feed
 * (Channel 19) at once, with a warning to the target's owner. The crew strikes the next night the truck
 * sleeps outside a truck stop where theft runs high (the corridors), within its window; a truck that sleeps
 * at a truck stop is out of its reach that night. Its odds rise with the place's risk and fall with the
 * victim's security: fittings on the truck (up to `security.slots`) and a security manager. A hit takes the
 * load if there is one (its cover pays the cargo, as for the NPC thieves) and, at `rigShare` odds, the rig
 * itself, chopped (the victim's physical-damage cover pays it). The hirer is paid the fence's share of what
 * was taken, less the cost of washing it. No police: what follows is between players.
 * New companies are off limits for `protectDays`; a victim can't be targeted again for `cooldownDays`; a
 * hirer needs equity of at least `stakeCover` × the most the crew could take, so it has something to lose.
 *
 * The Back Lot (2026-11-01; the bad-actor spec §8), each piece behind its switch: the fence's share by
 * commodity; a real stake locked behind the hire that pays the victim's uninsured loss first; one crew on a
 * company at a time; only operating companies hire, and their crews end with their authority; fences and
 * chop shops as player businesses that buy what crews take (the reserve's fence pays less when there's none);
 * the take spend-only; bounties, FD put up on a company and paid to whoever's crew hits it; and notoriety,
 * the hires a company made lately, on Channel 19 and its scorecard, with no penalty from the game.
 */
import { COMMODITIES } from "@lanes/data";
import { layerBlock } from "./ladder.js";
import { logbookCount } from "./logbook.js";
import { writeOffRig } from "./assets.js";
import { dayOf } from "./clock.js";
import { truckValue } from "./dealer.js";
import { securityTheftMult } from "./labor.js";
import { companyAccount } from "./ledger.js";
import { stealCargo } from "./risk.js";
import type { Business, Company, Load, Truck } from "./types.js";
import type { World } from "./world.js";

export type SecurityItem = "tracker" | "locks" | "camera";
export const SECURITY_ITEMS: SecurityItem[] = ["tracker", "locks", "camera"];

export interface CrewJob {
  id: number;
  hirerId: number;
  victimId: number;
  truckId: number;
  hiredDay: number;
  expiresDay: number;
  status: "out" | "hit" | "missed" | "cancelled";
  /** The stake locked behind the hire (robbery.realStake), in its own account until the crew is done. */
  stakeFd?: number;
}

export interface Bounty {
  id: number;
  posterId: number;
  targetId: number;
  fd: number;
  day: number;
  expiresDay: number;
  status: "open" | "paid" | "expired";
}

export interface FeedItem {
  day: number;
  kind: "hire" | "hit" | "missed" | "cancelled" | "bounty" | "bountyPaid";
  hirerId: number;
  victimId: number;
  truckId: number;
  text: string;
}

export interface RobberyState {
  jobs: CrewJob[];
  feed: FeedItem[];
  lastHitDay: Map<number, number>;
  bounties: Bounty[];
  /** The Back Lot's resales: a fence's or chop shop's income from what it bought, paid on its day. */
  resales: { businessId: number; fd: number; day: number; kind: "fence" | "chopShop" }[];
  stats: {
    hires: number;
    hits: number;
    rigsTaken: number;
    cargoTakenFd: number;
    takePaidFd: number;
    feesFd: number;
    fittingsFd: number;
    fencePaidFd: number;
    chopPaidFd: number;
    resaleFd: number;
    bountiesPostedFd: number;
    bountiesPaidFd: number;
    victimsPaidFd: number;
    stakesLockedFd: number;
  };
}

export const newRobberyState = (): RobberyState => ({
  jobs: [],
  feed: [],
  lastHitDay: new Map(),
  bounties: [],
  resales: [],
  stats: { hires: 0, hits: 0, rigsTaken: 0, cargoTakenFd: 0, takePaidFd: 0, feesFd: 0, fittingsFd: 0, fencePaidFd: 0, chopPaidFd: 0, resaleFd: 0, bountiesPostedFd: 0, bountiesPaidFd: 0, victimsPaidFd: 0, stakesLockedFd: 0 },
});

export const crewStakeAccount = (jobId: number) => `co:crewstake:${jobId}`;
export const bountyAccount = (bountyId: number) => `co:bounty:${bountyId}`;

const today = (w: World) => dayOf(w.t, w.cfg);
const name = (w: World, id: number) => w.companies[id - 1]?.name ?? `#${id}`;

function post(w: World, item: Omit<FeedItem, "day">, notifyVictim: string | null): void {
  const f = { day: today(w), ...item };
  w.robbery.feed.push(f);
  if (w.robbery.feed.length > 500) w.robbery.feed.shift();
  if (notifyVictim !== null || item.kind === "hit") w.listener?.({ kind: "notice", companyId: item.victimId, topic: "safety", text: notifyVictim ?? item.text, tone: "bad", truckId: item.truckId });
}

/** Security fittings on a truck: the share of a crew's odds they take away (capped). */
export function fittingsCut(w: World, t: Truck): number {
  const k = w.cfg.security;
  let cut = 0;
  for (const item of SECURITY_ITEMS) if (t.security?.[item]) cut += k.items[item].cut;
  return Math.min(0.8, cut);
}

/** The fence's share of a load's cargo value: by commodity (robbery.fenceByCommodity) when that's on, else the flat share. */
export function fenceShareOf(w: World, load: Load | undefined): number {
  const k = w.cfg.robbery;
  if (!load || !k.fenceByCommodityOn) return k.fenceShare;
  const id = COMMODITIES[load.commodity]?.id;
  return (id !== undefined ? k.fenceByCommodity[id] : undefined) ?? k.fenceShare;
}

/** The most a crew could take from this truck: the rig and what it carries, at the fence's shares. */
export function maxTakeFd(w: World, t: Truck): number {
  const k = w.cfg.robbery;
  const load = t.loadId !== null ? w.loads.get(t.loadId) : undefined;
  return k.rigFenceShare * truckValue(w, t) + fenceShareOf(w, load) * (load?.cargoValue ?? 0);
}

/** A company's equity a hirer must show: cash, stakes and the trucks it owns at market value. */
function equityFd(w: World, c: Company): number {
  let fd = Math.max(0, w.ledger.balance(companyAccount(c.id))) + c.stakedFd;
  for (const t of w.trucksByCompany.get(c.id) ?? []) if (t.lease === "owned" && t.status !== "retired") fd += truckValue(w, t);
  return fd;
}

/** What hiring a crew against this truck costs. */
export function crewFeeFd(w: World, t: Truck): number {
  const k = w.cfg.robbery;
  return Math.max(k.minFeeFd, k.feeShareOfValue * truckValue(w, t));
}

/** The stake a hire locks behind it (robbery.realStake), or 0. */
export function crewStakeFd(w: World, t: Truck): number {
  const k = w.cfg.robbery;
  return k.realStake ? k.stakeCover * maxTakeFd(w, t) : 0;
}

/** Notoriety: crews a company hired in the last `notorietyDays` (Channel 19's count on its scorecard; no penalty). */
export function notoriety(w: World, c: Company): number {
  const since = today(w) - w.cfg.robbery.notorietyDays;
  return w.robbery.jobs.filter((j) => j.hirerId === c.id && j.hiredDay >= since).length;
}

/** Whether a company may hire crews and post bounties: an operating company, not a wallet, not being wound up. */
const operating = (c: Company) => c.role !== "holder" && c.liquidatingSince === null && c.authority.status === "active";

/** Hires a crew against a truck; returns why not. */
export function hireCrew(w: World, hirer: Company, truck: Truck): string | null {
  const k = w.cfg.robbery;
  if (!k.enabled) return "no crews for hire";
  const closed = layerBlock(w, "robbery"); // the unlock ladder (ladder.ts)
  if (closed) return closed;
  if (!operating(hirer)) return "only an operating company hires crews";
  if (truck.companyId === 0 || truck.status === "retired") return "no such truck";
  if (truck.companyId === hirer.id) return "that's your own truck";
  const victim = w.companies[truck.companyId - 1]!;
  const day = today(w);
  if (day - victim.createdDay < k.protectDays) return "that company is too new to be a target";
  const last = w.robbery.lastHitDay.get(victim.id);
  if (last !== undefined && day - last < k.cooldownDays) return "that company was hit too recently";
  if (w.robbery.jobs.some((j) => j.truckId === truck.id && j.status === "out")) return "a crew is already on that truck";
  if (k.oneCrewPerVictim && w.robbery.jobs.some((j) => j.victimId === victim.id && j.status === "out")) return "a crew is already on that company";
  if (!k.realStake && equityFd(w, hirer) < k.stakeCover * maxTakeFd(w, truck)) return "not enough at stake to hire a crew for that truck";
  const fee = crewFeeFd(w, truck);
  const stake = crewStakeFd(w, truck);
  if (w.ledger.balance(companyAccount(hirer.id)) < fee + stake) return stake > 0 ? "not enough FD for the crew's fee and the stake behind it" : "not enough FD for the crew's fee";
  w.ledger.post(w.t, companyAccount(hirer.id), "sink:crew_fee", fee, `crew:${truck.id}`);
  const job: CrewJob = { id: w.robbery.jobs.length + 1, hirerId: hirer.id, victimId: victim.id, truckId: truck.id, hiredDay: day, expiresDay: day + k.windowDays, status: "out" };
  if (stake > 0) {
    // The stake (robbery.realStake): locked in its own account for the crew's window; a hit pays the victim's uninsured loss from it first.
    w.ledger.post(w.t, companyAccount(hirer.id), crewStakeAccount(job.id), stake, `crew:stake:${job.id}`);
    job.stakeFd = stake;
    w.robbery.stats.stakesLockedFd += stake;
  }
  w.robbery.jobs.push(job);
  w.robbery.stats.hires++;
  w.robbery.stats.feesFd += fee;
  const hub = w.net.hubs[truck.hub]?.id ?? "";
  post(
    w,
    { kind: "hire", hirerId: hirer.id, victimId: victim.id, truckId: truck.id, text: `Channel 19: ${hirer.name} put a crew on ${victim.name}'s truck ${truck.id}${hub ? ` near ${hub}` : ""}.` },
    `Channel 19: ${hirer.name} put a crew on your truck ${truck.id}. Park it at a truck stop in the corridors, or fit security, for the next ${k.windowDays} days.`,
  );
  return null;
}

/** The open job on a truck, if any. */
export function crewOn(w: World, truckId: number): CrewJob | undefined {
  return w.robbery.jobs.find((j) => j.truckId === truckId && j.status === "out");
}

/** What's left of a crew's stake goes back to its hirer. */
function releaseStake(w: World, job: CrewJob): void {
  if (!job.stakeFd) return;
  const acct = crewStakeAccount(job.id);
  const left = w.ledger.balance(acct);
  if (left > 0.005) w.ledger.post(w.t, acct, companyAccount(job.hirerId), left, `crew:stake:${job.id}`);
}

/** The Back Lot (robbery.backLot): a fence or chop shop to buy what a crew took, at the truck's hub first, with the cash to pay. */
function buyerFor(w: World, kind: "fence" | "chopShop", hub: number, needFd: number, hirerId: number): Business | null {
  if (!w.cfg.robbery.backLot.enabled || !w.cfg.businesses.enabled) return null;
  const open = w.businesses.filter((b) => b.kind === kind && b.ownerId > 0 && b.ownerId !== hirerId && w.ledger.balance(companyAccount(b.ownerId)) >= needFd);
  return open.find((b) => b.hub === hub) ?? open[0] ?? null;
}

/**
 * Pays a crew's hirer for what it took, `shareFd` of goods worth `valueFd`: a player's fence or chop shop pays it (and
 * resells the goods for its margin `resaleDays` later), else the reserve's fence pays `npcFenceShare` of it. The wash
 * fee comes off the hirer's end; the take is spend-only when `takeLocked` is on. Returns what the hirer got.
 */
function payTake(w: World, hirer: Company, kind: "fence" | "chopShop", hub: number, valueFd: number, shareFd: number, ref: string, resaleMult: number): number {
  const k = w.cfg.robbery;
  if (shareFd <= 0.01) return 0;
  const wash = shareFd * k.washFee;
  const hirerAcct = companyAccount(hirer.id);
  const buyer = buyerFor(w, kind, hub, shareFd, hirer.id);
  let paid = 0;
  let carried = 0;
  if (buyer) {
    const owner = companyAccount(buyer.ownerId);
    paid = shareFd - wash;
    carried = w.ledger.post(w.t, owner, hirerAcct, paid, ref);
    if (wash > 0.005) w.ledger.post(w.t, owner, "sink:wash", wash, ref);
    buyer.netFd -= shareFd;
    const resale = (kind === "fence" ? shareFd + valueFd * k.backLot.fenceMarkup : valueFd * k.backLot.chopPartsYield) * resaleMult;
    w.robbery.resales.push({ businessId: buyer.id, fd: resale, day: today(w) + k.backLot.resaleDays, kind });
    if (kind === "fence") w.robbery.stats.fencePaidFd += paid;
    else w.robbery.stats.chopPaidFd += paid;
  } else {
    paid = k.npcFenceShare * (shareFd - wash);
    if (paid > 0.01) w.ledger.post(w.t, "faucet:fence", hirerAcct, paid, ref);
  }
  if (k.takeLocked && paid > 0) w.ledger.lock(hirerAcct, Math.max(0, paid - carried));
  w.robbery.stats.takePaidFd += paid;
  return paid;
}

/** Bounties on the company just hit go to the hirer whose crew hit it (never its own). */
function payBounties(w: World, victim: Company, hirer: Company, truckId: number): void {
  for (const b of w.robbery.bounties) {
    if (b.status !== "open" || b.targetId !== victim.id || b.posterId === hirer.id) continue;
    const held = w.ledger.balance(bountyAccount(b.id));
    if (held > 0.005) w.ledger.post(w.t, bountyAccount(b.id), companyAccount(hirer.id), held, `bounty:${b.id}`);
    b.status = "paid";
    w.robbery.stats.bountiesPaidFd += held;
    post(w, { kind: "bountyPaid", hirerId: hirer.id, victimId: victim.id, truckId, text: `Channel 19: ${hirer.name} collected ${name(w, b.posterId)}'s ${Math.round(held).toLocaleString("en-US")} FD bounty on ${victim.name}.` }, null);
  }
}

/**
 * At night (sites.ts parkForTheNight, after the NPC thieves): a crew on this truck strikes if it sleeps
 * outside a truck stop where theft runs high.
 */
export function crewStrike(w: World, truck: Truck, victim: Company, where: "shoulder" | "restArea" | "truckStop", placeRisk: number): void {
  const k = w.cfg.robbery;
  if (!k.enabled || w.robbery.jobs.length === 0) return;
  const job = crewOn(w, truck.id);
  if (!job || where === "truckStop" || placeRisk < k.minPlaceRisk || truck.companyId !== job.victimId) return;
  const odds = Math.min(k.maxOdds, (k.odds * placeRisk) / k.riskNorm) * (1 - fittingsCut(w, truck)) * securityTheftMult(w, victim);
  if (w.rng.ops.next() >= odds) return;
  const hirer = w.companies[job.hirerId - 1]!;
  // The logbook counts a hit on an established fleet only (robbery.logbookMinVictimTrucks): no robbing your own wallet for it.
  const counts = (w.trucksByCompany.get(victim.id)?.length ?? 0) >= k.logbookMinVictimTrucks;
  let paid = 0;
  let lossFd = 0; // the victim's uninsured loss, paid from the stake first (robbery.realStake)
  const parts: string[] = [];
  const load = truck.loadId !== null ? w.loads.get(truck.loadId) : undefined;
  const hub = truck.hub;
  if (load && truck.status === "loaded") {
    const share = fenceShareOf(w, load) * load.cargoValue;
    w.robbery.stats.cargoTakenFd += load.cargoValue;
    parts.push(`its load (${Math.round(load.cargoValue)} FD)`);
    lossFd += Math.min(load.cargoValue, w.cfg.safety.crash.cargoDeductibleFd);
    const perishable = COMMODITIES[load.commodity]?.spoilHours != null;
    stealCargo(w, truck, victim, load);
    paid += payTake(w, hirer, "fence", hub, load.cargoValue, share, `crew:${job.id}`, perishable && k.backLot.perishableHalf ? 0.5 : 1);
  }
  if (w.rng.ops.next() < k.rigShare) {
    const value = truckValue(w, truck);
    parts.push("the rig itself, chopped");
    lossFd += Math.min(value, w.cfg.assets.physicalDamage.deductibleFd);
    writeOffRig(w, victim, truck);
    w.robbery.stats.rigsTaken++;
    if (counts) logbookCount(hirer, "rigs");
    paid += payTake(w, hirer, "chopShop", hub, value, k.rigFenceShare * value, `crew:${job.id}`, 1);
  }
  job.status = "hit";
  w.robbery.lastHitDay.set(victim.id, today(w));
  w.robbery.stats.hits++;
  if (job.stakeFd) {
    const acct = crewStakeAccount(job.id);
    const toVictim = Math.min(w.ledger.balance(acct), lossFd);
    if (toVictim > 0.005) {
      w.ledger.post(w.t, acct, companyAccount(victim.id), toVictim, `crew:restitution:${job.id}`);
      w.robbery.stats.victimsPaidFd += toVictim;
    }
    releaseStake(w, job);
  }
  if (counts) {
    logbookCount(hirer, "hits");
    logbookCount(hirer, "takeFd", paid);
  }
  payBounties(w, victim, hirer, truck.id);
  const what = parts.length ? parts.join(" and ") : "nothing worth fencing";
  post(w, { kind: "hit", hirerId: hirer.id, victimId: victim.id, truckId: truck.id, text: `Channel 19: ${hirer.name}'s crew hit ${victim.name}'s truck ${truck.id}: ${what}.` }, null);
}

/** Puts a bounty on a company (robbery.bounty): FD held in escrow, paid to whoever's crew hits it; returns why not. */
export function postBounty(w: World, c: Company, targetId: number, fd: number): string | null {
  const k = w.cfg.robbery;
  if (!k.enabled || !k.bounty.enabled) return "no bounties";
  const closed = layerBlock(w, "robbery");
  if (closed) return closed;
  if (!operating(c)) return "only an operating company posts a bounty";
  const target = w.companies[targetId - 1];
  if (!target || target.role === "holder") return "no such company";
  if (target.id === c.id) return "that's you";
  if (!(fd >= k.bounty.minFd)) return `a bounty is at least ${k.bounty.minFd.toLocaleString("en-US")} FD`;
  if (w.ledger.balance(companyAccount(c.id)) < fd) return "not enough FD";
  const day = today(w);
  const b: Bounty = { id: w.robbery.bounties.length + 1, posterId: c.id, targetId, fd, day, expiresDay: day + k.bounty.days, status: "open" };
  w.ledger.post(w.t, companyAccount(c.id), bountyAccount(b.id), fd, `bounty:${b.id}`);
  w.robbery.bounties.push(b);
  w.robbery.stats.bountiesPostedFd += fd;
  post(w, { kind: "bounty", hirerId: c.id, victimId: targetId, truckId: 0, text: `Channel 19: ${c.name} put a ${Math.round(fd).toLocaleString("en-US")} FD bounty on ${target.name}: it pays whoever's crew hits them.` }, `Channel 19: ${c.name} put a ${Math.round(fd).toLocaleString("en-US")} FD bounty on you.`);
  return null;
}

/**
 * Daily: crews whose window ran out give up (their fee is spent) and a hirer that's no longer operating loses
 * its crews; bounties past their days go back to their posters; the Back Lot's resales due are paid.
 */
export function dailyRobbery(w: World): void {
  if (!w.cfg.robbery.enabled) return;
  const day = today(w);
  for (const j of w.robbery.jobs) {
    if (j.status !== "out") continue;
    const hirer = w.companies[j.hirerId - 1]!;
    if (!operating(hirer)) {
      j.status = "cancelled";
      releaseStake(w, j);
      post(w, { kind: "cancelled", hirerId: j.hirerId, victimId: j.victimId, truckId: j.truckId, text: `Channel 19: the crew ${name(w, j.hirerId)} put on ${name(w, j.victimId)}'s truck ${j.truckId} is off the job: its hirer is done.` }, `Channel 19: the crew on your truck ${j.truckId} is off the job.`);
      continue;
    }
    if (day < j.expiresDay) continue;
    j.status = "missed";
    releaseStake(w, j);
    post(w, { kind: "missed", hirerId: j.hirerId, victimId: j.victimId, truckId: j.truckId, text: `Channel 19: the crew ${name(w, j.hirerId)} put on ${name(w, j.victimId)}'s truck ${j.truckId} gave up.` }, `Channel 19: the crew on your truck ${j.truckId} gave up.`);
  }
  for (const b of w.robbery.bounties) {
    if (b.status !== "open" || day < b.expiresDay) continue;
    const held = w.ledger.balance(bountyAccount(b.id));
    if (held > 0.005) w.ledger.post(w.t, bountyAccount(b.id), companyAccount(b.posterId), held, `bounty:${b.id}`);
    b.status = "expired";
  }
  if (w.robbery.resales.length > 0) {
    const kept: RobberyState["resales"] = [];
    for (const r of w.robbery.resales) {
      if (day < r.day) {
        kept.push(r);
        continue;
      }
      const b = w.businesses[r.businessId - 1];
      if (b && b.ownerId > 0 && r.fd > 0.005) {
        w.ledger.post(w.t, r.kind === "fence" ? "faucet:fence_resale" : "faucet:chop_parts", companyAccount(b.ownerId), r.fd, `resale:${r.kind}:${b.id}`);
        b.netFd += r.fd;
        w.robbery.stats.resaleFd += r.fd;
      }
    }
    w.robbery.resales = kept;
  }
}

/** Fits a security item to a truck (a sink); returns why not. */
export function fitSecurity(w: World, c: Company, truck: Truck, item: SecurityItem): string | null {
  const k = w.cfg.security;
  if (!w.cfg.robbery.enabled) return "nothing to fit";
  if (truck.companyId !== c.id) return "not your truck";
  truck.security ??= {};
  if (truck.security[item]) return "already fitted";
  if (SECURITY_ITEMS.filter((i) => truck.security![i]).length >= k.slots) return `no slot left: ${k.slots} fittings a truck`;
  const fd = k.items[item].fd;
  if (w.ledger.balance(companyAccount(c.id)) < fd) return "not enough FD";
  w.ledger.post(w.t, companyAccount(c.id), "sink:security", fd, `security:${truck.id}:${item}`);
  truck.security[item] = true;
  w.robbery.stats.fittingsFd += fd;
  return null;
}
