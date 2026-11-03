import type { JSX } from "preact";
import { cashNowOn, InvoiceRows } from "./CashNow.js";
import { CASHNOW } from "../../copy.js";
import { useState } from "preact/hooks";
import { brokerBooks, companyAccount, creditBand, creditScore, nextTruckTier, operatingTrucks, purchaseTerms, stakeDiscount, truckCap, type Action, type Company, type World } from "@lanes/engine";
import { ANSWER, FINANCE } from "../../copy.js";
import { borrowable, contractOn, contractSoFar, equipmentWeekly, hasLeasedTrucks, leaseDeposit, loanRows, monthOfCosts, ownsATruck, playerPaperWaiting, rateLadder, rateToday } from "../../finance.js";
import { cls, fdFull, hhmm, pct, shortDate } from "../../format.js";
import { invoices } from "../../ledger.js";
import { feed, isPhone, me, myTrucks, order, S, setTab, truckNo, useData } from "../../state.js";
import { Bar, Btn, Card, Kv, Panel } from "../bits.js";
import { Fig } from "../Explain.js";

/** A rate per load, one decimal: "5.9%". */
const rate1 = (x: number): string => `${(x * 100).toFixed(1)}%`;
const today = (w: World): number => Math.floor(w.t / 1440);

/** The confirm sheet open over the panel, if any: full on a phone, a card in the panel on a laptop. */
type Sheet = { kind: "factor" } | { kind: "borrow"; truckId: number; fd: number } | { kind: "unstake"; fd: number } | null;

/**
 * Orders sent from Finance: a refusal shows its reason in red under the button that sent it, never a toast; in the
 * live world the button reads "Sent · in effect hh:mm" until the world applies it (specs/finance.md, States).
 */
/** A press's answer (R20): its result line, and the writer's words for a refusal where they differ from the engine's. */
type Answer = { done: string; refuse?: (reason: string) => string };

/** UNSTAKE's refusals in the writer's words (copy-player4.md R19); the bond's reason stays the engine's. */
const unstakeRefusal = (reason: string): string => (/not that much staked|nothing left to unstake/.test(reason) ? ANSWER.unstakeNone : reason);

function useOrders() {
  const [sent, setSent] = useState<Record<string, string>>({});
  const [refused, setRefused] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Record<string, string>>({});
  // R20: every press answers under its control: the result line (in the test world at once), the engine's reason in red,
  // or "Sent · in effect" on the live world until it applies. `answer` names the result and maps a refusal's words.
  const go = async (key: string, a: Action, ok: string, answer?: Answer): Promise<boolean> => {
    const r = await order(a, ok);
    setRefused((x) => ({ ...x, [key]: r.ok ? "" : (answer?.refuse?.(r.reason) ?? r.reason).replace(/([^.])$/, "$1.") }));
    setResult((x) => ({ ...x, [key]: r.ok && r.at === null && answer ? answer.done : "" }));
    if (r.ok && r.at !== null) setSent((x) => ({ ...x, [key]: hhmm(r.at!) }));
    return r.ok;
  };
  const label = (key: string, text: string) => (sent[key] ? FINANCE.sent(sent[key]!) : text);
  const note = (key: string) => (refused[key] ? <p class="bad small">{refused[key]}</p> : result[key] ? <p class="small">{result[key]}</p> : null);
  return { go, label, note };
}

/** The average load (the mean gross of the last ten deliveries this page saw) and deliveries in the last 28 days. */
function loadsSeen(w: World): { avg: number | null; perMonth: number } {
  const d = feed().deliveries;
  const last = d.slice(-10);
  const avg = last.length ? last.reduce((s, x) => s + x.grossFd, 0) / last.length : null;
  return { avg, perMonth: d.filter((x) => x.day > today(w) - 28).length };
}

/**
 * Finance (specs/finance.md): three cards in a fixed order set by one fact, whether the company owns a truck yet, then
 * staking. On the lessor's truck: Before your first truck, Getting paid (read-only), Credit, Staking. On its own:
 * Getting paid, Credit, Staking. A broker: Getting paid (broker), Credit, Staking.
 */
