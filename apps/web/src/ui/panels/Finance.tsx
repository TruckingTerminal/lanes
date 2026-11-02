import type { JSX } from "preact";
import { companyAccount, creditBand, creditScore, factoringStake, managersNeeded, nextTruckTier, operatingTrucks, opsCap, receivablesOf, stakeDiscount, truckCap } from "@lanes/engine";
import { fd, pct } from "../../format.js";
import { act, me, S, useData } from "../../state.js";
import { Btn, Card, Kv, Num, Panel } from "../bits.js";

const num = (id: string): number => Number((document.getElementById(id) as HTMLInputElement | null)?.value);

const TERMS: ["net" | "quick" | "factor", string][] = [
  ["net", "Net 30"],
  ["quick", "Quick pay"],
  ["factor", "Factor"],
];

/** Getting paid, staking and the company's credit. The player-funded pools are gone from the client (Jeff, 2026-11-02: not for a long time). */
export function Finance(): JSX.Element {
  useData();
  const w = S.game!.w;
  const c = me();
  const k = w.cfg.token;
  const cash = w.ledger.balance(companyAccount(c.id));
  const running = operatingTrucks(w, c.id);
  const exiting = c.unstaking.reduce((s, e) => s + e.fd, 0);
  const next = nextTruckTier(w, c);
  const disc = stakeDiscount(w, c);
  const nextDisc = k.staking.discounts.find(([stake]) => stake > c.stakedFd + 1e-9);
  const mgr = w.cfg.labor.managers;
  const ops = opsCap(w, c);
  const score = creditScore(w, c);
  return (
    <Panel title="Finance">
      {k.staking.enabled ? (
        <Card title="Stake">
          <p class="muted small">
            Staked FD is the bond behind your licence: it sets how many trucks you may run, earns a discount, and is slashed if your authority is revoked. Unstaking waits {k.staking.exitDays} days in the queue, or comes out at once for {pct(1 - k.staking.instantHaircut)} of it.
          </p>
          <Kv
            rows={[
              ["Staked", <Num>{fd(c.stakedFd)} FD{exiting > 0 ? ` · ${fd(exiting)} leaving` : ""}</Num>],
              ["Trucks it covers", <Num>{truckCap(w, c)} (you run {running})</Num>],
              ["Next tier", next ? <Num>{next.trucks} trucks at {fd(next.stake)} FD staked</Num> : "The top tier"],
              ["Discount", <Num>{pct(disc)} off fuel, maintenance, rebuilds, insurance and board fees{nextDisc ? ` · ${pct(nextDisc[1])} at ${fd(nextDisc[0])} FD` : ""}</Num>],
              ...(mgr.enabled
                ? ([["Operations managers", <Num>cover {ops === Infinity ? "any fleet" : `${ops} trucks`} · a fleet of {running} needs {managersNeeded(w, "ops", running)}</Num>]] as [string, JSX.Element][])
                : []),
              ...(c.role === "broker" ? ([["Broker licence", <Num>{fd(k.staking.roles.broker)} FD staked {c.stakedFd + 1e-9 >= k.staking.roles.broker ? "✓" : "(short)"}</Num>]] as [string, JSX.Element][]) : []),
            ]}
          />
          <div class="row">
            <input type="number" id="stake-fd" min="1" step="100" defaultValue="1000" aria-label="FD to stake or unstake" />
            <Btn primary disabled={cash < 1} onClick={() => act({ type: "stake_fd", fd: num("stake-fd") }, "Staked")}>
              Stake
            </Btn>
            <Btn disabled={c.stakedFd < 1} onClick={() => act({ type: "unstake_fd", fd: num("stake-fd"), instant: false }, `Unstaking: out in ${k.staking.exitDays} days`)}>
              Unstake
            </Btn>
            <Btn danger disabled={c.stakedFd < 1} onClick={() => act({ type: "unstake_fd", fd: num("stake-fd"), instant: true }, "Unstaked at once, haircut burned")}>
              Unstake now
            </Btn>
          </div>
        </Card>
      ) : null}
      <GettingPaid />
      <Card title="Credit">
        <p class="muted small">The game scores every company from its ledger: invoices paid on time, the licence's age, claims and bankruptcies. Carriers check a broker's score before hauling; it prices factoring, the surety bond and which loads shippers tender you.</p>
        <Kv rows={[["Score", <Num>{Math.round(score)} · band {creditBand(score)}</Num>]]} />
      </Card>
    </Panel>
  );
}

/** Payment terms (receivables.ts), on Money beside what's owed (S8, Finance folded in): net, quick pay or factoring. */
export function GettingPaid(): JSX.Element | null {
  useData();
  const w = S.game!.w;
  const c = me();
  const k = w.cfg.token;
  const owed = receivablesOf(w, c.id);
  const today = Math.floor(w.t / 1440);
  if (!k.payment.enabled || c.role !== "carrier") return null;
  // A leased truck's loads are paid on delivery by the lessor (token.payment.lessorPaysOnDelivery): terms only matter
  // once the company hauls with a truck of its own.
  if (k.payment.lessorPaysOnDelivery && (w.trucksByCompany.get(c.id) ?? []).every((t) => t.lease === "npc" || t.status === "retired")) return null;
  return (
        <Card title="Getting paid">
          <p class="muted small">
            Shippers pay net {k.payment.termsDays}. Quick pay pays today for {pct(k.payment.quickPayPct)} off. Factoring is a {Math.round(k.payment.factoring.termDays / 365)}-year contract with a {fd(factoringStake(w, c))} FD stake: the factor advances each invoice at a discount set by who owes it and your credit, and leaving early forfeits the stake.
          </p>
          <Kv
            rows={[
              ["Terms now", <Num>{TERMS.find(([t]) => t === c.payTerms)?.[1] ?? c.payTerms}{c.factoring ? ` · contract to day ${c.factoring.until} (${c.factoring.until - today} days)` : ""}</Num>],
              ["Owed to you", <Num>{fd(owed)} FD on open invoices</Num>],
            ]}
          />
          <div class="row">
            {TERMS.map(([t, label]) => (
              <Btn key={t} on={c.payTerms === t} onClick={() => act({ type: "set_pay_terms", terms: t }, `${label} from now on`)}>
                {label}
              </Btn>
            ))}
          </div>
        </Card>
  );
}
