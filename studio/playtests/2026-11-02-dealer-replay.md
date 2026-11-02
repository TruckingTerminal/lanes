# Dealer replay (2026-11-02)

Build: "Deploy 525cdfd" (carries 9d13ae8, the Dealer batch), Pages build `built`, bundle checked fresh. Phone 375×812, built-in browser.
- **World 1:** owner-operator, Chicago, the woman's face. A hand bid, then the dispatcher at Day in 2 s to walkthrough step 9 and about eight weeks past it.
- **World 2:** small fleet, Chicago, the woman's face.

Console: no errors.

Severity: **R** blocks the next republish · **S** this sprint · **L** later.

## 1. The Dealer at step 9 (lessor company)

| Check | Result | Evidence | Sev |
|---|---|---|---|
| Every disabled button says why | **Pass** | Used rows: "The used lot is empty this week." New rigs and tractors: "You have 36.3k FD with your deposit; it costs 205.8k FD with tax." Lease: "Needs one truck you own." Trailers: "Room for 0 more of your own." A player listing: "You have 24.6k FD; the seller asks 26.9k FD." | – |
| A purchase loan on new rigs and tractors alone | **Pass** | "On a loan ›" under every new rig and every tractor alone | – |
| The loan sheet before it acts | **Pass** | "Buy Workhorse + Dry van on a purchase loan": Price 192.3k · Sales tax 13.5k · Down payment 26.8k · The loan 165.5k · Loan stake 16.6k, locked, back when it's repaid · Weekly payment 2,053 FD for 104 weeks (0.28% a week on what's owed) · Your lease deposit 15.9k, applied · You put in now 56.8k · "Miss 2 payments and the lender takes the truck." · **Buy on a loan · 56.8K FD now** / **Not now**. The sum checks: 26.8 + 16.6 + 13.5 = 56.9 | – |
| A loan on the used lot | **Fail** | The lot was empty all session, so there was no NPC used rig to try. A player's listing (Workhorse + Dry van, 26.9k) offered only **Buy today**, with no loan and no deposit counted: "You have 24.6k FD" while Finance showed 15.9k deposit | S |
| **Can a lessor company buy its first truck?** | **No** | **Shortfall at step 9:** cash 20.4k + deposit 15.9k = 36.3k against 56.8k for the cheapest rig (**20.5k short**) and 43.7k for a tractor alone (7.4k short). Eight weeks later, cash had stalled at about 25k (the dispatcher's runs, home time, the lease minimum) while list prices rose (rig 192.3k → 204.0k, tractor alone 147.9k → 157.0k): 60.2k needed against 42.6k (17.6k short), and tractor alone 46.3k against 42.6k (3.7k short). Engineering's 0.9k doesn't match what a phone player sees. The deposit is counted in "you have", but the sheet's "You put in now" includes the deposit, so "applied" doesn't lower the figure | S |
| Cash falls by exactly the sheet | **Not reached** | Never had enough to press Buy on a loan | – |
| Finance's Credit shows the running loan | **Not reached** | Same | – |
| **A refused buy releases the lease deposit** | **Fail** | With a used Highway Pro + Reefer listed at 15.3k and 25.4k cash, I pressed **Buy today** while the truck was loaded. Refused with the toast "NPC-leased truck is on a trip"; the spec wants refusals under the button, not as a toast. In the same moment cash went 25,421 → 41,346 FD (+15.9k). Finance then read "Your lease deposit 0 FD". The lease still runs ("The lessor's 15%" on every later delivery). The Dealer still says "You have 42.6k FD with your deposit" with no deposit left | S |
| Step 9's wording vs the Dealer | **L** | Step 9 still points to "the Money tab's purchase loan"; the loan lives on the Dealer now | L |

## 2. "No room for another trailer" on a first rig

**Not reached.** No purchase went through, so I couldn't see whether the trailer rule blocks a first rig. Before any purchase, Trailers alone says "Room for 0 more of your own. Without a yard, only as many trailers as tractors." That's accurate for a lessor company.

## 3. Money's link on the lessor's truck

**Pass.** "Getting paid: the lessor pays on delivery ›".

## 4. Portraits

| Check | Result | Evidence |
|---|---|---|
| Every staff kind, both looks | **Pass** | Drivers f1–f6, m1, m8; dispatchers `dispatcher-f` (Carmen Duarte, June Vance) and `dispatcher-m` (Chidi Reyes, Emeka Bell, Gary Price, Earl Cole); operations managers `ops-manager-m` (Javier Carter) and `-f` (Mai Duarte, Lucia Hart, Deepa Stone); maintenance managers `maint-manager-m` (Jake Cole) and `-f` (Peggy Walker, Sofia Silva, Chioma Boone) |
| Names match faces | **Pass** | All 27 rows, hire lists and my hired driver (Ivy Reyes · f2) |
| Stable across three loads | **Pass** | The full staff list was identical, row for row and face for face, across the first load and two reloads |
| The owner's face | **Fail** | I picked "This one: a woman" at naming; the save holds `"look":"f"`; Staff shows "You" with `driver-m` on all three loads | S |
| Duplicate names | **L** | "Deepa Stone" is both a driver for hire and an operations manager for hire |

## 5. Intel with the writer's strings

**Pass.** First visit: Iuliia's one line, "Every company in the world, by size and record. Nobody's cash is here, yours included." with **Next**. The new company was pinned at once ("HOW OTHERS SEE YOU · #186 · Lakefront Hauling · Player · Not yet rated · Credit C") with no reload, already on this build.

## Also seen

- **L:** new-truck delivery is now 62–83 days ("the wait grows when the whole market is ordering"). A first truck ordered at step 9 arrives two to three months later.

---

# The next batch: 8311b73 ("Deploy 8311b73", Pages built)

Phone 375×812, two new owner-operator worlds (Chicago, then Columbus). Console: no errors.

| Row | Result | Evidence | Sev |
|---|---|---|---|
| A new company in Intel at once, row pinned | **Pass** | Straight after Start at Chicago, More › Intel showed Iuliia's line and "HOW OTHERS SEE YOU · #197 · Lakefront Hauling · Player · Not yet rated · Credit C / Chicago · 1 truck · 0 Miles". No reload | – |
| "Their loads on the board ›" | **Pass, one wrinkle** | On Broker-48's card (reached from a load's "Shipper · Broker-48 ›"), the foot reads "Their loads on the board ›". Tapped, the board became "Loads from Chicago · 1" with a chip **Loads from Broker-48 ✕** and its one load. The chip clears it back to 60. The wrinkle: the tap first returned to the load sheet I'd come from; the filtered board showed behind it after "‹ Loads" | L |
| A hand bid lost to someone else, with the winner's link | **Pass** | Bid 7.06/mi on Romulus, MI → Pompano Beach, FL (posted at 7.01/mi, 10,312 FD). At the round: "Lost to 2.63/mi · your bid 7.06 · your break-even 2.40" and "Lost to OO-120 at 2.63/mi ›". The link opens OO-120's card (AI · Carrier · Home: Newark · 1 truck · 805 Miles · #151 of 581); Back returns to the result | – |

Also seen on this build:
- **S:** a result card leaks between worlds. Right after replacing the Chicago world with a new Columbus one, the board opened with the old world's "Won Chicago → Savannah at 4.82/mi · 4,622 FD" card pinned, before any bid of mine.
- **S, market truth:** the load posted at 7.01/mi with book-now 10,312 FD went to a carrier at 2.63/mi. My bid of 7.06 stood above its own posted rate and lost to a bid less than half of it, so the posted rate tells a player nothing about what wins.
- **L:** "Bid again" sits under the lost card while the truck is already "Loading at Dayton" on a dispatcher's load, so there's nothing to bid with.
