# Red team: the emission cap (2026-11-08)

The studio's red team (studio/roles/redteam.md), for the producer, before the cap goes live in ruleset 0.24.0. Target: the
retuned cap (economy-emission.md "Retune (2026-11-07)", §1–§15; emission.ts, receivables.ts, demand.ts, step.ts, ceiling.ts,
freight.ts) on main at af61e8b, config 0.23.0-phase0.38, the live profile with the cap switched on by override. The subsidy's
size is undecided, so the attacks ran on the structure with the provisional configuration the producer named: R net, the balance
dial one-way, the volume dial held, pacing 14 / 0.03 / 5 opening at 0.5, `subsidy.firstMonthFd` 4,000,000 and `totalFd`
2,000,000,000 (flat 4M a month to within 0.2%). The last section says which findings move with the subsidy.

**Which engine the runs measured.** The code was read on main at af61e8b (the contract index without rf, the market's sale
outside the budget, the carry crossing the launch), but the fourteen runs below ran at 03:32–03:48 on the shared checkout's
working tree, which by then already carried the economy's fixes for those three (the multiplier on brokered and contract pay,
the market's purchase drawn on the budget, the carry zeroed at launch), committed since as 6312f60; their `emission.pay`
carries the `market` kind that exists only with the fix. So every measured figure in §0–§4 is the fixed engine's, the "after";
the old engine's "before" was run afterwards in a worktree at 51bd524 and sits in the addendum at the end. The code-reading
findings describe the old engine and are unchanged.

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

**Headline.** On the fixed engine no attack takes NPC money out of the capped economy faster than honest hauling does, in year
one at flat 4M. The player brokerage is the only one that gains at all: +0.3–0.5k FD a day on a 30-truck fleet (+0.2–1.0k with
the margin bait), while doubling its gross draw on the budget to 4.2–4.5% of all NPC pay and passing the rest through at 1%. On
the old engine the same pair gained **+3.8k / +4.1k a day, about 1.5M FD a year** (the addendum): the one hole that paid, and
6312f60 closes it. The facility ring loses
5.8–10.3k a day against the control and is sold off mid-year in both seeds, because the market clears at the ceiling (1.2 × ref)
and a sale pays 1.18 × ref; grabbing volume while rates are whole loses margin (seed 1 collapses). What the code reading found
stands as structure, and two of it matter for the gate's reading rather than for an attacker: on the old engine the rate lever
never reached brokered or contract pay (fixed in 6312f60; even with the fix brokered pay keeps 84–91% of direct's under the cap
against 81–85% off, the residual lift coming through the ratio), and the bots' own facilities sell 21M of goods (6.4% of NPC pay,
seed 1) in year one, outside the budget on the old engine and drawn on it since the fix, while the economy's `npc_market`
tripwire reads 0 because the factoring contract advances the sale as `faucet:npc_factor`. The cap itself costs the honest 30-truck
fleet 7.5–8k a day (its NPC income −35% / −42%), the same proportion as everyone's. The addendum puts the old engine beside the
fixed one for the pair and the control.

## Ranking (by what an attacker gains; the structure in the second column)

