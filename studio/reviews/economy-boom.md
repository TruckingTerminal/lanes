# Economy review: the week-one boom (2026-11-04)

Seeds 1 and 2, 120 days, live profile (0.22.0-phase0.37). The probe reads every open spot load after each board round,
and every spot clear. "Steady" is the day 60–120 median clear per trailer and market in the run before the change.

## Mechanism: the reference is inflated in week one

| Board, median (seed 1 / seed 2) | Days 3–10 | Days 60–120 |
|---|---|---|
| Reference /mi | 4.90 / 4.93 | 2.87 / 3.06 |
| Rate factor (dial × reserve factor) | 0.96 (1.00 × 0.97) | 0.59–0.75 |
| Season table (rate) | 1.156 | 0.962 |
| Load-to-truck ratio at posting | 2.50 (the clamp) | 2.50 (the clamp) |
| Ceiling / reference | 1.45 / 1.32 | 1.76 / 1.76 |
| Hot loads / short loads on the board | 2% / 12% | 2% / 11% |
| Book-now / clears near (median, p90) | 1.35, 2.34 / 1.32, 2.31 | 0.99, 1.10 / 0.97, 1.17 |

- **The cause:** the beta opens at genesis rates. The reserve factor is 0.97 in week one and 0.73–0.78 by days
  60–120, and the dial goes from 1.00 to 0.81–0.90. Together that is 1.45×. January's season adds 1.20×, by design.
- **Not the cause:**
  - The ratio sits at its 2.5 clamp from day 2 to day 120.
  - The ceiling climbs *less* in week one than later, and book-now sits at the ceiling in both windows (0.99).
  - Hot and short loads take the same share of the board in both windows.
  - The market mood only reports the surge (+0.6 to +1.0 on days 8–14).
- **The surge inside week one** comes from the cold start. All the trucks are busy by day 2, while 1,100 loads a day
  post against about 450 cleared, so the backlog grows from 739 to 4,577 loads by day 10. The ratio pins at the
  clamp and the ceiling climbs from 1.20 to 1.60.
- **"Clears near" lags.** It is a plain mean of the first 40 clears, and those were set on days 1–2 at 2.3–2.7/mi.
  That is the diaries' "two to three times".

## Fix (packages/config/src/live.ts)

```diff
   "token.circular.reserveFactor.exponent": 2,
+  "token.circular.reserveFactor.clamp": [0.5, 0.8],
```

- What the change does: the reserve factor tops out at 0.8. It binds only while the reserve is within ~11% of genesis.
- In y4-REST seed 3, the factor against day 1 is 0.85 at day 60, at most 0.80 from day 90, and 0.59–0.73 after that.
- I tried the dial's start at 0.7 first and rejected it. The dial keeps walking down (0.57 at day 120), and owner-operator
  cash falls 33–37%.

## Before / after

| Week one: book-now ÷ steady (median / p90) | Seed 1 | Seed 2 |
|---|---|---|
| National | 1.21 / 2.17 → **1.05 / 1.82** | 1.51 / 2.73 → **1.31 / 2.35** |
| Van · reefer · flatbed (median) | 1.27 · 1.16 · 1.12 → 1.11 · 0.99 · 0.96 | 1.88 · 1.13 · 1.04 → 1.65 · 0.98 · 0.88 |
| Busiest markets (median) | ATL 1.03, DAL 1.00, CHI 1.03 → 0.88, 0.85, 0.88 | CHI 1.32, DAL 1.08, ATL 1.06 → 1.25, 1.01, 0.90 |
| Days 60+ spread, board ÷ own steady | 0.87 / 1.41 → 0.87 / 1.41 | 1.00 / 1.79 → 1.01 / 1.78 |
| Peak daily cleared rate, day 40 or earlier | 9.26 → 7.96 | 7.88 → 6.84 |

| Day 120 | Seed 1 | Seed 2 |
|---|---|---|
| Owner-operators active · median cash | 400 · 76.1k → 400 · 71.7k (−6%) | 398 · 40.0k → 394 · 40.3k (+1%) |
| Fleets · trucks · median cash | 120 · 460 · 123.5k → 120 · 462 · 120.5k | 120 · 450 · 98.3k → 120 · 452 · 93.1k |

- The seasons and the hot/loose spread are untouched: the factor is national and multiplicative.

## Side question: the owner's draw (labor.owner.drawStays)

There is no 120-day baseline in economy-player34.md or runs/. I ran an A/B on the same seeds instead
(`labor.owner.drawStays=false`).

| Day 120 | Off → on (live), seed 1 | Seed 2 |
|---|---|---|
| Owner-operators' median cash | 56.1k → 76.1k (+36%) | 30.6k → 40.0k (+30%) |
| Owner-operators active | 400 → 400 | 395 → 398 |
| Fleets' median cash | 128.5k → 123.5k (−4%) | 102.7k → 98.3k (−4%) |

## Not done

- No four-year check of the clamp (the supply path, the launch lock); a y4 batch should run before the restart.
- packages/config has no tests (vitest: "No test files found").
- I did not run engine.test.ts or assets.test.ts, which read the live levers.
- The lag in "clears near" comes from constants in freight.ts; that is for engineering.
- The ruleset version bump is the producer's.
- The probe is in the scratchpad: `boom/probe.mts`, `compare.mjs`.
