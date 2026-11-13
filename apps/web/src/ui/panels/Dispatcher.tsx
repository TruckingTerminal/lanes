import type { JSX } from "preact";
import { ordersWaitForHand, type StandingOrder } from "@lanes/engine";
import { DISPATCHER } from "../../copy.js";
import { DEFAULT_ORDERS, DISPATCHER_ORDERS, PLAYER_DISPATCHER_ORDERS } from "../../game.js";
import { act, me, onWorldReset, S, useData } from "../../state.js";
import { PENDING_RULES } from "../../copy-pending-rules.js";
import { PENDING } from "../../copy-pending.js";
import type { EconomyConfig } from "@lanes/config";
import { Btn, Card, Label } from "../bits.js";
import { Iuliia } from "../Walkthrough.js";
import { iuliiaFirst } from "../../iuliia.js";
import { formOf, ordersFrom } from "../../dispatcherform.js";

const num = (id: string): number => Number((document.getElementById(id) as HTMLInputElement | null)?.value);
const checked = (id: string): boolean => Boolean((document.getElementById(id) as HTMLInputElement | null)?.checked);

/** The bidding rules a switch-off set aside, per company, so switching back on restores them (diary 1, row 11). */
const setAside = new Map<number, StandingOrder[]>();
onWorldReset(() => setAside.clear());

/**
 * The dispatcher (specs/first-ten-minutes.md, S9): before a one-truck company's first bid by hand, the switch shows the
 * saved orders and works (R1: the player's choice is never overridden; an "off" before the first load stays off, where a
 * disabled switch let the defaults take over at the first load), and Iuliia's line (freeEntry.firstBidByHand: the orders wait for the owner's first call). After
 * it, the switch, three rows and Save, with "More rules" folding the rest. No re-post rule: what the engine runs as
 * re-brokering is fraud, and no player screen offers it (the director's brokerage brief); saving drops one held from before.
 */
