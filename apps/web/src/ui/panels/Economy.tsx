import type { JSX } from "preact";
import { bridgeDelayDays, ceilingFd, EXCHANGE_ACCOUNT, fdPriceUsd, outstandingFd, queuedAirdropFd, tokenLive, valuation, vestAccount, type DayMetrics } from "@lanes/engine";
import { fd, pct, usd } from "../../format.js";
import { S, useData } from "../../state.js";
import { Bar, Card, Kv, Num, Panel, Sparkline } from "../bits.js";
import { ECONOMY } from "../../copy.js";

const TAG_NAME: Record<string, string> = {
  npc_shipper: "NPC shippers' freight",
  npc_lessor: "The NPC lessor",
  npc_market: "Goods sold to the NPC market",
  npc_factor: "The NPC factor",
  npc_advance: "Advances on brokers' paper (the NPC factor and lessor)",
  bankruptcy_writeoff: "Debts written off",
  driver_wages: "Driver wages",
  fuel: "Fuel",
  maintenance: "Maintenance",
  holding_cost: "Holding cost",
  npc_lease: "NPC leases",
  fuel_tax: "Fuel tax",
  parts: "Parts",
  road_service: "NPC road service",
  rebuild: "Rebuilds",
  idle_fuel: "Idling",
  equipment_dealer: "New trucks",
  business_upkeep: "Business upkeep",
  sales_tax: "Sales tax",
  fines: "Fines and tickets",
  management: "Managers' pay",
  repairs: "Repairs",
  tolls: "Tolls",
  insurance: "Insurance (NPC)",
  reefer_fuel: "Reefer units",
  cargo_claim: "Cargo claims",
  profit_tax: "Profit tax",
  asset_reserve: "Catalogue (to the reserve)",
  broker_falloff: "Broker fall-offs",
  permits: "Permits",
  dispatch: "Dispatchers",
  fleet_overhead: "Fleet overhead",
  surety: "Surety (NPC)",
  liability: "Liability claims",
  per_diem: "Per diem",
  board_fee: "Board fees",
  market_fee: "Used-truck market fees",
  facility_upkeep: "Facility upkeep",
  idle_fee: "Idle fees",
};
const name = (t: string) => TAG_NAME[t] ?? t.replace(/_/g, " ");

function tally(days: DayMetrics[], pick: (d: DayMetrics) => Record<string, number> | undefined): [string, number][] {
  const m = new Map<string, number>();
  for (const d of days) for (const [k, v] of Object.entries(pick(d) ?? {})) m.set(k, (m.get(k) ?? 0) + v);
  return [...m].filter(([, v]) => v > 0.5).sort((a, b) => b[1] - a[1]);
}

