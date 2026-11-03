import type { JSX } from "preact";
import type { Equipment } from "@lanes/config";
import { companyAccount, fuelPrice, homeCrowding, homeEdge, lossRatio, operatingTrucks, PERMANENT_BAR, ratingLabel, seasonality, truckValue, yardPerTruck, type Basic, type Company as CompanyT, type CompliancePolicy } from "@lanes/engine";
import { cls, dateLabel, fd, pct, signedPct, TRAILER_NAME } from "../../format.js";
import { H } from "../../handlers.js";
import { act, clockMin, openIntel, S, useData } from "../../state.js";
import { INTEL } from "../../copy.js";
import { weekCosts } from "../../ledger.js";
import { Fig } from "../Explain.js";
import { Btn, Card, Kv, Label, Num, Panel } from "../bits.js";
import { ContractsCard } from "./Contracts.js";
import { SCENES } from "../../assets.js";
import { Scene } from "../Loop.js";
import { CapsLine } from "../Caps.js";

const crowdWord = (r: number): string => (r >= 1.5 ? "crowded" : r >= 1.1 ? "busy" : r >= 0.75 ? "fair share" : "wide open");

export function Company(): JSX.Element {
  useData();
  const g = S.game!;
  const w = g.w;
  const c = g.player;
  const day = Math.floor(clockMin() / 1440);
  const lastDay = w.metrics.days.at(-1);
  const cyc = w.feeds.cycle(day);
  const miles = (x: CompanyT) => x.milesHistory.reduce((a, b) => a + b, 0) + x.milesTotal;
  const worth = (x: CompanyT) => w.ledger.balance(companyAccount(x.id)) + w.trucksByCompany.get(x.id)!.reduce((s, t) => s + truckValue(w, t), 0);
  const carriers = w.companies.filter((x) => x.role === "carrier");
  // Your own worth is yours to see, on your own card; nobody else's is on any screen (the director's Intel page, row 1).
  const level = c ? Math.min(w.cfg.reputation.maxLevel, Math.floor(Math.sqrt(c.delivered / w.cfg.reputation.loadsPerLevelSq))) : 0;
  const rankMiles = c ? [...carriers].sort((a, b) => miles(b) - miles(a)).indexOf(c) + 1 : 0;
  return (
    <Panel title={c ? c.name : "The live world"}>
      <Scene name="office" still={SCENES.office} alt="The dispatch office" />
      {c ? <CapsLine /> : null}
      {c ? (
        <Card>
          <Kv
            rows={[
              ["Home hub", w.net.hubs[c.homeHub]!.name],
              ["Loads delivered", <Fig k="standing.onTime" label="On time"><Num>{Math.round(c.delivered)} · {c.delivered ? pct(c.onTime / c.delivered) : "–"} on time</Num></Fig>],
              ["Reputation", <Fig k="standing.reputation" label="Reputation"><Num>{pct(c.reputation)} · level {level}</Num></Fig>],
              ["Miles", <Fig k="standing.miles" label="Miles"><Num>{fd(miles(c))} · #{rankMiles} of {carriers.length} carriers</Num></Fig>],
              [INTEL.netWorth, <Num>{fd(worth(c))} FD<br /><span class="muted small">{INTEL.privateWorth}</span></Num>],
              ["Trucks", <Num>{operatingTrucks(w, c.id)} running</Num>],
            ]}
          />
        </Card>
      ) : null}
      {c ? <RecordCard c={c} /> : null}
      {c ? <ContractsCard c={c} /> : null}
      {c ? <HomeAndInsurance c={c} /> : null}
      {/* Every company lives on Intel now (specs/intel-ux.md): by Miles, in counts and bands, never worth. */}
      <nav class="morelist" aria-label={INTEL.title}>
        <button type="button" class="morerow" onClick={() => openIntel({})}>
          <span>{INTEL.everyCompany}</span>
        </button>
      </nav>
      <SeasonCard day={day} />
      <Card title="Market report">
        <Kv
          rows={[
            ["Freight demand, country-wide", <Num class={cyc > 1.1 ? "good" : cyc < 0.9 ? "bad" : ""}>{cyc.toFixed(2)} · {cyc > 1.1 ? "boom" : cyc < 0.9 ? "slump" : "normal"}</Num>],
            ["Average rate yesterday", <Num>{lastDay ? lastDay.avgClearedRate.toFixed(2) : "–"} FD/mi</Num>],
            ["Diesel", <Num>{fuelPrice(w).toFixed(2)} FD/gal</Num>],
            ...(c ? ([["Your hub's load-to-truck", <Num>{w.lastRatio[c.homeHub]!.toFixed(2)}</Num>]] as [string, JSX.Element][]) : []),
            ["Loads cleared yesterday", <Num>{lastDay ? `${lastDay.cleared} of ${lastDay.posted}` : "–"}</Num>],
            ["Companies in liquidation", <Num>{lastDay?.liquidating ?? 0}</Num>],
          ]}
        />
      </Card>
      {g.kind === "test" ? (
        <div class="row">
          {/* New test world lives on the title screen, not under the record (sprint 3's cheap list). */}
          {S.live ? <Btn onClick={H.backToLive}>Back to the live world</Btn> : null}
        </div>
      ) : S.platform.owner ? (
        <>
          <div class="row">
            <Btn onClick={H.showTestMenu}>Open a test world</Btn>
          </div>
          <p class="muted small">Only you see this. A test world is a private copy you can pause and speed up; the live world keeps running meanwhile.</p>
        </>
      ) : null}
    </Panel>
  );
}

/** Where the season has rates running hottest and coldest right now. */
function SeasonCard({ day }: { day: number }): JSX.Element {
  const w = S.game!.w;
  const row = (eq: Equipment) => {
    const all = w.net.hubs.map((h, i) => ({ id: h.id, r: seasonality(w, i, eq, day).rate - 1 })).sort((a, b) => b.r - a.r);
    const fmt = (x: { id: string; r: number }) => (
      <span key={x.id}>
        {x.id} <span class={x.r >= 0 ? "good" : "bad"}>{signedPct(x.r)}</span>
      </span>
    );
    return (
      <>
        hot: {all.slice(0, 3).map((x, i) => (
          <>
            {i ? ", " : ""}
            {fmt(x)}
          </>
        ))}{" "}
        · cold: {all.slice(-2).map((x, i) => (
          <>
            {i ? ", " : ""}
            {fmt(x)}
          </>
        ))}
      </>
    );
  };
  return (
    <Card title="Seasons now">
      <p class="muted small">Seasonal rate swing by origin, against each market's yearly average. Produce moves from South Florida and the Rio Grande Valley in spring to Georgia and the Carolinas in summer and the West and North in fall; northern markets also tighten in winter.</p>
      <Kv
        rows={[
          [TRAILER_NAME.reefer, row("reefer")],
          [TRAILER_NAME.van, row("van")],
          [TRAILER_NAME.flatbed, row("flatbed")],
        ]}
      />
    </Card>
  );
}

/** The company's authority, its safety record by area, and the policy its trucks run on. */
function RecordCard({ c }: { c: CompanyT }): JSX.Element {
  const w = S.game!.w;
  const cfg = w.cfg;
  const day = Math.floor(clockMin() / 1440);
  const th = cfg.safety.score.thresholds;
  const m = c.safety.measures;
  const area = (k: Basic, name: string): [string, JSX.Element] => {
    const alert = c.safety.alerts.includes(k);
    return [
      name,
      <Num class={alert ? "bad" : ""}>
        {m[k].toFixed(1)} of {th[k]}
        {alert ? " · alert" : ""}
      </Num>,
    ];
  };
  const a = c.authority;
  const authority =
    a.status === "active" ? (
      <>
        <span class="good">Active</span> since {dateLabel(a.since)}
      </>
    ) : a.status === "suspended" ? (
      <>
        <span class="bad">Suspended</span> until {dateLabel(a.suspendedUntil ?? day)}
      </>
    ) : a.barredUntil === null || a.barredUntil >= PERMANENT_BAR ? (
      <>
        <span class="bad">Revoked</span> · barred for good
      </>
    ) : (
      <>
        <span class="bad">Revoked</span> · can file again {dateLabel(a.barredUntil)}
      </>
    );
  const claims = c.claims.filter((k) => k.until > day).length;
  const cases = w.cases.filter((k) => k.companyId === c.id && k.resolveDay > day).length;
  const history = a.record.slice(-4).reverse();
  const p = c.policy;
  const legalH = cfg.hos.drivingHoursPerDay;
  const overH = legalH + cfg.safety.hos.overHours;
  const fast = cfg.safety.speed.fastMph;
  const setPolicy = () => {
    const v = (id: string) => (document.getElementById(id) as HTMLSelectElement).value;
    act({ type: "set_compliance", policy: { hos: v("pol-hos") as CompliancePolicy["hos"], speed: v("pol-speed") as CompliancePolicy["speed"], maintenance: v("pol-maint") as CompliancePolicy["maintenance"] } }, "Policy set");
  };
  return (
    <Card title="Safety and authority">
      <Kv
        rows={[
          ["Authority", authority],
          ["Rating", <>{ratingLabel(c)}{c.safety.reviewDay !== null ? ` · review ${dateLabel(c.safety.reviewDay)}` : ""}</>],
          area("hos", "Hours of service"),
          area("unsafe", "Unsafe driving"),
          area("maintenance", "Vehicle maintenance"),
          area("crash", "Crashes per truck"),
          ["Fines and tickets paid", <Num>{fd(c.safety.finesFd)} FD{c.safety.outOfService ? ` · ${c.safety.outOfService} out-of-service order${c.safety.outOfService > 1 ? "s" : ""}` : ""}</Num>],
          ...(claims || cases ? ([["Claims", <span class="bad">{claims} on your record{cases ? ` · ${cases} under investigation` : ""}</span>]] as [string, JSX.Element][]) : []),
        ]}
      />
      {history.length ? (
        <ul class="muted small">
          {history.map((r, i) => (
            <li key={i}>
              {dateLabel(r.day)}: {r.text}
            </li>
          ))}
        </ul>
      ) : null}
      <h3>Policy</h3>
      <div class="row">
        <Label for="pol-hos">Driving hours</Label>
        <select id="pol-hos" defaultValue={p.hos}>
          <option value="legal">Legal: {legalH} h a day</option>
          <option value="hot">{overH} h on hot loads</option>
          <option value="always">{overH} h every day</option>
        </select>
      </div>
      <div class="row">
        <Label for="pol-speed">Speed</Label>
        <select id="pol-speed" defaultValue={p.speed}>
          <option value="legal">Legal pace</option>
          <option value="hot">{fast} mph on hot loads</option>
          <option value="always">{fast} mph always</option>
        </select>
      </div>
      <div class="row">
        <Label for="pol-maint">Maintenance</Label>
        <select id="pol-maint" defaultValue={p.maintenance}>
          <option value="full">Full</option>
          <option value="deferred">Deferred: {pct(1 - cfg.safety.maintenance.deferredCostMult)} cheaper, defects build up</option>
        </select>
      </div>
      <div class="row">
        <Btn primary onClick={setPolicy}>
          Set policy
        </Btn>
      </div>
      <p class="muted small">What inspectors find, and what a crash turns up, goes on the record above. The AI companies choose from the same options.</p>
    </Card>
  );
}

function HomeAndInsurance({ c }: { c: CompanyT }): JSX.Element {
  const w = S.game!.w;
  const hub = w.net.hubs[c.homeHub]!;
  const r = homeCrowding(w)[c.homeHub]!;
  const p = c.insurance;
  // One insurance figure everywhere (the director's row 4): the week's bill, as Money shows it, ahead of the policy's price.
  const week = weekCosts(w, c).insurance;
  const lessorCovers = week < 0.5 && (w.trucksByCompany.get(c.id) ?? []).some((t) => t.lease === "npc");
  return (
    <>
      <Card title={`Home market: ${hub.name}`}>
        <Kv
          rows={[
            ["Carriers based here", `${r.toFixed(2)}× its fair share by freight · ${crowdWord(r)}`],
            ["Local edge", <Num>+{(homeEdge(w, c, c.homeHub) * 100).toFixed(1)} bid-score points on loads within {w.cfg.map.nearbyRadiusMi} mi of home</Num>],
            ["Yard rent", <Num>{fd(yardPerTruck(w, c))} FD a week for each truck past your first</Num>],
          ]}
        />
      </Card>
      <Card title="Insurance">
        <Kv
          rows={[
            ["Policy", <Fig k="pay.insurance" label="Insurance"><Num>{fd(week)} FD a week · {fd(p.annualPerTruck)} FD a year per insured truck · renews {dateLabel(p.renewDay)}</Num></Fig>],
            ["Priced from", `your record ×${p.risk.toFixed(2)} · ${hub.id} garaging ×${p.garaging.toFixed(2)} · market ×${p.market.toFixed(2)}`],
            ["Insurance market", `index ×${w.insuranceMarket.index.toFixed(2)} · insurers paid out ${pct(lossRatio(w))} of premiums this year`],
          ]}
        />
        {lessorCovers ? <p class="muted small">Your leased truck is on the lessor's policy, so you pay none of it until you own a truck.</p> : null}
        <p class="muted small">The price holds for the year. A serious at-fault crash, or a review that changes your rating, gets the policy re-written on the spot.</p>
      </Card>
    </>
  );
}

void cls;
