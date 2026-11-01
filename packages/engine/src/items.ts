/**
 * The catalogue (FD only; Jeff, 2026-10-29; TOKENOMICS.md "FD only"): yards and truck upgrades,
 * later shops and stations, priced in FD against the launch reference and scaled by the freight
 * rate index, so play money's abundance in the starved season is priced in. Purchase FD goes half
 * burned, a quarter to the treasury and a quarter to the reserve; a yard posts a bond, returned on
 * sale or liquidation. More trucks than a yard holds needs a yard. During the farming season only,
 * the same items can be bought for dollars at a premium, capped per MC, and every dollar is held to
 * seed the launch pool: nothing is ever sold for dollars after launch.
 */
import { clamp } from "./economics.js";
import { companyAccount } from "./ledger.js";
import { contractAccount } from "./receivables.js";
import { chargeSalesTax, salesTaxOn } from "./salesTax.js";
import { tokenLive } from "./token.js";
import type { Company, ItemKind, TruckMod, YardItem } from "./types.js";
import { truckById, type World } from "./world.js";

const TRUCK_MODS: readonly TruckMod[] = ["apu", "aero", "tires", "sleeper"];
export const isTruckMod = (item: ItemKind): item is TruckMod => (TRUCK_MODS as readonly string[]).includes(item);

/** The freight rate index: the trailing month's cleared rate over a normal market's. Every catalogue price scales with it. */
export function priceIndex(w: World): number {
  const k = w.cfg.token.catalogue;
  const days = w.metrics.days.slice(-28).filter((d) => d.cleared > 0);
  if (days.length === 0) return 1;
  const avg = days.reduce((s, d) => s + d.avgClearedRate, 0) / days.length;
  return clamp(avg / k.indexBaseRate, k.indexClamp[0], k.indexClamp[1]);
}

export function itemPriceFd(w: World, item: ItemKind): number {
  return w.cfg.token.catalogue.items[item].priceFd * priceIndex(w);
}

/** The farming-season dollar price: the FD price at the launch reference, times the premium. Fixed in dollars, not indexed. */
export function itemPriceUsd(w: World, item: ItemKind): number {
  const k = w.cfg.token.catalogue;
  return k.items[item].priceFd * k.usdWindow.referencePriceUsd * k.usdWindow.premium;
}

/** Trucks the company's yard holds (the no-yard allowance without one). */
export function yardTrucks(w: World, c: Company): number {
  const k = w.cfg.token.catalogue;
  return c.yard === "large" ? k.items.yardLarge.trucks : c.yard === "small" ? k.items.yardSmall.trucks : k.trucksWithoutYard;
}

