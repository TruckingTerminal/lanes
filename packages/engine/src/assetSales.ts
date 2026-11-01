/**
 * Resale of every protocol-sold asset (assets.enabled; the EVE plan's PLEX lesson, Jeff 2026-10-30).
 * What the protocol sells for FD, players can sell each other: a business with its bond (a dealership
 * with its stock), a shipper facility, and a yard with its extra trailer space (to a carrier at the same
 * home hub). Upgrades travel with the truck; trucks and trailers have the used market. The buyer pays
 * the ask and the sales tax, the market's fee is a sink, and the seller is paid the rest, so a grinder
 * can come by anything in the game with FD earned from other players.
 */
import { dayOf } from "./clock.js";
import { companyAccount } from "./ledger.js";
import { contractAccount } from "./receivables.js";
import { chargeSalesTax, salesTaxOn } from "./salesTax.js";
import { inCloseWindow } from "./season.js";
import { facilityCap } from "./staking.js";
import { ownedTrailers } from "./trailers.js";
import type { Company } from "./types.js";
import type { World } from "./world.js";

export type SaleKind = "business" | "facility" | "yard";

export interface AssetSale {
  id: number;
  kind: SaleKind;
  /** The business or facility id, or for a yard the seller's company id. */
  refId: number;
  sellerId: number;
  askFd: number;
  listedDay: number;
  status: "open" | "sold" | "withdrawn";
}

export const openAssetSales = (w: World): AssetSale[] => w.assetSales.filter((s) => s.status === "open");

/** Still the seller's to sell? */
function stillOwned(w: World, s: AssetSale): boolean {
  if (s.kind === "business") return w.businesses[s.refId - 1]?.ownerId === s.sellerId;
  if (s.kind === "facility") return w.facilities[s.refId - 1]?.ownerId === s.sellerId;
  return w.companies[s.sellerId - 1]!.yard !== "none";
}

export function listAssetSale(w: World, c: Company, kind: SaleKind, refId: number, askFd: number): string | null {
  if (!w.cfg.assets.enabled) return "no asset sales";
  if (c.liquidatingSince !== null) return "in liquidation";
  if (!(askFd > 0) || askFd > 1e9) return "an asking price above zero";
  if (kind === "yard") refId = c.id;
  const sale: AssetSale = { id: w.assetSales.length + 1, kind, refId, sellerId: c.id, askFd, listedDay: dayOf(w.t, w.cfg), status: "open" };
  if (!stillOwned(w, sale)) return kind === "yard" ? "you have no yard" : `not your ${kind}`;
  if (openAssetSales(w).some((s) => s.kind === kind && s.refId === refId)) return "it's already for sale";
  if (kind === "yard") {
    // Without the yard the company must still fit: no more tractors or trailers than the no-yard allowance.
    const none = w.cfg.assets.yard.none;
    const tractors = (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.lease !== "npc").length;
    if (tractors > none.tractors || ownedTrailers(w, c).length > none.trailers) return "sell down to what fits without a yard first";
  }
  w.assetSales.push(sale);
  return null;
}

export function withdrawAssetSale(w: World, c: Company, saleId: number): string | null {
  const s = w.assetSales[saleId - 1];
  if (!s || s.status !== "open" || s.sellerId !== c.id) return "no such sale";
  s.status = "withdrawn";
  return null;
}

