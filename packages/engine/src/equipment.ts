/**
 * The trailer pass (Jeff, 2026-10-30): a reefer's unit burns fuel while loaded; a flatbed's open deck
 * risks weather damage. Config `equipmentOps`; the per-mile parts (weight, the unit on the road, driver
 * pay by trailer) are in economics.ts tripCost.
 */
import { clamp, fuelPrice } from "./economics.js";
import { companyAccount } from "./ledger.js";
import { winterNow } from "./safety.js";
import { stakeDiscount } from "./staking.js";
import type { Company, Load, Truck } from "./types.js";
import type { World } from "./world.js";

/** A loaded reefer's unit running for `minutes` (the night, a wait at the gate): its gallons at the pump price, a sink, and toward the fuel tax. */
export function reeferUnit(w: World, c: Company, minutes: number, ref: string): void {
  const ops = w.cfg.equipmentOps;
  const gal = (minutes / 60) * ops.reeferUnitGalPerHour;
  if (gal <= 0) return;
  const fd = gal * fuelPrice(w) * (1 - stakeDiscount(w, c));
  c.fuelGalMonth += gal;
  if (fd > 0.005) w.ledger.post(w.t, companyAccount(c.id), "sink:reefer_fuel", fd, ref);
  c.operating.costFd += fd;
}

/** A flatbed load's weather on the way: at these odds (more in a northern winter, less with a skilled driver) a damage claim on the carrier, a sink. Returns the claim. */
export function flatbedDamage(w: World, truck: Truck, c: Company, load: Load): number {
  const ops = w.cfg.equipmentOps;
  const { winter } = w.cfg.roads;
  const lat = (w.net.places[load.originPlace]!.lat + w.net.places[load.destPlace]!.lat) / 2;
  const north = winterNow(w) ? clamp((lat - winter.fromLat) / (winter.toLat - winter.fromLat), 0, 1) : 0;
  const odds = ops.flatbedDamageOdds * (1 + ops.flatbedDamageWinterGain * north) * (1.5 - truck.driverSkill);
  if (w.rng.ops.next() >= odds) return 0;
  const claim = ops.flatbedDamageShare * load.cargoValue;
  if (claim <= 0.005) return 0;
  w.ledger.post(w.t, companyAccount(c.id), "sink:cargo_claim", claim, `damage:${load.id}`);
  w.metrics.onFlatbedDamage();
  w.listener?.({ kind: "notice", companyId: c.id, topic: "safety", text: `Load #${load.id}: the weather got under the tarps. The receiver filed a ${Math.round(claim)} FD damage claim.`, tone: "bad", truckId: truck.id });
  return claim;
}