export function DispatcherCard(): JSX.Element {
  useData();
  const w = S.game!.w;
  const c = me();
  const waiting = ordersWaitForHand(w, c);
  const find = <K extends StandingOrder["kind"]>(k: K) => c.orders.find((o): o is Extract<StandingOrder, { kind: K }> => o.kind === k);
  const bid = find("bid");
  const floor = find("floor");
  const repo = find("reposition");
  const bn = find("bookNow");
  const ct = find("contracts");
  const f0 = formOf(c.orders);
  const on = !waiting && Boolean(bid);
  // Client batch 8d, fail 2 (QA's 8b replay): the form is data (dispatcherform.ts), so Save with nothing changed writes the
  // orders it was shown; the contracts box is the offers (acceptOffers), never just "a contracts order".
  const orders = (bidding: boolean): StandingOrder[] =>
    ordersFrom(
      {
        dh: num("o-dh"),
        pct: num("o-pct"),
        floor: num("o-floor"),
        repo: checked("o-repo"),
        repoRounds: num("o-repo-r"),
        bn: checked("o-bn"),
        bnPct: num("o-bn-pct"),
        ct: checked("o-ct"),
        ctSpot: (document.getElementById("o-ct-spot") as HTMLSelectElement | null)?.value ?? f0.ctSpot,
        homeAfter: num("o-home-after"),
      },
      bidding,
      c.orders,
    );
  const save = (bidding: boolean, said?: string) => act({ type: "set_standing_orders", orders: orders(bidding) }, DISPATCHER.saved, said);
  // The switch keeps the rules: off sets the bidding rules aside, on brings them back (or the defaults, the first time).
  const flip = (to: boolean) => {
    const rest = c.orders.filter((o) => !DISPATCHER_ORDERS.has(o.kind));
    if (!to) setAside.set(c.id, c.orders.filter((o) => DISPATCHER_ORDERS.has(o.kind)));
    const back = setAside.get(c.id) ?? PLAYER_DISPATCHER_ORDERS;
    act({ type: "set_standing_orders", orders: to ? [...back, ...rest] : rest }, DISPATCHER.saved, to ? "dispatcher:on" : "dispatcher:off");
  };
  const switchRow = (
    <label class="row switchrow">
      <input type="checkbox" role="switch" checked={waiting ? Boolean(bid) : on} onChange={(e) => flip((e.currentTarget as HTMLInputElement).checked)} />
      <span>{DISPATCHER.switchLabel}</span>
    </label>
  );
  if (waiting) {
    return (
      <Card class="dispatcher" title={DISPATCHER.title}>
        {switchRow}
        <div class="caption">
          <Iuliia mood="idle" size={64} />
          <span class="small">{DISPATCHER.waiting}</span>
        </div>
      </Card>
    );
  }
  return (
    <Card class="dispatcher" title={DISPATCHER.title} key={c.orders.length}>
      {switchRow}
      <div class="row">
        <Label for="o-pct">{bid?.price.mode === "ceilingPct" ? "Bid at" : (bid?.price.mode ?? "clearsNear") === "clearsNear" ? DISPATCHER.bidAtClears : DISPATCHER.bidAt}</Label>
        <input type="number" id="o-pct" step="1" min="0" max="120" defaultValue={String(f0.pct)} />
        <span class="muted">{bid?.price.mode === "ceilingPct" ? DISPATCHER.ceilingSuffix : "%"}</span>
      </div>
      <div class="row">
        <Label for="o-dh">{DISPATCHER.emptyUpTo}</Label>
        <input type="number" id="o-dh" min="0" max="150" defaultValue={String(f0.dh)} />
        <span class="muted">mi</span>
      </div>
      <div class="row">
        <Label for="o-home-after">{DISPATCHER.homeAfter}</Label>
        <input type="number" id="o-home-after" min="1" max="365" defaultValue={String(f0.homeAfter)} />
        <span class="muted">days</span>
      </div>
      <details class="fold">
        <summary onClick={() => iuliiaFirst("dispatcher:rules")}>{DISPATCHER.moreRules}</summary>
        <div class="row">
          <Label for="o-floor">{PENDING.floorLabel}</Label>
          <input type="number" id="o-floor" min="0" max="50" defaultValue={String(f0.floor)} />
          <span class="muted">%</span>
        </div>
        {/* The floor relaxes as the truck needs to move (standingOrders.ts floorRate, desperation): said, not "never below" (QA, client batch 4). */}
        <p class="muted small">{floorRelaxesLine(w.cfg)}</p>
        <div class="row">
          <label class="label">
            <input type="checkbox" id="o-bn" defaultChecked={f0.bn} /> {DISPATCHER.bookNow}
          </label>
          <input type="number" id="o-bn-pct" min="0" max="100" defaultValue={String(f0.bnPct)} />
          <span class="muted">%</span>
        </div>
        <div class="row">
          <label class="label">
            <input type="checkbox" id="o-repo" defaultChecked={f0.repo} /> {DISPATCHER.moveIdle}
          </label>
          <input type="number" id="o-repo-r" min="1" max="20" defaultValue={String(f0.repoRounds)} />
          <span class="muted">{DISPATCHER.idleRounds}</span>
        </div>
        <div class="row">
          <label class="label">
            <input type="checkbox" id="o-ct" defaultChecked={f0.ct} /> Contracts: take offers from local shippers and
          </label>
          <select id="o-ct-spot" defaultValue={f0.ctSpot}>
            <option value="always">honor every tender</option>
            <option value="0.1">let a tender lapse when spot is 10% above the contract</option>
            <option value="0.15">let it lapse at 15% above</option>
            <option value="0.25">let it lapse at 25% above</option>
          </select>
        </div>
      </details>
      {/* businesses.parking.stopInTown: where a truck sleeps when no site is in reach (the company's choice, kept by the engine). */}
      {w.cfg.businesses.parking.stopInTown ? (
        <label class="row switchrow">
          <input type="checkbox" role="switch" checked={c.nightStop === "town"} onChange={(e) => act({ type: "set_night_stop", choice: (e.currentTarget as HTMLInputElement).checked ? "town" : "shoulder" }, PENDING_RULES.nightStopSaved)} />
          <span class="small">{PENDING_RULES.nightStopLabel}</span>
        </label>
      ) : null}
      <div class="row">
        <Btn primary onClick={() => save(on)}>
          {DISPATCHER.save}
        </Btn>
        <Btn onClick={() => act({ type: "set_standing_orders", orders: DEFAULT_ORDERS }, DISPATCHER.defaults)}>Defaults</Btn>
      </div>
    </Card>
  );
}

/** The dispatcher's floor as the engine applies it (bookNow.desperation): how it eases, from the config's own figures. */
function floorRelaxesLine(cfg: EconomyConfig): string {
  const k = cfg.bookNow.desperation;
  return PENDING.floorRelaxes(k.idleHours, k.awayAfterDays, k.awayAfterDays + k.awayDays, Math.round(k.belowBreakEven * 100));
}
