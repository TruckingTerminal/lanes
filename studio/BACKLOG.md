# Backlog (the producer's; Jeff sets the order)

## Sprint 0 (2026-11-02): the slop audit and the bible
- QA: play the test page as two personas, phone and laptop; `playtests/2026-11-02-slop-audit.md`.
- UX: the screen audit and the first-ten-minutes proposal; `specs/first-ten-minutes.md`.
- Director: bible draft 1 from the existing docs and Jeff's words, with the cut list and the questions; `BIBLE.md`.
- Art: a style note on what in the client fights the pixel art; `reviews/art-style-note.md`.

## Next (in Jeff's order, to confirm)
- The first ten minutes, built: cut tabs, one voice, feedback on every action.
- The authoritative server with accounts by email (engineering, a sprint of its own).
- A Discord for the beta; the gauges dashboard.
- The live world's restart on beta one and the republish with Iuliia and the report rule.

## Slop to fix (Jeff's list, from playing the test page, 2026-11-02)
- **Iuliia has three arms** in the waving portrait (a hand on the folder, a raised hand, and a third). Every pose
  and mood gets an anatomy pass. Art.
- **Her animations loop** and read as loops. Idle moments (a blink, a breath, the hair, a nod, the pen) on a seeded
  schedule that never repeats on a cycle, the way the title now plays. Art draws, engineering wires.
- **The login screen on a phone** shows the title as a band at the top over black instead of full screen with
  the one button at the bottom. Engineering, with step 6.
- The test build's speed labels ("1×" reads as the real pace). Engineering, with step 8.
- **The title's traffic** (both shots): cars drive both ways in one lane into each other; the other vehicles
  are one still image each; trains overlap each other and the diner. Lane discipline, every vehicle animated,
  spacing and footprint rules, a real speed-limit sign. Art.
- **The logo's two blues**: the E and S of LANES and "Terminal" are a darker navy in the logo file itself; one
  blue per face. Art, first.
- **The map's trucks are box trucks**: the rig sprites (van, reefer, flatbed) draw a cab with a box flush behind
  it; redraw as tractor-trailers at map scale. Art, before the title traffic.

## Decided (Jeff, 2026-11-02): a public Intel tab, live cash private
Every company's size and standing, visible to everyone: trucks, drivers, authority age, home hub, Miles, the
safety and insurance bands, the credit band, last month's revenue and hauls. Live cash stays private (it is
the Back Lot's target and a defense); financials in bands or a month behind. The director writes the page for
sprint 2.

## Sprint 2 candidates (2026-11-02)
- **The brokerage chrome.** QA's broker pass: after day 91 the client offers only a re-post button and a
  dispatcher rule; the engine's licence, stake, surety, payment trail, the bond cap and the broker's flat 5%
  factoring have no screens. The live world reaches day 91 about 23 real days after the restart. Director and
  UX spec it; engineering builds it. 13 findings in playtests/2026-11-02-sprint1-replay.md, part two.
- **The Intel tab** (decided above).
- **Getting paid**: the factoring contract and quick pay on Finance, once the economy's switch lands.
- **The map at Fit on a phone**: grey bands above and below the country; paint the world beyond the map's edge
  per season (art) and draw it behind the map (engineering). City names at Fit are huge and cluttered: no
  labels until zoomed in enough, except a small name under the three ringed starter hubs on the first entry.
- **The red badge in the strip does nothing.** A tap opens the tab that needs attention, scrolls to the card,
  and the card carries its fix; more than one thing waiting opens a short list. Iuliia's arrival line also
  outlives the first booking. Engineering, this sprint.

