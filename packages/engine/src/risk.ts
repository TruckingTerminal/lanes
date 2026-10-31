/**
 * Cargo theft (Jeff, 2026-10-30; TODO.md "The sequence, learning from EVE Online": risk scales with
 * reward). Risk by place (theft.hotspots), by what is aboard, and by where the truck sleeps; priced
 * into shippers' rates and into insurers' quotes. Deterministic: distances use dmath's cosine and no
 * square roots (the fade is on the squared distance).
 */
import { COMMODITIES, dcos } from "@lanes/data";
import type { EconomyConfig, Equipment } from "@lanes/config";
import { clamp } from "./economics.js";
import { companyAccount } from "./ledger.js";
import { payClaim } from "./pools.js";
import { loseLoad } from "./safety.js";
import type { Company, Load, Truck } from "./types.js";
import type { World } from "./world.js";

const DEG = Math.PI / 180;
const spotCache = new WeakMap<World, { lat: number; lon: number; mult: number; r2: number }[]>();
function spots(w: World) {
  let s = spotCache.get(w);
  if (!s) {
    s = [];
    for (const h of w.cfg.theft.hotspots) {
      const hub = w.net.hubs.find((x) => x.id === h.hub);
      if (hub) s.push({ lat: hub.lat, lon: hub.lon, mult: h.mult, r2: h.radiusMi * h.radiusMi });
    }
    spotCache.set(w, s);
  }
  return s;
}

/** Theft risk at a point: 1, or the nearest hotspot's multiplier fading with the square of the distance to its radius (the worst one counts, they don't stack). */
export function theftRiskAt(w: World, lat: number, lon: number): number {
  let risk = 1;
  for (const s of spots(w)) {
    const dy = (lat - s.lat) * 69;
    const dx = (lon - s.lon) * 69 * dcos(((lat + s.lat) / 2) * DEG);
    const f = 1 - (dx * dx + dy * dy) / s.r2;
    if (f > 0) risk = Math.max(risk, 1 + (s.mult - 1) * f);
  }
  return risk;
}

const hubCache = new WeakMap<World, Float64Array>();
export function hubTheftRisk(w: World, hub: number): number {
  let a = hubCache.get(w);
  if (!a) {
    a = new Float64Array(w.net.hubs.length);
    w.net.hubs.forEach((h, i) => (a![i] = theftRiskAt(w, h.lat, h.lon)));
    hubCache.set(w, a);
  }
  return a[hub] ?? 1;
}

/** What a load's cargo is worth to a thief: its commodity's value over the base, within the range. */
export function commodityAttract(cfg: EconomyConfig, commodity: number): number {
  const k = cfg.theft;
  return clamp((COMMODITIES[commodity]?.valueFd ?? k.attractBaseFd) / k.attractBaseFd, k.attractRange[0], k.attractRange[1]);
}

const eqCache = new WeakMap<object, Record<string, number>>();
/** The average attraction of what a trailer type carries. */
export function equipmentAttract(cfg: EconomyConfig, eq: Equipment): number {
  let m = eqCache.get(cfg.theft);
  if (!m) {
    m = {};
    for (const e of ["van", "reefer", "flatbed"] as const) {
      const xs = COMMODITIES.map((c, i) => ({ c, i })).filter((x) => x.c.equipment === e);
      m[e] = xs.length ? xs.reduce((s, x) => s + commodityAttract(cfg, x.i), 0) / xs.length : 1;
    }
    eqCache.set(cfg.theft, m);
  }
  return m[eq] ?? 1;
}

/** The premium shippers pay per mile for a lane's theft risk (theft.ratePremiumPerRisk per point above 1, by what the trailer type carries). */
export function theftRatePerMile(w: World, origin: number, dest: number, eq: Equipment): number {
  const k = w.cfg.theft;
  if (!k.enabled) return 0;
  const lane = (hubTheftRisk(w, origin) + hubTheftRisk(w, dest)) / 2;
  return k.ratePremiumPerRisk * Math.max(0, lane - 1) * equipmentAttract(w.cfg, eq);
}

/** A high-value load's premium on all its rates (theft.highValuePremium per point of attraction above 1). */
export function highValueMult(cfg: EconomyConfig, commodity: number): number {
  if (!cfg.theft.enabled) return 1;
  const a = commodityAttract(cfg, commodity);
  return a > 1 ? 1 + cfg.theft.highValuePremium * (a - 1) : 1;
}

/** The insurer's view of where a fleet sleeps: its average exposure against the reference, within the clamp. */
export function theftInsuranceFactor(w: World, c: Company): number {
  const k = w.cfg.theft;
  return k.enabled ? clamp(1 + k.insuranceWeight * (c.nightRisk / k.insuranceRefExposure - 1), k.insuranceClamp[0], k.insuranceClamp[1]) : 1;
}

/** Where a truck is on its leg, roughly: between its places by the share of the leg covered. */
export function truckLatLon(w: World, truck: Truck): [number, number] {
  const a = w.net.places[truck.place]!;
  const b = w.net.places[truck.targetPlace]!;
  const f = truck.legMiles > 0 ? clamp(1 - truck.remainingMi / truck.legMiles, 0, 1) : 0;
  return [a.lat + (b.lat - a.lat) * f, a.lon + (b.lon - a.lon) * f];
}

/**
 * The night's exposure: the place's risk times where the truck sleeps. It moves the fleet's average
 * (its insurance), and a loaded truck may be robbed.
 */
export function nightTheft(w: World, truck: Truck, c: Company, where: "shoulder" | "restArea" | "truckStop", siteRisk: number | null): void {
  const k = w.cfg.theft;
  if (!k.enabled) return;
  const [lat, lon] = siteRisk === null ? truckLatLon(w, truck) : [0, 0];
  const place = siteRisk ?? theftRiskAt(w, lat, lon);
  const exposure = place * k.parking[where];
  c.nightRisk += k.exposurePerNight * (exposure - c.nightRisk);
  if (truck.status !== "loaded" || truck.loadId === null) return;
  const load = w.loads.get(truck.loadId);
  if (!load) return;
  if (w.rng.ops.next() < k.oddsPerLoadedNight * exposure * commodityAttract(w.cfg, load.commodity)) stealCargo(w, truck, c, load);
}

/**
 * A theft: the load is lost, the carrier pays the cargo deductible and is not paid for it, a
 * pool-written policy pays the rest of the cargo's value (a sink: the goods are gone), and the truck
 * goes on to the receiver's market empty after the police report.
 */
export function stealCargo(w: World, truck: Truck, c: Company, load: Load): void {
  const k = w.cfg.theft;
  const ref = `theft:${load.id}`;
  const deductible = Math.min(load.cargoValue, w.cfg.safety.crash.cargoDeductibleFd);
  if (deductible > 0.005) {
    w.ledger.post(w.t, companyAccount(c.id), "sink:cargo_claim", deductible, ref);
    c.operating.costFd += deductible;
  }
  const rest = load.cargoValue - deductible;
  if (rest > 0.01 && c.insurance.writer === "pool") payClaim(w, "insurance", "sink:cargo_claim", rest, ref);
  loseLoad(w, load, "burglary");
  truck.loadId = null;
  truck.status = "repositioning";
  truck.breakdownMin += k.reportHours * 60;
  w.metrics.onCargoTheft(load.cargoValue);
  w.listener?.({ kind: "notice", companyId: c.id, topic: "safety", text: `Truck ${truck.id}: the load was stolen overnight. You pay the ${Math.round(deductible)} FD cargo deductible and won't be paid for it; the truck goes on empty after the police report.`, tone: "bad", truckId: truck.id });
}
