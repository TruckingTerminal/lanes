import { describe, expect, it } from "vitest";
import { borrowingCapacity, borrowLender, companyAccount, lendNowFd, poolCash } from "@lanes/engine";
import { blockReason, boardRows } from "../src/board.js";
import { ANSWER, CAPS, CONFIRM, DELIVERED, MOVE, SAFETY_NEWS, SECURITY } from "../src/copy.js";
import { safetyNeeds } from "../src/logic.js";
import { poachResult } from "../src/ui/panels/Staff.js";
import { item, itemSaving, usedTruck } from "../src/confirmspecs.js";
import { confirmAct, confirmSpend } from "../src/ui/Confirm.js";
import { S } from "../src/state.js";
import { breakdown } from "../src/explain.js";
import { dateLabel, shortDate } from "../src/format.js";
import { emptyRun, paidLine } from "../src/rolling.js";
import { cushion, debtCountdown, fleetCaps, gapToTruck, nextEvent, nextWeeklyCheckDay } from "../src/figures.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { nextAction } from "../src/nextstep.js";
import { RETURN_HOURS, returnFor, saveVisit } from "../src/returncard.js";
import { leaseMinFor, weekCosts } from "../src/ledger.js";
import { borrowable } from "../src/finance.js";
import { skippedSteps, stepKey, walkProgress, walkSteps } from "../src/walkthrough.js";

async function fresh() {
  const g = await TestGame.create();
  const c = g.join("Next Freight", "oo", "LAX")!;
  const truck = g.w.trucksByCompany.get(c.id)![0]!;
  return { g, c, truck };
}

