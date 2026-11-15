# Economy: AI broker entry by conditions, sized (a proposal for Jeff, 2026-11-15)

For the director's §3 (director-sprint-2026-11-15.md): new AI brokerages enter where brokered freight per trading
broker is high and survivors' margins are healthy, after a setup lag, never crowding out players. It replaces the
fixed-replacement study (economy-broker-entrants-2026-11-15.md).

**The setup:**
- 0.25.1's live profile (b8e3799), with a scratch build of the wind-up (economy-broker-windup-2026-11-15.md) and of
  entry by conditions, in a scratch worktree (lanes-g22);
- two seeds, four years;
- two settings, against the wind-up alone and the fixed replacement.

## The proposal

**Weekly, nationally** (tenders go to any AI broker, so the market is national):
- **The flow signal:** NPC tenders offered to brokers over the last 8 weeks, per trading broker. A trading broker is
  licensed, not dormant and not wound up, and **a player's trading brokerage counts too**. The signal is read against
  the same measure in the opening's weeks 5–12.
- **The margin signal:** the AI brokers' margin after costs over the last 13 weeks.

**The rule:**
- **When the flow runs over 1.5× the opening's and the margin over 5%,** one new AI brokerage is founded that week, at
  most one a week.
- **It opens 120 days later:** authority and bond, the director's "few game months".
- **Founded-but-not-open brokerages count as trading** in the flow signal, so a wave of entry can't overshoot while it
  waits.

**Why it never crowds out a player:** a player's brokerage counts in the denominator. Where players already supply the
brokered freight, the flow per broker stays under the threshold and no NPC enters.

**The entrant:**
- the opening's kit: the company starting grant and the 75,000 FD licence stake, a wallet drawn as the opening's;
- a persona from the three, the opening's vetting draw;
- new authority and a new name;
- no payment history, so shippers' credit preference starts it small.

**The faucet, inside the cap's budget.** Each entrant's capital is about 80,000 FD:
- about 3.6M over four years, against about 160M the cap releases (2%);
- year 3, the refill, is the most at about 2.9M; a settled year is about 0.4–0.9M.

"Inside the budget" means the grant draws on the emission's allocation, counted as released, not on
`faucet:starting_grant`, so the schedule's total stands. Engineering's detail: a tag such as `faucet:broker_entry`
drawn from the cap's account, counted in `emission.totals`.

**Visible:** brokerages founded, opened and wound up in the monthly report, as the director asks.

## What it does (seeds 1–2)

| Two seeds, four years | Wind-up alone | Fixed replacement, 60 days | **By conditions: 1.5× flow, 5% margin, 120-day lag** | By conditions: 1.25×, 3%, 90 days |
|---|---|---|---|---|
| AI brokers trading, end of years 1–4 | 39.5 / 21.5 / 21 / 21 | 52 / 59 / 60 / 60 | **39.5 / 31.5 / 60 / 65.5** | 39.5 / 43 / 72.5 / 80 |
| … licensed and trading, years 3–4 (from the signal) | about 21 | about 60 | **57–58 (seed 1) · 65–72 (seed 2)** | 70–74 · 82–83 |
| Entrants over four years (by year) | — | 44 (years 1–2) | **45 (0 / 10 / 30 / 5.5)** | 60 (0 / 21.5 / 31 / 7.5) |
| Entrants that fail again | — | 5 | **1** | 1.5 |
| AI brokers' margin, years 2–4 | +6.8 / +5.7 / +6.9% | +6.5 / +5.9 / +8.4% | **+7.3 / +6.2 / +7.8%** | +6.8 / +6.3 / +8.3% |
| Their revenue, years 1–4 (M) | 38 / 42 / 62 / 64 | 39 / 58 / 68 / 68 | **38 / 43 / 71 / 65** | 38 / 42 / 70 / 65 |
| Owner-operators' · fleets' profit per truck-week | 1,719 · 1,566 | 1,748 · 1,551 | **1,708 · 1,567** | 1,743 · 1,586 |
| Cleared loads · rate | 414,949 · 3.631 | 411,899 · 3.636 | **414,592 · 3.629** | 411,966 · 3.627 |
| Starting grants, years 2–4 (M) | 0.94 | 3.45 | **4.55** | 4.99 |

(Today, with no wind-up, about 27 brokers trade after the opening, and dormant ones restart through liquidation.)

**Reading it:**
- **At 1.5× and 5%, the market holds roughly its size.**
  - The opening's shake-out stands through year 2: the layer is thin while margins recover, so nobody enters a market
    still losing money.
  - Entrants come in year 3 and the layer is back near 60.
  - The flow signal then hovers at its threshold (1.0–1.5× the opening's), so entry starts and stops by itself.
- **At 1.25× and 3%, it overshoots** to 70–83 trading. Entry runs while margins are thin.
- **Entrants rarely fail,** because they arrive into a recovered market. The opening's prudent brokers failed in the
  boom; a prudent entrant in year 3 lives.
- **The market barely feels it:**
  - carriers' profit is within two seeds' noise of the wind-up alone;
  - the brokers' margins hold at 6–8%;
  - cleared loads and the rate are flat.
- **Against a fixed replacement,** conditions are slower in year 2 and settle at the same size. They correct
  themselves, as the director asked: a hollowed-out market draws entrants, and a crowded one starves them.

## The director's other question: does any other NPC population only shrink?

**Yes, the AI fleets.** From the base runs (0.25.1, two seeds):
- The 120 fleet companies hold their count only because a bankrupt one restarts. Their trucks fall from 468 to about
  338 over four years (−28%).
- No new fleet ever enters. The carriers' only entry is the newcomer flow (`token.newCompanies`: about 2 owner-operators
  a week, scaled by the token's price trend), which is hype-driven, not by conditions, and always a one-truck start.

**The population dial's entry side never fires under windows.** Its ceiling (1.25 loads posted per truck in service)
is never reached (0 days over), so in practice it only retires bots.

**Shippers and the rest don't shrink.** NPC shippers are demand, not companies. The NPC lessor's fleet grows (150 → 470
trucks). Drivers and dispatchers hold.

**So the same principle applies to fleets**, if the director wants it: fleet entry where freight per truck is high and
fleets' trailing margins are healthy, after a lag, starting small. It would also let the dial's entry side work. That
is a study for later, not part of this proposal.

## Caveats

- Two seeds; directions, not gate sizes. If Jeff takes it, the build gets a ten-seed pair with twins, with the wind-up.
- The scratch measures the flow as tenders offered to the AI brokers. The build should count the same tenders,
  `tenderToBroker`'s calls, from NPC shippers only.
- The opening's reference (weeks 5–12) is taken once per world. A live world restarted with a ruleset would take it
  anew, which is right for a fresh market.
