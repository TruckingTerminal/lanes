# Red team: persistence (2026-11-10) — the test page's save, the live page's store, the replay

**Two findings reach the live world.** (1) A tab that sleeps through its writer lease and wakes after the player's other device has gone rewrites the player's record without that device's orders, for everyone and for good: shown on the stand-in store. (2) The minute an order takes effect is stamped by the client and the store takes whatever the player's page writes, so a wrong clock, or a player with the console open, puts orders into everyone's past: read from the code and the store's contract. The two-tab overwrite is the test page only (the live page has a lease). The reload that came back as a different world was a panel redraw lag on the test page (QA found it; §5), not a different world: the replay matched the live run to the hash in every check.

Read only, nothing staged; scripts in my scratchpad (`persist/*.ts`, listed at the end). Engine measured: the working tree at 11:25 (c8c67db plus the later commits and engineering's uncommitted edits of the morning) and, for the richer replay check, a worktree at c8c67db, the build the player had (lanes-play's version.json read c8c67db from 10:27 to 11:16 local; the reload was at about 11:03).

## Ranked

| # | Finding | Who | Gains or loses | Reaches | How sure | Smallest fix |
|---|---|---|---|---|---|---|
| 1 | A stale writer tab rewrites the player's record whole and drops the newer orders | an unlucky player with two devices; an attacker wanting an undo | the other device's orders are erased from history (a truck bought, a load booked, an FD trade); pages that saw them keep them in memory, fresh pages never see them: the world splits | **live** | shown (stand-in store, same `set` semantics) | re-read the document before every write and append after what is there; re-read on any lease renewal after a gap longer than the lease |
| 2 | The order's effect minute comes from the client; the store accepts any body, `at` and `s` | an honest player whose clock is off by more than ten minutes; a player with devtools | honest: every order lands in everyone's past, every page replays; forged: a bid on a load whose round has cleared, an FD trade with hindsight, unbounded | **live** | read from the code and from db.d.ts (`set` replaces, last writer wins, the lease "is NOT a security boundary") | always take the clock from the lease's server-stamped expiry (drop the ten-minute guard) and refuse an `at` outside [now, now + lead]; forgery needs a writer the client can't be (a server or an owner relay that stamps each order): a product decision |
| 3 | Any late order makes every page replay the world from the seed | nobody gains; a griefer, or just slow networks | minutes of replay on every page, over and over (75 s at day 50 on the test page) | live | read from the code | the server stamp above, and a checkpoint the replay can start from |
| 4 | Two tabs, the last to write wins; a tab that reloads doesn't even re-save | a save-scummer | a free undo on the test page | test page only | shown by the player; read from the code | a Web Lock on the world key: the second tab watches and never persists (about fifteen lines) |
| 5 | A reload that is not the same world | — | — | test page | closed: a panel redraw lag, found by QA (§5) | the loop's `before` read before the steps |
| 6 | The test page's hour can be cut in half by the page's own event listener, and a restore drops an order the replay refuses without saying so | an unlucky player | a half-stepped hour the log doesn't record; a lost order | test page | read from the code | wrap the listener call (the live page already does); log a dropped order |
| 7 | Rules at publish | — | if the publish declared no `players/{self}` rule, any Contributor can rewrite any player's document and world/meta | live | can't see the declaration from the code | confirm the published `db` rules: `players` read view / write owner, `players/{self}` write interact, `world` write owner, `reports/{self}` write interact |

## 1. Live: the stale writer tab (shown)

What the page does (apps/web/src/live.ts). A player's record is one document, `players/<uid>`, holding `{v, acts, archived}`; every write is `doc.set` of the tab's whole in-memory list (`flushOwn`), and the store's `set` is a full replace, last writer wins, no transactions (db.d.ts). One tab per player may write: `players/<uid>/x/tab` is a cooperative lease, 120 s, renewed every 30 s by a timer. The lease is the only thing standing between two tabs, and it is honoured only by code that asks.

