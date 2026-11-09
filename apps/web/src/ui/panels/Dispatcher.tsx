import type { JSX } from "preact";
import { ordersWaitForHand, type StandingOrder } from "@lanes/engine";
import { DISPATCHER } from "../../copy.js";
import { DEFAULT_ORDERS, DISPATCHER_ORDERS, PLAYER_DISPATCHER_ORDERS } from "../../game.js";
import { act, me, onWorldReset, S, useData } from "../../state.js";
import { Btn, Card, Label } from "../bits.js";
import { Iuliia } from "../Walkthrough.js";
import { iuliiaFirst } from "../../iuliia.js";

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
  const hm = find("homeTime");
  const ct = find("contracts");
  const on = !waiting && Boolean(bid);
  const spotNow = ct ? (ct.spotAbovePct === null ? "always" : String(ct.spotAbovePct)) : "always";
  const def = <K extends StandingOrder["kind"]>(k: K) => [...PLAYER_DISPATCHER_ORDERS, ...DEFAULT_ORDERS].find((o): o is Extract<StandingOrder, { kind: K }> => o.kind === k);
  const orders = (bidding: boolean): StandingOrder[] => {
    const dh = Math.max(0, Math.min(150, num("o-dh") || 150));
    const list: StandingOrder[] = [];
    if (bidding) {
      list.push({ kind: "bid", maxDeadheadMi: dh, price: { mode: bid?.price.mode ?? "clearsNear", pct: Math.max(0, num("o-pct")) / 100 } });
      list.push({ kind: "floor", breakEvenPlusPct: Math.max(0, num("o-floor")) / 100 });
      if (checked("o-repo")) list.push({ kind: "reposition", afterIdleRounds: Math.max(1, num("o-repo-r")), to: { openLoadsWithinMi: 400 } });
      if (checked("o-bn")) list.push({ kind: "bookNow", breakEvenPlusPct: Math.min(5, Math.max(0, num("o-bn-pct") / 100 || 0)), maxDeadheadMi: dh });
      if (checked("o-ct")) {
        const spot = (document.getElementById("o-ct-spot") as HTMLSelectElement).value;
        list.push({ kind: "contracts", acceptOffers: true, spotAbovePct: spot === "always" ? null : Number(spot), maxDeadheadMi: dh });
      }
    }
    list.push({ kind: "homeTime", afterDays: Math.min(365, Math.max(1, Math.round(num("o-home-after")) || 21)), restDays: hm?.restDays ?? def("homeTime")?.restDays ?? 5 });
    return list;
  };
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
        <input type="number" id="o-pct" step="1" min="0" max="120" defaultValue={String(Math.round((bid?.price.pct ?? def("bid")?.price.pct ?? 0) * 100))} />
        <span class="muted">{bid?.price.mode === "ceilingPct" ? DISPATCHER.ceilingSuffix : "%"}</span>
      </div>
      <div class="row">
        <Label for="o-dh">{DISPATCHER.emptyUpTo}</Label>
        <input type="number" id="o-dh" min="0" max="150" defaultValue={String(bid?.maxDeadheadMi ?? 150)} />
        <span class="muted">mi</span>
      </div>
      <div class="row">
        <Label for="o-home-after">{DISPATCHER.homeAfter}</Label>
        <input type="number" id="o-home-after" min="1" max="365" defaultValue={String(hm?.afterDays ?? def("homeTime")?.afterDays ?? 21)} />
        <span class="muted">days</span>
      </div>
      <details class="fold">
        <summary onClick={() => iuliiaFirst("dispatcher:rules")}>{DISPATCHER.moreRules}</summary>
        <div class="row">
          <Label for="o-floor">{DISPATCHER.floor}</Label>
          <input type="number" id="o-floor" min="0" max="50" defaultValue={String(Math.round((floor?.breakEvenPlusPct ?? 0) * 100))} />
          <span class="muted">%</span>
        </div>
        <div class="row">
          <label class="label">
            <input type="checkbox" id="o-bn" defaultChecked={Boolean(bn)} /> {DISPATCHER.bookNow}
          </label>
          <input type="number" id="o-bn-pct" min="0" max="100" defaultValue={String(Math.round((bn?.breakEvenPlusPct ?? 0.2) * 100))} />
          <span class="muted">%</span>
        </div>
        <div class="row">
          <label class="label">
            <input type="checkbox" id="o-repo" defaultChecked={Boolean(repo)} /> {DISPATCHER.moveIdle}
          </label>
          <input type="number" id="o-repo-r" min="1" max="20" defaultValue={String(repo?.afterIdleRounds ?? 2)} />
          <span class="muted">{DISPATCHER.idleRounds}</span>
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
      </details>
      <div class="row">
        <Btn primary onClick={() => save(on)}>
          {DISPATCHER.save}
        </Btn>
        <Btn onClick={() => act({ type: "set_standing_orders", orders: DEFAULT_ORDERS }, DISPATCHER.defaults)}>Defaults</Btn>
      </div>
    </Card>
  );
}
