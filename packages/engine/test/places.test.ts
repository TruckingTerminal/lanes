import { describe, expect, it } from "vitest";
import { economyConfig as cfg } from "@lanes/config";
import { buildNetwork, COMMODITIES, hubs, marketMix, PLACE_OF_HUB, PLACE_PRODUCTION, placeMiles, placeRoute } from "@lanes/data";

const net = buildNetwork(hubs, cfg);

describe("places", () => {
  it("covers the country: hundreds of places, every market with several, every hub its own place", () => {
    expect(net.places.length).toBeGreaterThan(400);
    for (let m = 0; m < hubs.length; m++) expect(net.economy.byMarket[m]!.length).toBeGreaterThanOrEqual(2);
    for (let h = 0; h < hubs.length; h++) {
      const p = net.places[PLACE_OF_HUB[h]!]!;
      expect(p.market).toBe(h);
      expect(placeMiles(net, PLACE_OF_HUB[h]!, PLACE_OF_HUB[h]!)).toBe(0);
    }
    const states = new Set(net.places.map((p) => p.state));
    for (const s of ["MT", "WY", "ID", "ND", "SD", "NV", "NM", "VT", "ME"]) expect(states.has(s)).toBe(true);
  });

  it("routes every place to its market over the roads, within a sane distance", () => {
    let worst = { mi: 0, name: "" };
    for (let p = 0; p < net.places.length; p++) {
      const place = net.places[p]!;
      const hubPlace = PLACE_OF_HUB[place.market]!;
      if (p === hubPlace) continue;
      const r = placeRoute(net, p, hubPlace);
      expect(r, `${place.id} has no road route to ${hubs[place.market]!.id}`).not.toBeNull();
      if (r!.miles > worst.mi) worst = { mi: r!.miles, name: place.id };
    }
    expect(worst.mi, `${worst.name} is ${worst.mi.toFixed(0)} mi from its market`).toBeLessThan(750); // north-east Montana trades on Fargo's board
  });

  it("matches real driving distances between places", () => {
    const idx = (id: string) => net.places.findIndex((p) => p.id === id);
    const mi = (a: string, b: string) => placeMiles(net, idx(a), idx(b));
    expect(mi("MT-MilesCity", "MT-Billings")).toBeGreaterThan(130);
    expect(mi("MT-MilesCity", "MT-Billings")).toBeLessThan(165);
    expect(mi("WY-Gillette", "CO-Denver")).toBeGreaterThan(420);
    expect(mi("WY-Gillette", "CO-Denver")).toBeLessThan(500);
    expect(mi("FL-Homestead", "NY-NewYork")).toBeGreaterThan(1_250);
    expect(mi("FL-Homestead", "NY-NewYork")).toBeLessThan(1_400);
  });

  it("gives every market something to ship in every trailer, with the seasons where they belong", () => {
    for (let m = 0; m < hubs.length; m++) {
      for (const eq of ["van", "reefer", "flatbed"] as const) {
        expect(marketMix(net.economy, m, eq, 3).length, `${hubs[m]!.id} ${eq}`).toBeGreaterThan(0);
      }
    }
    const mia = hubs.findIndex((h) => h.id === "MIA");
    const produce = COMMODITIES.findIndex((c) => c.id === "produce");
    const jan = marketMix(net.economy, mia, "reefer", 0).find((x) => x.commodity === produce)!.weight;
    const jul = marketMix(net.economy, mia, "reefer", 6).find((x) => x.commodity === produce)!.weight;
    expect(jan).toBeGreaterThan(jul * 4);
  });

  it("names only places that exist in its production overrides (listing the rest for the next data pass)", () => {
    const ids = new Set(net.places.map((p) => p.id));
    const unknown = Object.keys(PLACE_PRODUCTION).filter((id) => !ids.has(id));
    if (unknown.length) console.log("unknown place ids in PLACE_PRODUCTION:", unknown.join(", "));
    expect(unknown).toEqual([]);
  });
});