/** The economy, in the open (TODO.md: the Monthly Economic Report, live): the last 30 days' money in and out, the supply, the dial, the pool and the market. */
export function Economy(): JSX.Element {
  useData();
  const w = S.game!.w;
  const days = w.metrics.days.slice(-30);
  const sum = (f: (d: DayMetrics) => number) => days.reduce((s, d) => s + (f(d) || 0), 0);
  const faucets = sum((d) => d.faucetFd);
  const sinks = sum((d) => d.sinkFd);
  const burned = sum((d) => Object.values(d.burnByTag ?? {}).reduce((a, b) => a + b, 0));
  const topSinks = tally(days, (d) => d.sinkByTag).slice(0, 10);
  const topFaucets = tally(days, (d) => d.faucetByTag).slice(0, 5);
  const live = tokenLive(w);
  const last = days.at(-1);
  const circular = w.cfg.token.circular.enabled;
  const open = w.businesses.filter((b) => b.ownerId > 0);
  const count = (k: string) => open.filter((b) => b.kind === k).length;
  const served = sum((d) => d.roadServiceStop ?? 0) + sum((d) => d.roadServiceHub ?? 0) + sum((d) => d.roadServiceNpc ?? 0);
  const nights = sum((d) => d.siteNights ?? 0) + sum((d) => d.shoulderNights ?? 0);
  return (
    <Panel title="Economy">
      <p class="muted small">{ECONOMY.lead(30)}</p>
      <Card title="Money in and out, last 30 days">
        <Kv
          rows={[
            ["Paid out by the game", <Num>{fd(faucets)} FD</Num>],
            ["Taken back", <Num>{fd(sinks)} FD · {faucets > 0 ? pct(sinks / faucets) : "–"} of what was paid out</Num>],
            ["Burned for good", <Num>{fd(burned)} FD</Num>],
          ]}
        />
        <h4>Where it came from</h4>
        {topFaucets.map(([t, v]) => (
          <div class="row" key={t}>
            <span class="grow">{name(t)}</span>
            <Num>{fd(v)}</Num>
            <Bar share={faucets > 0 ? v / faucets : 0} />
          </div>
        ))}
        <h4>Where it went</h4>
        {topSinks.map(([t, v]) => (
          <div class="row" key={t}>
            <span class="grow">{name(t)}</span>
            <Num>{fd(v)}</Num>
            <Bar share={sinks > 0 ? v / sinks : 0} />
          </div>
        ))}
      </Card>
      <Card title="Supply">
        <Kv
          rows={[
            ["In circulation", <Num>{fd(valuation(w).circulatingFd)} FD (what players hold and trade, the exchange pool included)</Num>],
            ...(circular ? ([["All FD there is", <Num>{fd(valuation(w).totalSupplyFd)} FD (the cap less what's been burned)</Num>]] as [string, JSX.Element][]) : []),
            ...(circular
              ? ([
                  ["The reserve", <Num>{fd(w.ledger.reserve())} FD</Num>],
                  ["Still in the genesis allocations", <Num>{fd(w.ledger.allocated())} FD</Num>],
                  ["Burned since genesis", <Num>{fd(w.ledger.burned())} FD</Num>],
                ] as [string, JSX.Element][])
              : []),
            ...(w.cfg.token.circular.rateStabilizer.enabled ? ([["The balance dial", <Num>NPC rates at {w.stab.rateMult.toFixed(3)}× (it moves toward sinks matching faucets)</Num>]] as [string, JSX.Element][]) : []),
            ...(live ? ([["Profit tax", <Num>{pct(w.token.profitTaxRate)}</Num>]] as [string, JSX.Element][]) : []),
          ]}
        />
      </Card>
      {live ? (
        <Card title="FD on the exchange">
          <Sparkline values={w.token.priceHistory.slice(-90)} color="var(--accent-warn)" />
          <Kv
            rows={[
              ["Price", <Num>${fdPriceUsd(w).toFixed(5)} · launched at ${w.token.launchPriceUsd.toFixed(5)}</Num>],
              ["Market cap", <Num>{usd(valuation(w).marketCapUsd)} (price × FD in circulation)</Num>],
              ["Fully diluted value", <Num>{usd(valuation(w).fdvUsd)} (price × all FD there is)</Num>],
              ["The pool", <Num>{usd(w.token.poolUsd)} and {fd(w.ledger.balance(EXCHANGE_ACCOUNT))} FD</Num>],
              ["Sold into it since launch, net of buys", <Num>{fd(w.token.exchange.soldFd - w.token.exchange.boughtFd)} FD</Num>],
            ]}
          />
        </Card>
      ) : null}
      {live ? (
        <Card title="Supply control">
          <p class="muted small">Every faucet, sink and schedule, in the open (Jeff: "complete supply control"). The path never looks at the price.</p>
          <Kv
            rows={[
              ...(w.token.ceiling.baseFd !== null
                ? ([
                    ["FD outstanding vs the published path", <Num class={outstandingFd(w) > ceilingFd(w) ? "bad" : "good"}>{fd(outstandingFd(w))} of {fd(ceilingFd(w))} allowed{w.token.ceiling.holding ? " · payouts waiting" : ""}</Num>],
                    ["Airdrop owed under the path", <Num>{fd(queuedAirdropFd(w))} FD · {w.token.ceiling.weeksHolding} weeks held so far</Num>],
                    ["The balance dial", <Num>NPC rates at {w.stab.rateMult.toFixed(3)}× (launched at {w.token.ceiling.launchMult.toFixed(3)}×)</Num>],
                  ] as [string, JSX.Element][])
                : []),
              ["Spend-only FD", <Num>{fd(w.ledger.lockedSupply())} FD (the airdrop until its milestones, carryover, grants)</Num>],
              ["Airdrop", <Num>{fd(w.token.airdrop.mintedFd)} minted · {fd(w.token.airdrop.forfeitedFd)} forfeited or burned</Num>],
              ...(w.cfg.token.bridge.enabled
                ? ([["The bridge", <Num>{fd(w.companies.reduce((s, c) => s + c.withdrawals.reduce((x, r) => x + r.fd, 0), 0))} FD waiting ({bridgeDelayDays(w, Math.floor(w.t / w.cfg.time.gameMinutesPerDay))} days today) · {fd(w.token.bridge.clearedFd)} cleared since launch · {w.token.bridge.cappedDays} days capped</Num>]] as [string, JSX.Element][])
                : []),
              ...(w.token.auction ? ([["The opening auction", <Num>{usd(w.token.auction.usd)} from {w.token.auction.bidders} bidders at ${w.token.auction.priceUsd.toFixed(5)} · the pool opened with {usd(w.token.auction.poolUsd)}</Num>]] as [string, JSX.Element][]) : []),
              ...(circular ? ([["The vest", <Num>{fd(w.token.treasury.vestedFd)} FD sold for {usd(w.token.treasury.devUsd)} · {fd(w.ledger.balance(vestAccount(w)))} FD left to vest</Num>]] as [string, JSX.Element][]) : []),
              ["Burned, last 30 days", <Num>{tally(days, (d) => d.burnByTag).map(([t, v]) => `${name(t)} ${fd(v)}`).join(" · ") || "none"}</Num>],
              ["Minted, last 30 days", <Num>{tally(days, (d) => d.mintByTag).map(([t, v]) => `${name(t)} ${fd(v)}`).join(" · ") || "none"}</Num>],
            ]}
          />
        </Card>
      ) : null}
      <Card title="The market">
        <Kv
          rows={[
            ["Loads delivered", <Num>{fd(sum((d) => d.delivered))} · {last ? `${last.avgClearedRate.toFixed(2)} FD/mi cleared yesterday` : ""}</Num>],
            ["Trucks", <Num>{last ? `${last.ownedTrucks} owned, ${last.idleTrucks} idle at day's end` : "–"}</Num>],
            ["Bankruptcies", <Num>{fd(sum((d) => d.bankruptcies))}</Num>],
            ["Player businesses", <Num>{count("shop")} shops · {count("fuelStation")} fuel stations · {count("truckStop")} truck stops</Num>],
            ["Breakdowns", <Num>{served ? `${pct(sum((d) => d.roadServiceStop ?? 0) / served)} by truck stops, ${pct(sum((d) => d.roadServiceHub ?? 0) / served)} by hub shops, the rest by NPC road service` : "none"}</Num>],
            ["Nights on the road", <Num>{nights ? `${pct(sum((d) => d.siteNights ?? 0) / nights)} at a site · ${fd(sum((d) => d.tickets ?? 0))} shoulder tickets` : "–"}</Num>],
            // R3: the crime counters leave the player's page for the studio's dashboard until the Back Lot opens.
          ]}
        />
      </Card>
    </Panel>
  );
}
