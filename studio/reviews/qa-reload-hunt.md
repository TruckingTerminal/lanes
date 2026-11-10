# QA: the reload hunt, 2026-11-10

## Answer
**It's a display lag, not a different world.** I reproduced the player's case exactly: the same clock and cash, with a
truck that was 193 mi from its drop before the reload and unloading after it. The two readings disagree because the
screen before the reload was stale, not because the reload changed anything.
- **What lags:** the clock redraws every frame. The trucks, the ETAs and the top bar's cash redraw only about once a
  second of real time.
- **How far behind:** at "Day in 2 s" (12 game hours a second) the panel can be several game hours behind the clock on
  the same screen. At "Day in 6 s" it's about 4 hours.
- **What a reload shows:** the world restored at the saved minute, freshly drawn. It looks like a world that "ran on
  without the clock", which is what the player wrote.
- **The suspects:**
  - No reload restored a world different from the one saved.
  - Whenever I paused first, so the screen was freshly drawn, before and after matched exactly.
  - No console error or uncaught exception in any of the 24.

## The cause (code, confirmed on screen)
- **The loop** (`apps/web/src/main.tsx` l.561–573):
  ```
  const before = g.w.t;
  observe(g); drawMap(now); bumpTick();
  if (g.w.t !== before || now - lastPanelAt > 1000) { … bumpData(); }
  ```
- **The check:** `before` is read after the hour's stepping (l.551, earlier in the same frame), and nothing between it
  and the check moves `w.t`. So `g.w.t !== before` is never true there, and `bumpData` runs only on the 1-second timer.
- **The two redraws:**
  - `Clock` (TopBar.tsx l.167) uses `useTick`, so it redraws every frame.
  - The rest of the top bar (cash, l.19) and every panel use `useData`, so they redraw once a second.
- **Seen directly** (Mon 22:00, after "Day in 2 s", just pressing Paused):
  - **At once:** "Mon 22:00 · 20,103 FD", truck 2 "Heading empty to Westcliffe for a pickup · 130 mi", truck 1 "ETA Jan
    16 08:29".
  - **50 ms later,** the clock unchanged: truck 2 "Loading at Westcliffe", truck 1 "ETA Jan 16 12:29".
  - Pressing Paused changes the speed, which forces a `bumpData`; that redraw showed the real state.
- **Likely fix:** take `before` ahead of the stepping (or compare against the last minute drawn), so the panels redraw
  whenever the minute changes, or draw the clock from the same render as the panels.

## Setup
- **Build:** c8c67db, then 9c97422 (the version check reloaded the page onto it once, mid-hunt; the client is unchanged).
- **Size:** 1024×768, in the usual profile. The pane was hidden.
- **The world:** a new one, built to the player's description: "Harbor Gate Transport", small-fleet start at Los
  Angeles, seed 740599826. Dispatcher on.
  - **Driver:** I hired one for truck 2 (Diego Ruiz, accepted).
  - **Listing:** I listed truck 2 (the reefer) for sale on day 24; it stayed unsold.
  - **Dispatcher switches:** off, then on, three times.
  - **Speeds:** "Day in 2 s", "Day in 6 s" and "Day a minute", changed often.
  - **The run:** Jan 11 to Mon Feb 13 (day 43).
- **Not like the player's:**
  - no loan-bought truck sold (the reefer never sold);
  - no shoulder tickets came up;
  - no second tab.

## Method
- **One hook per page load,** on `pagehide`, recorded three things at the moment the page went away:
  - the state line: the top bar's clock and cash, each truck's card (route, ETA) and each status line (place and miles
    to go);
  - the save the page had just written;
  - its `t`.
- **An error trap** (`error`, `unhandledrejection` and `console.error`) wrote to storage, so it survived each reload.
- **After each reload,** on the title screen I read the slot. It was the same bytes as the save at pagehide every time
  (`sameAsHide` true, 24 of 24).
- **Then Continue,** and the same state line read from the freshly loaded world, which comes back paused.
- **The clock against the save:** at pagehide the clock read the save's own `t` every time (e.g. `t` 23640 = Wed 10:00).
  The clock never lags. The panels and cash do.

## Results: 24 reloads, 5 differed, all display lag
The first reload (Sun 16:00, "Day in 2 s") was done by hand before the series and matched exactly. The series:

