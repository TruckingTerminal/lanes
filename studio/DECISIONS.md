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
- 2026-11-02 — Correction (the producer misread Jeff): the head-on shot is NOT mirrored; the painting's
  orientation and lane were right. The side view's rig faces right in the bottom lane, oncoming traffic in the
  top lane moving left, as it was. The fix the head-on shot needed was the roadside moving with the road.
- 2026-11-02 — Jeff ("go with your recommendation for all 3"): (1) the live world is republished now from main
  with the factoring contract and the population dial switched on (ruleset 0.20.0-phase0.33, live.ts; demand no
  longer scales with the carrier count) and the lock discounts off until a four-year batch has run; no players,
  so the restart costs nothing. (2) Prudent-versus-greedy: option A first, the conservative bot made a prudent
  businessman rather than a timid one, then B (loan rates by leverage and a bust covenant, behind a switch) only
  if the pair still shows the greedy bot ahead. (3) The Back Lot card takes the director's softer line: player
  against player, the gate and the cameras stay; the hiring and the temptation go.
- 2026-11-02 — Jeff (a Staff screenshot: two driver faces for the whole roster, "Tanya Mills" on the man's,
  "Earl Kowalski" on the woman's): new driver portraits, a set of them, and men must have men's names and women
  women's names, the portrait matching. Art paints eight of each look; engineering splits the name list by look
  and stores the look on the person, no replay change.
- 2026-11-02 — Jeff, on the broker path: "Brokerages and carriers should be different companies. Each player can
  have 1 of each at most." So a player's brokerage is a second company formed as a broker, not a desk inside the
  carrier; one carrier and one brokerage per player. The director writes the rule brief (forming it, the bond and
  licence at day 91, the two companies under one login, self-dealing between a player's own two companies, Intel
  and the ladder), the economy sizes it after the prudence pair, then UX, the writer and engineering; a ruleset
  bump and a restart while the world has no players.
- 2026-11-02 — Jeff, two rules for the brokerage: (1) a carrier with a brokerage arm may broker the loads a
  shipper tenders DIRECTLY to it (never a load it took off the board), with every brokerage requirement standing,
  the bond first; (2) a player's brokerage that receives direct shipper freight may tender it straight to the
  player's own carrier without posting it on the board. This replaces the brief's "own carrier only through the
  board". Producer's guard, to the economy: the hauler's pay on such a tender stays inside the lane's band, so the
  tender channel can't move money untaxed; a load counts once per person. Jeff asks whether the two companies may
  transfer FD to each other and whether to tax it: the producer recommends yes, both ways, as the owner's capital
  (equity, never revenue), guarded, with a 1% fee to the reserve; Jeff to confirm the fee.
- 2026-11-02 — Jeff: FD transfers between a player's own carrier and brokerage are allowed both ways, as the
  owner's capital (equity, never revenue), guarded, with a fee of 3% to the reserve ("higher than 1%; let's do
  3%"): `brokerage.transferFeePct` 0.03.
- 2026-11-02 — Jeff ("go with your recommendation for both"): (1) the hoarding tax stays, but on hoards, not
  cushions: the Reserve, a sheltered account up to thirteen weeks of the company's own spending, no fee, no
  yield, counted toward credit, withdrawable any time with a one-day settle; above the cap the season burn and
  the holding cost apply as today; the economy builds it behind a switch, sizes it, and measures running the
  weekly holding cost in both phases in place of the year-end burn (conditional on the sink-to-faucet target
  holding). (2) Step 9 keeps the rule: no easier first truck; the step reads the exact gap from the Dealer and
  advances when either route opens; the economy checks the used lot's restock cadence so a lessor rarely waits
  more than a game week.
- 2026-11-02 — Jeff: "I need to make sure that Iuliia is guiding people every step of the way. As this is a true
  sim and very complex." A standing rule for every screen and every stage: the player is never without Iuliia's
  next step and an explanation one tap away. The director writes the guidance spec (the path through the first
  month, the first truck, the first hire, day 28, day 91, the first bust; help on every figure; a "What now?"
  prompt), UX the surface, the writer the lines, engineering the wiring.
- 2026-11-03 — Jeff: (1) the live world restarts once, later, carrying ruleset 0.20.1 (the deposit fix) and the
  used lot's levers (usedMarket.npcLot.perWeek 60, stock 120) once the lot's four-year check passes; (2) the
  prudent persona (option A) stays and option B (loan rates by leverage, the bust covenant) stays off, per the
  economy's pair: the greedy fleets' lead is outside money, not debt; (3) double brokering closes to player
  carriers in the rules with the brokerage bump, not only in the chrome; (4) the Mac mini as the studio's batch box
  and the beta's hosting are for later.
- 2026-11-02 — Jeff: "Add cashing open invoices definitely. If a carrier needs it now, he needs it NOW. Waiting
  would cause them to go bust regardless of the contract." So an open invoice can be cashed now: under a
  factoring contract at the contract rate plus an aging surcharge; without one at a spot rate, the economy to
  size both behind a switch; the fee to the reserve. Iuliia's collect advice offers it first when it exists. The
  economy sizes it, the red team probes it, UX puts "Cash it now" on the invoice rows, the writer rewrites the
  collect lines, engineering builds it with the brokerage bump.
- 2026-11-02 — Jeff ("Let's do which you think is best", after the players' market finding): (1) the market fix
  goes ahead of the brokerage: the next restart carries the market rules (R17 a ceiling is a ceiling; R11
  book-now between the clearing rate and the ceiling, rate levels in a band a trucker recognises, booms and
  slumps paced and announced, a minimum charge on short loads; R16 the pay floor; R12's hours values) and the
  before-restart chrome; the brokerage switches on in the same restart only if its build is QA-clean by then,
  otherwise in the next free restart before live day 91. (2) Both premiums halve: the surety premium for brokers
  to 1–6%, the credit premium's ceiling to 10%. (3) R1 and its fleet-start extension: the dispatcher stays off
  after the first hand-booked load until the player switches it on, a fleet start meets the same first decision,
  and the default bid anchors to "usually clears near" with break-even as the floor. (4) R4: no lit dollar button
  on the first month's screens; FD is the button and the dollar price is text; the $900 yard moves under the
  token fold. (5) R8 for players only, as the economy sized it: auto-staff starts off, and on it never hires
  without four weeks of the wage in cash. (6) The compliance page's 15-hour day and 56 mph "always" options stay
  only if the same bump gives them R18's teeth (fines that scale with the gain, out-of-service days, audits and
  a rating); otherwise they come off the screen until it does. The producer decided all six on Jeff's word; any
  can be reversed before the restart.
