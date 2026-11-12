# Economy: the "sound" truck, and a brokerage's held tenders (2026-11-12)

For the producer: the condition behind client batch 8a's first-truck card (the director's ruling A: "sound" is the
condition at which expected repairs stay under a level the economy sets from the wear rules), and whether a player's
brokerage holding tenders is a hole. From the code at main (4ef09f3) and the live levers; nothing run.

## 1. Sound: condition 0.6 (`guide.soundCondition` 0.6, the placeholder kept)

**The level: expected repairs at no more than about twice a fresh truck's of the same mileage, and short of the point
where the owner should rebuild.** The wear rules give it directly. A breakdown's rate is `per1000MiNew × (1 + 8·wear²) ×
(1 + odometer / 800k)`, each costing 1,500–4,500 FD and a 6–18 hour stop; maintenance rises with wear (×2 fully worn) and
fuel use with it (−20% mpg fully worn). For a Workhorse and van:

| Condition | Repairs, × a fresh truck's | Expected repairs, FD/mi, at 200k · 450k miles | All wear costs, FD/mi at 450k | A breakdown every, at 450k |
|---|---|---|---|---|
| 1.0 | ×1.0 | 0.056 · 0.070 | 0.08 | 43,000 mi |
| 0.8 | ×1.3 | 0.074 · 0.093 | 0.16 | 32,000 mi |
| 0.7 | ×1.7 | 0.097 · 0.121 | 0.22 | 25,000 mi |
| **0.6** | **×2.3** | **0.128 · 0.160** | **0.29** | **19,000 mi (about two months' running)** |
| 0.5 | ×3.0 | 0.169 · 0.211 | 0.38 | 14,000 mi |
| 0.4 (the used lot's rigs) | ×3.9 | 0.218 · 0.273 | 0.47 | 11,000 mi (about a month) |

- **The rebuild point sits under it.** Minimizing the rebuild's cost (live: 31,500 for a Workhorse × (1 + odometer /
  500k)) plus the wear costs per mile puts the cheapest moment to rebuild at condition 0.57 on a new truck, 0.53 at 200k
  miles, 0.50 at 450k and 0.47 at 700k. A truck at 0.6 or better is one its owner would not yet rebuild at any mileage:
  it earns without the shop's big job first. That is what a newcomer means by sound.
- **In the owner-operator's terms:** an owner-operator keeps about 0.9 FD a mile (2,090 a truck-week over about 2,300
  miles). At 0.6 the wear costs take about a third of it; at the lot's 0.4 about half, with a breakdown a month.
- **One consequence to know before the card ships:** the used lot's rigs come at 120,000 miles since their rebuild, so
  condition 0.4, never sound; the card will price a listing at 0.6 or better or a new rig, and the lot's rig stays on the
  Dealer as the cheap, honest beater the director's wording already names ("expect about X a month in repairs"). That is
  true to the rules; if the card should be able to point at the lot, the lot's rigs need less wear on them
  (`usedMarket.npcLot.milesSinceRebuild` 80,000 gives 0.6), which is a market change for a pair, not this note.

## 2. A brokerage holding tenders: one line, no pair

**How it works today.** A shipper tenders a broker-only load to a broker drawn with weight `(0.25 + credit/100) ÷
margin²`, nationally, among brokers under their open-load cap, so a player's brokerage advertising 1% outweighs every AI
broker (5–12%) by 70–400 times and wins nearly every tender until its 20 are open. It holds each 12 hours, then posts it
at its order's margin, or by hand at any margin. Posted at 30%, a load sits at a ceiling few carriers take, its pay never
walks (a player poster's, QA's S4), and it falls off after ten rounds at a 15% charge. The red team ran it (redteam-0241
§1, the "low" brokerage: 538 held posts at 30% in a year): nobody's figures moved, and it cost the brokerage the
fall-offs.

**Is it a hole?** A small one, and not the one in the question: the brokerage cannot pick a hub's best loads (the tender
comes as it comes, nationally), and the harm is about 3–4 loads a day nationally at the cap of 20, paid for at 15% each.
The real fault is the **bait and switch**: the shipper picks the broker on the cut it advertises, and the broker then
takes a different cut. **The rule: a held tender posts at no more than the margin it was tendered at** (record the order's
margin on the hold at `startHold`; `postHeld` and the by-hand post cap at it). Then a brokerage wins tenders only by being
cheap and posts cheap, which is a service; a bad margin is one it advertised, and the shipper's weight already punishes it
(a 30% brokerage has a nine-hundredth of a 1% one's weight). The sims' brokerage pairs post at their order's margin, so
the ten-day digest should be identical; if it is, no pair. Under windows one more line for batch 7's sizes: a 12-hour hold
is a quarter to half of a load's 24–48 hours, so a held load should start its pickup window when it is released, or hold
for one round only where the load's lead is 0.
