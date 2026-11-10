# Economy: the locals-first rule change (2026-11-09)

For the producer, on Jeff's yes to the director's recommendation from the diaries (DECISIONS.md, 2026-11-09): a load a
shipper offers to local carriers first, which no local carrier took in its first round, opens to everyone from its next
round; under delivery windows, once it is in its urgency rounds. Asked for: the change's effect on the cap runs, one
round or two and the key, which ruleset, and the red team's angles. No engine edit here and no measurement patch: the
probe and the arms below ran on today's code in a scratch worktree at 4f9b73c, and nothing is staged.

## 0. The finding first: the rule as approved is what the engine does today

The premise in the brief ("a load no local takes stays locals-first through its rounds") is not what the code does.

- **freight.ts:426:** a locals-first load is stamped `localUntilRound = w.round + leverage.localRounds`, and `localRounds`
  is 1 on the base config and on live (live.ts sets nothing under `leverage`).
- **contracts.ts:38:** `localOnly = localUntilRound > 0 && w.round <= localUntilRound`. The round counter steps at the top
  of `runBoardRound` before any bid is read.
- **So a load posted at the end of round R** is held for locals at the R+1 clearing only. From the R+2 clearing every
  carrier's dispatcher bids on it, and every bot's: `bidsFromStandingOrders`, `autoBook` and the bots' `firstBidByHand`
  all gate on `mayTake`, which reads `localOnly` at the moment of the bid. Rollover (board.ts:231) never touches
  `localUntilRound`. The give-up count is 10 rounds plus the one local round.

The timeline of one locals-first load, rounds 12 hours apart (06:00 and 18:00):

| When | Locals | A visitor's dispatcher or a bot | A visitor by hand |
|---|---|---|---|
| R, posted at the boundary → R+1 | Book now | nothing | nothing |
| R+1 clearing (the "first round") | bids clear, locals only | nothing | nothing |
| R+1 → R+2 | Book now | nothing | `place_bid` refused (actions.ts:899, "first call this round"); the client says "Open to everyone from 06:00" |
| R+2 clearing (the "next round") | bids | **bids clear, open to all** | nothing: no bid could be filed in the interval before |
| R+2 → R+3 | Book now | Book now | Book now; a bid may be filed |
| R+3 clearing | bids | bids | **first clearing a hand bid can win** |

"A locals-first load that no local carrier took in its first round opens to everyone from its next round" is the R+2
line. The bots are already there. The only party one round behind is a player bidding by hand, because a bid is filed in
the interval before a clearing and the interval before R+2 still refuses it. That is a client-and-actions rule, not a
market rule (§2).

**What the cautious owner-operator saw at Palm Coast** (play-2026-11-09-cautious-owner-operator.md, min 18–22) fits
this engine, not the brief's: "every round, the locals-first loads were gone before they opened to me, and a new batch
of locals-first loads took their place." Florida in January is a market where trucks pile up, so `localShare` sits near
its 0.9 clamp; but no simulated carrier is based in that market (the probe below: Jacksonville, Orlando and Tampa clear
91–97% of their locals-first loads to visitors and 0% to locals), so those loads were not taken by locals inside the
round. They opened at R+2 and the visiting bots' dispatchers took them at that clearing, the one a hand bidder cannot
file for; what the player could bid on afterwards was what the bots had passed on, at 1.4–2.3 a mile against a 2.5
break-even. The diary's inference on line 146 ("locals-first loads roll over every round, so an outsider never gets
one") is a player's reading of a board that opened and cleared under them in the same clearing. The leverage rule is
otherwise doing what Jeff asked of it on 2026-10-28: a visitor stuck where freight is kept for locals leaves, and
`expectedWaitDays` / `bestExitHub` price that exit into the freight going in.

### The probe: who takes a locals-first load, and when (live profile, rule bots, 120 days, 30 warm, seeds 1–2)

Probe `runs/_locals.ts` (a listener on the world's "won" events and a scan of the open loads after each round; NPC
and broker loads, facility and player-shipper loads left out; 400 owner-operators, 120 fleets, 60 brokers). "Local" is the
engine's `isLocal`: the winner's home hub within 150 miles of the load's origin.

