import type { JSX } from "preact";
import { averagePriceUsd, borrowingCapacity, bridgeDelayDays, companyAccount, fdPriceUsd, lockedFd, sellableFd, tokenLive } from "@lanes/engine";
import { cls, fd, fdFull, pct, shortDate, usd } from "../../format.js";
import { MONEY } from "../../copy.js";
import { invoices, milesOf, weekCosts } from "../../ledger.js";
import { GettingPaid } from "./Finance.js";
import { GAME_CONFIG } from "../../game.js";
import { act, feed, me, myTrucks, S, truckNo, useData } from "../../state.js";
import { Btn, Card, Kv, Num, Panel, Sparkline } from "../bits.js";

const num = (id: string): number => Number((document.getElementById(id) as HTMLInputElement | null)?.value);

/**
 * Money as a ledger (specs/first-ten-minutes.md, S8): cash with its sparkline, what's owed and when, getting paid,
 * this week's costs and the company's standing; loans and the token under folds, closed until opened. The deposit
 * side of Equipment Finance is gone (the bible).
 */
export function Money(): JSX.Element {
  useData();
  const w = S.game!.w;
  const c = me();
  const bal = w.ledger.balance(companyAccount(c.id));
  const live = tokenLive(w);
  const owed = invoices(w, c);
  const week = weekCosts(w, c);
  const ef = w.cfg.equipmentFinance;
  const loans = w.finance.loans.filter((l) => l.borrowerId === c.id && l.status === "active");
  const owned = myTrucks().filter((t) => t.lease === "owned");
  const borrowable = owned.map((t) => ({ t, cap: borrowingCapacity(w, t) })).filter((x) => x.cap > 100);
  const day = Math.floor(w.t / 1440);
  const cashHist = feed().history.map((h) => h.cash);
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
                <span class="small">Waiting: {c.withdrawals.map((r) => `${fd(r.fd)} FD, ${Math.max(0, r.day + bridgeDelayDays(w, r.day) - day)} days`).join(" · ")}</span>
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
      <Card class="cashcard" title={MONEY.cash}>
        <p class={cls("bigcash", bal < 0 && "bad")}>{fdFull(bal)} FD</p>
        {/* From day one (S22): the days so far and now; one day alone is a flat line, not nothing. */}
        {cashHist.length ? <span class="label">{MONEY.cashDays(cashHist.length + 1)}</span> : null}
        <Sparkline values={cashHist.length ? [...cashHist, bal] : [bal, bal]} color="var(--accent)" />
        {bal < 0 ? <p class="bad">{MONEY.red(w.cfg.insolvency.weeksInDebt, fdFull(w.cfg.insolvency.debtLimitFd))}</p> : null}
      </Card>
      <Card title={MONEY.owed}>
        {owed.length ? (
          <table class="mini">
            <thead>
              <tr>
                <th>{MONEY.colLoad}</th>
                <th>{MONEY.colFd}</th>
                <th>{MONEY.colDue}</th>
              </tr>
            </thead>
            <tbody>
              {owed.map((r) => (
                <tr key={r.id}>
                  <td>{S.invoiceLanes.get(r.id) ?? `#${r.id}`}</td>
                  <td class="num">{fdFull(r.amountFd)}</td>
                  <td class="num">{shortDate(r.dueDay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p class="muted">{MONEY.nothingOwed}</p>
        )}
      </Card>
      <GettingPaid />
      <Card title={MONEY.week}>
        <Kv
          rows={[
            [MONEY.leaseMin, `${fdFull(week.leaseMinimum)} FD`],
            [MONEY.insurance, `${fdFull(week.insurance)} FD`],
            [MONEY.yard, `${fdFull(week.yard)} FD`],
            [MONEY.perDiem, MONEY.perDiemValue(fdFull(week.perDiemPerDay))],
          ]}
        />
      </Card>
      <Card title={MONEY.standing}>
        <p>{MONEY.miles(fdFull(milesOf(c)))}</p>
      </Card>
      <details class="fold">
        <summary>{MONEY.loans}</summary>
        <Card>
          <p class="muted small">{MONEY.loansLead(pct(ef.maxLoanToValue), pct(ef.weeklyRate), ef.termWeeks, ef.missedPaymentsToRepossess)}</p>
          {borrowable.map((x) => (
            <div class="row" key={x.t.id}>
              <span>{MONEY.borrowUpTo(truckNo(x.t.id), fdFull(x.cap))}</span>
              <Btn onClick={() => act({ type: "borrow", truckId: x.t.id, amountFd: Math.floor(borrowingCapacity(w, x.t)) }, "Loan funded")}>{MONEY.borrow}</Btn>
            </div>
          ))}
          {loans.map((l) => (
            <div class="row" key={l.id}>
              <span>
                {MONEY.loanOwed(truckNo(l.truckId), fdFull(l.principalFd))}
                {l.missed ? <span class="bad"> · {MONEY.missed(l.missed)}</span> : null}
              </span>
              <Btn disabled={bal < l.principalFd} onClick={() => act({ type: "repay_loan", loanId: l.id }, "Loan repaid")}>
                {MONEY.repay}
              </Btn>
            </div>
          ))}
        </Card>
      </details>
      <details class="fold">
        <summary>{MONEY.token}</summary>
        {token}
      </details>
    </Panel>
  );
}
