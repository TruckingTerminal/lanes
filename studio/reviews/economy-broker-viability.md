# Economy: the AI brokers' viability under windows, the sizing (2026-11-13)

The producer asked: under the 0.25.0 bundle, size the two levers that could make the AI brokers viable without making
them safe. Jeff's aim is "cutthroat like real trucking": a well-run broker makes a thin positive margin and a careless
one still fails. The levers are the cover rule's sizes and the fall-off share. This is sizing only; nothing changes
without Jeff's word.

The runs are on the bundle at 5d196fb, in a scratch worktree (lanes-g19), with the AI brokers' books tapped by year and
persona:
- two-seed probes of four candidates;
- ten seeds with cap-off twins for the one that reads right.

The base equals the gate's bundle run field for field (seeds 1 and 7 checked), so its gate is the gate's.

## Verdict

**1. Leave the cover rule's sizes as they are (0.25 lost, 4 loads, 7 days).** Tightening the share to 0.15 or 0.10
cuts the brokers' volume by 10–25%, but leaves the share of brokered loads lost at 32–33% and the brokers' failures and
margins where they were. The losses are not concentrated at bad hubs. A brokered load posts at the broker's contract
less its margin, without the lost-load lift windows give a direct load, so it pays carriers less everywhere: 3.45 FD a
mile against 3.54.

**2. The fall-off share under windows: 10% (from 15%) is the size that meets the aim.**

| Ten seeds, the 0.25.0 bundle | Fall-off share 15% (today) | **10%** |
|---|---|---|
| AI brokers that fail, of 60 | 26.5 | **21.0** |
| … of which prudent (7% margin) | 20.0 (all of them) | **19.6** |
| AI brokers' margin after costs, years 1–4 | −11.1% / +3.0% / +2.2% / +3.5% | **−7.5% / +6.5% / +5.9% / +7.9%** |
| Their revenue, years 1–4 (M) | 29.1 / **5.9** / 62.9 / 67.2 | **39.1 / 42.7 / 70.6 / 68.2** |
| Four-year margin: greedy (12%) · random (6–12%) · prudent (7%) | +1.0% · +1.3% · −13.8% | **+4.8% · +5.2% · −9.9%** |
| The gate | 10 of 10; worst carriers 84·85 | **10 of 10; worst 81·80** |
| Band, year 4 | 0.888–0.917 | **0.881–0.909** |
| Owner-operators' · fleets' profit per truck-week | 1,735 · 1,654 | **1,717 (−1.0%) · 1,587 (−4.1%)** |

**What 10% gives:**
- **Well-run brokers make a thin positive margin.** The survivors earn 6–8% a year from year 2, against 2–3.5% today.
- **They no longer stall in year 2.** At 15% the whole AI broker layer nearly stops: its revenue falls from 29M to
  5.9M after the opening year's losses, and it restarts in year 3.
- **A careless broker still fails.** Every broker that prices at 7% goes under in the opening year either way, and 21
  of 60 fail over four years.
- **The cost falls on the fleets,** which earn 4.1% less a truck-week, at the edge of the seeds' spread. Brokered loads
  rise from 15% to 21% of all loads, and they pay carriers less a mile than direct freight. The carriers' share of what
  is paid falls from 0.947 to 0.934.
- **The floor stays clear of the lines.** The worst seed reads 81 · 80, against lines of 72 and 75.

**7.5% overshoots.** On two seeds the survivors earn 8–12% (not thin), and fleets' profit per truck-week falls 9% (1,514
against 1,670).

**3. Neither lever fixes what made the failures look like they rise every year. That is an engine rule, not a size.**

The prudent brokers stop trading in their first year: their revenue is 0 from year 2 at 15%, and 0.08M at 10%. But
they are not wound up. They keep paying the surety premium daily and the permits until their balance goes negative,
and only then are they liquidated: years 2–4 at 15%, mostly year 4 at 10%. Some are then liquidated again (8.9 repeats
a run in year 4 at 15%, and 2.7 at 10%).

So the "rising" liquidations by year are the formal ends, and second ends, of brokers that died in year 1. With such a
broker wound up when it stops trading, counted once, the failures read as what they are: the opening year, and nothing
after it.

There is also no broker entry. The AI broker layer can only shrink, from 60 to about 40 trading. If Jeff wants failures
"real but not rising" in the sense of a market that renews itself, a new AI broker replacing a failed one after some
months would keep the layer's size. That is a design question for the director and engineering.

## The two-seed probes (seeds 1–2, the bundle at 5d196fb)