export function Finance(): JSX.Element {
  useData();
  const w = S.game!.w;
  const c = me();
  const [sheet, setSheetState] = useState<Sheet>(null);
  const orders = useOrders();
  const setSheet = (s: Sheet) => {
    if (s && isPhone()) S.sheet = "full";
    setSheetState(s);
  };
  const owns = ownsATruck(w, c);
  const broker = c.role === "broker";
  const stateA = !owns && !broker;
  if (sheet) return <Panel title={FINANCE.title}>{<ConfirmSheet sheet={sheet} close={() => setSheetState(null)} orders={orders} />}</Panel>;
  return (
    <Panel title={FINANCE.title}>
      {stateA ? <BeforeFirstTruck /> : null}
      <GettingPaid stateA={stateA} open={setSheet} orders={orders} />
      <Credit stateA={stateA} open={setSheet} orders={orders} />
      <Staking open={setSheet} orders={orders} />
    </Panel>
  );
}

/**
 * Iuliia's one line on Finance (specs/finance-strings.md): a contract's last week, a contract just signed, else the first
 * visit by state. It speaks in the caption strip (Walkthrough.tsx Caption), in place of the walkthrough's step, until seen.
 */
export function financeLine(): { key: string; line: string } | null {
  const g = S.game;
  const c = g?.player;
  if (!g || !c) return null;
  const w = g.w;
  const f = c.factoring;
  const seen = (k: string) => S.onboard.seen.includes(k);
  const pick = (key: string, line: string) => (seen(key) ? null : { key, line });
  if (contractOn(w) && f && f.until - today(w) <= 7 && !f.renew) {
    const p = pick(`fin:ending:${f.until}`, FINANCE.iuliiaEnding(shortDate(f.until)));
    if (p) return p;
  }
  if (contractOn(w) && f) {
    const p = pick(`fin:signed:${f.until}`, FINANCE.iuliiaSigned(shortDate(f.until)));
    if (p) return p;
  }
  if (c.role === "broker") return pick("fin:broker", FINANCE.iuliiaBroker);
  return ownsATruck(w, c) ? pick("fin:b", FINANCE.iuliiaB) : pick("fin:a", FINANCE.iuliiaA);
}

/** Card 1, state A only: the arithmetic step 9 asks for, done for the player. */
function BeforeFirstTruck(): JSX.Element {
  const w = S.game!.w;
  const c = me();
  const month = monthOfCosts(w, c);
  const cash = w.ledger.balance(companyAccount(c.id));
  const short = month - cash;
  return (
    <Card title={FINANCE.firstTitle}>
      <p class="small">{FINANCE.firstLead}</p>
      <Kv
        rows={[
          [FINANCE.firstMonth, FINANCE.firstMonthValue(fdFull(Math.round(month / 100) * 100))],
          [FINANCE.firstPays, FINANCE.firstPaysValue(w.cfg.token.payment.termsDays)],
          [FINANCE.firstDeposit, <Fig k="truck.leaseDeposit" label={FINANCE.firstDeposit}>{FINANCE.firstDepositValue(fdFull(leaseDeposit(w, c)))}</Fig>],
          [FINANCE.firstCash, `${fdFull(cash)} FD`],
        ]}
      />
      <p class={short <= 0 ? "good" : "warn"}>{short <= 0 ? FINANCE.firstEnough : FINANCE.firstShort(fdFull(short))}</p>
      <div class="row">
        <Btn primary onClick={() => setTab("market")}>
          {FINANCE.firstDealer}
        </Btn>
      </div>
    </Card>
  );
}

type Orders = ReturnType<typeof useOrders>;

