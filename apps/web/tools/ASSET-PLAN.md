# The LANES asset pass

Jeff's direction (2026-10-29): every piece of art in the game and the menus in PixelLab's
painterly HD style (the castle on pixellab.ai: large canvas, painterly shading, outlines only
where shapes meet, a saturated sunset palette, layered depth), and everything animated. Things
that must read small on the map (trucks, towns, icons) get the same palette with crisp bold
outlines, because painterly detail disappears under 60 pixels.

Account: PixelLab Tier 2 Pixel Artisan, 5,000 generations a month, 512 × 512 canvas, ten
concurrent jobs. Costs measured on 2026-10-29: a quick image (pixflux) 1; a Pro image 10 at
256 × 144 and 15 at 384 × 288 or 288 × 288 (it scales with the pixel count, 25 at 512 × 288);
an eight-direction object about 10; a PixMiniMax loop (see the title) by frame count and size;
a VFX "lite" effect about 1.
The animation tools take a first frame of at most 256 × 256, so animated scenes are made at
256 × 144 and shown at 4× (1024 × 576), which keeps every pixel square.

Style anchor: `apps/web/assets/title/title.png` (the Pro title scene). Every later Pro call
passes it as `style_image` with `style_options` copying palette, outline, detail and shading,
so the set stays one hand.

| Block | What | Generations |
|---|---|---|
| A. Title and loading | title scene 256 × 144 (Pro) + 16-frame loop; loading road strip + loop | ~80 |
| B. Scenes | office, yard, dock, weigh station, truck stop, repair shop, highway night, produce season, winter, hub skyline backdrop; each Pro + loop | ~500 |
| C. Trucks | 3 tractors × 3 trailers as eight-direction objects; Pro side-view rigs; rolling-wheel and exhaust loops; lease and AI paint by recolour | ~450 |
| D. People | 8 roles as eight-direction characters; idle and work loops; portraits in three moods | ~350 |
| E. Map | top-down tilesets for six biomes, water and roads; city sprites in four sizes with lit windows and smoke; towns, facilities, weigh stations; rain, snow and smoke effects | ~450 |
| F. Menus | frames, buttons, badges, tab icons, cursors; shine and glow loops on the accents | ~150 |
| Iteration reserve | two to three tries per keeper | ~1,000 |
| **Total** | | **~3,000** |

Order of work: A (the anchor and the pipeline), then C and E (the game is a map of trucks),
then B, D, F. Each block lands as its own commit with the generated files in `apps/web/assets`
and the prompts in `apps/web/tools/asset-pass.sh`, so any asset can be regenerated.

Style note (2026-10-29): Jeff also likes the isometric tycoon look. Two samples mixing the two
(an isometric freight terminal and an isometric city hub on transparency, both Pro with the
painterly sample as the style image; prompts under `mix` in `asset-pass.sh`) read as one hand:
painterly light on clean isometric stages. If the mix is chosen, block B scenes and block E
city sprites go isometric while the title and the map's top-down trucks stay as they are.

## The map (2026-10-29): Jeff wants the large US map first, then major cities, then small towns, and the
map "extremely interactive and detailed" with "multiple smooth zoom levels".

How the map is made: the code-drawn base (map.ts: the real Albers projection, coastlines, rivers, ranges,
the 0.16.0 road network and the 4,786 places) is the layout, and PixelLab's Pro editor repaints it
(`pixellab.py edit`, edit-images-v2, 512 × 512 in and out) in the chosen style, so every road, river and
city stays exactly where the data puts it. `tools/map-harness` renders the base at any size in the browser
and saves crops; `asset-pass.sh map` repaints the sample crops. Measured 2026-10-29: a Pro repaint is 25
generations per call whatever the size (512 × 320 and 512 × 512 alike), and a new Pro 512 × 512 image
with the title as style image is also 25. The eight samples (the country, the West and the Northeast in
both looks, and a zoomed city tile in both) cost 200; they are in dist/preview-assets/styles/map.

The zoom pyramid (what "smooth zoom levels" needs): one painting can only be scaled, so each zoom band
gets its own art and the view crossfades between bands while the zoom animates.
- Level 0, the country (zoom 1–2): the base at 1536 × 1024 repainted as 3 × 2 tiles of 512, each tile
  painted with a 64-pixel strip of its already-painted neighbours inside the frame so the seams match.
- Level 1, the region (zoom 3–4): painted top-down tilesets (create-tileset, Pro, 64-pixel tiles) for
  the six biomes, water and the transitions, laid by the same biome function the code map uses, with
  the roads drawn as painted road tiles and the towns and cities as sprites. No per-tile painting, so it
  costs the same for the whole country as for one state.
