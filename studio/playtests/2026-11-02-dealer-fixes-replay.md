# Dealer fixes replay (2026-11-02)

Build: "Deploy 6cfba3a" (Pages built). Phone 375×812, built-in browser.
- **World 1:** small fleet, Los Angeles, the woman's face.
- **World 2:** owner-operator, Chicago, the woman's face. A hand bid, then the dispatcher at Day in 2 s to step 9, then on to a player's used listing.

Console: no errors.

**Headline: a lessor company bought its first truck.** It used another carrier's used listing, with the lease deposit counted, and Finance moved to its owned-truck state.

| # | Fix | Result | Evidence | Sev |
|---|---|---|---|---|
| 1 | A refused buy leaves everything as it was; the reason shows under the button | **Pass** | World 2, a carrier's Workhorse + Flatbed listed at 32.3k while my leased truck was "Loaded Sicklerville → Pembroke Pines". The button reads **Buy today · 32.3K**, disabled, with "NPC-leased truck is on a trip" in plain text under it before any press; no toast. I forced a click on the disabled button: cash 25,238 → 25,238 FD; Finance "Your lease deposit 15,925 FD" → 15,925 FD; the lease and its trip unchanged | – |
| 2 | The owner's "You" row wears the face picked at naming, and the dispatcher portrait the same look | **Pass** | World 1, picked "This one: a woman"; the save holds `"look":"f"`. Staff: "You · driver-f1, dispatcher-f" | – |
| 3 | Another carrier's listing offers cash or a purchase loan, deposit counted, block named before the press | **Pass** | While the truck was on a trip: the block named under the button (row 1). With the truck idle at Pembroke Pines: **Buy today · 32.3K** and **Buy on a loan ›**, both live. The loan sheet: Price 32.3k · Sales tax 2,258 · Down payment 4,494 · Amount borrowed 27.8k · Loan stake 2,776 · Weekly 344 FD for 104 weeks · "Your lease deposit 15.9k FD, counted toward the price" · **Cash needed now 0 FD** · "Buy on a loan · 0 FD now". **Buy today** took cash 32,467 → 13,880 FD (−18,587). That's price 32.3k + tax 2,258 − deposit 15,925 = 18,633, the gap being rounding in the listed 32.3k. Toast "Bought. It's yours, idle where it stands." Truck tab: "Truck 1 · Workhorse · Flatbed · owned · worth 32,254 FD"; the lease is gone. Finance switched to Getting paid · Credit · Staking with "On your average load: 577 FD" (quick pay) and "346 FD · about 4,154 FD a month" (factoring at 6.0%) | – |
| 4 | "Cash needed now" and the button are down payment + stake + tax − deposit | **Pass, with one contradiction** | New Workhorse + Dry van at step 9: 27.5k + 17.0k + 13.8k − 15.9k = 42.4k; the sheet reads "Cash needed now 42.3k FD" and **Buy on a loan · 42.3K FD now**. Tractor alone: 21.1k + 13.1k + 10.6k − 15.9k = 28.9k = "28.9k FD now". But the reason line under each still uses the gross figure: "A loan needs 58.2k FD now: down payment, stake and tax. You have 41.2k FD, counting your deposit." (tractor: "needs 44.8k … you have 41.2k"). Two "needs" figures for one purchase, and "you have 41.2k" when cash is 25.3k | S |

## Shortfalls at step 9 (for the record)

World 2 reached step 9 at Thu 07:00 (about day 36) with **25,271 FD** cash and a **15,925 FD** deposit.

| Purchase | Cash needed now | Short by |
|---|---|---|
| New Workhorse + Dry van (197.2k, 88-day delivery) on a loan | 42.3k | **17.0k** |
| Workhorse tractor alone (151.7k) on a loan | 28.9k | **3.6k** |
| NPC used lot | empty all session | – |
| A carrier's used Workhorse + Flatbed (32.3k), once it was listed (Fri, about day 37) and my truck was at a hub | 18.6k cash, or 0 on a loan | **none**: bought |

## Also seen

- **L:** on the listing's loan sheet the deposit (15.9k) exceeds the down payment, stake and tax (9.5k). "Cash needed now 0 FD" doesn't say what happens to the other 6.4k.
- **L:** "Trailer: … flatbed" was the only rig listed. A new owner-operator who ran a dry van for a month gets a flatbed because that's what was for sale, and nothing says the freight changes with it.