## The server sprint (from the red team's first pass, 2026-11-03)
Three holes only an authoritative server closes: Sybil airdrop farming (N accounts, N allocations; a
verified login with a same-owner check gating the bridge per person); logbook volume milestones washed between
two owned wallets (an arm's-length rule on the milestones; until then weight delivered-on-time and tenure);
a modified client rewriting its own action log (the server stamps each action's minute, keeps the log
append-only, binds writes to an identity). The shared world is only as permanent as the players' own logs until
then. Report: studio/reviews/redteam-2026-11-03.md.

## Itinerary from the 2026-11-07 reset (the producer, 2026-11-04; Jeff's order)

In the order we do them. Rules change only with a ruleset bump and a live restart; the live world is on 0.23.0.

1. **Emission cap, retuned** (economy). The cap is built and off (`token.emission`, `studio/reviews/economy-emission.md`). Retune: a budget drawdown cuts the volume NPC shippers post before it cuts rates; the rate multiplier floors near break-even (~0.8, not 0.5); the lessor's pay counts against the budget; first-month budget 36M as the next candidate. Targets: sinks 90–100% of faucets every quarter; prudent owner-operators' median cash at day 120 no lower than 70% of before.
2. **Option B** (economy + engineering). Purchase-loan rates that rise with debt-to-equity and a bust covenant, behind a switch, on in the live levers. Target: the prudent rule bot's median cash at day 120 at least 1.5× the greedy one's, and more greedy companies wound up.
3. **The launch gate.** Ten seeds, four years, cap and cap-off twin per seed (twenty sims). As Jeff approved on 2026-11-08
   (DECISIONS.md): the band is the corrected ratio over the trailing four quarters in [0.85, 1.00] from year three, the
   check on the rules; the cap is checked by floors against the twin at the ends of years 3 and 4 (carriers and cleared
   loads at or above 75% of the twin's; debt in FD at or under 7.5% of FD held) and a cold-start line (month 1 commits at
   most 110% of its budget); supply, spread and free path as before; the first truck reported, never gated
   (apps/sim/src/gate.ts). Before the ten seeds: the volume-dial clause (the dial follows the rules while the cap is slack,
   holds while it binds), the red team's three fixes (the rate lever on brokered and contract pay, the carry reset at
   launch, facility sales drawn on the budget), the subsidy re-run, and Jeff's schedule call (a fixed 5M a month, or
   supply that follows activity). Then the red team's review, ruleset 0.24.0 and a live restart.
4. **Delivery windows** (engineering, a sprint; Jeff, 2026-11-04). Every load gets a ready date and a hard latest delivery date; NPC brokers post with lead time (mostly 0–2 days out, some longer); a truck can book a load ahead and the dispatcher plans two loads deep within hours of service; the board sorts by pickup day; a load nobody takes by its deadline is a lost shipment and a claim for the poster, never a free re-post; the urgency premium applies only once slack is gone, capped by the ceiling as now.
5. **"Usually clears near" in week one** (engineering): DONE 2026-11-08 (cf4d270): `freight.clearsNear.halfLifeDays`, 0 by default, 1 recommended in the live levers at 0.24.0; sim-neutral (no bot reads it).
6. **The client queue** (engineering): DONE 2026-11-08 (8f2df11, 93bbf2f, 800f96f; the books' rows af61e8b, ec6a824): R9, R10, R21's rest, R22, R24, the draw and hold lines, the seed pin, the month report with every posting on a named row (crime's excepted, by rule). Not built: month.rank, month.vsLast, a contract-loads row, copy-player3's weekly draw row.
7. **The writer's review** (in progress 2026-11-08): engineering's draft copy from the client queue and the month report (NEEDS, DEBT.badge, MONTH and its new rows, EXPLAIN month.* and news.*, NEWS, MOVE and move.cost, WALL, RETURN, the Economy panel's advance label, the Fees row's name), then Iuliia's intro beats and the first-load beats (copy.ts FIRST_ENTRY, TUTORIAL), walkthrough step 1's new line, the company-name word lists (companyNames.ts), and the diaries batch's draft lines (debt, hours, dock, detention, staking). The bible's week-one line is the director's.
8. **QA replays** on the test page (in progress 2026-11-08; the list in the shared notes, producer-qa-replays-2026-11-08.md): the client queue and the month report first, then detention and the dock warning, lost bids from the table, the quit notice and the hire form, the debt figure (the "0 of 4 at −28k" case is unreproduced), the phone layout fixes, the tutorial lock.
9. **Player diaries** of the five personas on the live world once it is on 0.24.0.
10. **Economy follow-ups**: FD in circulation by year three (+64% against 0.20.2), shipper defaults up, detention's sizes, the levels band and Jeff's levels call, the four-year sizing, detention/weights/hazmat/tolls.
11. **Later**: the server sprint, the legal opinion and the trademark search, the brokerage items, the Back Lot. From the
    red team's cap pass (2026-11-08): when facilities open to players, scale facility output and the 60% hub-share cap by
    the cap's volume lever (today both read pre-lever demand, so at the volume floor facilities post 60% of a hub against
    NPC spot's 20%); when the Back Lot switches on under the cap, the fence's pay (faucet:fence, about 1.1× a brokered
    van's bill) must draw on the budget or its own. For a permanent world: a way for rule and lever changes to take effect
    at a game day without a restart, replay-safe (the live levers freeze once players arrive).
