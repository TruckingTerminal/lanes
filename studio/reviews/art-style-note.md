# Art style note (sprint 0, the slop audit)

The art director, 2026-11-01, from the public test page on a 375-px phone and a 1280-px laptop. In short, the
paintings say "game" and the chrome says "server console", and the chrome covers most of the screen.

## What fights the art, worst first

1. **One terminal font.** JetBrains Mono at 10–13 px carries headings, prose, labels, money and Iuliia. Two
   hundred words of it read like a log file.
2. **Thirty-four colour themes** (Cyber Ops, Matrix Green, Neon Night…). The art is painted in one palette,
   Interstate Dusk, and every other theme puts it on colours it wasn't painted for. On a phone the theme
   picker takes a whole row of the header.
3. **The tab bar.** On the laptop, thirteen tabs share 330 px and the labels clip to "LEE", "OADS", "NANC".
   The icons come from three hands. Two locked tabs advertise unusable systems, one of them crime. On a
   phone three tabs show and ten more sit in a sideways scroll.
4. **The walkthrough is a wall.** Each step runs 150–200 words above every tab, so the tab you open starts
   below the fold, and on a phone it fills the first screen. Iuliia, the best character art in the game,
   is a 64-px stamp.
5. **The phone header is a toolbar:** logo, Menu, clock, badge, four speed buttons, two balances, the launch
   countdown, the theme picker and Full screen, filling a third of the screen.
6. **The map is boxed or missing.** On the laptop it's letterboxed in a slate-blue box. On the phone it was
   hidden behind a Restore button. The painted map is the game's best picture.
7. **Two drawing hands.** The title, scenes and portraits are painterly; the rig cards are flat outlined
   sprites, and the fleet cab is turned magenta by a CSS hue-rotate. Each tab opens on a big painting above
   11-px labels.
8. **The title page is a spreadsheet:** under the painting come a form, an eleven-row hub table and a
   footnote.
9. **Small things:** letter-spaced capital labels, mint pill buttons that match nothing in the art, and a
   toast that runs off the phone's edge.

## Cheapest fixes, most value per hour first

1. **One palette.** Interstate Dusk (`PAL` in `apps/web/src/art.ts`) is the only theme, plus a light variant if
   UX wants one. Delete the picker; it's CSS only.
2. **Two embedded typefaces.** A pixel face (Silkscreen or Pixelify Sans, both open-licensed) for titles,
   buttons and money, and a plain sans at 14–15 px for sentences. Monospace only in number tables.
3. **Five tabs on a phone** (Fleet, Loads, Money, Company, Guide), with the rest under More. No locked tabs:
   a system appears when it opens. Redrawing the icons in one hand is about 30 generations.
4. **A one-line walkthrough:** one sentence from Iuliia and one "Do" line, with "Tell me more" for the rest.
   She appears at 128 px beside a speech bubble, and the card shrinks to a strip while a tab is open.
5. **A one-row phone header:** logo mark, clock, play/pause and balance. Everything else goes in Menu.
6. **The map fills its box,** cropped rather than letterboxed. On a phone the map comes first and the panel
   is a sheet over it.
7. **No CSS filters on art.** Recolour the fleet cab by swapping palette colours, or give it a badge.
8. **The title page:** the painting, Start, Continue and a company name. The hub table moves behind "Choose
   your home hub".
9. **One hand for the truck:** painterly wherever players look closely, crisp sprites only on the map.
   Repainting the three rig cards is about 60 generations.

Fixes 1, 2 and 4–8 are CSS and markup for engineering, and I'll review the result. Fixes 3 and 9 are art
passes, ready once Jeff approves the direction.

## Style guide in ten lines (for UX and the writer)

1. One palette, Interstate Dusk, for art and chrome alike.
2. Art leads: the chrome frames each picture and never covers it.
3. Two typefaces: a pixel face for titles, buttons and money, and a plain sans for sentences.
4. On a phone, nothing a player must read is under 14 px or set in spaced capitals.
5. Pixel art at whole-number scales only, never filtered.
6. Painterly for scenes, portraits and cards; crisp sprites only on the map.
7. Iuliia speaks a sentence or two at a time, with her face big enough to read.
8. A phone screen does one job: the map or a panel.
9. A system appears when it's usable: no locked teasers, and no crime in the chrome.
10. Controls use the palette's amber and cyan, with square pixel corners and no pills.
