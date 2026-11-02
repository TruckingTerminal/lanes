# Iuliia's lines replay (2026-11-02)

Build: "Deploy a21be98" (Pages built, bundle checked fresh). Phone 375×812, built-in browser. One new owner-operator world (Columbus) over about eleven real minutes, against `specs/iuliia-lines.md`. I logged every change to her caption with real-time stamps, polling every 250 ms. Console: no errors.

**Method note:** her tab lines and the walkthrough's Do line render in `.sheetbody > .caption`; the arrival and walkthrough lines render in `.iuliiasay`. For the first five minutes my log watched only the second. So "no line" on the first visits to Truck, Loads and Money is not proven either way (see the table). From Company onward the log watched both.

Severity: **R** blocks the next republish · **S** this sprint · **L** later.

## Results

| Rule or trigger | Result | Evidence (real seconds from the start) | Sev |
|---|---|---|---|
| Hub screens: a ringed hub's card | **Pass** | 16.8 s: "A good place to start this month. Read the costs before the character." Gone at 22.8 s (6 s) | – |
| Hub screens: See the board (read-only) | **Pass (quiet rule)** | Opened 1.5 s after the hub line; no line, as the 60-second rule requires | – |
| Hub screens: All hubs | **Not proven** | Opened at 74.6 s, 57.8 s after the last line (16.8 s), so inside the 60-second window: its silence is correct. I didn't reopen it later | – |
| Hub screens: a non-starter city | **Pass** | 146.5 s, Seattle: "A fine place to deliver to. For a home, look at the rings." | – |
| A starter you've already opened | **Pass** | Reopening Columbus to start there brought no second line | – |
| The walkthrough comes first | **Pass** | The arrival line ("This is Columbus, your home… Show me the board") stayed up from Start through the Loads tab and the first load sheet. The Bid brought the walkthrough's "From now on your dispatcher bids when you don't…", not the Bid line. The result brought step 3's "You won one. Now the slow part…", not the Won line. The delivery brought step 4's "Delivered, and paid today…", not the Delivered line. Note: the arrival line still reads "Show me the board" while the player is on the board (**L**) | – |
| First visit in a sitting, one line, six seconds, then the Do line | **Pass** | Company: "Your record. Brokers read it before they read your rate." for exactly 6.00 s, then "Watch the ETA. Note where it sleeps tonight." returned | – |
| A card trigger | **Pass** | The truck card starting to roll: "There it goes. I still like watching them leave." for one tick of game time, then the Do line | – |
| No second line within 60 real seconds | **Pass** | Help opened about 10 s after Company's line: none (a later Help visit wasn't tried) | – |
| None on a second visit | **Pass** | Loads and Truck revisited after 60 s: the Do line only | – |
| One line at a time, never two stacked | **Pass** | Never more than one Iuliia caption visible at once across the whole log | – |
| Quiet mutes her lines, not the walkthrough | **Pass** | More › Iuliia › **Quiet** on, then Intel's first visit (more than 60 s after the last line): no line, and the Do line "Watch the ETA…" stayed. Quiet off afterwards | – |
| "Posted by {name}" with its ✕ | **Pass** | From Intel › a broker › "Their loads on the board ›", while my truck was busy: a chip "Posted by Broker-25" with ✕ ("Show every load") over that broker's lanes. ✕ cleared it | – |
| Regression: "You won one" only after a real load | **Pass in the caption, fail on the Iuliia page** | The caption showed "You won one…" only at 462 s, after "Won Columbus → Erie at 7.96/mi". But at 420 s, after a bid and before the round, More › Iuliia already read "3 of 13: The truck rolls · You won one. Now the slow part…" The full text should wait for the win too | L |
| First visits to Truck, Loads, Money | **Not proven** | All three came while the walkthrough's own line was up, which outranks them, and before my log watched the right element. After the walkthrough line cleared, they were second visits | – |
| Book now, Withdraw, Lost, Nobody took, a hire, Dealer, Staff | **Not reached** | One owner-operator session: I bid rather than booked; I won; Staff and Dealer stay closed for a one-truck company before step 9 | – |
| Nothing on a refused order | **Not reached** | No refusal came up | – |
