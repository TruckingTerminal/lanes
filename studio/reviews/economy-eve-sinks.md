# Economy: three ideas from EVE Online's economy, sized for LANES (2026-11-12)

Jeff's three, from the producer's brief: a transaction burn on every cleared load and every player-to-player sale; a
public monthly economic report on the Intel tab; shipper loyalty points redeemed with FD for perks. The burn is sized on
a ten-seed pair (a prototype the runner applies, never to be merged); the report and the points from the code at main
and the earlier ten-seed runs. No engine edit; nothing staged.

## Verdict, for Jeff

Build all three, in this order. **First the monthly report**: it is not a rule, it costs no economy, and it is what makes
any sink visible to players, as EVE's is. **Second the transaction burn at 1%**, paid by the seller of every cleared load
and every sale between companies, outside the cap's refill: on the ten seeds it destroys about 3.3M FD a year (270k a
month, about 1% of the NPC freight pay and thirteen times the early-delivery fee), leaves FD in circulation 3% under the
off arm at year 4, costs carriers about 3% of their profit per truck-week, and moves no bankruptcy, liquidation, cleared
load or rate beyond the seed spread; the published supply curve stays the emission schedule, with circulation under it
by what trade burns. One gate change goes with it: the band should count the burn as the sink it is (it reads today only
operating sinks, so a burn that makes carriers spend a little less elsewhere reads as the band dropping a point, and
four seeds of ten fall a few thousandths under 0.84). 2% is the most I would set: it doubles the burn and the supply
effect and begins to show in loan defaults (+18%). **Third the loyalty points**, as a cosmetic store gated by on-time
service: a fair way for players to spend FD, not a sink of the burn's kind.

## 1. A transaction burn

**How it works.** On every cleared load the carrier burns a share of the load's gross pay at settlement, as the lessor's
share is taken today; on every sale between two companies (a listing, a dealership's sale, a trade-in, a business or
facility sold on the asset market, a player lease's weekly rent) the seller burns the same share of the price. It posts
to its own burn tag (`sink:trade_burn`, in `BURN_TAGS` and the ledger's `CIRCULAR_BURNS`), so it is destroyed, sits
outside the cap's refill and outside the band's operating ratio, and appears on every settlement line and every sale
sheet as its own figure ("Market burn 1%: 31 FD"), with the rate in the ruleset (`token.tradeBurn.share`).

**Which side pays.** The seller: on a load the carrier (the one who sells the haul), on a sale the seller. It has to
be a company: an NPC shipper "paying" a burn would be FD emitted and burned in one breath, nothing removed.

**On top, not replacing.** The board fee (3% of what a poster bills, paid by brokers and player shippers) and the
market fee (5% of a listing) are operating sinks that refill the NPC budget: money that comes back to carriers next
month. Turning part of them into the burn would move the brokers' and the facility owners' economics, which this pair
does not size; the burn sits beside them. On listings it is small either way (0.4M of the 13M at 1%), so a later
ruleset can move one point of the 5% market fee into it at no cost to sellers if Jeff prefers.

**The pair.** A prototype (the runner posts the burn; never to be merged): the burn at 0, 1% and 2% on the carrier of
every delivered load and the seller of every listing sold between companies, 0.24.1's nine rules on in every arm, the
gate's ten seeds at 1460 days, each against its cap-off twin, in a scratch worktree at 9b3bc62 (figure-identical to main
with windows off).

| Ten-seed means | No burn | 1% | 2% |
|---|---|---|---|
| FD burned, four years · on loads · on listings | — | 13.1M · 12.7 · 0.4 | 26.1M · 25.3 · 0.8 |
| … by year, M | — | 3.8 · 3.3 · 3.2 · 2.8 | 7.5 · 6.6 · 6.4 · 5.7 |
| FD in circulation at the end of years 1–4, M | 31.1 · 66.9 · 85.8 · 117.7 | 30.6 · 66.5 · 84.1 · **113.9 (−3%)** | 29.7 · 66.1 · 82.0 · **109.1 (−7%)** |
| The reserve's net emission (the published schedule), M | 188.9 | 191.6 | 192.5 |
| The cap's paid freight · budget · days at the volume floor | 1,395 · 1,424 · 223 | 1,383 · 1,415 · 223 | 1,377 · 1,410 · 217 |
| Operating sinks, four years, M | 1,528 | 1,511 | 1,494 |
| Cleared · mean rate | 448,291 · 3.76 | 444,849 · 3.75 | 443,496 · 3.75 |
| OO · fleet profit per truck-week | 2,134 · 2,032 | 2,066 (−3%) · 1,962 (−3%) | 2,078 (−3%) · 1,947 (−4%) |
| Companies bankrupt · OO liquidated | 179 · 0.190 | 171 · 0.186 | 180 · 0.194 |
| Owned trucks at the end · loan defaults | 584 · 201 | 560 · 218 | 559 · 236 |
| Free path: first truck, median day · within 84 days | 46 · 343 | 48 · 345 | 49 · 340 |
| **Gate** | **9 of 10** (seed 7 at 0.838) | **6 of 10** (band 0.832–0.840 on four) | **7 of 10** (band 0.838–0.841 on three) |

- **The supply removed is less than the FD burned.** 13.1M burned takes 3.8M off circulation at year 4: the carriers,
  1% poorer, buy fewer trucks (owned 584 → 560) and so pay 17M less into the operating sinks, which in the circular
  ledger return to the reserve; that money stays in circulation instead. The burn removes what it removes; it also
  replaces some of what the economy would have spent. At 2%, 26M burned takes 8.6M off.
- **The rate, cleared loads, bankruptcies and liquidations do not move**; profit per truck-week falls by about the
  burn's share of gross over the profit margin (1% of gross is about 3% of profit); loan defaults rise a little with
  thinner cash (+9% at 1%, +18% at 2%).
- **The gate falls a few thousandths, for a definitional reason.** The band reads operating sinks over faucets; a burn is
  counted as a burn, not an operating sink, so when the carriers spend 17M less on operating sinks the band reads the
  economy keeping more, though it keeps less. Adding the trade burn to the band's sinks (and only there, never to the
  refill) restores it: 1,511 + 13.1 against 1,528. The burn is an operating sink in every sense but the refill's, and
  the gate should read it as one.
