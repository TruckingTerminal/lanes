# Guidance batch 5 replay (2026-11-03)

Build: "Deploy 99bb48e" (Pages built, bundle checked against a no-store fetch). Phone 375×812, built-in browser. Console: no errors.

**World played:** Scioto Freight Lines (small fleet, Columbus, the man's face). New from day 3 (Wed Jan 3 06:00) to Sun Jan 7 15:00, in one page load. I hired Carmen Ruiz for Truck 2 at Wed 06:00, with the clock paused, 7.1 s after the world opened. Then **Day a minute** throughout; the dispatcher ran both trucks.

The caption (`.iuliiasay`, `.sheetbody > .caption`) was polled every 100 ms. Times are real seconds from the start; a line's hold is the time until the next change.

## The log

| Real s | Game | Caption | Held |
|---|---|---|---|
| 4.8 | Wed 06:00 | Arrival: "This is Columbus, your home. Two used trucks of your own…" | 7.6 s |
| 12.4 | Wed 08:00 | Step 3: "Watch the ETA. Note where it sleeps tonight." | 27.5 s |
| 39.9 | Wed 19:00 | Step 4: "Delivered. With no lessor, you invoice the shipper, who pays in 30 days. Money shows what's owed and when." | 87.6 s |
| 127.5 | Fri 06:00 | Step 5: "Empty trailer, far end of the country…" | 84.9 s |
| 212.4 | Sat 16:00 | Step 6: "The page nobody enjoys: fuel, insurance, tolls, taxes, idling…" | 20.4 s |
| 232.8 | Sun 00:00 | Hired week, at: "Carmen Ruiz has driven 2,036 miles for you this week: 1,913 FD in wages so far. Your driver earns by the mile. An idle day away from home costs 30 FD in per diem." **Find its next load**. Its miles and wages updated live (2,094 / 1,967, then 2,152 / 2,022) | 6.0 s |
| 238.8 | Sun 02:00 | Step 6 again | still up at Sun 15:00 |

## Results

| Row | Result | Evidence | Sev |
|---|---|---|---|
| Every line, steps included, holds at least six seconds | **Pass** | Shortest: the payday line at 6.0 s, then the arrival at 7.6 s. Every step held 20 s or more. (The pre-company lines from 3.3–4.2 s were my own taps through the hub screens) | – |
| The hired week's before line reaches the caption | **Fail** | Hire Wed Jan 3 06:00. No before line at any point, Wed through Sun. Engineering's log has it at Thu 06:00; here Thursday fell inside step 4's long line (Wed 19:00 – Fri 06:00), and no before line came then or after | S |
| The hired week's at line reaches the caption | **Pass** | Sun Jan 7 00:00, the payday itself, for 6.0 s | – |
| A standing step's line gives way to a due milestone line, then returns | **Pass** | Step 6 (up since Sat 16:00) gave way to the payday line at Sun 00:00 and came back at Sun 02:00 | – |

## Also seen

- **L:** "Your company so far" lists "Jan 3 The first slump", but no slump line was ever spoken in this run. It's in the record without having been said, which may be intended for a line that lost its window.
- **L:** "Next on the road" now reads "Businesses open Jan 29", not the next truck.
