# Economy review: the emission cap (2026-11-04)

Seeds 1 and 2, 120 days, live profile. Before = runs/em-before, after = runs/em-after. Not committed; the ruleset bump is the producer's.

## Diff

- `packages/config/src/economy.config.ts`: `token.emission = { enabled: false, capFd: 1e9 (circular.capFd), genesisFd: 4e8 (the allocations outside the 60% reserve), firstMonthFd: 3e7, multRange: [0.5, 1] }`.
- `packages/config/src/live.ts`: `"token.emission.enabled": true`.
- `packages/engine/src/emission.ts` (new): `budgetFd(m) = 30M × 0.95^m` (r = 1 − first ÷ (cap − genesis); the schedule sums to 600M), `cumulativeBudgetFd`, `emissionMultiplier`, `dailyEmission`. Unspent budget rolls forward, overspend comes out of the next month.
- `ledger.ts`: `npcPaidCents`, which counts faucet:npc_shipper and faucet:npc_factor postings to `co:` accounts. `world.ts`/`metrics.ts`: `stab.emissionMult`, logged daily. `freight.ts`: `rf = reserve × dial × emissionMult`. `step.ts`: the end-of-day hook. `index.ts`: the export.
- Test: `packages/engine/test/emission.test.ts`, 2 tests (the schedule's ratio, its sums and its cap; the multiplier and both clamps). They pass. engine.test.ts: 162 of 162 pass.

## Before → after

| | Seed 1 | Seed 2 |
|---|---|---|
| Sink/faucet, Q1 (days 0–90) | 0.61 → **0.70** | 0.68 → **0.72** |
| Sink/faucet by month (M1–M4) | .57 .61 .65 1.05 → .61 .74 .76 .96 | .62 .67 .76 1.06 → .64 .77 .77 .92 |
| NPC carrier pay by month, M FD | 39.7 36.7 32.3 22.7 → 36.7 27.0 25.8 24.5 | 35.6 31.9 27.6 21.8 → 34.1 26.5 26.3 23.5 |
| Supply at day 120 | 65.5M → **49.2M** | 47.1M → **44.0M** |
| OO median wealth, greedy / conservative / random (k) | 98 / 344 / 99 → 106 / 302 / 69 | 96 / 288 / 79 → 86 / **117** / 82 |
| OO liquidated per mille, g / c / r | 22 / 22 / 15 → 52 / 30 / 7 | 0 / 7 / 22 → 7 / 37 / 22 |

Multiplier path, days 0–59 (seed 1): 1.00 to day 10, 0.96 → 0.50 over days 11–20, 0.50 to day 28; month 2 opens at 0.76, eases to 0.50 by day 46 and holds there. Seed 2 is the same shape: 1.00 → 0.50 by day 23, then month 2 opens at 0.85 and is at 0.50 from day 52.

## Findings

- **The band still fails.** The cap cuts NPC pay 10–27% from month 2, but npc_lessor (32% of faucets, out of scope) and the lag keep Q1 at 0.70–0.72. A load keeps the rate it was posted at, and factoring pays on delivery, so month 1 overspends 22% (36.7M against 30M) and the multiplier sits at its 0.5 floor for the last 8–10 days of each month.
- **The 70% cash guard fails on seed 2's conservative OOs** (288k → 117k, 41%). Seed 1's random OOs sit right at the line (70%). The prudent bots lose the most, which is the wrong direction for Jeff's goal.
- Not run (the two-pair limit): a gentler schedule. Next candidate: `firstMonthFd` 36M (r = 0.94), plus a multiplier read on the backlog's posted rates.

## Not done

Item 2 (risk-priced purchase loans and the bust covenant): not started, for budget. No four-year run. No commit.
