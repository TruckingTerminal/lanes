import { dayOf } from "./clock.js";
import { companyAccount } from "./ledger.js";
import type { BuybackWeek } from "./types.js";
import { companyById, type World } from "./world.js";

/**
 * The weekly buyback auction (a design proposal; see config `buyback`). The
 * treasury's budget buys the cheapest FD offered; every filled offer is paid one
 * clearing price; the FD is burned. Dollars leave the game to the seller — they're
 * tracked on the company, outside the FD ledger.
 */
export function offerFd(w: World, companyId: number, amountFd: number, minPriceUsd: number): string | null {
  if (!w.cfg.buyback.enabled || w.cfg.token.enabled) return "no buyback auction";
  if (amountFd <= 0) {
    w.buyback.offers.delete(companyId);
    return null;
  }
  if (!(minPriceUsd >= 0)) return "bad price";
  w.buyback.offers.set(companyId, { amountFd, minPriceUsd });
  return null;
}

/** Last week's clearing price, if anything cleared yet. */
export function lastBuybackPrice(w: World): number | null {
  for (let i = w.buyback.weeks.length - 1; i >= 0; i--) {
    const p = w.buyback.weeks[i]!.priceUsd;
    if (p !== null) return p;
  }
  return null;
}

/**
 * Uniform-price clearing. Offers sorted by minimum price fill until the budget
 * runs out. The treasury always spends the whole budget when anyone offers: the
 * clearing price is the marginal offer's minimum when that offer fills only in
 * part, and otherwise budget ÷ FD filled — so when little FD is offered, sellers
 * get more for it. A week with no offers rolls its budget over. An offer is capped
 * at the seller's balance when the auction runs; offers are one-shot.
 */
export function clearBuyback(w: World): BuybackWeek {
  const bb = w.buyback;
  const budget = w.cfg.buyback.usdPerWeek + bb.carryUsd;
  const offers = [...bb.offers]
    .map(([id, o]) => ({ id, ask: o.minPriceUsd, fd: Math.min(o.amountFd, Math.max(0, w.ledger.balance(companyAccount(id)))) }))
    .filter((o) => o.fd >= 1 && companyById(w, o.id).liquidatingSince === null)
    .sort((a, b) => a.ask - b.ask || a.id - b.id);
  const fills = new Map<number, number>();
  let filled = 0;
  let price: number | null = null;
  for (const o of offers) {
    if (o.ask * (filled + o.fd) <= budget) {
      filled += o.fd;
      fills.set(o.id, o.fd);
      continue;
    }
    if (o.ask * filled < budget) {
      // This offer fills in part, at its own minimum.
      const part = budget / o.ask - filled;
      fills.set(o.id, part);
      filled += part;
      price = o.ask;
    }
    break;
  }
  // Every offer filled, or the budget ran out between two offers: budget ÷ FD filled.
  if (price === null && filled > 0) price = budget / filled;
  let spent = 0;
  bb.lastFill.clear();
  for (const o of offers) {
    const fd = fills.get(o.id) ?? 0;
    bb.lastFill.set(o.id, fd / o.fd);
    if (fd <= 0 || price === null) continue;
    w.ledger.post(w.t, companyAccount(o.id), "sink:buyback", fd, `buyback:${o.id}`);
    const usd = fd * price;
    companyById(w, o.id).usd.out += usd;
    spent += usd;
  }
  bb.carryUsd = Math.max(0, budget - spent);
  bb.offers.clear();
  const week: BuybackWeek = {
    day: dayOf(w.t, w.cfg),
    offeredFd: offers.reduce((s, o) => s + o.fd, 0),
    boughtFd: filled,
    priceUsd: filled > 0 ? price : null,
    spentUsd: spent,
  };
  bb.weeks.push(week);
  return week;
}