/** Card 2: how the company is paid, its three options with what each costs on its own loads, or the contract running. */
function GettingPaid({ stateA, open, orders }: { stateA: boolean; open: (s: Sheet) => void; orders: Orders }): JSX.Element | null {
  const w = S.game!.w;
  const c = me();
  const k = w.cfg.token.payment;
  if (!k.enabled) return null;
  const f = c.factoring;
  const contract = contractOn(w);
  const fk = k.factoring.contract;
  const r = rateToday(w, c);
  const { avg, perMonth } = loadsSeen(w);
  const next = invoices(w, c)[0];
  const broker = c.role === "broker";
  const header = stateA
    ? FINANCE.headLeased
    : broker && contract
      ? FINANCE.brokerHead(rate1(fk.brokerRate))
      : f && contract
        ? FINANCE.headContract(rate1(f.rate ?? r), shortDate(f.until))
        : c.payTerms === "quick"
          ? FINANCE.headQuick(pct(k.quickPayPct))
          : FINANCE.headNet(k.termsDays);
  const pick = (terms: "net" | "quick") => void orders.go(`terms-${terms}`, { type: "set_pay_terms", terms }, terms === "net" ? FINANCE.stateNet(k.termsDays) : FINANCE.stateQuick);
  const row = (id: "net" | "quick" | "factor", lines: (string | null)[], onClick: () => void) => (
    <button type="button" key={id} class={cls("optrow", !stateA && c.payTerms === id && "on")} disabled={stateA} onClick={onClick}>
      <b>{lines[0]}</b>
      {lines.slice(1).map((l, i) => (l ? <span key={i} class={i === 2 ? "small" : "muted small"}>{l}</span> : null))}
    </button>
  );
  const book = broker ? brokerBooks(w).get(c.id) : undefined;
  return (
    <div id="fin-paid">
      <Card title={FINANCE.paidTitle}>
        <p class="bighead">{header}</p>
        {f && contract ? (
          <UnderContract />
        ) : (
          <>
            <div class={cls("optrows", stateA && "dim")}>
              {row("net", [FINANCE.rowNet(k.termsDays), FINANCE.rowNet2(k.termsDays), FINANCE.rowNet3, !stateA && next ? FINANCE.rowNet4(fdFull(next.amountFd), shortDate(next.dueDay)) : null], () => pick("net"))}
              {broker ? null : row("quick", [FINANCE.rowQuick, FINANCE.rowQuick2, FINANCE.rowQuick3(pct(k.quickPayPct)), !stateA && avg !== null ? FINANCE.rowAvg(fdFull(avg * k.quickPayPct)) : null], () => pick("quick"))}
              {contract
                ? row("factor", [FINANCE.rowFactor, FINANCE.rowFactor2, FINANCE.rowFactor3(rate1(r), fk.months), !stateA && avg !== null ? FINANCE.rowFactor4(fdFull(avg * r), fdFull(avg * r * perMonth)) : null], () => open({ kind: "factor" }))
                : null}
            </div>
            {stateA ? <p class="muted small">{FINANCE.leasedNote}</p> : null}
            {orders.note("terms-net")}
            {orders.note("terms-quick")}
          </>
        )}
        {broker && book ? (
          <>
            <p class="small">{FINANCE.brokerBond(fdFull(book.apFd), fdFull(c.stakedFd))}</p>
            <Bar share={c.stakedFd > 0 ? Math.min(1, book.apFd / c.stakedFd) : 0} />
            <p class="muted small">{FINANCE.brokerNote}</p>
          </>
        ) : null}
        <p class="muted small">
          <Fig k="finance.quickPayFee" label={FINANCE.rowQuick}>{FINANCE.whatQuick(pct(k.quickPayPct))}</Fig>
        </p>
        {contract ? <p class="muted small">{FINANCE.whatFactor(fk.months)}</p> : null}
        <p class="small">{FINANCE.risk}</p>
        {/* "Open invoices", under the options (finance.md draft 2): the same rows as Money's, each with Cash it now. */}
        {!stateA && cashNowOn(w) && invoices(w, c).length ? (
          <>
            <p class="label">{CASHNOW.openHeader(invoices(w, c).length, fdFull(invoices(w, c).reduce((s, r) => s + r.amountFd, 0)))}</p>
            <InvoiceRows c={c} />
          </>
        ) : null}
        {contract && !broker ? <RateFold c={c} /> : null}
      </Card>
    </div>
  );
}

