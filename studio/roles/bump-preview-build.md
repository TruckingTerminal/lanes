# The bump preview build (engineering, 2026-11-03)

The restart's gate: the test page of a named commit with the bump on, so the player replays the trucker and the gamer
and QA replays the brokerage on the rules the restart will run. One command builds it and serves it on its own port.
**The shared checkout is never written**: the script unpacks the commit into a private tree and puts the bump there.

**The script:** `apps/web/bump-preview.mjs`. **The ports:** 5190–5194 (5183 is the shared preview, 5198 engineering's,
5199 QA's). One port per running preview; pick a free one.

## What it does

1. **Unpacks the commit** (`git archive <commit>`) into `$TMPDIR/lanes-bump-preview/<sha>/tree`, so nobody's
   uncommitted edits ride along. Its `node_modules` links the tree's own `packages/` and the checkout's installed
   packages; nothing is installed.
2. **Puts the bump in the tree's `LIVE_LEVERS`** (`packages/config/src/live.ts`), every row of the bump table in
   `studio/reviews/economy-player34.md`, "The bump":
   - rows 1–28, the levers;
   - rows 29–31, the brokerage (`brokerage.enabled`, the surety premium, the credit premium);
   - rows 32 and 33, the Reserve and cash now.

   The three switches are rows 29, 32 and 33: `brokerage.enabled`, `cashReserve.enabled`,
   `token.payment.cashNow.enabled`. The rows marked "–" in that table keep today's sizes, so the script doesn't set
   them. `applyLevers` throws on a path the commit doesn't have, so a moved key stops the build rather than going
   missing.
3. **Checks** that the tree's `GAME_CONFIG` reads all 33 rows as the bump sets them ("all 33 rows read as the bump
   sets them"), then builds the test page with the tree's own `build.mjs --site` (the speed button, the small-fleet
   start).
4. **Serves** `http://localhost:<port>/site/index.html`, with `site/bump.json` beside it naming the commit and every
   row, so a replay report can cite exactly what it ran.

The table lives in the script as `BUMP`. When the economy changes a row, change it there too; the script names each
row's number.

## Run it

From the repo root (`lanes/`):

```bash
node apps/web/bump-preview.mjs --commit <sha> --port 5190
```

- `--commit`: any ref; HEAD by default. Name the commit in the replay's report.
- `--port`: 5190–5194; 5190 by default.
- `--brokerage-aids`: **QA's brokerage replay only.** It adds QA's flagged-build aids: the brokerage layer open at the
  company's start and 150,000 FD granted, so the 93,009 FD start is affordable on day one. The build goes to its own
  directory (`<sha>-aids`) and `bump.json` says `"aids": true`. Never use it for the player's replays: the grant
  changes the economy he is testing.
- `--no-serve`: build only.
- `--out <dir>`: build somewhere else.

The build takes a few seconds. Leave the server running in a terminal or in the background; Ctrl-C (or killing the
`python3 -m http.server <port>` process) stops it. Nothing needs reverting.

## Before a replay

- **One world per browser profile** (the test page's save slot): use a private window, or the browser pane on this
  port alone, so a replay doesn't overwrite another's world.
- **Check it's clean:** `git status --short packages apps/web/src` prints nothing that this script made.
- **Say the commit and port in the report,** and whether the aids were on.

## Who replays what

| Who | What | Aids |
|---|---|---|
| The player | The trucker (owner-operator) and the gamer (small fleet) | no |
| QA | The brokerage (start sheet, Book, Carriers, Money, cash now, the Reserve) | `--brokerage-aids` |