The hole. A tab's renewal timer stops while the device sleeps (lid closed, phone off); the lease lapses after 120 s. Another device opens, takes the lease, reads the document (correct), plays, writes, closes; its lease lapses. The first tab wakes; its next renewal acquires the lease, and because the tab never saw a failed renewal (`had` is still true) it does not re-read the document. Its in-memory list is the old one. Its next order is written whole over the store: the other device's orders are gone. The same with the network cut instead of sleep: a renewal that throws leaves `writer` true ("transient").

Shown with `persist/stalelease.ts` (two LiveWorld pages of one player on MemoryDb, a fake clock, the renewal timer fired by hand):

```
store after A:            0:join 1:set_standing_orders[1]
store after B:            0:join 1:set_standing_orders[1] 2:set_standing_orders[2] 3:set_standing_orders[3]
A awake: writer=true lease=held; A's own log: 0:join 1:set_standing_orders
store after A's next order: 0:join 1:set_standing_orders[1] 2:set_standing_orders[1]     ← B's 2 and 3 erased, A's order took s=2
fresh page sees p1's orders as: floor                                                      ← B's dispatcher is gone from history
```
The contrast path works: when A's renewal fires while B still holds the lease, A drops to watching and re-reads the document when it gets the lease back (`writer=false lease=busy`, then A2's log carries B2's order).

What it costs. An unlucky player: phone open on the game, pocketed; an hour on the laptop (a truck bought on a loan, two loads booked); the laptop closed; the phone picked up and any button pressed: the laptop hour is erased from the record. Every fresh page, and every late joiner, computes a world in which it never happened. Pages that had already ingested the laptop's orders keep them (`ingest` never removes an entry; a rewritten sequence number only triggers a rebuild), so until those pages reload, two worlds run. An attacker: the undo button on the live world. Play the risky orders on device B (a bid at a thin margin, a used truck, an FD sale); if they go well, close A without acting; if badly, let A act once. The cost is four minutes of waiting and a second device.

