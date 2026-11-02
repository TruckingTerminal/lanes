# Brokerage strings (writer, draft 1, 2026-11-03; against `brokerage-rule.md` and UX's `brokerage-ux.md` draft 0)

Every string on the brokerage path: the teaser before day 91, forming the brokerage, the company switch, the brokerage's four tabs, posting and the carrier's trail, Jeff's two direct-freight flows (Pass to `{brokerage}`; Tender to `{carrier}`), moving capital between the two companies, and Intel's "same owner" line. Iuliia's brokerage lines are in `iuliia-lines.md`. `{key}` is read from `economy.config.ts`, never typed; `{x}` without a key is a value from the world. Sentence case; no string over 20 words. No crime words anywhere: the studio's words for the self-dealing rules stay in the director's brief.

**Marked [size]:** waits on the economy's figures or a rule the brief leaves open. The string is drafted; its number or its existence may change.

Short key names used below:

| Short | Config key |
|---|---|
| `{opensDay}` | `unlockLadder.layers.brokerage.afterDays`, shown as a game date |
| `{licence}` | `permits.brokerLicenseRenewalFd` |
| `{bond}` | `permits.brokerBondFd` (the stake is `token.staking.roles.broker`; the two must agree) |
| `{suretyPct}` | `permits.suretyPctPerYear`, by credit band |
| `{graceDays}` | `token.staking.graceDays` |
| `{brokerRate}` | `token.payment.factoring.contract.brokerRate` |
| `{defaultRate}`, `{lagDays}`, `{fallOff}` | `brokerRisk.defaultRate`, `.contractLagDays`, `.fallOffShare` |
| `{boardFee}` | the board fee's share (3% today); engineering names the key (UX's question 6) |
| `{termsDays}` | `token.payment.termsDays` |
| `{transferFee}` | the capital transfer's fee share, proposed 1% to the reserve; engineering names the key. **[Jeff to confirm]** |
| `{bandLow}`, `{bandHigh}` | the lane's band for a hauler's pay per mile, from the economy **[size]** |

## Renames, everywhere a player reads

| Where | Now | Becomes |
|---|---|---|
| Help's roadmap, the layer's line | Re-brokering opens on day … a licence, a bond, and the right to post loads for other carriers. | Your own brokerage opens on day `{opensDay}`: a licence, a bond, and freight to post for other carriers. |
| The Logbook's ladder row | Re-brokering | Brokerage |
| Any other "re-broker", "re-post" on a player screen | | removed with the action (60d1a26); "post" is the brokerage's verb |

## Before day 91: the teaser

| Where | String |
|---|---|
| More › Coming soon, row | Brokerage · Opens `{date}` |
| Card, what it is | Your own brokerage: a second company that posts freight for other carriers to haul. |
| Card, what it takes | You'll need an active carrier and `{bond}` FD for the bond. |
| Card button | See what brokers earned last month |
| Truck tab, seven days before, title | Brokerage opens `{date}` |
| Its rows | Bond: `{bond}` FD, locked while you broker · Licence: `{licence}` FD a season · Surety: about `{fd}` FD a year at credit `{band}` |
| Its buttons | See what brokers earn · Dismiss |

## From day 91: starting a brokerage

One verb throughout: **start**. UX's draft says "Form"; the director's says "Start". "Start" is the plainer word, so the button, the sheet and the refusals use it.

| Where | String |
|---|---|
| More, the card, once open | Start a brokerage |
| Not yet qualified, card lead | What it takes, and how far you are: |
| Its rows | An active carrier · `{yours is / yours isn't}` · Bond: `{bond}` FD · you have `{fd}` FD · Licence: `{licence}` FD |
| Short of the bond | You're `{fd}` FD short. |
| Link | What brokers earned last month › |
| Once started, More's row | `{brokerage name}` › |

**The sheet.** UX's draft has four steps (name it, the licence, fund it, your terms); the producer's brief names the licence, the bond, the surety and the switch. The strings below cover all of them: the licence, bond and surety are one step, as the director's "one sheet before the button" asks, and the switch is the moment after the button. UX settles the step count.

