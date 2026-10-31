/**
 * The logbook (config `token.airdrop.logbook`; Jeff, 2026-10-31): the airdrop paid only for what a company
 * does. With it on, `atLaunch` (1%) of each allocation is paid when it's made and the rest unlocks through
 * milestones, checked weekly, on the honest path (freight handled, on time, profit, trucks and businesses
 * owned, a manager, a clean quarter, a satisfactory review, a contract kept, a truck fully secured) or the
 * criminal one (crews that hit, a rig chopped, FD fenced, a case gone cold). Each milestone unlocks its
 * weight's share of what the launch payment left: the honest weights open to a role add up to all of it;
 * the criminal ones to at most `criminalShare` of it, and only while the company has no open case (one
 * reached with a case open waits for it to close). Three tenure milestones (a game year on the road, two,
 * three: three, six and nine real months) keep part of every allocation for those who stay. A conviction
 * forfeits whatever is still locked; after `deadlineDays` (twelve real months) what's left is never
 * minted. No early claim. A company keeps one book: a later season's share joins it, the milestones
 * already reached paying their shares of it at once, and the deadline moves to the season's own. The FD
 * unlocked is paid by token.ts, under the supply ceiling like any slice.
 */
import { dayOf } from "./clock.js";
import { facilitiesOf } from "./demand.js";
import { isManager } from "./labor.js";
import type { Company, Logbook, Role } from "./types.js";
import type { World } from "./world.js";

type Path = "honest" | "criminal";

interface Milestone {
  id: string;
  path: Path;
  weight: number;
  roles: Role[];
  text: string;
  /** Whether the feature it needs is on in this world. */
  open?: (w: World) => boolean;
  reached: (w: World, c: Company, lb: Logbook) => boolean;
}

const day = (w: World) => dayOf(w.t, w.cfg);
const QUARTER = 91;
/** On the road: this many game days since the book opened (a game year is three real months), and freight handled. */
const tenure = (w: World, lb: Logbook, years: number, loads: number) => day(w) - lb.startDay >= years * w.cfg.time.daysPerSeason && lb.handled >= loads;

/** A company's running operating result (as token.ts counts it). */
const operating = (w: World, c: Company) => c.operating.revenueFd - c.operating.costFd + facilitiesOf(w, c.id).reduce((s, f) => s + f.netFd, 0);
const ownedTrucks = (w: World, c: Company) => (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.lease === "owned" && t.status !== "retired").length;

