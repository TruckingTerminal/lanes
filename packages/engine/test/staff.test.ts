import { describe, expect, it } from "vitest";
import { economyConfig as cfg } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { populate, ruleBotHook } from "@lanes/agents";
import {
  addTruck,
  applyAction,
  askingPay,
  companyAccount,
  createWorld,
  crash,
  dailyLabor,
  dealerPrice,
  dispatchProfile,
  formCompany,
  inspect,
  monthlyDealerPrices,
  poolOf,
  quote,
  runDays,
  signPolicy,
  vettingBlock,
  yardPerTruck,
  homeEdge,
  updateHomeCrowding,
  type Load,
  type World,
} from "@lanes/engine";

const net = buildNetwork(hubs, cfg);

function world(seed = 1): World {
  return createWorld({ cfg, net, feeds: neutralFeeds, seed });
}

function carrier(w: World, opts: { hub?: string; freePath?: boolean; age?: number } = {}) {
  return formCompany(w, { name: "Test", role: "carrier", homeHubId: opts.hub ?? "DAL", strategy: "test", orders: [], freePath: opts.freePath ?? true, authorityAgeDays: opts.age });
}

const fund = (w: World, id: number, fd: number) => w.ledger.post(w.t, "faucet:starting_grant", companyAccount(id), fd, "test");

describe("staff", () => {
  it("seats the owner in the first truck and leaves a second truck empty until someone is hired", () => {
    const w = world();
    const c = carrier(w);
    const [lease] = w.trucksByCompany.get(c.id)!;
    const owner = w.staffByCompany.get(c.id)!.find((s) => s.owner)!;
    expect(lease!.driverId).toBe(owner.id);
    const second = addTruck(w, c, "owned", "workhorse", "reefer");
    expect(second.driverId).toBe(0);
    const s = poolOf(w, "driver")[0]!;
    expect(applyAction(w, c.id, { type: "offer_staff", staffId: s.id, pay: askingPay(w, s) * 0.9, truckId: second.id }).ok).toBe(false);
    expect(applyAction(w, c.id, { type: "offer_staff", staffId: s.id, pay: askingPay(w, s), truckId: second.id }).ok).toBe(true);
    expect(second.driverId).toBe(s.id);
    expect(second.wagePerMile).toBeCloseTo(askingPay(w, s), 6);
  });

  it("lets a rival poach a driver unless the employer matches within the notice period", () => {
    const w = world(2);
    const a = carrier(w);
    const b = carrier(w, { hub: "ATL" });
    // By hand: auto-staff would fill the poacher's empty seat while the offer waits.
    a.autoStaff = false;
    b.autoStaff = false;
    const ta = addTruck(w, a, "owned", "workhorse", "van");
    const tb = addTruck(w, b, "owned", "workhorse", "van");
    const s = poolOf(w, "driver")[0]!;
    applyAction(w, a.id, { type: "offer_staff", staffId: s.id, pay: askingPay(w, s), truckId: ta.id });
    // A raise below their loyalty premium isn't enough.
    expect(applyAction(w, b.id, { type: "offer_staff", staffId: s.id, pay: s.pay * 1.01, truckId: tb.id }).ok).toBe(false);
    const offer = s.pay * 1.3;
    expect(applyAction(w, b.id, { type: "offer_staff", staffId: s.id, pay: offer, truckId: tb.id }).ok).toBe(true);
    // Matched: stays.
    applyAction(w, a.id, { type: "set_staff_pay", staffId: s.id, pay: offer });
    w.t += cfg.labor.morale.noticeDays * cfg.time.gameMinutesPerDay;
    dailyLabor(w);
    expect(s.companyId).toBe(a.id);
    // Not matched: leaves once the notice runs out.
    expect(applyAction(w, b.id, { type: "offer_staff", staffId: s.id, pay: offer * 1.3, truckId: tb.id }).ok).toBe(true);
    w.t += cfg.labor.morale.noticeDays * cfg.time.gameMinutesPerDay;
    dailyLabor(w);
    expect(s.companyId).toBe(b.id);
    expect(tb.driverId).toBe(s.id);
    expect(ta.driverId).toBe(0);
  });

  it("covers only the owner's three trucks without a dispatcher", () => {
    const w = world(3);
    const c = carrier(w, { freePath: false });
    for (let i = 0; i < 6; i++) addTruck(w, c, "owned", "workhorse", "van");
    expect(dispatchProfile(w, c, 6).coverage).toBeCloseTo(0.5, 6);
    c.autoStaff = true;
    dailyLabor(w);
    expect(dispatchProfile(w, c, 6).coverage).toBe(1);
    expect(w.trucksByCompany.get(c.id)!.every((t) => t.driverId !== 0)).toBe(true);
  });

  it("keeps every AI truck crewed through a month of play", () => {
    const w = world(4);
    populate(w, { freeOwnerOperators: 60, fleets: 20, brokers: 4 });
    runDays(w, 30, ruleBotHook);
    // A truck leased today gets its driver at tomorrow's staffing pass.
    const today = Math.floor(w.t / cfg.time.gameMinutesPerDay);
    const running = w.trucks.filter((t) => t.companyId !== 0 && t.status !== "parked" && t.status !== "listed" && t.status !== "retired" && t.leasedDay !== today);
    expect(running.filter((t) => t.driverId === 0).length).toBeLessThanOrEqual(Math.ceil(running.length * 0.02));
    w.ledger.assertBalanced();
  });
});

