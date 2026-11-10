# Early delivery for a fee: the director's design (2026-11-10)

For the economy to size and engineering to build behind a switch, in a later ruleset than 0.24.1.

**The reading.** I read Jeff the same way: pay to have an ordered truck delivered sooner. The other reading, a
load delivered early, isn't a sink. Out there a shipper paying for speed pays a carrier, and the game already has
that market (hot loads, and the same-day premium before Jeff). If Jeff meant loads, this note doesn't apply and
I'll redo it.

## 1. What can be expedited
- **Yes:** a new tractor from the NPC dealer's queue, and a new trailer from its queue, each its own fee.
- **No, a used-lot rig:** the starter's lot rig now comes from stock in a week (0.24.1). That week is prep,
  inspection and transport, and it is the floor (§4). There is no queue to jump.
- **No, a player dealership's order, for now:** when dealerships open (day 28), a player dealer may sell its own
  expedite at its own price, paid to it. That's a transfer, not a sink, and it belongs to the dealership layer.
- **No, anything not on order:** no fee buys a truck that isn't ordered, and none applies to a liquidation sale.

## 2. Where it's offered, and what the player is told first
- **Where:** the Dealer's order sheet, as a second button beside Order; then on the ordered truck's card
  ("Expedite") until the floor.
- **Before paying, in this order:**
  - "Delivered Apr 19 · with expedite Mar 8 (42 days sooner)"
  - "Fee 2,400 FD, paid now, not refunded"
  - "Waiting costs about 3,100 FD: the lessor's 15% for 42 days" (or the loan payments running in the meantime,
    if they start at the order)
- **What waiting costs is only shown where the game computes it.** That means the lessor's share and payments
  already due. It never shows invented lost earnings.

## 3. What's true out there: a limited number of slots, and nobody pushed back
An expedite fee buys a build slot or room on a delivery truck; it doesn't conjure one. So:
- **A fixed number of expedite slots a week, nationally,** apart from the ordinary queue (the economy sizes it, as
  a share of the week's deliveries).
- **Paying takes the earliest open slot.** Once a week's slots are taken, the date offered is the next week's. The
  card always shows the real earliest date.
- **Nobody else's ordered date moves.** My 2026-11-10 ruling stands: the date given at order is the date the truck
  arrives. Expedites drawing on the ordinary queue would break that for everyone else.
- **The fee scales with the days saved** (a share of the truck's price per week saved, capped), so a short
  expedite is cheap. Sizes are the economy's.

## 4. The floor, and paying after ordering
- **The floor:** never sooner than 7 days from payment (prep and transport), never the same hour, and never sooner
  than the lot's from-stock week. Engineering may set the exact hours; the economy may raise the floor.
- **After ordering: yes,** at any time until the floor, at the then-earliest open slot and the fee for the days it
  saves then.
- **No refund,** including if the order is later cancelled. The fee is a sink.

## 5. Iuliia
- **She prices both sides in figures:** the fee against what waiting costs.
- **She recommends it only when the figures say so,** and only if the player keeps the cushion she advises
  afterwards: "It pays for itself: the fee is 2,400, the lessor's 15% for those 42 days is about 3,100."
- **Otherwise she says it doesn't pay:** "Waiting costs about 900 here; I'd keep the 2,400."
- **She never suggests buying FD to pay it.** The game never steers a player to spend real money.

## 6. Bots: the same rule
Bots use the same slots, the same fee and the same floor, on a first-come basis. Their rule is Iuliia's: expedite
when the fee is less than what the wait costs and the cushion holds. That also checks her advice in the sims.

## For the economy
- Size the weekly slots, the fee curve and the floor.
- Read the gate with it on. Under the cap a new sink refills the NPC freight budget, so it isn't neutral.
- Report how often bots take it. A slot pool emptied by bots every week is a design fault I want to see.
