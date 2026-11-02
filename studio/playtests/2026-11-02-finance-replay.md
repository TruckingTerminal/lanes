# Finance replay (2026-11-02)

Build: d8fc5d7 ("Deploy d8fc5d7" in lanes-play), phone 375×812, built-in browser. Bundle checked as fresh against a no-store fetch before starting.
- **World 1:** owner-operator, Los Angeles, the woman's face picked. Hand bid, then the dispatcher at Day in 2 s to walkthrough step 9 (state A).
- **World 2:** small fleet, Columbus, the man's face picked. State B and staff.

Against `specs/finance.md` and `specs/finance-strings.md`. Console: no errors.

Severity: **R** blocks the next republish · **S** this sprint · **L** later.

## 1. Finance against the spec

| Check | Result | Evidence | Sev |
|---|---|---|---|
| Opens with step 9, beside the Dealer | **Pass** | World 1: Finance and Dealer appeared in More when "9 of 13: Your first truck" became current. Before that, Money's "Getting paid ›" opens the Finance teaser ("Opens when Iuliia says it's time to buy, with the Dealer") | – |
| State A order | **Pass** | Before your first truck · Getting paid · Credit · Staking (one line) | – |
| Card 1, Before your first truck | **Pass** | Lead as written; "Running one truck, a month · about 27,900 FD"; "Shippers pay you · 30 days after delivery"; "Your lease deposit · 15,925 FD · counts toward the truck"; "Your cash · 39,928 FD"; verdict "You have the month."; **Go to the Dealer** | – |
| Getting paid, state A | **Pass** | "On the lessor's truck you're paid the day you deliver."; three rows disabled; "Opens with your first truck of your own."; the three explainer lines (quick pay, factoring, "On a thin load, the fee can be the whole profit.") | – |
| State B order | **Pass** | World 2: Getting paid · Credit · Staking (no card 1) | – |
| Getting paid, contract | **Pass** | Header "Net 30: paid 30 days after each delivery."; Factoring row "5.9% of each load · 3 months · no early exit" at 2 trucks. Tap → sheet "Sign a factoring contract": Rate 5.9% fixed until Apr 3 · Set by your 2 trucks · Covers every truck you run, new ones too · Runs Jan 3 to Apr 3 (3 months) · Leaving early not possible · Quick pay closed until it ends · **Sign for 3 months** / **Not now**. Signed → "Factoring: paid on delivery, 5.9% off every load, until Apr 3." · "90 days left" · "Paid so far…: 0 FD in fees on 0 FD of loads" · When it ends: Renew · Net 30 · Quick pay, "Then Net 30 from Apr 3." The option rows are gone, so quick pay is closed. Fold: 1 truck 6.0% · 2 trucks 5.9% · you · 5: 5.7% · 10: 5.4% · 20: 4.6% · 30: 3.9% | – |
| "On your average load" line | **Not seen** | Hidden before a first delivery, as specified; I didn't run world 2 to a delivery | – |
| Credit | **Pass** | "Credit 60 of 100 · band C (A is best, E worst)"; "Truck loans: 14% down · 0.28% a week · up to 3 loans at once"; What moves it (on time —, licence age 0 days of 3 years, claims 0); "No loans."; borrow rows per truck with **Borrow**; "No leases." / "Leases are taken at the Dealer." State A shows the deposit line and terms only | – |
| Staking | **Pass** | "Staking: needed past 5 trucks (20,000 FD to run up to 10)." and "Later · Discounts for locking FD come with lock terms, later in the beta." | – |
| Money's two link rows | **Pass** | "Getting paid: Net 30 ›" / "Loans: none ›" under Owed to you, no Getting paid card, no Loans fold. After signing, "Getting paid: Factoring until Apr 3 ›" | – |
| Money link on a leased truck | **Fail, minor** | Before the first truck the row reads "Getting paid: Net 30 ›", while Finance says the lessor pays the day you deliver | L |
| **The first truck can't be bought** | **Fail** | World 1 at step 9 with 39,928 FD cash and a 15,925 FD deposit: the used lot is empty ("0 on the lot this week"), and every Dealer button is disabled with no reason given. That includes the used rows (47.5k–52.4k) and "Order the rig (replaces your lease)" at 191.5k. There's no purchase-loan route from the Dealer, though the step says "Buy a new rig at the Dealer, with a purchase loan". So I couldn't take a lessor company into state B; I used the small fleet instead | S |

## 2. My two fails

| Check | Result | Evidence | Sev |
|---|---|---|---|
| Home time raises no idle alert | **Pass** | World 1: "Truck 1 · Home time at La Habra" (Sat 11:00 on); across about 30 game days no "Truck 1 has been idle…" line appeared in the feed or the Needs-you list. I didn't wait out the normal idle threshold, so the alert's own timing is unchecked | – |
| Every name matches its face | **Pass, with a note** | World 2 hire list: 10 drivers, all matching (Maria, Sofia, Nadia → women's faces f2, f7, f3; Diego, Omar, Arjun, Yusuf, Tunde, Marcus, Jake → men's m1–m7). The same after a reload. Dispatchers and managers all share the one `dispatcher` portrait, and every name on those lists is now a man's (Hank, Kwame, Bill, Yusuf, Sanjay, Raj, Tunde, Diego, Dale, Marcus, Hector). So they match by having no women | L (no women dispatchers or managers) |

## 3. The three small ones

| Check | Result | Evidence |
|---|---|---|
| Fleet-start arrival line | **Pass** | "This is Columbus, your home. Two used trucks of your own, a van and a reefer, and nobody takes a share. Let's find them loads." |
| Dispatcher-booked overnight line | **Pass** | "Tonight: your dispatcher is routing the stop." then "Tonight, as planned: a rest area near Grants Pass" (and Weiser, Shafter, Saratoga, Evanston). No shoulder plan seen |
| Step 9 on an empty used lot | **Pass, wording** | Do line: "The used lot is empty this week. Buy a new rig at the Dealer, with a purchase loan, or wait for the lot to restock." The paragraph above still says "the Money tab's purchase loan" (loans now live on Finance) and "the used lot… sells a worn one" (**L**). The Dealer doesn't actually allow the purchase (see above) |

## 4. The owner's face

**Pass.** Naming shows "You" with "This one: a man" / "This one: a woman", neither preselected. The pick is held: world 2 (man) shows "You · driver-m" on Staff before and after a reload. I couldn't see world 1's woman on Staff, because Staff stays a teaser for a one-truck company.

## 5. Sixteen driver faces

**Pass.** Ten hire rows used eight different faces (m1, m2, m3, m5, m7, f2, f3, f7; m1 and m5 twice).

## Also seen

- **L:** on the lease, cash went to −1,157 FD in the first week with the card "Cash is low: −1,157 FD against about 117 FD a week of insurance, overhead, leases and yard before a wheel turns." It recovered by itself.