describe("safety", () => {
  it("puts a truck with defects out of service at a full inspection", () => {
    const w = world(5);
    const c = carrier(w);
    const [t] = w.trucksByCompany.get(c.id)!;
    t!.defects = 6;
    let oos = false;
    for (let i = 0; i < 20 && !oos; i++) oos = inspect(w, t!, c, 1, "a test scale");
    expect(oos).toBe(true);
    expect(c.safety.violations.some((v) => v.basic === "maintenance")).toBe(true);
    expect(t!.breakdownMin).toBeGreaterThan(0);
  });

  it("revokes and bars a company whose falsified hours caused a fatal crash", () => {
    const w = world(6);
    const c = carrier(w);
    fund(w, c.id, 50_000);
    const [t] = w.trucksByCompany.get(c.id)!;
    // Force the worst case: over hours, at fault, fatal.
    t!.overMin = 240;
    t!.status = "repositioning";
    const rng = w.rng.safety;
    const next = rng.next.bind(rng);
    rng.next = () => 0;
    crash(w, t!, c);
    rng.next = next;
    expect(c.authority.status).toBe("revoked");
    expect(c.authority.crimes).toBe(1);
    expect(c.authority.barredUntil! - Math.floor(w.t / 1440)).toBe(cfg.safety.bars.criminal);
    expect(w.ledger.balance(companyAccount(c.id))).toBeLessThanOrEqual(0.01);
    expect(applyAction(w, c.id, { type: "refile_authority" }).ok).toBe(false);
    w.ledger.assertBalanced();
  });
});

describe("insurance and dealer prices", () => {
  it("prices a policy by rating, record and home hub, and bills it weekly per truck", () => {
    const w = world(7);
    // Owned trucks: the NPC lessor carries the policy on its own leased trucks.
    const safe = carrier(w, { hub: "CHI", age: 400, freePath: false });
    addTruck(w, safe, "owned", "workhorse", "van");
    const risky = carrier(w, { hub: "CHI", age: 400 });
    risky.safety.rating = "conditional";
    signPolicy(w, risky);
    expect(risky.insurance.annualPerTruck / safe.insurance.annualPerTruck).toBeCloseTo(cfg.insurance.rating.conditional, 6);
    const miami = carrier(w, { hub: "MIA", age: 400 });
    expect(miami.insurance.annualPerTruck).toBeGreaterThan(safe.insurance.annualPerTruck);
    // Fixed for the term: a worse record shows up only at renewal (or a re-write).
    safe.safety.insuranceSurcharge = 1;
    expect(quote(w, safe).annualPerTruck).toBeGreaterThan(safe.insurance.annualPerTruck);
    const before = w.ledger.balance(companyAccount(safe.id));
    runDays(w, 7);
    // A week costs a week of the policy (no freight hauled; the first truck parks free).
    expect(before - w.ledger.balance(companyAccount(safe.id))).toBeCloseTo(safe.insurance.annualPerTruck / 52, 1);
  });

  it("raises dealer prices as supply runs out", () => {
    const w = world(8);
    const before = dealerPrice(w, { tier: "workhorse", trailer: "van" });
    w.supply.tractor.workhorse = 0;
    w.supply.trailer.van = 0;
    for (let m = 0; m < 6; m++) monthlyDealerPrices(w);
    expect(dealerPrice(w, { tier: "workhorse", trailer: "van" })).toBeGreaterThan(before * 1.03);
    expect(w.dealerIndex.tractor.workhorse).toBeLessThanOrEqual(cfg.dealerPrices.range[1]);
  });
});

