# Replay of R7 and R19, part three (QA, 2026-11-03)

Engineering's commit is 9cd260f. Checked against `player2-ux.md` §2 and §7, `copy-player4.md`'s R19 table, and my `qa-replay-r7-2.md` fails.

**Build:** an unflagged local build of 9cd260f (`git archive`, port 5199).
- When I started, lanes-play's newest deploy was dc47cec (R21), which doesn't contain 9cd260f.
- I didn't use the parked test-page world. It has to stay untouched for eight hours for the R21 replay (see below), and the upgrade payback ran in a local world instead.
- Built after another session's vitest run had ended and memory had recovered.

**World played:** Doors Check (small fleet, Columbus), on the local origin, from Wed Jan 3 to Mon Jan 29 06:00.
- Day a minute, then Day in 6 s and Day in 2 s.
- The dispatcher ran Truck 1; Truck 2 had no driver.

Phone 375×812, built-in browser. Console: four `ERR_CONNECTION_REFUSED` from my first navigation before the server was up; none after.

Severity: **R** blocks the republish · **S** this sprint · **L** later. Screenshots are in `qa-replay-r7-3/`.

| Row | Result | Evidence | Sev |
|---|---|---|---|
| The caps line names the cap that binds next after the first | **Pass** | Truck tab, day 3: "You may run 5: your yard holds 5. Yards open Jan 29, Year 1. Past 7 trucks you need an operations manager. The company limit is 30." | – |
| …never staking while the tiers are off | **Pass** | No staking sentence | – |
| The upgrade's payback in weeks, with its basis | **Pass** | Mon Jan 29, Business just open, Truck 1 with 3½ weeks on the road. Aero kit: "It pays back in about 192 weeks at this truck's miles." Premium tires: "about 103 weeks at this truck's miles." APU: "It pays back only on nights away: about 859 weeks at this truck's pace." ([03](qa-replay-r7-3/03-apu-payback-weeks.jpg)) Sleeper: "It pays back only if the truck sleeps away often: about 771 weeks." The basis comes as the condition ("only on nights away") rather than the brief's mechanism wording ("halves the idle fuel burned on nights the truck sleeps"). What-it-does carries the halving: "Cuts the fuel truck 1 burns idling overnight by half." 859 and 771 weeks are 15–16 years; that may be the truth of this truck's nights, but it's for the economy to confirm | – |
| The parked-world case | **Not run** | See "For the R21 replay" | – |
| A poaching offer's outcome lands as a result line on the Staff row at the deadline | **Fail** | **Offer 0.98 FD/mi** to Donna Stone (Fleet-18, settled) for Truck 2, Wed Jan 3: "Donna Stone · Offer pending · answer by Jan 5" and "Offer sent to Donna Stone: they answer by Jan 5." The feed logged "Donna Stone accepted your offer; their employer has 2 days to match it." The row still read "Donna Stone · Offer pending · answer by Jan 5" on Sun Jan 7 and on Tue Jan 9, four days past the deadline ([02](qa-replay-r7-3/02-offer-pending-past-deadline.jpg)). No result line and no second feed line, and Truck 2 still had no driver. It looks like the offer never resolved | S |
| The hire-away table is cards that fit 375 px, with Offer and the truck picker whole | **Pass** | Each candidate is a card: "Donna Stone · Fleet-18 ★★★★★ · 0.87 FD/mi settled", then the **Truck 2 · Reefer** picker and **Offer 0.98 FD/mi** side by side, both whole. Nothing in the section extends past 375 px; there's no sideways scroll ([01](qa-replay-r7-3/01-hire-away-cards-375.jpg)) | – |

## Also seen

- **S: wind-up while running.** At Day in 2 s the company went into debt (−17,092 FD) and the feed says "The company is wound up: the trucks are sold, and you start again on a lease." Afterwards:
  - both trucks show "Listed for sale", not sold;
  - Truck 1 is "No driver";
  - loads kept delivering after the wind-up line ("Delivered Georgetown to Griffin… Due Mar 21");
  - cash reads 32,328 FD;
  - Business still offers upgrades for those trucks.

  The state after a wind-up reads half-done. It may be worth its own replay.
- **L:** the feed still has "Freight is booming: the Cass dial reads 1.13." The Cass dial was renamed in the player-1 strings (row 13).
- **L:** the APU's card title is lower case: "Fit apu to truck 1?"

## For the R21 replay

- **Under eight hours, no card: Pass.** On this build, Continue read "Continue · Doors Check · Wed Jan 3" (the game's date). Loading read "Loading your world…". Opening that world after about 1 h away showed the normal arrival line ("This is Columbus, your home…"), with no "Welcome back" and no return card.
- **The full card** needs the parked test-page world (Long Haul Test), last opened at about 05:25. I'm leaving it untouched and will open it after 13:30 for qa-replay-r21.md.
