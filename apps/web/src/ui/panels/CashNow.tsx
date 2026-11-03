import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { cashNowRate, companyAccount, dayOf, type Company, type Receivable, type World } from "@lanes/engine";
import { CASHNOW } from "../../copy.js";
import { fdFull, shortDate, plural } from "../../format.js";
import { invoices } from "../../ledger.js";
import { bumpData, order, S, useData } from "../../state.js";
import { Btn } from "../bits.js";
import { Fig } from "../Explain.js";

/**
 * Cash it now (UX's finance.md draft 2, the writer's finance-strings.md; receivables.ts cashNowRate / cashInvoice): every
 * open invoice can be sold to the NPC factor today, under a contract at its rate plus the aging surcharge, without one at
 * the spot rate plus the same. One row component for Money's "Owed to you", Finance's open invoices and the brokerage's
 * Money. Behind `token.payment.cashNow.enabled`; with it off the rows are the plain invoice list.
 */

export const cashNowOn = (w: World): boolean => w.cfg.token.payment.enabled && w.cfg.token.payment.cashNow.enabled;

const pct1 = (x: number): string => `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
const fd = (x: number): string => fdFull(x);

/** The engine's reason, in the writer's words. */
function refusal(why: string): string {
  if (why.startsWith("paper between your own")) return CASHNOW.refuseOwn;
  if (why.startsWith("a player shipper")) return CASHNOW.refusePlayer;
  if (why.startsWith("the company is being wound up")) return CASHNOW.refuseLiquidation;
  if (why.startsWith("it falls due today")) return CASHNOW.refuseDueToday;
  return CASHNOW.refusePaid;
}

/** A cashed invoice stays on its row, greyed, until its due day (UX); the world keeps no record of it, so the page does. */
export interface Cashed {
  id: number;
  day: number;
  landsFd: number;
  dueDay: number;
  lane: string;
}

/** The company's invoice rows: line 1 the lane, the amount and the due day; line 2 what cashing it now lands, and the button. */
export function InvoiceRows({ c }: { c: Company }): JSX.Element | null {
  useData();
  const w = S.game!.w;
  const today = dayOf(w.t, w.cfg);
  const open = invoices(w, c);
  const cashed = S.cashed.filter((x) => x.dueDay > today && open.every((r) => r.id !== x.id));
  const plan = S.cashPlan.filter((id) => open.some((r) => r.id === id));
  // What now? chose these (rule 1): one opens its sheet; several get one button for them all.
  const [sheet, setSheet] = useState<number | null>(plan.length === 1 ? plan[0]! : null);
  if (!open.length && !cashed.length) return null;
  const on = cashNowOn(w);
  return (
    <div class="stack invoicerows">
      {on && plan.length > 1 ? <CashSeveral c={c} ids={plan} /> : null}
      {open.map((inv) => {
        const r = w.receivables.find((x) => x.id === inv.id)!;
        const lane = S.invoiceLanes.get(r.id) ?? `#${r.id}`;
        const rate = on ? cashNowRate(w, c, r) : null;
        return (
          <div class="stack invoicerow" key={r.id}>
            <span class="small">
              {lane} · {fd(r.amountFd)} FD · due {shortDate(r.dueDay)} ({plural(Math.max(0, r.dueDay - today), "day")})
            </span>
            {rate === null ? null : typeof rate === "string" ? (
              <span class="muted small">{refusal(rate)}</span>
            ) : sheet === r.id ? (
              <CashSheet c={c} r={r} rate={rate} lane={lane} onDone={() => setSheet(null)} />
            ) : (
              <span class="row small">
                <span>
                  <Fig k="invoice.cashNowLands" label={CASHNOW.landsLabel} ctx={{ invoiceId: r.id }}>
                    {CASHNOW.rowLine(fd(r.amountFd * (1 - rate)), fd(r.amountFd * rate))[0]}
                  </Fig>{" "}
                  <Fig k="invoice.cashNowFee" label={CASHNOW.feeLabel} ctx={{ invoiceId: r.id }}>
                    {CASHNOW.rowLine(fd(r.amountFd * (1 - rate)), fd(r.amountFd * rate))[1]}
                  </Fig>
                </span>
                <span class="grow" />
                <Btn sm onClick={() => setSheet(r.id)}>
                  {CASHNOW.rowButton}
                </Btn>
              </span>
            )}
          </div>
        );
      })}
      {cashed.map((x) => (
        <div class="stack invoicerow muted" key={`cashed-${x.id}`}>
          <span class="small">
            {x.lane} · due {shortDate(x.dueDay)}
          </span>
          <span class="small">{CASHNOW.cashed(shortDate(x.day), fd(x.landsFd))}</span>
        </div>
      ))}
    </div>
  );
}

