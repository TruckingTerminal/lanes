import "./seed.js";
import { describe, expect, it } from "vitest";
import { dayOf, monthlyEconomy, noteBrokerTender, openEntrant } from "@lanes/engine";
import { newBrokerLine } from "../src/board.js";
import { FIXES } from "../src/copy-fixes.js";
import { REPORT } from "../src/copy-report.js";
import { econReport } from "../src/econreport.js";
import { shortDate } from "../src/format.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";

/**
 * The market's renewal on the page (brokerRisk.entry, brokerRisk.windUpDormant, insolvency.windUpNpcFleets; the director's §3
 * and §16): "New broker · since <date>" on an entrant's loads and card while it's new, and the monthly report's counts.
 */
const ON = {
  ...GAME_CONFIG,
  brokerRisk: { ...GAME_CONFIG.brokerRisk, windUpDormant: true, entry: { ...GAME_CONFIG.brokerRisk.entry, enabled: true } },
  insolvency: { ...GAME_CONFIG.insolvency, windUpNpcFleets: true },
};
const spec = { name: "Fresh Lane Brokers", homeHubId: "DAL", strategy: "broker:greedy", orders: [{ kind: "broker" as const, marginPct: 0.12, maxOpenLoads: 40 }], vetting: 1 as const };

describe("the market's renewal on the page", () => {
  it("an entrant says it's new, with its authority's date, for newLabelDays; an opening broker never does", async () => {
    const g = await TestGame.create(undefined, undefined, 41, ON);
    const w = g.w;
    noteBrokerTender(w);
    w.brokerEntry!.entrants.push({ founded: 0, opens: 0 });
    const c = openEntrant(w, w.brokerEntry!.entrants[0]!, spec);
    expect(newBrokerLine(w, c)).toBe(FIXES.newBroker(shortDate(dayOf(w.t, w.cfg))));
    expect(FIXES.newBroker("Mar 3")).toBe("New broker · since Mar 3");
    const opening = w.companies.find((x) => x.role === "broker" && x.entrant === undefined)!;
    expect(newBrokerLine(w, opening)).toBeNull();
    expect(newBrokerLine(w, null)).toBeNull();
    w.t += w.cfg.brokerRisk.entry.newLabelDays * w.cfg.time.gameMinutesPerDay;
    expect(newBrokerLine(w, c)).toBeNull();
  }, 120_000);

  it("the monthly report counts brokerages founded, opened and wound up, and fleets wound up; off, it has no such rows", async () => {
    const labels = [FIXES.reportFounded, FIXES.reportOpened, FIXES.reportBrokersWoundUp, FIXES.reportFleetsWoundUp];
    const on = await TestGame.create(undefined, undefined, 41, ON);
    const w = on.w;
    const day = dayOf(w.t, w.cfg);
    noteBrokerTender(w);
    w.brokerEntry!.entrants.push({ founded: day, opens: day + 120 }, { founded: day, opens: day + 120 }, { founded: day - 200, opens: day, companyId: 1, opened: day });
    w.brokersWoundUp = [{ day, companyId: 2 }];
    w.fleetsWoundUp = [{ day, companyId: 3 }, { day, companyId: 4 }];
    monthlyEconomy(w, day);
    expect(w.econ!.months.at(-1)!.renewal).toMatchObject({ founded: 2, opened: 1, brokersWoundUp: 1, fleetsWoundUp: 2 }); // with entry on, the players' counts too (players-first §2)
    const rows = econReport(w, null)!.sections.find((s) => s.title === REPORT.secCompanies)!.rows;
    expect(labels.map((l) => rows.find((r) => r.label === l)?.now)).toEqual(["2", "1", "1", "2"]);
    // Aggregates only: no company named.
    const text = JSON.stringify(econReport(w, null));
    for (const x of w.companies) expect(text.includes(x.name)).toBe(false);

    // Off by their own keys (on in the live levers since 0.25.6).
    const OFF = { ...GAME_CONFIG, brokerRisk: { ...GAME_CONFIG.brokerRisk, windUpDormant: false, entry: { ...GAME_CONFIG.brokerRisk.entry, enabled: false } }, insolvency: { ...GAME_CONFIG.insolvency, windUpNpcFleets: false } };
    const off = await TestGame.create(undefined, undefined, 41, OFF);
    monthlyEconomy(off.w, dayOf(off.w.t, off.w.cfg));
    expect(off.w.econ!.months.at(-1)!.renewal).toBeUndefined();
    const offRows = econReport(off.w, null)!.sections.flatMap((s) => s.rows.map((r) => r.label));
    for (const l of labels) expect(offRows).not.toContain(l);
  }, 120_000);
});