describe("What now? (nextAction), rule by rule", () => {
  it("rule 3: an idle truck with a paying load in reach, ahead of the walkthrough's step", async () => {
    const { g, c, truck } = await fresh();
    const a = nextAction(GAME_CONFIG, g.w, c);
    expect(a.rule).toBe(3);
    if (a.kind !== "idle") throw new Error(a.kind);
    expect(a.truckId).toBe(truck.id);
    expect(a.profitFd).toBeGreaterThan(0);
  }, 60_000);

  it("rule 4: the walkthrough's step once no truck is free", async () => {
    const { g, c, truck } = await fresh();
    const row = boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "" }).find((r) => !r.block)!;
    expect(g.act({ type: "book_load", truckId: truck.id, loadId: row.l.id }).ok).toBe(true);
    const a = nextAction(GAME_CONFIG, g.w, c);
    expect(a.rule).toBe(4);
  }, 60_000);

  it("rule 2: a truck without a driver, and a tender before it", async () => {
    const { g, c, truck } = await fresh();
    truck.driverId = 0;
    expect(nextAction(GAME_CONFIG, g.w, c)).toMatchObject({ rule: 2, kind: "driver", truckId: truck.id });
    const load = [...g.w.loads.values()].find((l) => l.status === "open")!;
    load.tenderedTo = c.id;
    load.tenderUntil = g.w.t + 600;
    expect(nextAction(GAME_CONFIG, g.w, c)).toMatchObject({ rule: 2, kind: "tender", loadId: load.id });
  }, 60_000);

  it("rule 1: danger outranks everything, with the countdown and a real lever", async () => {
    const { g, c } = await fresh();
    const bal = g.w.ledger.balance(companyAccount(c.id));
    g.w.ledger.post(g.w.t, companyAccount(c.id), "sink:test", bal + g.w.cfg.insolvency.debtLimitFd + 1_000, "test");
    const a = nextAction(GAME_CONFIG, g.w, c);
    if (a.kind !== "danger") throw new Error(a.kind);
    expect(a.debt.under).toBe(true);
    expect(a.debt.nextDay).toBe(nextWeeklyCheckDay(g.w));
    expect(a.lever?.kind).toBe("book");
  }, 60_000);

  it("rule 2: a lost hand bid with a better load beside it, at its usually-clears-near rate; none when nothing beats it", async () => {
    const { g, c, truck } = await fresh();
    const rows = boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "" }).filter((r) => !r.block);
    const lostLoad = rows[0]!.l;
    const a = nextAction(GAME_CONFIG, g.w, c, { loadId: lostLoad.id, truckId: truck.id, profitAtWinningFd: 0 });
    if (a.kind !== "lost") throw new Error(a.kind);
    expect(a.truckId).toBe(truck.id);
    expect(a.loadId).not.toBe(lostLoad.id);
    expect(a.profitFd).toBeGreaterThan(0);
    // Nothing beside it would have left as much as the lost load at the winning rate: rule 3 as usual.
    expect(nextAction(GAME_CONFIG, g.w, c, { loadId: lostLoad.id, truckId: truck.id, profitAtWinningFd: 1e9 }).rule).toBe(3);
  }, 60_000);

  it("rule 1: invoices due before the deciding check come before selling a truck (QA's guidance replay)", async () => {
    const g = await TestGame.create();
    const c = g.join("Owed Freight", "fleet", "LAX")!;
    // Both trucks busy: no load to book, so the levers are collect, then sell.
    for (const t of g.w.trucksByCompany.get(c.id)!) g.w.manualBids.set(t.id, { loadId: 0, rate: 0 } as never);
    const acct = companyAccount(c.id);
    const short = 10_000;
    g.w.ledger.post(g.w.t, acct, "sink:test", g.w.ledger.balance(acct) + g.w.cfg.insolvency.debtLimitFd + short, "test");
    c.weeksInDebt = 1;
    const before = nextAction(GAME_CONFIG, g.w, c);
    if (before.kind !== "danger") throw new Error(before.kind);
    expect(before.lever?.kind).toBe("sell");
    // An invoice dated before the check that would wind the company up, covering the shortfall: collect, not sell.
    const deciding = before.debt.nextDay + 7 * (before.debt.of - before.debt.n - 1);
    g.w.receivables.push({ id: 999_001, payer: 0, faucet: "faucet:test", payeeId: c.id, amountFd: short + 500, dueDay: deciding, holder: c.id });
    const after = nextAction(GAME_CONFIG, g.w, c);
    if (after.kind !== "danger") throw new Error(after.kind);
    expect(after.lever).toMatchObject({ kind: "collect", byDay: deciding });
    // Due after that check, it can't save the company: selling stays the lever.
    g.w.receivables.at(-1)!.dueDay = deciding + 1;
    const late = nextAction(GAME_CONFIG, g.w, c);
    expect(late.kind === "danger" && late.lever?.kind).toBe("sell");
  }, 60_000);

  it("rule 1 with cash now on: the freshest invoices under a contract, the fewest at spot, enough to clear the line", async () => {
    const pay = GAME_CONFIG.token.payment as { enabled: boolean; cashNow: { enabled: boolean } };
    const was = [pay.enabled, pay.cashNow.enabled];
    pay.enabled = true;
    pay.cashNow.enabled = true;
    try {
      const g = await TestGame.create();
      const c = g.join("Cash Freight", "fleet", "LAX")!;
      for (const t of g.w.trucksByCompany.get(c.id)!) g.w.manualBids.set(t.id, { loadId: 0, rate: 0 });
      const acct = companyAccount(c.id);
      g.w.ledger.post(g.w.t, acct, "sink:test", g.w.ledger.balance(acct) + g.w.cfg.insolvency.debtLimitFd + 3_000, "test");
      const today = Math.floor(g.w.t / g.w.cfg.time.gameMinutesPerDay);
      const inv = (id: number, fd: number, due: number) => g.w.receivables.push({ id, payer: 0, faucet: "faucet:test", payeeId: c.id, amountFd: fd, dueDay: today + due, holder: c.id });
      inv(999_201, 2_000, 10); // older (raised earlier), small
      inv(999_202, 6_000, 20); // middle
      inv(999_203, 4_000, 29); // freshest
      // At spot: the fewest that clear the 3,000 shortfall: the 6,000 alone.
      const spot = nextAction(GAME_CONFIG, g.w, c);
      if (spot.kind !== "danger" || spot.lever?.kind !== "cash") throw new Error(spot.kind);
      expect(spot.lever.invoiceIds).toEqual([999_202]);
      expect(spot.lever.contract).toBe(false);
      // Under a contract: the freshest first, the 4,000 clears it.
      c.factoring = { until: today + 90, stakeFd: 0, rate: 0.059, trucks: 2, renew: false, log: 0 };
      const contract = nextAction(GAME_CONFIG, g.w, c);
      if (contract.kind !== "danger" || contract.lever?.kind !== "cash") throw new Error(contract.kind);
      expect(contract.lever.invoiceIds).toEqual([999_203]);
      expect(contract.lever.landsFd + contract.lever.feeFd).toBeCloseTo(4_000, 6);
      // Switch off: back to waiting for the dated invoices.
      pay.cashNow.enabled = false;
      const off = nextAction(GAME_CONFIG, g.w, c);
      expect(off.kind === "danger" && off.lever?.kind).not.toBe("cash");
    } finally {
      [pay.enabled, pay.cashNow.enabled] = was as [boolean, boolean];
    }
  }, 60_000);

  it("rule 1 back above the line with checks counted: hold until the check, never sell", async () => {
    const g = await TestGame.create();
    const c = g.join("Hold Freight", "fleet", "LAX")!;
    for (const t of g.w.trucksByCompany.get(c.id)!) g.w.manualBids.set(t.id, { loadId: 0, rate: 0 });
    c.weeksInDebt = 3;
    const a = nextAction(GAME_CONFIG, g.w, c);
    if (a.kind !== "danger") throw new Error(a.kind);
    expect(a.debt.under).toBe(false);
    expect(a.lever).toEqual({ kind: "hold", day: a.debt.nextDay });
  }, 60_000);

  it("rule 0: being wound up answers with the restart's day", async () => {
    const { g, c } = await fresh();
    c.liquidatingSince = 10;
    expect(nextAction(GAME_CONFIG, g.w, c)).toEqual({ rule: 0, kind: "liquidating", restartDay: 10 + g.w.cfg.insolvency.restartAfterDays });
  }, 60_000);

  it("rules 5 and 6's figures: the cushion, the gap to the next truck, the countdown and the next event", async () => {
    const { g, c } = await fresh();
    c.weeklySpend = [1_000, 2_000, 3_000, 2_000];
    const cu = cushion(g.w, c);
    expect(cu.avgWeeklyFd).toBe(2_000);
    expect(cu.weeks).toBeCloseTo(Math.max(0, cu.cashFd) / 2_000, 9);
    const gap = gapToTruck(g.w, c);
    expect(gap.holdFd).toBe(g.w.cfg.guide.gapCushionWeeks * 2_000);
    expect(gap.gapFd).toBeCloseTo(Math.max(0, gap.needNowFd - gap.spareFd), 6);
    expect(debtCountdown(g.w, c)).toMatchObject({ n: 0, of: g.w.cfg.insolvency.weeksInDebt, under: false });
    const e = nextEvent(g.w, c);
    expect(e.atMin).toBeGreaterThan(g.w.t);
  }, 60_000);
});

