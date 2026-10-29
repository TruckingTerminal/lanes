#!/usr/bin/env python3
"""
Paints the hub cities for the map's closest zoom: one isometric city sprite per hub with its
landmarks (tools/landmarks.json), 256 × 256 on transparency in the title's style, so it can be
animated later (PixMiniMax takes frames up to 256). Jobs run a few at a time.

  paint-cities.py [--only CHI,STL] [--size 256] [--jobs 4] [--seed N] [--dry]

Output: apps/web/assets/cities/<ID>.png and <ID>.json (job, seed, generations, prompt).
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
OUT = os.path.join(ROOT, "apps", "web", "assets", "cities")
STYLE = os.path.join(ROOT, "apps", "web", "assets", "title", "title.png")

PROMPT = (
    "isometric pixel art city for a trucking tycoon game map, on a transparent background, seen from the high angle of an isometric "
    "tycoon map: {landmark}, a dense cluster of downtown towers with lit windows and long warm shadows, a highway interchange with tiny "
    "semi trucks at the edge, a rail yard and a row of warehouses, highly detailed HD painterly pixel art shading with layered depth, warm "
    "late-afternoon light, saturated palette, the whole city fitting inside the frame with clear space around it, never any words, "
    "letters or labels"
)


def paint(hub: str, landmark: str, size: int, seed, dry: bool) -> None:
    desc = PROMPT.format(landmark=landmark)
    out = os.path.join(OUT, f"{hub}.png")
    if dry:
        print(f"{hub}: {desc[:120]}…", flush=True)
        return
    sw, sh = pixellab.png_size(STYLE)
    body = {
        "description": desc,
        "image_size": {"width": size, "height": size},
        "no_background": True,
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
    size = int(opt("--size", 256))
    jobs = int(opt("--jobs", 4))
    seed = opt("--seed")
    dry = "--dry" in sys.argv
    sem = threading.Semaphore(jobs)

    def run(h: str) -> None:
        with sem:
            try:
                paint(h, landmarks[h], size, seed, dry)
            except SystemExit as e:
                print(f"{h}: failed: {e}", flush=True)

    threads = [threading.Thread(target=run, args=(h,)) for h in hubs]
    for t in threads:
        t.start()
    for t in threads:
        t.join()


if __name__ == "__main__":
    main()
