import { describe, expect, it } from "vitest";
import { economyConfig as cfg } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds, PLACE_OF_HUB } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import { applyAction, createWorld, formCompany, isLocal, localShare, mayTake, runDays, stepHour } from "@lanes/engine";

const net = buildNetwork(hubs, cfg);
const world = (seed: number) => createWorld({ cfg, net, feeds: neutralFeeds, seed });
const hubIdx = (id: string) => hubs.findIndex((h) => h.id === id);

describe("shipper leverage", () => {
  it("gives local carriers first call on most loads where trucks pile up, few where trucks are scarce", () => {
    const w = world(21);
    const mia = hubIdx("MIA");
    w.reloadIndex[mia * 3] = 0.5; // vans piled up
    w.reloadIndex[mia * 3 + 1] = 2; // reefers scarce
    expect(localShare(w, mia, "van")).toBeCloseTo(0.85, 2);
    expect(localShare(w, mia, "reefer")).toBeCloseTo(0.15, 2);
    expect(localShare(w, mia, "flatbed")).toBeCloseTo(0.5, 2); // balanced
  });

  it("keeps a local-first load from an out-of-town carrier for its first round, then opens it", () => {
    const w = world(22);
    const local = formCompany(w, { name: "Local", role: "carrier", homeHubId: "MIA", strategy: "player:test", orders: [], freePath: true, human: true });
    const visitor = formCompany(w, { name: "Visitor", role: "carrier", homeHubId: "CHI", strategy: "player:test", orders: [], freePath: true, human: true });
    const mia = hubIdx("MIA");
    for (let h = 0; h < 7; h++) stepHour(w); // through the 06:00 round
    const load = [...w.loads.values()].find((l) => l.status === "open" && l.origin === mia && l.localUntilRound > 0 && l.vet === 0)!;
    expect(load).toBeDefined();
    expect(isLocal(w, local, mia)).toBe(true);
    expect(isLocal(w, visitor, mia)).toBe(false);
    expect(mayTake(w, local, load)).toBe(true);
    expect(mayTake(w, visitor, load)).toBe(false);
    const [vt] = w.trucksByCompany.get(visitor.id)!;
    vt!.hub = vt!.targetHub = mia;
    vt!.place = vt!.targetPlace = PLACE_OF_HUB[mia]!;
    expect(applyAction(w, visitor.id, { type: "book_load", truckId: vt!.id, loadId: load.id })).toEqual({ ok: false, reason: "local shippers only for now" });
    for (let h = 0; h < 12; h++) stepHour(w); // the 18:00 round: still local-first
    for (let h = 0; h < 12; h++) stepHour(w); // the next 06:00 round opens it
    if (load.status === "open") expect(mayTake(w, visitor, load)).toBe(true);
  });
});

describe("contracts", () => {
  it("offers local carriers contract lanes, tenders loads at the contract rate, and tracks acceptance", () => {
    const w = world(23);
    const c = formCompany(w, { name: "Loyal", role: "carrier", homeHubId: "DAL", strategy: "player:test", orders: [{ kind: "contracts", acceptOffers: false, spotAbovePct: null, maxDeadheadMi: 150 }], freePath: true, human: true });
    let offer = null;
    for (let d = 0; d < 90 && !offer; d++) {
      runDays(w, 1);
      offer = w.contracts.find((k) => k.carrierId === c.id && k.status === "offered") ?? null;
    }
    expect(offer).not.toBeNull();
    offer = offer!;
    expect(offer.ratePerMile).toBeGreaterThan(1);
    expect(applyAction(w, c.id, { type: "accept_contract", contractId: offer.id })).toEqual({ ok: true });
    expect(offer.status).toBe("active");
    // Run until a tender arrives.
    let tender = null;
    for (let d = 0; d < 21 && !tender; d++) {
      runDays(w, 1);
      tender = [...w.loads.values()].find((l) => l.contractId === offer.id && l.tenderedTo === c.id && l.status === "open") ?? null;
    }
    expect(tender).not.toBeNull();
    const [truck] = w.trucksByCompany.get(c.id)!;
    truck!.status = "idle";
    truck!.hub = truck!.targetHub = offer.origin;
    truck!.place = truck!.targetPlace = tender!.originPlace;
    truck!.loadId = null;
    const before = offer.accepted;
    expect(applyAction(w, c.id, { type: "accept_tender", loadId: tender!.id, truckId: truck!.id })).toEqual({ ok: true });
    expect(tender!.carrierId).toBe(c.id);
    expect(tender!.clearedRate).toBeCloseTo(offer.ratePerMile, 6);
    expect(offer.accepted).toBe(before + 1);
  });

  it("lets a tender lapse to the spot board and marks the carrier down for it", () => {
    const w = world(24);
    const c = formCompany(w, { name: "Chaser", role: "carrier", homeHubId: "DAL", strategy: "player:test", orders: [{ kind: "contracts", acceptOffers: true, spotAbovePct: 0, maxDeadheadMi: 0 }], freePath: true, human: true });
    let k = null;
    for (let d = 0; d < 90 && !k; d++) {
      runDays(w, 1);
      k = w.contracts.find((x) => x.carrierId === c.id && x.status === "active") ?? null; // taken by the standing order
    }
    expect(k).not.toBeNull();
    k = k!;
    let tender = null;
    for (let d = 0; d < 21 && !tender; d++) {
      runDays(w, 1);
      tender = [...w.loads.values()].find((l) => l.contractId === k.id && l.tenderedTo === c.id) ?? null;
    }
    expect(tender).not.toBeNull();
    const before = k.tendered;
    expect(applyAction(w, c.id, { type: "decline_tender", loadId: tender!.id })).toEqual({ ok: true });
    expect(tender!.tenderedTo).toBe(0);
    expect(k.tendered).toBe(before + 1);
    expect(k.acceptance).toBeLessThan(1);
    expect(c.tenderAcceptance).toBeLessThan(1);
  });

  it("runs with the AI for a month without breaking the ledger, and some AI carriers hold contracts", () => {
    const w = world(25);
    populate(w, { freeOwnerOperators: 40, fleets: 10, brokers: 3 });
    runDays(w, 30, ruleBotHook);
    expect(w.contracts.some((k) => k.status === "active")).toBe(true);
    expect([...w.loads.values()].every((l) => l.tenderedTo === 0 || l.status === "open")).toBe(true);
  });
});
