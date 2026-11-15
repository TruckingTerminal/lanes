import "./seed.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mayTake, placeMiles, vettingBlock, type Load } from "@lanes/engine";
import { FIXES } from "../src/copy-fixes.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { claimsAt, currentRelease, releaseCurrentCard, urgentFrom } from "../src/windowsui.js";

/**
 * The director's sprint §1 on the page (windows.releaseCurrent): the release on the truck card's Now line, its Confirm, and
 * the claim the Confirm names as the engine takes it.
 */
const withWindows = (o: Record<string, unknown>) => ({ ...GAME_CONFIG, windows: { ...GAME_CONFIG.windows, ...o } });

async function heading(cfg: typeof GAME_CONFIG) {
  const g = await TestGame.create(undefined, undefined, 41, cfg);
  const c = g.join("Release Freight", "oo", "CMH")!;
  const w = g.w;
  const t = w.trucksByCompany.get(c.id)![0]!;
  const ok = (l: Load) => l.status === "open" && l.equipment === t.trailer && l.hot === 0 && l.contractId === 0 && !l.hold && mayTake(w, c, l) && vettingBlock(w, c, l) === null && placeMiles(w, t.place, l.originPlace) > 60 && placeMiles(w, t.place, l.originPlace) < 300;
  const l = [...w.loads.values()].find(ok);
  return { g, w, c, t, l };
}

describe("releasing the current load on the page (windows.releaseCurrent)", () => {
  it("off, nothing shows; on, a truck on the way to its pickup shows the release at today's price, where it stops and what it sinks", async () => {
    const off = await heading(withWindows({ releaseCurrent: false }));
    if (off.l) {
      expect(off.g.act({ type: "book_load", truckId: off.t.id, loadId: off.l.id }).ok).toBe(true);
      expect(currentRelease(off.w, off.t)).toBeNull();
    }
    const { g, w, c, t, l } = await heading(withWindows({ releaseCurrent: true }));
    expect(l).toBeDefined();
    expect(g.act({ type: "book_load", truckId: t.id, loadId: l!.id }).ok).toBe(true);
    expect(t.status).toBe("toPickup");
    t.legMiles = t.remainingMi;
    t.emptyMi = t.remainingMi / 2;
    t.remainingMi /= 2;
    const x = currentRelease(w, t)!;
    expect(x.load.id).toBe(l!.id);
    // At today's share: the early one until the load's last rounds, the urgent one in them.
    const cl = claimsAt(w, l!, l!.clearedRate);
    expect(x.priceFd).toBeCloseTo(w.t < urgentFrom(w, l!) ? cl.releaseEarlyFd : cl.releaseUrgentFd, 6);
    expect(x.sunkMi).toBeCloseTo(t.emptyMi, 6);
    const card = releaseCurrentCard(w, c, x, x.priceFd, 1);
    expect(card.does).toBe(FIXES.releaseCurrentDoes(w.net.places[l!.originPlace]!.name, w.net.places[l!.destPlace]!.name, 1, x.town, Math.round(x.sunkMi).toLocaleString("en-US")));
    expect(card.risk).toBe(FIXES.releaseCurrentRisk);
    // Claims in full (the live levers since 0.25.2): the claim named in full, and the release on past the cash.
    expect(card.costFd).toBe(Math.round(x.priceFd));
    expect(card.intoDebt).toBe(FIXES.releaseIntoDebt);
  }, 120_000);

  it("the truck card shows the Now line's release above the next load's", () => {
    const src = readFileSync(join(__dirname, "..", "src", "ui", "panels", "Fleet.tsx"), "utf8");
    expect(src).toContain("<CurrentLines t={t} />\n      <WindowsLines t={t} />");
    expect(src).toContain('act({ type: "release_load", loadId: l.id }, WINDOWS.released)');
  });
});
