import { garagingFactor } from "@lanes/data";
import { theftInsuranceFactor } from "./risk.js";
import { dayOf } from "./clock.js";
import { clamp, fmtInt } from "./economics.js";
import { companyAccount } from "./ledger.js";
import { payClaim, poolAccount, poolMarkup, poolsOn } from "./pools.js";
import { trailerValue, truckValue } from "./dealer.js";
import { contractAccount } from "./receivables.js";
import { stakeDiscount } from "./staking.js";
import type { Company, InsurancePolicy } from "./types.js";
import { syncFleet, type World } from "./world.js";

/**
 * Insurance on one-game-year contracts (design proposal, Jeff 2026-10-28). The
 * price per truck is set when the policy is signed and holds for the term:
 * base × the company's risk × its home hub's garaging factor × the insurance
 * market. It renews at the then-current price each year, and the insurer
 * re-writes it on the spot after a serious at-fault crash or a bad rating.
 */

const today = (w: World) => dayOf(w.t, w.cfg);

/** A home hub's insurance garaging factor (1 where none is listed). */
export const garagingOf = (hubId: string) => garagingFactor[hubId] ?? 1;

/** What a policy would cost this company today, and why. */
export function quote(w: World, c: Company): Omit<InsurancePolicy, "signedDay" | "renewDay"> {
  const ins = w.cfg.insurance;
  const s = c.safety;
  let risk = ins.rating[s.rating] * (1 + ins.perAlert * s.alerts.length) * (1 + s.insuranceSurcharge);
  const clean = s.rating === "satisfactory" && s.alerts.length === 0 && s.crashes.length === 0;
  if (clean && today(w) - c.authority.since >= ins.cleanYears * w.cfg.time.daysPerSeason) risk *= ins.cleanDiscount;
  risk *= theftInsuranceFactor(w, c); // where the fleet sleeps (risk.ts)
  risk = clamp(risk, ins.clamp[0], ins.clamp[1]);
  const garaging = garagingOf(w.net.hubs[c.homeHub]!.id);
  const market = w.insuranceMarket.index;
  const base = ins.baseAnnualPerTruck * risk * garaging * market;
  // Pools (0.18.0): a capitalised player pool writes cheaper than the NPC insurer, which charges a
  // backstop markup while a pool exists and is too thin to write.
  if (!poolsOn(w)) return { annualPerTruck: base, risk, garaging, market, writer: "npc" };
  const markup = poolMarkup(w, "insurance");
  if (markup !== null) return { annualPerTruck: base * w.cfg.token.pools.insurance.priceOfBase * markup, risk, garaging, market, writer: "pool" };
  return { annualPerTruck: base * w.cfg.token.pools.insurance.backstopMarkup, risk, garaging, market, writer: "npc" };
}

/** Trucks a policy covers: owned or lessor-leased and on the road (the NPC lessor insures its own). */
function coveredTrucks(w: World, c: Company): number {
  let n = 0;
  for (const t of w.trucksByCompany.get(c.id) ?? []) if (t.lease !== "npc" && t.status !== "parked" && t.status !== "listed" && t.status !== "retired") n++;
  return n;
}

/**
 * A pool-written policy locks the deductible per covered truck for the term (pools.insurance.deductibleStake):
 * topped up or returned as the fleet changes, paid out on a claim (safety.ts). A company that cannot
 * post it is written by the NPC insurer instead.
 */
function settleDeductibleStake(w: World, c: Company, q: ReturnType<typeof quote>): ReturnType<typeof quote> {
  const k = w.cfg.token.pools.insurance;
  const ref = `contract:insurance:${c.id}`;
  const need = q.writer === "pool" && k.deductibleStake ? w.cfg.safety.crash.deductibleFd * coveredTrucks(w, c) : 0;
  const delta = need - c.insuranceStakeFd;
  if (delta > 0 && w.ledger.balance(companyAccount(c.id)) < delta) {
    const ins = w.cfg.insurance;
    return { ...q, annualPerTruck: ins.baseAnnualPerTruck * q.risk * q.garaging * q.market * k.backstopMarkup, writer: "npc" };
  }
  if (delta > 0) w.ledger.post(w.t, companyAccount(c.id), contractAccount(c.id), delta, ref);
  else if (delta < 0) w.ledger.post(w.t, contractAccount(c.id), companyAccount(c.id), -delta, ref);
  c.insuranceStakeFd = need;
  return q;
}

/**
 * Signs (or re-signs) the company's policy for a new term. `why` tells the
 * company: a renewal, or a re-write after a crash or a bad rating.
 */
export function signPolicy(w: World, c: Company, why?: "renewal" | "rewrite"): void {
  const before = c.insurance.annualPerTruck;
  const q = settleDeductibleStake(w, c, quote(w, c));
  const day = today(w);
  c.insurance = { ...q, signedDay: day, renewDay: day + w.cfg.insurance.termDays };
  syncFleet(w, c.id);
  if (!why || c.role !== "carrier") return;
  const change = before > 0 ? q.annualPerTruck / before - 1 : 0;
  const moved = Math.abs(change) < 0.005 ? "unchanged" : `${change > 0 ? "up" : "down"} ${Math.round(Math.abs(change) * 100)}%`;
  w.listener?.({
    kind: "notice",
    companyId: c.id,
    topic: "safety",
    text:
      why === "renewal"
        ? `Insurance renewed for a year at ${fmt(q.annualPerTruck)} FD per truck (${moved}).`
        : `Your insurer re-wrote your policy: ${fmt(q.annualPerTruck)} FD per truck for the next year (${moved}).`,
    tone: change > 0.005 ? "bad" : change < -0.005 ? "good" : "info",
  });
}

