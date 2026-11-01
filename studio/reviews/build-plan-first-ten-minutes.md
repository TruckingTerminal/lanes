# Build plan: the first ten minutes (engineering, 2026-11-02)

Against the brief, UX spec draft 2 (draft 3 re-read before step 1) and the copy audit. Client only; the engine,
`RULESET` and the live store untouched; the dispatcher rule is a config switch I only read.

## For draft 3 to settle before I start
- **The five names:** the brief says Truck, Board, Money, More; the spec says Fleet, Loads, Money, Company, Iuliia.
- **Teasers:** Jeff's answer 4 keeps "coming soon" tabs; the spec cuts the locks. I assume Jeff's answer wins.
- **Token surfaces:** the brief keeps them; S8 drops them from Money.
- **Theme:** the spec says `cyber-ops`; the art note says Interstate Dusk.
- **S7's pay lines:** the `delivered` event has only gross and total cost. The lessor's cut and the deposit come
  from config; fuel apart from tolls doesn't. Either one "Fuel and tolls" line, or two output-only fields on the
  event (no replay risk, but an engine file).

## Order of changes
**0. Refactor first (no visible change; one session).**
- One tab registry `{ id, label, icon, panel, lock, visible }` replaces the `Tab` type list, `TABS`, `SideRack`'s
  ternary and `TAB_NAME` (`state.ts`, `ui/App.tsx`, `ui/Walkthrough.tsx`). The eight files that set `S.tab` go
  through `setTab`, among them `mapview.ts:834`, `logic.tsx`, `CityPane.tsx` and `Yard.tsx`.
- `GameScreen` split into regions (`TopStrip`, `MapRegion`, `Rack`, `Ticker`) that a per-breakpoint layout
  component places (`ui/Shell.tsx`, new).
- A versioned per-browser record `lanes.onboard.v1` (seen steps, the last result card, the first-visit sort) in
  `state.ts`, kept apart from `lanes.testworld.v1`.
- `npm run test:web` (vitest on `apps/web/test`) in `package.json`, and a `lanes-site` entry in
  `.claude/launch.json` serving `apps/web/dist/site` (the producer's call: it's a shared file).

**1. Chrome (S-shell).** A 44 px top strip, the "≡" menu, the theme picker gone, the five as a segmented control
on a laptop and a bottom nav on a phone, dots for things waiting. Files: `ui/App.tsx` (`TopBar`), `ui/Shell.tsx`,
`state.ts` (`THEMES`, `loadTheme`), `page.html` stylesheet.

**2. The phone sheet.** A full-screen map with a three-stop sheet (strip, half, full) and a drag handle. Files:
`ui/Sheet.tsx` (new), `page.html`, `mapview.ts` (`fitMap` on sheet changes; a map tap drops the sheet). The
riskiest step: see below.

**3. S0–S1.** Name plus three hub cards on the title; fly to the home hub, the AI at 35 %, "You" over the sprite,
the painting until the first frame. Files: `ui/App.tsx` (`TitleScreen`, `JoinMenu`, `TestMenu`,
`HubChoiceTable`), `mapview.ts` (fly-to, AI opacity, the label), `main.tsx` (`showGame`).

**4. S2–S5, the board.** Profit-chip cards, sorts, a filter, dimmed blocked loads; the load sheet, Book now and a
stepped bid; the pinned bid; the result card; the selected load's lane on the map. Files: `ui/panels/Loads.tsx` split into `LoadCard`,
`LoadDetail` and `BidControl` (the DAT table kept behind "Table"); `logic.tsx` (profit at book-now and at
`suggest`); `main.tsx` `onEvent` (won and `lostBid` stored as the result card); `mapview.ts` (lane drawing).

**5. S6–S7, rolling and delivered.** A progress card, ETA, on-time chip, Follow, the planned night stop (my answer
to question 3), the delivered card. Files: `ui/panels/Fleet.tsx`, `mapview.ts` (follow and stop-follow on pan),
`logic.tsx` (night forecast), `main.tsx` (the delivered card).

**6. S8, Money as a ledger.** Cash, owed to you (`receivablesOf` and the invoices' `dueDay`), this week's costs,
standing, and loans under a fold. Files: `ui/panels/Money.tsx`, with `Finance.tsx` folded in.

**7. S9 and the walkthrough.** The dispatcher becomes a switch and three rows ("More rules" folds the rest; the
re-post row hidden until brokerage); the rule's switch reads "waiting for your first bid". Steps tick on the
player's own orders (`TestGame.log.acts`; a read-only accessor for `LiveWorld`'s). Iuliia's caption replaces the
wall. Files: `ui/panels/Fleet.tsx`, `walkthrough.ts`,
`ui/Walkthrough.tsx`, `live.ts` (accessor only).

**8. Copy.** The audit's rewrites on every touched screen, numbers through formatters from config, one word per
term, "Go on". Files: everything above plus `guide/start.ts` and `guide/roadmap.ts`.

## Risks
- **The sheet and the map:** `fitMap` needs a definite height and a repaint costs ~250 ms, so the map resizes once
  when the sheet comes to rest. iOS needs `env(safe-area-inset-*)`.
- **One stylesheet:** the phone rewrite can break the laptop; 1366–1440 px gets checked every step.
- **The hub tap** switches tabs today; the spec says it never does.
- **The rule's ruleset bump** makes every saved test world stale (the existing toast says so). QA should know.
- **No UI tests:** logic goes into pure functions so vitest reaches it.
- **The bundle** is 3.6 MB; the art note's typefaces come only if art delivers them subset.

## Testing each step
- Every step: `npm run typecheck`, `npm run test:web` while working, the full `npm test` (~7 min) before handover,
  `npm run build` and `build:site`.
- New tests (`apps/web/test/onboarding.test.ts`): tab visibility; card profit; the walkthrough from the act log (a
  dispatcher win ticks nothing); the night forecast; pay lines summing to the event; a corrupt onboard record.
- **Phone smoke:** the built test page in the browser pane at 375 × 812 and 1440 × 900, S0–S9 played at 30×, a
  screenshot per screen. Pass means no sideways scroll, targets ≥ 44 px, the map drawn after every sheet move, no
  console errors, and the onboarding state back after a reload.

## Estimate
About seven sessions: step 0 one; 1–2 one and a half; 3 half; 4 one and a half; 5–6 one; 7–8 one; QA's fixes
half. Steps 1–2 land first; 4–6 share `mapview.ts` and `main.tsx`, so they run in sequence, not in parallel.
