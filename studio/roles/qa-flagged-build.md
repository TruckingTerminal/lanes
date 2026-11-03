# A flagged build for QA (engineering, 2026-11-02)

How to see a switched-off feature (the player brokerage, Cash it now) on a test page **without touching any shared
file**. The shared `economy.config.ts` and `game.ts` stay exactly as they are; a build script patches copies of them
as esbuild loads them, and writes the page to a directory of your own. Nothing here is committed.

Never edit the shared config to flip a switch, not even for a minute: on 2026-11-02 another role's commit took the
whole file while a temporary `cashNow: true` sat in it (fixed in 4127dd1).

**Build a commit, not the shared tree, when you're checking a commit.** The script bundles whatever sits in the checkout,
other roles' uncommitted edits included (`node_modules/@lanes/*` link into the shared `packages/`). To check exactly a
commit, `git archive <commit> | tar -x -C "$SCRATCH/tree"`, run `npm ci` there (or link its `node_modules/@lanes/*` to its
own `packages/`), and run steps 1 to 3 from that copy (QA, 2026-11-03).

## 1. Make the check script (once per session; it follows the current build.mjs)

From the repo root (`lanes/`), in your own scratchpad (`$SCRATCH` below is any directory of yours outside the repo):

```bash
SCRATCH="<your scratchpad>"; mkdir -p "$SCRATCH/flagged"
python3 - "$SCRATCH" "$PWD" <<'EOF'
import sys, subprocess
S, ROOT = sys.argv[1], sys.argv[2]
WEB = f"{ROOT}/apps/web"
src = open(f"{WEB}/build.mjs").read()
esb = subprocess.check_output(["node", "-e", "console.log(require.resolve('esbuild/lib/main.js'))"], cwd=ROOT, text=True).strip()
src = src.replace('import { build } from "esbuild";', f'import esbuildPkg from {("file://" + esb)!r};\nconst {{ build }} = esbuildPkg;', 1)
src = src.replace('const here = dirname(fileURLToPath(import.meta.url));', f'const here = {WEB!r};\nconst OUT = process.env.CHECK_OUT;\nif (!OUT) throw new Error("set CHECK_OUT");', 1)
src = src.replace('join(here, "dist"', 'join(OUT')
plugin = '''
// Check-only: flags patched into the bundle as files load; the shared sources are never written.
const FLAGS = JSON.parse(process.env.CHECK_FLAGS ?? "[]");
const flagPlugin = { name: "check-flags", setup(b) {
  b.onLoad({ filter: /(economy\\.config|apps\\/web\\/src\\/game)\\.ts$/ }, (args) => {
    let s = readFileSync(args.path, "utf8");
    for (const [file, from, to] of FLAGS) if (args.path.endsWith(file)) { if (!s.includes(from)) throw new Error(`check flag not found: ${from}`); s = s.replace(from, to); }
    return { contents: s, loader: "ts" };
  });
} };
'''
src = src.replace('const result = await build({', plugin + 'const result = await build({\n  plugins: [flagPlugin],', 1)
open(f"{S}/check-build.mjs", "w").write(src)
print("wrote", f"{S}/check-build.mjs")
EOF
```

## 2. Pick the flags

Each flag is `[file ending, exact text in that file, replacement]`. The build stops with "check flag not found" if a
text has moved; re-read the file and adjust the text.

**The player brokerage** (the switch on, the brokerage layer open at the company's start, and 150,000 FD granted to the
test company so the 93,009 FD start is affordable):

```bash
export CHECK_FLAGS='[["economy.config.ts","  brokerage: {\n    enabled: false,","  brokerage: {\n    enabled: true,"],["game.ts","    this.player = c;\n    Object.assign(this.log","    this.player = c;\n    this.w.ledger.post(this.w.t, \"faucet:test\", `co:${c.id}`, 150_000, \"check\");\n    if (this.w.ladder) this.w.ladder.brokerage = Math.floor(this.w.t / 1440);\n    Object.assign(this.log"]]'
```

**Cash it now** (just its switch; a small fleet's invoices appear after its first deliveries, about day 5):

```bash
export CHECK_FLAGS='[["economy.config.ts","      cashNow: { enabled: false,","      cashNow: { enabled: true,"]]'
```

Both at once: put all three entries in one JSON list.

## 3. Build and serve

```bash
export CHECK_OUT="$SCRATCH/flagged"
node "$SCRATCH/check-build.mjs" --site      # the test page (speeds, the small-fleet start) → $CHECK_OUT/site/index.html
python3 -m http.server 5199 --directory "$CHECK_OUT" &
```

The script's own log still prints "dist/site/index.html"; the files are in `$CHECK_OUT` all the same.

Open `http://localhost:5199/site/index.html` (the test page, with the speed button and the small-fleet start). Without
`--site` the script writes the local page instead: `http://localhost:5199/local-lanes.html` ("Test world", the
owner-operator start only).

Port 5199 is yours: 5183 is the shared preview (`.claude/launch.json`, apps/web/dist), which these steps never write.

## 4. Check it's clean

```bash
git status --short packages/config apps/web/src/game.ts   # must print nothing
```

When done, stop the server (`kill %1`, or the PID `python3 -m http.server 5199` printed). The flagged page is in your
scratchpad only; nothing to revert.

## Where things are on the flagged page

- **The brokerage:** More › Brokerage (the start sheet, three steps); after starting, the chip at the left of the top
  strip switches companies; Book (Offered to you appears at a round, 06:00 or 18:00), Carriers (the standing order and
  "Offer to {carrier} first"), Money (Move money, the bond meter). The hold lasts 12 game hours: at "Day in 6 s" that's
  3 real seconds, so use Live pace or Day a minute to act on a held tender.
- **Cash it now:** Money › Owed to you (each invoice's second line and button), Finance › Open invoices; What now?
  offers it first when the company is in debt with invoices that clear the line.