| Seed | NPC loads | Locals-first | Taken inside the local round, by a local | Later, by a local | Later, by a visitor | Never taken | Of those taken: at the opening clearing | Locals' share of all wins |
|---|---|---|---|---|---|---|---|---|
| 1 | 36,802 | 19.6% | 2.5% | 7.0% | **71.4%** | 19.0% | 43% (3% inside the local round) | 10.6% |
| 2 | 32,441 | 38.2% | 7.6% | 6.1% | **77.6%** | 8.7% | 67% (8% inside the local round) | 12.5% |

- **The loads open, and visitors take them.** Three quarters of the locals-first loads go to a carrier that is not
  local, most of them at the very clearing where they open. The bots are not kept out of anything past the first round.
- **Why so few go to locals: the simulated carriers are based at ten hubs.** `populate` forms every bot carrier at one
  of ATL, CHI, CMH, DAL, EWR, HOU, LAX, MEM, MIA and PHX (`runs/_homes.ts`, both seeds). At the other fifty hubs no
  carrier is ever local, so a locals-first load there is held one round for nobody and then goes to a visitor: at
  Jacksonville, Orlando, Tampa, Savannah and Charlotte 91–97% of the locals-first loads clear to visitors after the
  opening and 0% to locals. At the ten home hubs locals take 9–50% of their hub's locals-first loads (Miami 50%,
  Chicago 35%, Dallas 23%, Los Angeles 9%).
- **What the rule does in the sims, then, is a one-round hold with a price step**: the load waits 12 hours, its ceiling
  steps +10% at the rollover, and then the market takes it. Locals-first loads taken inside the local round cleared at
  1.29–1.35× their reference; taken later, at 1.38–1.62×. Other loads: 1.19–1.22× in their first round, 1.78–1.88× later
  (the slide).
- **A visitor's board**, counted at every hub and round where an idle truck from a non-local carrier stood (5,128 and
  8,173 hub-rounds): 13% and 34% of the open loads of its trailer were still held for locals; everything open was held
  in 2.9% and 15.6% of those hub-rounds, and the board was empty in 1.0% and 1.7%. Palm Coast's picture (one open loser,
  the rest held) is the 3–16%.
- **For a player the edge is real where the bots' is not.** A one-truck company based at Jacksonville is the only local
  there: first call on 38–53% of Jacksonville's loads with no one to compete against inside the round. That is the
  diary's own resolution ("Columbus, where locals get first call") and a strong, uncontested play at any of the fifty
  hubs; the bots never use it. The leverage rule is a player's edge, not a market force, in the world as populated.

- **The hold at zero and two rounds (the same probe, seeds 1–2):** locals take 8.1% and 10.2% of their hub's locals-first
  loads with no hold (the Book-now interval right after posting is still theirs), 9.5% and 13.7% at one round, 11.3% and
  15.6% at two; their share of all wins stays at 10.5–12.6% whatever the hold; visitors take 70–80% of the locals-first
  loads in every arm, a round later each time; and a visitor's board shows 7% / 21% of its open loads held at zero
  rounds, 13% / 34% at one, 17% / 43% at two.

## 1. What the change does to the cap runs

**Nothing, for the bots.** The approved rule is the engine's rule, so the ten-seed cap runs (em2-y4z, em2-gate-f5 and the
twin) are already runs of it: the local carriers' edge, the small-hub fleets' income, the clearing rates and the slide,
the lost and expired loads and the carriers' line against the twin all stand as reported (studio/reviews/economy-emission.md
§16.7). There is no pair to run on the approved rule because there is no second engine: a build of it behind a switch
reproduces today's digest with the switch on or off, and that identity is the test engineering should pin (§2).

**The sensitivity, in case the hold itself is in question** (one round against none and against two): a pair of pairs on
today's engine with the live profile, `leverage.localRounds` 0 / 1 / 2, seeds 1–2, 730 days (two seasons, one cycle), in
the 4f9b73c worktree. The 1460-day gate pair was not run: the approved rule leaves it untouched, and the suites ran today.

