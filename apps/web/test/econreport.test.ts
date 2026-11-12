import "./seed.js";
import { describe, expect, it } from "vitest";
import { REPORT } from "../src/copy-report.js";
import { econReport } from "../src/econreport.js";
import { TestGame } from "../src/game.js";

/** "The freight economy" on Intel (econreport.ts): the director's order, aggregates only, frozen at the close. */
describe("the public monthly report", () => {
  it("is out once a month closes, in the director's order, with no company named", async () => {
    const g = await TestGame.create();
    const c = g.join("Report Freight", "oo", "LAX")!;
    const w = g.w;
    while ((w.econ?.months.length ?? 0) < 1) g.stepHour();
    const r = econReport(w, "van")!;
    expect(r.title).toMatch(/^The freight economy · [A-Z][a-z]+, Year 1$/);
    const titles = r.sections.map((s) => s.title);
    const order = [REPORT.secFreight, REPORT.secTrucks, REPORT.secCompanies, REPORT.secWork, REPORT.secMoney, REPORT.secWealth, REPORT.secAnnounced];
    expect(titles).toEqual(order.filter((t) => titles.includes(t)));
    expect(titles[0]).toBe(REPORT.secFreight);
    expect(titles.at(-1)).toBe(REPORT.secAnnounced);
    // Aggregates only: no company's name anywhere in it.
    const text = JSON.stringify(r);
    for (const x of w.companies) expect(text.includes(x.name)).toBe(false);
    expect(text.includes(c.name)).toBe(false);
    // The first month has no month before it: the comparison columns are empty.
    expect(r.sections[0]!.rows.every((row) => row.prior === null && row.year === null)).toBe(true);
    // Frozen: a later hour changes nothing in the closed month's report.
    for (let h = 0; h < 24; h++) g.stepHour();
    expect(JSON.stringify(econReport(w, "van", w.econ!.months[0]!.index))).toBe(text);
  }, 300_000);
});
