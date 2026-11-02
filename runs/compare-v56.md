Batch v56-a (2026-11-02, the factoring contract), full size, 400 days, seeds 1, 4, 8, seasons on: the live profile of ruleset 0.19.3-phase0.32 (v55-a's profile: the first bid by hand is a live lever now) with `token.payment.factoring.contract.enabled=true`, beside v55-a and v56-0 (the same profile and code with the switch off: it reproduces v55-a to the digit, so the code changes are inert with the switch off and v56-a against v55-a is the switch alone). With the switch on, factoring is a three-month NPC contract over the whole fleet at 6% for one truck falling in a straight line to 2.5% at fifty (a broker 5% flat), every discount a sink that refills the reserve; the pools stand down (the NPC insurer and surety write everything at their own price); a broker's accounts payable never pass its posted bond. Bots: an owned-truck carrier with no NPC lease signs when its cash falls under a month of its costs and renews while that thin; a broker signs while under its cushion if its margin after the board fee covers the 5%. See studio/reviews/economy-factoring.md.

    npm run sim -- --seeds 1 --days 400 --quiet --set token.payment.factoring.contract.enabled=true --out runs/v56-a   # and seeds 4, 8
    npm run sim -- --seeds 1 --days 400 --quiet --out runs/v56-0                                                     # and seeds 4, 8
    npx tsx apps/sim/src/compare.ts runs/v55-a runs/v56-0 runs/v56-a

The factoring rows are new (report.ts `factoring`); v55-a's report predates them (n/a). In v56-0 they count the old one-year contract, which the old bot policy signed on the free path too. "Operating sinks, all tags" includes pass-through sinks on both sides (a broker repaying the factor, `sink:npc_factor`, matches the factor's advance), as in every earlier batch.

