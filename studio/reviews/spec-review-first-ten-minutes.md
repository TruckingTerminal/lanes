# Review gate: the first ten minutes, UX spec draft 3 (the director, 2026-11-02)

Read against BIBLE.md draft 3 and Jeff's answers of 2026-11-02. I first reviewed the committed draft 2 and
found three sections that had to change (teasers back, the token on Money under a fold, the dispatcher's first
state specified). Draft 3, in the working tree, does all three. **Verdict: approved. Engineering may build.**
Two small corrections go into the build as written here; neither needs another draft.

## Two corrections, in the build

1. **The Logbook's trigger is the token's launch, not the first delivery.** The Logbook is the airdrop and
   Channel 19; opening it at the first delivery puts the token and crime in the first hour (minute eight in a
   test world). Jeff keeps the token surfaces on the beta screens, so the tab stays as a teaser, "Opens at the
   launch"; the airdrop estimate lives in Money's token fold until then. Same for Economy: its trigger is the
   first Monthly Economic Report, not game day 7; a faucets-and-sinks page is studio talk to a player.
2. **Tab names follow the writer's term sheet.** The term sheet says the tab is "Loads" and the thing on it is
   "the board"; draft 3 names the tab "Board" and Fleet "Truck". One word per term is the writer's rule; the
   writer settles the four labels before the strings are cut, and `TAB_NAME` takes whatever they settle. The
   "Truck → Trucks at the second truck" idea is good and the writer should keep it if "Truck" wins.

## Answers to the spec's questions

- **Teasers on a phone live in More, not the bar.** Agreed, and the bible is edited to say so: four targets
  in the bar, More holding Iuliia, Help, Company, the opened tabs and "Coming soon". Iuliia's line stays in the
  sheet's strip at all heights, so she is never more than one tap away; that is what makes four enough.
- **The overnight stop:** ship it as "planned", per engineering's answer (a read-only client forecast).

## Approved as written

- **The rule the spec assumes** (the dispatcher off until the first hand-placed bid, then `DEFAULT_ORDERS`;
  "Waiting at Dallas · the first load is your call"), and S9 telling the player plainly that the dispatcher is
  now on. The numbers are the economy designer's.
- **The teasers.** The card: two lines on what it is, "Opens {trigger}", one action that works, the road ahead;
  the row moving to the open list with a "New" dot on its day. That is the bible's rule met. The Back Lot's
  text stays "a later beta", no crime words.
- **Money as a ledger first**, Loans and "The token" as closed folds. Note for the writer: the ledger's
  "Standing" row is Miles ("272 Miles · your standing in the beta"), not loaded miles; loaded miles against total
  miles is a Truck-card number. The token fold keeps the Miles figure as today.
- **S0** (Chicago, Dallas, Phoenix on the ruling's condition; the picker gone), **S2 and S3** (profit chip,
  Nearest default, profitable book-nows first on the first visit, blocked loads dimmed with the reason from
  config, Book now at its true profit and red when negative, Bid primary when book-now loses), **S4 and S5**
  (the pinned bid, the ring, the dashed lane, the result card, Bid again, the line on live rounds), **S6**,
  **S7** (the pay line, "Yours" last), the walkthrough ticking only on the act log, Iuliia at 96 px with one or
  two sentences. All as the bible asks.

## Not blocking

- S0's default company name should come from the hub, not "Lone Star Freight" for a Chicago start.
- S2's header count should be the loads the player may take, not the count on the board.
