import "./seed.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { companyAccount, fine, hookedTrailer, truckValue, type Load } from "@lanes/engine";
import { bidRange } from "../src/board.js";
import { moneyEvents } from "../src/books.js";
import { cashDipAhead } from "../src/figures.js";
import { tradeIn } from "../src/confirmspecs.js";
import { FIXES } from "../src/copy-fixes.js";
import { fdFull, pct } from "../src/format.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { pickWindow, type KitJson } from "../src/menuart.js";

/**
 * The producer's client fixes of 2026-11-15: the trade-in's Confirm (UX next-screens §3.1) and a night painting left
 * ungraded at night (UX next-screens §7, the cells the art role flags `atNight`).
 */
describe("the trade-in asks first", () => {
  it("says the dealership, its town, the offer, what goes with the truck, and that it can't be undone", async () => {
    const g = await TestGame.create(undefined, undefined, 41, GAME_CONFIG);
    const c = g.join("Trade Freight", "oo", "CMH")!;
    const w = g.w;
    const t = w.trucksByCompany.get(c.id)![0]!;
    const lines = tradeIn(w, t, 2, "Dallas Truck Center", "Dallas", 48_200);
    const tr = hookedTrailer(w, t);
    expect(lines.does).toContain("Trade Truck 2 in to Dallas Truck Center at Dallas for 48,200 FD.");
    if (tr) expect(lines.does).toMatch(tr.lease === "owned" ? /goes with it\./ : /goes back to the lessor\./);
    expect(lines.risk).toContain("This can't be undone.");
    expect(lines.risk).toContain(`worth ${fdFull(truckValue(w, t))} FD, and the dealership pays ${pct(w.cfg.businesses.kinds.dealership.tradeInShare)} of that.`);
    expect(FIXES.tradeInDone(2, "48,200", "Dallas Truck Center")).toBe("Truck 2 traded in to Dallas Truck Center for 48,200 FD.");
  }, 120_000);

  it("the Yard's Trade in button opens the Confirm; nothing trades in on the tap itself", () => {
    const src = readFileSync(join(__dirname, "..", "src", "ui", "panels", "Yard.tsx"), "utf8");
    const at = src.indexOf('type: "trade_in"');
    expect(at).toBeGreaterThan(0);
    // The act sits inside the Confirm's run, after confirmAct opens.
    const before = src.slice(Math.max(0, at - 700), at);
    expect(before).toContain("confirmAct(");
    expect(before).toContain("run: () => act(");
    expect(src).not.toMatch(/onClick=\{\(\) => act\(\{ type: "trade_in"/);
  });
});

describe("a night painting isn't graded again at night (atNight)", () => {
  const cell = (atNight?: boolean) => ({ x: 0, y: 0, w: 256, h: 144, focalX: 0.5, focalY: 0.5, avg: "#123", ...(atNight ? { atNight: true } : {}) });
  const k = { windows: { screens: { image: "windows/screens.png", w: 1024, h: 1024, cells: { "bg-board-s2": cell(true), plain: cell() } } }, loops: {} } as unknown as KitJson;
  const all = () => true;

  it("a flagged cell skips the hour grade at dusk and night, and keeps it by day", () => {
    expect(pickWindow(k, "bg-board-s2", "night", "summer", undefined, all)).toMatchObject({ key: "screens:bg-board-s2", grade: false });
    expect(pickWindow(k, "bg-board-s2", "dusk", "summer", undefined, all)).toMatchObject({ key: "screens:bg-board-s2", grade: false });
    expect(pickWindow(k, "bg-board-s2", "midday", "summer", undefined, all)).toMatchObject({ key: "screens:bg-board-s2", grade: true });
  });

  it("an unflagged cell is graded at every hour, as before", () => {
    for (const band of ["night", "dusk", "midday"] as const) expect(pickWindow(k, "plain", band, "summer", undefined, all)).toMatchObject({ key: "screens:plain", grade: true });
  });
});

const src = (...p: string[]) => readFileSync(join(__dirname, "..", "src", ...p), "utf8");

describe("QA's M4 and the player's long runs (client)", () => {
  it("M4.5: no bid range when the break-even is at or over the ceiling, and the words say no bid pays", () => {
    const l = { ceiling: 2.52 } as unknown as Load;
    const [lo, hi] = bidRange(null as never, l, 2.6);
    expect(hi - lo).toBeLessThan(0.005);
    expect(FIXES.noBidPays("2.60", "2.52")).toBe("No bid pays here: your break-even, 2.60/mi, is at or over the ceiling, 2.52/mi.");
    expect(src("ui", "panels", "Board.tsx")).toContain("hi - lo < 0.005 ? <span class=\"muted small\">{FIXES.noBidPays(");
  });

  it("M4.3 and the long runs, 5: every truck list names a truck by its own number, never its place in the list", () => {
    for (const f of [["ui", "panels", "Fleet.tsx"], ["ui", "panels", "Staff.tsx"], ["ui", "panels", "Loads.tsx"]]) {
      const text = src(...f);
      expect(text).not.toMatch(/[Tt]ruck \{(i|idx) \+ 1\}|truck \$\{(i|idx) \+ 1\}|noDriver\(idx \+ 1\)/);
    }
  });

  it("M4.6 and L6: a selected segment says so (aria-pressed, aria-sort), and the laptop table's open row reads the windows", () => {
    expect(src("ui", "panels", "Finance.tsx")).toContain('aria-pressed={!stateA && c.payTerms === id}');
    expect(src("ui", "More.tsx")).toContain("aria-pressed={S.tab === t.id}");
    expect(src("ui", "panels", "Loads.tsx")).toContain('aria-sort={sort === k ? (desc ? "descending" : "ascending") : "none"}');
    expect(src("ui", "panels", "Loads.tsx")).toContain("win ? `${WINDOWS.deliverBy} ${win.deliverBy}`");
  });

  it("the long runs, 8: a company-wide fine (the compliance review) is no truck's, and every fine kind has its cause", async () => {
    const g = await TestGame.create(undefined, undefined, 41, GAME_CONFIG);
    const c = g.join("Audit Freight", "oo", "CMH")!;
    fine(g.w, c, 24_201, `review:${c.id}`);
    const e = moneyEvents(g.w, c, 0, 0).find((x) => x.kind === "fine")!;
    expect(e.sub).toBe("review");
    expect(e.truckId).toBeNull();
    expect(FIXES.fine.review!(0, "24,201")).toBe("Compliance review fine: −24,201 FD for what the auditor found in your records.");
    for (const k of ["tracking", "defect", "review", "doublebroker"]) expect(FIXES.fine[k]).toBeDefined();
  }, 120_000);

  it("the long runs, 5: a brokerage's forecast walks its dated books: square books, no warning; short ones, the day and the low", async () => {
    const g = await TestGame.create(undefined, undefined, 41, GAME_CONFIG);
    g.join("Forecast Freight", "oo", "CMH");
    const w = g.w;
    const b = w.companies.find((x) => x.role === "broker")!;
    const day = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
    // 1,150 FD in cash, 8,629 owed to it in three days, 7,978 it owes in five (the player's books, square).
    // (Owed by it first and owed to it later is a real gap, and the forecast says so; the player's −44k was not one.)
    const acct = companyAccount(b.id);
    const have = w.ledger.balance(acct);
    if (have > 1150) w.ledger.post(w.t, acct, "sink:test", have - 1150, "test");
    else w.ledger.post(w.t, "faucet:starting_grant", acct, 1150 - have, "test");
    w.receivables = w.receivables.filter((r) => r.holder !== b.id && r.payer !== b.id);
    const carrier = w.companies.find((x) => x.role === "carrier")!;
    w.receivables.push({ id: 900_001, payer: 0, faucet: "faucet:npc_shipper", payeeId: b.id, amountFd: 8_629, dueDay: day + 3, holder: b.id });
    w.receivables.push({ id: 900_002, payer: b.id, payeeId: carrier.id, amountFd: 7_978, dueDay: day + 5, holder: carrier.id });
    expect(cashDipAhead(w, b)).toBeNull();
    // It owes 20,000 on day 5 and 5,000 more comes in on day 9: under from day 5, as low as 10,221, until day 9.
    w.receivables.find((r) => r.id === 900_002)!.amountFd = 20_000;
    w.receivables.push({ id: 900_003, payer: 0, faucet: "faucet:npc_shipper", payeeId: b.id, amountFd: 5_000, dueDay: day + 9, holder: b.id });
    const dip = cashDipAhead(w, b)!;
    expect(dip.day).toBe(day + 5);
    expect(dip.lowFd).toBeCloseTo(20_000 - 1150 - 8_629, 6);
    expect(dip.landsDay).toBe(day + 9);
  }, 120_000);

  it("the words for the net-30 toast, the loans, the lender, the hires and the stake", () => {
    expect(FIXES.paidToastDue("Columbus", "Indianapolis", "273", "Jun 30")).toBe("Delivered · Columbus → Indianapolis · 273 FD yours, due Jun 30");
    expect(FIXES.loanArrears(2, 1, 1)).toBe("Truck 2's loan: 1 missed payment. One more and the lender takes the truck.");
    expect(FIXES.repoSeized(2, 2)).toContain("the lender took Truck 2");
    expect(FIXES.autoHired("Chidi Okafor", "maintenance manager", "1,485")).toBe("Auto-staff hired Chidi Okafor, maintenance manager, at 1,485 FD a week.");
    expect(FIXES.underStake("1,200", "75,000", "73,800", "Aug 6", true)).toContain("1,200 FD short");
  });
});
