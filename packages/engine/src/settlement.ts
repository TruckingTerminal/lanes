import type { EconomyConfig } from "@lanes/config";
import { samePerson } from "./brokerage.js";
import { companyAccount } from "./ledger.js";
import type { World } from "./world.js";

/**
 * The settlement fee (token.settlementFee; economy-settlement-fee-spec-2026-11-13.md; Jeff's yes, 2026-11-13; the
 * director's name and words, studio/reviews/director-eve.md §1). Every payment between companies for a load or a sale
 * clears through the freight payment network, which keeps `share`: the seller pays it at the moment the money changes
 * hands, and it burns (sink:trade_burn, a burn the balance readers count and the cap's refill never does: metrics.ts
 * balanceSinksFd). The same rate for everyone, bots included.
 *
 * Never on what's bought from the NPC (the dealer, the used lot, its stock, the factory: those are already sinks), never
 * on a transfer between one owner's two companies (samePerson, not a sale), never on a company's own freight.
 */
export const settlementShare = (cfg: EconomyConfig): number => (cfg.token.settlementFee?.enabled ? cfg.token.settlementFee.share : 0);

/** Charges the fee on `amountFd` to `sellerId` (`buyerId` the other side, null when it's no company), and returns it (0 off). */
export function chargeSettlement(w: World, sellerId: number, buyerId: number | null, amountFd: number, ref: string): number {
  const share = settlementShare(w.cfg);
  if (!(share > 0) || sellerId <= 0 || !(amountFd > 0)) return 0;
  if (buyerId !== null && buyerId > 0 && (buyerId === sellerId || samePerson(w, sellerId, buyerId))) return 0;
  const fee = amountFd * share;
  w.ledger.post(w.t, companyAccount(sellerId), "sink:trade_burn", fee, `fee:${ref}`);
  return fee;
}
