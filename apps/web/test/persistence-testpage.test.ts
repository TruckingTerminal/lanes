import "./seed.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { companyAccount } from "@lanes/engine";
import { TestGame, type TestLog } from "../src/game.js";
import { PENDING } from "../src/copy-pending.js";

/**
 * The red team's persistence review (studio/reviews/redteam-persistence.md), the test page's half: §4 two tabs on one
 * saved world, §6 the hour's step and the restore. Each "tab" is its own load of state.ts over one browser's storage
 * and Web Locks; the worlds are plain TestGames.
 */
const KEY = "lanes.testworld.v1";
type Tab = typeof import("../src/state.js");

/** One browser: its storage, and its Web Locks when `withLocks` (a lock is one tab's until that tab closes). */
function browser(withLocks: boolean): { store: Map<string, string> } {
  const store = new Map<string, string>();
  const held = new Set<string>();
  const locks = {
    request: (name: string, _o: unknown, cb: (lock: unknown) => unknown) => {
      if (held.has(name)) return Promise.resolve(cb(null));
      held.add(name);
      return Promise.resolve(cb({ name }));
    },
  };
  vi.stubGlobal("__LANES_TEST__", true);
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
  vi.stubGlobal("navigator", withLocks ? { locks } : {});
  vi.stubGlobal("window", { setTimeout: () => 0 });
  return { store };
}
/** A tab: a fresh load of the page's state over the stubbed browser. */
async function tab(): Promise<Tab> {
  vi.resetModules();
  return import("../src/state.js");
}
/** Puts a world in a tab as Continue or New world does (main.tsx). */
function open(p: Tab, g: TestGame, mine: boolean, saved?: TestLog): void {
  p.S.test = g;
  p.S.game = g;
  p.markPersisted(g, saved);
  p.S.testWatching = !mine;
}
const savedT = (store: Map<string, string>) => (JSON.parse(store.get(KEY)!) as TestLog).t;
/** What a replay has to match: the company's money and every one of its trucks. */
function shape(g: TestGame): string {
  const c = g.player!;
  const trucks = (g.w.trucksByCompany.get(c.id) ?? []).map((t) => [t.id, t.status, t.odometer, t.hub]);
  return JSON.stringify([g.w.t, g.w.ledger.balance(companyAccount(c.id)), trucks]);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("persistence §4: one tab plays a browser's test world", () => {
  it("the red team's two tabs: the second tab on the saved world only watches, and the first tab's save stands", async () => {
    const { store } = browser(true);
    const g = await TestGame.create();
    g.join("Lock Freight", "oo", "DAL");
    // Tab A: New world, then the hub choice saves it.
    const A = await tab();
    expect(await A.claimTestLock()).toBe(true);
    open(A, g, true);
    A.persistTest(true);
    const savedA = store.get(KEY)!;
    expect(savedT(store)).toBe(g.w.t);
    // Tab B opened on the same world (Continue): the lock is A's, so B only watches.
    const B = await tab();
    expect(await B.claimTestLock()).toBe(false);
    const gb = await TestGame.restore(JSON.parse(savedA) as TestLog);
    open(B, gb, false, JSON.parse(savedA) as TestLog);
    // B runs its copy 32 hours on (the diary's Day speed for 8 s) and tries an order: no save, no order.
    for (let h = 0; h < 32; h++) gb.stepHour();
    B.persistTest(true);
    expect(store.get(KEY)).toBe(savedA);
    const refused = await B.order({ type: "set_auto_staff", on: true }, "");
    expect(refused).toEqual({ ok: false, reason: PENDING.testWatching });
    expect(gb.log.acts).toHaveLength(0);
    // A plays on: its order and its hours save, whatever B did.
    expect((await A.order({ type: "set_auto_staff", on: true }, "")).ok).toBe(true);
    for (let h = 0; h < 2; h++) g.stepHour();
    A.persistTest(true);
    const now = JSON.parse(store.get(KEY)!) as TestLog;
    expect(now.t).toBe(g.w.t);
    expect(now.acts).toHaveLength(1);
    // A's lock is held for its life: its next Continue or New world keeps it.
    expect(await A.claimTestLock()).toBe(true);
  }, 120_000);

  it("without Web Locks: a key this tab didn't last write means another tab plays; this one stops saving and says so", async () => {
    const { store } = browser(false);
    const g = await TestGame.create();
    g.join("Fallback Freight", "oo", "DAL");
    const A = await tab();
    expect(await A.claimTestLock()).toBe(true); // no locks to take: the check before each write guards instead
    // A new world replaces whatever the key held, whole.
    store.set(KEY, JSON.stringify({ ...g.log, t: 60 }));
    open(A, g, true);
    A.persistTest(true);
    expect(savedT(store)).toBe(g.w.t);
    // Its own last write in the key: it saves on.
    g.stepHour();
    A.persistTest(true);
    expect(savedT(store)).toBe(g.w.t);
    // Another tab writes its own world over the key: A stops, says so, and leaves that tab's save alone.
    const other = JSON.stringify({ ...g.log, t: g.w.t + 32 * 60 });
    store.set(KEY, other);
    g.stepHour();
    A.persistTest(true);
    expect(store.get(KEY)).toBe(other);
    expect(A.S.testWatching).toBe(true);
    expect(A.S.toast?.text).toBe(PENDING.testWatching);
    g.stepHour();
    A.persistTest(true);
    expect(store.get(KEY)).toBe(other);
    // A restored tab checks against the log it restored from: the key unchanged since, it saves its next hour.
    const C = await tab();
    open(C, g, await C.claimTestLock(), JSON.parse(other) as TestLog);
    C.persistTest(true);
    expect(store.get(KEY)).toBe(other); // nothing new since the restore
    g.stepHour();
    C.persistTest(true);
    expect(savedT(store)).toBe(g.w.t);
    expect(C.S.testWatching).toBe(false);
  }, 120_000);
});

describe("persistence §6: the test page's hour and its restore", () => {
  it("a screen's handler that throws doesn't stop the engine's hour: the world matches its replay", async () => {
    const g = await TestGame.create();
    g.join("Throw Freight", "oo", "DAL");
    let thrown = 0;
    g.onEvent(() => {
      thrown++;
      throw new Error("a card's text on an odd state");
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const t0 = g.w.t;
    for (let h = 0; h < 24; h++) g.stepHour();
    expect(thrown).toBeGreaterThan(0);
    expect(err).toHaveBeenCalledTimes(thrown);
    expect(g.w.t).toBe(t0 + 24 * 60);
    expect(g.log.t).toBe(g.w.t);
    const r = await TestGame.restore(JSON.parse(JSON.stringify(g.log)) as TestLog);
    expect(shape(r)).toBe(shape(g));
  }, 120_000);

  it("a restore keeps an order its replay refuses, counts it, and a restore of that save is the same world", async () => {
    const g = await TestGame.create();
    g.join("Refused Freight", "oo", "DAL");
    g.stepHour();
    expect(g.act({ type: "set_auto_staff", on: true }).ok).toBe(true);
    g.stepHour();
    const log = JSON.parse(JSON.stringify(g.log)) as TestLog;
    // An order the replay refuses (written in by hand: a loan this company never had), then a later accepted one.
    log.acts.push([g.w.t, { type: "repay_loan", loanId: 999_999 }]);
    g.stepHour();
    expect(g.act({ type: "set_auto_staff", on: false }).ok).toBe(true);
    log.acts.push(g.log.acts.at(-1)!);
    g.stepHour();
    log.t = g.w.t;
    const r = await TestGame.restore(log);
    expect(r.refusedOnRestore).toBe(1);
    expect(r.log.acts).toEqual(log.acts);
    expect(shape(r)).toBe(shape(g));
    const again = await TestGame.restore(JSON.parse(JSON.stringify(r.log)) as TestLog);
    expect(again.refusedOnRestore).toBe(1);
    expect(again.log.acts).toEqual(log.acts);
    expect(shape(again)).toBe(shape(g));
  }, 180_000);

  it("a world the engine broke (main.tsx's catch marks it) saves nothing more and takes no orders", async () => {
    const { store } = browser(true);
    const g = await TestGame.create();
    g.join("Broken Freight", "oo", "DAL");
    const A = await tab();
    open(A, g, await A.claimTestLock());
    A.persistTest(true);
    const before = store.get(KEY);
    g.stepHour();
    g.broken = { at: g.w.t, reason: "test" };
    A.persistTest(true);
    expect(store.get(KEY)).toBe(before);
    expect(await A.order({ type: "set_auto_staff", on: true }, "")).toEqual({ ok: false, reason: PENDING.testBroken });
    A.act({ type: "set_auto_staff", on: true }, "");
    expect(A.S.toast?.text).toBe(PENDING.testBroken);
    expect(g.log.acts).toHaveLength(0);
  }, 120_000);
});
