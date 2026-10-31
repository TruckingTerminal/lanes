import { describe, expect, it } from "vitest";
import { applyLevers, economyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import {
  addTrailerMiles,
  addTruck,
  applyAction,
  billRentals,
  companyAccount,
  createWorld,
  dailyAssets,
  deliverOrders,
  endOfLife,
  formCompany,
  hookedTrailer,
  listTruck,
  maintenancePerMile,
  stepListings,
  trailerCondition,
  trailersOf,
  truckValue,
  writeOffRig,
  yardTrailers,
  monthlyFactory,
  bestSource,
  dealerPrice,
  ordersOf,
  billPlayerLeases,
  contractAccount,
  type World,
} from "@lanes/engine";

const cfg = applyLevers(economyConfig, { "assets.enabled": true, "token.catalogue.enabled": true, "businesses.enabled": true });
const net = buildNetwork(hubs, cfg);

function world(seed = 1, c = cfg): World {
  return createWorld({ cfg: c, net, feeds: neutralFeeds, seed });
}

function carrier(w: World, hub = "DAL", freePath = false) {
  return formCompany(w, { name: "Test", role: "carrier", homeHubId: hub, strategy: "test", orders: [], freePath });
}

const fund = (w: World, id: number, fd: number) => w.ledger.post(w.t, "faucet:starting_grant", companyAccount(id), fd, "test");
const day = (w: World, n: number) => (w.t += n * w.cfg.time.gameMinutesPerDay);

describe("assets: tractors and trailers apart", () => {
  it("gives an owned truck its own trailer and an NPC lease the lessor's", () => {
    const w = world();
    const free = carrier(w, "DAL", true);
    const [npc] = w.trucksByCompany.get(free.id)!;
    expect(hookedTrailer(w, npc!)?.lease).toBe("npc");
    const c = carrier(w);
    const t = addTruck(w, c, "owned", "workhorse", "reefer");
    const tr = hookedTrailer(w, t)!;
    expect(tr.lease).toBe("owned");
    expect(tr.type).toBe("reefer");
    expect(t.trailer).toBe("reefer");
    expect(trailersOf(w, c.id)).toContain(tr);
  });

  it("wears the trailer with its own miles, and a worn trailer costs more to run", () => {
    const w = world();
    const c = carrier(w);
    const t = addTruck(w, c, "owned", "workhorse", "van");
    const fresh = maintenancePerMile(cfg, t);
    addTrailerMiles(w, t, 200_000);
    const tr = hookedTrailer(w, t)!;
    expect(tr.odometer).toBe(200_000);
    expect(trailerCondition(w, tr)).toBeCloseTo(0.5, 6);
    expect(t.trailerWear).toBeCloseTo(0.5, 6);
    expect(maintenancePerMile(cfg, t)).toBeGreaterThan(fresh);
  });

  it("stops rebuilding a tractor after its last rebuild, then scraps it at the end of its life, its trailer kept", () => {
    const w = world();
    const c = carrier(w);
    c.yard = "small";
    fund(w, c.id, 200_000);
    const t = addTruck(w, c, "owned", "workhorse", "van");
    const tr = hookedTrailer(w, t)!;
    const supply = w.supply.tractor.workhorse;
    for (let i = 0; i < cfg.assets.tractor.maxRebuilds; i++) {
      t.milesSinceRebuild = 150_000;
      t.status = "idle";
      expect(applyAction(w, c.id, { type: "rebuild_truck", truckId: t.id }).ok).toBe(true);
    }
    t.milesSinceRebuild = 150_000;
    t.status = "idle";
    expect(applyAction(w, c.id, { type: "rebuild_truck", truckId: t.id }).ok).toBe(false);
    // Worn out: it goes for scrap, the scrapyard pays, and nothing goes back to dealer supply.
    t.milesSinceRebuild = cfg.wear.lifeMiles;
    const before = w.ledger.balance(companyAccount(c.id));
    endOfLife(w, c, t);
    expect(t.status).toBe("retired");
    expect(w.trucksByCompany.get(c.id)).not.toContain(t);
    expect(w.ledger.balance(companyAccount(c.id)) - before).toBeCloseTo(cfg.assets.tractor.scrapShare * cfg.dealerFd.tractor.workhorse, 6);
    expect(w.supply.tractor.workhorse).toBe(supply);
    expect(tr.status).toBe("dropped");
    expect(yardTrailers(w, c)).toContain(tr);
  });

  it("keeps a spare only in a yard, delivers it there, and swaps at the home hub", () => {
    const w = world();
    const c = carrier(w);
    fund(w, c.id, 100_000);
    const t = addTruck(w, c, "owned", "workhorse", "van");
    expect(applyAction(w, c.id, { type: "buy_trailer", trailer: "reefer" }).ok).toBe(false); // no yard, no spare
    c.yard = "small";
    expect(applyAction(w, c.id, { type: "buy_trailer", trailer: "reefer" }).ok).toBe(true);
    day(w, 60);
    deliverOrders(w);
    const spare = yardTrailers(w, c).find((x) => x.type === "reefer")!;
    expect(spare).toBeDefined();
    const van = hookedTrailer(w, t)!;
    t.hub = (t.hub + 1) % w.net.hubs.length; // away from home
    expect(applyAction(w, c.id, { type: "swap_trailer", truckId: t.id, trailerId: spare.id }).ok).toBe(false);
    t.hub = c.homeHub;
    expect(applyAction(w, c.id, { type: "swap_trailer", truckId: t.id, trailerId: spare.id }).ok).toBe(true);
    expect(t.trailer).toBe("reefer");
    expect(van.status).toBe("dropped");
  });

  it("rents a trailer by the week and owes the minimum term when it goes back early", () => {
    const w = world();
    const c = carrier(w);
    c.yard = "small";
    fund(w, c.id, 100_000);
    const t = addTruck(w, c, "owned", "workhorse", "van");
    const van = hookedTrailer(w, t)!;
    t.hub = (t.hub + 1) % w.net.hubs.length;
    expect(applyAction(w, c.id, { type: "rent_trailer", truckId: t.id, trailer: "flatbed" }).ok).toBe(false); // drop your own at the yard first
    t.hub = c.homeHub;
    expect(applyAction(w, c.id, { type: "rent_trailer", truckId: t.id, trailer: "flatbed" }).ok).toBe(true);
    const rental = hookedTrailer(w, t)!;
    expect(rental.lease).toBe("rental");
    expect(van.status).toBe("dropped");
    const acct = companyAccount(c.id);
    let before = w.ledger.balance(acct);
    billRentals(w);
    const week = cfg.assets.rental.weeklyFd.flatbed;
    expect(before - w.ledger.balance(acct)).toBeCloseTo(week, 6);
    before = w.ledger.balance(acct);
    expect(applyAction(w, c.id, { type: "swap_trailer", truckId: t.id, trailerId: van.id }).ok).toBe(true);
    expect(rental.status).toBe("gone");
    expect(before - w.ledger.balance(acct)).toBeCloseTo(cfg.assets.rental.minWeeks * week - week, 6);
  });

  it("writes off a rig in a crash, paying its value less the deductible", () => {
    const w = world();
    const c = carrier(w);
    const t = addTruck(w, c, "owned", "highwayPro", "reefer");
    const tr = hookedTrailer(w, t)!;
    const value = truckValue(w, t);
    const before = w.ledger.balance(companyAccount(c.id));
    const paid = writeOffRig(w, c, t);
    expect(paid).toBeCloseTo(value - cfg.assets.physicalDamage.deductibleFd, 6);
    expect(w.ledger.balance(companyAccount(c.id)) - before).toBeCloseTo(paid, 6);
    expect(t.status).toBe("retired");
    expect(tr.status).toBe("gone");
  });

  it("scraps an unsold fire-sale rig instead of returning it to dealer supply", () => {
    const w = world();
    const c = carrier(w);
    const t = addTruck(w, c, "owned", "workhorse", "van");
    const supply = { tractor: w.supply.tractor.workhorse, trailer: w.supply.trailer.van };
    c.liquidatingSince = 0;
    const l = listTruck(w, c.id, t, 1_000, 1_000, 500);
    expect(typeof l).not.toBe("string");
    stepListings(w);
    expect(t.status).toBe("retired");
    expect(w.supply.tractor.workhorse).toBe(supply.tractor);
    expect(w.supply.trailer.van).toBe(supply.trailer);
  });

  it("sells a trailer alone into another carrier's yard", () => {
    const w = world();
    const a = carrier(w, "DAL");
    const b = carrier(w, "ATL");
    a.yard = "small";
    b.yard = "small";
    fund(w, a.id, 50_000);
    fund(w, b.id, 50_000);
    addTruck(w, a, "owned", "workhorse", "van");
    expect(applyAction(w, a.id, { type: "buy_trailer", trailer: "flatbed" }).ok).toBe(true);
    day(w, 60);
    deliverOrders(w);
    const spare = yardTrailers(w, a)[0]!;
    expect(applyAction(w, a.id, { type: "list_trailer", trailerId: spare.id, askFd: 3_000, floorFd: 2_000, stepFd: 100 }).ok).toBe(true);
    const listing = w.listings.find((l) => l.trailerId === spare.id)!;
    expect(applyAction(w, b.id, { type: "buy_listing", listingId: listing.id }).ok).toBe(true);
    expect(spare.companyId).toBe(b.id);
    expect(spare.hub).toBe(b.homeHub);
    expect(yardTrailers(w, b)).toContain(spare);
  });

  it("can lose a trailer left in the yard overnight, and cover pays for it", () => {
    const w = world(1, applyLevers(cfg, { "assets.trailerTheftPerNight": 1 }));
    const c = carrier(w);
    c.yard = "small";
    fund(w, c.id, 50_000);
    addTruck(w, c, "owned", "workhorse", "van");
    expect(applyAction(w, c.id, { type: "buy_trailer", trailer: "van" }).ok).toBe(true);
    day(w, 60);
    deliverOrders(w);
    const spare = yardTrailers(w, c)[0]!;
    const before = w.ledger.balance(companyAccount(c.id));
    dailyAssets(w);
    expect(spare.status).toBe("gone");
    expect(w.ledger.balance(companyAccount(c.id))).toBeGreaterThan(before);
  });

  it("stocks dealerships from the factory allocation at wholesale and makes the NPC dealer the dearer, slower backstop", () => {
    const w = world();
    const owner = carrier(w, "DAL");
    fund(w, owner.id, 2_000_000);
    expect(applyAction(w, owner.id, { type: "buy_business", kind: "dealership", hubId: "DAL" }).ok).toBe(true);
    const b = w.businesses.find((x) => x.kind === "dealership")!;
    const before = w.ledger.balance(companyAccount(owner.id));
    monthlyFactory(w);
    const units = Object.values(b.stock.tractor).reduce((s, n) => s + n, 0) + Object.values(b.stock.trailer).reduce((s, n) => s + n, 0);
    expect(units).toBeGreaterThan(0);
    expect(before - w.ledger.balance(companyAccount(owner.id))).toBeGreaterThan(0);
    // The NPC dealer holds at most its months of stock.
    const f = cfg.assets.factory;
    expect(w.supply.tractor.workhorse).toBeLessThanOrEqual(Math.round(Math.max(f.minTractorsPerMonth, 0) * f.tractorMix.workhorse * f.stockMonths) + 1);
    // A buyer: the dealership's stock at its markup in a week beats the backstop's premium and wait.
    const buyer = carrier(w, "ATL");
    fund(w, buyer.id, 200_000);
    const src = bestSource(w, buyer.id, "rig", "workhorse", "van");
    expect(src.dealershipId).toBe(b.id);
    expect(src.price).toBeCloseTo(dealerPrice(w, { tier: "workhorse", trailer: "van" }) * b.markup, 6);
    const paid = w.ledger.balance(companyAccount(owner.id));
    expect(applyAction(w, buyer.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false, dealershipId: b.id }).ok).toBe(true);
    expect(w.ledger.balance(companyAccount(owner.id)) - paid).toBeCloseTo(src.price, 6);
    const order = ordersOf(w, buyer.id)[0]!;
    expect(order.dueDay - order.orderedDay).toBe(cfg.businesses.kinds.dealership.deliveryDays);
    const npc = w.ledger.balance(companyAccount(buyer.id));
    expect(applyAction(w, buyer.id, { type: "buy_asset", tier: "workhorse", trailer: "van", replaceNpcLease: false }).ok).toBe(true);
    const tax = cfg.costs.salesTax.enabled ? cfg.costs.salesTax.pct : 0;
    expect(npc - w.ledger.balance(companyAccount(buyer.id))).toBeCloseTo(dealerPrice(w, { tier: "workhorse", trailer: "van" }) * f.npcPremium * (1 + tax), 6);
    const npcOrder = ordersOf(w, buyer.id)[1]!;
    expect(npcOrder.dueDay - npcOrder.orderedDay).toBeGreaterThanOrEqual(cfg.dealerDelivery.baseDays + f.npcExtraDays);
  });

  it("takes a trade-in at its share of value and sells it on from the lot", () => {
    const w = world();
    const owner = carrier(w, "DAL");
    fund(w, owner.id, 2_000_000);
    expect(applyAction(w, owner.id, { type: "buy_business", kind: "dealership", hubId: "DAL" }).ok).toBe(true);
    const b = w.businesses.find((x) => x.kind === "dealership")!;
    const seller = carrier(w, "ATL");
    const t = addTruck(w, seller, "owned", "workhorse", "van");
    addTruck(w, seller, "owned", "workhorse", "van");
    t.odometer = 300_000;
    const value = truckValue(w, t);
    const before = w.ledger.balance(companyAccount(seller.id));
    expect(applyAction(w, seller.id, { type: "trade_in", truckId: t.id, dealershipId: b.id }).ok).toBe(true);
    expect(w.ledger.balance(companyAccount(seller.id)) - before).toBeCloseTo(value * cfg.businesses.kinds.dealership.tradeInShare, 6);
    const lot = w.listings.find((l) => l.truckId === t.id && l.status === "open")!;
    expect(lot.sellerId).toBe(owner.id);
    expect(t.companyId).toBe(0);
    for (let i = 0; i < 20; i++) stepListings(w);
    expect(lot.status).toBe("open"); // a lot holds its trucks at the floor
    const buyer = carrier(w, "CHI");
    fund(w, buyer.id, 100_000);
    const paid = w.ledger.balance(companyAccount(owner.id));
    expect(applyAction(w, buyer.id, { type: "buy_listing", listingId: lot.id }).ok).toBe(true);
    expect(w.ledger.balance(companyAccount(owner.id))).toBeGreaterThan(paid);
    expect(t.companyId).toBe(buyer.id);
    expect(hookedTrailer(w, t)?.companyId).toBe(buyer.id);
  });

  it("leases a tractor to another carrier by the week, the title staying with its owner", () => {
    const w = world();
    const lessor = carrier(w, "DAL");
    const lessee = carrier(w, "ATL");
    fund(w, lessee.id, 50_000);
    const t = addTruck(w, lessor, "owned", "workhorse", "van");
    addTruck(w, lessor, "owned", "workhorse", "van");
    const own = hookedTrailer(w, t)!;
    expect(applyAction(w, lessor.id, { type: "offer_lease", truckId: t.id, weeklyFd: 500, minWeeks: 4 }).ok).toBe(true);
    expect(t.status).toBe("parked");
    expect(own.status).toBe("dropped"); // the owner's trailer stays in its yard
    const offer = w.leaseOffers[0]!;
    expect(applyAction(w, lessee.id, { type: "take_lease", offerId: offer.id }).ok).toBe(true);
    expect(t.companyId).toBe(lessee.id);
    expect(t.lessorId).toBe(lessor.id);
    expect(hookedTrailer(w, t)?.companyId).toBe(lessee.id); // the lessee's trailer: a rental, away from its yard
    // The lessee runs it but can't sell, pledge, rebuild or scrap it.
    expect(applyAction(w, lessee.id, { type: "list_truck", truckId: t.id, askFd: 10_000, floorFd: 9_000, stepFd: 100 }).ok).toBe(false);
    expect(applyAction(w, lessee.id, { type: "borrow", truckId: t.id, amountFd: 1_000 }).ok).toBe(false);
    expect(applyAction(w, lessee.id, { type: "scrap_truck", truckId: t.id }).ok).toBe(false);
    const before = w.ledger.balance(companyAccount(lessor.id));
    billPlayerLeases(w);
    expect(w.ledger.balance(companyAccount(lessor.id)) - before).toBeCloseTo(500, 6);
    // Back inside the minimum term: the rest of it is owed.
    day(w, 7);
    const owed = w.ledger.balance(companyAccount(lessor.id));
    expect(applyAction(w, lessee.id, { type: "return_lease", truckId: t.id }).ok).toBe(true);
    expect(w.ledger.balance(companyAccount(lessor.id)) - owed).toBeCloseTo(3 * 500, 6);
    expect(t.companyId).toBe(lessor.id);
    expect(t.lessorId).toBe(0);
    expect(w.trucksByCompany.get(lessor.id)).toContain(t);
  });

  it("sells a business to another player with its bond, and a yard to a carrier at the same hub", () => {
    const w = world();
    const seller = carrier(w, "DAL");
    const buyer = carrier(w, "DAL");
    fund(w, seller.id, 1_000_000);
    fund(w, buyer.id, 1_000_000);
    expect(applyAction(w, seller.id, { type: "buy_business", kind: "shop", hubId: "DAL" }).ok).toBe(true);
    const shop = w.businesses.find((b) => b.kind === "shop")!;
    const bond = shop.bondFd;
    expect(applyAction(w, seller.id, { type: "list_asset_sale", kind: "business", refId: shop.id, askFd: 50_000 }).ok).toBe(true);
    const sellerBefore = w.ledger.balance(companyAccount(seller.id));
    expect(applyAction(w, buyer.id, { type: "buy_asset_sale", saleId: 1 }).ok).toBe(true);
    expect(shop.ownerId).toBe(buyer.id);
    // The seller gets the ask less the market fee, and its bond back; the buyer's bond now stands behind it.
    expect(w.ledger.balance(companyAccount(seller.id)) - sellerBefore).toBeCloseTo(50_000 * (1 - cfg.usedMarket.feePct) + bond, 6);
    expect(w.ledger.balance(contractAccount(buyer.id))).toBeCloseTo(bond, 6);
    // A yard: only to a carrier at the same home hub, and only if the seller fits without it.
    seller.yard = "small";
    seller.yardBondFd = 30_000;
    w.ledger.post(w.t, companyAccount(seller.id), contractAccount(seller.id), 30_000, "bond:yard");
    const far = carrier(w, "ATL");
    fund(w, far.id, 500_000);
    expect(applyAction(w, seller.id, { type: "list_asset_sale", kind: "yard", refId: 0, askFd: 20_000 }).ok).toBe(true);
    const sale = w.assetSales.find((x) => x.kind === "yard")!;
    expect(applyAction(w, far.id, { type: "buy_asset_sale", saleId: sale.id }).ok).toBe(false);
    expect(applyAction(w, buyer.id, { type: "buy_asset_sale", saleId: sale.id }).ok).toBe(true);
    expect(buyer.yard).toBe("small");
    expect(seller.yard).toBe("none");
    expect(buyer.yardBondFd).toBe(30_000);
  });
});
