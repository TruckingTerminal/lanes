import type { JSX } from "preact";
import { assetPriceUsd, businessesAt, businessesOf, businessPriceFd, companyAccount, hubTheftRisk, itemPriceFd, itemPriceUsd, lotOf, openAssetSales, priceIndex, siteBusiness, sitePriceFd, tokenLive, trailerCap, yardTrucks, type Business as Biz, type BusinessKind, type TruckStopSite } from "@lanes/engine";
import { fd, usd } from "../../format.js";
import { act, bumpData, me, myTrucks, S, truckNo, useData } from "../../state.js";
import { Btn, Card, Kv, Num, Panel } from "../bits.js";
import { SECURITY } from "../../copy.js";

const num = (id: string): number => Number((document.getElementById(id) as HTMLInputElement | null)?.value);

const KIND_NAME: Record<BusinessKind, string> = { shop: "Shop", fuelStation: "Fuel station", truckStop: "Truck stop", dealership: "Dealership", fence: "Fence", chopShop: "Chop shop" };
const MODS = [
  ["apu", "APU", "idling at half"],
  ["aero", "Aero kit", "5% less fuel"],
  ["tires", "Premium tires", "20% less maintenance"],
  ["sleeper", "Sleeper upgrade", "per diem at half"],
] as const;