/** Under a contract: the days left, what it has cost so far, what happens at its end, and the exceptions that apply. */
function UnderContract(): JSX.Element {
  const w = S.game!.w;
  const c = me();
  const f = c.factoring!;
  const k = w.cfg.token.payment;
  const orders = useOrders();
  const months = k.factoring.contract.months;
  const start = f.until - months * w.cfg.time.daysPerMonth;
  const left = Math.max(0, f.until - today(w));
  const so = contractSoFar(w, c);
  const end: "factor" | "net" | "quick" = f.renew ? "factor" : (f.thenTerms ?? "net");
  const trucks = operatingTrucks(w, c.id);
  const paper = playerPaperWaiting(w, c);
  const seg = (terms: "factor" | "net" | "quick", label: string) => (
    <Btn sm key={terms} on={end === terms} onClick={() => void orders.go(`end-${terms}`, { type: "set_pay_terms", terms }, label)}>
      {orders.label(`end-${terms}`, label)}
    </Btn>
  );
  return (
    <>
      <Bar share={(today(w) - start) / Math.max(1, f.until - start)} />
      <p class="small">{FINANCE.daysLeft(left)}</p>
      {so ? <p class="small">{FINANCE.soFar(fdFull(so.feesFd), fdFull(so.invoicesFd))}</p> : null}
      <p class="label">{FINANCE.whenEnds}</p>
      <div class="row">
        {seg("factor", FINANCE.segRenew)}
        {seg("net", FINANCE.segNet(k.termsDays))}
        {seg("quick", FINANCE.segQuick)}
      </div>
      <p class="muted small">
        {end === "factor" ? FINANCE.underRenew(rate1(rateToday(w, c)), trucks) : end === "net" ? FINANCE.underNet(k.termsDays, shortDate(f.until)) : FINANCE.underQuick(shortDate(f.until))}
      </p>
      {orders.note("end-factor")}
      {orders.note("end-net")}
      {orders.note("end-quick")}
      {hasLeasedTrucks(w, c) ? <p class="muted small">{FINANCE.exLeased}</p> : null}
      {paper.n ? <p class="muted small">{FINANCE.exPlayers(k.termsDays, paper.n, fdFull(paper.fd))}</p> : null}
    </>
  );
}

/** "Your rate by fleet size", a fold, closed. */
function RateFold({ c }: { c: Company }): JSX.Element {
  const w = S.game!.w;
  return (
    <details class="fold">
      <summary>{FINANCE.foldRates}</summary>
      {rateLadder(w, operatingTrucks(w, c.id)).map((x) => (
        <p key={x.n} class={cls("small", x.you && "good")}>
          {FINANCE.foldRow(x.n, rate1(x.rate))}
          {x.you ? ` · ${FINANCE.you}` : ""}
        </p>
      ))}
    </details>
  );
}

