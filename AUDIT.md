# LANES audit — 2026-10-28

Six read-only audits (core engine, the staff/safety/fraud/insurance systems, the AI bots and sim tools,
the web client and shared world, the data tables, and a simulation campaign), each finding verified against
the code before it was fixed. Config 0.9.1 → 0.9.2. Everything below marked **fixed** is in this commit and
covered by `packages/engine/test/audit.test.ts` where a unit test can catch it.

## Critical

| # | Finding | Status |
|---|---|---|
| C1 | **One malformed action could stop the shared world for everyone.** Nothing validated what a browser sent: a string or NaN amount, a negative bid percentage, a prototype key as a truck tier, or a broker margin over 100% reached the ledger or a bid score; `stepHour` then threw on every page that replayed the log, and a reload replayed the same throw. | **Fixed.** Every action is checked field by field before anything looks at it (`badInput` in actions.ts, `invalidOrders` in world.ts); the ledger rejects non-finite amounts and self-transfers; rates ≤ 0 never bid; broker margins are clamped; the live world catches an engine throw, stops, and says so (`broken`) instead of freezing; the render loop can't kill the clock; the pay box clamps its input. |
| C2 | **Home-hub crowding was cached on first use each day**, so a browser that drew the home card before a player joined computed different bid winners than one that didn't: a split world. | **Fixed.** Crowding is engine state recomputed at fixed points (each board round, the weekly yard bill); the UI only reads it. |
| C3 | **Backdated actions rewrite history** (a player can stamp an action at game minute 0). | Documented, not fixable without a server. Mitigations in place: the engine validates everything, a changed entry under a known sequence number now triggers a rebuild rather than being silently ignored. Owner-side kill switch and server-stamped times are the real fix (see Remaining). |

## High

| # | Finding | Status |
|---|---|---|
| H1 | Equipment Finance share price hit 0 after a full write-off; the next deposit minted infinite shares and NaN poisoned the ledger. | **Fixed:** a wiped pool starts over; NaN-safe withdraw. |
| H2 | An owner could sell a financed truck for 1 FD to an alt and have the loan shortfall written off against depositors, repeatedly. | **Fixed:** a sale's floor must cover the loan. |
| H3 | Transfers between companies counted as "spending", so two accounts trading a truck back and forth sheltered any amount from the season burn, the holding cost and the launch reset, and laundered locked FD. | **Fixed:** only outflows to sinks count. |
| H4 | Listed trucks paid nothing and a listing with no price step lived forever: free parking. | **Fixed:** a step is required, asks are capped at 2× new, listed trucks pay the idle fee and yard rent. |
| H5 | Cutting a driver's pay to 0.01 and restoring it in the same tick reset morale to maximum. Matching a rival's offer and cutting pay back kept the driver for free. Poaching cost nothing and the poached seat wasn't reserved. | **Fixed:** raises only lift morale above the most they've made lately, bounded both ways; a matched offer cut within 56 days sends the person packing; hiring away costs a two-week sign-on bonus, firing within a month costs severance, a promised seat is kept, a quit notice can't be overwritten. |
| H6 | Outlaw AI companies never stopped double brokering (the order survived reviews, revocations and bankruptcies), and greedy AI companies stripped their cash below the free working-capital line every week, then failed in every slump. Together these explained most of the liquidation spike. | **Fixed:** the re-posting order comes and goes with the persona's "scared" state (a bad rating, or a revocation in the past year); bots never cash out below 25,000 FD; small fleets sell when they lose money; unsold trucks aren't put straight back on the road and relisted. |
| H7 | Lease renewal never restored the writer flag, so a tab could hold the lease while telling the player it was busy. | **Fixed.** |
| H8 | "Open the live world" reseeded the world on a transient store error or a double click. | **Fixed:** it refuses if a world exists; a read error shows an error, not the button. |
| H9 | The kill-criteria report could not pass: it checked a 90–100% sink band while the stabilizer steers to 97–103%, and measured the cold-start ramp as supply growth. | **Fixed:** band from the mode, six-month warm-up, year-over-year from year 3, young companies and humans left out of the strategy table, pay-to-win buyers left out of the free path. |

## Medium

