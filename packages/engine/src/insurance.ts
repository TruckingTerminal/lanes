import { garagingFactor } from "@lanes/data";
import { dayOf } from "./clock.js";
import { clamp } from "./economics.js";
import { companyAccount } from "./ledger.js";
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
  risk = clamp(risk, ins.clamp[0], ins.clamp[1]);
  const garaging = garagingOf(w.net.hubs[c.homeHub]!.id);
  const market = w.insuranceMarket.index;
  return { annualPerTruck: ins.baseAnnualPerTruck * risk * garaging * market, risk, garaging, market };
}

/**
 * Signs (or re-signs) the company's policy for a new term. `why` tells the
 * company: a renewal, or a re-write after a crash or a bad rating.
 */
export function signPolicy(w: World, c: Company, why?: "renewal" | "rewrite"): void {
  const before = c.insurance.annualPerTruck;
  const q = quote(w, c);
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

const fmt = (x: number) => Math.round(x).toLocaleString("en-US");

/** Daily: policies whose term is up renew at today's price. */
export function dailyInsurance(w: World): void {
  const day = today(w);
  for (const c of w.companies) if (day >= c.insurance.renewDay) signPolicy(w, c, "renewal");
}

/** Weekly: each company pays a week of its policy for every truck on the road. */
export function billInsurance(w: World): void {
  const m = w.insuranceMarket;
  for (const c of w.companies) {
    let trucks = 0;
    for (const t of w.trucksByCompany.get(c.id) ?? []) if (t.status !== "parked" && t.status !== "listed" && t.status !== "retired") trucks++;
    if (trucks === 0) continue;
    const premium = (trucks * c.insurance.annualPerTruck) / 52;
    w.ledger.post(w.t, companyAccount(c.id), "sink:insurance", premium, `insurance:${c.id}`);
    c.operating.costFd += premium;
    m.premiums[m.premiums.length - 1]! += premium;
  }
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
    const step = ratio > k.targetLossRatio * 1.1 ? k.stepPerMonth : ratio < k.targetLossRatio * 0.9 ? -k.stepPerMonth : 0;
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
