# Engineering readiness (2026-11-01)

## Build, test, preview
- `npm ci` once at `lanes/`. `npm run typecheck` (tsc, no emit), `npm test` (vitest over `packages/*/test` and
  `apps/*/test`), `npm run build` (esbuild → `apps/web/dist/lanes.html` for the artifact plus `local-lanes.html`
  and `dist/assets/` with a manifest), `npm run build:site` (the test build → `dist/site/index.html`,
  `test-page.html`, `docs.html`). `dist/` is gitignored, so builds never dirty the tree.
- Preview: `.claude/launch.json` has `lanes-art`, a static server on 5183 over `apps/web/dist`; open
  `local-lanes.html` (live mode on a browser-storage store). For onboarding work, serve `dist/site` after `--site`.

## Results today
- **typecheck:** clean, 14 s.
- **test:** green, 9 files, 199 tests, 7 min 21 s. Eight files are the engine; the client has one
  (`apps/web/test/live.test.ts`: the same world on every page, a late joiner, a late action). Nothing tests the UI.
- **build:** clean, 3.5 s: 720 asset files, `lanes.html` 3,622 KB. `build:site` not run.

## How the client is built (ten lines)
1. `main.tsx` boots, connects to the claude.ai store (or a `MemoryDb` locally), runs the frame loop and fills `H`.
2. `state.ts`: one mutable object `S` (screen, tab, layout, selections, walkthrough, toast) and two channels:
   `bumpTick` each frame for the clock, `bumpData` when panels must redraw; components call `useData()`.
3. `S.screen` is title | loading | game; `App.tsx` switches on it. Title menus are a `TitleMenu` union.
4. Game screen: `TopBar`, then `.board` with `MapView` and `SideRack` side by side, then `Ticker` and `Toast`.
5. Layout is `split | panel | map`, toggled by Expand buttons and Esc; phones start on `panel`.
6. Tabs: a 13-entry `TABS` array and one long ternary choosing the panel; `tabLock` turns a tab into a teaser.
7. Panels (`ui/panels/*.tsx`) read the world straight from `S.game.w` and act through `act(action, okText)`.
8. The map is imperative (`mapview.ts`, 1,021 lines) on a canvas `MapView` mounts; `fitMap` resizes it.
9. The walkthrough (`walkthrough.ts`) is a list of steps whose `done(w, c)` reads the world; nothing is saved but
   the "hidden" flag and the read-ahead index. The card sits above every panel but the Guide.
10. The live world (`live.ts`): seed + every player's action log in the store, replayed by the engine on every page.

## Risks for the first ten minutes
**Hard to change**
- *Tab bar and layout.* Tabs are hard-wired in three places (`Tab` type, `TABS`, the ternary in `SideRack`) plus
  `TAB_NAME` in `Walkthrough.tsx`; eight files switch tabs directly. Hiding tabs for a new player, or reordering them, touches
  all of these. Layout is CSS grid in `page.html` (breakpoints 1240 and 760) with `hidden` toggles; reordering is
  CSS, but a new arrangement (bottom tab bar, sheet over the map) rewrites `GameScreen` and the stylesheet.
- *Panel pattern.* Panels take no props, read globals and redraw on every `bumpData`. Adding one is easy; showing
  part of one elsewhere (just the next load) is not, because the parts aren't extracted.
- *Map size.* The painted map is 1584 × 856 art pixels scaled to the window; `fitMap` reads the wrapper, so every
  layout must give `.mapwrap` a definite height or the map collapses. Repaint on resize costs ~250 ms.
- *Walkthrough state.* Steps are done by world facts, so they can't be "seen", skipped or branched; the only stored
  state is `lanes.walk.hidden`. A scripted flow (highlight a button, wait for a click) needs a per-browser progress
  record, never in the world.
- *Test build persistence.* `lanes.testworld.v1` holds the seed and action log and is replayed on Continue; it is
  refused when `RULESET` differs. Any client-only onboarding state must live under its own key, or a format change
  strands players' saved worlds.

**Must not change**
- The engine's replay: the client may send any action the engine already accepts, but nothing may change how an
  action is stamped, ordered or applied (`live.ts`, `game.ts`, the engine), or the world forks between pages.
- `RULESET` (`lanes-live-1/<config version>`): bumping it locks every page out of the live world until the owner acts.
- The live store layout: `world/meta`, `players/<uid>`, `players/<uid>/log/<n>`, `players/<uid>/x/tab`.
So onboarding stays client-only: it reads the world and writes only to localStorage.

**What I'd refactor first** (client-only, once a spec asks)
1. One tab registry: `{ id, label, icon, panel, lock }[]` driving the type, the bar, the panel switch and `TAB_NAME`,
   plus a `visible(w, c)` hook so a new player sees three tabs, not thirteen.
2. Split `GameScreen` into named regions (top bar, map, rack, ticker) placed by a layout component per breakpoint,
   so the phone can get a bottom tab bar without forking the panels.
3. Pull the walkthrough's "where to click" into data (`target: tab + element id`) and keep its progress in a small
   versioned localStorage record, so a guided flow can point at real buttons.
4. A `test:web` script running only `apps/web/test`, for a fast client loop.

## Answer: can the client show tonight's stop ahead of time? (spec question 3)
1. **No stored field.** `truck.restSite` is set only once the truck has parked (`parkForTheNight`); before that it is 0.
2. `planNight` (sites.ts) decides hour by hour, and only returns a mile once the stop falls inside the current hour; it
   keeps no plan between hours.
3. **But it can be predicted client-side, read-only:** the engine exports `legRoute`, `sitesAlong`, `legMile`,
   `hasRoom`, `drivingMinutesLeft` and `mphFor`. Calling `planNight(w, t, legRoute(w, t), legMile(t), reach, reach)` with
   reach = hours left × mph gives "the last site with room in reach" now; null means the shoulder or the leg's end.
4. Caveats: it's a forecast (sites fill, the mph changes with terrain and the speed policy), so it's labelled
   "planned"; and the game config turns truck stops on (`businesses.enabled` is true), so it applies to this world.
5. Cost: one client helper (~20 lines in `logic.tsx`) plus a test. No engine change and no replay risk: these reads change nothing (`sitesAlong` only caches).
