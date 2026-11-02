Batch v57 (2026-11-02, the population dial), full size, 730 days (two game years, the whole beta), seeds 1, 4, 8, seasons on, the live profile (ruleset 0.19.3-phase0.32). Four runs: v57-0, the dial off (its first 400 days reproduce v55-a exactly); v57-a, `population.dial.enabled=true` (band 0.55–1.25 loads posted a day per truck in service, 28-day mean, from day 112; 5 entrants or 5 wind-downs a week at most); v57-w0, a join wave of 12 free-path newcomers a week for eight weeks from day 140 (ten on top of the normal two; strategy "wave:"), the dial off; v57-w, the wave with the dial on. See studio/reviews/economy-population-dial.md.

    npm run sim -- --seeds 1 --days 730 --quiet --out runs/v57-0                                                          # and 4, 8
    npm run sim -- --seeds 1 --days 730 --quiet --set population.dial.enabled=true --out runs/v57-a
    npm run sim -- --seeds 1 --days 730 --quiet --set population.wave.enabled=true --out runs/v57-w0
    npm run sim -- --seeds 1 --days 730 --quiet --set population.wave.enabled=true --set population.dial.enabled=true --out runs/v57-w
    npx tsx apps/sim/src/compare.ts runs/v57-0 runs/v57-a runs/v57-w0 runs/v57-w

The loads-per-truck rows read the daily `posted ÷ trucksInService` (new in DayMetrics), as a 28-day mean from day 112. The factoring rows are v56's (their switch is off here: they count the old one-year contract). The prudence rows are the new `byStrategy` report: mean wealth at day 730 and the share liquidated at least once, by starting segment and persona.

