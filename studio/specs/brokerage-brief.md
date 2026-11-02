# Brokerage at day 91 (director's brief for UX, sprint 2 item 3; 2026-11-03; owner: the director)

The live world runs on 0.20.0. Day 91 is about 23 real days from this morning. This brief says three things: what a player should see before and after day 91, what the engine already has, and what UX must decide. The first section changes the size of item 3, so read it first.

## First: today, day 91 opens a crime, not a broker

QA's broker pass (`playtests/2026-11-02-sprint1-replay.md`, part two) read the re-post button as the start of brokerage. It is not: it is double brokering.

- **The re-post is the fraud action.** **Re-post the load (won at X)** on the Truck card is `rebroker_load` (`engine/src/fraud.ts`). The engine's own comment calls it re-posting a load "without a broker's license". The Dispatcher's "Re-post some won loads" row is the same thing on autopilot.
- **"Pay the hauler" is the choice to pay the carrier or not.** Unticked, the player keeps the whole rate and the carrier who hauled is never paid. That is QA's B6, the label nobody could explain.
- **The brokerage layer only lifts the fraud gate.** The ladder's `brokerage` layer gates `rebrokerLoad` and nothing else a player can do. `fraud.players` is on, so on the live world a stranger will find a crime at day 91, presented as the broker layer, with no crime word on it.
- **No player can become a legal broker.** Every player company is formed `role: "carrier"` (`apps/web/src/game.ts:74`), and no action changes a role. The legal broker in the engine is an AI company formed as a broker. It runs a standing order (`kind: "broker"`, a margin and a cap on open loads), and the engine hands it NPC tenders by weight.
- **Help promises more than exists.** It says day 91 brings "a licence, a bond, and the right to post loads". No player can get any of the three.

