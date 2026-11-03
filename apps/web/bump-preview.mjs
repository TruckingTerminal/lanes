// The bump preview (studio/roles/bump-preview-build.md): the test page of a named commit with the restart's bump on, so
// the player and QA replay the rules the restart will run before it runs them. The shared checkout is never written:
// the commit is unpacked into a private tree, the bump goes into that tree's LIVE_LEVERS (packages/config/src/live.ts),
// and the tree builds itself with its own build.mjs.
//   node apps/web/bump-preview.mjs [--commit <ref>] [--port <5190–5194>] [--out <dir>] [--brokerage-aids] [--no-serve]
// --brokerage-aids: QA's flagged-build aids for the brokerage replay (the brokerage layer open at the company's start and
// 150,000 FD granted to the test company, so the 93,009 FD start is affordable). Never for the player's replays.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The bump table: studio/reviews/economy-player34.md, "The bump", rows 1–33 (28 levers, the brokerage's 3, the Reserve and cash now). */
export const BUMP = {
  "board.overCeilingMax": 1, // 1
  "board.refuseOverCeiling": true, // 2
  "labor.payFloorShareOfMarket": 0.85, // 3
  "labor.unhappyNoticeDays": 7, // 4
  "labor.underpayMemory.days": 56, // 5
  "labor.underpayMemory.askPremium": 0.1, // 6
  "rates.npcCeilingMarkup": 1.2, // 7
  "rates.exitDeadheadMaxShareOfMiles": 0.5, // 8
  "rates.seasons.volumeGain": 1, // 9
  "hos.restHours": 10, // 10
  "hos.breakMinutes": 30, // 11
  "fuel.stopEveryMi": 400, // 12
  "fuel.stopMinutes": 15, // 13
  "hos.cycleHours": 70, // 14
  "safety.enforcement.fineEarnedMult": 3, // 15
  "safety.review.auditDays": 14, // 16
  "safety.enforcement.oosHours.hos": 34, // 17
  "safety.enforcement.oosHours.defect": [24, 48], // 18
  "safety.review.hiddenDetect": 0.6, // 19
  "contracts.closedToBadRating": true, // 20
  "guard.dispatcherDefaultOn": false, // 21
  "guard.autoStaffDefault": false, // 22
  "guard.hireCoverWeeks": 4, // 23
  "equipmentFinance.netOfPurchaseLoans": true, // 24
  "equipmentFinance.closedWithPools": true, // 25
  "usedMarket.npcLot.deliveryDays": 7, // 26
  "safety.review.probationDays": 365, // 27
  "labor.hiring.settleAtStop": true, // 28
  "brokerage.enabled": true, // 29, a switch
  "permits.suretyPctPerYear": [0.01, 0.06], // 30
  "token.credit.premiumMax": 0.1, // 31
  "cashReserve.enabled": true, // 32, a switch
  "token.payment.cashNow.enabled": true, // 33, a switch
};

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORTS = [5190, 5191, 5192, 5193, 5194];

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();

const sha = git("rev-parse", "--short", `${opt("--commit", "HEAD")}^{commit}`);
const port = Number(opt("--port", PORTS[0]));
if (!PORTS.includes(port)) throw new Error(`--port: the preview's ports are ${PORTS.join(", ")} (5183 is the shared preview, 5198 engineering's, 5199 QA's)`);
const aids = args.includes("--brokerage-aids");
const out = opt("--out", join(tmpdir(), "lanes-bump-preview", `${sha}${aids ? "-aids" : ""}`));
const tree = join(out, "tree");

// 1. The commit, unpacked: nobody's uncommitted edits ride along.
rmSync(out, { recursive: true, force: true });
mkdirSync(tree, { recursive: true });
execFileSync("sh", ["-c", `git archive ${sha} | tar -x -C "${tree}"`], { cwd: ROOT });

// 2. Its node_modules: the workspace links point into the tree's own packages (relative, as npm made them); every other
// package is the checkout's installed copy.
const nm = join(tree, "node_modules");
mkdirSync(join(nm, "@lanes"), { recursive: true });
for (const name of readdirSync(join(ROOT, "node_modules"))) {
  if (name === "@lanes" || name === ".package-lock.json") continue;
  symlinkSync(join(ROOT, "node_modules", name), join(nm, name));
}
for (const [name, to] of [["agents", "packages/agents"], ["config", "packages/config"], ["data", "packages/data"], ["engine", "packages/engine"], ["sim", "apps/sim"], ["web", "apps/web"]]) {
  if (existsSync(join(tree, to))) symlinkSync(join("..", "..", to), join(nm, "@lanes", name));
}

// 3. The bump, into the tree's LIVE_LEVERS (applyLevers throws on a path this commit doesn't have).
const live = join(tree, "packages/config/src/live.ts");
const anchor = "/** A config with the levers applied by path";
let src = readFileSync(live, "utf8");
if (!src.includes(anchor)) throw new Error("live.ts: the applyLevers anchor moved; update bump-preview.mjs");
src = src.replace(anchor, `// The bump preview (apps/web/bump-preview.mjs): economy-player34.md "The bump", rows 1–33.\nObject.assign(LIVE_LEVERS, ${JSON.stringify(BUMP, null, 2)});\n\n${anchor}`);
writeFileSync(live, src);

// 4. QA's brokerage aids, only when asked.
if (aids) {
  const game = join(tree, "apps/web/src/game.ts");
  const from = "    this.player = c;\n    Object.assign(this.log";
  const g = readFileSync(game, "utf8");
  if (!g.includes(from)) throw new Error("game.ts: the join anchor moved; update bump-preview.mjs");
  writeFileSync(game, g.replace(from, `    this.player = c;\n    this.w.ledger.post(this.w.t, "faucet:test", \`co:\${c.id}\`, 150_000, "check");\n    if (this.w.ladder) this.w.ladder.brokerage = Math.floor(this.w.t / 1440);\n    Object.assign(this.log`));
}

// 5. Check the tree's game config reads every row as the bump sets it, then build the test page.
const check = join(out, "check.mts");
writeFileSync(
  check,
  `import { GAME_CONFIG } from "${join(tree, "apps/web/src/game.ts")}";\nconst bump = ${JSON.stringify(BUMP)};\nconst bad = Object.entries(bump).filter(([p, v]) => JSON.stringify(p.split(".").reduce((o: any, k) => o?.[k], GAME_CONFIG)) !== JSON.stringify(v));\nif (bad.length) { console.error("not applied:", bad.map(([p]) => p).join(", ")); process.exit(1); }\nconsole.log(\`all \${Object.keys(bump).length} rows read as the bump sets them\`);\n`,
);
execFileSync(join(ROOT, "node_modules/.bin/tsx"), [check], { cwd: tree, stdio: "inherit" });
execFileSync(process.execPath, [join(tree, "apps/web/build.mjs"), "--site"], { cwd: tree, stdio: "inherit" });
const dist = join(tree, "apps/web/dist");
writeFileSync(join(dist, "site", "bump.json"), JSON.stringify({ commit: sha, aids, rows: BUMP }, null, 2));
console.log(`bump preview of ${sha}${aids ? " (brokerage aids)" : ""}: ${dist}/site/index.html`);

// 6. Serve it on its own port (Ctrl-C stops it).
if (!args.includes("--no-serve")) {
  console.log(`serving http://localhost:${port}/site/index.html`);
  spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", dist], { stdio: "inherit" });
}