| Measure | runs/v57-0 | runs/v57-a | runs/v57-w0 | runs/v57-w |
|---|---|---|---|---|
| Supply before year 1 close | 82.9M (77.0M–90.3M) | 82.9M (77.0M–90.3M) | 79.1M (69.4M–88.6M) | 78.6M (69.4M–87.0M) |
| Supply before year 2 close | 78.8M (69.8M–85.4M) | 77.9M (69.8M–83.6M) | 77.0M (64.0M–84.3M) | 76.2M (64.0M–84.2M) |
| Supply growth, year 2 vs 1 | 0.95× (0.91×–1.00×) | 0.94× (0.91×–0.98×) | 0.97× (0.92×–1.06×) | 0.97× (0.92×–1.06×) |
| Avg rate, year 1 (FD/mi) | 4.84 (4.74–4.93) | 4.84 (4.74–4.93) | 4.77 (4.62–4.87) | 4.77 (4.62–4.88) |
| Avg rate, year 2 (FD/mi) | 3.52 (3.49–3.55) | 3.50 (3.47–3.54) | 3.61 (3.56–3.65) | 3.59 (3.47–3.65) |
| Operating sinks/faucets, all quarters | 85% (75%–103%) | 85% (75%–103%) | 88% (75%–102%) | 87% (75%–101%) |
| Sinks incl. burn / faucets, whole run | 87% (87%–88%) | 88% (87%–88%) | 89% (88%–90%) | 89% (88%–90%) |
| Wealth Gini | 0.59 (0.57–0.63) | 0.62 (0.60–0.63) | 0.64 (0.63–0.65) | 0.64 (0.63–0.65) |
| Top 1% share of wealth | 8% (7%–10%) | 9% (6%–10%) | 9% (8%–11%) | 9% (8%–11%) |
| Top 10% share of wealth | 41% (39%–43%) | 43% (41%–44%) | 46% (45%–47%) | 45% (45%–46%) |
| Miles Gini | 0.45 (0.44–0.46) | 0.48 (0.45–0.50) | 0.50 (0.49–0.51) | 0.51 (0.49–0.53) |
| Avg wealth: owner-operator | 70k (69k–72k) | 65k (58k–71k) | 75k (71k–79k) | 72k (64k–76k) |
| Avg wealth: fleet | 208k (202k–219k) | 209k (201k–219k) | 237k (196k–264k) | 224k (196k–243k) |
| Avg wealth: broker | -409 (-480–-331) | -404 (-461–-331) | -449 (-529–-358) | -453 (-551–-358) |
| Repossessions | 0 (0–0) | 1 (0–1) | 0 (0–1) | 1 (0–2) |
| Companies repossessed | 0 (0–0) | 1 (0–1) | 0 (0–1) | 0 (0–1) |
| Carriers wiped out | 0 (0–0) | 0 (0–0) | 0 (0–0) | 0 (0–0) |
| Companies in debt at end | 63 (58–68) | 74 (58–84) | 66 (61–70) | 77 (66–92) |
| Debt in red balances at end | -113k (-171k–-69k) | -210k (-284k–-69k) | -124k (-130k–-115k) | -284k (-471k–-115k) |
| Liquidations | 327 (268–385) | 342 (268–400) | 402 (342–451) | 398 (342–449) |
| Companies liquidated at least once | 142 (132–154) | 156 (132–170) | 195 (190–203) | 197 (190–207) |
| …of them owner-operators / fleets / brokers | 66 / 16 / 60 | 80 / 16 / 60 | 77 / 24 / 60 | 80 / 22 / 60 |
| Debt written off at restart (faucet) | 1.3M (1.1M–1.6M) | 1.4M (1.2M–1.7M) | 1.9M (1.7M–2.0M) | 1.7M (1.6M–1.7M) |
| Holding cost paid (sink) | 0 (0–0) | 0 (0–0) | 0 (0–0) | 0 (0–0) |
| Fuel tax paid, IFTA-style (sink) | 21.0M (20.8M–21.2M) | 21.0M (20.8M–21.2M) | 23.1M (23.0M–23.2M) | 22.8M (22.6M–23.1M) |
| Sales tax paid (sink) | 17.9M (17.3M–18.5M) | 17.9M (17.3M–18.6M) | 20.4M (18.8M–21.4M) | 20.0M (18.8M–20.6M) |
| Managers' pay (sink) | 7.9M (7.2M–9.1M) | 7.8M (6.9M–9.1M) | 8.9M (8.0M–10.6M) | 8.8M (7.8M–10.6M) |
| Businesses: upkeep / parts (sinks) | 11.1M / 22.3M | 11.1M / 22.1M | 10.2M / 23.4M | 10.3M / 23.0M |
| Businesses open at end: shops / truck stops / fuel stations (owners' FD per business-year, purchase included) | 20 (50k) / 68 (-135k) / 0 (0) | 19 (58k) / 69 (-136k) / 0 (0) | 18 (82k) / 56 (-119k) / 0 (0) | 18 (50k) / 55 (-117k) / 0 (0) |
| Businesses: the trade alone per business-year, shops / truck stops / fuel stations (average purchase) | 159k (108k) / 9k (155k) / 0 (0) | 169k (107k) / 8k (154k) / 0 (0) | 190k (109k) / 18k (152k) / 0 (0) | 148k (110k) / 13k (150k) / 0 (0) |
| Legs held by a winter pass closure | 1158 (1095–1222) | 1159 (1095–1204) | 1248 (1143–1303) | 1263 (1143–1326) |
| Dock waits / hours per wait / missed appointment slots | 173887 / 11.1 / 29217 | 173866 / 11.1 / 29193 | 191768 / 11.1 / 31440 | 190142 / 11.1 / 31135 |
| Cargo thefts / cargo value stolen / flatbed damage claims | 441 / 1.6M / 1060 | 440 / 1.6M / 1048 | 479 / 1.7M / 1260 | 477 / 1.7M / 1238 |
| Reefer unit fuel (sink) | 2.2M (2.0M–2.4M) | 2.2M (2.0M–2.4M) | 2.6M (2.5M–2.7M) | 2.6M (2.6M–2.7M) |
| Robbery: crews hired / hits / rigs chopped | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| Robbery: cargo taken / paid to hirers / crew fees / security fittings bought | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Back Lot: fences paid / chop shops paid / their resales / victims paid from stakes / bounties posted → paid | 0 / 0 / 0 / 0 / 0 → 0 | 0 / 0 / 0 / 0 / 0 → 0 | 0 / 0 / 0 / 0 / 0 → 0 | 0 / 0 / 0 / 0 / 0 → 0 |
| Back Lot v2: crews caught / talked / gave up; investigations / convictions / fines / suspensions | 0 / 0 / 0; 0 / 0 / 0 / 0 | 0 / 0 / 0; 0 / 0 / 0 / 0 | 0 / 0 / 0; 0 / 0 / 0 / 0 | 0 / 0 / 0; 0 / 0 / 0 / 0 |
| Back Lot v2: hirers' net (take − fees) / yard security bought (yards with any) / deductibles the lessor carried; companies hot at end / max heat | 0 / 0 (0) / 0; 0 / 0 | 0 / 0 (0) / 0; 0 / 0 | 0 / 0 (0) / 0; 0 / 0 | 0 / 0 (0) / 0; 0 / 0 |
| Leases by value: NPC lease deposits held at end | 10.8M (10.3M–11.7M) | 10.8M (10.4M–11.7M) | 13.3M (12.4M–13.9M) | 12.4M (11.4M–13.9M) |
| Purchase loans: made / still owed at end (open loans) | 56.9M / 15.7M (296) | 57.0M / 15.4M (292) | 76.4M / 21.6M (356) | 75.7M / 20.9M (356) |
| Purchase loans: interest / defaults / trucks taken back / stakes slashed / written off | 4.6M / 161 / 113 / 270k / 1.1M | 4.6M / 169 / 119 / 289k / 1.2M | 5.8M / 232 / 163 / 352k / 1.5M | 5.7M / 237 / 166 / 324k / 1.7M |
| Assets: new equipment bought / its share of all sinks (bar: 15%+) | 50.6M / 7% (6%–7%) | 50.6M / 7% (6%–7%) | 64.8M / 8% (6%–8%) | 62.2M / 7% (6%–8%) |
| Assets: all equipment costs (new, NPC lease share, trailer rent, rebuilds) / share of sinks | 120.6M / 16% | 120.8M / 16% | 141.0M / 16% | 137.8M / 16% |
| Player share: new trucks / shop work / insurance / freight (EVE bar: players make most of it) | 26% / 24% / 46% / 1% | 24% / 24% / 46% / 1% | 21% / 23% / 45% / 2% | 22% / 23% / 44% / 2% |
| Assets: tractors / trailers scrapped, rigs written off, trailers stolen from yards | 147 / 87 / 16 / 7 | 147 / 93 / 18 / 6 | 198 / 111 / 23 / 5 | 194 / 112 / 21 / 4 |
| Assets: factory built tractors / trailers; sold by player dealerships (FD) | 264 / 300; 163 (14.3M) | 263 / 305; 155 (14.2M) | 325 / 341; 143 (14.3M) | 316 / 336; 153 (16.3M) |
| Assets: trade-ins / player leases taken / businesses, facilities and yards resold | 96 / 433 / 16 | 99 / 397 / 17 | 167 / 241 / 13 | 149 / 225 / 9 |
| Assets: owned trailers / rentals out / tractors on lease, at end; swaps and refurbishments | 736 / 104 / 77; 234 / 625 | 717 / 100 / 62; 221 / 623 | 711 / 76 / 47; 134 / 659 | 716 / 75 / 48; 132 / 650 |
| Nights at a site / on the shoulder / shoulder tickets / sites found full | 292655 / 30435 / 10022 / 249 | 292812 / 30394 / 9989 / 238 | 317577 / 32598 / 10852 / 278 | 313568 / 32080 / 10637 / 302 |
| Breakdowns served by truck stops / hub shops / NPC road service | 2129 / 792 / 6983 | 2107 / 801 / 6993 | 2053 / 940 / 7959 | 1930 / 926 / 7850 |
| Shops, NPC: maintenance / repairs / rebuilds (sinks) | 32.7M / 3.1M / 34.7M | 32.7M / 3.1M / 35.0M | 35.8M / 3.3M / 34.9M | 35.3M / 3.3M / 34.1M |
| Shipper defaults on brokered loads | 732 (592–936) | 732 (592–936) | 954 (792–1116) | 945 (750–1116) |
| Equipment Finance written off | 0 (0–0) | 0 (0–0) | 0 (0–0) | 0 (0–0) |
| Used-truck sales | 324 (302–348) | 359 (302–398) | 512 (433–573) | 509 (433–586) |
| NPC used lot: rigs sold / FD taken (sink) | 245 / 11.8M | 247 / 11.9M | 268 / 13.0M | 272 / 13.2M |
| Owned trucks at end | 615 (598–627) | 606 (598–618) | 598 (575–632) | 608 (575–629) |
| Extra leases out, average | 122 (106–149) | 121 (104–149) | 157 (140–187) | 159 (143–187) |
| Tractor cap at end | 120 (120–120) | 120 (120–120) | 120 (120–120) | 120 (120–120) |
| Player trucks running in booms / busts | 798 / 787 | 795 / 786 | 843 / 819 | 839 / 820 |
| Avg rate in booms / busts (FD/mi) | 4.54 / 3.74 | 4.52 / 3.74 | 4.59 / 3.72 | 4.57 / 3.72 |
| Loads expired unhauled per day, booms | 470 (366–543) | 466 (366–530) | 450 (324–520) | 432 (324–490) |
| Fleet profit per truck-week after overhead | 4k (4k–4k) | 4k (4k–4k) | 4k (4k–4k) | 4k (4k–4k) |
| Owner-operator profit per truck-week | 2k (2k–2k) | 2k (2k–2k) | 2k (2k–2k) | 2k (2k–2k) |
| FD burned outside operations (buyback, launch, fees) | 58.7M (55.7M–64.5M) | 57.8M (53.4M–64.3M) | 57.4M (52.4M–60.9M) | 56.9M (52.4M–60.5M) |
| Buyback: FD bought and burned | 0 (0–0) | 0 (0–0) | 0 (0–0) | 0 (0–0) |
| Buyback: average clearing price ($/FD) | n/a | n/a | n/a | n/a |
| Buyback: price, lowest / highest quarter ($/FD) | n/a | n/a | n/a | n/a |
| Buyback: share of FD offered that was bought | n/a | n/a | n/a | n/a |
| $ taken out per company-week: owner-operator / fleet / broker | $0.00 / $0.00 / $0.00 | $0.00 / $0.00 / $0.00 | $0.00 / $0.00 / $0.00 | $0.00 / $0.00 / $0.00 |
| Token: price at launch → end ($/FD) | $0.0012 → $0.0013 ($0.00096–$0.0015) | $0.0012 → $0.0013 ($0.0010–$0.0015) | $0.0014 → $0.0016 ($0.0014–$0.0018) | $0.0013 → $0.0015 ($0.0013–$0.0017) |
| Token: seeds that hold the launch price / whose pool dollars grew | 3/3 / 3/3 | 3/3 / 3/3 | 3/3 / 3/3 | 3/3 / 3/3 |
| Token: new buying that holds the end price ($ per 1,000 companies a month) | $0 ($0–$0) | $0 ($0–$0) | $0 ($0–$0) | $0 ($0–$0) |
| Token: FD sold into the pool net of buys, per month | -3.0M (-3.2M–-2.6M) | -3.2M (-3.9M–-2.6M) | -3.7M (-4.2M–-3.1M) | -3.3M (-3.4M–-3.1M) |
| Token: market cap at launch → end (peak) | $104k → $116k (peak $116k) | $107k → $120k (peak $120k) | $125k → $143k (peak $143k) | $116k → $130k (peak $130k) |
| Token: FDV at launch → end (peak); circulating share of total at end | $1.1M → $1.2M (peak $1.2M); 10% | $1.1M → $1.3M (peak $1.3M); 10% | $1.3M → $1.5M (peak $1.5M); 9% | $1.2M → $1.4M (peak $1.4M); 10% |
| Token: lowest / highest price | $0.0013 / $0.0013 | $0.0013 / $0.0013 | $0.0016 / $0.0016 | $0.0015 / $0.0015 |
| Token: supply right after launch → end (pool included) | 113.4M → 113.4M | 112.3M → 112.3M | 111.2M → 111.2M | 112.7M → 112.7M |
| Token: growth of FD outstanding, launch → end | 0% (0%–0%) | 0% (0%–0%) | 0% (0%–0%) | 0% (0%–0%) |
| Supply ceiling: growth allowed; outstanding at end vs the path | 10% over 1460 days; 113.4M vs 113.7M | 10% over 1460 days; 112.3M vs 112.8M | 10% over 1460 days; 111.2M vs 113.2M | 10% over 1460 days; 112.7M vs 114.1M |
| Supply ceiling: worst day over the path / days over | 0.0% / 0 | 0.0% / 0 | 0.0% / 0 | 0.0% / 0 |
| Supply ceiling: weeks the payouts waited / weeks the dial sat at its floor / vest weeks held | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| Supply ceiling: airdrop queued (peak / at end) and paid back out | 0 / 0; 0 | 0 / 0; 0 | 0 / 0; 0 | 0 / 0; 0 |
| Balance dial: NPC rate multiplier, lowest / at end | 0.50 / 0.50 | 0.50 / 0.50 | 0.51 / 0.51 | 0.50 / 0.50 |
| Price band: width / trades clipped / biggest day's move in its days | off | off | off | off |
| Opening auction: dollars bid / bidders / clearing price / pool dollars at open | off | off | off | off |
| Launch fee: start, days; dollars taken on buys / FD burned on sales above the normal fees | 50%, 14; $4k / 0 | 50%, 14; $4k / 0 | 50%, 14; $5k / 0 | 50%, 14; $4k / 0 |
| Bridge: timer (days at launch → end) / FD requested → cleared / mean wait (days) / days capped / waiting at end | 28 → 8 / 188k → 0 / 0.0 / 0 / 188k | 28 → 8 / 137k → 0 / 0.0 / 0 / 137k | 28 → 8 / 45k → 0 / 0.0 / 0 / 45k | 28 → 8 / 66k → 0 / 0.0 / 0 / 66k |
| Locked (spend-only) FD at end | 22.0M (19.9M–23.2M) | 21.7M (19.9M–23.2M) | 22.7M (20.6M–23.8M) | 22.5M (20.6M–23.8M) |
| Logbook: paid at launch / by honest milestones / by criminal / still locked at end | 100k / 0 / 0 / 9.9M | 100k / 0 / 0 / 9.9M | 100k / 0 / 0 / 9.9M | 100k / 0 / 0 / 9.9M |
| Logbook: forfeited on conviction / median share of an allocation unlocked / books | 0 / 1% / 566 | 0 / 1% / 594 | 0 / 1% / 660 | 0 / 1% / 668 |
| Logbook: companies reaching each milestone | none | none | none | none |
| Unlock ladder: days after launch businesses / re-brokering / crews opened | -702 / -639 / -548 | -702 / -639 / -548 | -702 / -639 / -548 | -702 / -639 / -548 |
| Token: FD held by companies at end | 21.4M (20.1M–22.2M) | 21.2M (20.1M–21.7M) | 21.9M (19.1M–23.5M) | 21.4M (19.1M–23.4M) |
| Token: launch burned / locked | 32.5M / 13.6M | 31.9M / 13.2M | 30.9M / 15.6M | 29.6M / 14.9M |
| Token: operating sinks / faucets since launch | 86% (71%–98%) | 97% (83%–110%) | 137% (134%–142%) | 120% (94%–136%) |
| Token: burned since launch (profit tax / buyback / sell fee) | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| Token: treasury revenue (product + fees) / to buybacks | $4k / $0 | $4k / $0 | $6k / $0 | $4k / $0 |
| Token: worst drawdown from a peak / pool dollars at their peak | 0% / $68k | 0% / $70k | 0% / $86k | 0% / $78k |
| Token: net $ taken out — farmers / sybils / speculators (momentum, crowd, whale) | $0 / $0 / $0 | $0 / $0 / $0 | $0 / $0 / $0 | $0 / $0 / $0 |
| Token: pool dollars at launch → end | $65k → $68k ($55k–$78k) | $66k → $70k ($56k–$83k) | $80k → $86k ($76k–$100k) | $73k → $78k ($76k–$80k) |
| Token: developer's vest — FD sold into the pool / dollars taken | 0 / $0 | 0 / $0 | 0 / $0 | 0 / $0 |
| Token: net $ taken out — owner-operators / fleets / brokers / newcomers | $-8k / $-58k / $-6k / $0 | $-8k / $-60k / $-6k / $0 | $-8k / $-76k / $-8k / $0 | $-8k / $-67k / $-7k / $0 |
| Token: airdrop minted / forfeited / haircut (of 10M) | 10.0M / 0 / 0 | 10.0M / 0 / 0 | 10.0M / 0 / 0 | 10.0M / 0 / 0 |
| Token: newcomers after launch | 0 (0–0) | 0 (0–0) | 0 (0–0) | 0 (0–0) |
| Free path: bought within 84 days (of all free starters) | 289 (270–305) | 317 (270–342) | 382 (365–399) | 395 (365–436) |
| Free path median days (seeds where half bought) | 52 (45–63) | 50 (43–63) | 46 (44–49) | 45 (42–49) |
| First bid by hand: free starters that bid / median and mean days the truck waited | 400 (400–400) of 400 (400–400) / 1 (1–1) / 1.0 (1.0–1.0) | 435 (400–455) of 435 (400–455) / 1 (1–1) / 0.9 (0.9–1.0) | 496 (496–496) of 496 (496–496) / 1 (1–1) / 0.8 (0.8–0.8) | 511 (496–541) of 511 (496–541) / 1 (1–1) / 0.8 (0.7–0.8) |
| Top strategy vs segment median | 1.40× (1.32×–1.45×) | 1.40× (1.32×–1.44×) | 1.57× (1.54×–1.60×) | 1.53× (1.41×–1.60×) |
| Crashes (fatal / at fault / willful) | 122 (3 / 70 / 17) | 126 (4 / 73 / 18) | 134 (4 / 82 / 19) | 134 (4 / 81 / 18) |
| Compliance reviews / unsatisfactory / shutdowns | 237 / 55 / 40 | 266 / 62 / 42 | 383 / 68 / 52 | 391 / 69 / 50 |
| Thefts / double-brokered loads / convictions | 0 / 199 / 37 | 0 / 202 / 40 | 0 / 216 / 46 | 0 / 221 / 42 |
| Carriers at end: conditional / unsat / revoked / cutting corners | 1 / 2 / 2 / 130 | 4 / 7 / 4 / 131 | 3 / 2 / 3 / 151 | 4 / 2 / 3 / 154 |
| Fines / liability / seized / cargo claims (sinks) | 7.9M / 4.5M / 40k / 1.5M | 8.0M / 4.7M / 60k / 1.5M | 8.4M / 6.2M / 232k / 1.7M | 8.4M / 5.2M / 483k / 1.7M |
| Driver wages / dispatcher salaries (sinks) | 173.0M / 1.6M | 173.2M / 1.5M | 189.4M / 1.8M | 187.0M / 1.7M |
| Fence payouts / cargo insurance (faucets) | 0 / 9k | 0 / 9k | 0 / 22k | 0 / 21k |
| Drivers employed / in pool / trucks without one, at end | 303 / 177 / 73 | 282 / 190 / 63 | 382 / 167 / 57 | 374 / 145 / 48 |
| Trucks without a driver, average | 2 (2–2) | 2 (2–2) | 2 (2–2) | 2 (2–2) |
| Insurance (sink) / yard rent (sink) | 4.6M / 1.1M | 4.6M / 1.1M | 5.2M / 1.1M | 5.3M / 1.1M |
| Insurance market index: low / high / end | 1.00 / 1.40 / 1.40 | 1.00 / 1.40 / 1.40 | 1.00 / 1.40 / 1.40 | 1.00 / 1.40 / 1.40 |
| Dealer price index (Workhorse + van): low / high / end | 0.88 / 1.20 / 0.90 | 0.88 / 1.20 / 0.91 | 0.89 / 1.20 / 0.92 | 0.89 / 1.20 / 0.91 |
| Wage index / mean employed driver skill, at end | 0.92 / 0.56 | 0.92 / 0.58 | 0.92 / 0.54 | 0.92 / 0.54 |
| Operating sinks, all tags (FD) | 731.8M (725.5M–740.1M) | 733.1M (725.5M–742.6M) | 827.6M (811.7M–839.8M) | 814.6M (811.7M–817.6M) |
| Sinks: factoring discounts / insurance / surety / NPC lessor's share | 0 / 4.6M / 31k / 33.0M | 0 / 4.6M / 31k / 33.0M | 0 / 5.2M / 31k / 39.9M | 0 / 5.3M / 31k / 40.2M |
| Factoring discounts' share of operating sinks | 0.0% (0.0%–0.0%) | 0.0% (0.0%–0.0%) | 0.0% (0.0%–0.0%) | 0.0% (0.0%–0.0%) |
| Factoring: carriers / brokers that signed; contracts signed / renewed / lapsed | 476 / 0; 599 / 0 / 0 | 481 / 0; 604 / 0 / 0 | 564 / 0; 738 / 0 / 0 | 563 / 0; 716 / 0 / 0 |
| Factoring: carriers' first signing by fleet, 1 / 2 / 3-5 / 6-10 / 11-20 / 21+ trucks | 432 / 27 / 17 / 0 / 0 / 0 | 437 / 27 / 17 / 0 / 0 / 0 | 515 / 27 / 22 / 0 / 0 / 0 | 517 / 26 / 20 / 0 / 0 / 0 |
| Factoring: invoices factored, carriers / brokers (FD) | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Factoring: discounts paid, carriers / brokers (FD); carriers' mean rate | 0 / 0; 0.00% | 0 / 0; 0.00% | 0 / 0; 0.00% | 0 / 0; 0.00% |
| Starters: bought a first truck / had it running / signed within 30 days of its first day | 400 / 400 / 9 (2%) | 434 / 433 / 11 (3%) | 496 / 496 / 37 (7%) | 511 / 510 / 36 (7%) |
| One-truck owners liquidated after buying: signed at one truck / never signed | 69 of 418 (16%) / 0 of 30 (1%) | 71 of 422 (17%) / 9 of 59 (15%) | 102 of 505 (20%) / 4 of 46 (9%) | 99 of 503 (20%) / 7 of 58 (13%) |
| Broker AP cap: tenders a broker passed up / of them no broker could take (to the open board) / bids and bookings refused | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| Broker bonds: paid for broker paper (to the NPC factor or lessor) / NPC paper unpaid / paid from an overdraft / posted at end | 0 (0) / 0 / 0 / 2.6M | 0 (0) / 0 / 0 / 2.5M | 0 (0) / 0 / 0 / 2.5M | 0 (0) / 0 / 0 / 2.6M |
| NPC freight delivered: brokered / direct loads; carrier pay per mile | 3404 / 237241; 4.17 / 4.17 | 3404 / 237600; 4.17 / 4.17 | 3407 / 257698; 4.17 / 4.17 | 3407 / 254929; 4.17 / 4.17 |
| Loads per truck in service, 28-day mean from day 112: mean / p5–p95 / min–max | 0.88 / 0.59–1.37 / 0.56–1.59 | 0.87 / 0.59–1.38 / 0.56–1.57 | 0.79 / 0.55–1.26 / 0.50–1.44 | 0.79 / 0.55–1.23 / 0.52–1.31 |
| Loads per truck: booms / busts (demand dial over 1.1 / under 0.9); spread (sd) | 1.08 / 0.69; 0.24 | 1.08 / 0.69; 0.23 | 0.98 / 0.63; 0.21 | 0.96 / 0.63; 0.20 |
| Loads per truck: share of days under the floor / over the ceiling (the dial's band) | 0% / 10% (band 0.55–1.25) | 0% / 8% (band 0.55–1.25) | 6% / 5% (band 0.55–1.25) | 4% / 3% (band 0.55–1.25) |
| Loads per truck by quarter (28-day mean at each quarter's end) | NaN 0.71 0.87 0.84 0.71 0.98 1.22 0.92 | NaN 0.71 0.87 0.84 0.71 0.98 1.21 0.90 | NaN 0.64 0.79 0.73 0.64 0.90 1.15 0.78 | NaN 0.64 0.78 0.73 0.64 0.88 1.09 0.78 |
| Carriers trading at day 112 / 365 / 546 / end | 515 / 516 / 505 / 512 | 515 / 516 / 505 / 543 | 515 / 612 / 600 / 605 | 515 / 604 / 572 / 591 |
| Trucks in service at day 112 / 365 / 546 / end | 801 / 803 / 655 / 648 | 801 / 803 / 655 / 655 | 801 / 901 / 740 / 745 | 801 / 903 / 727 / 725 |
| Dial: days under / over the band; bots retired instead of restarted / wound down / entered | off | 0 / 52; 0 / 0 / 35 | off | 25 / 19; 9 / 18 / 15 |
| Sinks/faucets by quarter (operating) | 76% 85% 85% 82% 80% 96% 91% 85% | 76% 85% 85% 82% 80% 96% 89% 88% | 76% 87% 88% 86% 84% 99% 94% 88% | 76% 87% 88% 86% 83% 97% 92% 89% |
| Join wave: newcomers / bought a first truck (median days; within 84 days) / liquidated at least once | none | none | 96 / 96 (26; 94) / 34 | 96 / 96 (26; 94) / 35 |
| Prudence, owner-operators: mean wealth (share liquidated), conservative / random / greedy | 55k (18%) / 59k (18%) / 98k (14%) | 49k (21%) / 54k (18%) / 91k (15%) | 51k (24%) / 58k (21%) / 115k (13%) | 48k (21%) / 55k (22%) / 113k (15%) |
| Prudence, fleets: mean wealth (share liquidated), conservative / random / greedy | 128k (9%) / 175k (22%) / 322k (9%) | 128k (9%) / 170k (23%) / 328k (8%) | 144k (12%) / 214k (29%) / 352k (18%) | 140k (13%) / 202k (27%) / 331k (17%) |
