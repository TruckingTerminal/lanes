import { dayOf } from "./clock.js";
import { fmtInt } from "./economics.js";
import { chargeSalesTax, salesTaxOn } from "./salesTax.js";
import { activeLoanOn, closeLoanFromPoolProceeds, POOL_ACCOUNT, settleLoanFromSale, writeOffLoan } from "./finance.js";
import { companyAccount } from "./ledger.js";
import type { Listing, Trailer, Truck } from "./types.js";
import { trailerPrice, trailerValue, truckValue, trailerOrdersOf } from "./dealer.js";
import { dealerPrice } from "./dealer.js";
import { handBack, hook, hookedTrailer, ownedTrailers, scrapTrailer, trailerCap, transferTrailer, unhook } from "./trailers.js";
import { scrapTractor } from "./assets.js";
import { truckCap } from "./staking.js";
import { attachTruck, companyById, detachTruck, staffById, truckById, unlockFreePathEarnings, unseatDriver, type World } from "./world.js";

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
  if (sellerId !== 0 && truck.lessorId !== 0 && truck.lessorId !== truck.companyId) return "a leased truck is its owner's to sell";
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
  // Assets: a rig sells with its own trailer; a rental goes back to the lessor first.
  const tr = w.cfg.assets.enabled ? hookedTrailer(w, truck) : null;
  if (tr && tr.lease !== "owned") handBack(w, tr);
  const listing: Listing = {
    id: w.listings.length + 1,
    truckId: truck.id,
    trailerId: 0,
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

/** Assets: a trailer waiting in the yard, for sale on its own. */
export function listTrailer(w: World, sellerId: number, tr: Trailer, askFd: number, floorFd: number, stepFd: number): Listing | string {
  if (tr.companyId !== sellerId || tr.lease !== "owned") return "not your trailer";
  if (tr.status !== "dropped" || tr.refurbUntilT !== null) return "the trailer must be in the yard";
  if (!(stepFd > 0) || !(floorFd >= 0) || !(askFd >= floorFd)) return "ask at or above the floor, with a weekly price cut";
  if (askFd > 2 * trailerPrice(w, tr.type)) return "asking more than twice what it costs new";
  const listing: Listing = {
    id: w.listings.length + 1,
    truckId: 0,
    trailerId: tr.id,
    sellerId,
    loanId: null,
    formerOwnerId: sellerId,
    listedDay: dayOf(w.t, w.cfg),
    askFd: Math.max(askFd, floorFd),
    floorFd,
    stepFd,
    status: "open",
  };
  tr.status = "listed";
  w.listings.push(listing);
  return listing;
}

export function withdrawListing(w: World, sellerId: number, listingId: number): string | null {
  const l = w.listings[listingId - 1];
  if (!l || l.status !== "open" || l.sellerId !== sellerId || sellerId === 0) return "no such listing";
  l.status = "withdrawn";
  if (l.trailerId) {
    w.trailers[l.trailerId - 1]!.status = "dropped";
    return null;
  }
  const truck = truckById(w, l.truckId);
  truck.status = "parked";
  return null;
}

/**
 * Why buying this truck listing would be refused, without buying: buyListing's checks, with `extraFd` counted as cash (a
 * lease deposit about to be released toward it). A trailer listing goes to its own checks. Null when it would go through.
 */
export function listingBlock(w: World, buyerId: number, listingId: number, extraFd = 0): string | null {
  const l = w.listings[listingId - 1];
  if (!l || l.status !== "open") return "no such listing";
  if (l.sellerId === buyerId || l.formerOwnerId === buyerId) return "can't buy your own truck";
  const buyer = companyById(w, buyerId);
  if (buyer.role !== "carrier") return "only carriers run trucks in Phase 0";
  if (w.ledger.balance(companyAccount(buyerId)) + extraFd < l.askFd + salesTaxOn(w, l.askFd)) return "insufficient FD";
  if (l.trailerId) return null;
  const fleet = w.trucksByCompany.get(buyerId)!;
  const npc = fleet.find((t) => t.lease === "npc");
  if (!npc && fleet.length >= truckCap(w, buyer)) return "company truck cap";
  if (npc && npc.status !== "idle") return "NPC-leased truck is on a trip";
  const truck = truckById(w, l.truckId);
  // Assets: the rig's own trailer comes with it, so it needs room in the yard.
  if (w.cfg.assets.enabled && hookedTrailer(w, truck)?.lease === "owned" && ownedTrailers(w, buyer).length + trailerOrdersOf(w, buyerId).length >= trailerCap(w, buyer)) return "no room in the yard for its trailer";
  return null;
}

export function buyListing(w: World, buyerId: number, listingId: number): string | null {
  const { cfg } = w;
  const l = w.listings[listingId - 1];
  const why = listingBlock(w, buyerId, listingId);
  if (why) return why;
  if (!l) return "no such listing";
  const buyer = companyById(w, buyerId);
  const buyerAcct = companyAccount(buyerId);
  if (l.trailerId) return buyTrailerListing(w, l, buyerId);
  const fleet = w.trucksByCompany.get(buyerId)!;
  const npc = fleet.find((t) => t.lease === "npc");
  const truck = truckById(w, l.truckId);
  const fee = l.askFd * cfg.usedMarket.feePct;
  const net = l.askFd - fee;
  const ref = `listing:${l.id}`;
  let lockedPaid = w.ledger.post(w.t, buyerAcct, "sink:market_fee", fee, ref);
  chargeSalesTax(w, buyerId, l.askFd, ref);
  const loan = l.loanId !== null ? w.finance.loans[l.loanId - 1] : undefined;
  const loanOpen = loan !== undefined && (loan.status === "active" || loan.status === "defaulted" || loan.status === "repossessed");
  const basis = truck.lockedBasisFd ?? 0; // what the seller bought it with in spend-only FD comes back locked (ledger.ts)
  let sellerBefore = 0;
  if (l.sellerId === 0) {
    // A repossession: the pool keeps what it's owed, the former owner gets any surplus.
    lockedPaid += w.ledger.post(w.t, buyerAcct, POOL_ACCOUNT, net, ref, "lockedFirst");
    const surplus = loanOpen ? closeLoanFromPoolProceeds(w, loan, net) : net;
    if (surplus > 0.01) {
      const carried = w.ledger.post(w.t, POOL_ACCOUNT, companyAccount(l.formerOwnerId), surplus, `surplus:${l.id}`, "freeFirst");
      w.ledger.lock(companyAccount(l.formerOwnerId), Math.max(0, Math.min(surplus, basis) - carried));
    }
  } else {
    // An owner's sale: the seller is paid, then repays any loan on the truck from it.
    const sellerAcct = companyAccount(l.sellerId);
    sellerBefore = w.ledger.balance(sellerAcct);
    const carried = w.ledger.post(w.t, buyerAcct, sellerAcct, net, ref);
    lockedPaid += carried;
    w.ledger.lock(sellerAcct, Math.max(0, Math.min(net, basis) - carried)); // locked up to the basis in all, what the payment carried included
    if (loanOpen) settleLoanFromSale(w, loan, sellerAcct, net);
  }
  truck.lockedBasisFd = lockedPaid;

  if (l.sellerId !== 0) companyById(w, l.sellerId).usedSold++;
  detachTruck(w, truck); // a purchase loan on it closes here, its stake back to the seller
  // Client batch 8b item 8 (the exploit hunter: a listing sold without a word): the seller hears it on the day, with
  // the price, the fee, what repaid the truck's loans and what it kept. A listener line only; nothing reads it.
  if (l.sellerId !== 0) {
    const kept = w.ledger.balance(companyAccount(l.sellerId)) - sellerBefore;
    w.listener?.({ kind: "notice", companyId: l.sellerId, topic: "fleet", text: soldNotice(truck.id, l.askFd, fee, net, kept), tone: "good", truckId: truck.id });
  }
  if (npc) {
    // A free owner-operator's first owned truck: the NPC lease goes back to the lessor.
    detachTruck(w, npc);
    npc.status = "retired";
    buyer.firstOwnedTruckDay ??= dayOf(w.t, cfg);
    unlockFreePathEarnings(w, buyer);
  }
  attachTruck(w, truck, buyerId);
  buyer.usedBought++;
  l.status = "sold";
  w.metrics.onUsedSale(l.sellerId === 0);
  return null;
}

/**
 * The seller's notice when its listing sells (the writer may reword it): the price, the market's fee, and, where the sale
 * repaid a loan on the truck, what that took and what the seller kept (a purchase loan's stake comes back in it).
 */
export function soldNotice(truckId: number, askFd: number, feeFd: number, netFd: number, keptFd: number): string {
  const head = `Truck ${truckId} sold on the used market for ${fmtInt(askFd)} FD; after the ${fmtInt(feeFd)} FD market fee, ${fmtInt(netFd)} FD came to you.`;
  const repaid = netFd - keptFd;
  if (repaid > 0.5) return `${head} ${fmtInt(repaid)} FD of it repaid the truck's loan, with the loan's stake back to you: you kept ${fmtInt(keptFd)} FD.`;
  if (keptFd - netFd > 0.5) return `${head} The truck's loan was already paid, and its ${fmtInt(keptFd - netFd)} FD stake came back to you too.`;
  return head;
}

/** Assets: a used trailer goes to the buyer's yard, or straight behind a tractor there that pulls a rental. */
function buyTrailerListing(w: World, l: Listing, buyerId: number): string | null {
  const buyer = companyById(w, buyerId);
  const buyerAcct = companyAccount(buyerId);
  if (ownedTrailers(w, buyer).length + trailerOrdersOf(w, buyerId).length >= trailerCap(w, buyer)) return "no room in the yard";
  const tr = w.trailers[l.trailerId - 1]!;
  const fee = l.askFd * w.cfg.usedMarket.feePct;
  const ref = `listing:${l.id}`;
  let lockedPaid = w.ledger.post(w.t, buyerAcct, "sink:market_fee", fee, ref);
  chargeSalesTax(w, buyerId, l.askFd, ref);
  const carried = w.ledger.post(w.t, buyerAcct, companyAccount(l.sellerId), l.askFd - fee, ref);
  lockedPaid += carried;
  w.ledger.lock(companyAccount(l.sellerId), Math.max(0, Math.min(l.askFd - fee, tr.lockedBasisFd ?? 0) - carried)); // bought with spend-only FD: sold for the same
  tr.lockedBasisFd = lockedPaid;
  companyById(w, l.sellerId).usedSold++;
  transferTrailer(w, tr, buyer);
  const truck = w.trucksByCompany.get(buyerId)!.find((t) => t.status === "idle" && t.hub === buyer.homeHub && hookedTrailer(w, t)?.lease === "rental");
  if (truck) {
    unhook(w, truck);
    hook(w, truck, tr);
  }
  buyer.usedBought++;
  l.status = "sold";
  w.metrics.onUsedSale(false);
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
    if (l.trailerId) {
      // A trailer that didn't sell: back to the yard, or for scrap if the seller is being wound up.
      const tr = w.trailers[l.trailerId - 1]!;
      const seller = companyById(w, l.sellerId);
      l.status = seller.liquidatingSince === null ? "withdrawn" : "returned";
      tr.status = "dropped";
      if (seller.liquidatingSince !== null) scrapTrailer(w, tr);
      continue;
    }
    const truck = truckById(w, l.truckId);
    const seller = l.sellerId !== 0 ? companyById(w, l.sellerId) : null;
    // A dealership's used lot (a trade-in, off its owner's fleet) holds the truck at its floor until it sells.
    if (seller && seller.liquidatingSince === null && truck.companyId === 0) continue;
    if (seller && seller.liquidatingSince === null) {
      l.status = "withdrawn";
      truck.status = "parked";
      continue;
    }
    // Unsold repossessions and fire sales go back to dealer supply; the lender writes off what it can't recover.
    // Assets on, nothing is recycled: they go for scrap, the scrap value to the seller (the lender, for a repossession).
    const loan = l.loanId !== null ? w.finance.loans[l.loanId - 1] : undefined;
    l.status = "returned";
    if (w.cfg.assets.enabled) {
      scrapTractor(w, truck, seller ? companyAccount(seller.id) : POOL_ACCOUNT, true);
    } else {
      if (seller) detachTruck(w, truck);
      truck.status = "retired";
      w.supply.tractor[truck.tier]++;
      w.supply.trailer[truck.trailer]++;
    }
    if (loan && (loan.status === "repossessed" || loan.status === "active" || loan.status === "defaulted")) writeOffLoan(w, loan);
    w.metrics.onListingReturned();
  }
}
