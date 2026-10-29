import type { JSX } from "preact";
import { condition, crewed, hubMiles, ordersOf, rebuildCost, resting, truckValue, type StandingOrder, type Truck } from "@lanes/engine";
import { SCENES } from "../../assets.js";
import { dateLabel, fd, pct, plural, TIER_NAME, TRAILER_NAME, hhmm, realUntil } from "../../format.js";
import { DEFAULT_ORDERS, GAME_CONFIG } from "../../game.js";
import { AttentionCard, CrewLine, goLoads, goStaff, idleLabel, idleWhy, openLoadsAt, StatusLine, stuckTrucks, tiredTrucks, truckName } from "../../logic.js";
import { focusTruck } from "../../mapview.js";
import { act, describe, me, myTrucks, S, selectTruck, truckNo, useData } from "../../state.js";
import { Bar, Btn, Card, Label, Num, Panel, Pixel } from "../bits.js";
import { Rig, Scene } from "../Loop.js";
import { TendersCard } from "./Contracts.js";

const num = (id: string): number => Number((document.getElementById(id) as HTMLInputElement | null)?.value);
const checked = (id: string): boolean => Boolean((document.getElementById(id) as HTMLInputElement | null)?.checked);

export function Fleet(): JSX.Element {
  useData();
  const w = S.game!.w;
  const trucks = myTrucks();
  const pending = ordersOf(w, me().id);
  return (
    <Panel title="Your fleet">
      <Scene name="yard" still={SCENES.yard} alt="Your yard at dusk" />
      <AttentionCard />
      <TendersCard c={me()} />
      <TiredAlerts />
      <IdleAlerts />
      <PendingCard />
      {pending.length ? <p class="muted">On order: {pending.map((o) => `${TIER_NAME[o.tier]} + ${TRAILER_NAME[o.trailer]}, arrives ${dateLabel(o.dueDay)}`).join("; ")}</p> : null}
      {trucks.map((t, idx) => (
        <TruckCard key={t.id} t={t} idx={idx} />
      ))}
      <DispatcherCard />
    </Panel>
  );
}

/** Live orders on their way, with when each takes effect. */
export function PendingCard(): JSX.Element | null {
  const g = S.game;
  if (g?.kind !== "live") return null;
  const p = g.pending();
  if (!p.length) return null;
  return (
    <Card title="Orders on the way">
      {p.map((r) => (
        <p key={r.s}>
          {describe(r.a)} · <span class="muted">at {hhmm(r.at)}, in {realUntil(g.msUntil(r.at))}</span>
        </p>
      ))}
    </Card>
  );
}

function TiredAlerts(): JSX.Element {
  const w = S.game!.w;
  const f = GAME_CONFIG.fatigue;
  return (
    <>
      {tiredTrucks().map((t) => {
        const d = w.staff[t.driverId - 1]!;
        const home = hubMiles(w, me().homeHub, t.hub);
        return (
          <Card key={t.id} alert title={`${d.owner ? "You have" : `${d.name} has`} been out ${plural(d.awayDays, "day")}${d.fatigue >= f.tiredAt ? ` and ${d.owner ? "are" : "is"} tired (${pct(d.fatigue)})` : ""}`}>
            <p>
              Fatigue raises crash odds (×{(1 + f.crashMult * d.fatigue).toFixed(2)} now), slows the truck and wears on morale. {f.resetDays} days off at home reset it; every day sitting idle away from home costs {GAME_CONFIG.labor.driver.perDiemFd} FD per diem.
            </p>
            {d.wantsHome ? (
              <p class="muted">Heading home for days off.</p>
            ) : t.status === "idle" ? (
              <div class="row">
                <Btn primary onClick={() => act({ type: "send_home", truckId: t.id }, "Heading home for days off")}>
                  Send home · {home} mi
                </Btn>
              </div>
            ) : (
              <p class="muted">Send it home when it's next idle, or let the dispatcher's home-time rule do it.</p>
            )}
          </Card>
        );
      })}
    </>
  );
}

function IdleAlerts(): JSX.Element {
  const w = S.game!.w;
  return (
    <>
      {stuckTrucks().map((t) => {
        const d = idleWhy(t);
        return (
          <Card key={t.id} alert title={`${truckName(t)} has been idle ${idleLabel(t)} at ${w.net.hubs[t.hub]!.name}`}>
            <p>
              {d.why} It has sat out {plural(t.idleRounds, "bidding round")}
              {t.lease === "owned" ? ` and pays ${w.cfg.costs.idleFeePerDay} FD a day idle after ${w.cfg.costs.idleFeeAfterDays}` : ""}.
            </p>
            {d.fixes.length ? <div class="row">{d.fixes}</div> : null}
          </Card>
        );
      })}
    </>
  );
}