- Level 2, the city (zoom 6–8): the city and town sprites at their large size (four sizes per class),
  with lit windows, smoke, traffic and weather loops; facilities and weigh stations as sprites.
- Smooth zoom: a continuous zoom factor eased every frame (wheel, pinch, double-click, keys), fractional
  scaling only while the zoom is moving and a snap to a whole-number scale when it settles, panning
  with inertia, and the level 0 painting crossfading into the tile layer between zoom 2 and 3.

Jeff's pick (2026-10-29): the mix, "as detailed as possible", the painterly detail and resolution on
the isometric ground; cities realistic with their notable landmarks; and everything with its own
animations and graphics per season and per weather event. So the pyramid is painted, not tiled:

- Level 0 (1408 × 960, 3 × 2 tiles with 32-pixel overlaps, `tools/paint-map.py`): the summer painting,
  then autumn, winter and spring as edits of the painted summer tiles (the layout and hand stay, the
  season changes). 6 + 18 tiles = 600 generations.
- Level 1 (2816 × 1920, 6 × 4 tiles): the base rendered at 2× and repainted with every hub's landmarks
  named in its tile's prompt (`tools/landmarks.json`), 600 generations for summer. Its seasons come
  from the client first (a seasonal tint and snow and foliage overlays on the summer painting) and
  get painted (1,800) when a later month's budget allows.
- Level 2 (the city, 4×): not a painting of the whole country (96 tiles); the 60 hubs as isometric
  city sprites with their landmarks, 256 × 256 on transparency in the title's style (~15 each) with a
  lights-smoke-traffic loop (~2 each): ~1,000. Winter versions of the ~30 northern hubs by edit (750)
  when the budget allows; snow overlay sprites until then. Towns: 4–6 generic isometric town sprites
  in four seasons with loops (~170).
- Weather: `src/weather.ts` is a deterministic weather model (the world seed and the in-game day and
  hour: a drifting pressure field for rain, snow by season and latitude, storms, morning fog on the
  coasts and in the valleys, summer heat in the south), so every player sees the same storm. The map
  draws it as cloud shade, rain streaks, drifting snow, fog banks and lightning (code, no generations),
  and the hub tooltip says the sky. PixelLab VFX loops can replace the particles later (~50). The
  engine's `feeds.weather` could read the same model once the parent session bumps the ruleset.
- The view: the fit level smoothed, the whole-number levels pixel for pixel, crossfading between the
  paintings as the zoom moves; hover and click on hubs, towns and trucks at every level.

Progress (2026-10-29, evening): level 0 painted in all four seasons (summer three runs, the others as
edits of it; the seasonal tiles differ a little at their joins, which wider overlaps would fix at twice
the tiles); level 1 painting from the doubled summer; the 60 hub cities and six town kinds as 256/128
sprites on transparency with no platform (the first wording gave diorama blocks); the client draws the
season by in-game month, the sky from `weather.ts`, towns from 4× (thinned by population until 8×) and
cities from 3×. The page stays near 3 MB: everything but level-0 summer loads from `assets/` next to
it (`assets/manifest.json` from the build; publish them as the artifact's files).

Spent on the map by the evening of 2026-10-29: about 2,400 (balance 2,593 of 5,000): samples 200,
level 0 325 (two full runs and a tile redo), seasons 450, level 1 650 (24 tiles, a tile redo, two
tests), cities 610, towns 100, loops ~130 in flight. Lessons: the editor letters names if cities are
listed by name (say "draw them, never their names" and ask for no words), its prompt is 2,000
characters at most, a "diorama" result needs "flat ground fading to transparency, no platform", a
stray landmark from a neighbouring hub's text can land in open water (redo the tile), and tiles paint
the open sea in their own shade (`calm-ocean.py` gives it level 0's).

Title (2026-10-30): a 40-frame PixMiniMax loop (4 generations) shipped as a sheet next to the page
(`assets/title/title.loop.png`, 8 columns), drawn at 12 fps with the last six frames crossfading into the
first six; the 16 inline frames are the poster until it decodes. The logo is the Trucking Terminal truck
mark as HD pixel art with LANES in its blues, and "by Trucking Terminal" under it on the title.

Map total this month ≈ 2,500 (level 0 with seasons 600, level 1 600, cities 1,000, towns 170, weather 50,
retries ~100), leaving ~2,000 of the 4,700 balance for trucks, people, scenes and menus (~1,450).

Rules for the pass:
- Check `python3 apps/web/tools/pixellab.py balance` before an object, character or Pro call.
- Never spend more than one retry on a sprite before changing the prompt.
- Keep animations to loops of 8–16 frames; the client plays them at 8–12 fps.
- Everything shown at whole-number scales; no fractional resizing of pixel art.
