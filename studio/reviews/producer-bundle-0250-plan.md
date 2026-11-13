# The producer's plan: ruleset 0.25.0, one bundle, one live restart (2026-11-13)

Jeff's decisions (2026-11-13): "1. B, 2. this bundle, 3. done, max effort". Bundle the next ruleset and go live once;
delivery windows are in this bundle; the planning is done at max effort.

## What the ruleset carries (0.25.0-phase0.43; every key on in packages/config/src/live.ts)
- Delivery windows: windows.enabled, with batches 1 to 9 (batch 8's sizes: windows.ratioExponent 0.5,
  windows.facilityBlockWeeks 26; batch 9's facility pricing).
- The settlement fee: token.settlementFee.enabled, share 0.01, with its two follow-ups (the refund on a player
  shipper's default; the display readers).
- Early delivery for a fee: assets.expedite.enabled (built, screens built in 8b, paired with 0.24.1 on).
- The director's rules C, H and I (the three keys in engineering-rules-chi-2026-11-13.md) and the night in town
  mid-leg (businesses.parking.stopInTownMidLeg). They move no bot; their test is QA's and a player's.
- Not in it: the AI brokers' fix, the NPC trade-in, standing with a shipper, the days-away rule, the listing bought
  while the lease runs. Each needs its own pair or is not built yet; they make the ruleset after.

## Tracks, owners and order
A. Director, now: the windows screens, what a player sees and does (director-windows-screens-2026-11-13.md).
B. Engineering: the fee's two follow-ups (in progress) → the AI brokers' fix (engine only, not in the bundle; it fills
   the wait) → as soon as A lands, the windows screens (client batch W). W's new strings go in a NEW file,
   apps/web/src/copy-windows.ts, never copy-pending.ts or copy.ts, so W never waits on the writer. Then, with the
   producer's switch-on commit, the tests that assume the bundle's keys off in the live levers.
C. Economy, now: the combined gate. Every bundle key on together against 0.24.1 as live today; ten seeds, 1460 days,
   cap-off twins. The question is whether the fee and windows together keep the carriers' floor (the fee alone read
   74% against the 72% line on its worst seed). Verdict: ready as sized, or what to resize (economy-bundle-0250-gate-
   2026-11-13.md).
D. Red team, now: an exploit pass on the bundle's mechanics from the code: booking ahead, releases and keeps, claims,
   no-shows and lost loads, the same-day premium, holds under windows, the settlement fee's exemptions, the expedite
   slots, rules C, H, I and the mid-leg night (redteam-bundle-0250-2026-11-13.md). A short second look at W's screens
   after they land.
E. Writer, now: word every placeholder shipped since batch 8a (8b, 8c, 8d, 8e, the fee's and the expedite's screens,
   the monthly report's copy-report.ts, the persistence lines), owning copy-pending.ts, copy-pending-rules.ts,
   copy.ts and copy-report.ts until it reports (writer-catchup-2026-11-13.md). Then copy-windows.ts once W lands.
F. Producer: the switch-on commit (the keys, the version, HANDOFF's check string, engineering's test fixes) once A–E
   are in and W is committed.
G. QA: one replay of the whole bundle on the test page after F (qa-0250-2026-11-13.md).
H. Producer, at max effort (asked of Jeff again then): the live rebuild at the switch-on commit, the publish with the
   store rules (players, players/{self}, reports, reports/{self}, and world: read view, write owner), the restart of
   the empty live world on lanes-live-1/0.25.0-phase0.43.

## Gates before the live step
The combined gate passes; the red team clears the bundle and W's screens; QA's replay is clean; the writer's two
passes are in. Any fail goes back to its owner and the step repeats.

House rules unchanged: nothing staged by roles; every wait loop inside a script file; the live page and its store
stay the producer's.
