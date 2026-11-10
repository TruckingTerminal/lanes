# Play diary: the stubborn specialist

- **Who I was:** a reefer hauler who starts at the thinnest hub on offer, skips the walkthrough, ignores Iuliia and What
  now?, keeps the dispatcher off, takes long empty miles, sends the driver home at odd moments, and tries to get stranded
  and then out.
- **Build:** lanes-play `87864b2` (Deploy c8c67db), version.json `{"build":"c8c67db"}`, ruleset 0.24.0-phase0.41.
- **Screen and speed:** phone, 375 × 812. "Day a minute" for decisions, "Day in 2 s" between.
- **How long:** about 30 real minutes, Thu Jan 11 to Thu Mar 7, Year 1 (game day 56, four days short of the 60-day floor; I misread the date while playing and saw it only on the title screen).
- **Where I ended:** Tropic Cold Chain, Miami, the small-fleet start. The reefer (driver Frank Lowe) is hauling
  Clay Center NE → Athens GA. The dry van (me) has sat in Miami since day 1. 17,672 FD (from 25,000). February: 2 loads,
  kept 3,180 FD.
- **Fresh world:** REPLACE IT from the title. Nothing carried over.
- **Screenshots:** in [play-2026-11-10-stubborn-specialist/](play-2026-11-10-stubborn-specialist/).

## The diary

**Day 1, the thinnest hub.** ALL HUBS → Miami: "The end of the road. Freight arrives by the boatload and leaves thin, so
locals keep what there is. … 1 loads posted last round · 1.55/mi average · 0.5 loads per truck · slow · Reload: hard ·
Shippers hold 75% of van loads for locals first · Insurance: 35% above the base rate · Security: risky." That's
perfect, and exactly what I wanted. ("1 loads" is a plural slip.) Small fleet, for the reefer.

**Day 1, the reefer I can't use.** The board has a truck selector, a native dropdown "Truck 1 · Dry van / Truck 2 ·
Reefer" ([01](play-2026-11-10-stubborn-specialist/01-miami-van-board-truck-select.jpg)). The van's Miami board: one
load I can take, −596. The reefer's: Miami → Sandy Springs at 4.85/mi, +1,907. The reefer has no driver, and BOOK NOW
on it was enabled. I tapped it and got "The truck isn't idle with a driver." It's a fair refusal, but only after the
tap: the board shows reefer loads for a truck that can't take them.
More is locked until a first load ("First, a load"), so I can't reach Staff to hire. The van's loads all lose. I bid
the least-bad one, Coral Springs → Columbus GA. The card said "+26 FD at 2.24", but the bid range on the load page
started at 2.32 ("A gamble: pays 464 FD more than Book now if it wins at 18:00"). Result: "Lost to 2.28/mi · your bid
2.32 · your break-even 2.21 · Lost to Zepeda Trucking at 2.28/mi". The lowest bid the game allowed was above the price
that won, so I couldn't have won it.
Then What now? said "Hire a driver for Truck 2. … HIRE A DRIVER", and that button went straight to Staff, the page More
had told me was locked ([02](play-2026-11-10-stubborn-specialist/02-hire-from-what-now.jpg)). The lock is real from one
door and not from another. Hired Frank Lowe (★★★, 0.83/mi) with a clear confirm.

**Day 2–10, the reefer earns.** Villas FL → Sherwood AR, +2,657. With the reefer heading empty to the pickup, I pressed
"Send home after this run · Home time · 5 days off". The card explained it: "Home for days off after this run: on a load
headed that way, or empty once it's within 400 mi of home or has waited 2 days for one." A second line on the same card
said "or empty within 2 days idle". Two wordings, one rule. After delivery it drove itself home to Miami for five days
off. Good.

**Day 10–20, the log fills.** "Truck 1 has been idle 12 d 3 h at Miami: The dispatcher is off, so nobody bids for this truck
while you're away." Then 11 d 3 h, 10 d 2 h, 9 d 2 h, one line per day for the parked van, burying everything else in
Today.