**What this means.** Item 3 is not chrome over a finished engine. It needs a rule (a way for a player to hold a broker's licence) and Jeff's word on its shape. Then it needs the usual chain: the economy sizes it and runs the sim, the ruleset is bumped, and the world restarts with no players. That restart is free only until the first beta player joins, which may come before day 91.

**Whatever Jeff decides, now (chrome only, no restart):**
- Take the re-post button off the Truck card.
- Take the re-post rule off the Dispatcher.
- Drop "Pay the hauler" from every player screen.

Double brokering stays in the engine for the AI's outlaws. For players it belongs to the Back Lot (`DESIGN-BAD-ACTORS.md`), under the studio's rule that crime stays out of the guide. A modified client can still send the action. That hole is the server sprint's, and the red team already lists it.

## The decision for Jeff: how does a player become a broker?

1. **A broker desk in the company you already run (my recommendation).** From day 91, a carrier may take out a broker's licence, lock the bond and take NPC shippers' tenders onto its own book, alongside its trucks.
   - It keeps one name, one Intel card and one story.
   - It fits the ladder: the layer opens for the player you already are.
   - It fits pillar 3. The 75,000 FD stake, the bond cap, shipper defaults and the contract lag make it earned and risky.
   - Its cost is engine work. Every check now keyed to `role === "broker"` needs a home for a company that both hauls and brokers: the licence stake, the bond cap, the surety, "brokers broker legally", and the broker's flat 5% factoring. The economy must say which invoices factor at the fleet's rate and which at 5%. My reading of Jeff's rule: the desk's receivables at 5%, the trucks' at the fleet line.
2. **A second company, formed as a broker.** It costs less in the engine, because the role exists. But it splits a player into two names. It doubles the accounts a person runs, and the red team already lists same-owner farming as a server-sprint hole. And it gives the stranger's one-truck story a second company with nothing in common with the first.

**If the desk isn't built and restarted in time:** the brokerage card stays up past day 91 and says "a later beta" in place of a date. Nothing changes in the rules.

## What the player sees (assuming the desk)

**1. Before day 91: the teaser** (the bible's rule, `BIBLE.md`, "Teasers stay").
- It lives in More, under Coming soon. The card holds one line on what brokers do, the opening day as a date, and one Iuliia line.
- Its one working action: **See what brokers earned last month**, which opens Intel's broker rows (`specs/intel.md`).
- Rename the Logbook's ladder row and Help's roadmap from "Re-brokering" to "Brokerage". In the engine, "re-brokering" is the crime's word.

**2. Day 91.** Iuliia says one line, once, and the card becomes the brokerage screen.
- If the player can't afford the stake, the screen still works: it shows what the licence takes and how far away they are. There is no dead tap.
- For scale: QA's small fleet held 216k on day 98. An owner-operator holds far less, so the licence is a fleet player's step, by design.

**3. The licence.** One sheet with three costs and one button. All three costs are in config, and each shows the player's own figure.
- The licence: 300 FD, renewed each season.
- The bond: 75,000 FD locked as a stake (`staking.roles.broker`). The sheet says how the stake leaves, and what happens under it: 14 days' grace, then no new loads.
- The surety premium: 2% to 12% a year on the bond, by the player's credit. Show their band's figure in FD.
- A sentence on what the bond is for. If the player can't pay a carrier, the bond does. What the player owes carriers can never pass the bond: a tender that would pass it goes to another broker.

**4. Posting.**
- A tender arrives: lane, trailer, the shipper's contract rate, and the rate the player posts at (the contract less their margin).
- The posting appears on the board marked as theirs. The engine already refuses their own bids on it.
- The board fee (3% of what the freight pays) shows on the card before posting.
- The player sets the margin, the cap on open loads, and the vetting tier they require of carriers: Open, Standard or Strict (`set_vetting`).

**5. The carrier's trail.** One card per brokered load, showing its stage:
- Tendered, posted, won by {carrier} at {rate}, picked up, delivered.
- The shipper pays the player at net 30, or, about one load in fifty, never.
- The player pays the carrier.

Every stage is a feed line in the writer's words. QA's expected line for B4 is the model: "{lane} posted at {rate}; {carrier} took it at {rate}; your margin {fd}".

**6. The margin.**
- Per load: the shipper's pay, less the carrier's, less the board fee, less any fall-off charge.
- Per month: the total, the defaults, the fall-offs, the surety premium and the licence fee.
- One risk line, in Iuliia's words or the card's: the contract rate trails the spot market by a month, so a boom squeezes a broker and a bust pads one.

**7. Money.**
- Owed to you: each row shows a lane and a "brokered" tag, not a load number (QA B5).
- A new "Owed by you" list: what the player owes carriers, with a meter, "{x} of 75,000 bond used".
- Getting paid: the broker's 5% factoring. It lands with item 2 (QA B8).

## What the engine has, and what the chrome lacks

| Piece | Engine | Chrome |
|---|---|---|
| Licence fee, 75k bond stake, surety premium by credit | Yes, for AI brokers (`permits`, `staking.roles.broker`; the NPC surety writes bonds with the contract switch on) | Nothing (B2) |
| A player taking the licence | **No** | – |
| Tenders to brokers by weight, margin, cap on open loads | Yes (`freight.ts`, the `broker` order) | Nothing |
| The bond cap on what a broker owes, with a once-a-day notice | Yes (`receivables.ts` `apCapBlock`) | Nothing |
| Shipper defaults (2%, more in a slump), contract lag (30 days), fall-off charge (15%) | Yes (`brokerRisk`) | Nothing |
| Broker factoring at a flat 5% | Yes (`contract.brokerRate`) | The old one-year text (B8) |
| Board fee 3%; vetting tier on posts | Yes | Vetting shows on loads, but there is no setting for a poster |
| The trail (who hauled, at what, paid when) | The data: `Load.brokerId`, `carrierId`, `shipperRate`, `clearedRate`, the receivables | No feed lines, and unlabelled rows (B4, B5) |
| Carriers refusing low-credit brokers | Yes (`minBrokerCredit`) | Nothing: Intel shows the band |
| Hand-picking a tender, or re-pricing one posting | **No** | – |
| Double brokering (re-post, "pay the hauler") | Yes | **On screen: remove it** (B3, B4, B6) |

## What UX must decide

1. **Where brokerage lives on the phone's four-item bar.** My lean: inside Board, as "Your postings" beside the loads the player hauls. That keeps the bar at four, and the board is where a broker's work happens. A More entry is the alternative.
2. **The licence sheet:** its three costs, the stake's terms, and how it reads when the player is short.
3. **The book:** brokered loads by stage, one card each with the trail and the margin, and a monthly summary.
4. **Owed by you, and the bond meter.**
5. **Standing order or hand work.** The engine runs a broker on a standing order. For "I made a call", the bible's feeling, a player probably needs at least one call per load: take or pass a tender, or re-price a posting that isn't moving before it falls off. UX proposes, the economy prices it, and Jeff decides. It is a rule either way.
6. **The teaser's working action and Iuliia's two lines** (with the writer, under the placement rule).

## Not in this brief

- Double brokering and theft as player actions: the Back Lot's.
- Player shippers beyond facilities.
- The authoritative server.

## Done means

- Jeff has picked the desk or a second company.
- The economy has sized and simmed it, with the ruleset bumped and the world restarted while it has no players.
- UX's spec has passed the director's gate, the writer's lines are in, and engineering has built it.
- QA has replayed it on a phone before day 91 on the live world.
- Whatever else slips, the re-post is off the player's screens this week.
