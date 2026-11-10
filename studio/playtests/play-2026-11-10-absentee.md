# Play diary: the absentee

- **Who I was:** someone who sets up the dispatcher and its standing orders in the first week and then looks in like
  someone checking on Sundays: three check-ins, weeks apart. I don't hunt through menus; I read the first screen,
  maybe tap What now?, and close the phone.
- **Build:** lanes-play `87864b2` (Deploy c8c67db), version.json `{"build":"c8c67db"}`, ruleset 0.24.0-phase0.41.
- **Screen and speed:** phone, 375 × 812. "Day in 2 s" while away (on the test page the clock only runs while the page
  is open, so "away" means the page ran untouched). Each check-in was a real reload: close, open, CONTINUE.
- **How long:** about 35 real minutes, most of it waiting, Thu Jan 11 to Tue Jul 11, Year 1 (game day 181).
- **Where I ended:** Harbor Gate Transport (LA's suggested name), Los Angeles, still on the lease after six months.
  96,560 FD in cash, 15,925 FD held toward a truck, no contracts. Monthly kept: Jan 20,653 · Feb 29,855 · Mar 15,848 ·
  Apr 12,357 · May 15,292 · Jun 12,584.
- **Fresh world:** REPLACE IT from the title. Nothing carried over.
- **Screenshots:** in [play-2026-11-10-absentee/](play-2026-11-10-absentee/).

## The diary

**Week 1 (Jan 11), set and forget.** What now?: "Book Fontana to Mount Pleasant. 5,160 over break-even, plus your 1,256
draw as the driver: 3,782 to cash now, 2,634 toward your truck." Booked. Dispatcher on. Under "More rules" I found the
three standing orders all off by default (book loads between rounds, move idle trucks to busier hubs, take contracts
from local shippers) and switched all of them on. The help text under "Ask at least break-even plus" is precise ("It
eases as the truck needs to move: down to break-even by 24 hours idle…"). Then I left.

**Check-in 1 (Feb 16, day 36).** "Loading your world…" took about a minute (my browser pane was hidden and probably
throttled; treat my load times as upper bounds). It opened paused. The first thing I saw was Iuliia: "Your first
month: earned 35,251, spent 14,598, kept 20,653 FD. The month's fuel tax is billed at the close. READ THE MONTH"
([01](play-2026-11-10-absentee/01-return-1-month-summary.jpg)). That's exactly what a person who's been away wants.
Send home now offers two honest choices: "SEND HOME · BACK TO WORK" and "HOME TIME · 5 DAYS OFF". Last round I
complained Send home forced five days off. It's fixed. What now? offered "Book Chattanooga to McMinnville … about 103
FD over break-even". Iuliia's page: "Next on the road: You can order today · ready May 16 … I'd wait for a sounder
one." The truck was 27,450 FD rich (64,440 by the next visit) and still leasing. Before I'd reloaded, the screen said
"Mon 14:00 · 20,921 FD". After: "Thu 06:00 · 27,450 FD", and the title had said "Continue · … · Thu Feb 16". Three
days and 6,500 FD appeared across a reload.

**Check-in 2 (Apr 23, day 102).** Again about 90 seconds of loading. No month summary this time, though two months
had closed (Feb and Mar). Just Iuliia: "The lessor's 15% ends the day you buy. Buy the used one first; ambition is for
the second truck. GO TO DEALER." Cash 64,440. Held 15,925. I did what she said. The Dealer: "You can buy today.
That's for the cheapest truck your hold already covers: a used Workhorse with a dry van, 387k miles, 57% condition,
in Wichita." There's no truck in Wichita on the page. The used list has trucks in New York, Bay City, Memphis and
Dallas, at 111k–379k miles and asking 120k+. The truck she recommends isn't for sale. (The borrower's session saw the
same thing: "ready today: 6,548 FD in cash" matching no listing.) As an absentee I closed the app. If the button she
sends me to doesn't have the thing she named, I'm not hunting.

**Check-in 3 (Jul 11, day 181).** About two minutes of loading. "Home time at Los Angeles: 4 days off left". Iuliia: the
same "The lessor's 15% ends the day you buy … GO TO DEALER" line as eleven weeks ago. Nothing about April, May or June.
Under Money → Past months, the reports are all there and honest. June: "8 loads delivered · 38% on time" (other
months were 63–83%). Something went wrong with on-time in June, and nothing told me when I came back. Contracts: "No
contracts held. Offers come to local carriers with a good record". In six months with the standing order on, none
came. The hold sat at 15,925 FD from April to July: it stops growing at some point, but nothing tells me it's full.
Cash 96,560 against 96,593 before the reload.

**Did the company stall?** No. It ran 8–15 loads a month, 76–92% loaded, profitably, on its own. That's the best thing
about this build. But for five months it paid the lessor 15% while it could have owned a truck, and the only prompt
pointed at a truck that didn't exist. An absentee's company never grows, because growth waits on a tap and the tap
leads nowhere.

## Holes and bugs

| # | What I did | What I expected | What happened | Repeated? | How bad for a stranger |
|---|---|---|---|---|---|
| 1 | Followed "GO TO DEALER" to Iuliia's pick | The truck she names | "a used Workhorse … in Wichita" is not on the list | Yes, a second session (borrower: "6,548 FD ready today") | High: the guide's one ask dead-ends |
| 2 | Returned after 2 and 3 months | A summary of what happened | Only the first return got a month summary; later returns show the same Dealer nag | Twice | Medium: an absentee can't see June's 38% on-time |
| 3 | Reloaded the page | The world as I left it | Clock jumped from Mon 14:00 to Thu 06:00 and cash +6,500 (first reload); smaller diffs later | 3 reloads | Medium |
| 4 | Standing order: contracts on | Some contract offer in 6 months | "No contracts held" | Over 6 months | Low–medium (unclear what "good record" needs) |
| 5 | Hold stopped at 15,925 FD | A line saying the deposit is full | Silent; 30% hold text unchanged | Seen | Low |
| 6 | Load time on CONTINUE | Seconds | ~1 min at day 36, ~1.5 at day 102, ~2 at day 181 (hidden pane, likely throttled) | Every return | Medium: grows with the world's age |
| 7 | Standing orders | On by default for a dispatcher | Book-between-rounds, move idle trucks and contracts all off by default | Seen | Low |

## The five things that most got in the way
1. The Dealer recommendation that names a truck that isn't for sale.
2. No "while you were away" after the first month.
3. Waiting a minute or two for my world every time I open it.
4. Contracts that never came.
5. The same Iuliia line for eleven weeks.

## The three best moments
1. "Your first month: earned 35,251, spent 14,598, kept 20,653 FD. READ THE MONTH."
2. Send home with a choice: back to work, or five days off.
3. Six months of profit with no taps at all. The dispatcher works.

## What I did not understand
- When the hold is "full" and what happens to it then.
- Why June was 38% on time.
- What makes a local shipper offer a contract.

## Ugly or broken
Nothing visual. The dead-end Dealer pick is the ugliest moment.

## Would I come back tomorrow?
Yes. A company that earns while I'm away is the hook for a Sunday player. But I'd want one screen that says what
happened since my last visit, every visit.

## What the game is about, as I understood it
Set your rules and the market works your truck for you. What you do on the days you look in is decide how to grow:
the first truck of your own, a second, a driver. The game is good at the first part and not yet at telling an
occasional visitor when it's time for the second.
