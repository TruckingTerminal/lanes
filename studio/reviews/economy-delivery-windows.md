# Economy note: item 4, the two claims (2026-11-09)

Economy designer, for the producer and the director. Question 2 of engineering's proposal
(engineering-item4-delivery-windows.md in the shared folder; the director's calls of 2026-11-08 on 1, 3, 4 and 5 stand).
No engine change and no sim: the windows engine is not built, so a pair on today's engine would measure today's slide,
not the window; the figures below are sized from the ten-seed runs of the gate (em2-y4z, flat 5M, cap on, the twin beside)
and the rules as written. The sizing batch after engineering's batches 1–3 reads them in the world they change.

## The two figures

| Claim | Share | Base | Payer → payee |
|---|---|---|---|
| **Late delivery** (delivered after latestDeliveryT) | **20%** | the load's pay to the carrier as booked (the rate on the card, fuel and tolls in) | carrier → poster; `sink:service_failure` for NPC paper; the sink when both are one owner's |
| **Lost shipment** (unbooked at latestPickupT, broker posted) | **15%** (today's `brokerRisk.fallOffShare`, unchanged) | the contract (the shipper's rate × miles) | broker → `sink:broker_falloff`; a re-post pays its upstream broker the same on the rate it took it at |

Engineering's other shares stand and keep their order: cancel early 10% < late 20% < no-show 25% = cancel in the urgency
rounds. A carrier running late must always come out ahead by delivering (it keeps the pay and owes a fifth) rather than by
not showing (no pay and a quarter), and the order says so on the card. NPC direct freight and a player shipper's own goods
stay as proposed: lost and counted, no claim. One new key, `windows.lateClaimShare: 0.20`; the lost claim reuses the
fall-off key, so there is one figure for "the shipper gave up" however the load died.

## The one-truck company the figures are sized against

Years 1–4, seeds 1 and 2 of the cap run, the cap-off twin in brackets:

| Measure | Figure |
|---|---|
| Pay per cleared load | 3,110 FD (twin 3,340), 821 loaded miles at 3.75 FD a mile |
| Loads a truck in service hauls a week | 2.7 (2.8) |
| Gross a truck-week | 8,400 FD (9,450) |
| An owner-operator's profit a truck-week, all costs in | 2,030–2,220 FD (2,430): about 300 FD a day |
| Contribution of a load (pay less the trip's fuel, wages, upkeep, insurance) | about half the pay |
| A busy truck-day's contribution (0.39 loads × 3,110 × ½) | about 600 FD, 19% of the mean load |
| The insolvency line | under −2,000 FD at four weekly checks in a row |
| What a crash costs the same company | 2,500 FD deductible (cargo or physical damage), 5,000 liability |
| The commodity's window | 24–120 hours past the legal transit, median 72 |

## The late claim: why a fifth

**It costs more than lateness saves.** The director's test. canMake refuses a plan that cannot make the window at the
legal pace, so a late delivery under windows is not a load knowingly booked late; it is a feasible plan run tight (a rest
taken, a dock missed, a detour for a second load) or bad luck. What running late buys a carrier is the truck's time: a day
of lateness is at most a day of a busy truck spent elsewhere, worth about 600 FD of contribution, 19% of the mean load. At
20% the claim takes back that day with the load's own size as the scale (a longer load, a bigger claim, and a longer load is
where a day is lost), so a tight plan that is late half the time gives back a third of the margin it chased. The windows are
24–120 hours wide past the transit, so lateness in this world is hours to a day, not days; a flat share covers it. 15%
(465 FD on the mean load) sits under a truck-day, so a day late would still pay; 25% equals the no-show, and the goods did
arrive. The claim is not the whole cost: a late load also earns half its Miles (`miles.onTime.late` 0.5), takes the on-time
mark (a quarter of the bid score), and, unpaid, a credit mark (`credit.claimPoints`); a hot load late already gives back half
its premium (`lateKeepsPremium`), and the claim comes on top, since the premium bought the speed and the claim is the
lateness.

**It hurts a one-truck company.** 620 FD on the mean load: two days of its profit, three tenths of its week, a quarter of
what a crash costs it. Read in advance on the Needs-you item beside the pickup risk, it is a figure worth a decision (release
the next load early, send the truck now), which is what the director asked the number to be.

**It never alone bankrupts one.** Liquidation needs four weekly checks under −2,000 FD. A newcomer with nothing in hand
and one late load stands at −620 and is above the line again after two ordinary days; three late loads in a row with no
income still stand above it; the largest loads (about twice the mean) claim 1,240. The claim posts against the account like
any bill, so a company whose cash sits in the Reserve goes briefly into the red and comes out of it on the next settlement,
as it does with a repair.

**The bots.** The same canMake, the same two deep, the same 20% (the director's call 5). A bot's late load costs it what it
costs a player, and the report's claim totals read the bots' lateness, which is the batch's measure of how tight the
dispatcher runs its second load.

## The lost shipment's claim: why the fall-off share stays

The charge and the broker's reach are one figure by design: a broker pays carriers up to the fall-off share over its
contract to cover a load, and past that losing it is the cheaper way out (board.ts rollover). A brokered load's ceiling
opens at the contract less the broker's margin (5–12%), so the director's two urgency steps (+10% each, about +21%) reach
1.06–1.15 times the contract, inside the 15% reach; at 15% both steps land for every AI broker, and a player brokerage's pay
never walks (S4). Raising the share would not let the walk go further, only make a lost load dearer. It is dear already:
465 FD on the mean contract, two to three loads' margin for a broker at 6–12%, and the fall-off sink ran 21–27M FD over the
four years of each cap seed, 1.6–1.9% of NPC pay and a fifth to a third of all brokers' gross margin; the brokerage review
sized a new brokerage's 15,000 FD of working cash as "about a month of fall-off charges and shipper defaults" at this
share. Under windows the loss is final and comes sooner (a lead-0 load has 12–24 hours on the board, not ten rounds),
so the brokers' exposure moves before any share does; the batch reads it on the new engine, and the share moves only if
the reading says so. For a one-person brokerage: one lost load is a day's margin gone, three per cent of its working cash,
and nothing like a bankruptcy; forty loads lost at a thin hub is one, as it should be.

## What the sizing batch reads (after engineering's batches 1–3, before the ruleset)

1. The late share under the hard window, by segment, against today's 72% on-time against the appointment (the hard window
   sits past it, so the share should be a small fraction of today's 28%); the claim total as a share of NPC pay, and its
   split between the sink (NPC paper) and company-to-company.
2. Lost loads by poster kind and the fall-off total against today's 21–27M a seed; broker and brokerage bankruptcies against
   today's; the lead-0 loads' fate in particular.
3. One-truck companies: claims per company-year, the share that went into the red on a claim, and whether any liquidation has
   a claim as its last straw.
4. The urgency walk's reach on brokered loads: how often the second step touches the 15% line.
5. The thin starter hubs (the producer's note for item 10): a newcomer's paying loads at DAL and CHI at day ten with bots
   booking ahead, since the board ahead changes what a newcomer sees.

Two seeds on a 1460-day pair settle 1–4; the per-hub reading needs the first-board probe (apps/sim/src/firstBoard.ts) on
the windows engine. Nothing here moves live levers; the ruleset that turns windows on is the batch's, after the gate.
