import { layerBlock } from "./ladder.js";
import { buyLogbookBoost } from "./logbook.js";
import { fitSecurity, hireCrew, postBounty } from "./robbery.js";
import { scaleDiscount } from "./scale.js";
import { acceptOffer, acceptTender, declineOffer, mayTake, rejectTender } from "./contracts.js";
import { addParking, buyBusiness, buyTruckStop, serviceBill, setParkingPrice, setShopMarkup } from "./businesses.js";
import { chargeSalesTax, salesTaxOn } from "./salesTax.js";
import { bookLoad } from "./board.js";
import { offerFd } from "./buyback.js";
import { leaseTruck, returnLease } from "./capacity.js";
import { bidAuction, buyFd, cancelWithdrawal, claimAirdropNow, sellFd } from "./token.js";
import { payAssetUsd } from "./items.js";
import { dayOf } from "./clock.js";
import { dealerPrice, lotPrice, lotSpec, ordersOf, placeOrder, tractorOrdersOf, tractorPrice, trailerOrdersOf, trailerPrice } from "./dealer.js";
import { fitTrailer, hook, hookedTrailer, ownedTrailers, rentTrailer, scrapTrailer, syncTrailer, trailerById, trailerCap, trailerCondition, trailerRefurbishable, unhook } from "./trailers.js";
import { scrapOwnedTractor } from "./assets.js";
import { dealershipPrice, npcDealerDays, npcDealerMult, sellFromStock, tradeIn } from "./dealerships.js";
import { cancelPurchaseLoan, financedCashNeed, financePurchase } from "./purchaseLoans.js";
import { endPlayerLease, leasedOut, offerLease, takeLease, withdrawLeaseOffer } from "./playerLeases.js";
import { buyAssetSale, listAssetSale, withdrawAssetSale } from "./assetSales.js";
import { facilitiesOf, facilityEquipment } from "./demand.js";
import { borrow, deposit, repayLoan, withdraw } from "./finance.js";
import { companyAccount } from "./ledger.js";
import { rebrokerLoad, stealLoad, vettingBlock } from "./fraud.js";
import { finiteIn } from "./economics.js";
import { offerStaff, releaseStaff, setPay, severance, startHomeTime } from "./labor.js";
import { buyListing, listTrailer, listTruck, withdrawListing } from "./market.js";
import { canRefile, notice } from "./safety.js";
import { canMakeHot } from "./standingOrders.js";
import { inCloseWindow } from "./season.js";
import { refile } from "./solvency.js";
import { facilityCap, stakeDiscount, stakeFd, truckCap, unstakeFd } from "./staking.js";
import { buyItem } from "./items.js";
import { depositPool, withdrawPool } from "./pools.js";
import { endFactoring, signFactoring } from "./receivables.js";
import type { Action, RuleScope } from "./types.js";
import { condition, rebuildable, rebuildCost } from "./wear.js";
import { availableSupplyFor, companyById, crewed, hubMiles, invalidOrders, releaseDepositFor, seatDriver, staffById, syncFleet, takeSupplyFor, truckById, unseatDriver, type World, placeMiles, placeOfHub, placeLegMiles } from "./world.js";
import type { EconomyConfig } from "@lanes/config";

const TIERS = new Set(["workhorse", "highwayPro", "flagship"]);
const TRAILERS = new Set(["van", "reefer", "flatbed"]);
const FACILITIES = new Set(["warehouse", "coldStorage", "factory"]);
const isId = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 1e9;
const isFd = (x: unknown): x is number => finiteIn(x, 0, 1e12);
const isStr = (x: unknown): x is string => typeof x === "string" && x.length <= 64;

/**
 * Why an action's fields can't be trusted, or null. Actions arrive from players'
 * browsers as JSON: a string where a number belongs, NaN, a negative price or a
 * prototype key would reach the ledger or a bid score and stop the shared world
 * for everyone, so every field is checked before anything looks at it.
 */