describe("the walkthrough's soft ways out (the director's R2)", () => {
  it("a skipped step stays current but silent, not done, and What now? passes over it; the next waits for the world", async () => {
    const { g, c, truck } = await fresh();
    const row = boardRows(g.w, c, truck, { dest: "any", maxDh: 300, query: "" }).find((r) => !r.block)!;
    expect(g.act({ type: "book_load", truckId: truck.id, loadId: row.l.id }).ok).toBe(true);
    const before = walkProgress(GAME_CONFIG, g.w, c);
    const a = nextAction(GAME_CONFIG, g.w, c);
    expect(a).toMatchObject({ rule: 4, index: before.index });
    const id = walkSteps(GAME_CONFIG)[before.index]!.id;
    const after = walkProgress(GAME_CONFIG, g.w, c, [id]);
    expect(after.index).toBe(before.index); // the next step doesn't run ahead of its event
    expect(after.skipped).toBe(true);
    expect(after.done).toBe(before.done); // skipped isn't done
    expect(nextAction(GAME_CONFIG, g.w, c, null, [id])).not.toMatchObject({ rule: 4, index: before.index });
    // Marks are this company's: another world's skip in the same browser doesn't count.
    expect(skippedSteps([stepKey(g.w, c, "say:paid"), stepKey(g.w, c, `skip:${id}`), `other:1:0|skip:paid`], g.w, c)).toEqual([id]);
  }, 60_000);

  it("Standing orders is done for a player who bids by hand and switched the dispatcher off", async () => {
    const { g, c } = await fresh();
    const orders = walkSteps(GAME_CONFIG).find((s) => s.id === "orders")!;
    expect(orders.done(g.w, c)).toBe(false);
    c.firstHandBidDay = 0;
    c.orders = c.orders.filter((o) => o.kind !== "bid");
    expect(orders.done(g.w, c)).toBe(true);
  }, 60_000);
});

