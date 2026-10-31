import type { JSX } from "preact";
import type { Equipment } from "@lanes/config";
import { EQUIPMENT, hubTheftRisk, planIndex } from "@lanes/engine";
import { TRAILER_NAME } from "../../format.js";
import { bumpData, S, useData } from "../../state.js";
import { Btn, Card, Panel } from "../bits.js";

/** How a market reads for a trailer type: hot when loads outnumber trucks, loose when trucks wait. */
function tag(ratio: number): [string, string] {
  if (ratio >= 1.5) return ["Hot", "good"];
  if (ratio >= 1.1) return ["Tight", "good"];
  if (ratio <= 0.7) return ["Loose", "bad"];
  return ["Balanced", "muted"];
}

/** The market view (DAT-style): load-to-truck ratios by market and trailer, the posted rates, and the best-paying lanes on the board. */
export function Rates(): JSX.Element {
  useData();
  const w = S.game!.w;
  const eq: Equipment = S.ratesEq;
  const e = EQUIPMENT.indexOf(eq);
  const out = new Map<number, { n: number; sum: number }>();
  const lanes = new Map<string, { o: number; d: number; n: number; sum: number; miles: number }>();
  for (const l of w.loads.values()) {
    if (l.status !== "open" || l.equipment !== eq) continue;
    const o = out.get(l.origin) ?? { n: 0, sum: 0 };
    o.n++;
    o.sum += l.bookNow;
    out.set(l.origin, o);
    const key = `${l.origin}-${l.dest}`;
    const x = lanes.get(key) ?? { o: l.origin, d: l.dest, n: 0, sum: 0, miles: l.miles };
    x.n++;
    x.sum += l.bookNow;
    lanes.set(key, x);
  }
  const rows = w.net.hubs
    .map((h, i) => ({ h, i, ratio: w.lastRatioEq[planIndex(i, e)] ?? 1, reload: w.reloadIndex[planIndex(i, e)] ?? 1, imb: h.imbalance[eq], theft: hubTheftRisk(w, i), out: out.get(i) }))
    .sort((a, b) => b.ratio - a.ratio || a.i - b.i);
  const best = [...lanes.values()].sort((a, b) => b.sum / b.n - a.sum / a.n).slice(0, 12);
  const hubName = (i: number) => w.net.hubs[i]!.name;
  return (
    <Panel title="Rates">
      <div class="row">
        {EQUIPMENT.map((x) => (
          <Btn
            key={x}
            on={x === eq}
            onClick={() => {
              S.ratesEq = x;
              bumpData();
            }}
          >
            {TRAILER_NAME[x]}
          </Btn>
        ))}
      </div>
      <p class="muted small">
        Loads per truck at each market last round, for {TRAILER_NAME[eq].toLowerCase()}s. Hot markets pay on the way out; a loose market is where you go to reload cheaply. Out/in is how much more freight a market ships than it receives; reload is how easily a truck finds its next load there; theft risk is against a quiet road.
      </p>
      <Card title="Markets">
        <table class="mini">
          <thead>
            <tr>
              <th>Market</th>
              <th>Loads/truck</th>
              <th />
              <th>Out/in</th>
              <th>Reload</th>
              <th>Posted</th>
              <th>Theft</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const [t, c] = tag(r.ratio);
              return (
                <tr
                  key={r.i}
                  class={r.i === S.selHub ? "sel" : ""}
                  onClick={() => {
                    S.selHub = r.i;
                    bumpData();
                  }}
                >
                  <td>{r.h.name}</td>
                  <td class="num">{r.ratio.toFixed(2)}</td>
                  <td class={c}>{t}</td>
                  <td class="num">{r.imb.toFixed(2)}</td>
                  <td class="num">{r.reload.toFixed(2)}</td>
                  <td class="num">{r.out ? `${(r.out.sum / r.out.n).toFixed(2)}/mi · ${r.out.n}` : "–"}</td>
                  <td class="num">{r.theft > 1.05 ? `${r.theft.toFixed(1)}×` : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card title="Best-paying lanes on the board">
        {best.length ? (
          <table class="mini">
            <thead>
              <tr>
                <th>Lane</th>
                <th>Loads</th>
                <th>Book now</th>
                <th>Miles</th>
              </tr>
            </thead>
            <tbody>
              {best.map((l) => (
                <tr key={`${l.o}-${l.d}`}>
                  <td>
                    {hubName(l.o)} → {hubName(l.d)}
                  </td>
                  <td class="num">{l.n}</td>
                  <td class="num">{(l.sum / l.n).toFixed(2)}/mi</td>
                  <td class="num">{Math.round(l.miles)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p class="muted">No {TRAILER_NAME[eq].toLowerCase()} loads open right now.</p>
        )}
      </Card>
    </Panel>
  );
}