/** Several invoices What now? chose, cashed together: the writer's "Cash {n} invoices · {fd} FD today". */
function CashSeveral({ c, ids }: { c: Company; ids: number[] }): JSX.Element {
  const w = S.game!.w;
  const today = dayOf(w.t, w.cfg);
  const rows = ids.map((id) => w.receivables.find((r) => r.id === id)!).filter(Boolean);
  const lands = rows.reduce((s, r) => {
    const rate = cashNowRate(w, c, r);
    return s + (typeof rate === "number" ? r.amountFd * (1 - rate) : 0);
  }, 0);
  const go = async () => {
    for (const r of rows) {
      const rate = cashNowRate(w, c, r);
      if (typeof rate !== "number") continue;
      const res = await order({ type: "cash_invoice", receivableId: r.id }, CASHNOW.rowButton);
      if (res.ok) S.cashed = [...S.cashed, { id: r.id, day: today, landsFd: r.amountFd * (1 - rate), dueDay: r.dueDay, lane: S.invoiceLanes.get(r.id) ?? `#${r.id}` }];
    }
    S.cashPlan = [];
    bumpData();
  };
  return (
    <Btn primary onClick={() => void go()}>
      {CASHNOW.several(rows.length, fd(lands))}
    </Btn>
  );
}

/** The confirm sheet: the invoice, the fee with its parts, what you get today, cash after, and the one button. */
function CashSheet({ c, r, rate, lane, onDone }: { c: Company; r: Receivable; rate: number; lane: string; onDone: () => void }): JSX.Element {
  const w = S.game!.w;
  const k = w.cfg.token.payment;
  const today = dayOf(w.t, w.cfg);
  const fee = r.amountFd * rate;
  const lands = r.amountFd - fee;
  const base = c.factoring && c.factoring.rate !== undefined ? c.factoring.rate : k.cashNow.spotPct;
  const age = Math.max(0, today - (r.dueDay - k.termsDays));
  const [o, d] = lane.includes(" → ") ? lane.split(" → ") : [lane, ""];
  const [note, setNote] = useState<string | null>(null);
  const send = async () => {
    const res = await order({ type: "cash_invoice", receivableId: r.id }, CASHNOW.button(fd(lands)));
    if (!res.ok) return setNote(refusal(res.reason.charAt(0).toLowerCase() + res.reason.slice(1)));
    S.cashed = [...S.cashed, { id: r.id, day: today, landsFd: lands, dueDay: r.dueDay, lane }];
    S.cashPlan = S.cashPlan.filter((id) => id !== r.id);
    bumpData();
    onDone();
  };
  return (
    <div class="stack sheetcard">
      <b>{CASHNOW.sheetTitle}</b>
      <p class="small">{CASHNOW.invoiceRow(o!, d ?? "", fd(r.amountFd), shortDate(r.dueDay))}</p>
      <p class="small">{c.factoring ? CASHNOW.feeContract(pct1(base), pct1(rate - base), age, fd(fee)) : CASHNOW.feeSpot(pct1(base), pct1(rate - base), age, fd(fee))}</p>
      <p class="small">
        <b>{CASHNOW.youGet(fd(lands))}</b>
      </p>
      <p class="muted small">Your cash after · {fd(w.ledger.balance(companyAccount(c.id)) + lands)} FD</p>
      <p class="muted small">{CASHNOW.note(shortDate(r.dueDay))}</p>
      {c.role === "broker" ? <p class="muted small">{CASHNOW.brokerNote}</p> : null}
      <div class="row">
        <Btn sm primary onClick={() => void send()}>
          {CASHNOW.button(fd(lands))}
        </Btn>
        <Btn sm ghost onClick={onDone}>
          {CASHNOW.notNow}
        </Btn>
      </div>
      {note ? <p class="bad small">{note}</p> : null}
    </div>
  );
}
