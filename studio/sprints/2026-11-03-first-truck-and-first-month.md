# Sprint 2: the first truck and the first month (planned by the director, 2026-11-02, after the sprint 1 gate)

Sprint 1 made the first ten minutes the player's own. Sprint 2 follows the same player to the next two walls they
hit: buying a truck (step 9: the Dealer, Finance, getting paid) and day 91 (brokerage). One question to Jeff
goes first, because three of the builds below are leverage tools and its answer changes them.

## Rank, and what each needs

| # | Item | Sprints | UX spec first? | Owner chain |
|---|---|---|---|---|
| 0 | Sprint 1's carry-over (`reviews/director-gate-sprint1.md`), market truth first: "usually clears near" above the ceiling | first days | no | engineering → QA |
| 1 | **Prudent vs greedy: do busts punish leverage?** A write-up with options, then Jeff decides | decision now, build sprint 3 | no | economy → Jeff |
| 2 | **Finance rebuilt:** Getting paid (factoring, quick pay, the broker's flat 5%) and staking as lock-term discounts; the pools are already off | one | yes (Finance) | economy switches → UX → writer (step 9) → engineering |
| 3 | **The brokerage chrome** at day 91: teaser, licence, stake, surety, posting, the carrier's trail, the margin | one | yes | director brief → UX → writer → engineering |
| 4 | **The Intel tab:** every company's size and standing, live cash private | one | yes | director page → UX → engineering |
| 5 | **Iuliia by tab and card**, and the Back Lot card's rewording | one (writer), wiring sprint 3 | a placement rule (below) | writer → engineering |
| 6 | **Three tractor makes** (Keystone, Meridian, Ironwood: one per existing tier); tractors and trailers bought apart in the Dealer | one, in sprint 3 | yes (Dealer) | economy note + art's three looks (sprint 2) → UX, engineering (sprint 3) |

**Cut line:** if the sprint runs short, 4 moves to sprint 3 before 2 or 3 do. 2 and 3 are walls a real player hits
in the first month, and the client shows wrong rules today (QA B8: the old one-year factoring contract).

## Why this order
- **0 before anything new.** A board that prints a clearing rate above its own ceiling breaks pillar 1, the one
  the whole game stands on. The rest of the carry-over is small and rides along.
- **1 first.** Pillar 3 says growth is risky. The dial's batch says prudent bots don't beat greedy ones over two
  years because busts don't punish leverage. If that stands, factoring, purchase loans, staking discounts and the
  makes' depreciation curves all reward the wrong player. A decision costs a write-up; building first costs a redo.
- **2 next.** It sits on the new player's path (step 9) and is wrong on screen today. Staking rides along only if
  the economy has sized it; otherwise Finance ships with Getting paid and credit, and staking follows.
- **3 has a clock.** The live world reaches day 91 about 23 real days after its restart. The engine is built; the
  player can't see it (QA part two: no licence, no stake, no trail, no margin).
- **4 is one world made visible** (pillar 2), and the Back Lot's scouting screen later. Cheap in engine, a real
  screen in UX: where it lives on a phone's four-item bar (More, I expect) is UX's call.
- **5 is writer-led** and runs beside everything. It needs one rule, set here: Iuliia says at most one line on a
  screen, on its first visit or when something on it changes, never over a number the player is reading; humor
  in her lines, never in the figures. The Back Lot card keeps player against player, the gate and the cameras,
  and drops "crews for hire" and "may tempt you" (the gate's copy row): rivalry's words, no crime words.
- **6 is one sprint now, in sprint 3.** Jeff settled three makes on the three tiers the economy already runs
  (Keystone the workhorse, Meridian the economical highway truck, Ironwood the premium driver's favourite), so
  each needs a depreciation curve, a driver-appeal figure if Ironwood's is new, a look and a Dealer line, not a new
  economy. The curves are still a rule change (sim, ruleset bump, restart with no players) and they price
  leverage, so they wait on item 1. Sprint 2 prepares it in parallel: the economy's note and art's three looks at
  card and map scale. Sprint 3: the Dealer spec (tractor, trailer and make chosen apart; the rig as a shortcut)
  and the build.

## Not in sprint 2
The authoritative server runs beside it as engineering's own track. The title traffic and Iuliia's anatomy pass stay
art's, from Jeff's slop list. The red team's first pass follows factoring and the population dial.

## Done means
Jeff has answered item 1; Finance and brokerage pass QA's replay on a phone; the Intel page (the director's, first week) is approved or moved;
the writer's `iuliia-lines.md`, the economy's makes note and art's three looks are in review.