| Arm (`localRounds`) | Seed | Posted | Fill | Expired ÷ posted | Avg rate /mi | OO profit / truck-week | Fleet profit / truck-week | Companies bankrupt | NPC pay (M FD) |
|---|---|---|---|---|---|---|---|---|---|
| 0 (no hold) | 1 | 406,874 | 0.534 | 0.461 | 3.94 | 2,562 | 2,481 | 121 | 801 |
| 0 | 2 | 390,272 | 0.572 | 0.423 | 3.83 | 2,273 | 2,173 | 82 | 812 |
| **1 (today)** | 1 | 405,280 | 0.538 | 0.458 | 3.98 | 2,652 | 2,643 | 135 | 812 |
| **1** | 2 | 389,263 | 0.570 | 0.424 | 3.87 | 2,354 | 2,166 | 89 | 825 |
| 2 | 1 | 399,871 | 0.545 | 0.450 | 3.98 | 2,627 | 2,693 | 118 | 793 |
| 2 | 2 | 381,435 | 0.580 | 0.415 | 3.88 | 2,309 | 2,108 | 91 | 812 |

Medians by strategy move both ways between arms (fleets' conservative median 106k → 83k → 88k in seed 1 while its
random median goes 68k → 121k → 91k), so they are seed noise, not a reading.

- **One round against none:** the clearing rate +1.0% in both seeds, NPC pay +1.3% and +1.6%, the owner-operators'
  profit per truck-week +3.5% in both; the fleets +6.5% and −0.3%; fill and the expired share unchanged; bankruptcies
  +14 and +7 of about 100, inside the noise of the other lines. The mechanism is the probe's: one +10% ceiling step on a
  fifth to a third of the loads before anyone but a local can take them, which at fifty of the sixty hubs is all the rule
  does. The seed-to-seed spread inside one arm (owner-operators 2,652 against 2,354) is three times the arm's effect.
- **Two rounds against one:** the rate flat, the owner-operators −0.9% and −1.9%, NPC pay −2.4% and −1.6% with posted
  −1.3% and −2.0% (the cap's volume lever reading a slower board), the expired share down 0.8–0.9 points (the extra
  round of give-up grace a locals-first load gets). Nothing a player would feel in their books; a visitor stands 24
  hours at a crowded hub instead of 12.
- **The carriers' line against the twin** is untouched by the approved rule. Were the hold's length ever changed, these
  arms say the line would move by less than the spread between two seeds of the same arm; the 1460-day ten-seed pair
  would be the check, not today.

## 2. One round or two, and the key

**One round, as today, and the key already exists: `leverage.localRounds` (1).** It is the one figure a player can read:
"local carriers first for one round", the client's "Open to everyone from HH:00". Two rounds would double the time a
visitor stands at a crowded hub for no gain to the locals that the sims can see (the probe at two rounds gives the locals about two points more of their hub's locals-first loads, 9.5% → 11.3% and 13.7% → 15.6%, and nothing of all wins, while a visitor's board shows 17% and 43% of its open loads held instead of 13% and 34%); zero removes the
mechanism Jeff asked for.

**The gap that is real is the hand bidder's round.** The one change worth building from the diary: a bid by hand on a
locals-first load is accepted in the round before it opens and held for the opening clearing (in `place_bid`, accept when
`w.round >= load.localUntilRound`, since the bid is read at `w.round + 1`; `manualRoundBids` already re-checks `mayTake`
at the clearing, so an opened load clears the bid and a load a local took first drops it as today). That puts a player at
R+2 beside the dispatchers and bots. It is a player-facing rule like the five of c1af286, so it takes its own switch
(say `board.bidBeforeOpening`), default off; the bots' own filter in `firstBidByHand` stays, so the ten-day digest is
identical with the switch on or off and no sim moves. The client's wall then reads "Local carriers first this round;
your bid stands for HH:00". Nothing else in the engine changes.