Fix. Smallest, in `flushOwn`: `get` the document, and if it holds a sequence number this tab doesn't know, take its list and renumber the new order after it (the write becomes an append in effect). And in the renewal timer: keep the time of the last successful renewal; if more than the lease's TTL has passed, treat the lease as lost (re-read before writing); on a renewal error, set `writer` false until the next success. Also `ingest`: when a document comes back without entries this page holds, drop them (or rebuild from the store's lists only), so pages don't split. A test for live.test.ts: the sequence above.

Safe and unsafe writes, for the record:
- `players/<uid>` `set`: unsafe as above; safe only while exactly one tab holds a fresh copy.
- `players/<uid>/log/c00000…` `set`: written once, never rewritten; if the chunk lands and the document write fails, the document still holds those entries and the next load dedups them by sequence (harmless).
- `players/<uid>/x/tab` `acquire`: cooperative only.
- `reports/<uid>` `set`: read-modify-replace of the list; a report sent from a second device in the same seconds is lost; harmless.
- `world/meta` `set` (owner, `createMeta`): a read then a write with no lease; two owner tabs clicking "Open the world" together can both read "none" and both write; the last seed wins. Once, at creation; take the lease on `world/meta` first.
- A page left open across a deploy: it keeps the old build (version.ts checks once, at boot) and keeps writing orders, which is fine; what it computes is the old engine's world. A client-only republish that changes replay without a ruleset bump splits open pages from fresh ones until they reload; the test page's `stale` guard has the same blind spot (the string carries only the config version).

## 2. Live: the client stamps time (read from the code)

`submit` sets `at = max(prev.at, ceil(gameMinute()) + 2)` and writes it. `gameMinute()` is the device clock plus an offset learned from the lease's server-stamped `expiresAt`, but only when the offset is under ten minutes (`takeLease`); a clock further off keeps the raw device clock. So a clock an hour slow stamps every order in everyone else's past: on every other page `r.at < this.w.t` → `needRebuild` → the whole world replays with the order inserted an hour back (and a clock an hour fast makes the page compute hours nobody has acted in yet, then rebuild on every order that arrives). The guard is backwards: a small drift is corrected, a large one kept.

With the console open the page is the player's: `window.claude.use("db")` then `doc("players/<uid>").set({...})` with any `at`, any `s`, any body. Every page applies it in order (`before`: minute, uid, sequence). The engine validates the body, nothing validates the time. A second, watching device (no lease needed to watch) shows the round's result; the writer device then files a bid on that load stamped a minute before the round, at the winning rate less a cent; every page rebuilds and the bid wins, the bot that had it loses it, the world recomputes from there. The same for `buy_fd`/`sell_fd` against a price already seen, or taking a load back. Not a two-honest-clients race: with honest clients the lease stops the second writer and both compute the same world, so nothing is gained by racing. There is no store-side timestamp on documents (db.d.ts gives a server stamp only on `acquire`), so no page-side check holds against a forger.

Fix. Honest half, small: drop the ten-minute guard (use the server offset always; with no lease a tab can't write anyway) and refuse at submit an `at` outside [server now, server now + lead]. Forged half: an order must be stamped by something the client can't be: a writer that holds the only write grant and stamps each order (an owner-run relay, or a server). Until then the live world is honest-clients-only, which is a decision for Jeff. In the meantime a page can at least mark, in the ticker, an order that arrived stamped before the page's own clock by more than the lead.

## 3. Live: the replay cost (read from the code)

Any order arriving after its minute, from any player, triggers `rebuild` on every page: the whole log from the seed (the diary's 75 s at day 50; the warm start alone is 246 hours). The lead is 2 game minutes (30 real s) and the store's subscription falls back to a 30 s refresh when the stream is down, so lateness is routine on a bad network. A player writing late-stamped orders on purpose keeps every page replaying. The server stamp above removes the lever; a checkpoint the replay starts from (the world serialized at a day boundary, which the one-world rule also wants for a migration) removes the cost.

## 4. Test page: two tabs (shown by the player, read from the code)

What is saved: the whole `TestLog` as one localStorage key, `lanes.testworld.v1`: `{v, ruleset, seed, name, start, hub, look, warm, t, acts}`, `acts` as `[minute, action]` pairs (a third entry "brokerage" when the brokerage gave it). When: `persistTest()` once per frame, which writes only when `t` or the act count changed since this tab's own last write and at most every 5 s; forced on every order (`act`/`order`), on the hub choice, on `pagehide` and when the tab is hidden. Replaced whole; no version, no tab id, no `storage` listener; the guard compares with what this tab last wrote, never with the key.

So in the diary: tab B (opened from the key) writes its older-and-further world every 5 s while it runs; tab A's reload fires `pagehide`, but A's log hadn't changed since its forced save at the hire, so A writes nothing and B's save stands; A's Continue reads B's world: the hire gone, the clock at Sat 00:00 (B ran 8 s at Day in 6 s, 32 hours from Thu 16:00). A tab closed while paused writes nothing either.

Guard: `navigator.locks.request("lanes.testworld", { ifAvailable: true }, lock => …)` at Continue and at New world; the tab that gets the lock keeps it for its life (never resolve the callback); a tab that doesn't shows "Your world is open in another tab; this one only watches" and `persistTest` returns without writing while the flag is set (the live page's lease, for free; every current browser has Web Locks). Without Web Locks: before each write, read the key and compare its `t` and act count with what this tab last wrote or restored; a mismatch means another tab wrote: stop persisting and say so. Test page only: the live page's lease covers this, apart from §1.

## 5. Test page: the reload that was a different world (closed: a display lag, found by QA)

**Closed 2026-11-10 by QA's hunt (studio/reviews/qa-reload-hunt.md, 3fd21b9):** twenty-four reloads, every restored world byte for byte the saved one. The cause is the page's loop (main.tsx, about l.551–573): `before` is read after the hour's steps, so the "minute changed" test never fires and the panels redraw only on the one-second timer, while the clock redraws every frame; at Day in 2 s a truck's card and the cash sit hours of game time behind the clock beside them. My sentence below that nothing lags was wrong: the values are the engine's, but the panel showing them can be a second old. The replays below stand.

The diary: before the reload `Wed 04:00 · 34,159 FD · Loaded Harrisburg → Hoover · 73 mi to go`; after it `Wed 04:00 · 34,139 FD · Unloading at Hoover`. The clock on the state line is the engine's `w.t` (TopBar `clockMin()`), the miles are `t.remainingMi` (logic.tsx), nothing is interpolated; the save carries `w.t` at `pagehide`. I took that for "a different history, not a lag"; the lag is in when the panel redraws, not in what it reads (see the closing line above).

What I ran (`persist/replay.ts`, `persist/replay2.ts`): a test world from a fixed seed, the warm start, the small-fleet start at LAX, the page's loop (an hour a step, orders between hours, `booksAfterHour`), then `TestGame.restore` of the log and a hash of the world (every balance, every truck's status, place, miles, odometer, every load, every company):

| run | engine | days | orders | panels' reads each hour | replay vs live |
|---|---|---|---|---|---|
| replay none | working tree 11:25 | 26 | dispatcher on, lot rig on a loan, listing | none | same, every daily checkpoint |
| replay own | same | 26 | same | own credit, loan terms, cash-now rates | same |
| replay intel | same | 26 | same | plus every broker's credit (Intel open) | same |
| replay2 c8c67db | the deployed build c8c67db, a worktree | 40 | hand booking, hire (accepted), dispatcher on, lot rig on a loan, send home, cash it now, the defaults (7 orders) | own | same at day 40 to the hash; a second restore the same |

Ruled out from the code: no panel writes the world (every `x.y =` in apps/web is on canvases); the engine never reads the wall clock or `Math.random` (one seeded stream, forked by subsystem); no config write at run time; no deploy during the session; the one engine memo a read can fill (credit scores, cached per round and day, `credit.ts`) is created at the day change by the engine's own calls, since the dispatchers' book-now pass (every two hours, midnight included) runs before the day's settlements, and the board round creates it at every round; tab B can't have written a world with the same clock and the same lane. Not ruled out: the player's actual log, which has orders mine doesn't (a hire that settled, a loan truck sold, idle fees, three shoulder tickets, dispatcher switches) and a reading of the clock I can't check.

The decisive test, cheap: the saved log from the pane that played on port 4180 (`localStorage.getItem("lanes.testworld.v1")` in that profile, a JSON string). Restored twice in node and compared at every day: different means the engine is non-deterministic on that history and the first differing hour names the subsystem; the same means the live world held something the log doesn't (an order the restore refused and dropped, or a half-stepped hour, §6), and the log's last orders say which. `persist/replay2.ts` takes a log file with one more flag; I'll run it the moment I get the file.

## 6. Test page: two robustness holes (read from the code)

- The engine calls `w.listener` with no try/catch (board.ts and elsewhere), and the test page's loop steps the hour outside any try (`main.tsx loop`, `t.stepHour()`); the live page's `advance` wraps the step. An exception in `onEvent` (a card's text on an odd state) aborts the hour after `w.t += 60` (step.ts:57) with the rest of the hour undone and `log.t` not advanced, and the loop never reschedules: a frozen clock, and a save that disagrees with the screen. Wrap the step as the live page does.
- `TestGame.restore` re-logs only the orders the replay accepts (`g.act` pushes on `ok`); a refused one vanishes from the new log without a word. Log it (or keep the original list) so a save of a restored world can't lose history silently.

## 7. The published rules

The code assumes `players/<uid>` is "that player only" and `world/meta` the owner's; the store enforces that only if the publish declared it (`capabilities.db.rules`); by default every Contributor writes every shared document (db.d.ts). I can't see the declaration from the code. If it isn't there, any player rewrites any player, and the world's seed.

## Files and commands (scratchpad, not the checkout)

the red team's scratchpad, `persist/`: `stalelease.ts` (§1), `livepages.ts` (two pages, one with Intel-style reads: same world, 6 days), `replay.ts` and `replay2.ts` (§5; `--root <checkout> --days N --reads none|own`), `run-all.sh` (the gated runner; logs beside it). A worktree at c8c67db (removed after the run). Every run was behind an empty `pgrep -f "vitest|apps/sim/src/run.ts|_wsim"`.