export function buyAssetSale(w: World, buyer: Company, s: AssetSale): string | null {
  if (s.status !== "open") return "that sale is gone";
  if (s.sellerId === buyer.id) return "your own";
  if (buyer.liquidatingSince !== null) return "in liquidation";
  if (inCloseWindow(w)) return "no permanent purchases in the season close";
  const seller = w.companies[s.sellerId - 1]!;
  if (!stillOwned(w, s) || seller.liquidatingSince !== null) {
    s.status = "withdrawn";
    return "that sale is gone";
  }
  const buyerAcct = companyAccount(buyer.id);
  const sellerAcct = companyAccount(seller.id);
  const tax = salesTaxOn(w, s.askFd);
  let bond = 0;
  if (s.kind === "business") {
    const b = w.businesses[s.refId - 1]!;
    if (!w.cfg.businesses.enabled) return "businesses aren't open";
    if (w.businesses.filter((x) => x.ownerId === buyer.id).length >= w.cfg.businesses.maxPerCompany) return "company business cap";
    bond = b.bondFd;
  } else if (s.kind === "facility") {
    if (w.facilities.filter((f) => f.ownerId === buyer.id).length >= facilityCap(w, buyer)) return "company facility cap";
  } else {
    if (buyer.role !== "carrier") return "only carriers keep a yard";
    if (buyer.yard !== "none") return "you have a yard";
    if (buyer.homeHub !== seller.homeHub) return "a yard stays where it is: it's for a carrier at the same home hub";
    bond = seller.yardBondFd;
  }
  if (w.ledger.balance(buyerAcct) < s.askFd + tax + bond) return "insufficient FD";
  const ref = `assetsale:${s.id}`;
  const fee = s.askFd * w.cfg.usedMarket.feePct;
  let lockedPaid = w.ledger.post(w.t, buyerAcct, "sink:market_fee", fee, ref);
  chargeSalesTax(w, buyer.id, s.askFd, ref);
  const carried = w.ledger.post(w.t, buyerAcct, sellerAcct, s.askFd - fee, ref);
  lockedPaid += carried;
  // Bought with spend-only FD (ledger.ts): sold for the same, up to that basis; the buyer's locked payment is the new basis.
  const basis = s.kind === "business" ? (w.businesses[s.refId - 1]!.lockedBasisFd ?? 0) : s.kind === "facility" ? (w.facilities[s.refId - 1]!.lockedBasisFd ?? 0) : (seller.yardLockedBasisFd ?? 0);
  w.ledger.lock(sellerAcct, Math.max(0, Math.min(s.askFd - fee, basis) - carried));
  const today = dayOf(w.t, w.cfg);
  if (s.kind === "business") {
    const b = w.businesses[s.refId - 1]!;
    // The bond changes hands: the seller's comes back, the buyer posts its own.
    if (b.bondFd > 0) {
      w.ledger.post(w.t, contractAccount(seller.id), sellerAcct, b.bondFd, `bond:business:${seller.id}`);
      w.ledger.post(w.t, buyerAcct, contractAccount(buyer.id), b.bondFd, `bond:business:${buyer.id}`);
    }
    b.ownerId = buyer.id;
    b.boughtDay = today;
    b.netFd = -(s.askFd + tax);
    b.purchaseFd = s.askFd + tax;
    b.lockedBasisFd = lockedPaid;
  } else if (s.kind === "facility") {
    const f = w.facilities[s.refId - 1]!;
    f.ownerId = buyer.id;
    f.boughtDay = today;
    f.netFd = -(s.askFd + tax);
    f.lockedBasisFd = lockedPaid;
  } else {
    if (seller.yardBondFd > 0) {
      w.ledger.post(w.t, contractAccount(seller.id), sellerAcct, seller.yardBondFd, `bond:yard:${seller.id}`);
      w.ledger.post(w.t, buyerAcct, contractAccount(buyer.id), seller.yardBondFd, `bond:yard:${buyer.id}`);
    }
    buyer.yard = seller.yard;
    buyer.yardBondFd = seller.yardBondFd;
    buyer.yardLockedBasisFd = lockedPaid;
    seller.yardLockedBasisFd = 0;
    buyer.trailerSpaces = seller.trailerSpaces;
    seller.yard = "none";
    seller.yardBondFd = 0;
    seller.trailerSpaces = 0;
  }
  s.status = "sold";
  w.metrics.onAssetSale();
  return null;
}

/** Liquidation: nothing the company listed can sell now; its businesses and facilities close with it. */
export function withdrawSalesOf(w: World, c: Company): void {
  for (const s of w.assetSales) if (s.status === "open" && s.sellerId === c.id) s.status = "withdrawn";
}
