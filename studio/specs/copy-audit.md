# Copy audit: the first ten minutes (writer, draft 1, 2026-11-01)

Read: `apps/web/src/walkthrough.ts`, `ui/App.tsx`, the Fleet, Loads and Money panels, the feed and toasts (`main.tsx`, `logic.tsx`, the engine's `listener` calls), `guide/start.ts`, `guide/roadmap.ts`. Played the test page as a stranger: Blue Norther Freight, Dallas, to day 7.

Iuliia's voice is good: plain, dry, warm under it. The problem is everything around her. Her card speaks like a person; the chrome speaks like three others: a DAT screen, a tokenomics deck and the engineer's log. The rewrites bring the chrome to her register. Her lines need one cut. Numbers in rewrites are written `{config key}`: engineering reads them from `economy.config.ts`, never types them. Several strings type them by hand today, and the live page already disagrees with main (182,000 FD for a new rig). That is how it happens.

## Strings that break the register

| Where | Now | Why it jars | Rewrite |
|---|---|---|---|
| Tagline, `App.tsx:110` | One shared world on the real clock. Bid the board. Build the fleet. | Ad slogans; nobody in the game talks in fragments. | One shared world, on the real clock. You start with one leased truck. |
| Join card, `App.tsx:266` | …one NPC-leased Workhorse and dry van, 5,000 FD. The lessor takes 15% of every load. | "NPC" is our word, not a freight word. Numbers by hand. | Everyone starts the same way: one leased Workhorse with a dry van, `{company.startingGrantFd}` FD, and you driving. The lessor keeps `{costs.npcLeaseShareOfGross}` of every load. Go broke and you start again on a lease. |
| Join card, `App.tsx:275`; header `:535`, `:547` | Year 1–2 is the beta: FD is play money and you earn Miles… an airdrop… play dollars · Miles (airdrop points) · LAUNCH IN 727D | The token on the sign-up form and in the header; three names for FD in one line. | This is the beta. FD is the game's money; loaded miles are your standing. Header: "Miles: your standing", no countdown. |
| Hub table caption, `App.tsx:233` | Strong outbound means plenty of freight to reload on; weak means trucks pile up… (five lines) | Market theory on a form. One line per hub (UX). | Strong: freight waits for trucks. Weak: trucks wait for freight. Local first: the share of loads a hub's shippers hold for carriers based there. |
| Fleet card, `Fleet.tsx:116` | NPC lease (15% of gross) · Extra lease (15% of gross, 250 FD/wk minimum) | NPC, gross; numbers by hand. Iuliia says "the lessor keeps 15% of every load". | Leased: the lessor keeps `{npcLeaseShareOfGross}` of every load · Second lease: the same, at least `{lessorMinWeeklyFd}` FD a week |
| Fleet card, minute one | Idle at Dallas for 6 h · sat out 1 round | Thirty seconds in, the player is told they skipped a round. | Idle at Dallas · next round at `{boardRoundHours}` |
| Tired alert, `Fleet.tsx:68`; idle alert, `logic.tsx:187` | Fatigue raises crash odds (×1.23 now)… · …: No dry van loads within 150 mi of Dallas, the dispatcher's limit. | Brackets, a multiplier, a setting's name as a reason: the engineer's log. | A tired driver crashes more, drives slower and loses heart. · …: no dry-van loads within 150 mi of Dallas, as far as your dispatcher sends a truck empty. |
| Dispatcher card, `Fleet.tsx:262`, `:292` | Dispatcher (standing orders) · Re-post some won loads to other carriers before pickup | Bracketed title; a re-brokering rule on a one-truck owner's screen. | Your dispatcher. Hide the re-post row until brokerage opens. |
| Fleet card, `Fleet.tsx:225` | Steal the load · cargo 23.5k FD | Crime on the Fleet card, behind a config flag. | Cut from the beta build. |
| Board, `Loads.tsx:80`, column "DH-O" | DH-O max · (219) | A DAT abbreviation; Iuliia and the dispatcher card say "empty miles". | Empty miles, max · column "Empty" |
| Board footer, `Loads.tsx:187` | Or counter for more and wait: the poster takes the best counter within its max (lower asks…), or the cheapest above the max… | Counter, ask and bid for one thing; max and ceiling for one thing; sixty words. | Book now and the load is yours at once. Or bid and wait for the round: the poster takes the best bid under its ceiling, weighing price, on-time record and empty miles; a bid above the ceiling wins only if nobody bid under it. One bid per truck per round; yours replaces your dispatcher's. |
| Board, `Loads.tsx:195`; broker names | NPC shipper · Broker-59 | NPC again; brokers named like test fixtures. | Shipper. Brokers need names (a data task). |
| Money, `Money.tsx:35` | FD exchange · opens in 730 days … FD/USDC pool … burned … locked … Bid in the opening auction | A tokenomics deck on the Money tab at minute one. | Out of the beta's Money tab (director's call). If it stays: "Miles: your standing. What they become is announced when the token is." |
| Money, `Money.tsx:132` | Borrow up to 35% of a truck's value at 1% a week over 26 weeks. Miss two payments and the repo man takes the truck. Or deposit spare FD… | "Repo man" is a costume; numbers by hand; the deposit side is cut in the bible. | A loan on a truck you own: up to `{maxLoanToValue}` of its value, `{weeklyRate}` a week, over `{termWeeks}` weeks. Miss `{missedPaymentsToRepossess}` payments and the lender takes the truck. |
| Money `Money.tsx:128`; feed `main.tsx:90` | …the company is liquidated · Your company went into liquidation… restart on an NPC lease | Numbers by hand; liquidated, liquidation and "wound up" (`logic.tsx:101`) for one event. | `{insolvency.weeksInDebt}` weekly checks in a row more than `{insolvency.debtLimitFd}` FD under and the company is wound up. · The company is wound up: the trucks are sold, and you start again on a lease. |
| Feed, `main.tsx:80` | Won ICT→BNA, 703 mi at 2.58/mi | Airport codes and an arrow for a player who chose "Dallas"; silent on who bid. | Won Wichita to Nashville, 703 mi at 2.58/mi, your dispatcher's bid. |
| Feed, `main.tsx:81` | Delivered BNA→ABE: +1,885 FD, 177 after costs | The lessor's cut is invisible, so the gap reads as a bug. | Delivered Nashville to Allentown: 1,885 FD, of which 177 FD is yours after fuel, the road and the lessor's `{npcLeaseShareOfGross}`. |
| Guide, `start.ts:16`, `:20` | one NPC-leased Workhorse … First goal: save `{rig}` FD for your own Workhorse and dry van. | NPC; and it contradicts Iuliia, who says buy used with the deposit and a loan. | one leased Workhorse … First goal: your own truck. The used lot sells one for about a quarter of the `{rig}` FD a new rig costs; your lease deposit counts toward it and a purchase loan covers the rest. |
| Guide, `start.ts:23` | New authority is on probation… | "Authority" lands unexplained on page one. | Your operating authority, the licence to haul, is new: some brokers won't load you until it is `{vetting.standard.minAuthorityDays}` days old… |
| Roadmap, `roadmap.ts:16`, `:22`; `Walkthrough.tsx:115` | …tested in the simulator against bots… days of the ladder… on the drawing board… ends the farming season | Studio talk, then crypto slang. | LANES opens in layers. The beta runs the hauling game end to end from day one; the deeper layers open on published days, and the locked tabs say what each will be. · At the token's launch, Miles become the airdrop. |
| Roadmap, `roadmap.ts:18`, `:21` | theft in the corridors · The Back Lot… a fence and a chop shop… bounties, heat | Crime in the player guide, against Jeff's rule. | Cut "theft in the corridors". The Back Lot: "a later beta. We'll say what it is when it's ready." |
| Iuliia, `walkthrough.ts:62` | …standing beside me, holding nothing. Davai. | Her one Russian word: her Russianness is bearing, not vocabulary. | …holding nothing. Go on. |

