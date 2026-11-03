# Replay of R20's remaining answers: lease, unstake, poach (QA, 2026-11-03)

Engineering's commit is c743153. Checked against `copy-player4.md`'s R20 and UNSTAKE tables and `player2-ux.md` §7.

**Builds:**
- "Deploy 70f7700 from lanes" on the test page (contains c743153; Pages built, waited 60 s).
- An unflagged local build of 70f7700 (`git archive`, port 5199, now stopped) for the fresh world, so the parked world in the test profile stays.

**Worlds played:**
- **Long Haul Test**: small fleet, Columbus, the parked world, Tue Feb 28 (about day 58) to Thu Mar 2 14:00. Now 3 trucks and 40,663 FD after the lease.
- **Lease Check**: small fleet, Columbus, new from day 3, 24,700 FD, clock paused.

Phone 375×812, built-in browser. Console: no errors on the test page. On the local build the only errors are from my first navigation, which arrived before the server was up.

Severity: **R** blocks the republish · **S** this sprint · **L** later. Screenshots are in `qa-replay-r20/`.

## LEASE

| Row | Result | Evidence | Sev |
|---|---|---|---|
| The row before the button (R7) | **Pass** | "Lease another truck · 45,500 FD deposit · at least 910 FD a week. Needs one truck you own. Lessor has 150 free." "No money down" is gone | – |
| The deposit refusal | **Pass** | Fresh, 24,700 FD: Dry van / Reefer / Flatbed disabled, with "Deposit 45,500 FD: you have 24,700." under them ([02](qa-replay-r20/02-fresh-lease-refusal.jpg)) | – |
| The result | **Pass** | Long Haul: tap Dry van, the R6 card ("Left after · 40,663 FD, 3.0 weeks of cushion", the red under-4 line), then confirm. Under the row: "Leased: a Workhorse with a dry van at Columbus, 45,500 FD deposit paid. It's on the Truck tab." Cash 86,163 → 40,663. Truck 3 appears on Truck. Right after, the buttons disabled again with "Deposit 45,500 FD: you have 40,663." ([03](qa-replay-r20/03-lease-result-and-refusal.jpg)) | – |
| The yard refusal and the lease-cap refusal | **Not reached** | 3 trucks of a 5-truck yard, and 1 lease so far | – |
| The weekly minimum agrees everywhere | **Fail** | The row and the card say "at least 910 FD a week". Truck 3's card says "second lease: the lessor keeps 15% of every load, at least 250 FD a week" | S |

## UNSTAKE

| Row | Result | Evidence | Sev |
|---|---|---|---|
| Result or one of its three refusals | **Not reachable** | There is no stake or unstake control anywhere in this build. Finance › Staking shows only "Staking: needed past 5 trucks (20,000 FD to run up to 10)" and "Later: Discounts for locking FD come with lock terms, later in the beta." I searched every More page, Money (folds opened) and Truck: no Stake or Unstake button. With the stake tiers off there's nothing to press, so engineering's strings can't be exercised from the UI. Engineering should say whether UNSTAKE is meant to be pressable in this build | – |

## Poaching: OFFER

| Row | Result | Evidence | Sev |
|---|---|---|---|
| Refused before the press (R7) | **Pass** | Every driver row in "Hire away from other companies" reads "no open seat" in place of a button (both trucks were crewed) | – |
| The press answers with a pending row and a line | **Pass, wrong date** | Marcus Silva (Fleet-65, 2,636 FD/wk, restless): **Offer 2,904 FD/wk**. At once the row became "Marcus Silva · Offer pending · answer by **Feb 30**", with "Offer sent to Marcus Silva: they answer by **Feb 30**." under it. Feb 30 doesn't exist; the press was Tue Feb 28 plus 2 days, so it should be Mar 2 | S |
| The answer when it comes | **Fail on the row; the feed passes** | The feed: "Marcus Silva accepted your offer; their employer has 2 days to match it." (Tue), then "Marcus Silva stayed: their employer matched your offer." (by Thu). On Staff, the pending chip went at Wed 00:00, but no result line replaced it. The row now shows his new pay (2,904 FD/wk), mood "settled" and a fresh **Offer 3,247 FD/wk**. The stale "Offer sent to Marcus Silva: they answer by Feb 30." stayed under it through Thu Mar 2. Spec: "declined: stays with Prairie Haul" on the row | S |
| R6's card when the wage passes a week's net | **No card** | The offer went straight out at 2,904 FD/wk with no confirm. The company's net may have been above that last week; I didn't check the weekly figure | – |
| The table on a phone | **Fail, small** | "Hire away from other companies" is wider than 375 px: the Offer button is cut off at the right edge ("OFFEI"), and "no open seat" is clipped to "no op" ([01](qa-replay-r20/01-poach-table-cut-off.jpg)) | L |

## Not tested

The BID ceiling refusal is behind a switch, as the brief says.
