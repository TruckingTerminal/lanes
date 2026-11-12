import "./seed.js";
import { describe, expect, it } from "vitest";
import { homeEdge, placeOfHub, type Load } from "@lanes/engine";
import { lostWhy } from "../src/board.js";
import { PENDING } from "../src/copy-pending.js";
import { PENDING_RULES } from "../src/copy-pending-rules.js";
import { firstTruckLine } from "../src/figures.js";
import { TestGame } from "../src/game.js";

/** Client batch 8c: the director's calls on QA's 0.24.1 replay (director-qa-0241-2026-11-12.md), items 68 to 70. */

describe("client batch 8c", () => {
  it("item 68: the night-in-town setting says when it applies", () => {
    expect(PENDING_RULES.nightStopLabel).toBe("Stops for the night in a town when a leg would begin past your hours. A long leg can still end on the shoulder.");
  });

  it("item 69: a lost bid names what beat it, from the clearing's own terms, and nothing when the winner bid lower", async () => {
    const g = await TestGame.create();
    const me = g.join("Lost Freight", "oo", "LAX")!;
    const w = g.w;
    const mine = w.trucksByCompany.get(me.id)![0]!;
    const them = w.companies.find((x) => x.id !== me.id && x.role === "carrier" && (w.trucksByCompany.get(x.id) ?? []).length > 0)!;
    const theirs = w.trucksByCompany.get(them.id)![0]!;
    const load = [...w.loads.values()].find((l) => l.status === "open")! as Load;
    // Won by them at 3.60 against the player's 3.50; everything else level to start.
    load.carrierId = them.id;
    load.truckId = theirs.id;
    load.clearedRate = 3.6;
    const level = () => {
      them.reputation = me.reputation;
      them.homeHub = me.homeHub;
      theirs.place = mine.place;
    };
    const bid = { truckId: mine.id, rate: 3.5 };
    level();
    them.reputation = me.reputation + 0.3;
    expect(lostWhy(w, load, bid)).toBe("record");
    level();
    theirs.place = load.originPlace;
    mine.place = placeOfHub(w.net.hubs.findIndex((_, i) => i !== load.origin && i !== mine.hub));
    expect(lostWhy(w, load, bid)).toBe("nearer");
    level();
    const far = w.net.hubs.findIndex((_, i) => homeEdge(w, { ...me, homeHub: i }, load.origin) === 0);
    me.homeHub = far;
    them.homeHub = load.origin;
    if (homeEdge(w, them, load.origin) > 0) expect(lostWhy(w, load, bid)).toBe("home");
    // The winner bid the same or lower: the rate says it all.
    expect(lostWhy(w, load, { ...bid, rate: 3.6 })).toBeNull();
    // Nothing behind a higher bid: no reason given (and logged as the engine bug it would be).
    level();
    me.homeHub = them.homeHub;
    expect(lostWhy(w, load, bid)).toBeNull();
    expect(PENDING.lostWhy("record")).toBe("The shipper chose a carrier with a longer safety record.");
  }, 60_000);

  it("item 70: 'Not yet' says where the player stands and what each load does, with a progress share and the watch", async () => {
    const g = await TestGame.create();
    const c = g.join("Sound Freight", "oo", "LAX")!;
    const w = g.w;
    const today = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
    // Thirty days in, ten loads that kept about 210 FD each.
    c.createdDay = today - 30;
    c.delivered = 10;
    c.operating.revenueFd = 10 * 1_210;
    c.operating.costFd = 10 * 1_000;
    const f = firstTruckLine(w, c)!;
    if (f.met || f.open === null) return; // a world where the starter can already buy has nothing to show here
    expect(f.verdict).toMatch(/^Not yet: a sound truck is about \d+ loads? away at your recent average(, around [a-z\d ]+)?\. Each load adds about 210 FD toward it\. You're \d+% of the way\.$/);
    expect(f.progress).not.toBeNull();
    expect(f.progress!).toBeGreaterThanOrEqual(0);
    expect(f.progress!).toBeLessThan(1);
    expect(f.verdict).toContain(`You're ${Math.floor(f.progress! * 100)}% of the way.`);
    expect(f.watch).toBe(PENDING.soundWatch);
    expect(f.pick).not.toBeNull();
    // Never a word about buying FD to close the gap.
    expect([f.verdict, f.watch, ...f.why].join(" ")).not.toMatch(/buy FD|buying FD|FD for \$|top up/i);
    expect([PENDING.soundQuarter(1), PENDING.soundQuarter(2), PENDING.soundQuarter(3)]).toEqual(["A quarter of the way to your truck.", "Halfway to your truck.", "Three quarters of the way to your truck."]);
  }, 60_000);
});