Not copy, for the producer: the dispatcher bid and won before I opened the board, and the walkthrough ticked four steps I never did; cash fell from 5,000 to 4,700 at minute one with no line saying why; Iuliia promises "the Money tab shows what you're owed and the day it lands", and it has no such line.

## Terms: one word each

| Term | Seen as | Use |
|---|---|---|
| FD | FD, Freight Dollars, play money, play dollars, play $ | **FD**; spelled out once, in the glossary. Never "play money". |
| Miles | Miles, airdrop points, "points earned for hauling well" | **Miles**, capital M, defined once as "your standing in the beta". Never "points" or "airdrop" in the first hour. |
| hub | hub, market ("Dallas (DAL) market", "home-market edge") | **hub** for the place; "market" only for the freight market as a whole. |
| lane | the board row, contract lanes, the lines on the map | **lane** is origin to destination; the map's lines are **roads**. |
| round | round, bidding round, idle rounds, "counters clear" | **round**, named by its hour: "the 18:00 round"; "bids clear at". |
| lessor | lessor, NPC lease, NPC-leased, Extra lease | **the lessor** is who you lease from; the adjective is **leased**. Never "NPC" where a player reads. |
| authority | authority, new authority, stake, tier, licence | **your authority**, introduced once as "your operating authority, the licence to haul". **Licence** only for the broker licence. |
| bid | bid, counter, ask, recounter | **bid** for the player's offer; **Book now** for the posted rate. |
| ceiling | ceiling, poster's max, max | **ceiling**: Iuliia's word and the glossary's. |
| empty miles | empty miles, deadhead, DH-O | **empty miles**; "deadhead" in the glossary only. |
| the board | Load board, Loads tab, the board | The tab is **Loads**; the thing on it is **the board**. |
| wound up | liquidated, liquidation, wound up | **wound up**. |
| the AI | the AI, bots, NPC | **the AI** for every company that isn't a player. |

