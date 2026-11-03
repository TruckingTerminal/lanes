import type { JSX } from "preact";
import { chipCash, chipFd, type ChipPair } from "../board.js";
import { CHIP } from "../copy.js";
import { cls } from "../format.js";

/**
 * R14's chip: "+607 · cash −103 · held 710" while the lease holds (the held part on a laptop only; on a phone it's on the
 * sheet), "+607" when nothing is held. Coloured by the profit; the cash figure amber when negative. Never wraps.
 */
export function ProfitChip({ p }: { p: ChipPair }): JSX.Element {
  const up = p.profit >= 0;
  const held = p.held >= 0.5;
  const label = held ? CHIP.a11y(chipCash(p.profit), chipCash(p.cash), chipFd(p.held)) : CHIP.a11yNoHold(chipCash(p.profit));
  return (
    <span class={cls("chip", "profitchip", up ? "good" : "bad")} aria-label={label} title={label}>
      {CHIP.profit(chipFd(p.profit), up)}
      {held ? (
        <>
          {" · "}
          <span class={p.cash < -0.5 ? "warn" : undefined}>{CHIP.cash(chipCash(p.cash))}</span>
          <span class="laptop-only">
            {" · "}
            {CHIP.held(chipFd(p.held))}
          </span>
        </>
      ) : null}
    </span>
  );
}