export const MILESTONES: Milestone[] = [
  // The honest path.
  { id: "haul25", path: "honest", weight: 4, roles: ["carrier", "broker"], text: "25 loads handled", reached: (_w, _c, lb) => lb.handled >= 25 },
  { id: "haul100", path: "honest", weight: 6, roles: ["carrier", "broker"], text: "100 loads handled", reached: (_w, _c, lb) => lb.handled >= 100 },
  { id: "haul250", path: "honest", weight: 8, roles: ["carrier", "broker"], text: "250 loads handled", reached: (_w, _c, lb) => lb.handled >= 250 },
  { id: "haul1000", path: "honest", weight: 10, roles: ["carrier", "broker"], text: "1,000 loads handled", reached: (_w, _c, lb) => lb.handled >= 1_000 },
  {
    id: "onTime",
    path: "honest",
    weight: 6,
    roles: ["carrier"],
    text: "100 loads delivered at 95% on time",
    reached: (_w, c, lb) => c.delivered - lb.base.delivered >= 100 && (c.onTime - lb.base.onTime) / (c.delivered - lb.base.delivered) >= 0.95,
  },
  { id: "profit100k", path: "honest", weight: 6, roles: ["carrier", "broker"], text: "100,000 FD of operating profit", reached: (w, c, lb) => operating(w, c) - lb.base.profitFd >= 100_000 },
  { id: "profit1m", path: "honest", weight: 10, roles: ["carrier", "broker"], text: "1,000,000 FD of operating profit", reached: (w, c, lb) => operating(w, c) - lb.base.profitFd >= 1_000_000 },
  { id: "truck1", path: "honest", weight: 5, roles: ["carrier"], text: "a truck more, owned", reached: (w, c, lb) => ownedTrucks(w, c) >= lb.base.ownedTrucks + 1 },
  { id: "truck5", path: "honest", weight: 8, roles: ["carrier"], text: "five trucks more, owned", reached: (w, c, lb) => ownedTrucks(w, c) >= lb.base.ownedTrucks + 5 },
  { id: "business", path: "honest", weight: 6, roles: ["carrier", "broker"], text: "a business owned", open: (w) => w.cfg.businesses.enabled, reached: (w, c) => w.businesses.some((b) => b.ownerId === c.id) },
  { id: "manager", path: "honest", weight: 4, roles: ["carrier"], text: "a manager on staff", reached: (w, c) => w.staff.some((s) => s.companyId === c.id && s.status === "employed" && isManager(s.kind)) },
  {
    id: "cleanQuarter",
    path: "honest",
    weight: 8,
    roles: ["carrier", "broker"],
    text: "a quarter with no at-fault crash and no claim, 25 loads handled",
    reached: (w, c, lb) => {
      const d = day(w);
      return d - lb.startDay >= QUARTER && lb.handled >= 25 && !c.safety.crashes.some((k) => k.atFault && d - k.day < QUARTER) && !c.claims.some((k) => d - k.day < QUARTER);
    },
  },
  { id: "year1", path: "honest", weight: 8, roles: ["carrier", "broker"], text: "a game year on the road, 100 loads handled", reached: (w, _c, lb) => tenure(w, lb, 1, 100) },
  { id: "year2", path: "honest", weight: 10, roles: ["carrier", "broker"], text: "two game years on the road, 200 loads handled", reached: (w, _c, lb) => tenure(w, lb, 2, 200) },
  { id: "year3", path: "honest", weight: 12, roles: ["carrier", "broker"], text: "three game years on the road, 300 loads handled", reached: (w, _c, lb) => tenure(w, lb, 3, 300) },
  { id: "satisfactory", path: "honest", weight: 5, roles: ["carrier"], text: "a satisfactory compliance review", reached: (_w, c, lb) => c.safety.rating === "satisfactory" && c.safety.ratingDay !== null && c.safety.ratingDay >= lb.startDay },
  { id: "contract", path: "honest", weight: 6, roles: ["carrier"], text: "a contract term kept in full", reached: (_w, _c, lb) => lb.contractsKept >= 1 },
  {
    id: "secured",
    path: "honest",
    weight: 3,
    roles: ["carrier"],
    text: "a truck with every security slot fitted",
    open: (w) => w.cfg.robbery.enabled,
    reached: (w, c) => (w.trucksByCompany.get(c.id) ?? []).some((t) => t.status !== "retired" && Object.values(t.security ?? {}).filter(Boolean).length >= w.cfg.security.slots),
  },
  // The criminal path.
  { id: "crewHit", path: "criminal", weight: 8, roles: ["carrier", "broker"], text: "a crew of yours hit", open: (w) => w.cfg.robbery.enabled, reached: (_w, _c, lb) => lb.hits >= 1 },
  { id: "crewHits5", path: "criminal", weight: 10, roles: ["carrier", "broker"], text: "five hits by your crews", open: (w) => w.cfg.robbery.enabled, reached: (_w, _c, lb) => lb.hits >= 5 },
  { id: "chopped", path: "criminal", weight: 6, roles: ["carrier", "broker"], text: "a rig taken and chopped", open: (w) => w.cfg.robbery.enabled, reached: (_w, _c, lb) => lb.rigs >= 1 },
  { id: "fenced", path: "criminal", weight: 10, roles: ["carrier", "broker"], text: "100,000 FD fenced", reached: (_w, _c, lb) => lb.takeFd >= 100_000 },
  { id: "coldCase", path: "criminal", weight: 8, roles: ["carrier", "broker"], text: "a case gone cold", reached: (_w, _c, lb) => lb.coldCases >= 1 },
];

/** A milestone's plain-language name. */
export const milestoneText = (id: string): string => MILESTONES.find((m) => m.id === id)?.text ?? id;

const applies = (w: World, m: Milestone, role: Role) => m.roles.includes(role) && (m.open?.(w) ?? true);

/** The weights a role can earn on a path in this world, for the shares. */
function pathWeight(w: World, path: Path, role: Role): number {
  return MILESTONES.filter((m) => m.path === path && applies(w, m, role)).reduce((s, m) => s + m.weight, 0);
}