| # | Condition | Saved t | Before (pagehide) | After | Same? |
|---|---|---|---|---|---|
| 1 | running at 2s | 23640 | Wed 10:00 · 18,673 FD | Wed 10:00 · 18,673 FD | **no**, truck 1 |
| 2 | running at 6s | 24960 | Thu 08:00 · 15,606 FD | same | yes |
| 3 | 2s→6s, reload 100 ms after the change | 25860 | Thu 23:00 · 15,595 FD | same | yes |
| 4 | 6s→2s, reload 100 ms after the change | 28080 | Sat 12:00 · 14,406 FD | same | **no**, an ETA |
| 5 | paused 1.5 s after 2s | 29520 | Sun 12:00 · 14,406 FD | same | yes |
| 6 | the delivery minute ("Day a minute", on "Unloading") | 29580 | Sun 13:00 · 14,377 FD | same | yes |
| 7 | mid-trip at 2s | 30540 | Mon 05:00 · 12,661 FD | same | yes |
| 8 | just after an order, at 2s | 31200 | Mon 16:00 · 12,597 FD | same | **no**, truck 1 |
| 9 | running at 2s, 10 s | 34560 | Thu 00:00 · 10,184 FD | same | yes |
| 10 | another tab in front ~60 s at 6s, reload on return (see "Not done") | 38940 | Sun 01:00 · 8,565 FD | same | yes |
| 11 | at 6s, paused 0 ms | 39420 | Sun 09:00 · 8,565 FD | same | yes |
| 12 | running at 2s | 40860 | Mon 09:00 · 8,361 FD | same | yes |
| 13 | 2s→"Day a minute", reload 100 ms after | 42120 | Tue 06:00 · 7,414 FD | same | yes |
| 14 | the delivery minute at 6s | 43860 | Wed 11:00 · 6,157 FD | same | yes |
| 15 | running at 6s, 8 s | 45240 | Thu 10:00 · 5,243 FD | same | yes |
| 16 | just after an order (off, then on), at 2s | 46380 | Fri 05:00 · 5,327 FD | same | yes |
| 17 | paused 1.5 s after 6s | 47100 | Fri 17:00 · 5,327 FD | same | yes |
| 18 | running at 2s | 49320 | Sun 06:00 · 5,192 FD | same | yes |
| 19 | mid-trip at 6s | 56700 | Fri 09:00 · 3,805 FD | same | yes |
| 20 | 6s→2s | 57060 | Fri 15:00 · 3,805 FD | same | yes |
| 21 | running at 2s, 6 s | 59040 | Sun 00:00 · **3,753 FD** | Sun 00:00 · **4,829 FD** | **no**, cash |
| 22 | running at 2s, 6 s | 60720 | Mon 04:00 · 6,705 FD | same | yes |
| 23 | mid-trip at 2s | 61800 | Mon 22:00 · 6,431 FD | same | **no**, an ETA |

### The five that differed
Every one has the same clock and lagging panels. All five were taken while running; none with a pause first.
1. **#1, the player's case,** Wed 10:00:
   - before: "Truck 1 | Shreveport → Senatobia · 383 mi | ETA Jan 17 16:36", "Loaded Shreveport → Senatobia · 193 mi to
     go · 3.04/mi";
   - after: "Unloading at Senatobia".
   - Truck 2 was the same ("318 mi to go"), but its ETA moved from Jan 17 18:42 to Jan 18 01:42.
   - Cash 18,673 both.
2. **#4,** Sat 12:00: truck 2's ETA moved from Jan 20 13:19 to 14:19; everything else matched.
3. **#8,** Mon 16:00: truck 1 went from "386 mi to go" to "284 mi to go" (ETA 07:32 both), and truck 2's ETA from 09:13
   to 11:13.
4. **#21,** Sun 00:00: the cash went from 3,753 to 4,829 FD, and the trucks were identical. Some payment landed in the
   midnight hour, and the clock showed 00:00 while the cash still showed the hour before. That's the player's "−20 FD",
   in the other direction.
5. **#23,** Mon 22:00, truck 1 resting: the same "925 mi to go", but the ETA moved from Feb 15 07:02 to 11:02. That's a
   4-hour-old estimate redrawn.

### The two suspects
- **An exception in the hour's step:** none. The trap stayed empty through 24 reloads and all the play between, and the
  pane's console showed no errors.
- **A restore dropping an order:** none. Each loaded world's log matched what was saved.
  - **#8's single toggle:** one false alarm, caused by my script. #8 logged one switch toggle where I clicked two. The
    switch input is replaced after each click, so my second click hit a detached element and never reached the live
    world either; the dispatcher really was off.
  - Done with the element re-read, every toggle logged (#16: two orders, both kept).

## Files (in `qa-reload-hunt-2026-11-10/`)
- **`before-NN.json`,** for NN 01–23: the save at that reload's pagehide, which is the log the reload restored.
- **`after-NN.json`:** the slot after the reload. It's byte-identical to `before-NN`, because the page doesn't write
  again until the clock moves.
- **`final-log-day43.json`:** the world's log at the end (t 61800, 9 orders).
  - **How the files were made:** every before and after file is this log with its own `t` and its first k orders. Each
    was checked byte for byte in the page against the save it stood for, then written from it.
- **`world7-jun1-backup.json`:** world 7 ("Scioto Freight Lines", Thu Jun 1), saved before I replaced it.

## Not done
- **A truly hidden tab:** this pane keeps a background tab "visible" (`document.visibilityState` stayed "visible" with
  another tab in front), so #10 isn't a hidden-page case. On a hidden page the loop runs every 500 ms with no animation
  frames, and the panels would refresh no less often than the 1 s timer.
- **Two tabs at once.**
- **A loan truck sold:** the reefer never sold.
- **Shoulder tickets:** none came up.
- **Load time,** for the record: about 14 s at day 16, 30 s at day 27, and 60–75 s at day 43, the player's "about 75
  seconds".

## State left
- **The slot:** "Harbor Gate Transport" (day 43, paused). Truck 2 is still listed; the dispatcher is on.
- **World 7:** in `world7-jun1-backup.json`. Put it back with
  `localStorage.setItem("lanes.testworld.v1", <that file>)`, or I can on request.
- **Cleanup:** my helper keys (`qa.*`) are removed and the page reloaded clean. No repo edits, nothing staged.
