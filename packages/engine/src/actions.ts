import { acceptOffer, acceptTender, declineOffer, mayTake, rejectTender } from "./contracts.js";
import { bookLoad } from "./board.js";
import { offerFd } from "./buyback.js";
import { leaseTruck, returnLease } from "./capacity.js";
import { buyFd, claimAirdropNow, sellFd } from "./token.js";
import { dayOf } from "./clock.js";
import { dealerPrice, ordersOf, placeOrder } from "./dealer.js";
import { facilitiesOf, facilityEquipment } from "./demand.js";
import { borrow, deposit, repayLoan, withdraw } from "./finance.js";
import { companyAccount } from "./ledger.js";
import { rebrokerLoad, stealLoad, vettingBlock } from "./fraud.js";
import { finiteIn } from "./economics.js";
import { offerStaff, releaseStaff, setPay, severance, startHomeTime } from "./labor.js";
import { buyListing, listTruck, withdrawListing } from "./market.js";
import { canRefile, notice } from "./safety.js";
import { canMakeHot } from "./standingOrders.js";
import { inCloseWindow } from "./season.js";
import { refile } from "./solvency.js";
import { facilityCap, stakeFd, truckCap, unstakeFd } from "./staking.js";
import { depositPool, withdrawPool } from "./pools.js";
import { endFactoring, signFactoring } from "./receivables.js";
import type { Action, RuleScope } from "./types.js";
import { condition, rebuildCost } from "./wear.js";
import { availableSupply, companyById, crewed, hubMiles, invalidOrders, seatDriver, staffById, syncFleet, takeSupply, truckById, unseatDriver, type World, placeMiles, placeOfHub, placeLegMiles } from "./world.js";
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
      return TIERS.has(a.tier) && TRAILERS.has(a.trailer) && typeof a.replaceNpcLease === "boolean" ? null : "bad truck";
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
      return isId(a.truckId) ? null : "bad truck id";
    case "reposition_truck":
      return isId(a.truckId) && isStr(a.hubId) ? null : "bad destination";
    case "list_truck":
      return isId(a.truckId) && isFd(a.askFd) && isFd(a.floorFd) && isFd(a.stepFd) ? null : "bad listing";
    case "withdraw_listing":
    case "buy_listing":
      return isId(a.listingId) ? null : "bad listing id";
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
      return finiteIn(a.usd, 0.01, 1e9) ? null : "bad amount";
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
const LIQUIDATING_BLOCKED = new Set<Action["type"]>(["place_bid", "book_load", "reposition_truck", "buy_asset", "buy_facility", "lease_truck", "borrow", "buy_listing", "unpark_truck", "offer_staff"]);

/** What a company whose authority was revoked can still do: wait out the bar, file again, and handle its money. */
const ALLOWED_REVOKED = new Set<Action["type"]>(["wait", "refile_authority", "buy_fd", "sell_fd", "offer_fd", "claim_airdrop_now", "withdraw_finance", "withdraw_listing", "set_compliance", "set_vetting", "set_auto_staff"]);
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
      w.ledger.post(w.t, acct, "sink:repairs", cost, `fix:${truck.id}`);
      company.operating.costFd += cost;
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
      // A dealer order: paid now, delivered after the lead time (see dealer.ts).
      if (company.role !== "carrier") return { ok: false, reason: "only carriers run trucks in Phase 0" };
      if (inCloseWindow(w)) return LOCKED;
      const fleet = w.trucksByCompany.get(company.id)!;
      const pending = ordersOf(w, company.id);
      const replacing = action.replaceNpcLease && fleet.some((t) => t.lease === "npc");
      if (replacing && pending.some((o) => o.replaceNpcLease)) return { ok: false, reason: "a replacement truck is already on order" };
      if (!replacing && fleet.length + pending.length >= truckCap(w, company)) return { ok: false, reason: "company truck cap" };
      const firstTruck = !fleet.some((t) => t.lease === "owned") && pending.length === 0;
      if (availableSupply(w, action.tier, action.trailer, firstTruck) <= 0) return { ok: false, reason: "PoC supply exhausted" };
      const price = dealerPrice(w, action);
      if (w.ledger.balance(acct) < price) return { ok: false, reason: "insufficient FD" };

      w.ledger.post(w.t, acct, "sink:equipment_dealer", price, `buy:${company.id}:${action.tier}:${action.trailer}`);
      takeSupply(w, action.tier, action.trailer, firstTruck);
      placeOrder(w, company, action.tier, action.trailer, replacing);
      company.firstOwnedTruckDay ??= dayOf(w.t, cfg);
      return { ok: true };
    }

    case "rebuild_truck": {
      // §Assets — wear and rebuild: costs FD, restores condition, never destroys the asset.
      const truck = truckById(w, action.truckId);
      if (!truck || truck.companyId !== company.id) return { ok: false, reason: "not your truck" };
      if (truck.lease !== "owned") return { ok: false, reason: "the NPC lessor maintains leased trucks" };
      if (truck.status !== "idle") return { ok: false, reason: "truck must be idle at a hub" };
      if (condition(cfg, truck) > cfg.wear.rebuildMaxCondition) return { ok: false, reason: "not worn enough to rebuild" };
      const cost = rebuildCost(cfg, truck);
      if (w.ledger.balance(acct) < cost) return { ok: false, reason: "insufficient FD" };
      w.ledger.post(w.t, acct, "sink:rebuild", cost, `rebuild:${truck.id}`);
      company.operating.costFd += cost;
      truck.status = "repair";
      truck.repairUntilT = w.t + cfg.wear.rebuildDays * cfg.time.gameMinutesPerDay;
      truck.milesSinceRebuild = 0;
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

    case "buy_listing":
      if (inCloseWindow(w)) return LOCKED;
      return result(buyListing(w, company.id, action.listingId));

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
      return result(returnLease(w, company, truck));
    }

    case "buy_fd":
      return result(buyFd(w, company, action.usd));

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
      const hub = w.net.hubs.findIndex((h) => h.id === action.hubId);
      if (hub < 0) return { ok: false, reason: "unknown hub" };
      if (w.facilitySupply[action.facility] <= 0) return { ok: false, reason: "PoC supply exhausted" };
      if (facilitiesOf(w, company.id).length >= facilityCap(w, company)) return { ok: false, reason: "company facility cap" };
      const price = cfg.facilities.types[action.facility].priceFd;
      if (w.ledger.balance(acct) < price) return { ok: false, reason: "insufficient FD" };
      w.ledger.post(w.t, acct, "sink:facility_dealer", price, `facility:${company.id}:${action.facility}`);
      w.facilitySupply[action.facility]--;
      w.facilities.push({
        id: w.facilities.length + 1,
        type: action.facility,
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
