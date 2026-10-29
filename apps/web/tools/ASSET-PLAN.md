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

Rules for the pass:
- Check `python3 apps/web/tools/pixellab.py balance` before an object, character or Pro call.
- Never spend more than one retry on a sprite before changing the prompt.
- Keep animations to loops of 8–16 frames; the client plays them at 8–12 fps.
- Everything shown at whole-number scales; no fractional resizing of pixel art.