export function badInput(cfg: EconomyConfig, a: Action): string | null {
  if (!a || typeof a !== "object" || typeof a.type !== "string") return "bad action";
  switch (a.type) {
    case "wait":
    case "claim_airdrop_now":
    case "refile_authority":
      return null;
    case "set_standing_orders":
      return invalidOrders(cfg, a.orders);
    case "buy_asset":
      return TIERS.has(a.tier) && TRAILERS.has(a.trailer) && typeof a.replaceNpcLease === "boolean" && (a.tractorOnly === undefined || typeof a.tractorOnly === "boolean") && (a.dealershipId === undefined || isId(a.dealershipId)) && (a.finance === undefined || typeof a.finance === "boolean") && (a.used === undefined || typeof a.used === "boolean") ? null : "bad truck";
    case "buy_trailer":
      return TRAILERS.has(a.trailer) && (a.dealershipId === undefined || isId(a.dealershipId)) ? null : "bad trailer";
    case "trade_in":
      return isId(a.truckId) && isId(a.dealershipId) ? null : "bad trade-in";
    case "offer_lease":
      return isId(a.truckId) && finiteIn(a.weeklyFd, 0.01, 1e9) && Number.isInteger(a.minWeeks) && a.minWeeks >= 1 && a.minWeeks <= 520 ? null : "bad lease offer";
    case "withdraw_lease_offer":
    case "take_lease":
      return isId(a.offerId) ? null : "bad offer id";
    case "list_asset_sale":
      return (a.kind === "business" || a.kind === "facility" || a.kind === "yard") && isId(a.refId) && finiteIn(a.askFd, 0.01, 1e9) ? null : "bad sale";
    case "withdraw_asset_sale":
    case "buy_asset_sale":
      return isId(a.saleId) ? null : "bad sale id";
    case "swap_trailer":
      return isId(a.truckId) && isId(a.trailerId) ? null : "bad swap";
    case "rent_trailer":
      return isId(a.truckId) && TRAILERS.has(a.trailer) ? null : "bad rental";
    case "refurbish_trailer":
    case "scrap_trailer":
      return isId(a.trailerId) ? null : "bad trailer id";
    case "scrap_truck":
      return isId(a.truckId) ? null : "bad truck id";
    case "list_trailer":
      return isId(a.trailerId) && isFd(a.askFd) && isFd(a.floorFd) && isFd(a.stepFd) ? null : "bad listing";
    case "book_load":
    case "accept_tender":
      return isId(a.truckId) && isId(a.loadId) ? null : "bad booking";
    case "accept_contract":
    case "decline_contract":
      return isId(a.contractId) ? null : "bad contract";
    case "decline_tender":
      return isId(a.loadId) ? null : "bad load";
    case "rebuild_truck":
    case "park_truck":
    case "unpark_truck":
    case "send_home":
    case "cancel_bid":
    case "fix_defects":
    case "return_lease":
    case "steal_load":
    case "hire_crew":
      return isId(a.truckId) ? null : "bad truck id";
    case "post_bounty":
      return isId(a.targetId) && isFd(a.fd) ? null : "bad bounty";
    case "buy_logbook_boost":
      return isStr(a.milestone) ? null : "bad milestone";
    case "fit_security":
      return isId(a.truckId) && (a.item === "tracker" || a.item === "locks" || a.item === "camera") ? null : "bad fitting";
    case "reposition_truck":
      return isId(a.truckId) && isStr(a.hubId) ? null : "bad destination";
    case "list_truck":
      return isId(a.truckId) && isFd(a.askFd) && isFd(a.floorFd) && isFd(a.stepFd) ? null : "bad listing";
    case "withdraw_listing":
      return isId(a.listingId) ? null : "bad listing id";
    case "buy_listing":
      return isId(a.listingId) && (a.finance === undefined || typeof a.finance === "boolean") ? null : "bad listing id";
    case "deposit_finance":
    case "withdraw_finance":
      return finiteIn(a.amountFd, 0.01, 1e12) ? null : "bad amount";
    case "borrow":
      return isId(a.truckId) && finiteIn(a.amountFd, 0.01, 1e12) ? null : "bad loan";
    case "repay_loan":
      return isId(a.loanId) ? null : "bad loan id";
    case "buy_facility":
      return FACILITIES.has(a.facility) && isStr(a.hubId) ? null : "bad facility";
    case "lease_truck":
      return TRAILERS.has(a.trailer) ? null : "bad trailer";
    case "place_bid":
      return isId(a.truckId) && isId(a.loadId) && finiteIn(a.rate, 0.01, 100) ? null : "bad bid";
    case "buy_fd":
    case "bid_auction":
      return finiteIn(a.usd, 0.01, 1e9) ? null : "bad amount";
    case "cancel_withdrawal":
      return null;
    case "sell_fd":
      return finiteIn(a.fd, 0.01, 1e12) ? null : "bad amount";
    case "stake_fd":
      return finiteIn(a.fd, 0.01, 1e12) ? null : "bad amount";
    case "unstake_fd":
      return finiteIn(a.fd, 0.01, 1e12) && typeof a.instant === "boolean" ? null : "bad amount";
    case "deposit_pool":
    case "withdraw_pool":
      return (a.line === "insurance" || a.line === "factoring" || a.line === "surety") && finiteIn(a.amountFd, 0.01, 1e12) ? null : "bad pool deposit";
    case "set_pay_terms":
      return a.terms === "net" || a.terms === "quick" || a.terms === "factor" ? null : "bad terms";
    case "buy_item":
      return ["yardSmall", "yardLarge", "trailerSpace", "apu", "aero", "tires", "sleeper"].includes(a.item) && (a.pay === "fd" || a.pay === "usd") && (a.truckId === undefined || isId(a.truckId)) ? null : "bad item";
    case "buy_business":
      return a.kind === "truckStop" ? (isId(a.siteId) ? null : "bad site") : (a.kind === "shop" || a.kind === "fuelStation" || a.kind === "dealership" || a.kind === "fence" || a.kind === "chopShop") && typeof a.hubId === "string" ? null : "bad business";
    case "set_shop_markup":
      return isId(a.businessId) && finiteIn(a.markup, 0.5, 2) ? null : "bad markup";
    case "set_parking_price":
      return isId(a.businessId) && finiteIn(a.fd, 0, 1_000) ? null : "bad price";
    case "add_parking":
      return isId(a.businessId) ? null : "bad business";
    case "offer_fd":
      return isFd(a.amountFd) && finiteIn(a.minPriceUsd, 0, 1e6) ? null : "bad offer";
    case "offer_staff":
      return isId(a.staffId) && finiteIn(a.pay, 0.01, 1e6) && (a.truckId === undefined || isId(a.truckId)) ? null : "bad offer";
    case "release_staff":
      return isId(a.staffId) ? null : "bad staff id";
    case "set_staff_pay":
      return isId(a.staffId) && finiteIn(a.pay, 0.01, 1e6) ? null : "bad pay";
    case "assign_driver":
      return isId(a.staffId) && isId(a.truckId) && (a.team === undefined || typeof a.team === "boolean") ? null : "bad assignment";
    case "set_auto_staff":
      return typeof a.on === "boolean" ? null : "bad setting";
    case "set_compliance":
      return a.policy && typeof a.policy === "object" ? null : "bad policy";
    case "set_vetting":
      return a.tier === 0 || a.tier === 1 || a.tier === 2 ? null : "bad vetting tier";
    case "rebroker_load":
      return isId(a.loadId) && finiteIn(a.rate, 0.01, 100) && typeof a.pay === "boolean" ? null : "bad re-post";
    default:
      return "unknown action";
  }
}

/** What a company being wound up can't do: it isn't buying, bidding or borrowing again until it restarts. */
const LIQUIDATING_BLOCKED = new Set<Action["type"]>(["place_bid", "book_load", "reposition_truck", "buy_asset", "buy_trailer", "rent_trailer", "buy_facility", "lease_truck", "borrow", "buy_listing", "unpark_truck", "offer_staff", "take_lease", "buy_asset_sale", "list_asset_sale"]);

/** What a company whose authority was revoked can still do: wait out the bar, file again, and handle its money. */
const ALLOWED_REVOKED = new Set<Action["type"]>(["wait", "refile_authority", "buy_fd", "bid_auction", "sell_fd", "cancel_withdrawal", "offer_fd", "claim_airdrop_now", "withdraw_finance", "withdraw_listing", "set_compliance", "set_vetting", "set_auto_staff"]);
const SCOPES: RuleScope[] = ["legal", "hot", "always"];
/**
 * The bad-actor actions: an illegal policy, re-brokering and theft. Players may
 * take them like the AI does (config `fraud.players`); with it off they're AI-only.
 */
