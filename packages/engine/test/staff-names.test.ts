import { describe, expect, it } from "vitest";
import { economyConfig } from "@lanes/config";
import { buildNetwork, hubs, neutralFeeds } from "@lanes/data";
import { createWorld, newStaff } from "../src/index.js";

describe("staff names", () => {
  it("gives every person a first name that matches their look, and draws the same as before from the labor stream", () => {
    const net = buildNetwork(hubs, economyConfig);
    const w = createWorld({ cfg: economyConfig, net, feeds: neutralFeeds, seed: 7 });
    const twin = createWorld({ cfg: economyConfig, net, feeds: neutralFeeds, seed: 7 });
    const looks = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const s = newStaff(w, "driver", 0.5, 0.6);
      w.staff.push(s);
      looks.add(s.look);
      const t = newStaff(twin, "driver", 0.5, 0.6);
      twin.staff.push(t);
      expect(t.name).toBe(s.name);
      expect(t.look).toBe(s.look);
    }
    // A kind painted in one look only (every kind past drivers today) takes names from that look's half.
    for (let i = 0; i < 60; i++) {
      const d = newStaff(w, i % 2 ? "dispatcher" : "opsManager", 0.5, 0.6);
      w.staff.push(d);
      expect(d.look).toBe("m");
    }
    // Both looks turn up, and one first name never carries both.
    expect(looks).toEqual(new Set(["m", "f"]));
    const byFirst = new Map<string, string>();
    for (const s of w.staff) {
      const first = s.name.split(" ")[0]!;
      expect(byFirst.get(first) ?? s.look).toBe(s.look);
      byFirst.set(first, s.look);
    }
  });
});
