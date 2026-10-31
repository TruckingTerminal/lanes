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
 * was taken, less the cost of washing it, from the reserve. No police: what follows is between players.
 * New companies are off limits for `protectDays`; a victim can't be targeted again for `cooldownDays`; a
 * hirer needs equity of at least `stakeCover` × the most the crew could take, so it has something to lose.
 */
import { writeOffRig } from "./assets.js";
import { dayOf } from "./clock.js";
import { truckValue } from "./dealer.js";
import { securityTheftMult } from "./labor.js";
import { companyAccount } from "./ledger.js";
import { stealCargo } from "./risk.js";
import type { Company, Truck } from "./types.js";
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
  status: "out" | "hit" | "missed";
}

export interface FeedItem {
  day: number;
  kind: "hire" | "hit" | "missed";
  hirerId: number;
  victimId: number;
  truckId: number;
  text: string;
}

export interface RobberyState {
  jobs: CrewJob[];
  feed: FeedItem[];
  lastHitDay: Map<number, number>;
  stats: { hires: number; hits: number; rigsTaken: number; cargoTakenFd: number; takePaidFd: number; feesFd: number; fittingsFd: number };
}

export const newRobberyState = (): RobberyState => ({ jobs: [], feed: [], lastHitDay: new Map(), stats: { hires: 0, hits: 0, rigsTaken: 0, cargoTakenFd: 0, takePaidFd: 0, feesFd: 0, fittingsFd: 0 } });

const today = (w: World) => dayOf(w.t, w.cfg);
const name = (w: World, id: number) => w.companies[id - 1]?.name ?? `#${id}`;

function post(w: World, item: Omit<FeedItem, "day">, notifyVictim: string | null): void {
  const f = { day: today(w), ...item };
  w.robbery.feed.push(f);
  if (w.robbery.feed.length > 500) w.robbery.feed.shift();
  w.listener?.({ kind: "notice", companyId: item.victimId, topic: "safety", text: notifyVictim ?? item.text, tone: "bad", truckId: item.truckId });
}

/** Security fittings on a truck: the share of a crew's odds they take away (capped). */
export function fittingsCut(w: World, t: Truck): number {
  const k = w.cfg.security;
  let cut = 0;
  for (const item of SECURITY_ITEMS) if (t.security?.[item]) cut += k.items[item].cut;
  return Math.min(0.8, cut);
}

/** The most a crew could take from this truck: the rig and what it carries, at the fence's shares. */
export function maxTakeFd(w: World, t: Truck): number {
  const k = w.cfg.robbery;
  const load = t.loadId !== null ? w.loads.get(t.loadId) : undefined;
  return k.rigFenceShare * truckValue(w, t) + k.fenceShare * (load?.cargoValue ?? 0);
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

/** Hires a crew against a truck; returns why not. */
export function hireCrew(w: World, hirer: Company, truck: Truck): string | null {
  const k = w.cfg.robbery;
  if (!k.enabled) return "no crews for hire";
  if (truck.companyId === 0 || truck.status === "retired") return "no such truck";
  if (truck.companyId === hirer.id) return "that's your own truck";
  const victim = w.companies[truck.companyId - 1]!;
  const day = today(w);
  if (day - victim.createdDay < k.protectDays) return "that company is too new to be a target";
  const last = w.robbery.lastHitDay.get(victim.id);
  if (last !== undefined && day - last < k.cooldownDays) return "that company was hit too recently";
  if (w.robbery.jobs.some((j) => j.truckId === truck.id && j.status === "out")) return "a crew is already on that truck";
  if (equityFd(w, hirer) < k.stakeCover * maxTakeFd(w, truck)) return "not enough at stake to hire a crew for that truck";
  const fee = crewFeeFd(w, truck);
  if (w.ledger.balance(companyAccount(hirer.id)) < fee) return "not enough FD for the crew's fee";
  w.ledger.post(w.t, companyAccount(hirer.id), "sink:crew_fee", fee, `crew:${truck.id}`);
  const job: CrewJob = { id: w.robbery.jobs.length + 1, hirerId: hirer.id, victimId: victim.id, truckId: truck.id, hiredDay: day, expiresDay: day + k.windowDays, status: "out" };
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
  let take = 0;
  const parts: string[] = [];
  const load = truck.loadId !== null ? w.loads.get(truck.loadId) : undefined;
  if (load && truck.status === "loaded") {
    take += k.fenceShare * load.cargoValue;
    w.robbery.stats.cargoTakenFd += load.cargoValue;
    parts.push(`its load (${Math.round(load.cargoValue)} FD)`);
    stealCargo(w, truck, victim, load);
  }
  if (w.rng.ops.next() < k.rigShare) {
    take += k.rigFenceShare * truckValue(w, truck);
    parts.push("the rig itself, chopped");
    writeOffRig(w, victim, truck);
    w.robbery.stats.rigsTaken++;
  }
  job.status = "hit";
  w.robbery.lastHitDay.set(victim.id, today(w));
  w.robbery.stats.hits++;
  const paid = take * (1 - k.washFee);
  if (paid > 0.01) w.ledger.post(w.t, "faucet:fence", companyAccount(hirer.id), paid, `crew:${job.id}`);
  w.robbery.stats.takePaidFd += paid;
  const what = parts.length ? parts.join(" and ") : "nothing worth fencing";
  post(w, { kind: "hit", hirerId: hirer.id, victimId: victim.id, truckId: truck.id, text: `Channel 19: ${hirer.name}'s crew hit ${victim.name}'s truck ${truck.id}: ${what}.` }, null);
}

/** Daily: crews whose window ran out give up (their fee is spent). */
export function dailyRobbery(w: World): void {
  if (!w.cfg.robbery.enabled) return;
  const day = today(w);
  for (const j of w.robbery.jobs) {
    if (j.status !== "out" || day < j.expiresDay) continue;
    j.status = "missed";
    post(w, { kind: "missed", hirerId: j.hirerId, victimId: j.victimId, truckId: j.truckId, text: `Channel 19: the crew ${name(w, j.hirerId)} put on ${name(w, j.victimId)}'s truck ${j.truckId} gave up.` }, `Channel 19: the crew on your truck ${j.truckId} gave up.`);
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
