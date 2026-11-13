# Economy: the director's rules C, H and I, the pair (2026-11-13)

On engineering's build at bda1380 (engineering-rules-chi-2026-11-13.md): H, a hired driver on home time is not called
out by a booking or bid by hand (`labor.homeTimeHolds`); C, a hired driver past due home takes only homeward loads by
hand (`labor.pastDueRefuses`); I, a paid driver never sits beside an empty truck for a company that staffs by hand
(`labor.seatPaidDrivers`). The mid-leg night in town is not built yet (engineering's open design question), so it is not
in this pair.

## Verdict

The three rules ride in a ruleset without an economy question: they cannot move the bots' world, and on four years of
two seeds they do not. Every bot books through its dispatcher (which already skips a resting truck and plans homeward
when a driver is due home) and staffs itself (autoStaff), so H, C and I never apply to one; with all three on, the world
is identical to all off day for day over 1,460 days on seeds 1 and 2: every daily metric, cleared loads, bankruptcies,
profit per truck-week and FD in circulation to the cent. The lines the brief asks for (carriers' pay and profit,
liquidations by persona, empty miles home, quits and days away, cleared loads, the gate) are therefore the off arm's by
construction; a ten-seed pair would only show the same. Their effect is on a player who books and staffs by hand, and
there it is what the director ruled: a hired driver's days off are kept, a past-due driver heads home, and no paid
driver idles beside an empty truck. If a player-side reading is wanted (how often a hand-playing player meets each
refusal, and what it costs them in loads), that is a play test's question for QA and the diarists, not a sim's.

## The check

| Seeds 1–2, 1,460 days, 0.24.1's set on in both | All three off | All three on |
|---|---|---|
| Daily metrics, every day | — | identical to off, both seeds |
| Cleared loads | 441,183 · 451,724 | 441,183 · 451,724 |
| Companies bankrupt | 202 · 143 | 202 · 143 |
| Owner-operators' profit per truck-week | 2,206.84 · 2,093.95 | 2,206.84 · 2,093.95 |
| FD in circulation at the end | 121,206,431.58 · 111,131,420.40 | the same |

Run in a scratch worktree at bda1380 from a gated script; nothing in the shared checkout changed and nothing is staged.
The night in town reaching mid-leg is a rule the bots do meet (their trucks stop on the road like a player's), so its pair
will need the full ten seeds when it lands.

## The night in town reaching mid-leg: the same identity (added 2026-11-13)

The mid-leg night is engineering's option 1 (0abb7b8), behind `businesses.parking.stopInTownMidLeg`. It is the same
case as C, H and I, so it needs no ten-seed pair. With the switch on, at 1a5a9f0 (the fee off), the world is identical
to the switch off, day for day over 1,460 days on seeds 1 and 2: every daily metric, and the parking lines with it. Site
nights are 454,008 and 464,255; shoulder nights 130,490 and 133,769; tickets 43,101 and 44,062. Cleared loads,
bankruptcies, profit per truck-week and FD in circulation match to the cent, and they are this note's figures above.

The rule's conditions all hold in the live profile (`businesses.enabled`, `parking.stopInTown`). It also needs a
company whose night stop is "town" (`nightStop === "town"`), and no bot ever sets one. So the bots' 130,000 shoulder
nights a run stay on the shoulder, and the rule acts only for a player who chose the town. If the director ever wants
the bots to choose the town (say, the prudent personas), that is a ten-seed pair: 130,000 nights a run would become
town nights with miles there and back.
