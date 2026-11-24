import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { ordersWaitForHand, type StandingOrder } from "@lanes/engine";
import { DISPATCHER } from "../../copy.js";
import { DEFAULT_ORDERS, DISPATCHER_ORDERS, PLAYER_DISPATCHER_ORDERS } from "../../game.js";
import { act, me, onWorldReset, S, useData } from "../../state.js";
import { PENDING_RULES } from "../../copy-pending-rules.js";
import { PENDING } from "../../copy-pending.js";
import type { EconomyConfig } from "@lanes/config";
import { Btn, Card, Label } from "../bits.js";
import { Julia } from "../Walkthrough.js";
import { iuliiaFirst } from "../../iuliia.js";
import { formOf, formOrders, ordersFrom } from "../../dispatcherform.js";
import { selectOnFocus } from "../fields.js";

const num = (id: string): number => Number((document.getElementById(id) as HTMLInputElement | null)?.value);
const checked = (id: string): boolean => Boolean((document.getElementById(id) as HTMLInputElement | null)?.checked);

/** The bidding rules a switch-off set aside, per company, so switching back on restores them (diary 1, row 11). */
const setAside = new Map<number, StandingOrder[]>();
/**
 * What the player has typed in the form and not saved, per company and field id (the player round of 2026-11-24: the switch
 * and a change of tab dropped it). The form is shown from it, over the saved orders, until Save, the switch or Defaults.
 */
const drafts = new Map<number, Record<string, string | boolean>>();
/**
 * The orders the form was last written from (Save, Defaults, or the switch carrying a draft), per company. Live, an order
 * takes effect at a later game minute, so until the saved orders read the same the form is shown from these, under the draft.
 */
const sent = new Map<number, readonly StandingOrder[]>();
onWorldReset(() => {
  setAside.clear();
  drafts.clear();
  sent.clear();
});

/** Records a field's change into the company's draft; true when the draft is new (the form then says it isn't saved). */
export function recordDraft(companyId: number, target: { id?: string; type?: string; value?: string; checked?: boolean } | null): boolean {
  if (!target?.id || !target.id.startsWith("o-")) return false;
  const fresh = !drafts.has(companyId);
  const d = drafts.get(companyId) ?? {};
  d[target.id] = target.type === "checkbox" ? Boolean(target.checked) : String(target.value ?? "");
  drafts.set(companyId, d);
  return fresh;
}
export const draftOf = (companyId: number): Readonly<Record<string, string | boolean>> | undefined => drafts.get(companyId);
export const clearDraft = (companyId: number): void => void drafts.delete(companyId);
/** Records the orders the form was written from; the draft goes, and the form is shown from these until they're the rules. */
export const recordSent = (companyId: number, orders: readonly StandingOrder[]): void => {
  drafts.delete(companyId);
  sent.set(companyId, orders);
};
export const sentOf = (companyId: number): readonly StandingOrder[] | undefined => sent.get(companyId);
/** What a field shows: the draft's value for it, else `shown` (the form of what was sent, else of the saved orders). */
export const fieldOf = (draft: Readonly<Record<string, string | boolean>> | undefined, id: string, shown: number | string | boolean): string | boolean => {
  const d = draft?.[id];
  if (typeof shown === "boolean") return typeof d === "boolean" ? d : shown;
  return typeof d === "string" ? d : String(shown);
};
/** The orders the form is shown from for these saved ones (formOrders); what was sent is let go once the saved read the same. */
export function shownOrders(companyId: number, saved: readonly StandingOrder[]): readonly StandingOrder[] {
  const view = formOrders(saved, sent.get(companyId));
  if (view === saved) sent.delete(companyId);
  return view;
}

