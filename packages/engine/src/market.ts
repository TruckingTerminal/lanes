import { dayOf } from "./clock.js";
import { activeLoanOn, closeLoanFromPoolProceeds, POOL_ACCOUNT, settleLoanFromSale, writeOffLoan } from "./finance.js";
import { companyAccount } from "./ledger.js";
import type { Listing, Truck } from "./types.js";
import { truckValue } from "./dealer.js";
import { dealerPrice } from "./dealer.js";
import { truckCap } from "./staking.js";
import { attachTruck, companyById, detachTruck, staffById, truckById, unseatDriver, type World } from "./world.js";

/**
 * The used-truck market. Any owner can list an idle truck; Equipment Finance
 * lists repossessions. Buyers pay the asking price: 95% to the seller (or, for a
 * repossession, to the pool and then the former owner), 5% to the protocol as a
 * sink (§Circular economy — secondary sales). Unsold listings drop their price
 * weekly to a floor.
 */
export function openListings(w: World): Listing[] {
  return w.listings.filter((l) => l.status === "open");
}

export function listTruck(w: World, sellerId: number, truck: Truck, askFd: number, floorFd: number, stepFd: number): Listing | string {
  if (sellerId !== 0 && truck.companyId !== sellerId) return "not your truck";
  if (truck.lease !== "owned") return "only owned trucks can be sold";
  if (sellerId !== 0 && truck.status !== "idle" && truck.status !== "parked") return "truck must be idle or parked";
  if (!(stepFd > 0) || !(floorFd >= 0) || !(askFd >= floorFd)) return "ask at or above the floor, with a weekly price cut";
  if (askFd > 2 * dealerPrice(w, truck)) return "asking more than twice what it costs new";
  const loan = activeLoanOn(w, truck.id);
  // A sale has to clear the loan on the truck, or the pool's depositors would eat the shortfall (a liquidation writes it off anyway).
  if (loan && sellerId !== 0 && companyById(w, sellerId).liquidatingSince === null && floorFd * (1 - w.cfg.usedMarket.feePct) < loan.principalFd) {
    return `the floor must cover the ${Math.round(loan.principalFd)} FD loan on the truck`;
  }
  // The crew stays with the company, free for another truck.
  if (truck.coDriverId) unseatDriver(w, staffById(w, truck.coDriverId));
  if (truck.driverId) unseatDriver(w, staffById(w, truck.driverId));
  const listing: Listing = {
    id: w.listings.length + 1,
    truckId: truck.id,
    sellerId,
    loanId: loan?.id ?? null,
    formerOwnerId: truck.companyId,
    listedDay: dayOf(w.t, w.cfg),
    askFd: Math.max(askFd, floorFd),
    floorFd,
    stepFd,
    status: "open",
  };
  truck.status = "listed";
  w.listings.push(listing);
  return listing;
}

export function withdrawListing(w: World, sellerId: number, listingId: number): string | null {
  const l = w.listings[listingId - 1];
  if (!l || l.status !== "open" || l.sellerId !== sellerId || sellerId === 0) return "no such listing";
  l.status = "withdrawn";
  const truck = truckById(w, l.truckId);
  truck.status = "parked";
  return null;
}