| # | Finding | Gain to the attacker (vs control, FD a day, s1 / s2) | Cost to everyone else | Status in 0.24.0 | Fix | Subsidy? |
|---|---|---|---|---|---|---|
| 1 | The player brokerage farms the uncut brokered channel: a 1% advertised margin wins ~64× a bot's tenders; own carrier at the band's top | **old engine +3.8k / +4.1k** (≈1.5M a year; addendum); fixed engine +0.5k / +0.3k (gross draw 4.2% / 4.1% of NPC pay against 2.3% / 2.0%; own tenders 606 / 636) | none measurable; the pair is a conduit (7.0–7.3M paid on to other carriers) | live from day 91; the lever's reach fixed in 6312f60 | the rate lever reaches `contractRef` and `contractRate()` (done, 6312f60); the shippers' choice reads the posted margin (1b) | no |
| 1b | …and posts the tenders its trucks can't take at 15% (`post_tender` takes any margin; the shippers chose it on the 1%) | +0.2k / +1.0k (4,927 / 4,498 bait posts; the brokerage's bond erodes 37–91k instead of 117–229k) | the shippers' broker choice is gamed | live from day 91 | `post_tender` capped at the standing order's margin, or the weight reads the posted margin | no |
| 2 | The rate lever never reaches brokered or contract freight (the contract index has no rf; old engine) | carried by 1; for a plain carrier it is the market's: brokered pay 84% / 91% of direct under the cap against 81% / 85% off on the fixed engine (the old engine: addendum) | the rate cut lands on direct spot, the newcomers' board; the budget is drawn at the uncut rate | fixed in 6312f60 | as 1 | no |
| 3 | The facility ring: NPC money for the goods outside the budget, on freight the volume lever never cuts | **−10.3k / −5.8k** (sales 2.70M / 3.11M on 693 / 699 own loads; sold off mid-year) | nil from the attacker; the bots' facilities sell 21.4M / 5.9M of goods (6.4% / 1.8% of NPC pay) with the cap on, 0 off: outside the budget on the old engine, drawn on it since 6312f60 | the budget draw fixed in 6312f60; live from day 28; no gain while the market clears at the ceiling | draw the sale on the budget (economy's tree); scale facility output and the hub-share cap by v (the facilities ruleset); the tripwire reads the draw's kind | yes: the ring pays only once v thins the board under truck capacity |
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

(The fixed engine; the market's purchases, 21.5M / 6.2M, are inside "NPC pay committed" here.) The cap takes 28% of NPC pay out
of year one and the honest fleet loses the same share as everyone (its share of NPC pay moves
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
a brokered load's does not, except through the ratio the volume lever moves. Measured on the fixed engine (the multiplier
already on contract pay): under the cap direct pay fell 14–15% a mile (4.67 → 4.02, 4.42 → 3.74) and brokered 9–11% (3.79 →
3.39, 3.75 → 3.40); the brokered share of NPC pay committed rose from 8.0–8.5% to 9.2–16.5% (`emission.pay`); the old engine's
figures are in the addendum. On the old engine the whole rate cut lands on direct spot freight, the newcomer's board; under a binding
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
9 / 5 in year one with it on) and their sales put 21.4M / 5.9M of NPC money (6.4% / 1.8% of NPC pay) into the world: outside the
budget on the old engine, drawn on it as the `market` kind since 6312f60 (21.5M of the 341M committed in the fixed run). (b) The
tripwire cannot see it: under the factoring contract the NPC factor advances a facility's sale on delivery and
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

## Addendum (2026-11-08, after 6312f60): the old engine beside the fixed one

The pair and the control, seeds 1–2, 364 days, the same levers: the old engine in a worktree at 51bd524 (the engine of af61e8b:
the contract index without the multiplier, the market's sale outside the budget) and the fixed engine on main at 6312f60 (which
reproduces the fourteen runs above to the FD). `runs/redteam-emission-before/` and `runs/redteam-emission-after/`.