/** A site's road and the market it is nearest, for a label. */
export function siteLabel(s: TruckStopSite): string {
  const w = S.game!.w;
  const road = w.net.roads.edges[s.edge]?.label ?? "Interstate";
  let best = 0;
  let bd = Infinity;
  w.net.hubs.forEach((h, i) => {
    const d = (h.lat - s.lat) ** 2 + ((h.lon - s.lon) * 0.8) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return `${road} near ${w.net.hubs[best]!.name}`;
}

const where = (b: Biz): string => {
  const w = S.game!.w;
  if (b.site) {
    const s = w.sites[b.site - 1];
    return s ? siteLabel(s) : "an interstate";
  }
  return w.net.hubs[b.hub]?.name ?? "?";
};

/** Yards and upgrades, the hub businesses, truck stops on the interstates, and what the company owns (0.18.0). */
export function Business(): JSX.Element {
  useData();
  const w = S.game!.w;
  const c = me();
  const cash = w.ledger.balance(companyAccount(c.id));
  const cat = w.cfg.token.catalogue;
  const biz = w.cfg.businesses;
  const live = tokenLive(w);
  const usdWindow = !live && cat.usdWindow.enabled;
  // The farming season's dollar window for businesses (Jeff, 2026-11-01): the price in dollars, every one held for
  // the launch pool; the bond stays FD.
  const assetDollars = usdWindow && cat.usdWindow.assets.enabled;
  const owned = myTrucks().filter((t) => t.lease === "owned" && t.status !== "retired");
  const mine = businessesOf(w, c.id);
  const atCap = mine.length >= biz.maxPerCompany;
  const sel = S.selSite !== null ? (w.sites[S.selSite - 1] ?? null) : null;
  const sites = w.sites
    .filter((s) => s.open && s.businessId === 0)
    .sort((a, b) => b.traffic - a.traffic || a.id - b.id)
    .slice(0, 8);
  const hubsByWeight = w.net.hubs.map((h, i) => ({ h, i })).sort((a, b) => b.h.weight - a.h.weight);
  const siteCard = (s: TruckStopSite, focus = false) => {
    const stop = siteBusiness(w, s);
    const price = sitePriceFd(w, s);
    const owner = stop ? w.companies[stop.ownerId - 1] : null;
    return (
      <Card key={s.id} sel={focus} title={siteLabel(s)}>
        <Kv
          rows={[
            ["Traffic", <Num>{Math.round(s.traffic * 100)} of 100</Num>],
            ["Rest area", <Num>{s.spaces} spaces · {s.parked} taken tonight</Num>],
            [SECURITY.label, SECURITY.name[SECURITY.band(s.theftRisk)]],
            [stop ? "Truck stop" : "For sale", stop ? <Num>{owner?.name ?? "?"} · parking {fd(stop.parkingFd)} a night</Num> : s.open ? <Num>{fd(price)} FD + {fd(biz.kinds.truckStop.bondFd)} bond</Num> : "not yet open"],
          ]}
        />
        {!stop && s.open ? (
          <div class="row">
            <Btn primary disabled={atCap || cash < price + biz.kinds.truckStop.bondFd} onClick={() => act({ type: "buy_business", kind: "truckStop", siteId: s.id }, "Truck stop open: fuel, a shop and parking")}>
              Build a truck stop
            </Btn>
            {assetDollars ? (
              <Btn disabled={atCap || cash < biz.kinds.truckStop.bondFd || c.usd.wallet < assetPriceUsd(w, price)} onClick={() => act({ type: "buy_business", kind: "truckStop", siteId: s.id, pay: "usd" }, "Truck stop open, paid in dollars: fuel, a shop and parking")}>
                Or {usd(assetPriceUsd(w, price))} (to the launch pool; the bond in FD)
              </Btn>
            ) : null}
          </div>
        ) : null}
      </Card>
    );
  };
  /** A second row of hub buttons that pays the price in dollars (the bond in FD), when the window is open. */
  const dollarRow = (kind: Exclude<BusinessKind, "truckStop">, price: number, bond: number, room: { h: { id: string; name: string } }[]) =>
    assetDollars ? (
      <div class="row">
        <span class="muted small">Or {usd(assetPriceUsd(w, price))} to the launch pool (the bond in FD):</span>
        {room.map(({ h }) => (
          <Btn key={`usd-${h.id}`} disabled={atCap || cash < bond || c.usd.wallet < assetPriceUsd(w, price)} onClick={() => act({ type: "buy_business", kind, hubId: h.id, pay: "usd" }, `${KIND_NAME[kind]} open at ${h.name}, paid in dollars`)}>
            {h.id} · {usd(assetPriceUsd(w, price))}
          </Btn>
        ))}
      </div>
    ) : null;
  return (
    <Panel title="Business">
      {cat.enabled ? (
        <Card title="Yard and upgrades">
          <p class="muted small">
            More than {cat.trucksWithoutYard} trucks needs a yard. Prices follow the freight rate index (now {priceIndex(w).toFixed(2)}×); half of every price is burned. {usdWindow ? `Until launch, items can also be bought with dollars at ${cat.usdWindow.premium}× (up to ${usd(cat.usdWindow.capUsdPerMc)}): every dollar seeds the launch pool.` : ""}
          </p>
          <Kv rows={[["Yard", <Num>{c.yard === "none" ? "none" : c.yard === "small" ? "small" : "large"} · holds {yardTrucks(w, c)} trucks{w.cfg.assets.enabled ? ` and ${trailerCap(w, c)} trailers` : ""}</Num>]]} />
          <div class="row">
            {c.yard === "none" ? (
              <Btn disabled={cash < itemPriceFd(w, "yardSmall") + cat.items.yardSmall.bondFd} onClick={() => act({ type: "buy_item", item: "yardSmall", pay: "fd" }, "Yard bought")}>
                Small yard · {fd(itemPriceFd(w, "yardSmall"))} + {fd(cat.items.yardSmall.bondFd)} bond
              </Btn>
            ) : null}
            {c.yard !== "large" ? (
              <Btn disabled={cash < itemPriceFd(w, "yardLarge") + cat.items.yardLarge.bondFd} onClick={() => act({ type: "buy_item", item: "yardLarge", pay: "fd" }, "Large yard bought")}>
                Large yard · {fd(itemPriceFd(w, "yardLarge"))} + {fd(cat.items.yardLarge.bondFd)} bond
              </Btn>
            ) : null}
            {w.cfg.assets.enabled && c.yard !== "none" ? (
              <Btn disabled={cash < itemPriceFd(w, "trailerSpace")} onClick={() => act({ type: "buy_item", item: "trailerSpace", pay: "fd" }, `Room for ${w.cfg.assets.yard.spacePerPurchase} more trailers`)}>
                +{w.cfg.assets.yard.spacePerPurchase} trailer spaces · {fd(itemPriceFd(w, "trailerSpace"))}
              </Btn>
            ) : null}
            {w.cfg.assets.enabled && c.yard !== "none" && !openAssetSales(w).some((x) => x.kind === "yard" && x.sellerId === c.id) ? (
              <>
                <input type="number" id="yard-ask" step="1000" min="1" defaultValue={String(Math.round(itemPriceFd(w, c.yard === "large" ? "yardLarge" : "yardSmall") * 0.8))} aria-label="Asking price for the yard" />
                <Btn onClick={() => act({ type: "list_asset_sale", kind: "yard", refId: c.id, askFd: num("yard-ask") }, "Yard up for sale to carriers at your home hub")}>Sell the yard</Btn>
              </>
            ) : null}
            {usdWindow && c.yard === "none" ? (
              <Btn onClick={() => act({ type: "buy_item", item: "yardSmall", pay: "usd" }, "Yard bought with dollars")}>
                Small yard · {usd(itemPriceUsd(w, "yardSmall"))}
              </Btn>
            ) : null}
          </div>
          {owned.map((t) => (
            <div class="row" key={t.id}>
              <span>Truck {truckNo(t.id)}</span>
              {MODS.filter(([m]) => !t.mods[m]).map(([m, name, what]) => (
                <Btn key={m} sm title={what} disabled={cash < itemPriceFd(w, m)} onClick={() => act({ type: "buy_item", item: m, pay: "fd", truckId: t.id }, `${name} fitted to truck ${truckNo(t.id)}`)}>
                  {name} · {fd(itemPriceFd(w, m))}
                </Btn>
              ))}
              {MODS.every(([m]) => t.mods[m]) ? <span class="muted small">fully fitted</span> : null}
            </div>
          ))}
        </Card>
      ) : null}
      {biz.enabled ? (
        <>
          {(w.cfg.assets.enabled ? (["shop", "fuelStation", "dealership"] as const) : (["shop", "fuelStation"] as const)).map((kind) => {
            const spec = biz.kinds[kind];
            const price = businessPriceFd(w, kind);
            const room = hubsByWeight.filter(({ i }) => businessesAt(w, i, kind).length < spec.perHub).slice(0, 4);
            return (
              <Card key={kind} title={`Open a ${KIND_NAME[kind].toLowerCase()}`}>
                <p class="muted small">
                  {kind === "shop"
                    ? `Does the hub's maintenance, repairs and rebuilds at the price you set against the NPC shop's list: parts are ${Math.round(biz.kinds.shop.partsShare * 100)}% of list, the rest is yours. Your own trucks pay parts only.`
                    : kind === "dealership"
                      ? `Buys its share of the factory's monthly allocation at ${Math.round(biz.kinds.dealership.wholesaleShare * 100)}% of list (half of it burned) and sells new tractors and trailers from stock at the markup you set, delivered in ${biz.kinds.dealership.deliveryDays} days. Takes trade-ins at ${Math.round(biz.kinds.dealership.tradeInShare * 100)}% of value for its used lot. Your own fleet takes from your stock at no further cost.`
                      : `Keeps a ${Math.round(biz.kinds.fuelStation.marginPct * 100)}% margin on the fuel bought at its hub; your own trucks fuel at wholesale.`}{" "}
                  {fd(price)} FD + {fd(spec.bondFd)} bond, {fd(spec.upkeepPerWeekFd)} a week upkeep.
                </p>
                <div class="row">
                  {room.map(({ h, i }) => (
                    <Btn key={h.id} disabled={atCap || cash < price + spec.bondFd} onClick={() => act({ type: "buy_business", kind, hubId: h.id }, `${KIND_NAME[kind]} open at ${h.name}`)}>
                      {h.id} · {businessesAt(w, i, kind).length}/{spec.perHub}
                    </Btn>
                  ))}
                </div>
                {dollarRow(kind, price, spec.bondFd, room)}
              </Card>
            );
          })}
          {w.cfg.robbery.enabled && w.cfg.robbery.backLot.enabled
            ? (["fence", "chopShop"] as const).map((kind) => {
                const spec = biz.kinds[kind];
                const price = businessPriceFd(w, kind);
                const room = hubsByWeight.filter(({ i }) => businessesAt(w, i, kind).length < spec.perHub).slice(0, 4);
                const bl = w.cfg.robbery.backLot;
                return (
                  <Card key={kind} title={`Open a ${KIND_NAME[kind].toLowerCase()} (the Back Lot)`}>
                    <p class="muted small">
                      {kind === "fence"
                        ? `Buys what crews take off trucks near it at the fence's share and sells it on a week later for the share plus ${Math.round(bl.fenceMarkup * 100)}% of the cargo's value (half that for perishables). Hires are on Channel 19; so are you.`
                        : `Buys chopped rigs from crews at ${Math.round(w.cfg.robbery.rigFenceShare * 100)}% of their value and sells the parts for ${Math.round(bl.chopPartsYield * 100)}% of it a week later.`}{" "}
                      {fd(price)} FD + {fd(spec.bondFd)} bond, {fd(spec.upkeepPerWeekFd)} a week upkeep. Opens with the crews' layer of the ladder.
                    </p>
                    <div class="row">
                      {room.map(({ h, i }) => (
                        <Btn key={h.id} disabled={atCap || cash < price + spec.bondFd} onClick={() => act({ type: "buy_business", kind, hubId: h.id }, `${KIND_NAME[kind]} open at ${h.name}`)}>
                          {h.id} · {businessesAt(w, i, kind).length}/{spec.perHub}
                        </Btn>
                      ))}
                    </div>
                    {dollarRow(kind, price, spec.bondFd, room)}
                  </Card>
                );
              })
            : null}
          <h3>Truck stops on the interstates</h3>
          <p class="muted small">
            Every site is a free public rest area. A truck stop adds fuel ({Math.round(biz.kinds.truckStop.fuelMarginPct * 100)}% margin on the legs that pass it), a shop that comes out to breakdowns nearby, and paid parking with shore power. Click a site on the map to see it here. At most {biz.maxPerCompany} businesses per company.
          </p>
          {sel ? siteCard(sel, true) : null}
          {sites.filter((s) => s.id !== sel?.id).map((s) => siteCard(s))}
        </>
      ) : null}
      {w.cfg.assets.enabled ? <SalesCard /> : null}
      {mine.length ? <h3>Your businesses</h3> : null}
      {mine.map((b) => {
        const site = b.site ? w.sites[b.site - 1] : undefined;
        const spec = biz.kinds[b.kind];
        const p = biz.parking;
        const addPrice = p.spacesPerPurchase * p.spacePriceFd * (cat.enabled ? priceIndex(w) : 1);
        return (
          <Card key={b.id} title={`${KIND_NAME[b.kind]} · ${where(b)}`}>
            <Kv
              rows={[
                ["Result so far", <Num class={b.netFd >= 0 ? "good" : "bad"}>{fd(b.netFd)} FD (bought for {fd(b.purchaseFd)})</Num>],
                ["Bond", <Num>{fd(b.bondFd)} FD</Num>],
                ...(site ? ([["Parking", <Num>{site.parked}/{site.spaces} tonight · {fd(b.parkingFd)} a night</Num>], [SECURITY.here, <Num>{SECURITY.name[SECURITY.band(site.theftRisk)]}</Num>]] as [string, JSX.Element][]) : []),
                ...(b.hub >= 0 ? ([[SECURITY.atHub, <Num>{SECURITY.name[SECURITY.band(hubTheftRisk(w, b.hub))]}</Num>]] as [string, JSX.Element][]) : []),
                ...(b.kind === "dealership"
                  ? ([
                      ["Tractors in stock", <Num>{b.stock.tractor.workhorse} Workhorse · {b.stock.tractor.highwayPro} HighwayPro · {b.stock.tractor.flagship} Flagship</Num>],
                      ["Trailers in stock", <Num>{b.stock.trailer.van} van · {b.stock.trailer.reefer} reefer · {b.stock.trailer.flatbed} flatbed</Num>],
                      ["Sold last month", <Num>{b.soldLastMonth} · this month {b.soldMonth}</Num>],
                      ["Used lot", <Num>{lotOf(w, b).length} of {biz.kinds.dealership.lotMax}</Num>],
                    ] as [string, JSX.Element][])
                  : []),
              ]}
            />
            {b.kind !== "fuelStation" ? (
              <div class="row">
                <label class="small" for={`mk-${b.id}`}>
                  {b.kind === "dealership" ? "Sell new at × list" : "Work at × list"}
                </label>
                <input type="number" id={`mk-${b.id}`} step="0.01" defaultValue={String(b.markup)} min={String("markupRange" in spec ? spec.markupRange[0] : 0)} max={String("markupRange" in spec ? spec.markupRange[1] : 2)} aria-label="Price of work against the NPC list" />
                <Btn sm onClick={() => act({ type: "set_shop_markup", businessId: b.id, markup: num(`mk-${b.id}`) }, "Prices set")}>
                  Set
                </Btn>
              </div>
            ) : null}
            {b.kind === "truckStop" ? (
              <div class="row">
                <label class="small" for={`pk-${b.id}`}>
                  Parking a night
                </label>
                <input type="number" id={`pk-${b.id}`} step="1" defaultValue={String(b.parkingFd)} min={String(p.priceRange[0])} max={String(p.priceRange[1])} aria-label="Nightly parking price" />
                <Btn sm onClick={() => act({ type: "set_parking_price", businessId: b.id, fd: num(`pk-${b.id}`) }, "Parking price set")}>
                  Set
                </Btn>
                <Btn sm disabled={cash < addPrice} onClick={() => act({ type: "add_parking", businessId: b.id }, `${p.spacesPerPurchase} spaces added`)}>
                  +{p.spacesPerPurchase} spaces · {fd(addPrice)}
                </Btn>
                {site ? (
                  <Btn
                    sm
                    ghost
                    onClick={() => {
                      S.selSite = site.id;
                      bumpData();
                    }}
                  >
                    Show on map
                  </Btn>
                ) : null}
              </div>
            ) : null}
            {w.cfg.assets.enabled ? <SellRow b={b} /> : null}
          </Card>
        );
      })}
    </Panel>
  );
}

/** Assets, resale: put one of your businesses up for sale to another player, or take it down. */
function SellRow({ b }: { b: Biz }): JSX.Element {
  const w = S.game!.w;
  const sale = openAssetSales(w).find((x) => x.kind === "business" && x.refId === b.id);
  if (sale)
    return (
      <div class="row">
        <span class="muted small">For sale at {fd(sale.askFd)} FD</span>
        <Btn sm ghost onClick={() => act({ type: "withdraw_asset_sale", saleId: sale.id }, "Taken off the market")}>
          Take it down
        </Btn>
      </div>
    );
  return (
    <div class="row">
      <input type="number" id={`sell-${b.id}`} step="1000" min="1" defaultValue={String(Math.round(b.purchaseFd * 0.9))} aria-label="Asking price" />
      <Btn sm onClick={() => act({ type: "list_asset_sale", kind: "business", refId: b.id, askFd: num(`sell-${b.id}`) }, "Up for sale: the buyer takes over the bond")}>
        Sell to a player
      </Btn>
    </div>
  );
}

/** Assets, resale: businesses, facilities and yards other players are selling. */
function SalesCard(): JSX.Element {
  useData();
  const w = S.game!.w;
  const c = me();
  const sales = openAssetSales(w).filter((x) => x.sellerId !== c.id).slice(0, 10);
  const label = (x: (typeof sales)[number]): string => {
    if (x.kind === "business") {
      const b = w.businesses[x.refId - 1]!;
      return `${KIND_NAME[b.kind]} · ${where(b)} · bond ${fd(b.bondFd)} · result so far ${fd(b.netFd)}`;
    }
    if (x.kind === "facility") {
      const f = w.facilities[x.refId - 1]!;
      return `${f.type} · ${w.net.hubs[f.hub]?.name ?? "?"}`;
    }
    const s = w.companies[x.sellerId - 1]!;
    return `${s.yard} yard · ${w.net.hubs[s.homeHub]?.name ?? "?"} (for a carrier at that hub)`;
  };
  return (
    <Card title="For sale by other players">
      <p class="muted small">A business comes with its bond: the seller's comes back, yours goes in. A yard stays at its hub.</p>
      {sales.length ? (
        sales.map((x) => (
          <div class="row" key={x.id}>
            <span>
              {label(x)} · asking <Num>{fd(x.askFd)}</Num>
            </span>
            <Btn sm onClick={() => act({ type: "buy_asset_sale", saleId: x.id }, "Bought from another player")}>
              Buy
            </Btn>
          </div>
        ))
      ) : (
        <p class="muted">Nothing for sale right now.</p>
      )}
    </Card>
  );
}