| Where | String |
|---|---|
| Step counter | Step `{n}` of `{total}` |
| Buttons | Back · Next |
| **Step: name it** | Name your brokerage |
| Field | Brokerage name (default "`{carrier name}` Logistics", 32 characters) |
| Field [size] | Home hub (any hub, or your carrier's: the brief leaves it open) |
| **Step: what it costs** | What a brokerage costs |
| Row | Licence · `{licence}` FD a season · a cost |
| Row | Bond · `{bond}` FD · held, not spent, while you broker |
| Row | Surety · about `{fd}` FD a year at credit `{band}` · a cost |
| Note | If you can't pay a carrier, the bond does. You can never owe carriers more than it. |
| Note | Fall under your bond and new loads stop after `{graceDays}` days. |
| Note [size] | Your brokerage starts with its own credit, not your carrier's. |
| Note | There's no starting grant: the money comes from your carrier. |
| Short of the bond | You're `{fd}` FD short. · Next, disabled: Not enough for the bond yet. |
| **Step: fund it** | Fund it from `{carrier name}` |
| Rows | Moving from `{carrier}`: `{fd}` FD · `{carrier}`'s cash after: `{fd}` FD · `{brokerage}`'s cash after: `{fd}` FD, `{bond}` of it the bond |
| Note | Your own capital, moved between your companies. It's not revenue or a cost for either. |
| **Step: your terms** | Your terms |
| Rows | Your margin: `{pct}` of each load · Open loads, at most: `{n}` · Who may haul your loads |
| Vetting segments | Open · Standard · Strict |
| Lines under them | Any carrier · `{vetting.standard.minAuthorityDays}` days of authority · `{vetting.strict.minAuthorityDays}` days and `{vetting.strict.minDelivered}` loads delivered |
| Under the control | Tighter is safer, and slower to fill. |
| **Confirm** | Start `{brokerage name}` · then the summary, one row per step |
| Button | **Start `{brokerage name}`** · live: Sent · in effect `{hh:mm}` |
| **The switch, once started** | You're in `{brokerage name}` now. Your carrier is one tap away, top left. |

**Refusals** (red, under the button, the plain reason):

| Case | String |
|---|---|
| Carrier not active | Your carrier's authority must be active to start a brokerage. |
| Carrier winding up | Your carrier is being wound up. |
| Already has one | You already have a brokerage. |
| Before the day | Brokerages open on `{date}`. |
| Age gate [size] | Your carrier needs `{n}` days of authority first. |
| Barred after a revocation [size] | A revoked brokerage bars a new one until `{date}`. |

## The company switch

| Where | String |
|---|---|
| Chip, phone (accessible name) | Company in view: `{name}` |
| Chip, laptop | `{name}` ▾ |
| Sheet title | Your companies |
| Row | `{name}` · `{Carrier / Brokerage}` · `{fd}` FD · `{n}` need you |
| Current row | In view |
| State line | `{name}` · `{n}` loads posted (brokerage) / `{name}` · `{state}` (carrier, as today) |
| Needs list, a row for the other company | `{icon}` `{text}` · tapping switches, then opens it |
| Map pin, brokerage | `{lane}` · posted at `{rate}`/mi |

## The brokerage's bar

**Book · Carriers · Money · More.**

### Book

| Where | String |
|---|---|
| Header | `{name}` · `{n}` loads · `{fd}` FD margin this month |
| Groups | Offered to you [size] · On the board · Moving · Waiting for pay |
| Offered card | `{lane}` · `{trailer}` · Shipper pays `{fd}` FD · You'd post at `{fd}` (your `{pct}` margin) · Board fee `{fd}` |
| Its actions [size: hand calls] | Post it · Tender to `{carrier name}` · Decline (the middle one only on freight a shipper sent you directly, and never on a load your carrier passed you) |
| On the board | Posted at `{rate}`/mi · clears `{hh:00}` · in `{wait}` |
| Moving | Taken by `{carrier}` at `{rate}`/mi · picked up `{date}` |
| Waiting for pay | Shipper pays you `{date}` · you pay `{carrier}` `{date}` |
| Card line 2 | Shipper `{fd}` · carrier `{fd}` · fee `{fd}` · **yours `{fd}` FD** |
| The trail | Tendered · Posted · Taken · Picked up · Delivered · Paid |
| Load sheet | each stage with its date · Carrier: `{name}` › · Shipper pays you: `{date}` · You pay the carrier: `{date}` |
| Fall-off | Nobody took it: you paid the shipper `{fallOff}` of the contract, `{fd}` FD. |
| Empty | No loads yet. Shippers offer loads to brokers every round; yours start at `{hh:00}`. |

**Feed lines** (the trail, one line per stage):

| Stage | String |
|---|---|
| Posted | Posted `{origin}` to `{dest}` at `{rate}`/mi. |
| Taken | `{carrier}` took `{origin}` to `{dest}` at `{rate}`/mi; your margin `{fd}` FD. |
| Delivered | `{origin}` to `{dest}` delivered. The shipper pays you `{date}`; you pay `{carrier}` `{date}`. |
| Fell off | Nobody took `{origin}` to `{dest}`: a `{fd}` FD fall-off charge. |
| Shipper didn't pay | The shipper didn't pay for `{origin}` to `{dest}`. You still owe `{carrier}` `{fd}` FD. |
| Passed by at the bond | A load passed you by: taking it would have put you past your bond. |

### Carriers

| Where | String |
|---|---|
| Card | Who may haul your loads · the vetting control and its lines, as in the sheet |
| Card | Carriers who've hauled for you |
| Row | `{name}` · `{n}` loads for you · `{pct}` on time › |
| Your own carrier's chip | Yours |
| Card [size: its fields] | Your standing order · Margin `{pct}` · Open loads, at most `{n}` · **Save** |

### Money

| Where | String |
|---|---|
| Cash | Cash · `{fd}` FD |
| Owed to you | Owed to you · `{lane}` · brokered · `{fd}` · due `{date}` |
| Its risk line | About `{defaultRate}` of loads are never paid, more in a slump. |
| Owed by you | Owed by you · `{lane}` · `{carrier}` · `{fd}` · due `{date}` |
| Bond meter | `{fd}` of your `{bond}` FD bond in use |
| At the bond | New loads pass you by until this falls. |
| This month | Margin · Shippers who didn't pay · Fall-off charges · Surety premium · Licence fee · Net |
| Rate lag line | Your contract rates trail the open board by `{lagDays}` days: a boom squeezes you, a slump pads you. |
| Link rows | Getting paid: `{Net {termsDays} / Factoring until {date}}` › · Move capital › |
| Capital log row | Capital from `{carrier}`: `{fd}` FD / Capital to `{carrier}`: `{fd}` FD · private |
| Own-company paper | Paid at net `{termsDays}`, never factored: it's between your own companies. |

Finance's broker variant (`finance-strings.md`) covers getting paid at `{brokerRate}`.

## Pass to `{brokerage}` (on the carrier: a load from its direct contract)

Jeff, 2026-11-02, as the director's brief revision 1 words it: a carrier with a brokerage may pass the loads its direct contract tenders to it, never a board load, with every brokerage requirement standing. The button names the receiving company. It shows on a direct contract tender only, once the player has a brokerage, and is greyed out with its reason when a check fails.

| Where | String |
|---|---|
| Tender card button | Pass to `{brokerage}` |
| Under it | `{brokerage}` takes the load under its bond. The shipper pays it; you neither bill nor owe. |
| Sheet title | Pass to `{brokerage}` |
| Rows | Shipper pays `{brokerage}` · `{fd}` FD · Bond in use after · `{fd}` of `{bond}` FD |
| Rows | Then · `{brokerage}` posts it, or tenders it to another carrier · Your contract · counts it covered once delivered |
| Buttons | **Pass to `{brokerage}`** · Not now · live: Sent · in effect `{hh:mm}` |
| Feed, carrier | Passed `{origin}` to `{dest}` to `{brokerage}`. |
| Feed, brokerage | `{carrier}` passed you `{origin}` to `{dest}`: `{fd}` FD, under your bond. |

**Greyed out, with the reason under the button:**

| Check | String |
|---|---|
| A board load | Only a load from your direct contract can be passed. |
| Past the bond | `{brokerage}` would pass its bond. Pay carriers first. |
| Under its stake, or not licensed | `{brokerage}` isn't taking loads: `{reason}`. |
| Window closed | The tender's window has closed. |

**If a passed load falls off** (the shipper is made whole once, by the brokerage):

| Where | String |
|---|---|
| Feed, brokerage | Nobody took `{origin}` to `{dest}`: you paid the shipper a `{fd}` FD fall-off charge. |
| Feed, carrier | `{origin}` to `{dest}`, passed to `{brokerage}`, fell off. Your stake is untouched; the shipper will remember. |

## Tender to `{carrier}` (on the brokerage's Book)

Jeff, 2026-11-02: a brokerage that receives freight directly from a shipper may tender it straight to the player's own carrier, without the board. The producer's guard: the hauler's pay stays inside the lane's band.

| Where | String |
|---|---|
| Button | Tender to `{carrier name}` |
| Sheet title | Tender to `{carrier name}` |
| Rows | Shipper pays you · `{fd}` FD · You pay `{carrier}` · [`{rate}`]/mi · Allowed on this lane · `{bandLow}`–`{bandHigh}`/mi |
| Rows | Board fee · none [size] · Your margin · `{fd}` FD |
| Note | Paid at net `{termsDays}`, never factored: it's between your own companies. |
| Note | The load counts once for you, not twice. |
| Buttons | **Tender at `{rate}`/mi** · Not now · live: Sent · in effect `{hh:mm}` |
| On the carrier's Truck tab | From `{brokerage}` · `{origin}` to `{dest}` · `{rate}`/mi · accept by `{hh:mm}` · **Accept** · Decline |
| After a decline | Declined. `{brokerage}` posts it to the board. |
| Feed, brokerage | Tendered `{origin}` to `{dest}` to `{carrier}` at `{rate}`/mi; your margin `{fd}` FD. |
| Feed, carrier | `{brokerage}` tendered you `{origin}` to `{dest}` at `{rate}`/mi. |

| Refusal | String |
|---|---|
| Outside the band | That's outside this lane's range: `{bandLow}`–`{bandHigh}`/mi. |
| Not direct freight | Only freight a shipper sent you directly can go straight to your carrier. |
| No truck in reach | `{carrier}` has no free truck in reach of the pickup. |
| Carrier can't take it | `{carrier}` can't take it: `{reason}`. |
| A load the carrier passed | `{carrier}` passed you this load. It can't go back: post it, or tender it elsewhere. |

## Moving capital

On both companies' Money, under the link rows.

| Where | String |
|---|---|
| Sheet title | Move capital |
| Direction | From `{company}` to `{other}` · Swap (both ways) |
| Field | Amount |
| Rows | Fee · `{fd}` FD (`{transferFee}`, to the reserve) · `{other}` receives · `{fd}` FD |
| Rows | `{company}`'s cash after: `{fd}` FD · `{other}`'s cash after: `{fd}` FD |
| Note | It counts as equity, not revenue: no profit, no Miles, no Intel figure. |
| Note | Logged in both companies' Money. Nobody else sees it. |
| Button | **Move `{fd}` FD** · live: Sent · in effect `{hh:mm}` |

**Refusals** (the guards, in plain words):

| Guard | String |
|---|---|
| Liquidating | `{company}` is being wound up, so nothing can leave it. |
| In grace under its stake | `{company}` is under its stake. Nothing leaves until it's back above. |
| Overdue paper | `{company}` has overdue invoices. Pay them first. |
| Would go negative | That would leave `{company}` below zero. |
| Below the bond with paper open | The bond stays while loads are open. You may move up to `{fd}` FD. |

## Intel

| Where | String |
|---|---|
| Both cards | Same owner as `{other company}` › |
| Broker card, first line | Credit `{score}` · band `{band}` |
| Broker card, rows | Bonded · Requires `{open / standard / strict}` vetting · Authority `{n}` days old |
| Broker card, last month | `{n}` loads brokered · `{pct}` hauled · `{pct}` fell off · `{fd}` FD revenue |
| A row | `{hub}` · broker · credit `{band}` |
| Pinned | How others see you · your two companies, the one in view first |
