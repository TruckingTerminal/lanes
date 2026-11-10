import type { JSX } from "preact";
import { PENDING } from "../copy-pending.js";
import { closedMonths, monthReport, moneyEvents, shownReport, type MoneyEvent, type MonthReport } from "../books.js";
import { MONTH, NEWS } from "../copy.js";
import { cls, fdFull, monthName, pct } from "../format.js";
import { isPhone, me, S, setTab, truckNo } from "../state.js";
import { Card } from "./bits.js";
import { Fig } from "./Explain.js";

/**
 * R10 (player2-ux.md section 4): the month report on Money, and the money events of R9 (section 3) in the money style.
 * The figures are books.ts's, which add up from cash on the 1st to cash at the close.
 */

/** Each earned and spent row's explain key (copy.ts EXPLAIN, month.*). */
const LINE_KEY: Record<string, string> = {
  loads: "month.loads",
  detention: "month.detention",
  goods: "month.goods",
  fees: "month.fees",
  otherIn: "month.otherIn",
  fuel: "month.fuel",
  fuelTax: "month.fuelTax",
  wages: "month.wages",
  lessor: "month.lessor",
  maintenance: "month.maintenance",
  insurance: "month.insurance",
  tolls: "month.tolls",
  yard: "month.yard",
  fines: "month.fines",
  claims: "month.claims",
  interest: "month.interest",
  overhead: "month.overhead",
  idle: "month.idle",
  carrierPay: "month.carrierPay",
  taxes: "month.taxes",
  otherOut: "month.otherOut",
};
/** Each money event's explain key (copy.ts EXPLAIN, news.*). */
const NEWS_KEY: Record<MoneyEvent["kind"], string> = { breakdown: "news.breakdown", crash: "news.crash", fine: "news.fine", claim: "news.claim" };

/** The UX spec: the last month's card sits at the top of Money for this many game days after its close, then folds. */
export const MONTH_TOP_DAYS = 7;

const amount = (x: number) => `${fdFull(x)} FD`;
const signed = (x: number) => `${x < 0 ? "−" : "+"}${fdFull(Math.abs(x))} FD`;

function Row({ label, value, k, strong, bad }: { label: string; value: string; k?: string; strong?: boolean; bad?: boolean }): JSX.Element {
  return (
    <tr class={cls(strong && "strong")}>
      <td>{k ? <Fig k={k} label={label}>{label}</Fig> : label}</td>
      <td class={cls("num", bad && "bad")}>{value}</td>
    </tr>
  );
}

/** One month's books: earned, spent, kept, why cash moved differently, and the month's three lines. */
export function MonthCard({ r, title, first }: { r: MonthReport; title?: string; first: boolean }): JSX.Element {
  const owedLabel = r.owedChange >= 0 ? MONTH.owedUp : MONTH.owedDown;
  const payLabel = r.payChange >= 0 ? MONTH.payUp : MONTH.payDown;
  return (
    <Card class="monthcard" title={title ?? MONTH.header(monthName(r.closedDay - 1), fdFull(r.keptFd))}>
      {title ? <p class="small"><b>{MONTH.header(monthName(r.closedDay - 1), fdFull(r.keptFd))}</b></p> : null}
      <table class="books" data-month={r.closedDay}>
        <tbody>
          <tr class="head">
            <td colSpan={2}>{MONTH.earned}</td>
          </tr>
          {r.earned.map((x) => (
            <Row key={x.line} label={rowName(x.line)} value={amount(x.fd)} k={LINE_KEY[x.line]} bad={x.fd < 0} />
          ))}
          <tr class="head">
            <td colSpan={2}>{MONTH.spent}</td>
          </tr>
          {r.spent.map((x) => (
            <Row key={x.line} label={rowName(x.line)} value={amount(x.fd)} k={LINE_KEY[x.line]} />
          ))}
          <Row label={MONTH.kept} value={amount(r.keptFd)} strong bad={r.keptFd < 0} />
          {r.drawFd >= 0.5 ? (
            <tr>
              <td colSpan={2} class="small muted">
                {MONTH.draw(fdFull(r.drawFd))}
              </td>
            </tr>
          ) : null}
          <tr class="head">
            <td colSpan={2}>{MONTH.why}</td>
          </tr>
          <Row label={first ? MONTH.cashStartFirst : MONTH.cashStart} value={amount(r.cashStart)} />
          <Row label={MONTH.kept} value={signed(r.keptFd)} />
          {Math.abs(r.owedChange) >= 0.5 ? <Row label={owedLabel} value={signed(-r.owedChange)} /> : null}
          {Math.abs(r.payChange) >= 0.5 ? <Row label={payLabel} value={signed(r.payChange)} /> : null}
          {r.moved.map((x) => (
            <Row key={x.line} label={(x.fd > 0 ? MONTH.rowBack[x.line] : undefined) ?? rowName(x.line)} value={signed(x.fd)} />
          ))}
          <Row label={MONTH.cashEnd} value={amount(r.cashEnd)} strong bad={r.cashEnd < 0} />
        </tbody>
      </table>
      {r.taken > 0 ? <p class="small bad">{PENDING.monthTaken(r.taken, fdFull(r.takenLoansFd))}</p> : null}
      <p class="small muted">{r.loads > 0 ? MONTH.lines(r.loads, pct(r.onTimePct ?? 0), Math.round(r.loadedMi).toLocaleString("en-US"), Math.round(r.allMi).toLocaleString("en-US"), pct(r.allMi > 0 ? r.loadedMi / r.allMi : 0)) : MONTH.noLoads}</p>
    </Card>
  );
}

