# Decisions (the producer's log for Jeff; newest first)

- 2026-11-02 — Jeff's answers to the bible's questions: (1) the pitch and the feeling stand for now, the feeling
  stated as "real accomplishment from your decisions and grinding"; (2) the token surfaces may stay on the beta
  screens for now, since nobody plays until the Mac mini server; (3) YES to the dispatcher idle for a one-truck
  company until the first hand-booked load (a rule change: the economy designer sizes it, then a ruleset bump and
  a restart with no players); (4) the tabs that matter come first and the rest stay visible as teasers, "coming
  soon" (this overrules the bible's position against locked teasers); (5) beta one's people come from Jeff's
  freight list, with crypto people if he can; (6) the theme picker goes for now; (7) the Back Lot teaser tab stays;
  (8) the end-of-session feeling: yes. Still open: the title cycle push.
- 2026-11-02 — Sprint 1: the first ten minutes, built on the test page (the server gates real players, so it runs
  in parallel as engineering's next design); the economy designer sizes the dispatcher rule and the first board.

- 2026-11-01 — The live world restarted on beta one: page version 37 (Iuliia, the parallax title, the Report
  button's store rule), world/meta version 21, seed 614203851, ruleset 0.19.1-phase0.30, no players.
- 2026-11-01 — The roles got their own sessions (director, UX, QA, writer, engineering; art already had one);
  models: Fable for the director and the writer, Opus for UX and engineering, Sonnet for QA; the plan is Pro, so
  roles run a few at a time.

- 2026-11-01 — Studio formed: eight roles, one point of contact (the producer), a weekly loop with a review
  gate; sprint 0 is the slop audit and the bible.
- 2026-11-01 — Beta one: the trucking sim opened in layers (businesses day 28, re-brokering day 91), crews off
  until the Back Lot leaves the simulator; ruleset 0.19.1; on the test page, not yet on the live world.
- 2026-11-01 — The team allocation 15% of the cap, six real months then four years linear; the tranche 40M.
- 2026-11-01 — Iuliia: Russian, classy, an executive, long flowing hair, brown eyes; drawn and on main.
- 2026-11-02 — The first bid by hand is on: a one-truck company's dispatcher waits until its owner bids or books
  once by hand (Jeff's yes; economy's v55-a found no cost the batch can see). Ruleset 0.19.2-phase0.31; the live
  world restarts with it on the next republish. Chicago's May board is the director's call (economy-first-board.md).
- 2026-11-02 — Jeff: the title screen is only a login screen with nice animations. The starting hub is chosen
  inside the world on first entry, where the player sees the map, the date, the freight and the hubs' numbers
  before starting; Iuliia guides everything once inside. S0 and S1 of the first-ten-minutes spec go to draft 4
  (director); engineering's step 3 reshaped to it.
- 2026-11-02 — Jeff, on the map: the clouds take too much of the screen and the other trucks are too faint and
  small to read; the weather becomes a hint, the AI trucks go to 80% and get a minimum dot size zoomed out so
  the interstates look busy, and the player's trucks stand out above both. Overrides draft 4's "AI carriers at
  35%". Engineering, with step 5.
- 2026-11-02 — Jeff: the recommended starter hubs are not a fixed best-on-average three; the first entry rings
  the hubs with the best freight for a new carrier at that moment of the game year, read live from the boards
  (the season measure), so Chicago is ringed in September and not in May. Replaces the director's fixed Dallas,
  Los Angeles, Phoenix (ruling 4), which stays as the tie-break and the fallback when the reading is not ready.
- 2026-11-02 — Jeff, factoring and quick pay: Iuliia explains both to an owner-operator about to buy a truck;
  the risk is real and they must be well capitalized. A factoring contract lasts three full game months and
  covers every truck in the fleet; the rate is a straight line by fleet size, 6% at one truck down to 1.5% at fifty,
  set at signing and re-read at each renewal.
  No pools for now: factoring and insurance are NPC, and their fees are sinks. Economy sizes it behind a
  switch; the writer words the step; engineering wires the contract into Getting paid after.
- 2026-11-02 — Director: Finance opens on the same trigger as the Dealer, when walkthrough step 9 ("Your first
  truck") becomes current, so Iuliia's explanation of factoring and quick pay never points at a locked tab.
  Engineering takes it into the step that wires Getting paid.
- 2026-11-02 — Jeff, factoring, amended: the carriers' rate floors at 2.5% at fifty trucks (linear from 6% at
  one). Brokers can factor their receivables too, at a flat 5% whatever the volume: a broker is a capital
  depot and does not scale with factoring. Both under the economy's switch; both fees refill the reserve.
- 2026-11-02 — Jeff: a public Intel tab, every company visible to everyone: trucks, drivers, authority age,
  home hub, Miles, the safety, insurance and credit bands, last month's revenue and hauls. Live cash stays
  private. The director writes the page for sprint 2.
- 2026-11-02 — Jeff: the title's head-on shot keeps the painting's lane (the truck comes on the right). The
  traffic pass goes a third round: vehicles must pass the camera at full size with wheels, bounce and lamps
  that read, headway kept in time so nothing overlaps at any depth, tumbleweeds off the road.
- 2026-11-02 — Jeff: a population dial. The loads-per-truck ratio stays within a band so the game always
  welcomes new players; the dial acts on the simulated carriers, never on freight, so it adds no faucet; the
  band is wide and the dial slow, so boom and bust cycles persist and prudent players win in the long run.
  Economy builds it behind a switch and sizes it with a join wave (v57) after factoring.
- 2026-11-02 — Jeff: a red team role (studio/roles/redteam.md) that tries to exploit, break and game the
  rules; it runs once a day while rules are changing, not on every push, and as the last step before any
  republish. First pass once factoring and the population dial are in, so one pass covers both.
- 2026-11-02 — Jeff: the pools come off the Finance tab for a long time; Finance holds Getting paid, credit and
  the staking discounts. Staking reworked: no stake gate on fleet or facility size (truck prices are the entry
  fee); a stake is a lock with a term, the discount set by the term and held for the term on purchases and the
  running costs it covers; leaving early forfeits a slash, a multiple of the discounts taken plus a base,
  burned. Economy builds it behind a switch.
- 2026-11-02 — Jeff: four tractor makes modelled on Freightliner, Volvo, Peterbilt and Kenworth under fictional
  names, with their own prices, economy, upkeep, breakdowns, driver appeal and depreciation; trailers unbranded,
  by type. A teaser for PvP on the Back Lot's coming-soon card. Iuliia speaks differently by tab and by button
  or card, humor allowed. All sprint 2; the director plans it after the gate.
- 2026-11-02 — Jeff: three truck makes, not four, one per tier: Keystone the workhorse, Meridian the economical
  highway truck, Ironwood the premium driver's favourite (the Peterbilt and Kenworth of it in one make).
  Westmark dropped. Names pending counsel's trademark search.
- 2026-11-02 — Jeff: the title's head-on shot keeps the painting's rig fixed in frame and moves the world
  past it in perspective, as the side view does; oncoming traffic sparse or none, nothing drawn as a still in
  motion. The approaching-vehicle work stops. Both shots 30 seconds.
- 2026-11-02 — Jeff: traffic drives in the correct lane in both title shots, on the right as in the USA; this
  supersedes "keep the painting as is": the head-on shot is mirrored, with the diner's sign redrawn to read
  forward.
