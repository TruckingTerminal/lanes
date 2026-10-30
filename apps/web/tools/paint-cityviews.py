#!/usr/bin/env python3
"""
Paints the city views: the big cinematic picture of a hub that opens when its city is clicked on
the map, 688 × 384 (the Pro model's largest 16:9 frame, 25 generations each) in the title's style,
with the city's real landmarks from tools/landmarks.json, a freeway of American long-nose rigs in
the foreground and the summer golden hour the whole set shares (the weather is drawn live over it).

  paint-cityviews.py [--only CHI,STL] [--jobs 4] [--seed N] [--dry] [--force] [--variant night|rain|snow]

Output: apps/web/assets/cityviews/<ID>.png and <ID>.json (the golden hour), or <ID>-<variant>.png for
a variant: the same city deep at night, on a grey rainy afternoon, or on a bright day after snow.
The client picks the painting nearest the hour and the weather and relights it for the rest.
Existing views are kept unless --force.
"""
import base64
import json
import os
import sys
import threading

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pixellab  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
OUT = os.path.join(ROOT, "apps", "web", "assets", "cityviews")
STYLE = os.path.join(ROOT, "apps", "web", "assets", "title", "title.png")
W, H = 688, 384

PROMPT = (
    "highly detailed HD pixel art with painterly shading and layered depth, a cinematic wide establishing shot for a trucking tycoon game: "
    "{landmark}, its real skyline rising in the middle distance with every landmark clearly recognisable, seen from above a busy interstate in the "
    "foreground where American long-nose conventional semi tractors with long hoods, chrome grilles and sleeper cabs pull white trailers, "
    "never a flat-faced European cab-over truck, a blank green overhead highway sign, the city's own surroundings and water or hills beyond, "
    "{light}, no text, lettering, words, labels or logos anywhere"
)
LIGHT = {
    None: "golden hour with long warm shadows and lit windows, a saturated orange and purple sky",
    "night": "deep night under a dark blue starry sky, the skyline ablaze with lit windows, neon and red beacon lights on the tower tops, headlights and taillights streaming along the freeway, warm pools of streetlight, the landmarks floodlit",
    "rain": "a grey overcast rainy afternoon, low cloud brushing the tower tops, rain streaking down, wet roads reflecting headlights and brake lights, puddles on the shoulders, muted blue-grey colours with warm lit windows",
    "snow": "a bright clear winter day after a snowfall, snow on every roof, verge and shoulder, the freeway ploughed and dark, bare trees, a pale blue-white sky with a low winter sun, long cool shadows",
}


def paint(hub: str, landmark: str, seed, dry: bool, variant: str | None = None) -> None:
    desc = PROMPT.format(landmark=landmark, light=LIGHT[variant])
    out = os.path.join(OUT, f"{hub}{'-' + variant if variant else ''}.png")
    if dry:
        print(f"{hub}: {desc[:140]}…", flush=True)
        return
    sw, sh = pixellab.png_size(STYLE)
    body = {
        "description": desc,
        "image_size": {"width": W, "height": H},
        "no_background": False,
        "style_image": {"image": {"type": "base64", "base64": base64.b64encode(open(STYLE, "rb").read()).decode()}, "size": {"width": sw, "height": sh}},
        "style_options": {"color_palette": True, "outline": True, "detail": True, "shading": True},
    }
    if seed is not None:
        body["seed"] = int(seed)
    job = pixellab.call("POST", "/generate-image-v2", body).get("background_job_id")
    print(f"{hub}: job {job}", flush=True)
    lr = pixellab.wait_job(job)
    img = lr["images"][0]
    os.makedirs(OUT, exist_ok=True)
    open(out, "wb").write(base64.b64decode(img["base64"]))
    spent = (lr.get("billing_usage") or {}).get("generations")
    json.dump({"job": job, "seed": lr.get("seed"), "generations": spent, "size": [img["width"], img["height"]], "description": desc}, open(out[:-4] + ".json", "w"), indent=1)
    print(f"{hub}: saved ({img['width']}×{img['height']}, {spent} generations)", flush=True)


def main() -> None:
    opt = lambda k, d=None: (sys.argv[sys.argv.index(k) + 1] if k in sys.argv and sys.argv.index(k) + 1 < len(sys.argv) else d)
    landmarks = json.load(open(os.path.join(HERE, "landmarks.json")))
    only = opt("--only")
    hubs = only.split(",") if only else list(landmarks)
    jobs = int(opt("--jobs", 4))
    seed = opt("--seed")
    dry = "--dry" in sys.argv
    force = "--force" in sys.argv
    variant = opt("--variant")
    if variant not in LIGHT:
        sys.exit(f"--variant must be one of {[k for k in LIGHT if k]}")
    suffix = f"-{variant}" if variant else ""
    if not force:
        skipped = [h for h in hubs if os.path.exists(os.path.join(OUT, f"{h}{suffix}.png"))]
        if skipped:
            print(f"keeping {len(skipped)} existing views (--force repaints)", flush=True)
        hubs = [h for h in hubs if h not in skipped]
    sem = threading.Semaphore(jobs)

    def run(h: str) -> None:
        with sem:
            try:
                paint(h, landmarks[h], seed, dry, variant)
            except SystemExit as e:
                print(f"{h}: failed: {e}", flush=True)

    threads = [threading.Thread(target=run, args=(h,)) for h in hubs]
    for t in threads:
        t.start()
    for t in threads:
        t.join()


if __name__ == "__main__":
    main()