/** Money's month cards: the last month on top for a week after its close (`top`), then every closed month in Past months. */
export function MonthReports({ part }: { part: "top" | "past" }): JSX.Element | null {
  const w = S.game!.w;
  const c = me();
  const months = closedMonths(w, c).map((m) => shownReport(monthReport(m)));
  if (!months.length) return null;
  const today = Math.floor(w.t / w.cfg.time.gameMinutesPerDay);
  const newest = months[0]!;
  // closedDay is the month's last day (intel.ts monthlyIntel, the day's last job); the card shows from the next morning
  // for MONTH_TOP_DAYS days (QA item 8: it folded after six).
  const top = today - newest.closedDay <= MONTH_TOP_DAYS;
  const past = top ? months.slice(1) : months;
  const first = (r: MonthReport) => r.fromDay === c.createdDay;
  if (part === "top") return top ? <MonthCard r={newest} title={MONTH.lastMonth} first={first(newest)} /> : null;
  return past.length ? (
    <details class="fold monthsfold">
      <summary>{MONTH.pastMonths}</summary>
      {past.map((r) => (
        <MonthCard key={r.closedDay} r={r} first={first(r)} />
      ))}
    </details>
  ) : null;
}

/** Whether the company has a closed month to read (the month close's "Read the month" leads only to a report). */
export const hasMonthReport = (): boolean => !!S.game?.player && closedMonths(S.game.w, S.game.player).length > 0;

/** "Read the month": Money, at the newest month's card (its fold opened if it has folded). */
export function openMonthReport(): void {
  if (isPhone() && S.sheet === "strip") S.sheet = "half";
  setTab("money");
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(".monthcard");
      if (!el) return;
      const fold = el.closest("details");
      if (fold) fold.open = true;
      el.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }),
  );
}

/** A money event's line, the writer's, with its amount bold and red (the money style). */
function newsLine(e: MoneyEvent): { before: string; amount: string; after: string } {
  const n = e.truckId !== null ? truckNo(e.truckId) || e.truckId : 0;
  const fd = fdFull(e.fd);
  const line = e.kind === "breakdown" ? NEWS.breakdown(n, fd) : e.kind === "crash" ? NEWS.crash(n, fd) : e.kind === "claim" ? (e.loadId !== undefined ? PENDING.newsServiceClaim(e.sub ?? "", String(e.loadId), fd) : NEWS.claim(fd)) : (NEWS.fine[e.sub ?? ""] ?? NEWS.fine.other!)(n, fd);
  const amt = `−${fd} FD`;
  const i = line.indexOf(amt);
  return i < 0 ? { before: line, amount: "", after: "" } : { before: line.slice(0, i), amount: amt, after: line.slice(i + amt.length) };
}

/** R9: the money events over guard.newsFd since a game minute, newest first, each tappable for what made it likely. */
export function MoneyEventRows({ sinceT }: { sinceT: number }): JSX.Element | null {
  const g = S.game;
  const c = g?.player;
  if (!g || !c) return null;
  const events = moneyEvents(g.w, c, sinceT);
  if (!events.length) return null;
  return (
    <ul class="moneyevents">
      {events.map((e) => {
        const l = newsLine(e);
        return (
          <li key={`${e.ref}@${e.t}`} class="small">
            <Fig k={NEWS_KEY[e.kind]} label={l.before.replace(/[:\s]+$/, "")} ctx={{ news: { ref: e.ref, t: e.t }, truckId: e.truckId ?? undefined }}>
              {l.before}
              <b class="bad num">{l.amount}</b>
              {l.after}
            </Fig>
          </li>
        );
      })}
    </ul>
  );
}

/** Money's This week: the week's money events, when there are any. */
export function ThisWeekCard(): JSX.Element | null {
  const w = S.game!.w;
  const rows = MoneyEventRows({ sinceT: w.t - 7 * w.cfg.time.gameMinutesPerDay });
  return rows ? <Card title={NEWS.thisWeek}>{rows}</Card> : null;
}

/** A row's name: the claims row carries the delivery windows' claims too (client batch 4, placeholder for the writer). */
const rowName = (line: string): string => (line === "claims" ? PENDING.claimsRow : MONTH.row[line]!);