**Under delivery windows: not the urgency rounds.** Batch 1 keeps today's stamp (posting round + 1), so a windowed load
is held for locals for one round after posting and open after it, as today. Tying the opening to the urgency rounds
instead would hold a lead-3-day load for locals through about seven rounds and open it to visitors only in its last two,
when the ceiling has stepped (+10%, +21%) and Book now has walked to it. That is more protection than today's rule, not
less, and it points the other way from the diary: visitors would get only the leftovers, at the walked price, with two
rounds left before the load is lost. Expect more lost loads and fall-off, dearer leftovers for whoever is parked at
thin hubs, and a walk that visitors can farm by waiting for it. Keep the opening one round after posting under windows
too, and let the sizing batch read one more figure (added to economy-delivery-windows.md's five): **locals' share of
wins** against today's probe figure (10.6% and 12.5% of all wins in seeds 1–2, and 2.5–7.6% of the locals-first loads taken inside the local round). The reason to watch it: batch 1 files a load ready on a later
day under a later key and the dispatchers bid on today's freight only, so for the 55% of loads with a lead of a day or
more the local round passes with nobody able to bid, and the local edge rests on the lead-0 loads until batch 3's
booking ahead reads the later keys. If the share falls well under today's, the fix is a local round anchored to the
first round the load is ready, never to urgency.

## 3. Which ruleset

- **The approved rule:** no ruleset, because nothing changes in the market. Record it as today's behaviour in
  DECISIONS.md, so the diaries' finding closes on the right fact.
- **The hand-bid switch (§2):** a player-facing rule, so it rides with the five of c1af286 in 0.24.1 once Jeff gives the
  word on that set; no sim moves, no restart needed for the economy's sake.
- **Under windows:** nothing extra; the one-round stamp is already in batch 1. The locals' share of wins goes into the
  sizing batch's readings, so a change of anchor, if one is needed, rides with the windows ruleset.

## 4. What a red team would do with a load that opens after one round

1. **A local letting loads lapse to buy them cheaper next round.** There is nothing cheaper to buy: the carrier is paid
   its own rate, and the round a load waits steps its ceiling up 10% (board.ts:245) and walks Book now toward it (R11).
   Waiting is a bet on a higher ceiling against the visitors who arrive at R+2 and against every other local at the
   hub, and in the crowded hubs where locals-first bites there are many locals. At a thin hub with one local fleet the
   bet exists today and is bounded: the first step is inside the broker's fall-off reach (contract × 1.15), the second
   (+21%) is not, so an AI broker's ceiling stops at the reach and the second round of waiting buys nothing. Direct NPC
   shippers do pay the walk; that is today's ten-round slide, already in the sims, and the hub-crowding yard rent and
   `homeEdge` dilution are the costs of the fleet that would farm it. No change.
2. **A visitor parking trucks at crowded hubs for the opened leftovers.** That is the design's pressure valve: the
   leftovers pay what the locals passed on, the visitor's wait is `1 ÷ (ratio × (1 − localShare))` rounds, and after
   `repositionAfterRounds` (2) the dispatcher runs the truck out. Under the hand-bid switch a human can stand there one
   round sooner than today; same leftovers.
3. **Blocking: win a load to keep it from a rival, then not haul it.** Today a won load is hauled; the only paths back to
   the board are the safety ones (`reopenLoad`), which re-post it open to all. Under windows `release_load` costs 10%
   early and 25% in the urgency rounds, and a no-show 25% and the record's mark (batch 2), so blocking costs more than
   the load pays anyone. No change.
4. **Choosing a home hub for its first call.** `isLocal` is the home hub within 150 miles and no recent tender refusal.
   A player who bases in a crowded market to get first call is doing what the diary's writer resolved to do ("Columbus,
   where locals get first call"): that is the rule's intended play, and the yard rent and the home-edge dilution scale
   with how many share the hub (home.ts).
5. **Under the urgency anchor (if it were built):** a visitor's best play would be to wait for the urgency rounds and take
   the walked rate, and a broker's loads would reach the deadline more often. Another reason not to build it.

## What ran, and where

- Probe `_locals.ts` (who takes a locals-first load, and the visitor's board; 120 days, 30 warm, seeds 1–2, `localRounds`
  0 / 1 / 2), `_homes.ts` (where the bots are based) and the three 730-day arms ran in a scratch worktree detached at
  4f9b73c, node_modules symlinked by the before-rule recipe, so engineering's uncommitted batch 2 was not under them.
  Launched in a clear vitest gap at 16:03 after the gate chain ended, eight and then four processes. The worktree is
  removed; the scripts, the probe JSONs and the six reports are kept at
  the economy's session scratchpad.
  Nothing in the shared checkout changed and nothing is staged.
