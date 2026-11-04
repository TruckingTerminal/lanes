# Intel (UX spec, draft 1, 2026-11-02; owner: UX)

Sprint 2, item 4, from the director's page (`specs/intel.md`), which owns the fields and the privacy rule. This
spec places the screens, orders them for a phone and names every control and state. Strings are the writer's
placeholders; figures are one example. The rule stands over every line below: **no figure from which live cash
can be derived** (no cash, net worth, FD balance, stake amount, loan or debt).

## The director's three questions

1. **Where it lives: More › Intel.** Agreed. Intel is visited, not lived in; its traffic comes through the
   entry points below, every one of which lands on a filtered list or a single card, never on the full list
   cold. More's order becomes: Iuliia, Help, Company, **Intel**, then the opened teasers. If QA's replay finds a
   player opening it daily from More, I'll come back with a case; a fifth target stays off the table.
2. **List, not table, on a phone, and on the laptop too.** A two-line row holds the four fields at 375 px
   without hub codes: codes are what the first look found strangers can't read. One component for both layouts.
3. **The player's own row** is pinned at the top as "How others see you", and their own card is the only one
   that says what each band costs them. Details under "Your own card".

## Entry points

| From | Lands on |
|---|---|
| More › Intel | the list, sorted by Miles, no filter |
| A company's name on a load card or the load sheet's Shipper group (S2, S3) | that company's card |
| A result card: "Lost to Red River Lines at 2.24/mi" (S5; the winner's name is new, a link) | the winner's card |
| The hub card's Who's here group: a new last line, "See who's here ›" (cut 2026-11-04: the first entry is locked to the hub choice, Jeff) | the list filtered to that hub |
| The brokerage teaser's action "See what brokers earned last month" | the list filtered to brokers, sorted by last month's revenue |
| A truck on the map, when the map can open one | its company's card |

A card opened from anywhere has a back arrow to where it came from, not to the list.

## The list

**Header:** "Intel · 583 companies" (the count under the current filters).

**Pinned row:** the player's own, labelled "How others see you", with the same two lines as every row plus
their safety and credit chips. Hidden for a page that is only watching.

**Filters,** one row of chips under the header, scrolling sideways if they must:
"My hub" · "Hub ▾" (opens the hub list) · "Players" · "Brokers". Chips combine; tapping an active chip clears
it. A search field above them: "Find a company", matching names as typed.

**Sort,** a three-way control: "Miles" (default) · "Trucks" · "Last month" (revenue). Descending; ties share a
rank.

**A row** (64 px, the whole row a target):
- line 1: rank, name, and the marks that apply: "#37 · Red River Lines" · a "Player" chip · a "Broker" chip
- line 2: "Dallas · 4 trucks · 12,400 Miles"
  (a broker: "Dallas · broker · credit B", since a broker runs no trucks and its credit is what a carrier reads)

Fifty rows, then **Show 50 more**. Rows for AI companies carry no mark; players carry "Player".

**States:**
- No match: "No brokers at Phoenix." (the filters in words) and **Clear filters**.
- The player has no company yet (hub choice): the list works; no pinned row.

## The card

Full sheet on a phone, the panel on a laptop. Label left, value right, in the director's order. Every figure is a
count, a band, Miles or last month's revenue; nothing else.

| # | Label | Value (example) | Notes |
|---|---|---|---|
| 1 | header | "Red River Lines" · "Player" · "Carrier" · "Home: Dallas" | |
| 2 | "Authority" | "4 months · active" | Suspended or revoked in red; "revoked once before" when true |
| 3 | "Running" | "4 trucks · 5 trailers (3 van, 2 reefer) · 3 drivers" | facilities as a further line when any: "1 yard · 1 truck stop" |
| 4 | "Miles this season" | "12,400 · #37 of 583" | a fold "Past seasons": "Season 1 · 48,000 · #12" |
| 5 | "Last month" | "Revenue 61,200 FD · 24 loads · 92% on time" | month-close snapshot; before one: "First month: no record yet" |
| 6 | "Safety" | band, and named alerts: "B · hours of service" | never undetected violations |
| 7 | "Insurance" | "Clean" / "Surcharged" / "Heavily surcharged" | the economy's cut-offs |
| 8 | "Credit" | "C (A is best, E worst)" | |
| 9 | brokers only | "Bonded · Strict vetting" | never the bond's amount |

**A broker's card** moves Credit to the line under the header, large, because a carrier reads it first:
"Credit B · Bonded · Strict vetting", then rows 2–7.

**Never on a card,** and engineering's test checks for each: cash, net worth, FD, stake, loans, what it owes,
undetected violations, the Back Lot's records, convictions.

**One action** at the foot of another company's card: "Loads from them" for a broker or player shipper with loads
on the board (opens the board filtered to that poster); nothing for a carrier.

## Your own card

The same rows, in the same order, under the title "How others see you". Under each band, one line in muted type
that only the owner sees, computed from the rules, never typed:
- Credit: "At C: truck loans 15% down at 0.30% a week, up to 3 at once" (`purchaseTerms`).
- Safety: "Strict-vetting brokers want 90 days of authority and 25 loads delivered" (`vettingBlock`'s reasons,
  for the next tier the company fails), or "No vetting tier blocks you" when none does.
- Insurance: "Your premium is 12% over a clean record's" (`insuranceSurcharge`).

Then one link: "Your full books ›" to More › Company, where the player's own net worth stays.

## The Company tab (the breach)

**Players in the world** and **Biggest companies** go from `Company.tsx`, with every Worth column. In their place,
one row: "Every company, by Miles ›" opening Intel. The player's own net worth stays on their own Company card,
labelled "Private: only you see this".

## Iuliia

One line on the first visit to Intel, the writer's (sprint rule: one line, never over a number). None on a card.

## Laptop

The same list and card in the 420 px panel; the card replaces the list, with the back arrow. No table.

## Questions

1. **Engineering:** can the result card name the winner? The cleared load carries its carrier; the client reads
   it after the round. If yes, S5's lost line gains the name and the link.
2. **Economy** (the director's): the safety and insurance band cut-offs, and the month-close snapshot.
