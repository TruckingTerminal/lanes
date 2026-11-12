import type { JSX } from "preact";
import type { FirstTruckVerdict } from "../figures.js";
import { PENDING } from "../copy-pending.js";
import { bumpData, S, setTab } from "../state.js";
import { Bar, Btn } from "./bits.js";

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
      {/* Client batch 8c item 70: the way to a sound truck as a bar, with the listing watch under it. */}
      {f.progress !== null ? (
        <div class="row small" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(f.progress * 100)} aria-label={PENDING.soundProgress(`${Math.floor(f.progress * 100)}%`)}>
          <Bar share={f.progress} />
          <span class="muted">{PENDING.soundProgress(`${Math.floor(f.progress * 100)}%`)}</span>
        </div>
      ) : null}
      {f.watch ? <p class="muted small">{f.watch}</p> : null}
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