/** Card 3: the score and what it gets, what moves it, the loans, borrowing against a truck, and the leases. */
function Credit({ stateA, open, orders }: { stateA: boolean; open: (s: Sheet) => void; orders: Orders }): JSX.Element {
  const w = S.game!.w;
  const c = me();
  const score = Math.round(creditScore(w, c));
  const terms = purchaseTerms(w, c);
  const ef = w.cfg.equipmentFinance;
  const cash = w.ledger.balance(companyAccount(c.id));
  const gets = <p class="small">{FINANCE.creditGets(pct(terms.downShare), `${(terms.weeklyRate * 100).toFixed(2)}%`, terms.maxLoans)}</p>;
  const head = (
    <>
      <p class="bighead">{FINANCE.creditScore(score, creditBand(score))}</p>
      {gets}
    </>
  );
  // On the lessor's truck, the short card, unless a loan is already running (a first truck bought on a loan, on order).
  if (stateA && !loanRows(w, c).length) {
    return (
      <div id="fin-loans">
        <Card title={FINANCE.creditTitle}>
          {head}
          <p class="small">{FINANCE.stateADeposit(fdFull(leaseDeposit(w, c)))}</p>
        </Card>
      </div>
    );
  }
  const paid = c.credit.onTimeFd + c.credit.lateFd;
  const age = today(w) - c.authority.since;
  const claims = c.claims.filter((x) => x.until > today(w)).length;
  const loans = loanRows(w, c);
  const room = borrowable(w, myTrucks());
  const leases = myTrucks().filter((t) => t.lease !== "owned" && t.status !== "retired");
  const leaseMin = w.cfg.freeEntry.leases.minWeeklyFd;
  return (
    <div id="fin-loans">
      <Card title={FINANCE.creditTitle}>
        {head}
        <p class="label">{FINANCE.creditMoves}</p>
        <Kv
          rows={[
            [FINANCE.creditOnTime, paid > 0 ? pct(c.credit.onTimeFd / paid) : "—"],
            [FINANCE.creditAge, FINANCE.creditAgeValue(age, w.cfg.token.credit.ageYears)],
            [FINANCE.creditClaims, String(claims)],
          ]}
        />
        {loans.length ? (
          loans.map((l) => (
            <div key={`${l.kind}-${l.id}`} class="stack">
              <p class="small">{FINANCE.loanRow(truckNo(l.truckId), l.kind === "purchase" ? FINANCE.loanPurchase : FINANCE.loanEquipment, fdFull(l.owedFd), fdFull(l.weeklyFd), l.weeksLeft)}</p>
              {l.missed ? <p class="bad small">{FINANCE.missed(l.missed, l.kind === "purchase" ? ef.purchase.missedToDefault : ef.missedPaymentsToRepossess)}</p> : null}
              {/* The engine pays off an equipment loan early (repay_loan); a purchase loan runs its term. */}
              {l.kind === "equipment" ? (
                <div class="row">
                  <Btn disabled={cash < l.owedFd} onClick={() => void orders.go(`repay-${l.id}`, { type: "repay_loan", loanId: l.id }, FINANCE.payOff(fdFull(l.owedFd)))}>
                    {orders.label(`repay-${l.id}`, FINANCE.payOff(fdFull(l.owedFd)))}
                  </Btn>
                  {cash < l.owedFd ? <span class="muted small">{FINANCE.youHave(fdFull(cash))}</span> : null}
                </div>
              ) : null}
              {orders.note(`repay-${l.id}`)}
            </div>
          ))
        ) : (
          <p class="muted small">{FINANCE.noLoans}</p>
        )}
        {room.map(({ t, cap }) => (
          <div class="row" key={t.id}>
            <span class="small">{FINANCE.borrowRow(truckNo(t.id), fdFull(cap), pct(ef.weeklyRate), ef.termWeeks)}</span>
            <Btn sm onClick={() => open({ kind: "borrow", truckId: t.id, fd: cap })}>
              {FINANCE.borrow}
            </Btn>
          </div>
        ))}
        {leases.length ? (
          leases.map((t) => (
            <p key={t.id} class="small">
              {FINANCE.leaseRow(truckNo(t.id), pct(w.cfg.costs.npcLeaseShareOfGross), fdFull(leaseMin), fdFull(t.depositFd ?? 0))}
            </p>
          ))
        ) : (
          <p class="muted small">{FINANCE.noLeases}</p>
        )}
        <p class="muted small">{FINANCE.leasesAt}</p>
      </Card>
    </div>
  );
}

/**
 * Card 4: staking. The stake tiers are the live rule, so their rows come first; they go with the lever when the lock
 * discounts switch on (token.staking.lockDiscounts), and the Later line under them says what comes then.
 */
