# Intel replay (2026-11-02)

Build: "Deploy 5a0184d" in lanes-play (carries e3858fb's Intel and a5d1c04's map marks). Phone 375×812, built-in browser. One owner-operator world, Los Angeles, run to about Jan 9 at Day in 6 s. Checked against `specs/intel-ux.md` and `specs/intel.md`. Console: no errors.

**Method note:** GitHub Pages was still "building" for several minutes after the lanes-play commit landed. Until it read "built", the page served the d8fc5d7 bundle (no "See who's here"). For anyone replaying: wait for `gh api repos/truckingterminal/lanes-play/pages/builds/latest` to say `built`, not just for the deploy commit.

Severity: **R** blocks the next republish · **S** this sprint · **L** later.

## The rule above all: nothing but your own screen shows cash or worth

**Pass.** I scanned the text of every reachable screen for worth, net worth, cash, balance, equity, assets, stake amounts, owes and debt: Truck, Loads, Money, More › Company, Intel (list, a carrier's card, a broker's card), Rates and Help.
- The only hits are my own Money "Cash" and my own Company card's "Net worth 4,700 FD · Private: only you see this".
- Other companies' cards carry counts, bands and Miles only.
- A broker shows "Bonded" with no amount.
- Last month's revenue reads "First month: no record yet", so the month-close figure is unchecked.

## Intel

| Check | Result | Evidence | Sev |
|---|---|---|---|
| More › Intel, in More's order | **Pass** | Iuliia · Help · Company · **Intel** · opened teasers | – |
| Own row pinned | **Fail, then pass** | Right after creating the company, Intel listed 580 companies with no pinned row, and searching my name found "0 companies". Ranking it took a page reload: then "Intel · 581 companies" with "HOW OTHERS SEE YOU · #385 · Harbor Gate Transport · Player · Not yet rated · Credit C / Los Angeles · 1 truck · 0 Miles". A new player's first visit misses them | S |
| Two-line rows | **Pass** | "#3 · Fleet-24 / Los Angeles · 6 trucks · 3,966 Miles"; brokers "#112 · Broker-50 · Broker / Atlanta · broker · credit A". City names, no codes. Ties share a rank (#9 twice; every broker #1 on Last month in month one) | – |
| Search | **Pass** | "Fleet-28" → the one row; "zzzz" → "No companies named "zzzz"." with **Clear filters**, which works | – |
| My hub / hub picker / Players / Brokers | **Pass** | My hub → "Intel · 84 companies", all Los Angeles; Players → 1 (me); Brokers → 60. The hub picker is a dropdown of city names. Chips toggle. "1 companies" (**L**, grammar) | – |
| Sorts | **Pass** | Miles (default) · Trucks · Last month all reorder. In the first month, Last month ties everyone at #1 (nothing to rank yet) | – |
| Show 50 more | **Pass** | 51 rows → 101 | – |
| A carrier's card | **Pass** | "Fleet-24 · AI · Carrier · Home: Los Angeles" · Authority 49 months · active · Running 6 trucks · 6 trailers (4 van, 1 reefer, 1 flatbed) · 6 drivers · Miles this season 5,441 · #4 of 581 · Last month First month: no record yet · Safety Satisfactory · Insurance Clean · Credit A (A is best, E worst). The director's order | – |
| A broker's card | **Pass** | "Broker-50 · AI · Broker · Home: Atlanta" then "Credit A · Bonded · Standard vetting" under the header, then rows 2–7. No bond amount | – |
| "Loads from them" on a broker | **Fail** | Broker-2 had a load on my board (Los Angeles → Clovis), and its card has no action at the foot | L |
| Your own card | **Pass, placement** | "How others see you", same rows, and the three cost lines: "At C: truck loans 14% down at 0.28% a week, up to 3 at once" · "Standard-vetting brokers turn you down: authority under 30 days old" · "Not yet rated: your premium is 25% over a rated, clean record's" · **Your full books ›** to Company (works). The spec puts each line under its band; the build stacks all three at the foot. "Insurance: Clean" sits beside "25% over a clean record's" (**L**) | L |
| Company tab | **Pass** | Players in the world and Biggest companies gone; "Every company, by Miles ›" opens Intel; my net worth "Private: only you see this". Company says "Miles 0 · #521 of 521 carriers" while Intel ranks me "#385 of 581" (**L**: two ranks for one company) | – |

## Entry points

| Entry | Result | Evidence | Sev |
|---|---|---|---|
| Hub card's "See who's here ›" (before a company) | **Pass, with a trap** | Opens "Intel · 83 companies" filtered to Los Angeles. But its back arrow reads "‹ More" and lands on More, which before a company has no way back to choosing a hub (no bottom bar, no hub list). I got out only by tapping a ring on the map. The spec: back returns to where you came from | S |
| Load sheet's shipper/broker name | **Pass** | "Shipper · Broker-2 ›" opens the broker's card; Back returns to the load ("‹ LOADS · Los Angeles, CA → Clovis, CA"). Direct-shipper loads still show a blank name, no link (**L**, standing) | – |
| A lost result's "Lost to {winner}" | **Not tested** | My low hand bid (2.73 on a 4.32 load) won; then the dispatcher kept the truck booked, so I couldn't place a losing hand bid in the time | – |

## Map marks (a5d1c04)

**Pass.** At the opening zoom (4×, Los Angeles):
- other carriers' reefers are small **blue diamonds**
- vans are hollow-cornered squares
- flatbeds are short **orange bars**

All three tell apart on a phone. On first entry the marks are dense but distinct.

## Also seen

- **L:** after a fast-forward the map got stuck on a blank, zoomed-in patch with no labels or trucks, and Fit did nothing until a reload. Possibly the hidden browser pane; worth one look.
- **L:** a reload shows "Loading your test world · Replaying its history in this browser." with a progress truck. Good.
