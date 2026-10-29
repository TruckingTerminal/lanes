import type { JSX } from "preact";
import { averagePriceUsd, borrowingCapacity, companyAccount, depositorValue, fdPriceUsd, poolCash, sellableFd, tokenLive } from "@lanes/engine";
import { fd, usd } from "../../format.js";
import { GAME_CONFIG } from "../../game.js";
import { act, feed, me, myTrucks, S, truckNo, useData } from "../../state.js";
import { Btn, Card, Kv, Num, Panel, Sparkline } from "../bits.js";
import { SCENES } from "../../assets.js";
import { Scene } from "../Loop.js";

const num = (id: string): number => Number((document.getElementById(id) as HTMLInputElement | null)?.value);

export function Money(): JSX.Element {
  useData();
  const w = S.game!.w;
  const c = me();
  const bal = w.ledger.balance(companyAccount(c.id));
  const live = tokenLive(w);
  const deposit = depositorValue(w, c.id);
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
    token = (
      <Card title={`FD exchange · opens in ${daysLeft} days`}>
        <p class="muted small">At the end of Year 2, FD launches on an FD/USDC pool. Your FD above working capital is burned and what you keep is locked for operating; your Miles become an airdrop that unlocks as you keep hauling.</p>
        <Kv
          rows={[
            ["Your Miles so far", <Num>{fd(miles)} ({((100 * miles) / total).toFixed(2)}% of all)</Num>],
            ["Airdrop at today's share", <Num>≈ {fd(share)} FD</Num>],
          ]}
        />
      </Card>
    );
  } else {
    const price = fdPriceUsd(w);
    const hist = w.token.priceHistory.slice(-90);
    const a = c.airdrop;
    token = (
      <Card title="FD exchange">
        <Sparkline values={hist} color="var(--accent-warn)" />
        <Kv
          rows={[
            ["Price", <Num>${price.toFixed(5)} / FD (8-week avg ${averagePriceUsd(w, 56).toFixed(5)})</Num>],
            ["Your dollars", <Num>{usd(c.usd.wallet)} play $ · taken out {usd(c.usd.out)}</Num>],
            ["Sellable FD", <Num>{fd(sellableFd(w, c))} (locked {fd(c.lockedFd)})</Num>],
            ...(a ? ([["Airdrop", <Num>{fd(a.unlockedFd)} of {fd(a.totalFd)} unlocked{a.weeksLeft > 0 ? ` · ${a.weeksLeft} weeks left (3+ loads a week)` : ""}</Num>]] as [JSX.Element | string, JSX.Element][]) : []),
          ]}
        />
        <div class="row">
          <input type="number" id="buy-usd" min="1" step="1" defaultValue="10" aria-label="Dollars to spend" />
          <Btn disabled={c.usd.wallet < 1} onClick={() => act({ type: "buy_fd", usd: num("buy-usd") }, "FD bought")}>
            Buy FD with $
          </Btn>
        </div>
        <div class="row">
          <input type="number" id="sell-fd" min="100" step="100" defaultValue={String(Math.max(100, Math.floor(sellableFd(w, c) / 2)))} aria-label="FD to sell" />
          <Btn disabled={sellableFd(w, c) < 100} onClick={() => act({ type: "sell_fd", fd: num("sell-fd") }, "FD sold")}>
            Sell FD for $
          </Btn>
        </div>
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
    <Panel title="Money">
      <Scene name="bank" still={SCENES.bank} alt="The bank" />
      <Card>
        <Kv
          rows={[
            ["Cash", <Num class={bal < 0 ? "bad" : ""}>{fd(bal)} FD</Num>],
            ["Freight revenue", <Num>{fd(c.operating.revenueFd)} FD</Num>],
            ["Operating costs", <Num>{fd(c.operating.costFd)} FD</Num>],
            ["Fleet overhead paid", <Num>{fd(c.overheadPaidFd)} FD</Num>],
          ]}
        />
        {cashHist.length > 1 ? (
          <>
            <span class="label">Cash, last {cashHist.length} days</span>
            <Sparkline values={cashHist} color="var(--accent)" />
          </>
        ) : null}
        {bal < 0 ? <p class="bad">You're in the red. Four weekly checks more than 2,000 FD under and the company is liquidated.</p> : null}
      </Card>
      {token}
      <Card title="Equipment Finance">
        <p class="muted small">Borrow up to 35% of a truck's value at 1% a week over 26 weeks. Miss two payments and the repo man takes the truck. Or deposit spare FD and earn what borrowers pay.</p>
        <Kv
          rows={[
            ["Pool cash", <Num>{fd(poolCash(w))} FD</Num>],
            ["Your deposit", <Num>{fd(deposit)} FD</Num>],
          ]}
        />
        <div class="row">
          <input type="number" id="dep-amt" min="1000" step="1000" defaultValue="10000" aria-label="Amount" />
          <Btn onClick={() => act({ type: "deposit_finance", amountFd: num("dep-amt") }, "Deposited")}>Deposit</Btn>
          <Btn disabled={deposit <= 1} onClick={() => act({ type: "withdraw_finance", amountFd: num("dep-amt") }, "Withdrawn")}>
            Withdraw
          </Btn>
        </div>
        {borrowable.map((x) => (
          <div class="row" key={x.t.id}>
            <span>
              Truck {truckNo(x.t.id)}: borrow up to <Num>{fd(x.cap)}</Num> FD
            </span>
            <Btn onClick={() => act({ type: "borrow", truckId: x.t.id, amountFd: Math.floor(borrowingCapacity(w, x.t)) }, "Loan funded")}>Borrow</Btn>
          </div>
        ))}
        {loans.map((l) => (
          <div class="row" key={l.id}>
            <span>
              Loan on truck {truckNo(l.truckId)}: <Num>{fd(l.principalFd)}</Num> FD owed{l.missed ? <span class="bad"> · {l.missed} missed</span> : null}
            </span>
            <Btn disabled={bal < l.principalFd} onClick={() => act({ type: "repay_loan", loanId: l.id }, "Loan repaid")}>
              Repay
            </Btn>
          </div>
        ))}
      </Card>
    </Panel>
  );
}
