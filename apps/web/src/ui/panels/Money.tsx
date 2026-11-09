import type { JSX } from "preact";
import { useEffect } from "preact/hooks";
import { InvoiceRows } from "./CashNow.js";
import { MoveMoneyLink } from "./Brokerage.js";
import { averagePriceUsd, bridgeDelayDays, companyAccount, depositCredit, fdPriceUsd, itemPriceUsd, lockedFd, sellableFd, tokenLive, type Company, type World } from "@lanes/engine";
import { cls, dateLabel, fd, fdFull, shortDate, usd, plural } from "../../format.js";
import { DEBT, MONEY } from "../../copy.js";
import { invoices, milesOf, weekCosts } from "../../ledger.js";
import { FinanceLinks } from "./Finance.js";
import { Fig } from "../Explain.js";
import { cashDipAhead, cushion, debtCountdown } from "../../figures.js";
import { PENDING } from "../../copy-pending.js";
import { GUIDE_LABEL } from "../../copy.js";
import { iuliiaFirst } from "../../iuliia.js";
import { GAME_CONFIG } from "../../game.js";
import { act, feed, me, S, setOnboard, useData } from "../../state.js";
import { Btn, Card, Kv, Num, Panel, Sparkline } from "../bits.js";
import { MonthReports, ThisWeekCard } from "../MonthReport.js";

/** On a lease with no truck of its own, the lessor pays on delivery: nothing is ever owed (R25). */
const myTruckLeased = (w: World, c: Company): boolean => {
  const ts = (w.trucksByCompany.get(c.id) ?? []).filter((t) => t.status !== "retired");
  return ts.length > 0 && ts.every((t) => t.lease === "npc");
};

const num = (id: string): number => Number((document.getElementById(id) as HTMLInputElement | null)?.value);

/**
 * Money as a ledger (specs/first-ten-minutes.md, S8): cash with its sparkline, what's owed and when, getting paid,
 * this week's costs and the company's standing; loans and the token under folds, closed until opened. The deposit
 * side of Equipment Finance is gone (the bible).
 */
/** The net-30 warning (the diaries, 2026-11-09): cash under zero ahead, before the invoices due land (figures.ts cashDipAhead). */
function Net30Line(): JSX.Element | null {
  const w = S.game!.w;
  const dip = cashDipAhead(w, me());
  if (!dip) return null;
  return (
    <p class="small warn net30">
      {PENDING.net30Warn(dateLabel(dip.day), fdFull(dip.lowFd), dateLabel(dip.landsDay))} <span class="muted">{PENDING.net30Explain}</span>
    </p>
  );
}

