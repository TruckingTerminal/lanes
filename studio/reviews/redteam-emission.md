# Red team: the emission cap (2026-11-08)

The studio's red team (studio/roles/redteam.md), for the producer, before the cap goes live in ruleset 0.24.0. Target: the
retuned cap (economy-emission.md "Retune (2026-11-07)", §1–§15; emission.ts, receivables.ts, demand.ts, step.ts, ceiling.ts,
freight.ts) on main at af61e8b, config 0.23.0-phase0.38, the live profile with the cap switched on by override. The subsidy's
size is undecided, so the attacks ran on the structure with the provisional configuration the producer named: R net, the balance
dial one-way, the volume dial held, pacing 14 / 0.03 / 5 opening at 0.5, `subsidy.firstMonthFd` 4,000,000 and `totalFd`
2,000,000,000 (flat 4M a month to within 0.2%). The last section says which findings move with the subsidy. These runs are the
"before": the economy's working tree already carries fixes for 1 (the sale drawn on the budget), 2 and 7; a run on it once it has
committed is the "after".

Method. `apps/sim/src/redteam/emission.ts` (new, mine) builds the gate's world (the sim's full population, 400 owner-operators /
120 fleets / 60 brokers, seeds 1 and 2) and adds one player: a 30-truck van fleet at Chicago, granted the stake, a large yard's
bond, 2.5M of cash (a whale: FD bought is what gets a truck faster, Jeff 2026-11-08) and used trucks the way `populate` grants an
established fleet's, staffed by the engine's auto-staff, on the factoring contract every bot signs, pricing its bids the greedy
bot's way (the margin over break-even follows the day's win rate, 3 points a day in [0.06, 0.9]), driven only through
`applyAction`. The control is that fleet hauling like a bot; each attack is the same fleet with one behaviour changed; the gain
is the attacker's wealth (cash + Reserve + receivables + owned trucks, its brokerage's included) a day against the control's, and
the cost is the world's figures against the control's. 364 days (the season close burns cash above the carryover at the end of
day 364, so the window stops before it), where flat 4M binds, both seeds, plus the control with the cap off. The engine was not
changed; the ledger is read through a tap. Runs under `runs/redteam-emission/` (gitignored); a run takes about 65 s.

**Headline.** No attack takes NPC money out of the capped economy faster than honest hauling does, in year one at flat 4M. The
player brokerage is the only one that gains at all: +0.3–0.5k FD a day on a 30-truck fleet (+0.2–1.0k with the margin bait), while
doubling its gross draw on the budget to 4.2–4.5% of all NPC pay and passing the rest through at 1%. The facility ring loses
5.8–10.3k a day against the control and is sold off mid-year in both seeds, because the market clears at the ceiling (1.2 × ref)
and a sale pays 1.18 × ref; grabbing volume while rates are whole loses margin (seed 1 collapses). What the code reading found
stands as structure, and two of it matter for the gate's reading rather than for an attacker: the rate lever never reaches
brokered or contract pay (brokered pay rose from 81–85% of direct to 84–91% under the cap), and the bots' own facilities put
21M (6.4% of NPC pay, seed 1) outside the budget in year one while the economy's `npc_market` tripwire reads 0 because the
factoring contract advances the sale as `faucet:npc_factor`. The cap itself costs the honest 30-truck fleet 7.5–8k a day (its NPC
income −35% / −42%), the same proportion as everyone's.

## Ranking (by what an attacker gains; the structure in the second column)