function TruckCard({ t, idx }: { t: Truck; idx: number }): JSX.Element {
  const w = S.game!.w;
  const c = me();
  const leased = t.lease !== "owned";
  const cond = condition(w.cfg, t);
  const kind = t.lease === "npc" ? "NPC lease (15% of gross)" : t.lease === "lessor" ? "Extra lease (15% of gross, 250 FD/wk minimum)" : `Owned · worth ${fd(truckValue(w, t))} FD`;
  const load = t.loadId !== null ? w.loads.get(t.loadId) : undefined;
  const nearby = w.net.hubs
    .map((h, i) => ({ h, i, mi: hubMiles(w, t.hub, i) }))
    .filter((x) => x.i !== t.hub)
    .sort((a, b) => a.mi - b.mi)
    .slice(0, 14);
  const stop = (ev: MouseEvent) => ev.stopPropagation();
  return (
    <Card
      sel={t.id === S.selTruck}
      onClick={() => {
        selectTruck(t.id);
        focusTruck(t);
      }}
    >
      <div class="truckhead">
        <Rig eq={t.trailer} alt={`${TIER_NAME[t.tier]} with ${TRAILER_NAME[t.trailer]}`} />
        <div>
          <h3>
            Truck {idx + 1} · {TIER_NAME[t.tier]}
          </h3>
          <p class="muted">
            {TRAILER_NAME[t.trailer]} · {kind}
          </p>
        </div>
      </div>
      <p>
        <StatusLine t={t} />
        {t.breakdownMin > 0 && t.status !== "loaded" ? <span class="bad"> · stopped</span> : null}
      </p>
      <p>
        <CrewLine t={t} />
      </p>
      <div class="row">
        <span class="label">Condition</span>
        <Bar share={cond} tone={cond > 0.6 ? "var(--accent-success)" : cond > 0.35 ? "var(--accent-warn)" : "var(--accent-danger)"} />
        <Num>{pct(cond)}</Num>
        <span class="label">Odometer</span>
        <Num>{Math.round(t.odometer).toLocaleString("en-US")} mi</Num>
      </div>
      <div class="row" onClick={stop}>
        {t.status === "idle" ? (
          <>
            <Btn onClick={() => goLoads(t.id)}>Find loads</Btn>
            <select id={`send-${t.id}`} aria-label="Destination hub">
              {nearby.map((x) => (
                <option value={x.h.id} key={x.h.id}>
                  {x.h.id} · {x.mi} mi · {openLoadsAt(x.i).filter((l) => l.equipment === t.trailer).length} loads
                </option>
              ))}
            </select>
            <Btn
              onClick={() => {
                const hubId = (document.getElementById(`send-${t.id}`) as HTMLSelectElement).value;
                act({ type: "reposition_truck", truckId: t.id, hubId }, `Truck heading empty to ${hubId}`);
              }}
            >
              Send empty
            </Btn>
          </>
        ) : null}
        {t.lease === "owned" && t.status === "idle" && cond <= w.cfg.wear.rebuildMaxCondition ? (
          <Btn onClick={() => act({ type: "rebuild_truck", truckId: t.id }, "Truck is in the shop for two days")}>Rebuild · {fd(rebuildCost(w.cfg, t))} FD</Btn>
        ) : null}
        {t.lease === "owned" && t.status === "idle" ? <Btn onClick={() => act({ type: "park_truck", truckId: t.id }, "Truck parked")}>Park</Btn> : null}
        {t.status === "parked" ? <Btn onClick={() => act({ type: "unpark_truck", truckId: t.id }, "Truck back on the road")}>Back on the road</Btn> : null}
        {t.lease === "owned" && (t.status === "idle" || t.status === "parked") && myTrucks().length > 1 ? (
          <Btn
            onClick={() => {
              const value = truckValue(w, t);
              act({ type: "list_truck", truckId: t.id, askFd: value, floorFd: value * 0.6, stepFd: value * 0.05 }, `Listed at ${fd(value)} FD; the price drops 5% a week until it sells`);
            }}
          >
            Sell
          </Btn>
        ) : null}
        {t.lease === "lessor" && t.status === "idle" ? <Btn onClick={() => act({ type: "return_lease", truckId: t.id }, "Lease returned")}>Return lease</Btn> : null}
        {t.defects > 0 && (t.status === "idle" || t.status === "parked") ? (
          <Btn onClick={() => act({ type: "fix_defects", truckId: t.id }, "Defects fixed")}>
            Fix {plural(t.defects, "defect")} · {fd(t.defects * w.cfg.safety.maintenance.fixFdPerDefect)} FD
          </Btn>
        ) : null}
        {!crewed(t) ? (
          <Btn primary onClick={goStaff}>
            Hire a driver
          </Btn>
        ) : null}
        {t.status === "idle" && crewed(t) && !resting(w, t) && hubMiles(w, c.homeHub, t.hub) > w.cfg.map.nearbyRadiusMi ? (
          <Btn onClick={() => act({ type: "send_home", truckId: t.id }, "Heading home for days off")}>Send home · {hubMiles(w, c.homeHub, t.hub)} mi</Btn>
        ) : null}
        {t.status === "toPickup" && load && load.status === "assigned" && load.carrierId === c.id && !load.doubleBroker && load.shipperId !== c.id ? (
          <>
            <input type="number" id={`rb-${t.id}`} step="0.01" min="0.5" max={(load.clearedRate - 0.01).toFixed(2)} defaultValue={(load.clearedRate * 0.85).toFixed(2)} aria-label="Rate to re-post at" />
            <label class="label">
              <input type="checkbox" id={`rbpay-${t.id}`} defaultChecked /> pay the hauler
            </label>
            <Btn onClick={() => act({ type: "rebroker_load", loadId: load.id, rate: num(`rb-${t.id}`), pay: checked(`rbpay-${t.id}`) }, "Load re-posted. The truck is free where it stands")}>Re-post the load (won at {load.clearedRate.toFixed(2)})</Btn>
          </>
        ) : null}
        {t.status === "loaded" && load && load.shipperId !== c.id ? (
          <Btn
            danger
            onClick={() => {
              if (confirm("Steal this load? Police will investigate, and a theft claim stays on your record for a year.")) act({ type: "steal_load", truckId: t.id }, "The load won't be delivered. The truck runs on empty to where it was going");
            }}
          >
            Steal the load · cargo {fd(load.cargoValue)} FD
          </Btn>
        ) : null}
      </div>
    </Card>
  );
}