/** Buys an item for FD (burn / treasury / reserve split) or, in the farming season, for dollars held for the launch pool. */
export function buyItem(w: World, c: Company, item: ItemKind, pay: "fd" | "usd", truckId?: number): string | null {
  const k = w.cfg.token.catalogue;
  if (!k.enabled) return "the catalogue isn't open";
  if (c.liquidatingSince !== null) return "in liquidation";
  const spec = k.items[item];
  const truck = truckId !== undefined ? truckById(w, truckId) : null;
  if (item === "yardSmall" && c.yard !== "none") return "you already have a yard";
  if (item === "yardLarge" && c.yard === "large") return "you already have a large yard";
  if (item === "trailerSpace") {
    const y = w.cfg.assets.yard;
    if (!w.cfg.assets.enabled) return "trailers come with the truck";
    if (c.yard === "none") return "more trailer space needs a yard";
    if ((c.trailerSpaces + 1) * y.spacePerPurchase > y.maxExtraSpace) return "the yard can't take more trailers";
  }
  if (isYardItem(item)) {
    // Yard security (robbery.lot.yard): for a yard, once each; the guard is paid weekly after (backlot.ts).
    if (!w.cfg.robbery.enabled || !w.cfg.robbery.lot.enabled) return "no yard security on offer";
    if (c.yard === "none") return "yard security needs a yard";
    if (c.yardSecurity?.[item]) return "already installed";
  }
  if (isTruckMod(item)) {
    if (!truck || truck.companyId !== c.id) return "not your truck";
    if (truck.lease === "npc") return "the NPC lessor's truck can't be modified";
    if (truck.mods[item]) return "already fitted";
  }
  const acct = companyAccount(c.id);
  const bond = "bondFd" in spec ? spec.bondFd : 0;
  const bondDue = Math.max(0, bond - (item === "yardLarge" ? c.yardBondFd : 0));
  const ref = `item:${item}:${c.id}`;
  if (pay === "usd") {
    if (tokenLive(w) || !k.usdWindow.enabled) return "dollars buy nothing after launch";
    const usd = itemPriceUsd(w, item);
    if (c.usdSpentBeta + usd > k.usdWindow.capUsdPerMc + 1e-9) return "over this season's dollar cap";
    if (usd > c.usd.wallet + 1e-9) return "not enough dollars";
    if (bondDue > 0 && w.ledger.balance(acct) < bondDue) return "the yard bond needs more FD";
    c.usd.wallet -= usd;
    c.usd.in += usd;
    c.usdSpentBeta += usd;
    w.token.treasury.seedEscrowUsd += usd; // held for the launch pool, every dollar of it
  } else {
    const price = itemPriceFd(w, item);
    if (w.ledger.balance(acct) < price + bondDue + salesTaxOn(w, price)) return "insufficient FD";
    const s = k.split;
    let locked = w.ledger.post(w.t, acct, "sink:asset_burn", price * s.burn, ref);
    locked += w.ledger.post(w.t, acct, "alloc:treasury", price * s.treasury, ref);
    locked += w.ledger.post(w.t, acct, "sink:asset_reserve", price * s.reserve, ref);
    if (item === "yardSmall" || item === "yardLarge") c.yardLockedBasisFd = (c.yardLockedBasisFd ?? 0) + locked; // a yard bought with spend-only FD resells for the same
    chargeSalesTax(w, c.id, price, ref);
  }
  if (bondDue > 0) {
    w.ledger.post(w.t, acct, contractAccount(c.id), bondDue, `bond:yard:${c.id}`);
    c.yardBondFd += bondDue;
  }
  if (item === "yardSmall") c.yard = "small";
  else if (item === "yardLarge") c.yard = "large";
  else if (item === "trailerSpace") c.trailerSpaces++;
  else if (isYardItem(item)) {
    (c.yardSecurity ??= {})[item] = true;
    w.robbery.stats.yardSecurityFd += itemPriceFd(w, item);
  } else truck!.mods[item] = true;
  return null;
}

const YARD_ITEMS: readonly string[] = ["yardGate", "yardCameras", "yardLighting", "yardGuard"];
const isYardItem = (item: ItemKind): item is YardItem => YARD_ITEMS.includes(item);

/** Liquidation: the yard is lost and its bond comes back to cash for the creditors. */
export function releaseYard(w: World, c: Company): void {
  if (c.yardBondFd > 0) w.ledger.post(w.t, contractAccount(c.id), companyAccount(c.id), c.yardBondFd, `bond:yard:${c.id}`);
  c.yardBondFd = 0;
  c.yard = "none";
}

/** The farming season's dollar window for assets (catalogue.usdWindow.assets): what a rig, trailer, facility or business priced `priceFd` costs in dollars. */
export function assetPriceUsd(w: World, priceFd: number): number {
  const uw = w.cfg.token.catalogue.usdWindow;
  return priceFd * uw.referencePriceUsd * uw.premium;
}

/** Pays for an asset with dollars in the farming season (Jeff, 2026-11-01), every dollar held for the launch pool; a reason when it can't. */
export function payAssetUsd(w: World, c: Company, priceFd: number): string | null {
  const uw = w.cfg.token.catalogue.usdWindow;
  if (tokenLive(w) || !uw.enabled || !uw.assets.enabled || !w.cfg.token.enabled) return "dollars buy nothing after launch";
  const usd = assetPriceUsd(w, priceFd);
  if (uw.assets.capUsdPerMc !== null && c.usdSpentBetaAssets + usd > uw.assets.capUsdPerMc + 1e-9) return "over this season's dollar cap";
  if (usd > c.usd.wallet + 1e-9) return "not enough dollars";
  c.usd.wallet -= usd;
  c.usd.in += usd;
  c.usdSpentBetaAssets += usd;
  w.token.treasury.seedEscrowUsd += usd; // held for the launch pool, every dollar of it
  return null;
}

