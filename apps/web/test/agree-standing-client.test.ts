import "./seed.js";
import { describe, expect, it } from "vitest";
import { standingLoad, type Load } from "@lanes/engine";
import { boardRows } from "../src/board.js";
import { STANDING_UX } from "../src/copy-standing.js";
import { GAME_CONFIG, TestGame } from "../src/game.js";
import { aheadable, agreement, agreeShown, spoilAt } from "../src/windowsui.js";

/**
 * QA's 0.25.4 re-check at 64b33d6: the load sheet's release line lost its standing cost. The sheet found the release line
 * by place (third), and a perishable's spoil line (windows.spoilAfterDeadline, live) sits third, so the release line, fourth,
 * lost its cost and explain key while the spoil line took them. Now each line carries its kind.
 */
const any = { dest: "any", maxDh: 300, query: "" };

describe("the load sheet's agreement lines, by kind", () => {
  it("a truck booking ahead: the release line carries its standing cost and key after a spoil line; the spoil line neither", async () => {
    const g = await TestGame.create(undefined, undefined, 41, GAME_CONFIG);
    const c = g.join("Ahead Freight", "oo", "LAX")!;
    const w = g.w;
    const truck = w.trucksByCompany.get(c.id)![0]!;
    const first = boardRows(w, c, truck, any).find((x) => !x.block && x.reach?.ok)!;
    expect(g.act({ type: "book_load", truckId: truck.id, loadId: first.l.id }).ok).toBe(true);
    expect(aheadable(w, truck)).toBe(true);
    c.standingNoticed = true;
    const open = [...w.loads.values()].filter((l): l is Load => l.status === "open" && l.latestPickupT !== undefined && standingLoad(l));
    const perishable = open.find((l) => spoilAt(w, l) !== null)!;
    const dry = open.find((l) => spoilAt(w, l) === null)!;
    const cost = (l: Load) => ({
      noShow: STANDING_UX.claimCost(w.cfg.standing.hits.noShow, w.net.hubs[l.origin]!.name),
      late: STANDING_UX.claimCost(w.cfg.standing.hits.late, w.net.hubs[l.origin]!.name),
      release: STANDING_UX.claimCost(w.cfg.standing.hits.release, w.net.hubs[l.origin]!.name),
    });
    for (const l of [perishable, dry]) {
      const a = agreement(w, truck, l, l.bookNow, 1)!;
      if (spoilAt(w, l) !== null) expect(a.kinds.slice(0, 4)).toEqual(["noShow", "late", "spoil", "release"]);
      else expect(a.kinds.slice(0, 3)).toEqual(["noShow", "late", "release"]);
      expect(a.kinds).toHaveLength(a.lines.length);
      const shown = agreeShown(w, c, l, a);
      const at = (k: string) => a.kinds.indexOf(k as never);
      const k = cost(l);
      expect(shown[at("release")]).toEqual({ text: a.lines[at("release")]!.replace(/\.\s*$/, `${k.release}.`), key: "claim.lost" });
      expect(shown[at("noShow")]).toEqual({ text: a.lines[at("noShow")]!.replace(/\.\s*$/, `${k.noShow}.`), key: "claim.noShow" });
      expect(shown[at("late")]).toEqual({ text: a.lines[at("late")]!.replace(/\.\s*$/, `${k.late}.`), key: "claim.late" });
      if (at("spoil") >= 0) expect(shown[at("spoil")]).toEqual({ text: a.lines[at("spoil")]!, key: null });
    }
    // Standing not yet shown: the lines as written, the keys kept.
    delete c.standingNoticed;
    const a = agreement(w, truck, perishable, perishable.bookNow, 1)!;
    expect(agreeShown(w, c, perishable, a).map((x) => x.text)).toEqual(a.lines);
  }, 120_000);
});