function DispatcherCard(): JSX.Element {
  const c = me();
  const find = <K extends StandingOrder["kind"]>(k: K) => c.orders.find((o): o is Extract<StandingOrder, { kind: K }> => o.kind === k);
  const bid = find("bid");
  const floor = find("floor");
  const repo = find("reposition");
  const rb = find("rebroker");
  const bn = find("bookNow");
  const hm = find("homeTime");
  const ct = find("contracts");
  const spotNow = ct ? (ct.spotAbovePct === null ? "always" : String(ct.spotAbovePct)) : "always";
  const mode = bid?.price.mode ?? "breakEvenPlus";
  const save = () => {
    const m = (document.getElementById("o-mode") as HTMLSelectElement).value as "breakEvenPlus" | "ceilingPct";
    const orders: StandingOrder[] = [
      { kind: "bid", maxDeadheadMi: Math.max(0, Math.min(150, num("o-dh"))), price: { mode: m, pct: Math.max(0, num("o-pct")) / 100 } },
      { kind: "floor", breakEvenPlusPct: Math.max(0, num("o-floor")) / 100 },
    ];
    if (checked("o-repo")) orders.push({ kind: "reposition", afterIdleRounds: Math.max(1, num("o-repo-r")), to: { openLoadsWithinMi: 400 } });
    if (checked("o-rb")) orders.push({ kind: "rebroker", share: Math.min(1, Math.max(0, num("o-rb-share") / 100 || 0)), keepPct: Math.min(0.9, Math.max(0, num("o-rb-keep") / 100 || 0)), pays: checked("o-rb-pays") });
    if (checked("o-bn")) orders.push({ kind: "bookNow", breakEvenPlusPct: Math.min(5, Math.max(0, num("o-bn-pct") / 100 || 0)), maxDeadheadMi: Math.max(0, Math.min(150, num("o-dh") || 0)) });
    if (checked("o-home")) orders.push({ kind: "homeTime", afterDays: Math.min(365, Math.max(1, Math.round(num("o-home-after")) || 21)), restDays: Math.min(60, Math.max(1, Math.round(num("o-home-rest")) || 5)) });
    if (checked("o-ct")) {
      const spot = (document.getElementById("o-ct-spot") as HTMLSelectElement).value;
      orders.push({ kind: "contracts", acceptOffers: true, spotAbovePct: spot === "always" ? null : Number(spot), maxDeadheadMi: Math.max(0, Math.min(150, num("o-dh") || 150)) });
    }
    act({ type: "set_standing_orders", orders }, "Dispatcher updated");
  };
  return (
    <Card title="Dispatcher (standing orders)" key={c.orders.length}>
      <p class="muted small">Your dispatcher bids for idle trucks every round you don't bid by hand.</p>
      <div class="row">
        <Label for="o-mode">Bid at</Label>
        <select id="o-mode" defaultValue={mode}>
          <option value="breakEvenPlus">break-even plus %</option>
          <option value="ceilingPct">% of the posted ceiling</option>
        </select>
        <input type="number" id="o-pct" step="1" min="0" max="120" defaultValue={String(Math.round((bid?.price.pct ?? 0.25) * 100))} />
        <span class="muted">%</span>
      </div>
      <div class="row">
        <Label for="o-floor">Never below break-even +</Label>
        <input type="number" id="o-floor" min="0" max="50" defaultValue={String(Math.round((floor?.breakEvenPlusPct ?? 0.05) * 100))} />
        <span class="muted">%</span>
      </div>
      <div class="row">
        <Label for="o-dh">Max empty miles to a pickup</Label>
        <input type="number" id="o-dh" min="0" max="150" defaultValue={String(bid?.maxDeadheadMi ?? 150)} />
      </div>
      <div class="row">
        <label class="label">
          <input type="checkbox" id="o-repo" defaultChecked={Boolean(repo)} /> Move idle trucks to busier hubs
        </label>
        <span class="muted">after</span>
        <input type="number" id="o-repo-r" min="1" max="20" defaultValue={String(repo?.afterIdleRounds ?? 3)} />
        <span class="muted">idle rounds</span>
      </div>
      <div class="row">
        <label class="label">
          <input type="checkbox" id="o-rb" defaultChecked={Boolean(rb)} /> Re-post some won loads to other carriers before pickup
        </label>
        <input type="number" id="o-rb-share" min="0" max="100" defaultValue={String(Math.round((rb?.share ?? 0.1) * 100))} />
        <span class="muted">% of loads, keeping</span>
        <input type="number" id="o-rb-keep" min="0" max="90" defaultValue={String(Math.round((rb?.keepPct ?? 0.15) * 100))} />
        <span class="muted">% of the rate</span>
        <label class="label">
          <input type="checkbox" id="o-rb-pays" defaultChecked={!rb || rb.pays} /> pay the hauler
        </label>
      </div>
      <div class="row">
        <label class="label">
          <input type="checkbox" id="o-bn" defaultChecked={Boolean(bn)} /> Book loads between rounds at break-even +
        </label>
        <input type="number" id="o-bn-pct" min="0" max="100" defaultValue={String(Math.round((bn?.breakEvenPlusPct ?? 0.2) * 100))} />
        <span class="muted">% (less the longer a truck sits, or the farther its driver is from home)</span>
      </div>
      <div class="row">
        <label class="label">
          <input type="checkbox" id="o-ct" defaultChecked={Boolean(ct)} /> Contracts: take offers from local shippers and
        </label>
        <select id="o-ct-spot" defaultValue={spotNow}>
          <option value="always">honor every tender</option>
          <option value="0.1">let a tender lapse when spot is 10% above the contract</option>
          <option value="0.15">let it lapse at 15% above</option>
          <option value="0.25">let it lapse at 25% above</option>
        </select>
      </div>
      <div class="row">
        <label class="label">
          <input type="checkbox" id="o-home" defaultChecked={Boolean(hm)} /> Bring drivers home after
        </label>
        <input type="number" id="o-home-after" min="1" max="365" defaultValue={String(hm?.afterDays ?? 21)} />
        <span class="muted">days out, for</span>
        <input type="number" id="o-home-rest" min="1" max="60" defaultValue={String(hm?.restDays ?? 5)} />
        <span class="muted">days off</span>
      </div>
      <div class="row">
        <Btn primary onClick={save}>
          Save dispatcher
        </Btn>
        <Btn onClick={() => act({ type: "set_standing_orders", orders: DEFAULT_ORDERS }, "Dispatcher back to defaults")}>Defaults</Btn>
      </div>
    </Card>
  );
}

void truckNo;
