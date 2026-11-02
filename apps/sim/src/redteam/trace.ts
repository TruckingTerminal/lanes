/** Red team: trace the first `locked > balance` the launch fuzz found, down to the posting that caused it. */
import { dayOf, stepHour, companyAccount } from "@lanes/engine";
import { ruleBotHook } from "@lanes/agents";
import { liveConfig, makeWorld } from "./harness.js";

const seed = Number(process.argv[2] ?? 2);
const maxDays = Number(process.argv[3] ?? 45);
const w = makeWorld({ seed, cfg: liveConfig({ "token.betaYears": 0 }), keepEntries: true });
const hours = (maxDays * w.cfg.time.gameMinutesPerDay) / 60;
let found = false;
for (let h = 0; h < hours && !found; h++) {
  stepHour(w, ruleBotHook);
  const day = dayOf(w.t, w.cfg);
  for (const c of w.companies) {
    const acct = companyAccount(c.id);
    const b = w.ledger.balance(acct);
    const lk = w.ledger.locked(acct);
    if (b > 0.02 && lk > b + 0.02) {
      console.log(`VIOLATION day ${day} t${w.t} ${acct} (${c.name}) balance ${b.toFixed(2)} locked ${lk.toFixed(2)} launchDay=${w.token.launchDay}`);
      const mine = w.ledger.entries.filter((e) => e.from === acct || e.to === acct);
      console.log(`last ${Math.min(25, mine.length)} entries for ${acct}:`);
      for (const e of mine.slice(-25)) console.log(`  t${e.t} ${e.from} -> ${e.to} ${e.amount.toFixed(2)} (${e.ref})`);
      found = true;
      break;
    }
  }
}
if (!found) console.log(`no locked>balance in ${maxDays} days, seed ${seed}`);
