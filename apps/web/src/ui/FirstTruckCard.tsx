import type { JSX } from "preact";
import type { FirstTruckVerdict } from "../figures.js";
import { PENDING } from "../copy-pending.js";
import { bumpData, S, setTab } from "../state.js";
import { Btn } from "./bits.js";

/**
 * The first-truck verdict as one block (client batch 8a item 57, the director's ruling A): its name, the one verdict, the
 * figures folded under "Why", and "See it", which opens the Dealer on the truck's row. The Dealer's card, its teaser and
 * Iuliia's page all show it, so each says the same.
 */
export function FirstTruckVerdictBlock({ f, here = false }: { f: FirstTruckVerdict; here?: boolean }): JSX.Element {
  if (f.ordered) return <p class="small"><b>{`${f.figure}.`}</b></p>;
  return (
    <div class="stack">
      {f.figure ? (
        <p>
          <b>{f.figure}</b>
        </p>
      ) : null}
      <p class="small">{f.verdict}</p>
      {f.why.length ? (
        <details class="fold">
          <summary>{PENDING.whyLabel}</summary>
          {f.why.map((line) => (
            <p class="muted small" key={line}>
              {line}
            </p>
          ))}
        </details>
      ) : null}
      {f.open ? (
        <div class="row">
          <Btn sm onClick={() => openTruckRow(f.open!, here)}>
            {PENDING.seeIt}
          </Btn>
        </div>
      ) : null}
    </div>
  );
}

/** Brings the truck's row on the Dealer into view, opening the Dealer first when the card is elsewhere. */
export function openTruckRow(id: string, here: boolean): void {
  const go = () => document.getElementById(id)?.scrollIntoView({ block: "center", behavior: "smooth" });
  if (here) return go();
  S.dealerFocus = id;
  setTab("market");
  bumpData();
}
