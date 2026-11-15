import "./seed.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FIXES } from "../src/copy-fixes.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { S, truckWords } from "../src/state.js";

/** QA's full 0.25.2 replay (qa-0252-2026-11-15.md), fails 2 to 5, folded into the release Confirm's patch. */
const src = (...p: string[]) => readFileSync(join(__dirname, "..", "src", ...p), "utf8");

describe("QA's 0.25.2 replay, fails 2 to 5", () => {
  it("2: the repossession sheet reads the engine's mark, so a truck that covered its loan (\"repaid\") is said too", () => {
    const hero = src("ui", "HeroMoment.tsx");
    expect(hero).toContain('now.set(`p${l.id}`, l.seized ? "seized" : l.status)');
    expect(hero).toContain('was !== "seized" && l.seized === true && t');
  });

  it("3: auto-staff's hire of a driver says the per-mile rate; a salaried hire keeps the weekly wage", () => {
    expect(FIXES.autoHiredPerMile("Diego Silva", "driver", "0.61")).toBe("Auto-staff hired Diego Silva, driver, at 0.61 FD a mile.");
    expect(FIXES.autoHired("Chidi Okafor", "maintenance manager", "1,485")).toBe("Auto-staff hired Chidi Okafor, maintenance manager, at 1,485 FD a week.");
    expect(src("ui", "HeroMoment.tsx")).toContain('s.kind === "driver" ? FIXES.autoHiredPerMile(s.name, kind, s.pay.toFixed(2))');
  });

  it("4: the laptop table's row says no bid pays, as the sheet does, instead of a one-cent range", () => {
    expect(src("ui", "panels", "Loads.tsx")).toContain('hi - lo < 0.005 ? <span class="muted small">{FIXES.noBidPays(r.be.toFixed(2), hi.toFixed(2))}</span>');
  });

  it("5: the authority record and its pill name a truck by the player's number, not the engine's id", async () => {
    const g = await TestGame.create(undefined, undefined, 41, GAME_CONFIG);
    const c = g.join("Record Freight", "oo", "CMH")!;
    const t = g.w.trucksByCompany.get(c.id)![0]!;
    S.game = g as never;
    try {
      expect(t.id).toBeGreaterThan(1);
      expect(truckWords(`Truck ${t.id} was in a fatal crash, at fault (speeding).`)).toBe("Truck 1 was in a fatal crash, at fault (speeding).");
      expect(truckWords("Truck 999999 was in a crash.")).toBe("Truck 999999 was in a crash.");
    } finally {
      S.game = null;
    }
    expect(src("ui", "panels", "Company.tsx")).toContain("{dateLabel(r.day)}: {truckWords(r.text)}");
    expect(src("ui", "TopBar.tsx")).toContain("FIXES.authorityWhy(authorityLast(c))");
  }, 120_000);
});
