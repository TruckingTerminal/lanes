# Step 9 replay (2026-11-02)

Build: "Deploy 2bf8a4e" (Pages built). Phone 375×812, built-in browser. One new owner-operator world, Los Angeles: a hand bid, then the dispatcher at Day in 2 s to walkthrough step 9 (reached Thu 15:00, about day 36), then on at Day in 6 s for four more game days. Console: no errors.

Severity: **R** blocks the next republish · **S** this sprint · **L** later.

| Check | Result | Evidence | Sev |
|---|---|---|---|
| The step's line and Iuliia's say the exact state from the Dealer's figures | **Fail** | At step 9 (cash 36,671 FD, deposit 15.9k): Do line "Buy a rig from the used lot, with a purchase loan if the cash is short." Caption "The lessor's 15% ends the day you buy. Buy the used one first; ambition is for the second truck." The full text still sends the player to "the Money tab's purchase loan". The Dealer at that moment said something quite different: the NPC used lot was empty ("The used lot is empty this week."); a carrier's Workhorse + Dry van was listed at 21.1k, blocked by "NPC-leased truck is on a trip"; a new Workhorse + Dry van on a loan needed "Cash needed now 39.9k FD" (36.7k cash, so 3.2k short). Neither line named the empty lot, the restock, the 39.9k against what I had, or that a few more loads would close it | S |
| The step advances the moment either route opens | **Fail** | Fri 13:00: cash 43,329 FD passed the 39.9k a new rig on a loan needed. Mon 20:00: cash 48,783; the tractor-alone loan was live ("Buy on a loan · 27.0k FD now", enabled); two carrier listings at 41.0k and 87.3k. Through all of it the Do line, the caption and More › Iuliia stayed word for word as at step 9's start. I polled them every 100 ms over four game days | S |
| More › Iuliia shows "You won one" only after a real load | **Pass** | After a hand bid, before the round: More › Iuliia showed "2 of 13: Reading the board ✓" and no "You won one" anywhere on the page. **Read ahead** still shows step 3's full text with "You won one", which is fair for reading ahead (**L** at most) | – |
| The reason-line contradiction (from the Dealer-fixes replay) | **Still there when short** | While cash was short: "Cash needed now 39.9k FD" on the sheet, but under the button "A loan needs 55.9k FD now: down payment, stake and tax. You have 52.6k FD, counting your deposit." Once cash covered it, the reason line went away | S (already with engineering) |

## Shortfall at step 9, for the record

Cash **36,671 FD**, deposit **15,925 FD**, Thu 15:00 (about day 36).

| Purchase | Cash needed now | Short by |
|---|---|---|
| New Workhorse + Dry van (189.1k) on a loan | 39.9k | **3.2k**; closed by one delivery (43.3k, Fri 13:00) |
| Workhorse tractor alone (145.4k) on a loan | 27.0k (seen on Mon at 48.8k cash) | none |
| NPC used lot | empty | – |
| A carrier's Workhorse + Dry van at 21.1k | blocked while on a trip | none in cash |

## Also seen

- **L:** the new rig's delivery wait was 54 days at step 9 (was 62–88 in earlier worlds).
- **L:** a 100%-condition used Workhorse listed at 41.0k by another carrier, at 336,938 mi. Condition 100% on a used rig reads odd.
