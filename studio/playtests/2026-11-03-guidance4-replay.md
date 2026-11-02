# Guidance batch 4 replay (2026-11-03)

Build: "Deploy 952e656" (Pages built, bundle checked against a no-store fetch). Phone 375×812, built-in browser. Console: no errors.

**World played:** Lakefront Hauling (small fleet, Chicago, the man's face). New from day 3 (Wed Jan 3) to Sat Jan 13, in one page load. I hired Tanya Lowe for Truck 2 at Wed 06:00 with the clock paused. The dispatcher then ran both trucks: Day a minute through the hire day, then Day in 6 s.

The caption (`.iuliiasay` and `.sheetbody > .caption`) was polled every 100 ms, stamped in real seconds from the start and game time.

Severity: **R** blocks the next republish · **S** this sprint · **L** later.

| # | Row | Result | Evidence | Sev |
|---|---|---|---|---|
| 1a | The hired week's before line on the hire day, its six seconds | **Pass** | 83.3 s, Wed 08:00: "Tanya Lowe is paid by the mile, weekly from Jan 7, plus a per diem for idle days away. Your driver earns by the mile. An idle day away from home costs 30 FD in per diem." **Find its next load**. Replaced at 89.4 s (6.1 s) by step 3's Do line | – |
| 1b | The at line on the payday itself | **Fail** | Payday Sun Jan 7. Nothing was spoken that day or after: the caption went from step 6's line (138.5 s, Sat Jan 6 21:00) straight through to Sat Jan 13 unchanged. "Your company so far" does carry "Jan 7 First week of wages", so the milestone fired; its line never reached the caption | S |
| 2 | Two milestone lines due on one day, one after the other | **Not reached** | Only one milestone fell in the window (Jan 7). "First payday" no longer appears as its own entry in this world | – |
| 3 | A step that has stood two game days yields the caption to a milestone's before and at lines | **Fail** | Step 6 ("The page nobody enjoys: fuel, insurance, tolls, taxes, idling… Keep a cushion.") came up Sat Jan 6 21:00 and was still the caption at Sat Jan 13 18:00, seven game days later. The Jan 7 at line never took it. (The before line in 1a didn't need this: no step had stood two days at 08:00 on day 3) | S |
| 4 | The paid step for an owned fleet: net-30 truth, no lessor | **Pass, but too brief to read** | 126.7 s, Thu Jan 4 22:00: "Delivered. On your own truck you invoice the shipper, who pays in 30 days. Money shows what's owed and when. NEXT". The words are right. But step 5's line ("Empty trailer, far end of the country…") replaced it 0.3 s later. A walkthrough step's own line vanished before anyone could read it | S |
| 5 | A milestone line holds its six seconds when a new step begins | **Pass** | Step 3 became current at the 08:00 round while the hired-week before line was up (1a). Step 3's Do line waited until the before line's 6.1 s were done | – |

## For the record

On this build the walkthrough steps chain fast for a small fleet: 2 → 3 at 08:00 on day 3; 4 and 5 within 0.3 s of each other on day 4; 6 on day 6. The minute's quiet appears to apply to milestones but not to steps. So a step can wipe the previous step's line at once (row 4), while a step's line can then hold the caption for a week against a milestone (rows 1b and 3).
