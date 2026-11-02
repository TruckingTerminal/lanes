Batch v58-a (2026-11-02, staking locks), full size, 730 days, seeds 1, 4, 8, seasons on: the live profile with `token.staking.lockDiscounts.enabled=true`, beside v57-0 (the same profile and horizon with it off). With the switch on the truck and facility tiers stop gating size, a stake may be locked for 1, 3, 6 or 12 game months at 3 / 6 / 9 / 12% off fuel, maintenance, rebuilds, refurbishments, insurance, board fees and NPC dealer, used-lot and catalogue purchases, up to a budget of 1 / 4 / 10 / 24% of the lock over its term, and breaking a lock early burns 2 × the discounts it gave + 10% of it (sink:lock_slash). Bots lock spare cash over twice their cushion for their persona's term (conservative 12 months and rolling, greedy 3, the rest 6), no more than their spending can use, and break a lock only when heading for liquidation. The token launches on day 729 in both runs (the beta is two years), so the price rows cover one day. See studio/reviews/economy-staking-locks.md.

    npm run sim -- --seeds 1 --days 730 --quiet --set token.staking.lockDiscounts.enabled=true --out runs/v58-a   # and 4, 8
    npx tsx apps/sim/src/compare.ts runs/v57-0 runs/v58-a

| Measure | runs/v57-0 | runs/v58-a |
|---|---|---|
| Supply before year 1 close | 82.9M (77.0M–90.3M) | 93.0M (88.7M–98.0M) |
| Supply before year 2 close | 78.8M (69.8M–85.4M) | 89.4M (85.5M–92.7M) |
| Supply growth, year 2 vs 1 | 0.95× (0.91×–1.00×) | 0.96× (0.93×–1.01×) |
| Avg rate, year 1 (FD/mi) | 4.84 (4.74–4.93) | 4.79 (4.75–4.85) |
| Avg rate, year 2 (FD/mi) | 3.52 (3.49–3.55) | 3.58 (3.54–3.61) |
| Operating sinks/faucets, all quarters | 85% (75%–103%) | 86% (74%–99%) |
| Sinks incl. burn / faucets, whole run | 87% (87%–88%) | 87% (87%–87%) |
| Wealth Gini | 0.59 (0.57–0.63) | 0.59 (0.58–0.60) |
| Top 1% share of wealth | 8% (7%–10%) | 9% (8%–10%) |
| Top 10% share of wealth | 41% (39%–43%) | 41% (40%–41%) |
| Miles Gini | 0.45 (0.44–0.46) | 0.46 (0.45–0.47) |
| Avg wealth: owner-operator | 70k (69k–72k) | 66k (65k–67k) |
| Avg wealth: fleet | 208k (202k–219k) | 207k (194k–225k) |
| Avg wealth: broker | -409 (-480–-331) | -273 (-383–-213) |
| Repossessions | 0 (0–0) | 0 (0–0) |
| Companies repossessed | 0 (0–0) | 0 (0–0) |
| Carriers wiped out | 0 (0–0) | 0 (0–0) |
| Companies in debt at end | 63 (58–68) | 59 (56–64) |
| Debt in red balances at end | -113k (-171k–-69k) | -132k (-189k–-74k) |
| Liquidations | 327 (268–385) | 339 (297–364) |
| Companies liquidated at least once | 142 (132–154) | 150 (143–155) |
| …of them owner-operators / fleets / brokers | 66 / 16 / 60 | 73 / 17 / 60 |
| Debt written off at restart (faucet) | 1.3M (1.1M–1.6M) | 1.6M (1.4M–1.8M) |
| Holding cost paid (sink) | 0 (0–0) | 0 (0–0) |
| Fuel tax paid, IFTA-style (sink) | 21.0M (20.8M–21.2M) | 21.0M (20.9M–21.2M) |
| Sales tax paid (sink) | 17.9M (17.3M–18.5M) | 17.2M (16.7M–17.8M) |
| Managers' pay (sink) | 7.9M (7.2M–9.1M) | 7.2M (6.7M–8.0M) |
| Businesses: upkeep / parts (sinks) | 11.1M / 22.3M | 7.7M / 16.8M |
| Businesses open at end: shops / truck stops / fuel stations (owners' FD per business-year, purchase included) | 20 (50k) / 68 (-135k) / 0 (0) | 19 (20k) / 63 (-178k) / 0 (0) |
| Businesses: the trade alone per business-year, shops / truck stops / fuel stations (average purchase) | 159k (108k) / 9k (155k) / 0 (0) | 135k (105k) / 1k (135k) / 0 (0) |
| Legs held by a winter pass closure | 1158 (1095–1222) | 1194 (1161–1253) |
| Dock waits / hours per wait / missed appointment slots | 173887 / 11.1 / 29217 | 171044 / 11.1 / 28781 |
| Cargo thefts / cargo value stolen / flatbed damage claims | 441 / 1.6M / 1060 | 440 / 1.5M / 1001 |
| Reefer unit fuel (sink) | 2.2M (2.0M–2.4M) | 2.1M (2.0M–2.2M) |
| Robbery: crews hired / hits / rigs chopped | 0 / 0 / 0 | 0 / 0 / 0 |
| Robbery: cargo taken / paid to hirers / crew fees / security fittings bought | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Back Lot: fences paid / chop shops paid / their resales / victims paid from stakes / bounties posted → paid | 0 / 0 / 0 / 0 / 0 → 0 | 0 / 0 / 0 / 0 / 0 → 0 |
| Back Lot v2: crews caught / talked / gave up; investigations / convictions / fines / suspensions | 0 / 0 / 0; 0 / 0 / 0 / 0 | 0 / 0 / 0; 0 / 0 / 0 / 0 |
| Back Lot v2: hirers' net (take − fees) / yard security bought (yards with any) / deductibles the lessor carried; companies hot at end / max heat | 0 / 0 (0) / 0; 0 / 0 | 0 / 0 (0) / 0; 0 / 0 |
| Leases by value: NPC lease deposits held at end | 10.8M (10.3M–11.7M) | 11.9M (11.5M–12.4M) |
| Purchase loans: made / still owed at end (open loans) | 56.9M / 15.7M (296) | 53.1M / 14.3M (304) |
| Purchase loans: interest / defaults / trucks taken back / stakes slashed / written off | 4.6M / 161 / 113 / 270k / 1.1M | 4.3M / 147 / 104 / 220k / 1.3M |
| Assets: new equipment bought / its share of all sinks (bar: 15%+) | 50.6M / 7% (6%–7%) | 45.6M / 6% (5%–7%) |
| Assets: all equipment costs (new, NPC lease share, trailer rent, rebuilds) / share of sinks | 120.6M / 16% | 116.4M / 16% |
| Player share: new trucks / shop work / insurance / freight (EVE bar: players make most of it) | 26% / 24% / 46% / 1% | 23% / 18% / 43% / 1% |
| Assets: tractors / trailers scrapped, rigs written off, trailers stolen from yards | 147 / 87 / 16 / 7 | 150 / 84 / 19 / 6 |
| Assets: factory built tractors / trailers; sold by player dealerships (FD) | 264 / 300; 163 (14.3M) | 230 / 283; 142 (13.2M) |
| Assets: trade-ins / player leases taken / businesses, facilities and yards resold | 96 / 433 / 16 | 80 / 404 / 11 |
| Assets: owned trailers / rentals out / tractors on lease, at end; swaps and refurbishments | 736 / 104 / 77; 234 / 625 | 742 / 86 / 72; 206 / 626 |
| Nights at a site / on the shoulder / shoulder tickets / sites found full | 292655 / 30435 / 10022 / 249 | 288982 / 29979 / 9784 / 240 |
| Breakdowns served by truck stops / hub shops / NPC road service | 2129 / 792 / 6983 | 1264 / 752 / 8834 |
| Shops, NPC: maintenance / repairs / rebuilds (sinks) | 32.7M / 3.1M / 34.7M | 34.3M / 3.2M / 35.2M |
| Shipper defaults on brokered loads | 732 (592–936) | 819 (684–983) |
| Equipment Finance written off | 0 (0–0) | 0 (0–0) |
| Used-truck sales | 324 (302–348) | 346 (318–368) |
| NPC used lot: rigs sold / FD taken (sink) | 245 / 11.8M | 259 / 12.4M |
| Owned trucks at end | 615 (598–627) | 594 (563–613) |
| Extra leases out, average | 122 (106–149) | 123 (107–146) |
| Tractor cap at end | 120 (120–120) | 120 (120–120) |
| Player trucks running in booms / busts | 798 / 787 | 797 / 788 |
| Avg rate in booms / busts (FD/mi) | 4.54 / 3.74 | 4.54 / 3.75 |
| Loads expired unhauled per day, booms | 470 (366–543) | 468 (380–531) |
| Fleet profit per truck-week after overhead | 4k (4k–4k) | 4k (4k–5k) |
| Owner-operator profit per truck-week | 2k (2k–2k) | 2k (2k–2k) |
| FD burned outside operations (buyback, launch, fees) | 58.7M (55.7M–64.5M) | 71.3M (68.7M–74.2M) |
| Buyback: FD bought and burned | 0 (0–0) | 0 (0–0) |
| Buyback: average clearing price ($/FD) | n/a | n/a |
| Buyback: price, lowest / highest quarter ($/FD) | n/a | n/a |
| Buyback: share of FD offered that was bought | n/a | n/a |
| $ taken out per company-week: owner-operator / fleet / broker | $0.00 / $0.00 / $0.00 | $0.00 / $0.00 / $0.00 |
| Token: price at launch → end ($/FD) | $0.0012 → $0.0013 ($0.00096–$0.0015) | $0.0010 → $0.0012 ($0.0010–$0.0016) |
| Token: seeds that hold the launch price / whose pool dollars grew | 3/3 / 3/3 | 3/3 / 3/3 |
| Token: new buying that holds the end price ($ per 1,000 companies a month) | $0 ($0–$0) | $0 ($0–$0) |
| Token: FD sold into the pool net of buys, per month | -3.0M (-3.2M–-2.6M) | -3.9M (-4.6M–-3.0M) |
| Token: market cap at launch → end (peak) | $104k → $116k (peak $116k) | $81k → $95k (peak $95k) |
| Token: FDV at launch → end (peak); circulating share of total at end | $1.1M → $1.2M (peak $1.2M); 10% | $984k → $1.2M (peak $1.2M); 8% |
| Token: lowest / highest price | $0.0013 / $0.0013 | $0.0012 / $0.0012 |
| Token: supply right after launch → end (pool included) | 113.4M → 113.4M | 99.7M → 99.7M |
| Token: growth of FD outstanding, launch → end | 0% (0%–0%) | 0% (0%–0%) |
| Supply ceiling: growth allowed; outstanding at end vs the path | 10% over 1460 days; 113.4M vs 113.7M | 10% over 1460 days; 99.7M vs 101.4M |
| Supply ceiling: worst day over the path / days over | 0.0% / 0 | 0.1% / 0 |
| Supply ceiling: weeks the payouts waited / weeks the dial sat at its floor / vest weeks held | 0 / 0 / 0 | 0 / 0 / 0 |
| Supply ceiling: airdrop queued (peak / at end) and paid back out | 0 / 0; 0 | 0 / 0; 0 |
| Balance dial: NPC rate multiplier, lowest / at end | 0.50 / 0.50 | 0.50 / 0.50 |
| Price band: width / trades clipped / biggest day's move in its days | off | off |
| Opening auction: dollars bid / bidders / clearing price / pool dollars at open | off | off |
| Launch fee: start, days; dollars taken on buys / FD burned on sales above the normal fees | 50%, 14; $4k / 0 | 50%, 14; $4k / 0 |
| Bridge: timer (days at launch → end) / FD requested → cleared / mean wait (days) / days capped / waiting at end | 28 → 8 / 188k → 0 / 0.0 / 0 / 188k | 28 → 8 / 93k → 0 / 0.0 / 0 / 93k |
| Locked (spend-only) FD at end | 22.0M (19.9M–23.2M) | 21.0M (19.8M–21.7M) |
| Logbook: paid at launch / by honest milestones / by criminal / still locked at end | 100k / 0 / 0 / 9.9M | 100k / 0 / 0 / 9.9M |
| Logbook: forfeited on conviction / median share of an allocation unlocked / books | 0 / 1% / 566 | 0 / 1% / 567 |
| Logbook: companies reaching each milestone | none | none |
| Unlock ladder: days after launch businesses / re-brokering / crews opened | -702 / -639 / -548 | -702 / -639 / -548 |
| Token: FD held by companies at end | 21.4M (20.1M–22.2M) | 20.7M (19.1M–21.7M) |
| Token: launch burned / locked | 32.5M / 13.6M | 49.2M / 13.4M |
| Token: operating sinks / faucets since launch | 86% (71%–98%) | 143% (78%–179%) |
| Token: burned since launch (profit tax / buyback / sell fee) | 0 / 0 / 0 | 0 / 0 / 0 |
| Token: treasury revenue (product + fees) / to buybacks | $4k / $0 | $4k / $0 |
| Token: worst drawdown from a peak / pool dollars at their peak | 0% / $68k | 0% / $56k |
| Token: net $ taken out — farmers / sybils / speculators (momentum, crowd, whale) | $0 / $0 / $0 | $0 / $0 / $0 |
| Token: pool dollars at launch → end | $65k → $68k ($55k–$78k) | $52k → $56k ($48k–$70k) |
| Token: developer's vest — FD sold into the pool / dollars taken | 0 / $0 | 0 / $0 |
| Token: net $ taken out — owner-operators / fleets / brokers / newcomers | $-8k / $-58k / $-6k / $0 | $-8k / $-47k / $-6k / $0 |
| Token: airdrop minted / forfeited / haircut (of 10M) | 10.0M / 0 / 0 | 10.0M / 0 / 0 |
| Token: newcomers after launch | 0 (0–0) | 0 (0–0) |
| Free path: bought within 84 days (of all free starters) | 289 (270–305) | 279 (258–292) |
| Free path median days (seeds where half bought) | 52 (45–63) | 54 (49–63) |
| First bid by hand: free starters that bid / median and mean days the truck waited | 400 (400–400) of 400 (400–400) / 1 (1–1) / 1.0 (1.0–1.0) | 400 (400–400) of 400 (400–400) / 1 (1–1) / 1.0 (1.0–1.0) |
| Top strategy vs segment median | 1.40× (1.32×–1.45×) | 1.42× (1.35×–1.46×) |
| Crashes (fatal / at fault / willful) | 122 (3 / 70 / 17) | 118 (2 / 63 / 13) |
| Compliance reviews / unsatisfactory / shutdowns | 237 / 55 / 40 | 215 / 49 / 41 |
| Thefts / double-brokered loads / convictions | 0 / 199 / 37 | 0 / 214 / 43 |
| Carriers at end: conditional / unsat / revoked / cutting corners | 1 / 2 / 2 / 130 | 1 / 1 / 3 / 130 |
| Fines / liability / seized / cargo claims (sinks) | 7.9M / 4.5M / 40k / 1.5M | 8.0M / 3.1M / 1.8M / 1.5M |
| Driver wages / dispatcher salaries (sinks) | 173.0M / 1.6M | 171.5M / 1.5M |
| Fence payouts / cargo insurance (faucets) | 0 / 9k | 0 / 10k |
| Drivers employed / in pool / trucks without one, at end | 303 / 177 / 73 | 310 / 164 / 66 |
| Trucks without a driver, average | 2 (2–2) | 2 (2–2) |
| Insurance (sink) / yard rent (sink) | 4.6M / 1.1M | 4.8M / 1.1M |
| Insurance market index: low / high / end | 1.00 / 1.40 / 1.40 | 1.00 / 1.40 / 1.38 |
| Dealer price index (Workhorse + van): low / high / end | 0.88 / 1.20 / 0.90 | 0.88 / 1.20 / 0.90 |
| Wage index / mean employed driver skill, at end | 0.92 / 0.56 | 0.92 / 0.56 |
| Operating sinks, all tags (FD) | 731.8M (725.5M–740.1M) | 724.5M (719.5M–731.7M) |
| Sinks: factoring discounts / insurance / surety / NPC lessor's share | 0 / 4.6M / 31k / 33.0M | 0 / 4.8M / 36k / 33.3M |
| Factoring discounts' share of operating sinks | 0.0% (0.0%–0.0%) | 0.0% (0.0%–0.0%) |
| Factoring: carriers / brokers that signed; contracts signed / renewed / lapsed | 476 / 0; 599 / 0 / 0 | 471 / 0; 590 / 0 / 0 |
| Factoring: carriers' first signing by fleet, 1 / 2 / 3-5 / 6-10 / 11-20 / 21+ trucks | 432 / 27 / 17 / 0 / 0 / 0 | 427 / 28 / 16 / 0 / 0 / 0 |
| Factoring: invoices factored, carriers / brokers (FD) | 0 / 0 | 0 / 0 |
| Factoring: discounts paid, carriers / brokers (FD); carriers' mean rate | 0 / 0; 0.00% | 0 / 0; 0.00% |
| Starters: bought a first truck / had it running / signed within 30 days of its first day | 400 / 400 / 9 (2%) | 400 / 400 / 8 (2%) |
| One-truck owners liquidated after buying: signed at one truck / never signed | 69 of 418 (16%) / 0 of 30 (1%) | 75 of 415 (18%) / 1 of 29 (5%) |
| Broker AP cap: tenders a broker passed up / of them no broker could take (to the open board) / bids and bookings refused | 0 / 0 / 0 | 0 / 0 / 0 |
| Broker bonds: paid for broker paper (to the NPC factor or lessor) / NPC paper unpaid / paid from an overdraft / posted at end | 0 (0) / 0 / 0 / 2.6M | 0 (0) / 0 / 0 / 2.7M |
| NPC freight delivered: brokered / direct loads; carrier pay per mile | 3404 / 237241; 4.17 / 4.17 | 3304 / 233925; 4.14 / 4.17 |
| Loads per truck in service, 28-day mean from day 112: mean / p5–p95 / min–max | 0.88 / 0.59–1.37 / 0.56–1.59 | 0.87 / 0.58–1.29 / 0.55–1.42 |
| Loads per truck: booms / busts (demand dial over 1.1 / under 0.9); spread (sd) | 1.08 / 0.69; 0.24 | 1.08 / 0.69; 0.22 |
| Loads per truck: share of days under the floor / over the ceiling (the dial's band) | 0% / 10% (band 0.55–1.25) | 0% / 7% (band 0.55–1.25) |
| Loads per truck by quarter (28-day mean at each quarter's end) | NaN 0.71 0.87 0.84 0.71 0.98 1.22 0.92 | NaN 0.71 0.91 0.86 0.73 0.94 1.15 0.87 |
| Carriers trading at day 112 / 365 / 546 / end | 515 / 516 / 505 / 512 | 515 / 517 / 509 / 511 |
| Trucks in service at day 112 / 365 / 546 / end | 801 / 803 / 655 / 648 | 806 / 792 / 668 / 670 |
| Dial: days under / over the band; bots retired instead of restarted / wound down / entered | off | off |
| Sinks/faucets by quarter (operating) | 76% 85% 85% 82% 80% 96% 91% 85% | 76% 81% 86% 85% 86% 97% 91% 86% |
| Join wave: newcomers / bought a first truck (median days; within 84 days) / liquidated at least once | none | none |
| Prudence, owner-operators: mean wealth (share liquidated), conservative / random / greedy | 55k (18%) / 59k (18%) / 98k (14%) | 56k (21%) / 59k (21%) / 85k (12%) |
| Prudence, fleets: mean wealth (share liquidated), conservative / random / greedy | 128k (9%) / 175k (22%) / 322k (9%) | 119k (10%) / 190k (21%) / 310k (12%) |
| Fleets at end: carriers over 5 / 10 / 20 trucks; the largest | n/a | 1 / 0 / 0; 7 |
| Locks made by term, 1 / 3 / 6 / 12 months: locks (FD) | off | 0 (0) / 2912 (63.3M) / 1309 (19.5M) / 1030 (8.5M) |
| Locks: rolled / matured / broken; locked at end | off | 438 / 3258 / 157; 240k |
| Locks: discounts given / slashes burned (discounts the broken locks had given) | off | 5.8M / 541k (169k) |