export function buyListing(w: World, buyerId: number, listingId: number): string | null {
  const { cfg } = w;
  const l = w.listings[listingId - 1];
  if (!l || l.status !== "open") return "no such listing";
  if (l.sellerId === buyerId || l.formerOwnerId === buyerId) return "can't buy your own truck";
  const buyer = companyById(w, buyerId);
  if (buyer.role !== "carrier") return "only carriers run trucks in Phase 0";
  const buyerAcct = companyAccount(buyerId);
  if (w.ledger.balance(buyerAcct) < l.askFd) return "insufficient FD";
  const fleet = w.trucksByCompany.get(buyerId)!;
  const npc = fleet.find((t) => t.lease === "npc");
  if (!npc && fleet.length >= truckCap(w, companyById(w, buyerId))) return "company truck cap";
  if (npc && npc.status !== "idle") return "NPC-leased truck is on a trip";

  const truck = truckById(w, l.truckId);
  const fee = l.askFd * cfg.usedMarket.feePct;
  const net = l.askFd - fee;
  const ref = `listing:${l.id}`;
  w.ledger.post(w.t, buyerAcct, "sink:market_fee", fee, ref);
  const loan = l.loanId !== null ? w.finance.loans[l.loanId - 1] : undefined;
  const loanOpen = loan !== undefined && (loan.status === "active" || loan.status === "defaulted" || loan.status === "repossessed");
  if (l.sellerId === 0) {
    // A repossession: the pool keeps what it's owed, the former owner gets any surplus.
    w.ledger.post(w.t, buyerAcct, POOL_ACCOUNT, net, ref);
    const surplus = loanOpen ? closeLoanFromPoolProceeds(w, loan, net) : net;
    if (surplus > 0.01) w.ledger.post(w.t, POOL_ACCOUNT, companyAccount(l.formerOwnerId), surplus, `surplus:${l.id}`);
  } else {
    // An owner's sale: the seller is paid, then repays any loan on the truck from it.
    const sellerAcct = companyAccount(l.sellerId);
    w.ledger.post(w.t, buyerAcct, sellerAcct, net, ref);
    if (loanOpen) settleLoanFromSale(w, loan, sellerAcct, net);
  }

  if (l.sellerId !== 0) companyById(w, l.sellerId).usedSold++;
  detachTruck(w, truck);
  if (npc) {
    // A free owner-operator's first owned truck: the NPC lease goes back to the lessor.
    detachTruck(w, npc);
    npc.status = "retired";
    buyer.firstOwnedTruckDay ??= dayOf(w.t, cfg);
  }
  attachTruck(w, truck, buyerId);
  buyer.usedBought++;
  l.status = "sold";
  w.metrics.onUsedSale(l.sellerId === 0);
  return null;
}

/**
 * The repo man (§DeFi buildings): a defaulted loan's truck is seized the next
 * time it's idle at a hub and listed by Equipment Finance. (The spec seizes it
 * mid-route and hands the load to an NPC carrier; waiting for the hub keeps this
 * prototype simple.)
 */
export function repossessDefaults(w: World): void {
  const ef = w.cfg.equipmentFinance;
  const today = dayOf(w.t, w.cfg);
  for (const loan of w.finance.loans) {
    if (loan.status !== "defaulted") continue;
    const truck = truckById(w, loan.truckId);
    if (truck.status === "listed") {
      // The owner had it up for sale; Equipment Finance takes the listing over.
      const own = w.listings.find((l) => l.truckId === truck.id && l.status === "open");
      if (own) own.status = "withdrawn";
    } else if (truck.status !== "idle" && truck.status !== "parked") continue;
    const borrower = companyById(w, loan.borrowerId);
    const value = truckValue(w, truck);
    truck.status = "idle"; // listTruck sets "listed"
    const listing = listTruck(w, 0, truck, value * ef.repoStartPctOfValue, value * ef.repoFloorPctOfValue, value * ef.repoWeeklyStepPctOfValue);
    if (typeof listing === "string") continue;
    listing.loanId = loan.id;
    listing.formerOwnerId = borrower.id;
    detachTruck(w, truck);
    loan.status = "repossessed";
    borrower.repossessions++;
    w.metrics.onRepossession();
  }
}

/**
 * Weekly price cuts on unsold listings. An owner's listing that reaches its floor
 * comes off the market (the truck is parked); a repossession that reaches its
 * floor goes back to dealer supply and the pool writes off the loan.
 */
export function stepListings(w: World): void {
  for (const l of openListings(w)) {
    if (l.stepFd > 0 && l.askFd - l.stepFd >= l.floorFd) {
      l.askFd -= l.stepFd;
      continue;
    }
    const truck = truckById(w, l.truckId);
    const seller = l.sellerId !== 0 ? companyById(w, l.sellerId) : null;
    if (seller && seller.liquidatingSince === null) {
      l.status = "withdrawn";
      truck.status = "parked";
      continue;
    }
    // Unsold repossessions and fire sales go back to dealer supply; the lender writes off what it can't recover.
    if (seller) detachTruck(w, truck);
    l.status = "returned";
    truck.status = "retired";
    w.supply.tractor[truck.tier]++;
    w.supply.trailer[truck.trailer]++;
    const loan = l.loanId !== null ? w.finance.loans[l.loanId - 1] : undefined;
    if (loan && (loan.status === "repossessed" || loan.status === "active" || loan.status === "defaulted")) writeOffLoan(w, loan);
    w.metrics.onListingReturned();
  }
}