| 364 days, cap on, flat 4M | old s1 control | old s1 pair | fixed s1 control | fixed s1 pair | old s2 control | old s2 pair | fixed s2 control | fixed s2 pair |
|---|---|---|---|---|---|---|---|---|
| attacker wealth a day | −0.83k | **+3.0k** | −0.66k | −0.17k | −4.0k | **+0.15k** | −4.0k | −3.7k |
| the pair's gain over the control | – | **+3.8k** | – | +0.5k | – | **+4.1k** | – | +0.3k |
| operating result | 2.44M | 2.99M | 2.61M | 2.11M | 1.03M | 1.78M | 1.07M | 0.42M |
| NPC pay to the pair, gross (share of all) | 7.32M (2.07%) | 15.01M (4.17%) | 7.60M (2.27%) | 14.11M (4.21%) | 6.00M (1.87%) | 14.09M (4.40%) | 6.51M (2.05%) | 13.08M (4.12%) |
| own tenders · brokerage cash · bond (1.3M capital, 1M posted) | – | 517 · 374k · 1.07M | – | 606 · 0 · 771k | – | 647 · 516k · 1.07M | – | 636 · 7k · 883k |
| brokered / direct pay, FD a mile | 3.76 / 4.05 (93%) | 3.80 / 4.08 (93%) | 3.39 / 4.02 (84%) | 3.41 / 4.03 (85%) | 3.62 / 3.69 (98%) | 3.63 / 3.69 (98%) | 3.40 / 3.74 (91%) | 3.39 / 3.77 (90%) |
| brokered share of NPC pay committed · loads | 16.8% · 18.6k | 18.1% · 20.0k | 8.6% · 10.9k | 11.3% · 14.1k | 25.4% · 26.8k | 28.4% · 29.5k | 16.2% · 18.8k | 17.1% · 19.9k |
| market purchases: drawn on the budget | no (18.6M beside it) | no (20.8M) | 21.5M (6.3% of committed) | 19.6M | no (4.3M) | no (6.9M) | 6.2M (1.9%) | 7.3M |
| world: NPC pay · committed ÷ budget · carry | 354M · 93% · +25.8M | 360M · 93% · +27.5M | 336M · 94% · +20.6M | 335M · 95% · +19.6M | 320M · 93% · +23.8M | 320M · 92% · +26.4M | 318M · 93% · +26.0M | 317M · 93% · +25.6M |
| days at the volume / rate floor | 219 / 119 | 215 / 118 | 270 / 222 | 280 / 225 | 237 / 169 | 230 / 154 | 218 / 145 | 214 / 145 |
| liquidations · in debt at the end | 105 · 68 | 94 · 60 | 99 · 95 | 100 · 88 | 76 · 51 | 91 · 62 | 75 · 73 | 82 · 83 |
| bot median cash, OO greedy / conservative · fleet greedy / conservative | 46k / 103k · 129k / 211k | 44k / 102k · 148k / 200k | 32k / 99k · 109k / 204k | 35k / 93k · 110k / 185k | 24k / 77k · 89k / 160k | 27k / 79k · 83k / 171k | 22k / 80k · 107k / 173k | 24k / 82k · 105k / 186k |

- **The hole on the old engine was material and the fix closes it.** With the contract index out of the lever's reach the cap
  lifted brokered freight from 81–85% of direct's pay (cap off, §0) to 93% / 98%, and its share of NPC pay from 8.0–8.5% to
  16.8% / 25.4%; a pair with a 1% advertised margin and a 1M bond turned a year that costs the honest fleet 0.8k / 4.0k a day
  into +3.0k / +0.15k, a gain of **+3.8k / +4.1k a day, about 1.5M FD a year**, its brokerage ending with 374k / 516k of cash and
  its bond whole. With the multiplier on brokered and contract pay (6312f60) the lift falls to 84% / 91% and 8.6% / 16.2%, the
  pair's gain to +0.5k / +0.3k a day, and the brokerage loses 0.4–0.5M of its capital carrying freight at 1%. Finding 1 (and 2)
  closed to the extent the runs can see; 1b (the posted margin) is untouched by this fix.
- **The market's purchases are inside the budget now**: 21.5M / 6.2M of the control's 341M / 323M committed carry the `market`
  kind; on the old engine the same 18.6M / 4.3M paid beside it. Finding 3's budget half closed; the tripwire's reading is the
  economy's (the draw's kind), and the scaling by v stays with the facilities ruleset.
- **A side effect for the economy's sizing.** The same budget now covers the market's purchases too, so freight is cut harder
  in year one: NPC pay 354M → 336M in seed 1, days at the rate floor 119 → 222 (169 → 145 in seed 2), companies in debt at the
  end 68 → 95 and 51 → 73, the greedy bots' medians −20 to −30% (46k → 32k, 129k → 109k in seed 1); liquidations within noise.
  The honest fleet itself is unmoved (−0.83k → −0.66k, −4.0k → −4.0k). At flat 4M the market's draw is 2–6% of the budget; where
  bots buy facilities most (seed 1) it is the difference between a cap that releases in months 5–7 and one that does not.
- **The carry's reset at launch** cannot be seen in a 364-day run (the launch is day 730); the code does it (`launchToken`,
  `w.emission.carryFd = 0`).

Files for this addendum: `studio/reviews/redteam-emission.md` alone (`apps/sim/src/redteam/emission.ts` is as committed in
51bd524). The worktree was removed after the runs.
