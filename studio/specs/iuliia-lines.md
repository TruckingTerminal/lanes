# Iuliia's contextual lines, and the truck makes (writer, sprint 2 draft 1, 2026-11-02)

Jeff, 2026-11-02: "Iuliia should have a different dialogue depending on which tab you are on and which button or card you're pressing. Some humor is allowed." This spec gives her a line for each tab on entry and for each key button and card, with two or three variants so she doesn't repeat. It also sets a rule for how often she speaks, and ends with four fictional truck makes for the Dealer.

Her register is unchanged: an executive who ran a fleet of four hundred trucks in Moscow. Poised, dry, warm underneath, sass by understatement. She names Russian things (her grandmother, the samovar, the Volga, Tolstoy) and never says a Russian word. Every line is under 20 words. Numbers, where any appear, come from the config.

## How often she speaks

Engineering wires the hook later. The rule keeps her a colleague, not a nag.

- **The walkthrough comes first.** While a step's own line is showing, contextual lines wait.
- **Tabs:** one line on the first entry to each tab in a sitting, never again that sitting.
- **Buttons and cards:** a line on the first use, then one use in four, chosen at random.
- **Never two lines within `{iuliia.quietSeconds}` real seconds** (proposed 60), whatever triggered them.
- **Never over bad news she didn't cause:** no line on an error, a refusal, a crash or a liquidation. Those get the plain string alone.
- **Variants rotate.** She uses each variant of a line once before any repeats.
- **Where:** the caption strip under her portrait, for six seconds, then the step's Do line returns.
- **"Quiet"** on the Iuliia tab mutes contextual lines; step lines stay. The setting is per browser.

## Tabs, on entry

| Tab | Variants |
|---|---|
| Truck | Your truck. Look at it as an accountant would, then as a mechanic. · Every truck has a story; the odometer writes it. · Check where it sleeps tonight. My grandmother checked the doors twice. |
| Loads | The board. Read the ceiling before you fall in love with a rate. · Nearest first. An empty mile pays nothing and burns fuel. · Every load here is somebody's emergency. Price it accordingly. |
| Money | The ledger never lies. It only waits for you to read it. · Cash first, then what's owed, then what you wish were owed. · Read this page weekly, like an executive, with tea. |
| More | The rest of the house. Some rooms are still being painted. · Help is in here. So am I, which is better. |
| More › Iuliia | My clipboard. Every step on it, ticked or not. · Read ahead if you like. I won't tell. |
| More › Help | Every system, every number. I've read it twice; once was for pleasure. · The handbook. Dry, complete, occasionally right before I am. |
| More › Company | Your record. Brokers read it before they read your rate. · Reputation is slow to build and quick to spend. |
| A teaser, any | Not open yet. Patience is also a business skill. · Coming. Tell us what you'd want; I pass it on. |
| Staff, once open | People are the dearest line in the ledger, and the only one that can quit. · Hire slowly. Tolstoy took six years over one book. |
| Dealer, once open | Window shopping is free. Signing is not. · Every truck here is somebody's dream. Buy yours with arithmetic. |
| Finance, once open | Read this before you need it, not after. · Quick pay for emergencies; factoring for a way of life. Choose carefully. |
| Rates, once open | Where freight pays, by trailer. A map of other people's mistakes. · Strong hubs pay to leave; weak ones pay to arrive. |
| Back Lot | Not yet. Keep the gate locked anyway. · A later chapter. Chekhov hung the gun in act one, too. |

## Buttons and cards

| Trigger | Variants |
|---|---|
| Book now | Booked. Decisive. I approve, provisionally. · Yours at the posted price. Now make the appointment. · Booked. Sometimes the bird in the hand is the whole lunch. |
| Bid | Bid in. Now we wait, which is most of this business. · A fair bid. The round will tell us whether the market agrees. · Placed. Refreshing the page doesn't help; I've tried. |
| Send empty | Empty miles. Expensive, but sometimes the only honest road. · Running empty toward better freight: a calculated retreat. · I'll pretend I didn't see the fuel bill. |
| Hire a driver | Pay decides who comes; home time decides who stays. · Learn their name. They'll be learning yours. |
| Delivered, on time | Delivered. Read the pay line, not just the top number. · On time. The shipper noticed, even if they'd never say so. |
| Delivered, late | Late. It happens once. Twice is a habit. · Late. The receiver will remember; so will your record. |
| Result: won | Won. Good price or good luck? Compare it with what it usually clears near. · Won. Enjoy it for one minute, then plan the reload. |
| Result: lost | Lost. If they went under your break-even, let them have it. · Lost by cents. Next round, look at "usually clears near." |
| Dealer: used lot | Four years, many miles, honest paint. The first truck should be this one. · My grandfather's Volga ran thirty years on pride. This one needs oil. |
| Dealer: new | Beautiful. Also a loan you'll feel every week. · New trucks lose value the moment they leave the lot. Like promises. |
| Dealer: lease | A lease is renting confidence. Sometimes it's worth the rent. · Someone else's truck, someone else's rules. Read the minimum. |
| Dispatcher switch, on | Good. It bids while you sleep. Check what it did in the morning. · Rules on. They behave on Tuesday; audit them on Friday. |
| Dispatcher switch, off | Off. Every load is yours to bid by hand, then. · Off. Brave, or tired of its taste. Either way, I'm watching. |

## Truck makes for the Dealer

Four fictional makes, each modelled loosely on a real one by role and reputation, never by name, badge or shape. Counsel reviews all four names, and checks them against existing trucking and automotive trademarks before anything ships; I haven't run that search. How the makes map onto the game's tractor tiers (Workhorse, Highway Pro, Flagship) is the director's and the economy designer's call.

| Make | Modelled on | Role | Dealer line |
|---|---|---|---|
| Keystone | Freightliner | the workhorse | Half the interstate drives one. Cheap to buy, cheap to fix, never pretty. |
| Meridian | Volvo | the economical | Built by people who measure fuel to the drop. Quiet, safe, kind to the books. |
| Ironwood | Peterbilt | the driver's favourite | Long hood, plenty of chrome, and drivers who stay for it. You pay for the loyalty. |
| Westmark | Kenworth | the premium | The one in the brochure. Best in the wind, best at resale, priced to match. |