- **Fixed:** a crash on the way to a pickup "lost" cargo never loaded (cargo insurance paid out for goods still at the dock); the load now goes back on the board.
- **Fixed:** a totaled truck's loan stayed open forever, inflating the pool's value; it's written off.
- **Fixed:** used and repossessed trucks carried the previous owner's falsified logs, over-hours and defects to the buyer, who got fined for them; so did the dealer's replacement truck and a refiled authority.
- **Fixed:** a theft conviction jailed whoever happened to drive the truck at resolution, not the thief's driver.
- **Fixed:** a double-brokered load covered by the NPC fallback was fined on the whole upstream payment, not the spread.
- **Fixed:** the owner was stranded without a truck after the one they drove was sold, while a hire drove the new one; listing a truck now frees its crew, and auto-staff seats the owner over a hire.
- **Fixed:** auto-staff seated spare drivers on parked trucks first and hired for the idle ones; drivers on parked or listed trucks now count as unseated.
- **Fixed:** parking, unparking or withdrawing a listing reset the idle-fee clock.
- **Fixed:** self-hauled facility freight was booked as revenue (and lease share and profit tax were taken on money never received).
- **Fixed:** a liquidating company could keep bidding by hand and never be wound up; bidding, buying and borrowing are refused while liquidating, and a bankrupt sits out 14 days before the free-path restart.
- **Fixed:** `cancel_bid` had no ownership check; unknown action types returned nothing.
- **Fixed:** token launch and a season close on the same day burned the airdrop; the holding cost ignored `holdingCostAfterLaunch` with seasons on.
- **Fixed:** a crash left driven miles unsettled (billed to the next owner); a hot load of 500–550 miles fit one legal day and could be won by hand solo (minimum is now 700 miles, and hand bids check the team rule); weigh-station progress was wrong after an abandoned or crashed leg; the escrow account sat outside the money supply; the sim runner's config overrides never reached the lane network; `--set` without `=` crashed; compare.ts printed invented values for old runs; the persona diagnostic under-counted fines after a refile.
- **Fixed:** the insurance market stepped a fixed 3% a month and swung in 4-year cycles between its pins; it now steps in proportion to the loss-ratio gap within ×0.85–1.4. Dealer prices only ever rose (scarcity was measured against a share never reached); now ×0.85 is reachable. The crash rate was at the top of the real range and fatalities 1.5× high; recalibrated. Audit findings now raise the insurance surcharge. The profit-tax stabilizer was pinned at its 70% cap all run; widened to 80%.
- **Fixed (data):** weigh stations were matched to a flat straight line; they're now matched along the great circle, with a 5-mile end margin instead of a 2% one; Lake Park moved onto I-75; `dasin` lost precision near ±1; `datan2` added; the season table was cached per network without the config; the season curve stalled one day at year end.
- **Fixed (client):** a corrupt saved test world bricked the test build; guide cross-links didn't switch pages until focus left the panel; two tabs of one player could silently diverge after a takeover; player documents could grow without bound (100,000 floor orders); the guide's hardcoded numbers (crash surcharges, hot-load miles, the deadhead score) now come from the config.

## Economy after the fixes (10 seeds × 4 years, token on; `runs/compare-v16-a.md`)

| Measure | Before staff/safety (v13-f) | Last night (v15-d) | Now (v16-a) |
|---|---|---|---|
| Liquidations | 548 | 1,059 | **451** |
| Companies in debt at end | 107 | 194 | 110 |
| Owner-operator profit / truck-week | 620 | 590 | **631** |
| Owner-operator wealth | 45k | 39k | 42k |
| Fleet wealth | 139k | 154k | 147k |
| FD price at end | $0.0061 | $0.0070 | **$0.0078** |
| Free-path median days | 116 | 93 | **66** |
| Top strategy vs segment | 2.29× | 2.13× | 1.81× |
| Crashes (fatal) | 0 | 247 (11) | 188 (5) |

By persona (seed 1, 4 years): clean carriers fail 0.46 times each (was 1.13), cutters 0.5, outlaws 2.4 with 64
revocations among 58 companies and 114k FD in fines each. Cutters still end about 4% richer than clean carriers
(was 12–20%). Kill criteria: supply growth 10/10, strategy spread 10/10, free path 8/10; the quarterly sink band
still fails in the cold-start quarters of years 1–2 (83–94% against a 95% floor).

## Remaining (not fixed here)

1. **No server.** Any signed-in player can backdate an action and rewrite history for everyone, or write a
   different ruleset against the same log. Needs server-stamped times (or an owner-maintained "first seen"
   record) and an owner kill switch.
2. **Replay cost grows without bound**: every page replays from the seed; a year of history is minutes of CPU.
   Needs periodic owner-published snapshots.
3. **Weigh stations on 40% of lanes see no scale** because routes are straight lines across the Gulf, not
   corridors. The planned road network (interstates and US highways, tolls, weather by road class) fixes it.
4. **The wage index pins at its floor from year 2**: the driver pool stays slack. Entrants now stop at the
   floor and slack attrition is faster, but the index still ends at 0.92 on every seed.
5. **Cutters end slightly richer than clean carriers**; the sink band fails in cold-start quarters; the
   season close returns 25–30% of extra leases in one week (a crewless spike).
6. **Newcomer admission and population run in the agents package**, outside the action API (deterministic, but
   the engine should own them). Bots read `load.cargoValue`, which the UI doesn't show (AI-only theft, so moot).
7. **Dev tooling**: vitest 2.x carries six advisories (test tooling only; nothing ships); upgrade to 5.x.
