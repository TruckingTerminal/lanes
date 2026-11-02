# Intel (director's page for UX, sprint 2 item 4; 2026-11-03; owner: the director)

Jeff's rule (`DECISIONS.md`, 2026-11-02): every company's size and standing is visible to everyone, and live cash stays private. Financials show in bands, or a month behind. Intel is pillar 2 made visible: one world, and these are the people in it. It answers three questions a player actually has:
- Who runs out of my hub?
- Who is growing, and how?
- Whose freight is safe to haul?

Later it becomes the Back Lot's scouting screen. Nothing on it may hand the Back Lot its target.

## Row 1, the rule every public screen follows: no figure from which live cash can be derived

- **Out:** net worth, cash, and any figure that is cash plus or minus a value someone else can know or price. That includes worth, equity, "assets", balance less loans, and a stake amount next to a known total.
- **Size reads as:** trucks, trailers, drivers, facilities, and last month's revenue and hauls.
- **Applies everywhere:** Intel, the Company tab, rankings, the hub card's "Who's here", the feed, and any future leaderboard.
- **The test before shipping a public figure:** could someone combine it with what is public, or what the engine prices, to get today's cash? If so, it doesn't ship.
- **The breach today:** the Company tab's **Players in the world** and **Biggest companies** (`apps/web/src/ui/panels/Company.tsx`) show each company's exact worth in FD, live. Worth is cash plus the trucks' value, and the trucks are public and priced by the engine, so subtracting gives the cash. It is on the live world now.
- **The fix:** chrome only, in engineering's carry-over batch. Replace Worth with the size fields above and rank by Miles. A player's own net worth stays on their own private card.

**What "private" means for now.** Until the server sprint, every client replays the whole world and holds every company's cash. Private means not on any screen. It does not mean secret, and the red team should treat it that way. This is one more reason the Back Lot waits for the server.

## Who is on it

Every company: players and AI alike, carriers and brokers. The AI run on the same rules, so they belong on the same page. Players carry a mark. The player's own row is pinned at the top, labelled "how others see you".

## The list (one row per company, fits a phone)

In this order:
1. **Name**, with the player mark.
2. **Home hub.**
3. **Trucks running.**
4. **Miles this season, with rank.** Miles is the standing measure (term sheet).

Default sort: Miles. Filters: my hub, a hub, players only, brokers. Tapping a row opens the card.

## The card: fields and their order

| # | Field | Source | Shown as |
|---|---|---|---|
| 1 | Name, player or AI, carrier or broker, home hub | `Company` | Text |
| 2 | Authority: age and status | `authority.since`, `.status`, `.revocations` | "Authority 4 months · active". Suspended or revoked shows plainly, with "revoked once before" where true |
| 3 | Size: trucks running, trailers by type, drivers employed, facilities by kind | `operatingTrucks`, trailers, staff, businesses and facilities | Counts. Never a value |
| 4 | Miles: this season, rank, past seasons | `milesTotal`, `milesHistory` | Exact (it is earned in public) |
| 5 | Last month: revenue | **Not kept today**: engineering adds a month-close snapshot per company | Exact FD, a month behind (Jeff's "a month behind") |
| 6 | Last month: loads delivered, share on time | **Not kept today**, same snapshot (`delivered` and `onTime` are lifetime) | Count and percentage |
| 7 | Safety band | `safety.measures`, `.alerts`, `outOfService` | A band, plus the names of any alerts ("hours of service"). Never `hidden`: what nobody has found stays unknown |
| 8 | Insurance band | `insuranceSurcharge` | A band: clean, surcharged, heavily surcharged. Economy sets the cut-offs |
| 9 | Credit band | `creditBand` (A to E, already in the engine) | The letter. For a broker it is the first thing a carrier reads, so it moves up to row 2 on a broker's card |
| 10 | Brokers only: bonded, vetting required | the licence stake, `vetting` | "Bonded" with no amount, and Open, Standard or Strict |

**Never on the card:**
- Cash, net worth, FD balances, stake amounts, loans and what the company owes.
- Undetected violations, or the Back Lot's records.
- Criminal convictions. They are the Back Lot's to show, in a later beta.

The bond shows only as "bonded". It is a fixed 75,000, so the amount adds nothing but a wealth hint.

## Where it opens from (besides its own place)

- A carrier's or broker's name on a load card or a result card ("lost to …").
- Who's here on the first entry's hub card (`specs/first-ten-minutes.md`, S1): Intel filtered to that hub.
- A truck tapped on the map, once the map can do it.
- The brokerage teaser's working action, **See what brokers earned last month**, which opens the broker rows (`specs/brokerage-brief.md`).

## Questions for UX

1. **Where it lives on the four-item bar** (Truck, Board, Money, More). My lean: More → Intel. It is a reference screen, visited rather than lived in, and the entry points above carry most of the traffic. If UX finds that players go to it daily, the case for a better place is UX's to make. A fifth target is not on the table.
2. **List or table on a phone.** Four fields fit one row at 375 px only if the hub is a code ("DAL").
3. **How the player's own row reads.** "How others see you" may be the most useful part of the screen. It shows the player what their safety and credit bands cost them with brokers and shippers.

## Questions for economy and engineering

- The month-close snapshot (rows 5 and 6): a small engine change. Does it need a ruleset bump? It changes no rule, but it changes world state.
- Band cut-offs for safety and insurance, in the economy's words.
- The Company tab's worth columns, in the carry-over batch (row 1).
- Trailer and facility counts per company: confirm both are cheap to read for every company.

## Done means

- UX has placed it, and the spec has passed the gate.
- The worth columns are gone from the live world.
- QA has checked on a phone that no public screen shows a figure from which another company's live cash can be derived (row 1's test).
