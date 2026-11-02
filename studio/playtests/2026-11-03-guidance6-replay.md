# Guidance batch 6 replay (2026-11-03)

Build: "Deploy 6389e77" (Pages built, bundle checked against a no-store fetch). Phone 375×812, built-in browser. Console: no errors.

**Same browser, storage not cleared.** Before the run, `lanes.onboard.v1` still held the old browser-wide keys `ms:slump:at`, `ms:hiredWeek:before` and `ms:hiredWeek:at` from earlier worlds.

**World played:** Harbor Gate Transport (small fleet, Los Angeles, the man's face). New from day 3 (Wed Jan 3 06:00) to Mon Jan 8 10:00, in one page load, at **Day a minute**. I hired Nabil Walker for Truck 2 at Wed 06:00, with the clock paused, 6.0 s after the world opened. The dispatcher ran both trucks. While I paused the run, the speed button cycled through the fast speeds and the clock ran on to Wed Jan 10 06:00. The poll had already stopped by then, so those two days aren't logged.

The caption (`.iuliiasay`, `.sheetbody > .caption`) was polled every 100 ms. Times are real seconds from the start. A line's hold is the time until the next change.

## The log

| Real s | Game | Caption | Held |
|---|---|---|---|
| 3.6 | Wed 06:00 | Arrival: "This is Los Angeles, your home. Two used trucks of your own, a van and a reefer, and no lessor's share…" | 7.4 s |
| 11.0 | Wed 08:00 | Step 3: "Watch the ETA. Note where it sleeps tonight." | 52.5 s |
| 63.5 | Thu 05:00 | **Hired week, before:** "Nabil Walker is paid by the mile, weekly from Jan 7, plus a per diem for idle days away. Your driver earns by the mile. An idle day away from home costs 30 FD in per diem." | 6.1 s |
| 69.6 | Thu 07:00 | Step 3 again | 88.9 s |
| 158.5 | Fri 19:00 | Step 4: "Delivered. With no lessor, you invoice the shipper, who pays in 30 days. Money shows what's owed and when." | 10.0 s |
| 168.5 | Fri 23:00 | Step 5: "Empty trailer, far end of the country. Nearest load first…" | 63.2 s |
| 231.7 | Sun 00:00 | **Hired week, at:** "Nabil Walker has driven 2,387 miles for you this week: 2,063 FD in wages so far. Your driver earns by the mile…" | 6.0 s |
| 237.7 | Sun 02:00 | Step 5 again | 53.3 s |
| 291.0 | Mon 00:00 | Step 6: "The page nobody enjoys: fuel, insurance, tolls, taxes, idling… Keep a cushion." | still up at Mon 10:00 (and Wed Jan 10) |

## Results

Severity: **R** blocks the next republish · **S** this sprint · **L** later.

| Row | Result | Evidence | Sev |
|---|---|---|---|
| The before line on the day after the hire, in a browser that held earlier worlds | **Pass** | Thu Jan 4 05:00, 6.1 s. The new key `565179328:581:2\|ms:hiredWeek:before` was written next to the old browser-wide one | – |
| The at line on the payday | **Pass** | Sun Jan 7 00:00, 6.0 s. Its key was scoped the same way | – |
| The slump line | **Not reached** | Harbor Gate never slumped: 11,585 FD at the end. "Your company so far" lists only "Jan 7 First week of wages", and no scoped slump key was written. So the slump milestone didn't fire, which is different from firing and staying silent. The old `ms:slump:at` didn't suppress anything I could see, but this world can't show that it wouldn't. A world that slumps is needed to test the line | – |
| Every line holds at least six seconds | **Pass** | Shortest holds: the at line 6.0 s, the before line 6.1 s, the arrival 7.4 s, step 4 10.0 s | – |
| No walkthrough step skipped | **Pass** | Arrival, then steps 3, 4, 5 and 6 in order. Each held 10 s or more, and each standing step came back after a milestone line. The Iuliia page reads "6 of 13: What it costs to exist" | – |

## Also seen

- **L:** The Iuliia page shows "6 of 13: What it costs to exist" as the current step but "7 of 13 done" underneath. One of the two counts looks off by one.
- **L:** Step 6 stood from Mon Jan 8 00:00 to at least Wed Jan 10 06:00. No milestone was due then, so this isn't a fault in this run.
