import type { JSX } from "preact";
import type { Truck, World } from "@lanes/engine";
import { PENDING } from "../copy-pending.js";
import { MOVE, TRUCK } from "../copy.js";
import { exitsFor, type Exit } from "../exits.js";
import { act, me, S, truckNo } from "../state.js";
import { Btn, Card } from "./bits.js";
import { confirmSpend } from "./Confirm.js";

/** An exit's line: where, how far, what it costs, how long, and the loads that pay there. */
export function exitLine(w: World, e: Exit): string {
  return e.home ? PENDING.exitHome(e.mi, e.fd, e.time, e.pays) : PENDING.exitTo(w.net.hubs[e.hub]!.name, e.mi, e.fd, e.time, e.pays);
}
/** An exit's button: home is a run home to work, never days off (the director, 2026-11-09). */
export function exitButton(w: World, e: Exit): string {
  return e.home ? PENDING.sendHomeWork : MOVE.sendTo(w.net.hubs[e.hub]!.name);
}

/** Takes a way out: an empty run, priced and past R6's card when it's a large share of cash, as the Truck card's moves. */
export function takeExit(t: Truck, e: Exit, ev?: MouseEvent): void {
  const w = S.game!.w;
  const name = w.net.hubs[e.hub]!.name;
  const run = () => act({ type: "reposition_truck", truckId: t.id, hubId: w.net.hubs[e.hub]!.id }, e.home ? PENDING.sendHomeWorkToast : TRUCK.sentEmpty, "truck:sendEmpty");
  confirmSpend({ verb: exitButton(w, e), item: `truck ${truckNo(t.id)}`, costFd: e.costFd, does: e.home ? PENDING.sendHomeWorkDoes : MOVE.confirmEmpty(name), risk: MOVE.confirmRisk, run }, ev);
}

/**
 * The ways-out sheet (the director, 2026-11-09): a stranded truck's exits first, cheapest first, each with its price and
 * the loads that pay where it ends; the board follows below it (Board.tsx), never an empty board alone.
 */
export function WaysOutCard({ t }: { t: Truck }): JSX.Element {
  return (
    <Card class="waysout" title={PENDING.waysOutTitle}>
      <WaysOutRows t={t} />
    </Card>
  );
}

/** The exits' rows alone, labelled, for a card that has its own title (the Truck tab's stranded card). */
export function WaysOutRows({ t, label }: { t: Truck; label?: boolean }): JSX.Element {
  const w = S.game!.w;
  const exits = exitsFor(w, me(), t).slice(0, 4);
  return (
    <>
      {label ? <h4 class="label">{PENDING.waysOutTitle}</h4> : null}
      {exits.length ? (
        exits.map((e, i) => (
          <div class="row" key={e.hub}>
            <span class="small grow">{exitLine(w, e)}</span>
            <Btn sm primary={i === 0} onClick={(ev) => takeExit(t, e, ev)}>
              {exitButton(w, e)}
            </Btn>
          </div>
        ))
      ) : (
        <p class="small muted">{PENDING.strandedNone}</p>
      )}
    </>
  );
}