| # | Finding | Gain to the attacker (vs control, FD a day, s1 / s2) | Cost to everyone else | Status in 0.24.0 | Fix | Subsidy? |
|---|---|---|---|---|---|---|
| 1 | The player brokerage farms the uncut brokered channel: a 1% advertised margin wins ~64× a bot's tenders; own carrier at the band's top | **+0.5k / +0.3k** (gross draw 4.2% / 4.1% of NPC pay against 2.3% / 2.0%; own tenders 606 / 636) | none measurable; the pair is a conduit (7.0–7.3M paid on to other carriers) | live from day 91 | the rate lever reaches `contractRef` and `contractRate()` (economy's tree); the shippers' choice reads the posted margin | no |
| 1b | …and posts the tenders its trucks can't take at 15% (`post_tender` takes any margin; the shippers chose it on the 1%) | +0.2k / +1.0k (4,927 / 4,498 bait posts; the brokerage's bond erodes 37–91k instead of 117–229k) | the shippers' broker choice is gamed | live from day 91 | `post_tender` capped at the standing order's margin, or the weight reads the posted margin | no |
| 2 | The rate lever never reaches brokered or contract freight (the contract index has no rf) | carried by 1; for a plain carrier it is the market's: brokered pay 84% / 91% of direct under the cap against 81% / 85% off | the rate cut lands on direct spot, the newcomers' board; the budget is drawn at the uncut rate | structural, live | as 1 | no |
| 3 | The facility ring: NPC money for the goods outside the budget, on freight the volume lever never cuts | **−10.3k / −5.8k** (sales 2.70M / 3.11M on 693 / 699 own loads; sold off mid-year) | nil from the attacker; the bots' facilities put 21.4M / 5.9M (6.4% / 1.8% of NPC pay) outside the budget, 0 with the cap off | structural, live from day 28; no gain while the market clears at the ceiling | draw the sale on the budget (economy's tree); scale facility output and the hub-share cap by v (the facilities ruleset); the tripwire reads the draw's kind | yes: the ring pays only once v thins the board under truck capacity |
| 4 | Timing the slow lever: grab volume while rates are whole | **−15.3k / −1.5k** (seed 1 liquidated after 119 grab days) | nil; the cut episodes' overshoot (months at 106–132% of budget) is the carry everyone repays | design window | none cheap; price the overshoot into the subsidy | yes |
| 5 | NPC detention inside the cap | +0 (a cost: 3.4–4.0% of NPC pay under the cap, 2.5–2.9% off; the fleet's own 437–505k a year) | nil | live | none (a dock cost, not a hole) | no |
| 6 | A parking cartel lifting the hub's ratio | ≤ +18% rate on half the fleet for half the volume: a loss | nil | no gain | none | no |
| 7 | Sinking to grow next month's budget | refill × the sinker's share of NPC pay, over three months: a loss | nil | no gain | none | no |
| 8 | The launch reset's return to the reserve | nil (a burn to the metrics, out of R's base) | the emission carry crosses the launch unchanged | closed; one wart | reset `carryFd` at launch (economy's tree) | no |
| 9 | Crime: the reserve's fence pays for stolen goods outside the budget | ~1.1× a brokered van load's freight bill per theft, when robbery is on | reserve FD outside every cap | latent (robbery off in live) | the fence's pay draws on the budget when the Back Lot opens (recorded for that ruleset) | no |
| 10 | Commitment without delivery, cancellation, re-posting, shipper defaults, quick pay | nil | quick pay over-counts the draw by `quickPayPct` of quick-paid freight | closed | none | no |

## 0. The control: what the cap does to an honest 30-truck fleet

| control, 364 days | s1 cap off | s1 cap on | s2 cap off | s2 cap on |
|---|---|---|---|---|
| attacker wealth a day | +6.9k | −0.66k | +3.9k | −4.0k |
| operating result (revenue − cost) | +4.98M | +2.61M | +3.88M | +1.07M |
| NPC freight paid to it (share of all NPC pay) | 11.78M (2.52%) | 7.60M (2.27%) | 11.29M (2.56%) | 6.51M (2.05%) |
| via brokers | 0.91M | 2.16M | 0.47M | 1.14M |
| bid margin over break-even at the end | 0.90 | 0.90 | 0.63 | 0.90 |
| world: NPC pay committed | 485M (146% of a 332M budget) | 341M (94% of 362M) | 452M (136%) | 323M (93% of 349M) |
| days at the volume / rate floor | – | 270 / 222 | – | 218 / 145 |
| cleared loads · liquidations · in debt | 123k · 80 · 54 | 110k · 99 · 95 | 124k · 67 · 60 | 112k · 75 · 73 |
| population dial retired / wound down | 6 / 10 | 47 / 90 | 0 / 0 | 25 / 77 |
| bot median cash, OO greedy / conservative | 104k / 121k | 32k / 99k | 79k / 105k | 22k / 80k |
| bot median cash, fleet greedy / conservative | 236k / 248k | 109k / 204k | 164k / 196k | 107k / 173k |
| brokered / direct pay, FD a mile | 3.79 / 4.67 (81%) | 3.39 / 4.02 (84%) | 3.75 / 4.42 (85%) | 3.40 / 3.74 (91%) |
| facility sales (shipper-tagged) · facilities owned | 0 · 0 | 21.4M (6.4%) · 9 | 0 · 0 | 5.9M (1.8%) · 5 |
| detention, share of NPC pay | 2.5% | 3.4% | 2.9% | 4.0% |
| FD held by companies at day 364 | 99M | 51M | 81M | 43M |

The cap takes 28% of NPC pay out of year one and the honest fleet loses the same share as everyone (its share of NPC pay moves
2.5% → 2.1–2.3%); the bots' greedy personas lose most (medians −66% to −72%), the conservative least (−18% to −24%), and the
dial winds down 77–90 bot carriers. The fleet's bid margin sits at its 0.9 cap most of the year in both worlds: the board carries
more freight than trucks even at the volume floor, so a truck gets the ceiling for most loads. That one fact decides findings 3
and 4 below.

## 1. The player brokerage (HOLE, small; the measured face of finding 2)

Shippers pick a broker by `(0.25 + credit ÷ 100) ÷ margin²` (freight.ts:462): a brokerage whose standing order says 1% draws
~64× the tenders of a bot at 8%. `brokerage.enabled` is in LIVE_LEVERS (live.ts:206, row 29; the test page and the live page
both run `withLiveLevers`, apps/web/src/game.ts GAME_CONFIG), the ladder opens it on day 91, so the pair is in 0.24.0. The run:
the fleet forms its brokerage on day 91 with 1.3M of capital, posts 1M of bond on top of the licence stake (the AP cap reads the
bond), advertises 1% with 200 open loads, holds every tender off the board (brokerage.ts startHold) and, every hour, tenders to
its own carrier at the band's top (`ownBand`, ≤ the uncut ceiling) wherever an idle own truck stands at the origin.

| brokerage pair, 364 days | s1 honest | s1 bait 15% | s2 honest | s2 bait 15% | control s1 / s2 |
|---|---|---|---|---|---|
| pair wealth a day | −0.17k | −0.43k | −3.7k | −3.0k | −0.66k / −4.0k |
| gain against the control | **+0.5k** | +0.2k | **+0.3k** | +1.0k | – |
| NPC pay to the pair, gross (share of all) | 14.11M (4.21%) | 14.91M (4.46%) | 13.08M (4.12%) | 13.69M (4.33%) | 7.60M (2.27%) / 6.51M (2.05%) |
| paid on to other carriers (direct + the factor's advances repaid) | 2.15M + 4.84M | 2.29M + 5.46M | 1.99M + 5.28M | 1.99M + 5.34M | 0 |
| own tenders taken · bait posts | 606 · 0 | 695 · 4,927 | 636 · 0 | 716 · 4,498 | – |
| brokerage cash · bond at the end (1M posted) | 0 · 771k | 1k · 963k | 7k · 883k | 80k · 909k | – |
| world committed ÷ budget · liquidations | 95% · 100 | 95% · 104 | 93% · 82 | 93% · 78 | 94% · 99 / 93% · 75 |

What it says. The pair doubles its gross draw on the budget and keeps almost none of it: the brokerage is a conduit at 1%, its
own cash ends at zero and its bond pays its paper (−117k to −229k), while the carrier side gains the 606–636 loads tendered at
the band's top instead of bid for. Net +0.3–0.5k a day, +0.2–1.0k with the bait. The hole is real in mechanism and small in year
one FD because brokered freight pays less per mile than direct in this world whatever the cap does (81–85% off, 84–91% on): the
lever's blindness lifts the channel 3–6 points relative to direct spot, not the 20 points the floor would give if the index were
otherwise equal. The bait (1b) works as a mechanism (4,500–4,900 posts at 15% against an advertised 1%) and protects the
brokerage's bond, but a load posted at a 15% margin clears less often, so the gain is +0.2 to +1.0k a day. The world does not
notice either: committed ÷ budget, floor days, cleared loads and liquidations stay inside the control's noise.

Fix. The economy's tree already has the cap's multiplier reaching `contractRef` (freight.ts:372) and `contractRate()`
(contracts.ts:62); the "after" run measures it. For 1b, a brokerage rule, not the cap's: `post_tender` posts at the standing
order's margin or below, or the shippers' weight reads the margin actually posted last.

## 2. The rate lever never reaches brokered or contract freight (structural)

The reference rate carries `rf = reserveFactor × rateMult × emissionMult` (freight.ts:219): the cap's rate lever, the balance
dial and the reserve factor act there. The contract index does not: `spot = dpow(ratio) × weather × season` (freight.ts:199–203),
no rf. NPC brokers' tenders are priced `baseRate × contractIndex × premium × reload + fsc + tolls…` (freight.ts:372) and direct
contracts by `contractRate()` the same way (contracts.ts:62). So with the lever at 0.8 a direct spot load's ceiling drops 20% and
a brokered load's does not, except through the ratio the volume lever moves. Measured: under the cap direct pay fell 14–15% a
mile (4.67 → 4.02, 4.42 → 3.74) and brokered 9–11% (3.79 → 3.39, 3.75 → 3.40); the brokered share of NPC pay committed rose from
8.0–8.5% to 9.2–16.5% (`emission.pay`). The whole rate cut lands on direct spot freight, the newcomer's board; under a binding
cap this is a transfer from the smallest carriers to the channel the established ones work, on top of the volume cut they share.
The economy's four-year runs show the drift compounding (brokered share 37% / 46% under the cap against 34% / 41%, §15).

## 3. The facility ring (structural; no gain to a player today)

What the code does. A facility's load is paid by the NPC market: `trips.ts collectUpstream` bills `faucet:npc_market` for
`load.saleValue` = `ref × saleValueOfRef (1.18 warehouse, 1.20 cold storage and factory) × miles` (freight.ts:409), and `bill()`
draws on the budget only for `faucet:npc_shipper` (receivables.ts:354), so the sale is outside the cap by design (§2 of the
retune says so and gives the four-year check's 5% tripwire). `planFreight` scales `npcExpected` by v but leaves
`facilityExpected` whole, and the 60% hub-share cap is read off the hub's demand BEFORE the lever (demand.ts:149–152): at the
volume floor a hub with full facilities posts NPC spot freight equal to 20% of its demand against the facilities' 60%. "A company
hauling its own freight pays itself nothing" (trips.ts:484, 517), so a self-hauler keeps the whole sale.

The run. Six warehouses at Chicago from day 28 (270k + sales tax), own loads booked onto own idle trucks at the hub every hour;
in the second variant an idle truck comes straight home (`reposition {hubId}`).

| facility ring, 364 days | s1 ring | s1 homing | s2 ring | s2 homing | control s1 / s2 |
|---|---|---|---|---|---|
| wealth a day | **−11.0k** | −11.6k | **−9.8k** | −10.5k | −0.66k / −4.0k |
| operating result | +19k | −992k | −1.03M | −1.49M | +2.61M / +1.07M |
| sales from the NPC market (own loads hauled) | 2.70M (693) | 3.30M (935) | 3.11M (699) | 2.70M (792) | 0 |
| NPC freight pay to the fleet | 4.30M | 3.61M | 2.87M | 2.23M | 7.60M / 6.51M |
| paid to other carriers for its freight (direct + the factor repaid) | 1.70M + 0.71M | 2.00M + 0.68M | 1.82M + 0.59M | 1.15M + 0.44M | 0 |
| upkeep | 444k | 456k | 372k | 336k | 0 |
| trucks left of 30 | 1 | 1 | 1 | 1 | 28 / 28 |

Why it loses. The market clears at the ceiling (1.2 × ref) because loads outnumber trucks even at the volume floor; a sale pays
1.18 × ref. So every own load hauled earns 2% less than the spot load the truck gave up, with the deadhead home on top; every
facility load another carrier hauls costs the owner the cleared rate plus the board fee against a 1.18 × ref sale; and the upkeep
is 12k a week. The ring's cash ran out and its fleet was sold down to one truck in both seeds, as the bots' facilities lose money
in every run of the economy's (owners' net −6.5k to −27k a facility-week). The ring would pay only in a truck-rich market, where
loads clear well under the ceiling: that is the market the volume lever is meant to make and has not made in year one.

What matters anyway. (a) The leak is real at the world's scale: the bots buy facilities only when the cap bites (0 with it off,
9 / 5 in year one with it on) and their sales put 21.4M / 5.9M of NPC money (6.4% / 1.8% of NPC pay) into the world outside the
budget. (b) The tripwire cannot see it: under the factoring contract the NPC factor advances a facility's sale on delivery and
`bill()` posts that advance from `faucet:npc_factor` (receivables.ts:382), the same tag as freight pay; `faucet:npc_market` shows
only for a payee on net terms. So factored sales sit in the cap's cash column (`ledger.npcPaidFd`), inside `FREIGHT_FAUCETS`
(never subtracted from R's base) and outside the economy's `npc_market` share, whose "0% in every year" (§13–§15) is partly the
tag; the 5% line is crossed in seed 1's first year. The measurement here tells a sale by its load's shipper. (c) Scaling by v
belongs with the facilities ruleset, as the producer routed it.

## 4. Timing the slow lever (no gain to the grabber)

The lever product moves at most 0.03 a day, so a cut from 1.0 to the 0.4 floor takes 20 days, during which the board still
carries loads priced before the cut and the budget overshoots. In the control runs at flat 4M the months where the lever fell
commit 106–132% of budget (s1 months 1–2 and 7–10, s2 months 1 and 5–8); on the economy's four-year runs 24 / 25 of 49 months are
over budget, 34.2M / 38.7M in all, and the days on which the product was falling carry 42% / 29% of all commitments. The window
is shared by capacity share. The run: the fleet bid and booked near break-even (+5% / +3%) while `rateMult ≥ 0.99` (119 / 165
days) and at its adaptive margin otherwise. Result: **−15.3k / −1.5k a day** against the control; seed 1 was liquidated. Grabbing
volume forfeits the ceiling the patient bidder gets, so a reader of the lever has nothing to take beyond its capacity share, and
the overshoot is the carry everyone repays. No cheap fix: a faster step is the hunting the economy measured and rejected (§4b).
Price the overshoot into the subsidy's size rather than into the levers.

## 5. NPC detention (a cost, not a hole)

`detention.enabled` is true in live.ts (60 FD an hour after 2 free hours, to 8 hours), drawn on the budget since the retune. The
world's detention is 3.4–4.0% of NPC pay under the cap (2.5–2.9% off: the flat 60 FD an hour grows as a share when freight pays
less); the honest fleet's own 437–505k a year, 4–7% of its NPC income. A player waiting at closed docks on purpose gets at most
480 FD a load for the driver's hours. The producer's criterion (a few percent) holds; dropped from the holes.

## 6. A parking cartel (no gain)

`freight.ts:155–176`: the ratio at a hub is open loads over `6 × hub weight × equipment share` base trucks plus the idle trucks
within 150 miles, clamped to [0.5, 2.5] and raised to 0.35. Chicago (weight 3.0, vans 0.5 share) has a base of ~9 vans plus the
idle ones nearby; a 30-truck fleet withholding 15 could lift its van ratio by half at most, which is +15–18% on the rate of the
15 trucks still hauling, for half the volume: a loss. Under the cap the extra rate is drawn from the same budget, so the
controller cuts volume for everyone, and the dial retires bots, never players. Not run.

## 7. Sinking to grow next month's budget (no private gain)

Under R every FD sunk raises the next three months' budgets by `refill ÷ 3` each, for everyone; the sinker gets back its share
of NPC pay. A 2% player sinks 100 and gets 2 back over three months. Refundable sinks net out under `refillNet` (the lease
deposit, a loan's principal, a truck bought and scrapped: the sink and its refund are on opposite sides of the base). The NPC
advance-and-repayment wash nets the same way since the §14 retag.

## 8. The launch reset (closed; one wart)

`sink:launch_reset` is not in `CIRCULAR_BURNS`, so the ledger credits it to the reserve (the 40–68M the economy's envelope
note mentions), but `metrics.ts closeDay` puts it in `burnByTag`, not `sinkFd`, so R's base never sees it: no post-launch
budget spike (em2-y4s-f4 seed 1, months 24–27: budgets 22.6, 22.4, 26.2, 27.4M against a 51.6M reset). The launch mints
(airdrop, auction, launch liquidity) are `MINT_TAGS`, out of `faucetFd`, so they do not shrink the base either. The wart: the
emission carry crosses the launch unchanged (em2-y4c-rnetd seed 2: −23M at day 730), so a beta overspend is repaid by cutting
post-launch freight that pays in real FD, or beta slack is spent as real FD. Fix (routed to the economy): zero
`w.emission.carryFd` in `launchToken`.

## 9. Crime (latent: robbery off in live)

`robbery.enabled` is false and `fraud.theft.byCarrier` false in live.ts, so nothing here is reachable in 0.24.0. When the Back
Lot opens under the cap: the reserve's fence pays a crew's hirer `npcFenceShare (0.6 live) × fenceShare (0.1–0.4 by commodity) ×
cargoValue` from `faucet:fence`, and `cargoValue` is the freight bill × 6 (van) / 7 (reefer) / 4 (flatbed) for a brokered load
(fraud.cargoMultiple), so a stolen brokered van load pays ~1.1× its freight bill in reserve FD that no budget sees;
`faucet:insurance_pd` pays the rig's claim the same way. The cap would be a cap on honest freight only. Recorded for the Back
Lot's ruleset: the NPC fence's and insurer's payouts draw on the budget (or a budget of their own).

## 10. Closed

- *Commitment without delivery*: the draw is at the invoice (`bill`, payer 0, `faucet:npc_shipper`); a spoiled load pays and
  draws nothing; a late hot load draws `factor` of it; a defaulting NPC shipper draws nothing (the broker pays its carrier from
  its own cash).
- *Cancellation*: `cancel_bid` works before clearing only; nothing drawn.
- *Re-posting*: a double-brokered load's upstream is drawn once at delivery; the re-post is a transfer between companies.
- *Quick pay*: the budget is drawn the full face while the NPC pays face less `quickPayPct` and "never mints the fee"
  (receivables.ts:399–404): an over-count of the fee's size, against the attacker.
- *NPC advances on companies' paper*: tagged apart (`NPC_ADVANCE`), out of the cash column, nets in the base.

## Which findings depend on the subsidy's size

Structure, not size: 1 and 2 (the contract index), 1b, 8 (the carry), 9 (the fence), 10. Size-dependent: 3 pays a player only
once the volume lever thins the board under truck capacity, which flat 4M did not do in year one (the fleet's bids sat at their
0.9 margin cap most of the year) and a tighter subsidy at the floors for years might; its world-scale leak (6.4% of NPC pay in
seed 1) grows with the floors (the ring's freight is uncut, so its relative value is 1 ÷ (v × ρ) = 3.1× at both floors). 4 exists
only while the lever hunts (flat 4M: 24–25 of 49 months over budget on the economy's runs; the 60M subsidy: the levers at the
floors from month 8, nothing to time but a permanent 6–12% overshoot). 5 is a share of a budget whatever its size. A proportional
subsidy (`refill` 1.15) hunts least and gives 4 the least; flat 4M binds in year one and hunts in years 2–4.

## Open

- The "after" run on the economy's tree once it has committed the fixes for 1, 2, 8 (the same fourteen, or the pair and the
  control alone), with a slot asked for then.
- The ring under a truck-rich market: run the same scenario at the 60M subsidy's floors (years 2–3) or with a smaller volume
  floor, where loads clear under 1.18 × ref; not run here.
- `runs/redteam-emission-v1/` is the first pass with an under-specified attacker (static +30% bids, the season close inside the
  window); its operating results pointed the same way and it is kept for the record only.

## Exact commands

```
# one run a scenario and seed, 364 days, full population, the cap on with flat 4M (~65 s each; never beside a vitest run)
npx tsx apps/sim/src/redteam/emission.ts --scenario control --seeds 1,2
npx tsx apps/sim/src/redteam/emission.ts --scenario facility,facilityhome,timing,brokerage --seeds 1,2
npx tsx apps/sim/src/redteam/emission.ts --scenario brokerage --seeds 1,2 --postMargin 0.15
npx tsx apps/sim/src/redteam/emission.ts --scenario control --seeds 1,2 --cap off
npx tsx apps/sim/src/redteam/emission.ts --compare --seeds 1,2
```

## Files

Mine, to stage: `apps/sim/src/redteam/emission.ts` (new), `apps/sim/src/redteam/exploits.ts` (line 112: the factor's advances
now add `faucet:npc_advance`), `apps/sim/src/redteam/three.ts` (lines 112 and 143, the same), `studio/reviews/redteam-emission.md`.
Nothing in `packages/`; the fixes above are proposals, routed by the producer to the economy (1, 2, 3's budget draw and tripwire,
8) and to the rulesets that open facilities (3's scaling by v) and the Back Lot (9).