function Staking({ open, orders }: { open: (s: Sheet) => void; orders: Orders }): JSX.Element | null {
  const w = S.game!.w;
  const c = me();
  const k = w.cfg.token.staking;
  if (!k.enabled) return null;
  const cap = truckCap(w, c);
  const running = operatingTrucks(w, c.id);
  const next = nextTruckTier(w, c);
  const cash = w.ledger.balance(companyAccount(c.id));
  const field = () => Number((document.getElementById("stake-fd") as HTMLInputElement | null)?.value) || 0;
  const quiet = running < cap - 1 && c.stakedFd < 1;
  return (
    <Card title={FINANCE.stakeTitle}>
      {quiet ? (
        <p class="small">{next ? FINANCE.stakeBelow(cap, fdFull(next.stake), next.trucks) : FINANCE.stakeMay(cap, running)}</p>
      ) : (
        <>
          <Kv
            rows={[
              ["", FINANCE.stakeMay(cap, running)],
              ...(next ? ([["", FINANCE.stakeTo(next.trucks, fdFull(next.stake))]] as [string, string][]) : []),
              ["", FINANCE.stakeDiscount(pct(stakeDiscount(w, c)))],
            ]}
          />
          <div class="row">
            <input type="number" id="stake-fd" min="1" step="100" defaultValue="1000" aria-label={FINANCE.stakeField} />
            <Btn primary disabled={cash < 1} onClick={() => void orders.go("stake", { type: "stake_fd", fd: field() }, FINANCE.stake)}>
              {orders.label("stake", FINANCE.stake)}
            </Btn>
            <Btn disabled={c.stakedFd < 1} onClick={() => void orders.go("unstake", { type: "unstake_fd", fd: field(), instant: false }, FINANCE.unstake(k.exitDays), { done: ANSWER.unstakeDone(fdFull(Math.min(c.stakedFd, field())), shortDate(today(w) + k.exitDays)), refuse: unstakeRefusal })}>
              {orders.label("unstake", FINANCE.unstake(k.exitDays))}
            </Btn>
            <Btn danger disabled={c.stakedFd < 1} onClick={() => open({ kind: "unstake", fd: Math.min(c.stakedFd, field()) })}>
              {FINANCE.unstakeNow(pct(1 - k.instantHaircut))}
            </Btn>
          </div>
          {orders.note("stake")}
          {orders.note("unstake")}
          {orders.note("unstake-now")}
        </>
      )}
      <p class="small">
        <span class="chip muted">{FINANCE.later}</span> {FINANCE.laterLine}
      </p>
    </Card>
  );
}