/** Opens a logbook on an allocation (launch, or a later season). */
export function openLogbook(w: World, c: Company, allocationFd: number): Logbook {
  const d = day(w);
  return {
    startDay: d,
    deadlineDay: d + w.cfg.token.airdrop.logbook.deadlineDays,
    allocationFd,
    done: [],
    base: { onTime: c.onTime, delivered: c.delivered, profitFd: operating(w, c), ownedTrucks: ownedTrucks(w, c) },
    handled: 0,
    contractsKept: 0,
    hits: 0,
    rigs: 0,
    takeFd: 0,
    coldCases: 0,
    closed: false,
  };
}

/** The open logbook, if the company has one. */
export function openBook(c: Company): Logbook | null {
  const lb = c.airdrop?.logbook;
  return lb && !lb.closed ? lb : null;
}

/** Counts something done towards the open logbook (contracts.ts, robbery.ts, fraud.ts). */
export function logbookCount(c: Company, key: "contractsKept" | "hits" | "rigs" | "takeFd" | "coldCases", n = 1): void {
  const lb = openBook(c);
  if (lb) lb[key] += n;
}

/**
 * Weekly (token.ts weeklyToken, before the week's loads are reset): counts the week's freight and returns
 * the milestones newly reached with the FD each unlocks, and, past the deadline, the FD that is lost.
 */
export function logbookWeek(w: World, c: Company): { reached: { id: string; path: Path; fd: number }[]; lostFd: number } {
  const lb = openBook(c);
  const a = c.airdrop;
  if (!lb || !a) return { reached: [], lostFd: 0 };
  lb.handled += c.loadsThisWeek;
  const left = () => Math.max(0, a.totalFd - a.unlockedFd - a.forfeitedFd);
  if (day(w) >= lb.deadlineDay) {
    lb.closed = true;
    return { reached: [], lostFd: left() };
  }
  if (c.liquidatingSince !== null) return { reached: [], lostFd: 0 };
  const k = w.cfg.token.airdrop.logbook;
  const rest = (1 - k.atLaunch) * lb.allocationFd;
  const openCase = w.cases.some((x) => x.companyId === c.id && x.resolveDay > day(w));
  const honest = pathWeight(w, "honest", c.role);
  const criminal = pathWeight(w, "criminal", c.role);
  const reached: { id: string; path: Path; fd: number }[] = [];
  let room = left();
  for (const m of MILESTONES) {
    if (lb.done.includes(m.id) || !applies(w, m, c.role)) continue;
    if (m.path === "criminal" && openCase) continue; // it waits for the case to close
    if (!m.reached(w, c, lb)) continue;
    lb.done.push(m.id);
    const share = m.path === "honest" ? m.weight / honest : (k.criminalShare * m.weight) / criminal;
    const fd = Math.min(room, share * rest);
    room -= fd;
    reached.push({ id: m.id, path: m.path, fd });
  }
  return { reached, lostFd: 0 };
}

/** The shares of an allocation the milestones a book has reached unlock between them, by path (after the opening payment; at most all of it together). */
export function doneShares(w: World, c: Company, lb: Logbook): { honest: number; criminal: number } {
  const k = w.cfg.token.airdrop.logbook;
  const hw = pathWeight(w, "honest", c.role);
  const cw = pathWeight(w, "criminal", c.role);
  let honest = 0;
  let criminal = 0;
  for (const m of MILESTONES) {
    if (!lb.done.includes(m.id) || !applies(w, m, c.role)) continue;
    if (m.path === "honest") honest += m.weight / hw;
    else criminal += (k.criminalShare * m.weight) / cw;
  }
  const scale = (1 - k.atLaunch) / Math.max(1, honest + criminal);
  return { honest: honest * scale, criminal: criminal * scale };
}

/** The catalogue, for the client and the reports: each milestone with the share of the allocation it unlocks for a role. */
export function logbookCatalogue(w: World, role: Role): { id: string; path: Path; text: string; share: number }[] {
  const k = w.cfg.token.airdrop.logbook;
  const honest = pathWeight(w, "honest", role);
  const criminal = pathWeight(w, "criminal", role);
  return MILESTONES.filter((m) => applies(w, m, role)).map((m) => ({
    id: m.id,
    path: m.path,
    text: m.text,
    share: (1 - k.atLaunch) * (m.path === "honest" ? m.weight / honest : (k.criminalShare * m.weight) / criminal),
  }));
}