const fmt = fmtInt;

/** Daily: policies whose term is up renew at today's price. */
export function dailyInsurance(w: World): void {
  const day = today(w);
  for (const c of w.companies) if (day >= c.insurance.renewDay) signPolicy(w, c, "renewal");
}

/** Weekly: each company pays a week of its policy for every truck on the road. */
export function billInsurance(w: World): void {
  const m = w.insuranceMarket;
  const pool = w.pools.insurance;
  let exposure = 0;
  for (const c of w.companies) {
    // The NPC lessor's policy covers its leased trucks (it maintains them too), so a free-path start pays nothing here.
    let trucks = 0;
    for (const t of w.trucksByCompany.get(c.id) ?? []) if (t.lease !== "npc" && t.status !== "parked" && t.status !== "listed" && t.status !== "retired") trucks++;
    if (trucks === 0) continue;
    // Assets: physical-damage cover on what the company owns (its tractors and trailers), priced as a share of their value.
    const pd = w.cfg.assets.enabled ? (w.cfg.assets.physicalDamage.annualShareOfValue * insuredValue(w, c)) / 52 : 0;
    const premium = ((trucks * c.insurance.annualPerTruck) / 52 + pd) * (1 - stakeDiscount(w, c)); // locked FD earns its discount (staking.ts)
    // A pool-written policy pays its premium to the pool's depositors; the NPC insurer's is a sink.
    if (c.insurance.writer === "pool") {
      w.ledger.post(w.t, companyAccount(c.id), poolAccount("insurance"), premium, `pool:insurance:premium:${c.id}`);
      pool.premiumsFd += premium;
      exposure += trucks * c.insurance.annualPerTruck;
    } else {
      w.ledger.post(w.t, companyAccount(c.id), "sink:insurance", premium, `insurance:${c.id}`);
    }
    c.operating.costFd += premium;
    m.premiums[m.premiums.length - 1]! += premium;
  }
  pool.exposureFd = exposure;
}

/** Assets: what physical-damage cover insures: the company's owned tractors (with their trailers) and the trailers in its yard. */
export function insuredValue(w: World, c: Company): number {
  let v = 0;
  for (const t of w.trucksByCompany.get(c.id) ?? []) if (t.lease === "owned" && t.status !== "listed" && t.status !== "retired") v += truckValue(w, t);
  for (const tr of w.trailersByCompany.get(c.id) ?? []) if (tr.lease === "owned" && tr.status === "dropped") v += trailerValue(w, tr);
  return v;
}

/**
 * Assets: an insured loss (a rig written off, a trailer stolen) paid at its value less the deductible: a
 * pool-written policy from the pool, the NPC insurer's from the reserve (a faucet, the other side of its
 * premiums). Counts toward the market's loss ratio. Returns what was paid.
 */
export function payPhysicalDamage(w: World, c: Company, valueFd: number, ref: string, payee: Company = c): number {
  const due = Math.max(0, valueFd - w.cfg.assets.physicalDamage.deductibleFd);
  if (due <= 0.01) return 0;
  recordClaim(w, due);
  if (c.insurance.writer === "pool") return payClaim(w, "insurance", companyAccount(payee.id), due, ref);
  w.ledger.post(w.t, "faucet:insurance_pd", companyAccount(payee.id), due, ref);
  return due;
}

/** What the insurers paid on a claim, for the market's loss ratio. */
export function recordClaim(w: World, amount: number): void {
  const m = w.insuranceMarket;
  m.claims[m.claims.length - 1]! += amount;
}

/**
 * Monthly: the insurance market hardens when the last year's claims ran above the
 * target share of premiums, and softens when they ran below.
 */
export function monthlyInsurance(w: World): void {
  const m = w.insuranceMarket;
  const k = w.cfg.insurance.market;
  const premiums = m.premiums.reduce((a, b) => a + b, 0);
  if (m.premiums.length >= 3 && premiums > 0) {
    const ratio = m.claims.reduce((a, b) => a + b, 0) / premiums;
    // A step proportional to how far the loss ratio is from target, capped, so the market settles instead of swinging.
    const step = clamp(((ratio - k.targetLossRatio) / k.targetLossRatio) * k.gain, -k.stepPerMonth, k.stepPerMonth);
    m.index = clamp(m.index * (1 + step), k.range[0], k.range[1]);
  }
  m.premiums.push(0);
  m.claims.push(0);
  if (m.premiums.length > 12) {
    m.premiums.shift();
    m.claims.shift();
  }
}

/** The insurers' loss ratio over the last 12 months (claims ÷ premiums), for the UI. */
export function lossRatio(w: World): number {
  const m = w.insuranceMarket;
  const premiums = m.premiums.reduce((a, b) => a + b, 0);
  return premiums > 0 ? m.claims.reduce((a, b) => a + b, 0) / premiums : 0;
}