- **Never hidden:** the burn shows on every settlement line ("Market burn 1%: 31 FD" under the lessor's share), every sale
  sheet, Iuliia's break-even (it is a cost per mile like fuel), and the monthly report.

**The cap's refill and the published curve.** The cap pays NPC freight from a budget refilled by the trailing operating
sinks net of the other faucets, plus the flat 5M subsidy. A burn is not an operating sink, so it does not refill the
budget: the NPC pays what it would have paid, and the burn then destroys a share of it. The published curve stays what
it is, the reserve's emission schedule (the opening month plus the subsidy); FD in circulation sits under it by the
cumulative burn. That is the honest form, and the report (§2) is where the two lines stand side by side: "emitted by
the schedule" and "burned by trade", the gap growing month by month. The alternative, feeding the burn back into the
subsidy so circulation tracks the curve, would make it no sink at all.

## 2. A public monthly economic report

Not a rule: a frozen page per game month on the Intel tab (beside today's rolling Economy panel), the month against the
one before and the same month a year ago, built from what the engine keeps. EVE's lesson is that the report is believed
because it is complete and dull: every faucet, every sink, every month.

| Section | Figures | From | New tally? |
|---|---|---|---|
| Money | FD in circulation; all FD there is; the reserve; burned this month and since genesis; the emission schedule against the actual | `valuation`, `ledger.reserve/burned`, `emission.months` | no |
| In and out | every faucet and every sink by kind, in FD and as a share (NPC freight pay by kind: spot, brokered, contract, market; loans; deposits; insurance; scrap · fuel, wages, repairs, leases, fees, claims, the fall-off, the burns) | `faucetByTag`, `sinkByTag`, `burnByTag` | no |
| Freight | loads posted, cleared, lost or given up; a freight rate index (the month's mean cleared FD/mi against the first month's, by trailer); on-time share; the cap's volume and rate levers | day metrics | the index by trailer: a small one |
| Trucks | the new-truck price index (`dealerIndex` by tier and trailer); the used market: listings sold and their mean price ÷ book value; the lot's sales; trucks scrapped and written off, with **the book value destroyed**; repossessions | `dealerIndex`, `usedMarket`, `scrapped*`, `totalLosses` | value destroyed and the sold ÷ book ratio |
| Companies | carriers trading; trucks in service; bankruptcies and liquidations; companies in debt and what they owe in all; new companies | day metrics | no |
| Work | drivers employed and in the pool; the wage index | day metrics | no |
| Wealth, in bands only | the Gini, the top 1% and top 10% shares, the median company's FD by segment (owner-operator, fleet, broker) | report `wealth` | monthly, not yearly |

**What stays private** (Jeff's rule: a company's cash is its own): no figure for one company, no ranking by cash or
wealth, and no cell computed from fewer than ten companies, so a hub's or a segment's figure is shown only where ten or
more companies stand behind it (a player who is a hub's only fleet would otherwise be read off "Dallas fleets' median").
The wealth shares are national.

**What could be gamed.** The freight rate index: a player who books high on a thin lane to lift "the rate" moves an
index built from the whole country by nothing; read it national and by trailer only, never by hub. The sold ÷ book
ratio: one owner listing and buying between two companies to print a high ratio is caught by the transaction burn and
the market fee on every pass and is diluted by the national count; fine. Nothing in the report feeds a rule, so moving
it buys nothing.

## 3. Shipper loyalty points

**Why EVE's works, and what LANES has to sell.** An EVE loyalty store burns ISK because its items are scarce goods other
players pay ISK for on the market: the corporation's points are the mission runner's income, and the ISK half of the price
is destroyed. A LANES store sinks FD only as far as a perk is worth more to the buyer than its FD price, and the perk's
value has to come from somewhere: from money (a discount on a sink is paid by every other carrier through a smaller
refill; a payout would be a faucet), from access (an edge in the market), or from looks.

**Points.** One point per on-time delivery of NPC freight (direct and contract loads; a broker's load is the broker's),
kept per origin market ("Dallas shippers"), not per shipper, since the NPC shippers are not named; points expire after a
year. On the ten seeds that is about 320,000 points over four years nationally, 80,000 a year, most of them the bots'.

**The perks, sorted.**

| Perk | Points + FD | Worth it? |
|---|---|---|
| A livery, a cab badge, a named lane plaque for the company page | 50–300 points + 2,000–15,000 FD, burned | **Yes: a pure sink.** Looks, scarce by the points, tradeable never; no edge, no faucet; bots ignore it, so no pair |
| "Preferred at this market" for 30 days: counted local for the locals-first hold where it is not | 200 points + 3,000 FD | Later: an access edge earned by service, fair, but it moves the market and the bots must use it under the same rule; a pair |
| First call on that market's contract offers for 30 days | 300 points + 5,000 FD | Later, with the above; contracts are thin on live (19M of 1,381M of the cap's pay over four years) |
| A rebuild voucher or an insurance discount | — | **No.** A discount on a sink is paid by every other carrier through the refill; it reads as a reward and works as a transfer |
| Priority in a load's clearing, a rate bonus, Miles | — | **No.** Pay-to-win in the auction, or a faucet |

**The FD it burns** cannot be read from the bots (they buy no looks); it is whatever players pay for liveries. As a
guide, if one company in five redeems a 5,000-FD livery a quarter, 1,000 players burn 1M FD a year: the size of the
early-delivery fee, a twentieth of the transaction burn at 1%. **Bots:** none for the cosmetic store; the access perks
need a bot rule (redeem "preferred" at a market where the truck stands as a visitor with points to spend) and a pair.
**Verdict on the points:** worth building third, as a cosmetic store with the points as the gate, because it rewards the
on-time record a player can see and gives FD something honest to be spent on; it is not a sink of the transaction
burn's kind and should not be sold to Jeff as one.

## What ran, and where

The transaction-burn pair (six arms of ten seeds at 1460 days: the burn at 0, 1%, 2%, each with its cap-off twin) ran a
prototype in the runner in a scratch worktree at 9b3bc62, launched into clear vitest gaps between 15:57 and 17:36; the
gates are `gate-tb0/1/2.json` there. The report and the points are from the code at main (4ef09f3) and the ten-seed
runs of the batch 7 and fee pairs. Nothing in the shared checkout changed and nothing is staged; for the producer to place
as studio/reviews/economy-eve-sinks.md.
