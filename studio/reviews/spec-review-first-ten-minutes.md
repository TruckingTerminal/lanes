# Review gate: the first ten minutes, UX spec draft 2 (the director, 2026-11-02)

Read against BIBLE.md draft 3 and Jeff's answers of 2026-11-02 (DECISIONS.md). **Verdict: not yet approved.**
Three sections must change for draft 3; everything else is approved as written. Draft 3 needs only those three
sections re-read, not another full review, and engineering may start on the approved parts now.

## Must change

1. **Teasers come back (S-layout, Part one's "Fate" column, "Where everything else lives").** The spec cuts "the
   locks" from the chrome, sends the Back Lot "out of the client" and the Logbook and Economy out or to wait.
   Jeff decided the opposite: the tabs that matter first, the rest visible as "coming soon" teasers, the Back Lot
   among them. The bible's rule for them: a teaser is never a dead tap; its card says what the layer is in one
   line, the day it opens as a date, one line from Iuliia, and one thing that works (the road ahead, or "tell us
   what you'd want here"); it sits after the live tabs, never among the first five on a phone; on its day it
   becomes the real tab in the same place. Four teasers: Business (day 28), Brokerage (day 91), the token layer
   (at launch), the Back Lot ("a later beta", no crime words). Laptop: dimmed segments after the five, each with
   its day. Phone: the five stay in the bottom nav; the teasers are a row of cards at the top of the Iuliia
   tab, which already holds the roadmap. Specify the card, its states (before the day, the day it opens) and
   its one action.

2. **The token stays on Money, under a fold (S8, Part one's Money row).** The spec removes the exchange,
   auction, airdrop, pools and deposits from the beta and the countdown from the chrome. Jeff: the token
   surfaces may stay for now, since nobody plays before the server. The bible's reading: off the first hour's
   path, not off the page. S8 opens on the ledger (Cash, Owed to you, This week's costs, Standing); below the
   Loans fold add one more, "The token" (the exchange card, the opening auction, the airdrop estimate, the
   launch countdown, as they are today). The deposit side of Equipment Finance still goes (bible, "Goes"). The
   countdown leaves the top strip, as the spec has it.

3. **The dispatcher's first state (S9, S2's "truck busy" state).** Jeff said yes to the rule, so draft 3
   specifies it instead of waiting: for a one-truck company "Bid for me while I'm away" starts off and the
   truck waits at home until the player's first hand-placed bid; S9 is where it turns on. Say what Fleet ›
   Dispatcher shows before that first bid (the switch off, Iuliia's line, nothing else), and what the strip's
   state line reads while the truck waits ("Truck 1 · Idle at Dallas · round 18:00" is right). The defaults in
   the three rows are the economy designer's to size; the spec names the fields, not the numbers.

## Approved as written, with notes

- **The five and the layout.** Fleet, Loads, Money, Company, Iuliia; the 900 px line; the 44 px strip; the sheet
  over the map; one segmented control on the laptop. Yes.
- **S0.** Three hub cards, one freight line and one carriers line each. Chicago, Dallas, Phoenix, on the ruling's
  condition (Memphis if Phoenix fails the first-board test). The theme picker gone: Jeff's answer.
- **S2 and S3.** The card with the profit chip; "Nearest" default; first visit sorts profitable book-nows first (a
  sort, not a plant: fine); blocked loads last, dimmed, with the reason; Book now at its true profit, red when
  negative, Bid primary when book-now loses. Matches the ruling on the first board. Keep the "Table" toggle
  for laptops. "Rates by hub" as a sub-screen of Loads: yes.
- **S4 and S5.** The pinned bid card, the ring, the lane dashed on the map, the result card with "Lost to
  2.24/mi · your bid 2.39 · your break-even 2.08" and Bid again. This is the feedback the bible asks for.
- **S6.** Ship the overnight stop as "planned", per engineering's answer (a read-only client forecast).
- **S7.** The pay line, one row each, "Yours" last. This is the bible's pay line.
- **Walkthrough.** Ticks only on the player's own act log; Iuliia's caption is the Do line with "More". Yes.
- **Staff and the Dealer folded into Fleet from their triggers; Finance into Money; Rates into Loads; Economy
  out of the client as the published report.** Yes.
- **Words.** Placeholders stay the writer's; the copy audit wins. "Bid" and "Book now", never "counter".

## Not blocking, for draft 3 if cheap

- S0's default company name should not be "Lone Star Freight" for a Chicago start; take it from the hub.
- S2's header count ("14") should be the count the player may take, not the count on the board.
- S8 "Standing": say Miles once in words ("272 Miles · your standing in the beta"), since the chrome lost it.