| Measure | runs/v55-a | runs/v56-0 | runs/v56-a |
|---|---|---|---|
| Supply before year 1 close | 82.9M (77.0M–90.3M) | 82.9M (77.0M–90.3M) | 87.9M (77.1M–96.7M) |
| Avg rate, year 1 (FD/mi) | 4.84 (4.74–4.93) | 4.84 (4.74–4.93) | 4.77 (4.69–4.85) |
| Operating sinks/faucets, all quarters | 82% (75%–90%) | 82% (75%–90%) | 84% (72%–97%) |
| Sinks incl. burn / faucets, whole run | 87% (86%–88%) | 87% (86%–88%) | 90% (90%–91%) |
| Wealth Gini | 0.52 (0.49–0.57) | 0.52 (0.49–0.57) | 0.47 (0.43–0.53) |
| Top 1% share of wealth | 7% (6%–7%) | 7% (6%–7%) | 6% (5%–7%) |
| Top 10% share of wealth | 36% (34%–40%) | 36% (34%–40%) | 32% (30%–38%) |
| Miles Gini | 0.44 (0.43–0.45) | 0.44 (0.43–0.45) | 0.44 (0.43–0.45) |
| Avg wealth: owner-operator | 76k (61k–85k) | 76k (61k–85k) | 101k (79k–113k) |
| Avg wealth: fleet | 223k (200k–245k) | 223k (200k–245k) | 232k (218k–246k) |
| Avg wealth: broker | -348 (-837–208) | -348 (-837–208) | 4k (2k–5k) |
| Repossessions | 0 (0–0) | 0 (0–0) | 0 (0–0) |
| Companies repossessed | 0 (0–0) | 0 (0–0) | 0 (0–0) |
| Carriers wiped out | 0 (0–0) | 0 (0–0) | 0 (0–0) |
| Companies in debt at end | 45 (37–49) | 45 (37–49) | 20 (12–34) |
| Debt in red balances at end | -101k (-117k–-73k) | -101k (-117k–-73k) | -109k (-206k–-56k) |
| Liquidations | 157 (131–186) | 157 (131–186) | 93 (80–105) |
| Companies liquidated at least once | 97 (91–101) | 97 (91–101) | 89 (74–100) |
| …of them owner-operators / fleets / brokers | 26 / 11 / 60 | 26 / 11 / 60 | 24 / 14 / 51 |
| Debt written off at restart (faucet) | 525k (397k–669k) | 525k (397k–669k) | 184k (73k–270k) |
| Holding cost paid (sink) | 0 (0–0) | 0 (0–0) | 0 (0–0) |
| Fuel tax paid, IFTA-style (sink) | 12.3M (12.2M–12.5M) | 12.3M (12.2M–12.5M) | 12.2M (12.1M–12.4M) |
| Sales tax paid (sink) | 12.0M (11.5M–12.6M) | 12.0M (11.5M–12.6M) | 12.8M (12.2M–13.4M) |
| Managers' pay (sink) | 5.4M (5.3M–5.6M) | 5.4M (5.3M–5.6M) | 5.2M (4.8M–5.8M) |
| Businesses: upkeep / parts (sinks) | 3.7M / 11.4M | 3.7M / 11.4M | 3.5M / 11.6M |
| Businesses open at end: shops / truck stops / fuel stations (owners' FD per business-year, purchase included) | 20 (-55k) / 55 (-402k) / 0 (0) | 20 (-55k) / 55 (-402k) / 0 (0) | 19 (-54k) / 47 (-398k) / 0 (0) |
| Businesses: the trade alone per business-year, shops / truck stops / fuel stations (average purchase) | 131k (122k) / 14k (170k) / 0 (0) | 131k (122k) / 14k (170k) / 0 (0) | 120k (118k) / 13k (173k) / 0 (0) |
| Legs held by a winter pass closure | 869 (816–917) | 869 (816–917) | 871 (857–878) |
| Dock waits / hours per wait / missed appointment slots | 98795 / 11.2 / 17418 | 98795 / 11.2 / 17418 | 97589 / 11.2 / 17504 |
| Cargo thefts / cargo value stolen / flatbed damage claims | 264 / 1.2M / 542 | 264 / 1.2M / 542 | 254 / 1.1M / 502 |
| Reefer unit fuel (sink) | 1.3M (1.1M–1.4M) | 1.3M (1.1M–1.4M) | 1.3M (1.2M–1.3M) |
| Robbery: crews hired / hits / rigs chopped | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| Robbery: cargo taken / paid to hirers / crew fees / security fittings bought | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Back Lot: fences paid / chop shops paid / their resales / victims paid from stakes / bounties posted → paid | 0 / 0 / 0 / 0 / 0 → 0 | 0 / 0 / 0 / 0 / 0 → 0 | 0 / 0 / 0 / 0 / 0 → 0 |
| Back Lot v2: crews caught / talked / gave up; investigations / convictions / fines / suspensions | 0 / 0 / 0; 0 / 0 / 0 / 0 | 0 / 0 / 0; 0 / 0 / 0 / 0 | 0 / 0 / 0; 0 / 0 / 0 / 0 |
| Back Lot v2: hirers' net (take − fees) / yard security bought (yards with any) / deductibles the lessor carried; companies hot at end / max heat | 0 / 0 (0) / 0; 0 / 0 | 0 / 0 (0) / 0; 0 / 0 | 0 / 0 (0) / 0; 0 / 0 |
| Leases by value: NPC lease deposits held at end | 7.2M (6.2M–9.1M) | 7.2M (6.2M–9.1M) | 6.0M (4.3M–8.3M) |
| Purchase loans: made / still owed at end (open loans) | 36.8M / 17.7M (310) | 36.8M / 17.7M (310) | 46.3M / 21.2M (344) |
| Purchase loans: interest / defaults / trucks taken back / stakes slashed / written off | 2.8M / 49 / 36 / 83k / 430k | 2.8M / 49 / 36 / 83k / 430k | 3.8M / 42 / 32 / 55k / 651k |
| Assets: new equipment bought / its share of all sinks (bar: 15%+) | 30.6M / 6% (5%–7%) | 30.6M / 6% (5%–7%) | 43.3M / 8% (7%–9%) |
| Assets: all equipment costs (new, NPC lease share, trailer rent, rebuilds) / share of sinks | 81.4M / 17% | 81.4M / 17% | 91.7M / 17% |
| Player share: new trucks / shop work / insurance / freight (EVE bar: players make most of it) | 7% / 19% / 19% / 1% | 7% / 19% / 19% / 1% | 7% / 19% / 0% / 1% |
| Assets: tractors / trailers scrapped, rigs written off, trailers stolen from yards | 31 / 19 / 11 / 3 | 31 / 19 / 11 / 3 | 43 / 31 / 12 / 1 |
| Assets: factory built tractors / trailers; sold by player dealerships (FD) | 143 / 182; 31 (2.1M) | 143 / 182; 31 (2.1M) | 137 / 197; 32 (1.9M) |
| Assets: trade-ins / player leases taken / businesses, facilities and yards resold | 67 / 109 / 0 | 67 / 109 / 0 | 69 / 116 / 0 |
| Assets: owned trailers / rentals out / tractors on lease, at end; swaps and refurbishments | 771 / 54 / 58; 46 / 512 | 771 / 54 / 58; 46 / 512 | 806 / 50 / 60; 65 / 459 |
| Nights at a site / on the shoulder / shoulder tickets / sites found full | 173724 / 18253 / 5991 / 212 | 173724 / 18253 / 5991 / 212 | 173970 / 18282 / 6009 / 188 |
| Breakdowns served by truck stops / hub shops / NPC road service | 613 / 356 / 4134 | 613 / 356 / 4134 | 559 / 340 / 3903 |
| Shops, NPC: maintenance / repairs / rebuilds (sinks) | 20.7M / 1.9M / 29.8M | 20.7M / 1.9M / 29.8M | 20.6M / 1.8M / 28.6M |
| Shipper defaults on brokered loads | 605 (492–799) | 605 (492–799) | 463 (304–567) |
| Equipment Finance written off | 0 (0–0) | 0 (0–0) | 0 (0–0) |
| Used-truck sales | 186 (178–193) | 186 (178–193) | 185 (173–192) |
| NPC used lot: rigs sold / FD taken (sink) | 239 / 11.5M | 239 / 11.5M | 189 / 9.0M |
| Owned trucks at end | 717 (681–738) | 717 (681–738) | 734 (696–763) |
| Extra leases out, average | 69 (59–88) | 69 (59–88) | 61 (45–77) |
| Tractor cap at end | 120 (120–120) | 120 (120–120) | 120 (120–120) |
| Player trucks running in booms / busts | 756 / 727 | 756 / 727 | 759 / 746 |
| Avg rate in booms / busts (FD/mi) | 5.24 / 4.09 | 5.24 / 4.09 | 5.16 / 4.04 |
| Loads expired unhauled per day, booms | 450 (392–488) | 450 (392–488) | 454 (398–492) |
| Fleet profit per truck-week after overhead | 5k (5k–6k) | 5k (5k–6k) | 5k (4k–5k) |
| Owner-operator profit per truck-week | 3k (3k–3k) | 3k (3k–3k) | 3k (3k–4k) |
| FD burned outside operations (buyback, launch, fees) | 17.7M (15.8M–19.9M) | 17.7M (15.8M–19.9M) | 18.6M (17.6M–20.3M) |
| Buyback: FD bought and burned | 0 (0–0) | 0 (0–0) | 0 (0–0) |
| Buyback: average clearing price ($/FD) | n/a | n/a | n/a |
| Buyback: price, lowest / highest quarter ($/FD) | n/a | n/a | n/a |
| Buyback: share of FD offered that was bought | n/a | n/a | n/a |
| $ taken out per company-week: owner-operator / fleet / broker | $0.00 / $0.00 / $0.00 | $0.00 / $0.00 / $0.00 | $0.00 / $0.00 / $0.00 |
| Token: price at launch → end ($/FD) | n/a | n/a | n/a |
| Token: seeds that hold the launch price / whose pool dollars grew | n/a | n/a | n/a |
| Token: new buying that holds the end price ($ per 1,000 companies a month) | n/a | n/a | n/a |
| Token: FD sold into the pool net of buys, per month | n/a | n/a | n/a |
| Token: market cap at launch → end (peak) | n/a | n/a | n/a |
| Token: FDV at launch → end (peak); circulating share of total at end | n/a | n/a | n/a |
| Token: lowest / highest price | n/a | n/a | n/a |
| Token: supply right after launch → end (pool included) | n/a | n/a | n/a |
| Token: growth of FD outstanding, launch → end | n/a | n/a | n/a |
| Supply ceiling: growth allowed; outstanding at end vs the path | off | off | off |
| Supply ceiling: worst day over the path / days over | off | off | off |
| Supply ceiling: weeks the payouts waited / weeks the dial sat at its floor / vest weeks held | off | off | off |
| Supply ceiling: airdrop queued (peak / at end) and paid back out | off | off | off |
| Balance dial: NPC rate multiplier, lowest / at end | n/a / 0.55 | n/a / 0.55 | n/a / 0.57 |
| Price band: width / trades clipped / biggest day's move in its days | off | off | off |
| Opening auction: dollars bid / bidders / clearing price / pool dollars at open | off | off | off |
| Launch fee: start, days; dollars taken on buys / FD burned on sales above the normal fees | off | off | off |
| Bridge: timer (days at launch → end) / FD requested → cleared / mean wait (days) / days capped / waiting at end | off | off | off |
| Locked (spend-only) FD at end | n/a | n/a | n/a |
| Logbook: paid at launch / by honest milestones / by criminal / still locked at end | off | off | off |
| Logbook: forfeited on conviction / median share of an allocation unlocked / books | off | off | off |
| Logbook: companies reaching each milestone | off | off | off |
| Unlock ladder: days after launch businesses / re-brokering / crews opened | off | off | off |
| Token: FD held by companies at end | n/a | n/a | n/a |
| Token: launch burned / locked | n/a | n/a | n/a |
| Token: operating sinks / faucets since launch | n/a | n/a | n/a |
| Token: burned since launch (profit tax / buyback / sell fee) | n/a | n/a | n/a |
| Token: treasury revenue (product + fees) / to buybacks | n/a | n/a | n/a |
| Token: worst drawdown from a peak / pool dollars at their peak | n/a | n/a | n/a |
| Token: net $ taken out — farmers / sybils / speculators (momentum, crowd, whale) | n/a | n/a | n/a |
| Token: pool dollars at launch → end | n/a | n/a | n/a |
| Token: developer's vest — FD sold into the pool / dollars taken | n/a | n/a | n/a |
| Token: net $ taken out — owner-operators / fleets / brokers / newcomers | n/a | n/a | n/a |
| Token: airdrop minted / forfeited / haircut (of 10M) | n/a | n/a | n/a |
| Token: newcomers after launch | n/a | n/a | n/a |
| Free path: bought within 84 days (of all free starters) | 289 (270–305) | 289 (270–305) | 344 (321–367) |
| Free path median days (seeds where half bought) | 52 (45–63) | 52 (45–63) | 36 (31–43) |
| First bid by hand: free starters that bid / median and mean days the truck waited | 400 (400–400) of 400 (400–400) / 1 (1–1) / 1.0 (1.0–1.0) | 400 (400–400) of 400 (400–400) / 1 (1–1) / 1.0 (1.0–1.0) | 400 (400–400) of 400 (400–400) / 1 (1–1) / 1.0 (1.0–1.1) |
| Top strategy vs segment median | 1.35× (1.26×–1.42×) | 1.35× (1.26×–1.42×) | 1.35× (1.29×–1.44×) |
| Crashes (fatal / at fault / willful) | 83 (3 / 48 / 11) | 83 (3 / 48 / 11) | 81 (3 / 46 / 9) |
| Compliance reviews / unsatisfactory / shutdowns | 199 / 43 / 26 | 199 / 43 / 26 | 194 / 41 / 27 |
| Thefts / double-brokered loads / convictions | 0 / 116 / 21 | 0 / 116 / 21 | 0 / 99 / 20 |
| Carriers at end: conditional / unsat / revoked / cutting corners | 4 / 1 / 1 / 115 | 4 / 1 / 1 / 115 | 3 / 1 / 2 / 115 |
| Fines / liability / seized / cargo claims (sinks) | 5.2M / 1.2M / 27k / 972k | 5.2M / 1.2M / 27k / 972k | 5.2M / 948k / 305k / 890k |
| Driver wages / dispatcher salaries (sinks) | 101.9M / 892k | 101.9M / 892k | 101.5M / 877k |
| Fence payouts / cargo insurance (faucets) | 0 / 9k | 0 / 9k | 0 / 9k |
| Drivers employed / in pool / trucks without one, at end | 399 / 188 / 3 | 399 / 188 / 3 | 363 / 209 / 1 |
| Trucks without a driver, average | 1 (1–1) | 1 (1–1) | 1 (1–1) |
| Insurance (sink) / yard rent (sink) | 3.9M / 528k | 3.9M / 528k | 4.3M / 528k |
| Insurance market index: low / high / end | 1.00 / 1.38 / 1.38 | 1.00 / 1.38 / 1.38 | 1.00 / 1.38 / 1.38 |
| Dealer price index (Workhorse + van): low / high / end | 0.90 / 1.20 / 0.90 | 0.90 / 1.20 / 0.90 | 0.91 / 1.20 / 0.91 |
| Wage index / mean employed driver skill, at end | 0.92 / 0.51 | 0.92 / 0.51 | 0.92 / 0.52 |
| Operating sinks, all tags (FD) | 451.9M (441.9M–464.4M) | 451.9M (441.9M–464.4M) | 488.0M (478.6M–502.9M) |
| Sinks: factoring discounts / insurance / surety / NPC lessor's share | 0 / 3.9M / 31k / 20.5M | 0 / 3.9M / 31k / 20.5M | 23.7M / 4.3M / 237k / 19.2M |
| Factoring discounts' share of operating sinks | 0.0% (0.0%–0.0%) | 0.0% (0.0%–0.0%) | 4.9% (4.8%–5.0%) |
| Factoring: carriers / brokers that signed; contracts signed / renewed / lapsed | n/a | 459 / 0; 481 / 0 / 0 | 518 / 31; 1200 / 638 / 683 |
| Factoring: carriers' first signing by fleet, 1 / 2 / 3-5 / 6-10 / 11-20 / 21+ trucks | n/a | 419 / 24 / 16 / 0 / 0 / 0 | 382 / 44 / 66 / 26 / 0 / 0 |
| Factoring: invoices factored, carriers / brokers (FD) | n/a | 0 / 0 | 401.7M / 4.8M |
| Factoring: discounts paid, carriers / brokers (FD); carriers' mean rate | n/a | 0 / 0; 0.00% | 23.5M / 242k; 5.85% |
| Starters: bought a first truck / had it running / signed within 30 days of its first day | n/a | 400 / 400 / 9 (2%) | 400 / 400 / 301 (75%) |
| One-truck owners liquidated after buying: signed at one truck / never signed | n/a | 25 of 405 (6%) / 0 of 17 (0%) | 23 of 382 (6%) / 0 of 2 (14%) |
| Broker AP cap: tenders a broker passed up / of them no broker could take (to the open board) / bids and bookings refused | n/a | 0 / 0 / 0 | 58576 / 52631 / 24 |
| Broker bonds: paid for broker paper (to the NPC factor or lessor) / NPC paper unpaid / paid from an overdraft / posted at end | n/a | 0 (0) / 0 / 0 / 0 | 2.5M (2.4M) / 0 / 0 / 389k |
| NPC freight delivered: brokered / direct loads; carrier pay per mile | n/a | 3404 / 135012; 4.17 / 4.80 | 2809 / 134355; 3.82 / 4.76 |
