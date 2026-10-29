import { describe, expect, it } from "vitest";
import { economyConfig as cfg } from "@lanes/config";
import { buildNetwork, COMMODITIES, greatCircleMiles, hubs, marketMix, PLACE_OF_HUB, PLACE_PRODUCTION, placeMiles, placeRoute } from "@lanes/data";

const net = buildNetwork(hubs, cfg);
const idx = (id: string) => {
  const i = net.places.findIndex((p) => p.id === id);
  if (i < 0) throw new Error(`no place ${id}`);
  return i;
};
const mi = (a: string, b: string) => placeMiles(net, idx(a), idx(b));

describe("places", () => {
  it("covers the country: thousands of places, every market with many, every hub its own place", () => {
    expect(net.places.length).toBeGreaterThan(4_000);
    for (let m = 0; m < hubs.length; m++) expect(net.economy.byMarket[m]!.length, hubs[m]!.id).toBeGreaterThanOrEqual(10);
    for (let h = 0; h < hubs.length; h++) {
      const p = net.places[PLACE_OF_HUB[h]!]!;
      expect(p.market).toBe(h);
      expect(placeMiles(net, PLACE_OF_HUB[h]!, PLACE_OF_HUB[h]!)).toBe(0);
    }
    const byState = new Map<string, number>();
    for (const p of net.places) byState.set(p.state, (byState.get(p.state) ?? 0) + 1);
    for (const s of ["MT", "WY", "ID", "ND", "SD", "NV", "NM", "VT", "ME"]) expect(byState.get(s) ?? 0, s).toBeGreaterThanOrEqual(10);
    // Every county seat is in: Montana has 56 counties.
    expect(byState.get("MT")!).toBeGreaterThanOrEqual(56);
  });

  it("routes every place to its market over the roads, within a sane distance, and almost never the long way round", () => {
    let worst = { mi: 0, name: "" };
    const detours: string[] = [];
    for (let p = 0; p < net.places.length; p++) {
      const place = net.places[p]!;
      const hubPlace = PLACE_OF_HUB[place.market]!;
      if (p === hubPlace) continue;
      const r = placeRoute(net, p, hubPlace);
      expect(r, `${place.id} has no road route to ${hubs[place.market]!.id}`).not.toBeNull();
      if (r!.miles > worst.mi) worst = { mi: r!.miles, name: place.id };
      // A road twice the crow-flies distance (plus a little) means the town joined a road that leads nowhere.
      if (r!.miles > 2 * greatCircleMiles(place, net.places[hubPlace]!) + 40) detours.push(place.id);
    }
    expect(worst.mi, `${worst.name} is ${worst.mi.toFixed(0)} mi from its market`).toBeLessThan(900); // north-central Montana trades on Fargo's board
    expect(detours.length, detours.join(", ")).toBeLessThanOrEqual(8); // Natural Earth's loose ends the place builder couldn't route around
  });

  it("puts towns on the road beside them, not at the next junction", () => {
    expect(mi("CA-Clovis", "CA-Fresno")).toBeLessThan(20);
    expect(mi("CO-CastleRock", "CO-Denver")).toBeLessThan(45);
    expect(mi("ID-Challis", "ID-Boise")).toBeLessThan(300); // US-93 and US-20, not round through Montana
    expect(mi("NV-Elko", "UT-SaltLakeCity")).toBeGreaterThan(200);
    expect(mi("NV-Elko", "UT-SaltLakeCity")).toBeLessThan(270);
  });

  it("matches real driving distances between places", () => {
    expect(mi("MT-MilesCity", "MT-Billings")).toBeGreaterThan(130);
    expect(mi("MT-MilesCity", "MT-Billings")).toBeLessThan(165);
    expect(mi("WY-Gillette", "CO-Denver")).toBeGreaterThan(420);
    expect(mi("WY-Gillette", "CO-Denver")).toBeLessThan(500);
    expect(mi("FL-Homestead", "NY-NewYorkCity")).toBeGreaterThan(1_250);
    expect(mi("FL-Homestead", "NY-NewYorkCity")).toBeLessThan(1_400);
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