/**
 * The dispatcher (specs/first-ten-minutes.md, S9): before a one-truck company's first bid by hand, the switch shows the
 * saved orders and works (R1: the player's choice is never overridden; an "off" before the first load stays off, where a
 * disabled switch let the defaults take over at the first load), and Julia's line (freeEntry.firstBidByHand: the orders wait for the owner's first call). After
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
  const on = !waiting && Boolean(bid);
  // Switched off, the form shows the rules the switch set aside (what on brings back), not the defaults.
  const shown = on || waiting ? c.orders : [...(setAside.get(c.id) ?? PLAYER_DISPATCHER_ORDERS), ...c.orders.filter((o) => !DISPATCHER_ORDERS.has(o.kind))];
  // A field shows the draft, then what was last written from the form, then the saved orders.
  const view = shownOrders(c.id, shown);
  const f0 = formOf(view);
  const draft = draftOf(c.id);
  const text = (id: string, shownAs: number | string): string => fieldOf(draft, id, shownAs) as string;
  const tick = (id: string, shownAs: boolean): boolean => fieldOf(draft, id, shownAs) as boolean;
  // A Save remounts the form, so its fields show what was written (a −5 saved as 0 reads 0, not −5), before it takes effect.
  const [saves, setSaves] = useState(0);
  const [, redraw] = useState(0);
  const record = (e: Event) => {
    if (recordDraft(c.id, e.target as HTMLInputElement | null)) redraw((n) => n + 1);
  };
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
      view,
    );
  const save = (bidding: boolean, said?: string) => {
    const list = orders(bidding);
    // Saved while switched off, the form's bidding rules are the ones the switch brings back.
    const rules = orders(true);
    if (!bidding) setAside.set(c.id, rules.filter((o) => DISPATCHER_ORDERS.has(o.kind)));
    recordSent(c.id, rules);
    setSaves((n) => n + 1);
    return act({ type: "set_standing_orders", orders: list }, DISPATCHER.saved, said);
  };
  // The switch keeps the rules: off sets the bidding rules aside, on brings them back (or the defaults, the first time).
  // The player round of 2026-11-24: what's typed and not saved goes with the switch, never dropped: on, the form's rules
  // are the ones switched on; off, they are the ones set aside, and the form's home rule is saved. So are rules written and
  // not yet in effect, which the form shows.
  const flip = (to: boolean) => {
    const rest = c.orders.filter((o) => !DISPATCHER_ORDERS.has(o.kind));
    if (!waiting && (draftOf(c.id) || sentOf(c.id))) {
      const typed = orders(true);
      const bidding = typed.filter((o) => DISPATCHER_ORDERS.has(o.kind));
      const home = typed.filter((o) => o.kind === "homeTime");
      const others = rest.filter((o) => o.kind !== "homeTime");
      if (!to) setAside.set(c.id, bidding);
      recordSent(c.id, typed);
      act({ type: "set_standing_orders", orders: to ? [...bidding, ...home, ...others] : [...home, ...others] }, DISPATCHER.saved, to ? "dispatcher:on" : "dispatcher:off");
      return;
    }
    if (!to) setAside.set(c.id, c.orders.filter((o) => DISPATCHER_ORDERS.has(o.kind)));
    const back = setAside.get(c.id) ?? PLAYER_DISPATCHER_ORDERS;
    act({ type: "set_standing_orders", orders: to ? [...back, ...rest] : rest }, DISPATCHER.saved, to ? "dispatcher:on" : "dispatcher:off");
  };
  const switchOn = waiting ? Boolean(bid) : on;
  const switchRow = (
    <label class="row switchrow">
      {/* The switch's state in the markup too (aria-checked), for readers that don't take a checkbox's own state. */}
      <input type="checkbox" role="switch" checked={switchOn} aria-checked={switchOn} onChange={(e) => flip((e.currentTarget as HTMLInputElement).checked)} />
      <span>{DISPATCHER.switchLabel}</span>
    </label>
  );
  if (waiting) {
    return (
      <Card class="dispatcher" title={DISPATCHER.title}>
        {switchRow}
        <div class="caption">
          <Julia mood="idle" size={64} />
          <span class="small">{DISPATCHER.waiting}</span>
        </div>
      </Card>
    );
  }
  return (
    <Card class="dispatcher" title={DISPATCHER.title} key={`${c.orders.length}:${on}:${saves}`}>
      {switchRow}
      {/* Each change lands in the draft as it's typed, so leaving the tab or flipping the switch keeps it. */}
      <div class="stack dispatcherform" onInput={record} onChange={record}>
      <div class="row">
        <Label for="o-pct">{bid?.price.mode === "ceilingPct" ? "Bid at" : (bid?.price.mode ?? "clearsNear") === "clearsNear" ? DISPATCHER.bidAtClears : DISPATCHER.bidAt}</Label>
        <input type="number" id="o-pct" step="1" min="0" max="120" defaultValue={text("o-pct", f0.pct)} onFocus={selectOnFocus.onFocus} onMouseUp={selectOnFocus.onMouseUp} onBlur={selectOnFocus.onBlur} />
        <span class="muted">{bid?.price.mode === "ceilingPct" ? DISPATCHER.ceilingSuffix : "%"}</span>
      </div>
      <div class="row">
        <Label for="o-dh">{DISPATCHER.emptyUpTo}</Label>
        <input type="number" id="o-dh" min="0" max="150" defaultValue={text("o-dh", f0.dh)} onFocus={selectOnFocus.onFocus} onMouseUp={selectOnFocus.onMouseUp} onBlur={selectOnFocus.onBlur} />
        <span class="muted">mi</span>
      </div>
      <div class="row">
        <Label for="o-home-after">{DISPATCHER.homeAfter}</Label>
        <input type="number" id="o-home-after" min="1" max="365" defaultValue={text("o-home-after", f0.homeAfter)} onFocus={selectOnFocus.onFocus} onMouseUp={selectOnFocus.onMouseUp} onBlur={selectOnFocus.onBlur} />
        <span class="muted">days</span>
      </div>
      <details class="fold">
        <summary onClick={() => iuliiaFirst("dispatcher:rules")}>{DISPATCHER.moreRules}</summary>
        <div class="row">
          <Label for="o-floor">{PENDING.floorLabel}</Label>
          <input type="number" id="o-floor" min="0" max="50" defaultValue={text("o-floor", f0.floor)} onFocus={selectOnFocus.onFocus} onMouseUp={selectOnFocus.onMouseUp} onBlur={selectOnFocus.onBlur} />
          <span class="muted">%</span>
        </div>
        {/* The floor relaxes as the truck needs to move (standingOrders.ts floorRate, desperation): said, not "never below" (QA, client batch 4). */}
        <p class="muted small">{floorRelaxesLine(w.cfg)}</p>
        <div class="row">
          <label class="label">
            <input type="checkbox" id="o-bn" defaultChecked={tick("o-bn", f0.bn)} /> {DISPATCHER.bookNow}
          </label>
          <input type="number" id="o-bn-pct" min="0" max="100" defaultValue={text("o-bn-pct", f0.bnPct)} onFocus={selectOnFocus.onFocus} onMouseUp={selectOnFocus.onMouseUp} onBlur={selectOnFocus.onBlur} />
          <span class="muted">%</span>
        </div>
        <div class="row">
          <label class="label">
            <input type="checkbox" id="o-repo" defaultChecked={tick("o-repo", f0.repo)} /> {DISPATCHER.moveIdle}
          </label>
          <input type="number" id="o-repo-r" min="1" max="20" defaultValue={text("o-repo-r", f0.repoRounds)} onFocus={selectOnFocus.onFocus} onMouseUp={selectOnFocus.onMouseUp} onBlur={selectOnFocus.onBlur} />
          <span class="muted">{DISPATCHER.idleRounds}</span>
        </div>
        <div class="row">
          <label class="label">
            <input type="checkbox" id="o-ct" defaultChecked={tick("o-ct", f0.ct)} /> Contracts: take offers from local shippers and
          </label>
          <select id="o-ct-spot" defaultValue={text("o-ct-spot", f0.ctSpot)}>
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
          <input type="checkbox" role="switch" checked={c.nightStop === "town"} aria-checked={c.nightStop === "town"} onChange={(e) => act({ type: "set_night_stop", choice: (e.currentTarget as HTMLInputElement).checked ? "town" : "shoulder" }, PENDING_RULES.nightStopSaved)} />
          <span class="small">{w.cfg.businesses.parking.stopInTownMidLeg ? PENDING.nightStopLabelMidLeg(w.cfg.businesses.parking.stopInTownMaxMi ?? null) : PENDING_RULES.nightStopLabel}</span>
        </label>
      ) : null}
      </div>
      {draft ? <p class="small warn dispatcherunsaved">{PENDING.dispatcherUnsaved}</p> : null}
      <div class="row">
        <Btn primary onClick={() => save(on)}>
          {DISPATCHER.save}
        </Btn>
        <Btn
          onClick={() => {
            recordSent(c.id, DEFAULT_ORDERS);
            setSaves((n) => n + 1);
            act({ type: "set_standing_orders", orders: DEFAULT_ORDERS }, DISPATCHER.defaults);
          }}
        >
          Defaults
        </Btn>
      </div>
    </Card>
  );
}

/** The dispatcher's floor as the engine applies it (bookNow.desperation): how it eases, from the config's own figures. */
function floorRelaxesLine(cfg: EconomyConfig): string {
  const k = cfg.bookNow.desperation;
  return PENDING.floorRelaxes(k.idleHours, k.awayAfterDays, k.awayAfterDays + k.awayDays, Math.round(k.belowBreakEven * 100));
}
