/**
 * The national sales tax (Jeff, 2026-10-29): on every purchase of goods and services, a sink. Fuel
 * carries the fuel tax instead; freight, wages, premiums and stakes aren't purchases.
 */
import { companyAccount } from "./ledger.js";
import type { World } from "./world.js";

export function salesTaxOn(w: World, amountFd: number): number {
  const k = w.cfg.costs.salesTax;
  return k.enabled && amountFd > 0 ? amountFd * k.pct : 0;
}

/** Charges the tax on a purchase to the buyer; returns what was charged. */
export function chargeSalesTax(w: World, companyId: number, amountFd: number, ref: string): number {
  const tax = salesTaxOn(w, amountFd);
  if (tax > 0.005) w.ledger.post(w.t, companyAccount(companyId), "sink:sales_tax", tax, ref);
  return tax;
}
