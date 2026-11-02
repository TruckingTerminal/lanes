# Intel strings (writer, draft 1, 2026-11-03; against the director's `intel.md` and UX's `intel-ux.md` draft 1)

Every string on More › Intel, the cards, the player's own card, the Company tab's replacement rows, and the entry points into Intel. Engineering built from placeholders in `apps/web/src/copy.ts` (the `INTEL` block); each row below names its key. "Kept" means engineering's draft stands. `{key}` comes from config; `{x}` without a key is a value from the world. Sentence case; no string over 20 words.

**The rule over every line (the director's row 1):** no figure from which live cash can be derived. No string here names cash, worth, a balance, a stake amount, a loan or a debt, except the player's own net worth on their own Company card.

## The list

| Key | Where | String |
|---|---|---|
| `title` | tab title | Intel (kept) |
| `header` | header | Intel · `{n}` companies (kept; the count under the current filters) |
| `howOthers` | the pinned row's label | How others see you (kept) |
| `find` | search field | Find a company (kept) |
| `myHub` · `hub` · `anyHub` | filter chips | My hub · Hub ▾ · Any hub (kept) |
| `players` · `brokers` | filter chips | Players · Brokers (kept) |
| new | sort control's label | Sort by |
| `sortMiles` · `sortTrucks` · `sortMonth` | sort segments | Miles · Trucks · Last month (kept) |
| `player` · `broker` | row marks | Player · Broker (kept). AI companies carry no mark in the list. |
| `line2` | row line 2, a carrier | `{hub}` · `{n}` trucks · `{miles}` Miles (kept; "1 truck" singular) |
| `line2Broker` | row line 2, a broker | `{hub}` · broker · credit `{band}` (kept) |
| `more` | after the page | Show `{pageSize}` more (the page size is the client's constant, 50) |
| `none` | no match, the filters in words | No brokers at `{hub}`. · No players at `{hub}`. · No companies at `{hub}`. · Nobody called "`{query}`". |
| `clear` | under it | Clear filters (kept) |
| `back` | card's back arrow (accessible name) | Back (kept) |

## The card

In the director's order. A broker's card moves Credit up, under the header.

| Key | Label | Value |
|---|---|---|
| header | `{name}` | Player / AI · Carrier / Broker · `home`: Home: `{hub}` (kept) |
| `authority` | Authority | `authorityValue`: `{age}` · `{active / suspended / revoked}` (kept). Age reads "`{n}` days" under a month, then "`{n}` months", then "`{n}` years". |
| `revokedBefore` | after the status | revoked once before (kept) · revoked `{n}` times before, when more than once |
| `running` | Running | `runningValue`: `{n}` trucks · `{n}` trailers (`{n}` van, `{n}` reefer, `{n}` flatbed) · `{n}` drivers (kept) |
| new | Running, facilities line | `{n}` yard · `{n}` truck stop · `{n}` warehouse (only kinds it has; counts, never values) |
| `milesSeason` | Miles this season | `milesValue`: `{miles}` · #`{rank}` of `{n}` (kept) |
| `pastSeasons` | fold | Past seasons · `pastRow`: Season `{n}` · `{miles}` · #`{rank}` (kept) |
| `lastMonth` | Last month | `lastMonthValue`: Revenue `{fd}` FD · `{n}` loads · `{pct}` on time (kept) |
| `firstMonth` | Last month, before the first close | First month: no record yet (kept) |
| `safety` | Safety | `{rating}`, then the alerts' names if any: "Satisfactory · hours of service" |
| `insurance` | Insurance | `insClean` Clean · `insSurcharged` Surcharged · `insHeavy` Heavily surcharged (kept) |
| `credit` | Credit | `creditValue`: `{band}` (A is best, E worst) (kept) |
| `bondedVetting` | brokers, under Credit | Bonded · `{Open / Standard / Strict}` vetting (kept; never the bond's amount) |
| `brokerLine` | a broker's line under the header | Credit `{band}` · Bonded · `{Strict}` vetting (kept) |
| new | the foot of a broker's or player shipper's card | Their loads on the board › |

**The safety ratings** (the engine's `ratingLabel`, kept as they are): Not yet rated · Satisfactory · Conditional · Unsatisfactory.

**The alerts' names** (Intel.tsx `ALERT_NAMES`, kept, lower case after the rating): hours of service · unsafe driving · vehicle maintenance · crashes.

**The bands:**

| Band | Strings |
|---|---|
| Safety | the four ratings above |
| Insurance | Clean · Surcharged · Heavily surcharged (cut-offs are the economy's; `HEAVY_SURCHARGE` is a client constant until then) |
| Credit | A · B · C · D · E, with "(A is best, E worst)" on the card only |

## Your own card

Same rows, same order, titled "How others see you". Under each band, one muted line only the owner sees, computed, never typed.

| Key | Under | String |
|---|---|---|
| `ownCredit` | Credit | At `{band}`: truck loans `{down}` down at `{rate}` a week, up to `{n}` at once (kept) |
| `ownSafety` | Safety | `{Tier}`-vetting brokers won't load you yet: `{reason}`. (was "turn you down"; "yet" says it can change) |
| `ownSafetyClear` | Safety | No broker's vetting turns you away. |
| `ownInsurance` | Insurance | Your premium is `{pct}` over a clean record's. (kept, with a full stop) |
| `ownInsuranceClean` | Insurance | Your premium is a clean record's. (kept) |
| `ownInsuranceUnrated` | Insurance, no safety rating yet | No safety rating yet: your premium is `{pct}` over a rated, clean record's. |
| `fullBooks` | the foot of the card | Your full books › (kept; opens More › Company) |

`ownInsuranceUnrated` reworded so "not yet rated" points at the safety rating it comes from, and doesn't read against "Clean" in the band above it.

## The Company tab

| Key | Where | String |
|---|---|---|
| `everyCompany` | replaces Players in the world and Biggest companies | Every company, by Miles › (kept) |
| new | the player's own net worth, label | Net worth |
| `privateWorth` | under it | Private: only you see this. (kept, with a full stop) |

## Entry points

| Key | Where | String |
|---|---|---|
| `whoHere` | the hub card's Who's here, last line | See who's here › (kept) |
| `lostTo` | the result card, lost | Lost to `{name}` at `{rate}`/mi › (adds the rate, so the line keeps what S5 showed) |
| (brokerage) | the brokerage teaser's action | See what brokers earned last month (as in `brokerage-strings.md`) |
| (no string) | a company's name on a load card or the load sheet | the name itself becomes the link |

## Iuliia

One line, on the first visit to Intel, in `iuliia-lines.md`. None on a card.
