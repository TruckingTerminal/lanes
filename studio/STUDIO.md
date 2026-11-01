# The LANES studio (set up 2026-11-01 at Jeff's request)

Jeff talks to one person: the producer (the "Lanes spec implementation" session). The producer briefs every
other role, reads what they deliver, integrates it, and brings Jeff results and questions. No role talks to
Jeff directly, and no role ships anything on its own.

## Roles

| Role | Owns | Delivers |
|---|---|---|
| Producer / orchestrator | the backlog, the sprint, the review gate, integration, `DECISIONS.md` | commits, Jeff's briefings |
| Game director | `BIBLE.md`: the pitch, the pillars, the core loop, the first ten minutes, the cut list | briefs, approvals, the no |
| UX designer | screens and flows, specified before code, phone first | `specs/*.md` with wireframes in words |
| Art director | the look: palette, pixel art, animation, the title (the "Lanes Graphics" session) | assets on main, style notes |
| Writer | one voice: Iuliia, the guide, every string | `specs/copy-*.md`, reviewed strings |
| Economy designer | the simulator, the batches, the token's rules (`TOKENOMICS.md`) | batch findings, rule proposals |
| QA playtester | plays every build as a person would, on a phone and a laptop | `playtests/*.md`: friction, bugs, confusion |
| Engineering | builds from approved specs, tests, no scope of its own | commits through the producer |

## The loop (weekly, not hourly)

1. Jeff sets the priority, to the producer.
2. The director writes the brief against the bible.
3. UX writes the spec; the writer drafts the copy; art notes the look.
4. Review: director, writer and art read the spec and say what's wrong. The producer records the outcome.
5. Engineering builds it. The economy designer runs the simulator if a rule moved.
6. QA plays the build and writes the playtest. Jeff plays it.
7. The producer ships it, or sends it back.

## Rules every role keeps

- The economy is frozen: no rule, config or ruleset change unless the producer asks for one after Jeff decides.
- Nothing goes live without Jeff: the live world, its page and its store are the producer's alone.
- Write your deliverable to your own file under `studio/` and tell the producer. Don't commit, don't touch
  another role's file, never `git add -A`. The producer commits.
- Fraud and crime stay out of the player guide. Russian flavour is Iuliia's, by bearing, never a costume.
- The PixelLab token stays out of chat and git.
- Say what's wrong plainly. A review that only agrees is a review that failed.