| Seeds 1–2 | Base (0.25 · 15%) | Cover 0.15 | Cover 0.10 | Fall-off 10% | Fall-off 7.5% |
|---|---|---|---|---|---|
| AI brokers failed, of 60 | 25.0 | 23.5 | 26.0 | 20.5 | 16.0 |
| Margin after costs, years 1–4 | −11.1 / +0.2 / +2.3 / +3.3% | −11.4 / +4.7 / +1.8 / +3.5% | −12.1 / +4.2 / +0.8 / +2.6% | −7.2 / +7.3 / +6.1 / +8.2% | −5.4 / +8.6 / +8.6 / +11.2% |
| Brokered share of loads | 15.1% | 13.4% | 11.3% | 21.9% | 28.3% |
| Brokered loads lost at the close | 31.8% | 32.4% | 33.4% | 30.7% | 26.7% |
| Tenders held by the cover rule (thousands) | 200 | 248 | 252 | 279 | 296 |
| Owner-operators' · fleets' profit per truck-week | 1,753 · 1,670 | 1,739 · 1,600 | 1,738 · 1,678 | 1,741 · 1,554 | 1,729 · 1,514 |
| Cleared loads | 418,598 | 418,583 | 411,812 | 418,440 | 422,584 |

## The AI brokers' books (ten seeds)

**Failures by year, each broker counted at its first liquidation:**

| | Year 1 | Year 2 | Year 3 | Year 4 | Repeats (year 4) |
|---|---|---|---|---|---|
| 15%: prudent · random · greedy | 0.5 · 0.2 · 0.7 | 4.2 · 2.7 · 2.9 | 10.8 · 0 · 0 | 4.5 · 0 · 0 | 8.9 |
| 10%: prudent · random · greedy | 0.1 · 0 · 0 | 0.8 · 0.6 · 0.8 | 5.9 · 0 · 0 | 12.8 · 0 · 0 | 2.7 |

**Where an AI broker's money goes,** as a share of the NPC pay it bills, years 1–4:

| | 15% | 10% |
|---|---|---|
| Paid to carriers (repaying the factor's advance, plus direct pay) | 80% / 70% / 67% / 70% | 81% / 71% / 68% / 73% |
| Fall-off charges | 10% / 7% / 9% / 10% | 7% / 7% / 6% / 7% |
| Factoring fee · board fee | 3+3% / 5+3% / 5+3% / 4+3% | 3+3% / 5+3% / 4+3% / 4+3% |

The opening year is the loss.
- Brokers pay carriers 80% of what they bill, against 67–73% later: in the opening boom the urgency walk lifts more of
  their loads.
- On top of that sit the fall-off charges and 6% in fees.
- At 15% that leaves every persona under water in year 1 (−10% to −14%). At 10% it is −6% to −10%.
- The prudent broker's 7% margin cannot carry it at either size.

**The share lost does not change with the fall-off share.** About 32% of brokered loads go unhauled at the pickup's
close: 36% by year counted against loads billed. The fall-off charge per lost load is about 520 FD at 15% and about
350 FD at 10%. The charge changes what a lost load costs, not how many are lost.

## What a player brokerage would read from the market

A player's brokerage is never held by the cover rule, and its loads never walk (QA's S4). It reads the same board and
pays the same fall-off share.

- **At 15%, the trade looks barely worth it.**
  - A third of brokered loads go unhauled, and each costs its broker about 520 FD.
  - The AI brokers lose 10% in the opening year, stall through the second, and make 2–3.5% from year 3.
  - Any broker at a 7% margin dies in its first year.
- **At 10%, it reads as a hard trade that rewards pricing.**
  - The same third of loads go unhauled, at about 350 FD each.
  - The AI brokers lose 6–7% in the opening year and make 6–8% a year after it.
  - A 7% margin still kills, while 9–12% lives: a margin has to cover a lost load a third of the time.
- **The bot brokerages that run as a player's would** fail as often either way: 2.4 against 2.3 a run.

## If Jeff takes the 10%

- **The figure:** a windows-era fall-off share of 0.10. Engineering's choice is a new windows key read by `giveUp`
  with windows on, or the global `brokerRisk.fallOffShare`, which also moves the walk's reach line and the
  double-broker's charge. Under windows the reach line is inert (the brokers' fix pair), so the two differ only with
  windows off. Off windows, 15% stays.
- **It moves the gate's money,** so it needs the ten-seed pair with twins, as here: 10 of 10, worst carriers 81·80.
- **The broker wind-up and entry rule (point 3)** is a separate item for engineering and the director, if wanted.

## How it ran

- **The worktree:** a scratch worktree at 5d196fb (lanes-g19), from gated scripts. The probes ran 08:20–08:30 and the
  ten seeds 08:33–09:06.
- **The arms:** the bundle's keys, and `--set` for `windows.brokerMaxLostShare` or `brokerRisk.fallOffShare`.
- **The tap:** ledger flows of every AI broker (role broker, `broker:` persona) by year, persona and counterpart. Also
  their operating revenue and costs at each year's end, and each liquidation with its company and day.

Nothing in the shared checkout changed and nothing is staged.