describe("sprint 3's cheap list", () => {
  it("pay lines from the true terms; the gap shows the hold; walls in the engine's order; prices on empty runs; Security bands", async () => {
    const { g, c, truck } = await fresh();
    const w = g.w;
    // The lessor pays on delivery; quick pay, the factor and net terms each say their own.
    expect(paidLine(w, c, truck, undefined)).toBe(DELIVERED.paidToday);
    const owned = { ...truck, lease: "owned" as const };
    c.payTerms = "quick";
    expect(paidLine(w, c, owned, undefined)).toMatch(/^Paid today, less [\d.]+%\.$/);
    const inv = { id: 1, payer: 0, faucet: "x", payeeId: c.id, amountFd: 1000, dueDay: 40, holder: c.id } as never;
    expect(paidLine(w, c, owned, inv)).toBe(`Due ${shortDate(40)}.`);
    expect(paidLine(w, c, owned, { ...(inv as object), holder: -2 } as never)).toMatch(/^Paid today by the factor, less [\d.]+%\.$/);
    // The gap lists what's held toward the truck as its own row, and the rows add up to the gap.
    truck.depositFd = 2_000;
    const b = breakdown(w, c, "guide.gapToTruck", {})!;
    const gap = gapToTruck(w, c);
    if (gap.depositFd > 0.5) expect(b.rows.some((r) => r.label === "Less what's held toward your truck")).toBe(true);
    expect(gap.grossNeedFd - gap.depositFd).toBeCloseTo(gap.needNowFd, 6);
    // A strict load before the authority's age: both counts; the local-first wall names the next round.
    const strict = [...w.loads.values()].find((l) => l.status === "open")!;
    strict.vet = 2;
    expect(blockReason(w, c, truck, strict)).toMatch(/^Strict vetting: \d+ days' authority and \d+ loads\. You have \d+ days, \d+ loads\.$/);
    // Send home and send empty show a price and a time before the tap.
    const other = w.net.hubs.findIndex((_, i) => i !== truck.hub);
    const run = emptyRun(w, truck, truck.hub, other);
    expect(MOVE.home(run.mi, run.fd, run.time)).toMatch(/^Home · [\d,]+ mi empty · about [\d,]+ FD · (\d+ h|1 day|\d+ days)$/);
    expect([SECURITY.band(1), SECURITY.band(1.5), SECURITY.band(2.4)]).toEqual(["quiet", "watch", "risky"]);
  }, 60_000);
});

describe("the confirm card (R6)", () => {
  it("asks over a quarter of cash or for anything that can't be undone, and says the writer's lines", async () => {
    const { g, c, truck } = await fresh();
    const w = g.w;
    S.game = g as never;
    const cash = w.ledger.balance(companyAccount(c.id));
    let ran = 0;
    const spec = (costFd: number) => ({ verb: "Buy", item: "it", costFd, does: "x", risk: null, run: () => ran++ });
    confirmSpend(spec(cash * 0.2));
    expect(ran).toBe(1);
    expect(S.confirm).toBeNull();
    confirmSpend(spec(cash * 0.3));
    expect(ran).toBe(1);
    expect(S.confirm?.verb).toBe("Buy");
    S.confirm = null;
    // The lines, from this truck's own figures.
    const used = usedTruck(w, c, { tier: "workhorse", trailer: "van", lease: "owned", odometer: 900_000, milesSinceRebuild: 300_000, rebuilds: 2 }, w.net.hubs.findIndex((_, i) => i !== c.homeHub));
    expect(used.does).toMatch(/^A used Workhorse with a dry van: \d+% of its life left, no rebuilds\. It's at .+, [\d,]+ miles from home\.$/);
    expect(used.risk).toMatch(/^It runs until it's worn out, then goes for scrap, for about [\d,]+ FD\. Bringing it home takes a driver and empty miles\.$/);
    // A new truck has no record: the payback reads a typical month's miles and the engine's own cuts, never "unknown".
    for (const m of ["apu", "aero", "tires", "sleeper"] as const) expect(item(w, c, m, truck, 1, 5000).risk).toMatch(/about [\d,]+ weeks/);
    const aero = itemSaving(w, c, "aero", truck);
    expect(aero.ownRecord).toBe(false);
    expect(aero.perWeekMi).toBeCloseTo((12_000 * 7) / w.cfg.time.daysPerMonth);
    expect(itemSaving(w, c, "tires", truck).perWeekFd).toBeGreaterThan(0);
    S.game = null;
  }, 60_000);
});

describe("R1: the dispatcher waits for the player's choice (guard.dispatcherDefaultOn)", () => {
  it("on, a player's company joins bidding as today; off, it joins with no bid order and keeps its home time", async () => {
    // Both ways, whatever the live levers set (the bump turns it off, adf635c); the key is put back as it was.
    const k = GAME_CONFIG.guard as { dispatcherDefaultOn: boolean };
    const was = k.dispatcherDefaultOn;
    try {
      k.dispatcherDefaultOn = true;
      const on = await TestGame.create();
      const a = on.join("On Freight", "oo", "LAX")!;
      expect(a.orders.some((o) => o.kind === "bid")).toBe(true);
      k.dispatcherDefaultOn = false;
      const off = await TestGame.create();
      const b = off.join("Off Freight", "fleet", "LAX")!;
      expect(b.orders.some((o) => o.kind === "bid")).toBe(false);
      expect(b.orders.some((o) => o.kind === "homeTime")).toBe(true);
    } finally {
      k.dispatcherDefaultOn = was;
    }
  }, 60_000);
});

describe("the confirm card's foot (QA's R6 replay)", () => {
  it("swaps only for a low tap on the right half, so Not now takes the thumb's spot; a short buy can't be confirmed", async () => {
    const { g } = await fresh();
    S.game = g as never;
    const spec = { verb: "Buy", item: "it", costFd: 1e9, does: "x", risk: null, run: () => undefined };
    const at = (x: number, y: number) => ({ clientX: x, clientY: y }) as MouseEvent;
    (globalThis as { window?: unknown }).window = { innerHeight: 812, innerWidth: 375 };
    try {
      confirmAct(spec, at(99, 736));
      expect(S.confirm?.swap).toBe(false); // left half: Not now is already on the left
      confirmAct(spec, at(300, 736));
      expect(S.confirm?.swap).toBe(true); // right half: Not now moves right, under the thumb
      confirmAct(spec, at(300, 300));
      expect(S.confirm?.swap).toBe(false); // not in the foot's band
    } finally {
      delete (globalThis as { window?: unknown }).window;
      S.confirm = null;
      S.game = null;
    }
  }, 60_000);
});

describe("what limits the fleet (R19)", () => {
  it("names the cap that binds first and counts trucks on order", async () => {
    const { g, c } = await fresh();
    const k = fleetCaps(g.w, c);
    expect(k.cap).toBe(Math.min(...[k.binding, ...k.others].map((r) => r.n), g.w.cfg.company.maxTrucks));
    expect(k.running).toBe((g.w.trucksByCompany.get(c.id) ?? []).length);
    // The company limit is always among the caps, so the line can name it when it isn't the one that binds.
    expect([k.binding, ...k.others].some((r) => r.kind === "company")).toBe(true);
    expect(CAPS.line(k.cap, CAPS.binding[k.binding.kind](k.binding.n), "")).toMatch(/^You may run \d+: (your yard holds|your stake allows|your operations managers cover|the company limit is) \d+\.$/);
  }, 60_000);
});

describe("R7: one figure from one source; only what the lender gives", () => {
  it("the lease minimum is the week's bill per truck, and Borrow offers no more than the engine's limits", async () => {
    const g = await TestGame.create();
    const c = g.join("Door Freight", "fleet", "LAX")!;
    const trucks = g.w.trucksByCompany.get(c.id)!;
    expect(trucks.reduce((s, t) => s + leaseMinFor(g.w, t), 0)).toBeCloseTo(weekCosts(g.w, c).leaseMinimum, 6);
    // Borrow reads the engine (lendNowFd): its figure exactly, and no rows while the lender is off.
    const rows = borrowable(g.w, trucks);
    if (borrowLender(g.w) === "off") expect(rows).toEqual([]);
    for (const { t, cap } of rows) {
      expect(cap).toBe(lendNowFd(g.w, c.id, t));
      expect(cap).toBeLessThanOrEqual(borrowingCapacity(g.w, t));
      expect(cap).toBeLessThanOrEqual(poolCash(g.w));
    }
  }, 60_000);
});

describe("the return card (R21)", () => {
  it("shows after RETURN_HOURS away, for the same company, with what changed; not before, not for another", async () => {
    const { g, c } = await fresh();
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) };
    try {
      saveVisit(g.w, c);
      const saved = JSON.parse(store.get("lanes.lastVisit")!) as { realMs: number };
      expect(returnFor(g.w, c, true, saved.realMs + 3_600_000)).toBeNull(); // an hour: no card
      c.delivered += 2;
      c.operating.revenueFd += 4_000;
      c.late += 1;
      const back = returnFor(g.w, c, true, saved.realMs + RETURN_HOURS * 3_600_000)!;
      expect(back).toMatchObject({ live: true, delivered: 2, late: 1 });
      expect(back.inFd).toBeCloseTo(4_000, 6);
      const other = (await fresh()).c;
      other.id = c.id + 1;
      expect(returnFor(g.w, other, true, saved.realMs + RETURN_HOURS * 3_600_000)).toBeNull(); // another company
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  }, 60_000);
});

describe("R7: a hire-away offer's answer lands on Staff from the engine's notice", () => {
  it("turns 'stayed' and 'joined' notices into the writer's lines", async () => {
    const g = await TestGame.create();
    const c = g.join("Poach Freight", "fleet", "LAX")!;
    const w = g.w;
    S.game = g as never;
    S.poachResults = [];
    const other = w.staff.find((s) => s.status === "employed" && s.companyId && s.companyId !== c.id && !s.owner)!;
    const employer = w.companies[other.companyId - 1]!.name;
    poachResult(w, c, `${other.name} stayed: their employer matched your offer.`);
    expect(S.poachResults[0]?.text).toBe(ANSWER.poachStayed(other.name, employer));
    const ours = w.staff.find((s) => s.companyId === c.id && s.kind === "driver" && !s.owner) ?? w.staff.find((s) => s.companyId === c.id)!;
    poachResult(w, c, `Driver ${ours.name} (★★★☆☆★) joined you from ${employer}.`);
    expect(S.poachResults[0]?.text.startsWith(`${ours.name} accepted`)).toBe(true);
    poachResult(w, c, "Driver Somebody quit.");
    expect(S.poachResults).toHaveLength(2);
    S.poachResults = [];
    S.game = null;
  }, 60_000);
});

describe("R18: the road to revocation is a Needs-you item at every step", () => {
  it("an alert, the audit's date and a bad rating each become an item that opens the safety card", async () => {
    const g = await TestGame.create(undefined, undefined, 4242);
    const c = g.join("Rated Freight", "oo", "LAX")!;
    const w = g.w;
    const today = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
    expect(safetyNeeds(w, c)).toEqual([]);
    c.safety.alerts = ["hos"];
    expect(safetyNeeds(w, c).map((n) => n.text)).toEqual([SAFETY_NEWS.alert("hours of service", w.cfg.safety.review.auditDays)]);
    c.safety.reviewDay = today + 10;
    expect(safetyNeeds(w, c).map((n) => n.text)).toEqual([`${SAFETY_NEWS.auditDue(dateLabel(today + 10))} ${SAFETY_NEWS.auditWhy(1)}`]);
    c.safety.rating = "unsatisfactory";
    c.safety.ratingDay = today;
    c.safety.revokeDay = today + 45;
    const items = safetyNeeds(w, c);
    expect(items[0]!.text).toBe(`${SAFETY_NEWS.auditResult("Unsatisfactory")} ${SAFETY_NEWS.consequence.unsatisfactory} ${SAFETY_NEWS.revokes(dateLabel(today + 45))}`);
    expect(items.every((n) => n.tab === "company" && n.target === '[data-need="safety"]')).toBe(true);
  }, 60_000);
});
