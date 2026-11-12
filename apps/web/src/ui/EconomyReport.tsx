import type { JSX } from "preact";
import { REPORT } from "../copy-report.js";
import { econReport } from "../econreport.js";
import { S } from "../state.js";
import { Card } from "./bits.js";

/**
 * "The freight economy" on Intel (econreport.ts): the latest closed month, its title and Iuliia's one line on this
 * player's freight, the sections folded under it so the company list stays in reach. A publication: the same for every
 * player, figures first, frozen at the month's close.
 */
export function EconomyReport(): JSX.Element {
  const g = S.game!;
  const w = g.w;
  const trailer = g.player ? (w.trucksByCompany.get(g.player.id)?.[0]?.trailer ?? null) : null;
  const r = econReport(w, trailer);
  if (!r) return <p class="muted small">{REPORT.none}</p>;
  return (
    <Card class="econreport" title={r.title}>
      {r.iuliia ? <p class="small">{r.iuliia}</p> : null}
      <details class="fold">
        <summary>{REPORT.read}</summary>
        {r.sections.map((s) => (
          <div class="stack" key={s.title}>
            <p class="label">{s.title}</p>
            <div class="econwrap">
              <table class="econ">
                <thead>
                  <tr>
                    <th />
                    <th>{REPORT.colNow}</th>
                    <th>{REPORT.colPrior}</th>
                    <th>{REPORT.colYear}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.rows.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td class="num">{row.now}</td>
                      <td class="num muted">{row.prior ?? "—"}</td>
                      <td class="num muted">{row.year ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </details>
    </Card>
  );
}