/** The confirm sheets: signing a factoring contract, borrowing against a truck, unstaking at once. */
function ConfirmSheet({ sheet, close, orders }: { sheet: NonNullable<Sheet>; close: () => void; orders: Orders }): JSX.Element {
  const w = S.game!.w;
  const c = me();
  const k = w.cfg.token.payment;
  const done = async (key: string, a: Action, ok: string, answer?: Answer) => {
    if (await orders.go(key, a, ok, answer)) close();
  };
  const actions = (key: string, primary: string, a: Action, danger = false, answer?: Answer) => (
    <>
      <div class="row">
        <Btn primary={!danger} danger={danger} onClick={() => void done(key, a, primary, answer)}>
          {orders.label(key, primary)}
        </Btn>
        <Btn ghost onClick={close}>
          {sheet.kind === "unstake" ? FINANCE.keepIt : FINANCE.notNow}
        </Btn>
      </div>
      {orders.note(key)}
    </>
  );
  if (sheet.kind === "factor") {
    const months = k.factoring.contract.months;
    const r = rateToday(w, c);
    const end = today(w) + months * w.cfg.time.daysPerMonth;
    const { avg } = loadsSeen(w);
    return (
      <Card title={FINANCE.sheetTitle}>
        <Kv
          rows={[
            [FINANCE.sheetRate, <Fig k="finance.factoringRate" label={FINANCE.sheetRate}>{FINANCE.sheetRateValue(rate1(r), shortDate(end))}</Fig>],
            [FINANCE.sheetSetBy, FINANCE.sheetSetByValue(operatingTrucks(w, c.id))],
            [FINANCE.sheetCovers, FINANCE.sheetCoversValue],
            [FINANCE.sheetRuns, FINANCE.sheetRunsValue(shortDate(today(w)), shortDate(end), months)],
            [FINANCE.sheetLeaving, FINANCE.sheetLeavingValue],
            [FINANCE.sheetQuick, FINANCE.sheetQuickValue],
            ...(avg !== null ? ([[FINANCE.sheetAvg, `${fdFull(avg * r)} FD`]] as [string, string][]) : []),
          ]}
        />
        {actions("sign", FINANCE.sheetSign(months), { type: "set_pay_terms", terms: "factor" })}
      </Card>
    );
  }
  if (sheet.kind === "borrow") {
    const ef = w.cfg.equipmentFinance;
    return (
      <Card title={FINANCE.borrowTitle(truckNo(sheet.truckId))}>
        <Kv
          rows={[
            [FINANCE.borrowGet, `${fdFull(sheet.fd)} FD`],
            [FINANCE.borrowWeekly, FINANCE.borrowWeeklyValue(fdFull(equipmentWeekly(w, sheet.fd)), ef.termWeeks)],
          ]}
        />
        <p class="warn small">{FINANCE.borrowRepo(ef.missedPaymentsToRepossess)}</p>
        {actions("borrow", FINANCE.borrowGo(fdFull(sheet.fd)), { type: "borrow", truckId: sheet.truckId, amountFd: sheet.fd })}
      </Card>
    );
  }
  const haircut = w.cfg.token.staking.instantHaircut;
  return (
    <Card title={FINANCE.unstakeTitle}>
      <Kv
        rows={[
          [FINANCE.unstakeBack, `${fdFull(sheet.fd * (1 - haircut))} FD`],
          [FINANCE.unstakeBurned, `${fdFull(sheet.fd * haircut)} FD`],
        ]}
      />
      {actions("unstake-now", FINANCE.unstakeGo, { type: "unstake_fd", fd: sheet.fd, instant: true }, true, { done: ANSWER.unstakeNowDone(fdFull(sheet.fd * (1 - haircut)), fdFull(sheet.fd * haircut)), refuse: unstakeRefusal })}
    </Card>
  );
}

/** Money's two link rows into Finance (specs/finance.md): how the company is paid, and its loans. */
export function FinanceLinks(): JSX.Element | null {
  useData();
  const w = S.game!.w;
  const c = me();
  const k = w.cfg.token.payment;
  const f = c.factoring;
  // The same state the Getting paid card shows: on the lessor's truck, the lessor pays on delivery.
  const leasedOnly = c.role !== "broker" && !ownsATruck(w, c) && k.lessorPaysOnDelivery;
  const state = leasedOnly ? FINANCE.stateLessor : f && contractOn(w) ? FINANCE.stateContract(shortDate(f.until)) : c.payTerms === "quick" ? FINANCE.stateQuick : FINANCE.stateNet(k.termsDays);
  const loans = loanRows(w, c);
  const owed = loans.reduce((s, l) => s + l.owedFd, 0);
  const weekly = loans.reduce((s, l) => s + l.weeklyFd, 0);
  const go = (id: string) => {
    if (isPhone() && S.sheet === "strip") S.sheet = "half";
    setTab("finance");
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" })));
  };
  return (
    <nav class="morelist" aria-label={FINANCE.title}>
      {k.enabled ? (
        <button type="button" class="morerow" onClick={() => go("fin-paid")}>
          <span>{FINANCE.linkPaid(state)}</span>
        </button>
      ) : null}
      <button type="button" class="morerow" onClick={() => go("fin-loans")}>
        <span>{loans.length ? FINANCE.linkLoans(fdFull(owed), fdFull(weekly)) : FINANCE.linkNoLoans}</span>
      </button>
    </nav>
  );
}