**Day 21, breaking home time.** With Frank two or three days into his five days off, I booked Ocoee FL → Alma, Nebraska
(1,621 mi, 252 mi empty, +5,318). The truck left at once: "Heading empty to Ocoee for a pickup · 260 mi". No warning
that I'd cut his time off short. Reefer rates out of Florida in late January: 6.9–10.9/mi. The cold chain pays.

**Day 30–40, stranded on purpose.** Delivered in Alma, Nebraska. Dispatcher off. "Truck 2 has been idle 9 d 3 h at Alma". The
card offers "Bid by hand", "Home time · 5 days off" and "Send to Wichita". There's no "back to work" home option here,
though the absentee's card had one. What now? said: "Bid on Pembroke Pines to Dyersburg instead. You lost the last one.
This load clears near 2.46/mi and pays 411 FD over break-even." That's a Florida van load, for the van, about my lost
bid on day 1. Nothing about the reefer sitting nine days in Nebraska. I tapped "Send to Wichita": "Running empty to
Wichita · 267 mi". Wichita had 9 reefer loads; booked Clay Center NE → Athens GA at 5.90/mi. Out, by hand, easily,
once I looked at the truck card instead of What now?.

**Day 56.** February kept 3,180 FD on 2 loads (63% loaded), "Idle fees 660 FD" for the van I never moved. There's no
setting anywhere to sleep in town rather than at a truck stop; the driver chooses.

## Holes and bugs

| # | What I did | What I expected | What happened | Repeated? | How bad for a stranger |
|---|---|---|---|---|---|
| 1 | Bid on a van load at the lowest allowed (2.32) | A chance to win | Lost to 2.28; the floor was above the clearing price; the card had said "+26 FD at 2.24" | Once | Medium–high: a bid that can't win |
| 2 | What now? while the reefer sat 9 days in Nebraska | Advice for the stuck truck | Advice for the other truck's lost bid from day 1 | Once | High for this persona: the guide watches the wrong truck |
| 3 | BOOK NOW on a driverless reefer | The button disabled | Enabled; refused after the tap ("isn't idle with a driver") | Once | Low–medium |
| 4 | More → Staff before the first load | Same answer from every door | More says "First, a load"; What now? → HIRE A DRIVER opens Staff | Once | Low–medium |
| 5 | Booked during the driver's home time | A warning, or the booking waiting | Home time ended silently 2–3 days early | Once | Medium (fatigue) |
| 6 | Parked van with the dispatcher off | One line saying it's parked | A new "idle N d" line every day, flooding Today | Every day | Medium |
| 7 | Home choices on the truck card | The same choices everywhere | "Back to work" option here missing, though the absentee had it | Seen | Low |
| 8 | Hub sheet | "1 load" | "1 loads posted last round" | Seen | Low |

## The five things that most got in the way
1. A bid floor above the winning price.
2. What now? looking at the wrong truck.
3. The parked truck's daily log line.
4. Doors that disagree about whether Staff is locked.
5. Cutting home time short without a word.

## The three best moments
1. Miami's hub sheet. Every word true, including "Security: risky".
2. Reefer rates out of Florida in winter. Being a specialist pays when you pick the right specialty.
3. "Send to Wichita" from a dead town: one tap, a real way out.

## What I did not understand
- How to move myself from the van to the reefer.
- Why my bid's lowest allowed price was above the market.
- Whether booking during home time costs the driver anything.

## Ugly or broken
The native truck selector on the board looks out of place on the phone, but works.

## Would I come back tomorrow?
Yes. Reefer out of Florida is a real niche and the game rewards it. Without the dispatcher, though, the game should
watch my trucks for me in What now?, and today it doesn't.

## What the game is about, as I understood it
Each trailer has its own market. The thin hub is thin for vans and fat for reefers in winter. A stubborn player who
picks a niche, minds the truck card and moves by hand can do fine. The guide is built for the player who does what it
says.
