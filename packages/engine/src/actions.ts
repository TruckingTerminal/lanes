import { offerFd } from "./buyback.js";
import { leaseTruck, returnLease } from "./capacity.js";
import { buyFd, claimAirdropNow, sellFd } from "./token.js";
import { dayOf } from "./clock.js";
import { ordersOf, placeOrder } from "./dealer.js";
import { facilitiesOf, facilityEquipment } from "./demand.js";
import { borrow, deposit, repayLoan, withdraw } from "./finance.js";
import { companyAccount } from "./ledger.js";
import { buyListing, listTruck, withdrawListing } from "./market.js";
import { inCloseWindow } from "./season.js";
import type { Action } from "./types.js";
import { condition, newPrice, rebuildCost } from "./wear.js";
import { availableSupply, companyById, hubMiles, takeSupply, truckById, type World } from "./world.js";

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
  switch (action.type) {
    case "wait":
      return { ok: true };

    case "set_standing_orders": {
      const counted = action.orders.filter((o) => o.kind !== "floor").length;
      if (counted > cfg.board.freeStandingOrders) return { ok: false, reason: "too many standing orders" };
      company.orders = action.orders;
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
      if (!replacing && fleet.length + pending.length >= cfg.company.maxTrucks) return { ok: false, reason: "company truck cap" };
      const firstTruck = !fleet.some((t) => t.lease === "owned") && pending.length === 0;
      if (availableSupply(w, action.tier, action.trailer, firstTruck) <= 0) return { ok: false, reason: "PoC supply exhausted" };
      const price = newPrice(cfg, action);
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
      truck.status = "parked";
      truck.idleSinceDay = dayOf(w.t, cfg);
      return { ok: true };
    }

    case "unpark_truck": {
      const truck = truckById(w, action.truckId);
      if (!truck || truck.companyId !== company.id) return { ok: false, reason: "not your truck" };
      if (truck.status !== "parked") return { ok: false, reason: "truck isn't parked" };
      truck.status = "idle";
      truck.idleRounds = 0;
      truck.idleSinceDay = dayOf(w.t, cfg);
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
      if (!load || load.status !== "open") return { ok: false, reason: "that load is no longer on the board" };
      if (load.equipment !== truck.trailer) return { ok: false, reason: `needs a ${load.equipment} trailer` };
      if (load.brokerId === company.id) return { ok: false, reason: "you posted that load" };
      if (hubMiles(w, truck.hub, load.origin) > MANUAL_BID_MAX_DEADHEAD_MI) return { ok: false, reason: `more than ${MANUAL_BID_MAX_DEADHEAD_MI} miles empty to the pickup` };
      if (!(action.rate > 0)) return { ok: false, reason: "bid a rate per mile above zero" };
      w.manualBids.set(truck.id, { loadId: load.id, rate: action.rate });
      return { ok: true };
    }

    case "cancel_bid":
      w.manualBids.delete(action.truckId);
      return { ok: true };

    case "reposition_truck": {
      const truck = truckById(w, action.truckId);
      if (!truck || truck.companyId !== company.id) return { ok: false, reason: "not your truck" };
      if (truck.status !== "idle") return { ok: false, reason: "truck must be idle at a hub" };
      const hub = w.net.hubs.findIndex((h) => h.id === action.hubId);
      if (hub < 0) return { ok: false, reason: "unknown hub" };
      if (hub === truck.hub) return { ok: false, reason: "the truck is already there" };
      truck.status = "repositioning";
      truck.targetHub = hub;
      truck.remainingMi = hubMiles(w, truck.hub, hub);
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
      if (facilitiesOf(w, company.id).length >= cfg.facilities.maxPerCompany) return { ok: false, reason: "company facility cap" };
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
  }
}
