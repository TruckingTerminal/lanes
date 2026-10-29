import { describe, expect, it } from "vitest";
import { economyConfig as cfg } from "@lanes/config";
import { buildNetwork, greatCircleMiles, hubs, weighStations, PLACE_OF_HUB } from "@lanes/data";
import { createWorld, hubToll, stationsOnLeg } from "@lanes/engine";
import { neutralFeeds } from "@lanes/data";

const net = buildNetwork(hubs, cfg);
const at = (id: string) => hubs.findIndex((h) => h.id === id);

describe("the road network", () => {
  it("connects every hub to every other by road, at a sane multiple of the straight line", () => {
    for (let i = 0; i < hubs.length; i++) {
      for (let j = 0; j < hubs.length; j++) {
        if (i === j) continue;
        const r = net.routes[i * hubs.length + j]!;
        expect(r, `${hubs[i]!.id}→${hubs[j]!.id}`).not.toBeNull();
        const gc = greatCircleMiles(hubs[i]!, hubs[j]!);
        // A road can run a little shorter than the straight line between city centres when both hubs attach toward each other.
        expect(r.miles).toBeGreaterThanOrEqual(Math.max(gc * 0.9, gc - 40));
        expect(r.miles).toBeLessThanOrEqual(gc * 1.9 + 40); // short pairs can detour to reach a road
        expect(r.hours).toBeGreaterThan(0);
      }
    }
  });

  it("charges tolls on toll roads and none elsewhere", () => {
    const chiEwr = net.routes[at("CHI") * hubs.length + at("EWR")]!;
    expect(chiEwr.tollFd).toBeGreaterThan(50); // the Indiana and Ohio toll roads
    const dalHou = net.routes[at("DAL") * hubs.length + at("HOU")]!;
    expect(dalHou.tollFd).toBe(0);
    for (const lane of net.lanes) expect(lane.tollFd).toBeGreaterThanOrEqual(0);
  });

  it("puts weigh stations on the roads a route actually takes", () => {
    const w = createWorld({ cfg, net, feeds: neutralFeeds, seed: 1 });
    const ids = stationsOnLeg(w, PLACE_OF_HUB[at("MIA")]!, PLACE_OF_HUB[at("ATL")]!).map((s) => weighStations[s.station]!.id);
    // Up I-95 and across on I-16, or up I-75: either way there are scales on the road, and the same ones both ways.
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids.some((id) => id === "FL-YUL" || id === "GA-VAL")).toBe(true);
    const back = stationsOnLeg(w, PLACE_OF_HUB[at("ATL")]!, PLACE_OF_HUB[at("MIA")]!).map((s) => weighStations[s.station]!.id);
    expect([...back].sort()).toEqual([...ids].sort());
    expect(hubToll(w, at("CHI"), at("EWR"))).toBe(net.routes[at("CHI") * hubs.length + at("EWR")]!.tollFd);
  });

  it("builds the same routes every time", () => {
    const again = buildNetwork(hubs, cfg);
    for (let k = 0; k < net.routes.length; k++) {
      const a = net.routes[k];
      const b = again.routes[k];
      if (!a || !b) continue;
      expect(b.miles).toBe(a.miles);
      expect(b.hours).toBe(a.hours);
      expect(Array.from(b.edges)).toEqual(Array.from(a.edges));
    }
  });
});