function badActor(a: Action): boolean {
  switch (a.type) {
    case "rebroker_load":
    case "steal_load":
      return true;
    case "set_compliance":
      return a.policy.hos !== "legal" || a.policy.speed !== "legal" || a.policy.maintenance !== "full";
    case "set_standing_orders":
      return a.orders.some((o) => o.kind === "rebroker");
    default:
      return false;
  }
}

/** A truck parked at a hub (or in the shop), where a crew can change. */
const atHub = (status: string) => status === "idle" || status === "parked" || status === "repair";

/** How far a truck may run empty to a load bid by hand. */
export const MANUAL_BID_MAX_DEADHEAD_MI = 300;

export type ActionResult = { ok: true } | { ok: false; reason: string };

const LOCKED: ActionResult = { ok: false, reason: "season close: permanent purchases are locked" };
const result = (error: string | null): ActionResult => (error === null ? { ok: true } : { ok: false, reason: error });

/** The single action API for players and agents (§Tech — engineering rules). */
export function applyAction(w: World, companyId: number, action: Action): ActionResult {
  const company = companyById(w, companyId);
  const { cfg } = w;
  const acct = companyAccount(company.id);
  const bad = badInput(cfg, action);
  if (bad) return { ok: false, reason: bad };
  if (company.authority.status === "revoked" && !ALLOWED_REVOKED.has(action.type)) return { ok: false, reason: "your authority is revoked" };
  if (company.liquidatingSince !== null && LIQUIDATING_BLOCKED.has(action.type)) return { ok: false, reason: "the company is being wound up" };
  if (company.human && !cfg.fraud.players && badActor(action)) return { ok: false, reason: "that isn't available to players" };
  switch (action.type) {
    case "wait":
      return { ok: true };

    case "offer_staff": {
      const s = staffById(w, action.staffId);
      if (!s) return { ok: false, reason: "no such person" };
      return result(offerStaff(w, company, s, action.pay, action.truckId ?? 0));
    }

    case "release_staff": {
      const s = staffById(w, action.staffId);
      if (!s || s.companyId !== company.id || s.status !== "employed") return { ok: false, reason: "they don't work for you" };
      if (s.owner) return { ok: false, reason: "you can't fire yourself" };
      if (s.truckId && !atHub(truckById(w, s.truckId).status)) return { ok: false, reason: "wait until their truck is at a hub" };
      // Hired and fired within a month: severance.
      const sev = severance(w, s);
      if (sev > 0) {
        w.ledger.post(w.t, acct, "sink:severance", sev, `severance:${s.id}`);
        company.operating.costFd += sev;
      }
      releaseStaff(w, s);
      return { ok: true };
    }

    case "set_staff_pay": {
      const s = staffById(w, action.staffId);
      if (!s || s.companyId !== company.id || s.status !== "employed") return { ok: false, reason: "they don't work for you" };
      if (s.owner) return { ok: false, reason: "the owner's draw is fixed" };
      if (!finiteIn(action.pay, 0.01, s.kind === "driver" ? 20 : 50_000)) return { ok: false, reason: "pay above zero" };
      setPay(w, s, action.pay);
      return { ok: true };
    }

    case "assign_driver": {
      const s = staffById(w, action.staffId);
      if (!s || s.companyId !== company.id || s.status !== "employed" || s.kind !== "driver") return { ok: false, reason: "not one of your drivers" };
      if (s.truckId && !atHub(truckById(w, s.truckId).status)) return { ok: false, reason: "their truck is on the road" };
      if (action.truckId === 0) {
        unseatDriver(w, s);
        return { ok: true };
      }
      const truck = truckById(w, action.truckId);
      if (!truck || truck.companyId !== company.id) return { ok: false, reason: "not your truck" };
      if (!atHub(truck.status)) return { ok: false, reason: "the truck must be at a hub" };
      if (action.team) {
        if (!crewed(truck)) return { ok: false, reason: "that truck needs a driver before a co-driver" };
        if (truck.coDriverId) return { ok: false, reason: "that truck already runs as a team" };
        if (truck.driverId === s.id) return { ok: false, reason: "they already drive it" };
        seatDriver(w, s, truck, true);
      } else {
        if (crewed(truck) && truck.driverId !== s.id) return { ok: false, reason: "that truck already has a driver" };
        seatDriver(w, s, truck);
      }
      return { ok: true };
    }

    case "set_auto_staff":
      company.autoStaff = action.on;
      return { ok: true };

    case "set_compliance": {
      const p = action.policy;
      if (!SCOPES.includes(p.hos) || !SCOPES.includes(p.speed) || (p.maintenance !== "full" && p.maintenance !== "deferred")) return { ok: false, reason: "unknown policy" };
      company.policy = { hos: p.hos, speed: p.speed, maintenance: p.maintenance };
      syncFleet(w, company.id);
      return { ok: true };
    }

    case "fix_defects": {
      const truck = truckById(w, action.truckId);
      if (!truck || truck.companyId !== company.id) return { ok: false, reason: "not your truck" };
      if (!atHub(truck.status)) return { ok: false, reason: "the truck must be at a hub" };
      if (truck.defects === 0) return { ok: false, reason: "nothing to fix" };
      const cost = truck.defects * cfg.safety.maintenance.fixFdPerDefect;
      if (w.ledger.balance(acct) < cost) return { ok: false, reason: "insufficient FD" };
      company.operating.costFd += serviceBill(w, company, truck.hub, cost, "repairs", `fix:${truck.id}`); // the hub's shop, or the NPC shop
      truck.defects = 0;
      return { ok: true };
    }

    case "set_vetting":
      if (action.tier !== 0 && action.tier !== 1 && action.tier !== 2) return { ok: false, reason: "unknown vetting tier" };
      company.vetting = action.tier;
      return { ok: true };

    case "refile_authority": {
      const why = canRefile(w, company);
      if (why) return { ok: false, reason: why };
      refile(w, company);
      notice(w, company.id, "authority", "New authority granted: you start over on the free path. Brokers can see the old revocation.", "info");
      return { ok: true };
    }

    case "rebroker_load": {
      const load = w.loads.get(action.loadId);
      if (!load) return { ok: false, reason: "no such load" };
      return result(rebrokerLoad(w, company, load, action.rate, action.pay));
    }

    case "steal_load": {
      const truck = truckById(w, action.truckId);
      if (!truck) return { ok: false, reason: "no such truck" };
      return result(stealLoad(w, company, truck));
    }

    case "hire_crew": {
      const truck = truckById(w, action.truckId);
      if (!truck) return { ok: false, reason: "no such truck" };
      return result(hireCrew(w, company, truck));
    }

    case "fit_security": {
      const truck = truckById(w, action.truckId);
      if (!truck) return { ok: false, reason: "no such truck" };
      return result(fitSecurity(w, company, truck, action.item));
    }

    case "set_standing_orders":
      // Checked field by field in badInput (invalidOrders).
      company.orders = action.orders;
      return { ok: true };

    case "book_load": {
      const truck = truckById(w, action.truckId);
      if (!truck || truck.companyId !== company.id) return { ok: false, reason: "not your truck" };
      const load = w.loads.get(action.loadId);
      if (!load || load.status !== "open") return { ok: false, reason: "that load is gone" };
      if (load.brokerId === company.id || load.doubleBroker?.companyId === company.id) return { ok: false, reason: "that's your own posting" };
      const block = vettingBlock(w, company, load);
      if (block) return { ok: false, reason: `the poster's vetting rules you out: ${block}` };
      if (load.hot > 0 && !canMakeHot(company, truck)) return { ok: false, reason: "a hot load needs a team" };
      const dh = placeMiles(w, truck.place, load.originPlace);
      if (dh > MANUAL_BID_MAX_DEADHEAD_MI) return { ok: false, reason: `the pickup is more than ${MANUAL_BID_MAX_DEADHEAD_MI} miles away` };
      return result(bookLoad(w, company, truck, load, dh, true));
    }

    case "accept_contract":
    case "decline_contract": {
      const contract = w.contracts.find((k) => k.id === action.contractId);
      if (!contract) return { ok: false, reason: "no such offer" };
      return result(action.type === "accept_contract" ? acceptOffer(w, company, contract) : declineOffer(w, company, contract));
    }

    case "accept_tender": {
      const truck = truckById(w, action.truckId);
      if (!truck || truck.companyId !== company.id) return { ok: false, reason: "not your truck" };
      const load = w.loads.get(action.loadId);
      if (!load || load.status !== "open" || load.tenderedTo !== company.id) return { ok: false, reason: "that tender isn't open to you" };
      const contract = w.contracts.find((k) => k.id === load.contractId);
      if (!contract) return { ok: false, reason: "that contract is gone" };
      const dh = placeMiles(w, truck.place, load.originPlace);
      if (dh > MANUAL_BID_MAX_DEADHEAD_MI) return { ok: false, reason: `the pickup is more than ${MANUAL_BID_MAX_DEADHEAD_MI} miles away` };
      const why = acceptTender(w, company, load, truck);
      if (why) return { ok: false, reason: why };
      return result(bookLoad(w, company, truck, load, dh, true, contract.ratePerMile));
    }

    case "decline_tender": {
      const load = w.loads.get(action.loadId);
      if (!load || load.status !== "open" || load.tenderedTo !== company.id) return { ok: false, reason: "that tender isn't open to you" };
      rejectTender(w, load);
      return { ok: true };
    }

    case "send_home": {
      const truck = truckById(w, action.truckId);
      if (!truck || truck.companyId !== company.id) return { ok: false, reason: "not your truck" };
      if (!crewed(truck)) return { ok: false, reason: "nobody is driving it" };
      if (truck.status !== "idle") return { ok: false, reason: "wait until the truck is idle" };
      w.manualBids.delete(truck.id);
      for (const id of [truck.driverId, truck.coDriverId]) if (id) w.staff[id - 1]!.wantsHome = true;
      // Sent by hand, the truck runs straight home; the dispatcher's rule would wait for a load that way.
      const miles = hubMiles(w, truck.hub, company.homeHub);
      if (miles > cfg.map.nearbyRadiusMi) {
        truck.status = "repositioning";
        truck.targetHub = company.homeHub;
        truck.targetPlace = placeOfHub(company.homeHub);
        truck.remainingMi = placeLegMiles(w, truck.place, truck.targetPlace);
        truck.idleRounds = 0;
      } else startHomeTime(w, company, truck);
      return { ok: true };
    }

    case "buy_asset": {
      // A dealer order: paid now, delivered after the lead time (see dealer.ts). Assets on, a rig brings its
      // own new trailer, and a tractor alone hooks a spare from the yard or a rental.
      if (company.role !== "carrier") return { ok: false, reason: "only carriers run trucks in Phase 0" };
      if (inCloseWindow(w)) return LOCKED;
      const fleet = w.trucksByCompany.get(company.id)!;
      const pending = tractorOrdersOf(w, company.id);
      const replacing = action.replaceNpcLease && fleet.some((t) => t.lease === "npc");
      if (replacing && pending.some((o) => o.replaceNpcLease)) return { ok: false, reason: "a replacement truck is already on order" };
      if (!replacing && fleet.length + pending.length >= truckCap(w, company)) return { ok: false, reason: "company truck cap" };
      const kind = cfg.assets.enabled && action.tractorOnly ? "tractor" : "rig";
      if (kind === "rig" && cfg.assets.enabled && ownedTrailers(w, company).length + trailerOrdersOf(w, company.id).length >= trailerCap(w, company)) {
        return { ok: false, reason: "no room in the yard for another trailer" };
      }
      // Assets: from a player dealership's stock, delivered in a week.
      if (cfg.assets.enabled && action.dealershipId) {
        const b = w.businesses[action.dealershipId - 1];
        if (!b) return { ok: false, reason: "no such dealership" };
        // On a purchase loan: the lender's share lands first, so the dealership is paid in full.
        const loan = action.finance ? financePurchase(w, company, dealershipPrice(w, b, company.id, kind, action.tier, action.trailer)) : null;
        if (typeof loan === "string") return { ok: false, reason: loan };
        const why = sellFromStock(w, company, b, kind, action.tier, action.trailer);
        const lockedPaid = b.lastSaleLockedFd ?? 0;
        if (why) {
          if (loan) cancelPurchaseLoan(w, loan);
          return { ok: false, reason: why };
        }
        const order = placeOrder(w, company, action.tier, action.trailer, replacing, kind, cfg.businesses.kinds.dealership.deliveryDays);
        order.lockedPaidFd = lockedPaid;
        if (loan) loan.orderId = order.id;
        company.firstOwnedTruckDay ??= dayOf(w.t, cfg);
        return { ok: true };
      }
      // The NPC used lot (usedMarket.npcLot): a worn rig at its used value, from the lot's stock, delivered like a new one.
      if (action.used) {
        if (!cfg.usedMarket.npcLot.enabled || !cfg.assets.enabled) return { ok: false, reason: "there's no used lot" };
        if (kind !== "rig" || action.dealershipId) return { ok: false, reason: "the used lot sells whole rigs" };
        if (w.usedLot.stock < 1) return { ok: false, reason: "the used lot is empty this week" };
        const price = lotPrice(w, action.tier, action.trailer) * npcDealerMult(w);
        if (replacing) releaseDepositFor(w, company, action.finance ? financedCashNeed(w, company, price) : price + salesTaxOn(w, price));
        const loan = action.finance ? financePurchase(w, company, price) : null;
        if (typeof loan === "string") return { ok: false, reason: loan };
        if (w.ledger.balance(acct) < price) {
          if (loan) cancelPurchaseLoan(w, loan);
          return { ok: false, reason: "insufficient FD" };
        }
        const ref = `buy:used:${company.id}:${action.tier}:${action.trailer}`;
        const lockedPaid = w.ledger.post(w.t, acct, "sink:used_lot", price, ref);
        chargeSalesTax(w, company.id, price, ref);
        w.usedLot.stock--;
        w.usedLot.sold++;
        const order = placeOrder(w, company, action.tier, action.trailer, replacing, kind, npcDealerDays(w));
        order.used = lotSpec(w, action.trailer);
        order.lockedPaidFd = lockedPaid;
        if (loan) loan.orderId = order.id;
        company.firstOwnedTruckDay ??= dayOf(w.t, cfg);
        return { ok: true };
      }
      const firstTruck = !fleet.some((t) => t.lease === "owned") && ordersOf(w, company.id).length === 0;
      if (availableSupplyFor(w, kind, action.tier, action.trailer, firstTruck) <= 0) return { ok: false, reason: "PoC supply exhausted" };
      // The NPC dealer: list price; while a player dealership is open, the backstop's premium and longer wait.
      // A big fleet buys at fleet pricing (scale.ts).
      const price = (kind === "tractor" ? tractorPrice(w, action.tier) : dealerPrice(w, action)) * npcDealerMult(w) * (1 - scaleDiscount(w, company));
      // The farming season's dollar window (token.catalogue.usdWindow.assets): a new rig for dollars, every dollar held for the launch pool.
      if (action.pay === "usd") {
        const why = payAssetUsd(w, company, price);
        if (why) return { ok: false, reason: why };
        takeSupplyFor(w, kind, action.tier, action.trailer, firstTruck);
        placeOrder(w, company, action.tier, action.trailer, replacing, kind, npcDealerDays(w)).lockedPaidFd = 0;
        company.firstOwnedTruckDay ??= dayOf(w.t, cfg);
        return { ok: true };
      }
      if (replacing) releaseDepositFor(w, company, action.finance ? financedCashNeed(w, company, price) : price + salesTaxOn(w, price));
      const loan = action.finance ? financePurchase(w, company, price) : null;
      if (typeof loan === "string") return { ok: false, reason: loan };
      if (w.ledger.balance(acct) < price) {
        if (loan) cancelPurchaseLoan(w, loan);
        return { ok: false, reason: "insufficient FD" };
      }

      const ref = `buy:${company.id}:${action.tier}:${kind === "tractor" ? "tractor" : action.trailer}`;
      const lockedPaid = w.ledger.post(w.t, acct, "sink:equipment_dealer", price, ref);
      chargeSalesTax(w, company.id, price, ref);
      takeSupplyFor(w, kind, action.tier, action.trailer, firstTruck);
      const order = placeOrder(w, company, action.tier, action.trailer, replacing, kind, npcDealerDays(w));
      order.lockedPaidFd = lockedPaid;
      if (loan) loan.orderId = order.id;
      company.firstOwnedTruckDay ??= dayOf(w.t, cfg);
      return { ok: true };
    }

    case "trade_in": {
      const truck = truckById(w, action.truckId);
      const b = w.businesses[action.dealershipId - 1];
      if (!truck || !b) return { ok: false, reason: "no such truck or dealership" };
      if (leasedOut(truck)) return { ok: false, reason: "a leased truck is its owner's to sell" };
      return result(tradeIn(w, company, truck, b));
    }

    case "offer_lease": {
      const truck = truckById(w, action.truckId);
      if (!truck) return { ok: false, reason: "no such truck" };
      return result(offerLease(w, company, truck, action.weeklyFd, action.minWeeks));
    }

    case "withdraw_lease_offer":
      return result(withdrawLeaseOffer(w, company, action.offerId));

    case "take_lease": {
      const o = w.leaseOffers[action.offerId - 1];
      if (!o) return { ok: false, reason: "no such offer" };
      return result(takeLease(w, company, o));
    }

    case "list_asset_sale":
      return result(listAssetSale(w, company, action.kind, action.refId, action.askFd));

    case "withdraw_asset_sale":
      return result(withdrawAssetSale(w, company, action.saleId));

    case "buy_asset_sale": {
      const s = w.assetSales[action.saleId - 1];
      if (!s) return { ok: false, reason: "no such sale" };
      return result(buyAssetSale(w, company, s));
    }

    case "buy_trailer": {
      // Assets: a trailer alone. Without a yard there's nowhere to keep a spare: only as many as the tractors.
      if (!cfg.assets.enabled) return { ok: false, reason: "trailers come with the truck" };
      if (company.role !== "carrier") return { ok: false, reason: "only carriers run trucks in Phase 0" };
      if (inCloseWindow(w)) return LOCKED;
      const owned = ownedTrailers(w, company).length + trailerOrdersOf(w, company.id).length;
      if (owned >= trailerCap(w, company)) return { ok: false, reason: "no room in the yard" };
      const tractors = w.trucksByCompany.get(company.id)!.filter((t) => t.lease === "owned").length + tractorOrdersOf(w, company.id).length;
      if (company.yard === "none" && owned >= tractors) return { ok: false, reason: "a spare trailer needs a yard" };
      if (action.dealershipId) {
        const b = w.businesses[action.dealershipId - 1];
        if (!b) return { ok: false, reason: "no such dealership" };
        const why = sellFromStock(w, company, b, "trailer", "workhorse", action.trailer);
        if (why) return { ok: false, reason: why };
        placeOrder(w, company, "workhorse", action.trailer, false, "trailer", cfg.businesses.kinds.dealership.deliveryDays).lockedPaidFd = b.lastSaleLockedFd ?? 0;
        return { ok: true };
      }
      if (availableSupplyFor(w, "trailer", "workhorse", action.trailer, false) <= 0) return { ok: false, reason: "PoC supply exhausted" };
      const price = trailerPrice(w, action.trailer) * npcDealerMult(w);
      if (action.pay === "usd") {
        const why = payAssetUsd(w, company, price);
        if (why) return { ok: false, reason: why };
        takeSupplyFor(w, "trailer", "workhorse", action.trailer, false);
        placeOrder(w, company, "workhorse", action.trailer, false, "trailer", npcDealerDays(w)).lockedPaidFd = 0;
        return { ok: true };
      }
      if (w.ledger.balance(acct) < price) return { ok: false, reason: "insufficient FD" };
      const ref = `buy:${company.id}:trailer:${action.trailer}`;
      const lockedPaid = w.ledger.post(w.t, acct, "sink:equipment_dealer", price, ref);
      chargeSalesTax(w, company.id, price, ref);
      takeSupplyFor(w, "trailer", "workhorse", action.trailer, false);
      placeOrder(w, company, "workhorse", action.trailer, false, "trailer", npcDealerDays(w)).lockedPaidFd = lockedPaid;
      return { ok: true };
    }

    case "swap_trailer": {
      // Assets: swaps happen at the yard, with the truck idle at the home hub.
      if (!cfg.assets.enabled) return { ok: false, reason: "trailers come with the truck" };
      const truck = truckById(w, action.truckId);
      if (!truck || truck.companyId !== company.id) return { ok: false, reason: "not your truck" };
      if (truck.lease !== "owned") return { ok: false, reason: "the lessor's truck keeps its trailer" };
      if (truck.status !== "idle" || truck.hub !== company.homeHub) return { ok: false, reason: "swaps happen at the yard: the truck must be idle at the home hub" };
      const tr = trailerById(w, action.trailerId);
      if (!tr || tr.companyId !== company.id || tr.status !== "dropped" || tr.refurbUntilT !== null) return { ok: false, reason: "that trailer isn't waiting in your yard" };
      unhook(w, truck);
      hook(w, truck, tr);
      w.manualBids.delete(truck.id);
      w.metrics.onTrailerSwap();
      return { ok: true };
    }

    case "rent_trailer": {
      // Assets: the NPC lessor rents by the week at any hub; an own trailer has to be dropped at the yard first.
      if (!cfg.assets.enabled) return { ok: false, reason: "trailers come with the truck" };
      const truck = truckById(w, action.truckId);
      if (!truck || truck.companyId !== company.id) return { ok: false, reason: "not your truck" };
      if (truck.lease !== "owned") return { ok: false, reason: "the lessor's truck keeps its trailer" };
      if (truck.status !== "idle") return { ok: false, reason: "the truck must be idle at a hub" };
      const cur = hookedTrailer(w, truck);
      if (cur && cur.lease === "owned" && (truck.hub !== company.homeHub || company.yard === "none")) return { ok: false, reason: "your own trailer has to be dropped in your yard first" };
      if (cur && cur.lease === "rental" && cur.type === action.trailer) return { ok: false, reason: "it already pulls a rented one of those" };
      unhook(w, truck);
      rentTrailer(w, truck, action.trailer);
      w.manualBids.delete(truck.id);
      return { ok: true };
    }

    case "refurbish_trailer": {
      if (!cfg.assets.enabled) return { ok: false, reason: "trailers come with the truck" };
      const tr = trailerById(w, action.trailerId);
      if (!tr || tr.companyId !== company.id || tr.lease !== "owned") return { ok: false, reason: "not your trailer" };
      const truck = tr.truckId ? truckById(w, tr.truckId) : null;
      if (tr.status !== "dropped" && !(truck && truck.status === "idle")) return { ok: false, reason: "the trailer must be in the yard, or behind a truck idle at a hub" };
      if (tr.refurbUntilT !== null) return { ok: false, reason: "it's in the shop" };
      if (!trailerRefurbishable(w, tr)) return { ok: false, reason: "it has had its refurbishment: run it out or scrap it" };
      if (trailerCondition(w, tr) > cfg.assets.trailer.refurbMaxCondition) return { ok: false, reason: "not worn enough to refurbish" };
      const cost = cfg.assets.trailer.refurbFd[tr.type] * (1 - stakeDiscount(w, company));
      if (w.ledger.balance(acct) < cost) return { ok: false, reason: "insufficient FD" };
      company.operating.costFd += serviceBill(w, company, truck ? truck.hub : company.homeHub, cost, "rebuild", `refurb:${tr.id}`);
      tr.milesSinceRefurb = 0;
      tr.refurbs++;
      const until = w.t + cfg.assets.trailer.refurbDays * cfg.time.gameMinutesPerDay;
      if (truck) {
        truck.status = "repair";
        truck.repairUntilT = Math.max(truck.repairUntilT ?? 0, until);
        syncTrailer(w, truck);
      } else tr.refurbUntilT = until;
      w.metrics.onRefurb();
      return { ok: true };
    }

    case "scrap_truck": {
      if (!cfg.assets.enabled) return { ok: false, reason: "trucks are rebuilt, not scrapped" };
      const truck = truckById(w, action.truckId);
      if (!truck || truck.companyId !== company.id) return { ok: false, reason: "not your truck" };
      if (truck.lease !== "owned" || leasedOut(truck)) return { ok: false, reason: "only trucks you own can be scrapped" };
      if (truck.status !== "idle" && truck.status !== "parked") return { ok: false, reason: "the truck must be idle or parked at a hub" };
      scrapOwnedTractor(w, company, truck);
      return { ok: true };
    }

    case "scrap_trailer": {
      if (!cfg.assets.enabled) return { ok: false, reason: "trailers come with the truck" };
      const tr = trailerById(w, action.trailerId);
      if (!tr || tr.companyId !== company.id || tr.lease !== "owned") return { ok: false, reason: "not your trailer" };
      if (tr.status !== "dropped") return { ok: false, reason: "the trailer must be in the yard" };
      scrapTrailer(w, tr);
      return { ok: true };
    }

    case "list_trailer": {
      if (!cfg.assets.enabled) return { ok: false, reason: "trailers come with the truck" };
      const tr = trailerById(w, action.trailerId);
      if (!tr) return { ok: false, reason: "no such trailer" };
      const listing = listTrailer(w, company.id, tr, action.askFd, action.floorFd, action.stepFd);
      return typeof listing === "string" ? { ok: false, reason: listing } : { ok: true };
    }

    case "rebuild_truck": {
      // §Assets — wear and rebuild: costs FD, restores condition, never destroys the asset.
      const truck = truckById(w, action.truckId);
      if (!truck || truck.companyId !== company.id) return { ok: false, reason: "not your truck" };
      if (truck.lease !== "owned") return { ok: false, reason: "the NPC lessor maintains leased trucks" };
      if (leasedOut(truck)) return { ok: false, reason: "its owner rebuilds a leased truck" };
      if (truck.status !== "idle") return { ok: false, reason: "truck must be idle at a hub" };
      if (condition(cfg, truck) > cfg.wear.rebuildMaxCondition) return { ok: false, reason: "not worn enough to rebuild" };
      if (!rebuildable(cfg, truck)) return { ok: false, reason: "past its last rebuild: run it out, sell it, or scrap it" };
      const cost = rebuildCost(cfg, truck) * (1 - stakeDiscount(w, company)); // locked FD earns its discount (staking.ts)
      if (w.ledger.balance(acct) < cost) return { ok: false, reason: "insufficient FD" };
      company.operating.costFd += serviceBill(w, company, truck.hub, cost, "rebuild", `rebuild:${truck.id}`); // the hub's shop, or the NPC shop
      truck.status = "repair";
      truck.repairUntilT = w.t + cfg.wear.rebuildDays * cfg.time.gameMinutesPerDay;
      truck.milesSinceRebuild = 0;
      truck.rebuilds++;
      w.metrics.onRebuild();
      return { ok: true };
    }

    case "park_truck": {
      // Deregister an idle owned truck: it stops running and stops counting toward fleet overhead.
      const truck = truckById(w, action.truckId);
      if (!truck || truck.companyId !== company.id) return { ok: false, reason: "not your truck" };
      if (truck.lease !== "owned") return { ok: false, reason: "only owned trucks can be parked" };
      if (truck.status !== "idle") return { ok: false, reason: "truck must be idle at a hub" };
      // Parking doesn't restart the idle-fee clock: the truck is still unused.
      truck.status = "parked";
      return { ok: true };
    }

    case "unpark_truck": {
      const truck = truckById(w, action.truckId);
      if (!truck || truck.companyId !== company.id) return { ok: false, reason: "not your truck" };
      if (truck.status !== "parked") return { ok: false, reason: "truck isn't parked" };
      truck.status = "idle";
      truck.idleRounds = 0;
      if (cfg.assets.enabled && truck.trailerId === 0) fitTrailer(w, truck, truck.trailer); // it sold without a rental: a spare or a new rental
      return { ok: true };
    }

    case "list_truck": {
      const truck = truckById(w, action.truckId);
      if (!truck) return { ok: false, reason: "no such truck" };
      const listing = listTruck(w, company.id, truck, action.askFd, action.floorFd, action.stepFd);
      return typeof listing === "string" ? { ok: false, reason: listing } : { ok: true };
    }

    case "withdraw_listing":
      return result(withdrawListing(w, company.id, action.listingId));

    case "buy_listing": {
      if (inCloseWindow(w)) return LOCKED;
      const l = w.listings[action.listingId - 1];
      // A free starter's lease deposit counts toward the truck that replaces it.
      if (l && l.status === "open" && !l.trailerId) releaseDepositFor(w, company, action.finance ? financedCashNeed(w, company, l.askFd) : l.askFd + salesTaxOn(w, l.askFd));
      if (!action.finance) return result(buyListing(w, company.id, action.listingId));
      // On a purchase loan: a used truck (not a trailer alone), secured by itself once it's bought.
      if (!l || l.status !== "open" || l.trailerId) return { ok: false, reason: "no such truck listing" };
      const loan = financePurchase(w, company, l.askFd);
      if (typeof loan === "string") return { ok: false, reason: loan };
      const why = buyListing(w, company.id, action.listingId);
      if (why) {
        cancelPurchaseLoan(w, loan);
        return { ok: false, reason: why };
      }
      loan.truckId = l.truckId;
      return { ok: true };
    }

    case "deposit_finance":
      return result(deposit(w, company.id, action.amountFd));

    case "withdraw_finance":
      return result(withdraw(w, company.id, action.amountFd));

    case "borrow": {
      const truck = truckById(w, action.truckId);
      if (!truck) return { ok: false, reason: "no such truck" };
      return result(borrow(w, company.id, truck, action.amountFd));
    }

    case "repay_loan":
      return result(repayLoan(w, company.id, action.loanId));

    case "place_bid": {
      const truck = truckById(w, action.truckId);
      const load = w.loads.get(action.loadId);
      if (!truck || truck.companyId !== company.id) return { ok: false, reason: "not your truck" };
      if (truck.status !== "idle") return { ok: false, reason: "truck must be idle at a hub" };
      if (!crewed(truck)) return { ok: false, reason: "the truck has no driver" };
      if (company.authority.status !== "active") return { ok: false, reason: "your authority is suspended" };
      if (!load || load.status !== "open") return { ok: false, reason: "that load is no longer on the board" };
      if (load.equipment !== truck.trailer) return { ok: false, reason: `needs a ${load.equipment} trailer` };
      if (load.brokerId === company.id || load.doubleBroker?.companyId === company.id) return { ok: false, reason: "you posted that load" };
      const blocked = vettingBlock(w, company, load);
      if (blocked) return { ok: false, reason: `the poster won't load a carrier with ${blocked}` };
      if (load.hot > 0 && !canMakeHot(company, truck)) return { ok: false, reason: "a hot load's window takes a team" };
      if (!mayTake(w, company, load)) return { ok: false, reason: load.tenderedTo ? "that load is tendered to another carrier" : "the shipper is giving local carriers first call this round" };
      if (hubMiles(w, truck.hub, load.origin) > MANUAL_BID_MAX_DEADHEAD_MI) return { ok: false, reason: `more than ${MANUAL_BID_MAX_DEADHEAD_MI} miles empty to the pickup` };
      if (!(action.rate > 0)) return { ok: false, reason: "bid a rate per mile above zero" };
      w.manualBids.set(truck.id, { loadId: load.id, rate: action.rate });
      return { ok: true };
    }

    case "cancel_bid": {
      const truck = truckById(w, action.truckId);
      if (!truck || truck.companyId !== company.id) return { ok: false, reason: "not your truck" };
      w.manualBids.delete(action.truckId);
      return { ok: true };
    }

    case "reposition_truck": {
      const truck = truckById(w, action.truckId);
      if (!truck || truck.companyId !== company.id) return { ok: false, reason: "not your truck" };
      if (truck.status !== "idle") return { ok: false, reason: "truck must be idle at a hub" };
      const hub = w.net.hubs.findIndex((h) => h.id === action.hubId);
      if (hub < 0) return { ok: false, reason: "unknown hub" };
      if (hub === truck.hub) return { ok: false, reason: "the truck is already there" };
      if (!crewed(truck)) return { ok: false, reason: "the truck has no driver" };
      truck.status = "repositioning";
      truck.targetHub = hub;
      truck.targetPlace = placeOfHub(hub);
      truck.remainingMi = placeLegMiles(w, truck.place, truck.targetPlace);
      truck.idleRounds = 0;
      w.manualBids.delete(truck.id);
      return { ok: true };
    }

    case "lease_truck":
      // Free entry: an extra NPC lease, no capital down (see capacity.ts).
      return result(leaseTruck(w, company, action.trailer));

    case "return_lease": {
      const truck = truckById(w, action.truckId);
      if (!truck) return { ok: false, reason: "no such truck" };
      // A player lessor's tractor goes back to its owner; an NPC extra lease to the NPC lessor.
      if (leasedOut(truck)) return truck.companyId === company.id ? result(endPlayerLease(w, truck)) : { ok: false, reason: "not a truck you lease" };
      return result(returnLease(w, company, truck));
    }

    case "buy_fd":
      return result(buyFd(w, company, action.usd));

    case "bid_auction":
      return result(bidAuction(w, company, action.usd));

    case "post_bounty":
      return result(postBounty(w, company, action.targetId, action.fd));

    case "buy_logbook_boost":
      return result(buyLogbookBoost(w, company, action.milestone));

    case "cancel_withdrawal":
      return result(cancelWithdrawal(w, company));

    case "sell_fd":
      return result(sellFd(w, company, action.fd));

    case "stake_fd":
      return result(stakeFd(w, company, action.fd));

    case "unstake_fd":
      return result(unstakeFd(w, company, action.fd, action.instant));

    case "deposit_pool":
      return result(depositPool(w, action.line, company.id, action.amountFd));

    case "withdraw_pool":
      return result(withdrawPool(w, action.line, company.id, action.amountFd));

    case "buy_item":
      return result(buyItem(w, company, action.item, action.pay, action.truckId));

    case "buy_business":
      return result(action.kind === "truckStop" ? buyTruckStop(w, company, action.siteId, action.pay) : buyBusiness(w, company, action.kind, action.hubId, action.pay));

    case "set_shop_markup":
      return result(setShopMarkup(w, company, action.businessId, action.markup));

    case "set_parking_price":
      return result(setParkingPrice(w, company, action.businessId, action.fd));

    case "add_parking":
      return result(addParking(w, company, action.businessId));

    case "set_pay_terms": {
      // Factoring is a contract: choosing it signs one (stake and all); leaving it before the term forfeits the stake.
      if (action.terms === "factor") return result(company.factoring ? null : signFactoring(w, company));
      if (company.factoring) endFactoring(w, company, dayOf(w.t, cfg) < company.factoring.until);
      company.payTerms = action.terms;
      return result(null);
    }

    case "claim_airdrop_now":
      return result(claimAirdropNow(w, company));

    case "offer_fd":
      return result(offerFd(w, company.id, action.amountFd, action.minPriceUsd));

    case "buy_facility": {
      // Any company can add the shipper role by owning facilities (§Roles).
      if (inCloseWindow(w)) return LOCKED;
      const closed = layerBlock(w, "businesses"); // the unlock ladder (ladder.ts)
      if (closed) return { ok: false, reason: closed };
      const hub = w.net.hubs.findIndex((h) => h.id === action.hubId);
      if (hub < 0) return { ok: false, reason: "unknown hub" };
      if (w.facilitySupply[action.facility] <= 0) return { ok: false, reason: "PoC supply exhausted" };
      if (facilitiesOf(w, company.id).length >= facilityCap(w, company)) return { ok: false, reason: "company facility cap" };
      const price = cfg.facilities.types[action.facility].priceFd;
      let lockedPaid = 0;
      if (action.pay === "usd") {
        // The farming season's dollar window (token.catalogue.usdWindow.assets): every dollar held for the launch pool.
        const why = payAssetUsd(w, company, price);
        if (why) return { ok: false, reason: why };
      } else {
        if (w.ledger.balance(acct) < price) return { ok: false, reason: "insufficient FD" };
        lockedPaid = w.ledger.post(w.t, acct, "sink:facility_dealer", price, `facility:${company.id}:${action.facility}`);
        chargeSalesTax(w, company.id, price, `facility:${company.id}:${action.facility}`);
      }
      w.facilitySupply[action.facility]--;
      w.facilities.push({
        id: w.facilities.length + 1,
        type: action.facility,
        lockedBasisFd: lockedPaid,
        ownerId: company.id,
        hub,
        equipment: facilityEquipment(w, action.facility, hub),
        boughtDay: dayOf(w.t, cfg),
        netFd: 0,
      });
      return { ok: true };
    }

    default:
      return { ok: false, reason: "unknown action" };
  }
}