describe("players", () => {
  const player = (w: World) => formCompany(w, { name: "Player", role: "carrier", homeHubId: "DAL", strategy: "player:test", orders: [], freePath: true, human: true });
  const illegal = { hos: "always", speed: "legal", maintenance: "full" } as const;
  const rebroker = [{ kind: "rebroker", share: 1, keepPct: 0.1, pays: true }] as const;

  it("can take the same bad-actor actions as the AI: an illegal policy, re-brokering and theft", () => {
    const w = world(11);
    const human = player(w);
    expect(applyAction(w, human.id, { type: "set_compliance", policy: illegal }).ok).toBe(true);
    expect(human.policy.hos).toBe("always");
    expect(applyAction(w, human.id, { type: "set_standing_orders", orders: [...rebroker] }).ok).toBe(true);
    const [truck] = w.trucksByCompany.get(human.id)!;
    // Allowed in principle: the only objection is that the truck is empty.
    expect(applyAction(w, human.id, { type: "steal_load", truckId: truck!.id })).toEqual({ ok: false, reason: "the truck isn't hauling a load" });
  });

  it("are locked out of them when the config says the bad actors are AI only", () => {
    const w = createWorld({ cfg: { ...cfg, fraud: { ...cfg.fraud, players: false } }, net, feeds: neutralFeeds, seed: 11 });
    const human = player(w);
    const ai = carrier(w);
    expect(applyAction(w, human.id, { type: "set_compliance", policy: illegal }).ok).toBe(false);
    expect(applyAction(w, human.id, { type: "set_compliance", policy: { hos: "legal", speed: "legal", maintenance: "full" } }).ok).toBe(true);
    expect(applyAction(w, human.id, { type: "set_standing_orders", orders: [...rebroker] }).ok).toBe(false);
    const [truck] = w.trucksByCompany.get(human.id)!;
    expect(applyAction(w, human.id, { type: "steal_load", truckId: truck!.id })).toEqual({ ok: false, reason: "that isn't available to players" });
    expect(applyAction(w, ai.id, { type: "set_compliance", policy: illegal }).ok).toBe(true);
  });
});

describe("home markets", () => {
  it("gives carriers in an uncrowded home hub a bigger local edge and cheaper yards", () => {
    const w = world(10);
    const chicago = Array.from({ length: 12 }, () => carrier(w, { hub: "CHI" }));
    const miami = carrier(w, { hub: "MIA" });
    const chi = w.net.hubs.findIndex((h) => h.id === "CHI");
    const mia = w.net.hubs.findIndex((h) => h.id === "MIA");
    // Crowding is engine state, recomputed at fixed points, never on demand.
    expect(homeEdge(w, miami, mia)).toBe(homeEdge(w, chicago[0]!, chi));
    updateHomeCrowding(w);
    expect(homeEdge(w, miami, mia)).toBeGreaterThan(homeEdge(w, chicago[0]!, chi));
    expect(homeEdge(w, miami, chi)).toBe(0);
    expect(yardPerTruck(w, chicago[0]!)).toBeGreaterThan(yardPerTruck(w, miami));
  });
});

describe("vetting", () => {
  it("keeps a new authority off standard and strict freight until it has the age and record", () => {
    const w = world(9);
    const fresh = carrier(w);
    const veteran = carrier(w, { age: 800 });
    veteran.delivered = 50;
    const load = (vet: 0 | 1 | 2) => ({ vet }) as Load;
    expect(vettingBlock(w, fresh, load(0))).toBeNull();
    expect(vettingBlock(w, fresh, load(1))).not.toBeNull();
    expect(vettingBlock(w, fresh, load(2))).not.toBeNull();
    expect(vettingBlock(w, veteran, load(2))).toBeNull();
    veteran.safety.rating = "conditional";
    expect(vettingBlock(w, veteran, load(2))).not.toBeNull();
    expect(vettingBlock(w, veteran, load(1))).toBeNull();
  });
});
