import { atlasUrl, kitData } from "./menuart.js";
import { motion } from "./motion.js";
import { stage } from "./stage.js";

/**
 * Money moving on screen (studio/specs/menu-system.md §2.4). The rule: a figure changes once, in place, and the motion
 * happens beside it; no counting up, no rolling digits.
 *
 * - **Pay landing** (one accent, ≤ 1.4 s, the stage's top priority): the toast is up with its figure; at 300 ms a spark
 *   leaves it on a 520 ms arc to the top bar's cash chip, and on arrival the chip's `--sun` glow breathes once (600 ms)
 *   behind the figure. Calm: no spark, a steady ring on the chip for 1.2 s. Still: the ring, no fade.
 * - **Costs leaving** (`costChip`): the cash swaps at once; a chip under it says what left ("−41 FD · settlement fee"),
 *   still for 1.6 s, then fades over 300 ms; several within one tick merge ("−212 FD · 3 costs").
 */

const SPARK_DELAY = 300;
const SPARK_MS = 520;
const GLOW_MS = 600;
const RING_MS = 1200;

/** The cash chip the money lands on. */
const cashChip = (): HTMLElement | null => (typeof document !== "undefined" ? document.querySelector<HTMLElement>(".topbar .cash") : null);

/** The glow (Full) or the ring (Calm, Still) on the cash chip; calls `done` when it has finished. */
function glow(done: () => void): void {
  const chip = cashChip();
  const m = motion();
  if (!chip) return done();
  const cls = m === "full" ? "cashglow" : "cashring";
  chip.classList.remove("cashglow", "cashring");
  void chip.offsetWidth; // restart the class's animation
  chip.classList.add(cls);
  setTimeout(
    () => {
      if (m !== "still") chip.classList.remove(cls);
      else setTimeout(() => chip.classList.remove(cls), RING_MS); // Still: the ring stands, then goes without a fade
      done();
    },
    m === "full" ? GLOW_MS : RING_MS,
  );
}

/** The spark's flight from `from` to the cash chip, over the map or the window, never over a panel's text (§2.4). */
function spark(from: DOMRect, to: DOMRect, done: () => void): void {
  const fx = kitData()?.fx?.pieces?.spark;
  const k = kitData();
  const el = document.createElement("div");
  el.className = "spark-fx";
  const size = fx?.h ?? 32;
  Object.assign(el.style, { width: `${size}px`, height: `${size}px`, left: `${from.left + from.width / 2 - size / 2}px`, top: `${from.top + from.height / 2 - size / 2}px` });
  if (fx && k) {
    el.style.backgroundImage = `url("${atlasUrl(k.fx.image)}")`;
    el.style.backgroundPosition = `${-fx.x}px ${-fx.y}px`;
    el.style.setProperty("--spark-x", `${-fx.x}px`);
    el.style.setProperty("--spark-run", `${-(fx.x + (fx.frames ?? 8) * (fx.step ?? size))}px`);
  }
  document.body.appendChild(el);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  // An arc: up and over, then down onto the chip.
  const anim = el.animate(
    [
      { transform: "translate(0, 0)", opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${Math.min(dy, 0) * 0.5 - 28}px)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px)`, opacity: 0.9 },
    ],
    { duration: SPARK_MS, easing: "cubic-bezier(.45,0,.25,1)", fill: "forwards" },
  );
  anim.onfinish = () => {
    el.remove();
    done();
  };
}

/** A pay landing on the stage: the spark from `fromEl` (the toast's figure) to the cash, then the glow. */
export function payLanding(fromEl: () => Element | null): void {
  stage.add({
    kind: "pay",
    maxMs: 1600,
    play: (done) => {
      if (motion() !== "full") return glow(done);
      setTimeout(() => {
        const from = fromEl()?.getBoundingClientRect();
        const to = cashChip()?.getBoundingClientRect();
        if (!from || !to) return glow(done);
        spark(from, to, () => glow(done));
      }, SPARK_DELAY);
    },
  });
}

/** One chip of costs leaving: the sum, how many, and the label when there's one. */
export interface CostChip {
  fd: number;
  n: number;
  label: string;
  at: number;
}
/** Costs leaving within this many ms of each other merge into one chip (one tick of the world). */
export const MERGE_MS = 250;
export const CHIP_STILL_MS = 1600;
export const CHIP_FADE_MS = 300;

/** Merges a cost into the chip showing now, or starts a new one (pure, for the tests). */
export function mergeCost(chip: CostChip | null, fd: number, label: string, now: number): CostChip {
  // Merged, the chip names the count instead of one cost ("−212 FD · 3 costs").
  if (chip && now - chip.at <= MERGE_MS) return { fd: chip.fd + fd, n: chip.n + 1, label: "", at: now };
  return { fd, n: 1, label, at: now };
}

let chip: CostChip | null = null;
let chipTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
/** The cost chip showing now, or null. */
export const costChip = (): CostChip | null => chip;
export function onCostChip(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}
/** A cost left the cash: the chip under the cash says so (§2.4). */
export function costLeft(fd: number, label: string): void {
  if (!(fd > 0.5)) return;
  chip = mergeCost(chip, fd, label, Date.now());
  if (chipTimer) clearTimeout(chipTimer);
  chipTimer = setTimeout(() => {
    chip = null;
    for (const f of listeners) f();
  }, CHIP_STILL_MS + CHIP_FADE_MS);
  for (const f of listeners) f();
}

/**
 * A delivery's own deduction: posted on the load's ref (`load:N`: the trip's fuel, tolls, upkeep, the lessor's share), or
 * the settlement fee on it (settlement.ts posts `fee:` + the caller's ref, so a delivery's fee is `fee:load:N`). The toast's
 * "yours" and the pay card already net these, so they stay off the cost chip (batches M2 and M4). A fee on a sale, a lease
 * week or a re-post carries its own ref and still chips.
 */
export const deliveryDeduction = (ref: string): boolean => /^(fee:)?load:\d+$/.test(ref);