export function Money(): JSX.Element {
  useData();
  const w = S.game!.w;
  const c = me();
  const bal = w.ledger.balance(companyAccount(c.id));
  const live = tokenLive(w);
  const owed = invoices(w, c);
  const week = weekCosts(w, c);
  const day = Math.floor(w.t / 1440);
  const cashHist = feed().history.map((h) => h.cash);
  // The hold toward the player's own truck (row 2): its total under Cash, with a note on the first visit that shows it.
  const held = depositCredit(w, c);
  const heldNote = held >= 0.5 && !S.onboard.seen.includes("money:held");
  useEffect(() => () => {
    if (heldNote && !S.onboard.seen.includes("money:held")) setOnboard({ seen: [...S.onboard.seen, "money:held"] });
  }, [heldNote]);
  let token: JSX.Element;
  if (!live) {
    const daysLeft = GAME_CONFIG.token.betaYears * 365 - day;
    const miles = c.milesHistory.reduce((a, b) => a + b, 0) + c.milesTotal;
    const total = w.companies.reduce((s, x) => s + x.milesHistory.reduce((a, b) => a + b, 0) + x.milesTotal, 0) || 1;
    const share = Math.min(GAME_CONFIG.token.airdrop.capShare, miles / total) * GAME_CONFIG.token.airdrop.fd;
    const au = w.cfg.token.launch.auction;
    const myBids = w.token.auctionBids.filter((b) => b.companyId === c.id).reduce((s, b) => s + b.usd, 0);
    const allBids = w.token.auctionBids.reduce((s, b) => s + b.usd, 0);
    const uw = w.cfg.token.catalogue.usdWindow;
    token = (
      <Card title={`FD exchange · opens in ${daysLeft} days`}>
        <p class="muted small">
          At the end of Year 2, FD launches on an FD/USDC pool. Your FD above working capital is burned and what you keep is locked for operating; your Miles become an airdrop paid into your account at once, unlocked for withdrawal by the Logbook's milestones.
          {uw.enabled && uw.assets.enabled ? " In this farming season rigs, trailers, facilities and businesses can be bought for dollars; every dollar goes into the launch pool." : ""}
        </p>
        <Kv
          rows={[
            ["Your Miles so far", <Num>{fd(miles)} ({((100 * miles) / total).toFixed(2)}% of all)</Num>],
            ["Airdrop at today's share", <Num>≈ {fd(share)} FD</Num>],
            ...(au.enabled ? ([["Opening auction", <Num>{fd(au.trancheFd)} FD at one clearing price · ${allBids.toLocaleString("en-US")} bid so far · yours ${myBids.toLocaleString("en-US")} of ${au.capUsd.toLocaleString("en-US")}</Num>]] as [string, JSX.Element][]) : []),
          ]}
        />
        {/* R4: the small yard's dollar price, moved off Business (the first month's path) into this fold. */}
        {uw.enabled && c.yard === "none" ? (
          <div class="row">
            <Btn onClick={() => act({ type: "buy_item", item: "yardSmall", pay: "usd" }, "Yard bought with dollars")}>
              Small yard · {usd(itemPriceUsd(w, "yardSmall"))}
            </Btn>
          </div>
        ) : null}
        {au.enabled ? (
          <div class="row">
            <input type="number" id="bid-usd" min="1" step="10" defaultValue="100" aria-label="Dollars to bid" />
            <Btn disabled={c.usd.wallet < 1 || myBids >= au.capUsd} onClick={() => act({ type: "bid_auction", usd: num("bid-usd") }, "Bid placed")}>
              Bid in the opening auction
            </Btn>
            <span class="muted small">Every dollar bid buys FD at the same price when the pool opens, and goes into the pool.</span>
          </div>
        ) : null}
      </Card>
    );
  } else {
    const price = fdPriceUsd(w);
    const hist = w.token.priceHistory.slice(-90);
    const a = c.airdrop;
    const bridge = w.cfg.token.bridge;
    token = (
      <Card title="FD exchange">
        <Sparkline values={hist} color="var(--accent-warn)" />
        <Kv
          rows={[
            ["Price", <Num>${price.toFixed(5)} / FD (8-week avg ${averagePriceUsd(w, 56).toFixed(5)})</Num>],
            ["Your dollars", <Num>{usd(c.usd.wallet)} play $ · taken out {usd(c.usd.out)}</Num>],
            ["Sellable FD", <Num>{fd(sellableFd(w, c))} (locked {fd(lockedFd(w, c))})</Num>],
            ...(a ? ([["Airdrop", <Num>{fd(a.unlockedFd)} of {fd(a.totalFd)} unlocked{a.weeksLeft > 0 ? ` · ${a.weeksLeft} weeks left (3+ loads a week)` : a.lockedFd !== undefined ? ` · ${fd(a.lockedFd)} spend-only until the Logbook unlocks it` : ""}</Num>]] as [JSX.Element | string, JSX.Element][]) : []),
          ]}
        />
        <div class="row">
          <input type="number" id="buy-usd" min="1" step="1" defaultValue="10" aria-label="Dollars to spend" />
          <Btn disabled={c.usd.wallet < 1} onClick={() => act({ type: "buy_fd", usd: num("buy-usd") }, "FD bought")}>
            Buy FD with $ {bridge.enabled ? "(deposited)" : ""}
          </Btn>
        </div>
        <div class="row">
          <input type="number" id="sell-fd" min="100" step="100" defaultValue={String(Math.max(100, Math.floor(sellableFd(w, c) / 2)))} aria-label="FD to withdraw" />
          <Btn disabled={sellableFd(w, c) < 100} onClick={() => act({ type: "sell_fd", fd: num("sell-fd") }, bridge.enabled ? "Withdrawal requested" : "FD sold")}>
            {bridge.enabled ? "Withdraw FD (a sale)" : "Sell FD for $"}
          </Btn>
        </div>
        {bridge.enabled ? (
          <>
            <p class="muted small">
              Every withdrawal is a sale: it waits {bridgeDelayDays(w, day)} days ({Math.round(bridgeDelayDays(w, day) / 4)} real days), frozen, then leaves through the early-sale tax and the daily limits, at most {Math.round(bridge.dailyOutflowShareOfPool * 100)}% of the pool a day for everyone. Taking it back burns {Math.round(bridge.cancelBurn * 100)}%.
            </p>
            {c.withdrawals.length ? (
              <div class="row">
                <span class="small">Waiting: {c.withdrawals.map((r) => `${fd(r.fd)} FD, ${plural(Math.max(0, r.day + bridgeDelayDays(w, r.day) - day), "day")}`).join(" · ")}</span>
                <Btn sm onClick={() => act({ type: "cancel_withdrawal" }, "Withdrawals taken back")}>
                  Take back ({Math.round(bridge.cancelBurn * 100)}% burned)
                </Btn>
              </div>
            ) : null}
          </>
        ) : null}
        {a && a.weeksLeft > 0 && !a.claimedEarly ? (
          <div class="row">
            <Btn onClick={() => act({ type: "claim_airdrop_now" }, "Airdrop claimed at half")}>Claim the rest now at half</Btn>
          </div>
        ) : null}
        <p class="muted small">Buying pays 1% to the treasury; selling burns 5% of the FD. Half the treasury's revenue buys FD back and burns it.</p>
      </Card>
    );
  }
  return (
    <Panel title={MONEY.title}>
      {/* R10: the last month's report, on top for a week after its close. */}
      <MonthReports part="top" />
      <Card class="cashcard" title={MONEY.cash}>
        <p class={cls("bigcash", bal < 0 && "bad")}>
          <Fig k="money.cash" label={MONEY.cash}>{fdFull(bal)} FD</Fig>
        </p>
        {/* From day one (S22): the days so far and now; one day alone is a flat line, not nothing. */}
        {cashHist.length ? <span class="label">{MONEY.cashDays(cashHist.length + 1)}</span> : null}
        <Fig k="money.trend" label={MONEY.cash}>
          <Sparkline values={cashHist.length ? [...cashHist, bal] : [bal, bal]} color="var(--accent)" />
        </Fig>
        {held >= 0.5 ? (
          <p class="small">
            <Fig k="truck.leaseDeposit" label={MONEY.held}>{MONEY.heldValue(fdFull(held))}</Fig>
          </p>
        ) : null}
        {heldNote ? <p class="muted small">{MONEY.heldNote(`${Math.round(w.cfg.freeEntry.leases.byValue.escrowShareOfPay * 100)}%`)}</p> : null}
        {/* Iuliia's figures (figures.ts): the cushion, and the countdown once cash is under the line. */}
        <p class="small">
          <Fig k="guide.cushion" label={GUIDE_LABEL.cushion}>{GUIDE_LABEL.cushionValue(cushion(w, c).weeks)}</Fig>
        </p>
        {debtCountdown(w, c).under || c.weeksInDebt > 0 ? (
          <p class="small bad">
            <Fig k="guide.debtCountdown" label={GUIDE_LABEL.debt}>{GUIDE_LABEL.debtValue(c.weeksInDebt, w.cfg.insolvency.weeksInDebt)}</Fig>
          </p>
        ) : null}
        {bal < 0 ? (
          <p class="bad">
            {MONEY.red(w.cfg.insolvency.weeksInDebt, fdFull(w.cfg.insolvency.debtLimitFd))} {DEBT.count(debtCountdown(w, c).n, w.cfg.insolvency.weeksInDebt, dateLabel(debtCountdown(w, c).nextDay))}
          </p>
        ) : null}
        <Net30Line />
      </Card>
      <Card title={<Fig k="money.owed" label={MONEY.owed}>{MONEY.owed}</Fig>}>
        {/* One row per invoice: line 2 is Cash it now while its switch is on (finance.md draft 2). */}
        {owed.length || S.cashed.some((x) => x.companyId === c.id) ? <InvoiceRows c={c} /> : <p class="muted">{myTruckLeased(w, c) ? MONEY.nothingOwedLease : MONEY.nothingOwed}</p>}
        {/* How the company is paid and its loans live on Finance (specs/finance.md); Money links there. */}
        <FinanceLinks />
        <MoveMoneyLink />
      </Card>
      <Card title={MONEY.week}>
        <Kv
          rows={[
            [MONEY.leaseMin, `${fdFull(week.leaseMinimum)} FD`],
            [MONEY.insurance, <Fig k="pay.insurance" label={MONEY.insurance}>{`${fdFull(week.insurance)} FD`}</Fig>],
            [MONEY.yard, `${fdFull(week.yard)} FD`],
            [MONEY.perDiem, MONEY.perDiemValue(fdFull(week.perDiemPerDay))],
          ]}
        />
      </Card>
      {/* R9: the week's breakdowns, fines and claims over guard.newsFd, in the money style. */}
      <ThisWeekCard />
      <Card title={MONEY.standing}>
        <p>{MONEY.miles(fdFull(milesOf(c)))}</p>
      </Card>
      <MonthReports part="past" />
      <details class="fold">
        <summary onClick={() => iuliiaFirst("money:token")}>{MONEY.token}</summary>
        {token}
      </details>
    </Panel>
  );
}
