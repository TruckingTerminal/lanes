# Play diary: the middleman

- **Who I was:** someone who wants money without driving: a brokerage as early as the game allows, margins, tenders,
  and any business the moment I can afford it.
- **Build:** lanes-play `87864b2` (Deploy c8c67db), version.json `{"build":"c8c67db"}`, ruleset 0.24.0-phase0.41.
- **Screen and speed:** laptop, 1100 × 700. "Day in 2 s" between decisions.
- **How long:** about 45 real minutes, Thu Jan 11 to ~Thu May 3, Year 1 (game day ~112).
- **Where I ended:** Peachtree Freight Exchange, Atlanta, a small fleet of two owned trucks with one hired driver
  (Ngozi Ortiz). Plus a brokerage, "Peachtree Freight Exchange Logis" (the name was cut off, below). The brokerage holds a
  75,000 FD bond, has −17,358 FD in cash, about 40,000 FD owed to it on net-30, and is at "−19,073 FD margin this
  month". The carrier was left with about 3,000 FD after funding it.
- **Fresh world:** REPLACE IT from the title. Nothing carried over.
- **Screenshots:** in [play-2026-11-10-middleman/](play-2026-11-10-middleman/).

## The diary

**Day 1, Atlanta.** "10 loads posted last round · 2.50/mi average · 1.0 loads per truck · Reload: hard · Shippers hold 66% of
van loads for locals first · Security: risky". It's the crossroads of the Southeast, so a broker's town. Small fleet.
What now? → a load at 2.71/mi, booked. Hired Ngozi Ortiz for the reefer. This time a confirm came first ("Hire Ngozi
Ortiz? 1,960 FD a week … That's more than your company kept last week"); in the borrower's session it didn't. Dispatcher
on, "Day in 2 s".

**Day 26, businesses open.** Cash 910 FD (the fleet bills on net-30). Business lists: small yard 83.2k + 30k bond, a shop
110.9k + 40k bond and 2,000 a week, a fuel station 277.3k + 80k, a dealership 207.9k + 50k ("Buys its share of the
factory's monthly allocation at 85% of list (half of it burned)"), and truck stops on the interstates at 434–490k +
50k. "Prices follow the freight rate index (now 1.39×); half of every price is burned." Nothing is within reach of a
two-truck company in month one, which is probably right. The cheapest business is ~150k with its bond.

**Day 26, "See what brokers earned last month".** The Brokerage teaser's button opens Intel → Brokers. Every row reads "#1
· … Broker", dozens of them all ranked #1, and none shows what anyone earned
([01](play-2026-11-10-middleman/01-every-broker-is-number-1.jpg)). The button promises earnings and shows a list of
names.

**Day 26–82.** The trucks earned. Cash 68,071 on ~Mar 16, 99,577 on ~Apr 1. Invoices kept saying "Due Feb 29".

**Day 84 (Apr 4), starting the brokerage.** It's three steps.
- Step 1: the name, prefilled "Peachtree Freight Exchange Logis", cut mid-word ("Logis"), "Fixed for the brokerage's
  life" ([03](play-2026-11-10-middleman/03-start-brokerage-step1.jpg)).
- Step 2 is a model of a cost screen: "Licence · 300 FD a season · Bond · 75,000 FD · held, not spent … Surety · about
  2,250 FD a year … Beta bond: it's burned at the token's launch, like every beta stake. … Fee 3% · 2,709 FD ·
  Peachtree Freight Exchange's cash after · 3,189 FD". The default moves 90,300 FD and leaves the carrier with 3,189.
- I typed −50000 into the amount. The field went to "0", and from then on it took no typing at all: not digits, not
  select-all, not key by key. Back and Next didn't reset it. Under it: "Peachtree Freight Exchange Logis' cash after ·
  −300 FD, 75,000 of it the bond" and "Not enough for the bond yet"
  ([02](play-2026-11-10-middleman/02-transfer-field-stuck-at-0.jpg)).
- Only a page reload (two and a half minutes of "Loading your world…" at day 84, though my browser pane was hidden and
  probably throttled) brought back 90,300. After the reload the field still ignored typing; it stayed at 90,300. So I
  could only move the default.
- Step 3: "YOUR MARGIN: 5% OF EACH LOAD" (allowed 0–90), "OPEN LOADS, AT MOST: 20", vetting Open/Standard/Strict. I
  set 90%. No warning.

**Day 84, open.** The broker has its own bar (Book · Carriers · Money · More) and a company switcher top left. "You're in
Peachtree Freight Exchange Logis now. Your carrier is one tap away, top left." Cash shows 15,000 FD (the 75k bond held
apart). The More page still offers "Start a brokerage" above my existing one.

**Day 84–90, the 90% margin.** Shippers offered loads ("Shipper pays 1,934 FD · You'd post at 193 (your 90% margin) · Board
fee 58"). The standing order posted them at 0.30–0.53/mi. Nobody took them. "No carrier took load #52871 in 11 rounds
and the shipper gave up: a 184 FD fall-off charge" ×8 and more. "−7,478 FD margin this month" in six days. Fair
enough as a lesson, but at step 3 the game let me set 90% without a word about who'd haul at a tenth of the rate.

**Day 90, the carrier stalled.** While I sat in the brokerage view for six days, the carrier's log said "Truck 1 has been
idle 4 d 13 h at Atlanta: The dispatcher is off, so nobody bids for this truck while you're away." When I switched
back to the carrier, its dispatcher box was ticked, and the truck was booked within the hour. It looks as if the
carrier's dispatcher only runs while the carrier is the company on screen. Seen once; I didn't repeat it. The
carrier's log is also full of the brokerage's fall-off lines.

**Day 90, finding the margin.** The standing margin isn't on Book or More. It's under the Carriers tab ("Standing order
saved."). I dropped it to 10%.

**Day 90–106, at 10%.** Loads moved. One line: "Brenham → El Paso · Taken by D. Coburn Trucking LLC at 2.76/mi · Shipper
1,964 · carrier 1,964 · fee 59 · yours −59 FD". The carrier got the whole shipper price at a 10% margin, and I paid
the board fee. Others paid properly ("Shipper 4,248 · carrier 3,826 · fee 127 · yours 295 FD"). April ended
"−19,073 FD margin this month" ([05](play-2026-11-10-middleman/05-brokerage-margin-negative.jpg)). Every card on the
board also repeats "Peachtree Freight Exchange has no free truck in reach of the pickup" under a TENDER button.

**Day 112.** Brokerage cash −17,358 FD. It pays carriers on delivery and collects from shippers on net-30, so it bleeds
cash while it grows, like the fleet does. Its CASH IT NOW fees run about 10% (195 FD on 1,934). The decision log says
brokers factor at a flat 5%; this may be the spot rate rather than a contract, but a broker would expect 5%.

## Holes and bugs

| # | What I did | What I expected | What happened | Repeated? | How bad for a stranger |
|---|---|---|---|---|---|
| 1 | Typed −50000 into the brokerage transfer field | A refusal | Field stuck at 0 and accepts no input; Back/Next don't reset it; only a reload | Several inputs, one session | High: the one way to fund a brokerage jams |
| 2 | After the reload, typed 80000 into the same field | 80,000 | Field ignores typing; only the default 90,300 can be moved (leaves the carrier 3,189 FD) | Twice | High |
| 3 | Sat in the brokerage view 6 days | The carrier keeps working | "Truck 1 has been idle 4 d 13 h … The dispatcher is off" while its box was ticked; booked as soon as I switched back | Once | High if it repeats: running a brokerage stalls the carrier |
| 4 | Set a 90% margin | A warning | Accepted; loads fall off at 184–688 FD each | Once | Medium |
| 5 | Load moved at a 10% margin | Carrier paid ≤ 90% of shipper | "Shipper 1,964 · carrier 1,964 · yours −59 FD" | Once among several | Medium |
| 6 | "See what brokers earned last month" | Earnings | A list where every broker is "#1", no figures | Once | Medium |
| 7 | Brokerage name | The name I'd want | Prefill cut mid-word to "…Exchange Logis", fixed for life | Once | Low |
| 8 | More page after starting a brokerage | It shows mine | Still offers "Start a brokerage" above it | Once | Low |
| 9 | Broker CASH IT NOW | ~5% (the decided broker rate) | ~10% (8% spot + aging) | Many rows | Low–medium |
| 10 | Business prices | Something a small company can aim for | Cheapest ~150k with bond, all × the rate index | Seen | Low (design) |
| 11 | Dates | Real dates | "Due Feb 29" | Seen again | Low |

## The five things that most got in the way
1. The transfer field that jams and then ignores input.
2. The carrier stalling while I worked the brokerage.
3. No guard rail on margin: 90% is a cliff, and 5% is a guess.
4. Brokers' "earnings" page that shows nothing but #1s.
5. Losing money on a load the carrier hauled for the full shipper rate.

## The three best moments
1. Step 2 of the brokerage: bond, licence, surety, fee, both companies' cash after, and "Beta bond: it's burned at the
   token's launch". Every number is up front.
2. The company switcher and "Your carrier is one tap away, top left."
3. Fall-off charges explained load by load: "No carrier took load #52871 in 11 rounds and the shipper gave up".

## What I did not understand
- Where a broker's standing margin lives (it's under Carriers).
- Why one load paid its carrier the whole shipper price.
- Whether the carrier's dispatcher keeps running while I'm looking at the brokerage.

## Ugly or broken
"Peachtree Freight Exchange has no free truck in reach of the pickup" printed under every board card.

## Would I come back tomorrow?
To fix the margin and see the brokerage turn a profit, yes. But −19,000 in the first month, much of it from a number
the game let me type without a warning, would make a stranger think brokering is a trap.

## What the game is about, as I understood it
Two businesses with one owner: a carrier that hauls and a brokerage that sells capacity, each with its own cash, credit
and bond, and money moving between them at a fee. The broker's job is to price so that someone hauls and something is
left over. The game shows every cost, but lets you set prices that guarantee a loss.