## Style sheet

**Voice.** One register, Iuliia's: plain, dry, warm underneath. Her card is the only place she jokes. The chrome (labels, buttons, toasts, the feed) is her clipboard: short, factual, no exclamation marks. The Guide is her handbook: plain, complete, no slang, no studio talk (simulator, bots, ladder, store). A freight word beats a game word; a plain word beats a freight word.

**Person.** The player is **you**, the company **your company**, the dispatcher **your dispatcher**. Iuliia is **I** only in the walkthrough. **We** is the studio, only on the feedback page. Never "the player" or "the user".

**Tense.** Rules in the present ("bids clear at 18:00"). The feed in the past ("Won", "Delivered"). Promises only on the road ahead, as "opens on day N".

**Numbers.** Every number comes from the config through a formatter; none is typed into a string. Money: thousands separated, unit after, "1,885 FD"; no "k" in a sentence. Rates: two decimals and "/mi". Percentages whole. Distance: "703 mi" on cards, "703 miles" in Iuliia's sentences. Time "18:00", dates "Mon Jan 4". No multipliers, no bracketed figures, no "+" before income.

**Capitalisation.** Sentence case everywhere, buttons and headings included: "Find loads", "Book now". Proper nouns: the tabs, FD, Miles, Workhorse, Highway Pro, Flagship, the Back Lot, LANES. Lower case: dry van, reefer, break-even, hub, lane, round, lessor, authority. Hubs by city in prose, code only in tables. No ALL CAPS in a string; the stylesheet does that.

**Punctuation.** Full stops on sentences, none on labels. Colons and commas; no em dashes (two engine notices have them). "To" between places in prose; the arrow only in the board's Lane column. The middle dot only between facts on one line of a card.
