# Economy: why the AI brokers lose money with windows off (2026-11-13)

On QA's Intel reading and engineering's probe (engineering-client-batch8d-2026-11-13.md item 3: every AI broker with a
closed month "kept" a loss; months 2–3, 661k booked against 957k of cost). From the code at main and two read-only probes
(`_brokers.ts`: every brokered load an AI broker took in year one, by month, what it cleared at against the contract the
shipper pays and the spot ceiling, the rounds it walked, and the loads that fell off; seeds 1–2, the live profile with
0.24.1's nine rules, windows off; once as today and once with every AI broker posting open).

## Verdict

The brokers lose money because they alone pay for the board's unhauled freight. In this world a third of all NPC freight
is never hauled (the off arm gives up 44% of posted loads after ten rounds; the cap's volume lever sits at its floor 223
days of 1,460 and the surplus remains). A direct NPC load that goes unhauled costs nobody; a brokered one costs its broker
15% of the contract. In year one 27–36% of the AI brokers' loads fall off (42% in the first three months on seed 1), so the
fall-off takes 5–8% of what they bill, against a margin of 6–12% less the 3% board fee and less what the walk pays
carriers over the contract. The vetting is not the cause (opening every broker leaves the fall-off share where it is), and
the spot branch of the walk matters only in month one. It matters mostly to the brokers' own books: the market loses no
cleared loads to it (those loads would go unhauled as direct freight too) and the cap's spend is unchanged in kind; what
the market feels is half the AI brokers liquidating over four years and their capital passing to carriers as pay above the
contract. **The change:** give the brokers the control the fall-off charge assumes they have: the cover rule batch 7 built
for windows, applied with windows off too (an AI broker takes no tender at a hub where the AI brokers lost a quarter of
what they took over the trailing week), and the walk's reach capped at the fall-off line. Keep the 15%. A ten-seed pair
before a ruleset, since it moves which loads are brokered.

## 1. The walk, and the ceiling at contract × (1 − margin)

The ceiling opens at the contract less the broker's margin (6–12% by persona) and steps 10% a round; the broker "eats the
raise" up to `max(contract × (1 + fallOffShare), spot ceiling)` (board.ts `raiseCeiling`). So yes, a walked brokered load
pays its carrier above the contract, by design up to 15% over it, where hauling it costs the broker as much as losing it.

| Year one, AI brokers' loads | Seed 1 | Seed 2 |
|---|---|---|
| Cleared · fell off (share of what they took) | 7,819 · 4,482 (36%) | 16,702 · 6,230 (27%) |
| Carriers' pay ÷ the contract, all cleared · cleared in the first round | 0.92 · 0.68–0.88 | 0.89 · 0.73–0.85 |
| Cleared above the contract, share | 22–45% by month | 19–55% by month |
| Walked at least a round, share | 65–90% | 61–90% |
| Billed · paid to carriers · fall-off charges, M | 21.5 · 19.8 · 1.68 | 46.3 · 41.2 · 2.55 |
| **Margin less the board fee and the fall-off** | **−0.61M (−2.9% of billed)** | **+1.15M (+2.5%)** |

**The spot branch** (the broker paying up to the spot ceiling when it is above contract × 1.15) bites only in month one,
when the opening boom puts spot at the contract (spot ÷ contract 0.95–1.0): 15–18% of month one's brokered loads, 120–170
of them paid above the fall-off line. From month two the contract index sits well above the spot ceiling (spot ÷ contract
0.5–0.8) and the branch never fires again. It is wrong in principle (no broker pays more than losing the load costs) and
small in size: cap the reach at `contract × (1 + fallOffShare)`.

## 2. The fall-off charge against what a broker controls

A broker controls its margin and which tenders it takes; it does not control how much of the board goes unhauled. With
27–36% of its loads falling off at 15% of the contract, the expected charge is 4–5.5% of every tender, on top of the
board fee's 3% and the walk's excess: a 6–12% margin cannot carry it. The probe with every AI broker posting open (no
vetting) read the same fall-off share (36% and 27%) on more volume, so the strict and standard brokers' vetting of new
carriers is not what strands their loads. The charge itself is right in size (it is the shipper's real cost of a missed
pickup, and it is what makes a broker choose); what is missing is the broker's choice of where to take tenders.

## 3. Do the bots' broker orders take tenders they cannot cover, with windows off?

Yes. Off windows the only brake on a tender is the bond cap and the broker's open-load cap (40 for a bot); nothing reads
how many of a hub's brokered loads went unhauled. Batch 7's per-hub cover rule (`windows.coverDays` 7, `coverMinLoads` 4,
`brokerMaxLostShare` 0.25, a tally per hub across the AI brokers) exists only with windows on, where it never fires
because the memory-free pricing already keeps the brokers small. Off windows it is the missing piece.

## 4. Does it matter to the market?

| | What the brokers' losses do |
|---|---|
| Cleared loads | Nothing measurable: a load that falls off from a broker would go unhauled as direct freight at the same rate (the board gives up 44% of everything) |
| Carriers' pay | Slightly up in year one: the walk pays carriers above the contract out of the brokers' capital (about 1–2M a seed a year) |
| The cap's spend | Unchanged in kind: the NPC pays the broker the contract on what is hauled; the fall-off charges are an operating sink and refill the budget |
| The brokers | 24–30 of 60 liquidated over four years in the off arms; their debts written off as a bankruptcy faucet; the tenders they would have taken go to the board |

So mostly the brokers' books, and the brokers are the players' competitors and partners in the brokerage layer: a
broker economy that cannot make money tells a player brokerage the wrong thing about the trade.

## 5. The change, and its pair

- **The cover rule with windows off too:** the same keys and tally (`b:{hub}` across the AI brokers, a trailing week,
  four taken, a quarter lost); off windows "lost" is a fall-off (`giveUp` on a brokered load). A hub where the AI
  brokers lost a quarter of what they took last week sends its tenders to the board as direct NPC freight. Players'
  brokerages stay out of the tally, as under windows.
- **The walk's reach at the fall-off line:** `most = contract × (1 + fallOffShare)` (the spot branch goes).
- **The fall-off share stays 15%.**
- **The pair:** ten seeds with windows off and 0.24.1's set, the rule on against off, the gate; lines: the AI brokers'
  margin after fall-off by year, their liquidations, the brokered share of the cap's pay, fall-off charges, tenders
  passed up and to the board, cleared loads, carriers' pay per mile on brokered and direct freight, and the band.

## What ran, and where

Two read-only probes (`_brokers.ts`, two seeds, 365 days each, today's vetting and all-open) in the batch 8 scratch
worktree at 51d0a1d, gated from a script file; nothing in the shared checkout changed and nothing is staged; for the
producer to place as studio/reviews/economy-ai-brokers.md.
