#!/usr/bin/env python3
"""
Animates the city views at full resolution. The animator takes nothing wider than 256, so each
688 × 384 painting is cut into six overlapping 256 × 208 tiles, every tile is animated for 16
frames (2 generations each, 12 a view), each tile's frames are pulled back to the tile's own
first frame's colours (a per-channel line per 16-px block, blended between block centres, so
the animator's colour drift goes and the motion stays), and the tiles are joined along the
least-difference seam through each overlap (a panorama stitcher's trick: a trailer or a sign the
tiles drew differently is taken whole from one side). The 16 full frames go into a 4 × 4 sheet
quantised to 256 colours by ffmpeg (about 1.4 MB a view): apps/web/assets/cityviews/<view>.loop.png,
which ui/CityPicture.tsx plays at 8 fps in place of the still.

  animate-cityviews.py [--only CHI,DAL] [--variants golden,night,rain] [--jobs 1] [--force] [--dry]

The tile frames stay in <view>-tiles/ next to the sheet (ignored by git). Existing sheets are kept.
"""
import base64
import importlib.util
import json
import os
import subprocess
import sys
import threading

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pixellab  # noqa: E402

_spec = importlib.util.spec_from_file_location("paint_map", os.path.join(HERE, "paint-map.py"))
_pm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_pm)
read_png, write_png = _pm.read_png, _pm.write_png

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
VIEWS = os.path.join(ROOT, "apps", "web", "assets", "cityviews")
XS = (0, 216, 432)
YS = (0, 176)
TW, TH = 256, 208
FRAMES = 16
B = 16

STILL = "a seamless loop that ends where it began; the camera, the buildings, the sky, the road and the sign never move, and nothing is added or removed: no new signs, vehicles, buildings or lights"
MOTION = {
    "golden": f"traffic flows along the freeway, the semi trucks and cars roll forward, headlights and taillights move, lights in the skyline windows flicker, {STILL}",
    "night": f"traffic flows along the freeway, headlights and taillights stream along it, neon and window lights flicker, the red beacons on the towers blink, {STILL}",
    "rain": f"rain streaks down, traffic flows along the freeway, headlights and brake lights move and their reflections shimmer on the wet road, {STILL}",
}


def animate_tile(tile_png: str, motion: str, out_dir: str) -> None:
    body = {"first_frame": {"type": "base64", "base64": base64.b64encode(open(tile_png, "rb").read()).decode()}, "description": motion, "frame_count": FRAMES, "no_background": False, "view": "side"}
    job = pixellab.call("POST", "/animate-pixminimax", body).get("background_job_id")
    lr = pixellab.wait_job(job)
    os.makedirs(out_dir, exist_ok=True)
    for i, img in enumerate(lr["images"]):
        open(os.path.join(out_dir, f"frame-{i:02d}.png"), "wb").write(base64.b64decode(img["base64"]))
    json.dump({"job": job, "frames": len(lr["images"]), "generations": (lr.get("billing_usage") or {}).get("generations")}, open(os.path.join(out_dir, "animation.json"), "w"))


def local_fit(f0: np.ndarray, f: np.ndarray) -> np.ndarray:
    h, w = f0.shape[:2]
    by, bx = h // B, w // B
    a = np.ones((by, bx, 3), np.float32)
    b = np.zeros((by, bx, 3), np.float32)
    for j in range(by):
        for i in range(bx):
            x = f0[j * B:(j + 1) * B, i * B:(i + 1) * B].reshape(-1, 3)
            y = f[j * B:(j + 1) * B, i * B:(i + 1) * B].reshape(-1, 3)
            for c in range(3):
                xm, ym = x[:, c].mean(), y[:, c].mean()
                v = ((x[:, c] - xm) ** 2).sum()
                aa = ((x[:, c] - xm) * (y[:, c] - ym)).sum() / v if v > 1 else 1.0
                aa = min(1.6, max(0.6, aa))
                a[j, i, c] = aa
                b[j, i, c] = ym - aa * xm
    yy = (np.arange(h) + 0.5) / B - 0.5
    xx = (np.arange(w) + 0.5) / B - 0.5
    y0 = np.clip(np.floor(yy).astype(int), 0, by - 1)
    y1 = np.clip(y0 + 1, 0, by - 1)
    ty = np.clip(yy - y0, 0, 1)[:, None, None]
    x0 = np.clip(np.floor(xx).astype(int), 0, bx - 1)
    x1 = np.clip(x0 + 1, 0, bx - 1)
    tx = np.clip(xx - x0, 0, 1)[None, :, None]

    def spread(q):
        return q[y0][:, x0] * (1 - ty) * (1 - tx) + q[y0][:, x1] * (1 - ty) * tx + q[y1][:, x0] * ty * (1 - tx) + q[y1][:, x1] * ty * tx

    return (f - spread(b)) / spread(a)


def seam_cols(cost: np.ndarray) -> np.ndarray:
    h, w = cost.shape
    acc = cost.copy()
    back = np.zeros((h, w), np.int32)
    for y in range(1, h):
        prev = acc[y - 1]
        left = np.concatenate([[np.inf], prev[:-1]])
        right = np.concatenate([prev[1:], [np.inf]])
        stacked = np.stack([left, prev, right])
        k = stacked.argmin(axis=0)
        acc[y] += stacked[k, np.arange(w)]
        back[y] = np.arange(w) + k - 1
    x = int(acc[-1].argmin())
    path = np.zeros(h, np.int32)
    for y in range(h - 1, -1, -1):
        path[y] = x
        x = back[y, x]
    return path


def join_h(left: np.ndarray, right: np.ndarray, x_right: int) -> np.ndarray:
    H = left.shape[0]
    ov0, ov1 = x_right, left.shape[1]
    path = seam_cols(np.abs(left[:, ov0:ov1] - right[:, : ov1 - ov0]).sum(axis=2))
    out = np.zeros((H, x_right + right.shape[1], 3), np.float32)
    out[:, :ov1] = left
    out[:, x_right:] = right
    xs = np.arange(ov1 - ov0)[None, :]
    t = np.clip((xs - path[:, None] + 2) / 4, 0, 1)[..., None]
    out[:, ov0:ov1] = left[:, ov0:ov1] * (1 - t) + right[:, : ov1 - ov0] * t
    return out


def join_v(top: np.ndarray, bottom: np.ndarray, y_bottom: int) -> np.ndarray:
    return join_h(top.transpose(1, 0, 2), bottom.transpose(1, 0, 2), y_bottom).transpose(1, 0, 2)


def stitch(tiles_dir: str, still: np.ndarray) -> list:
    loops = {}
    for j in range(len(YS)):
        for i in range(len(XS)):
            d = os.path.join(tiles_dir, f"t{j}{i}")
            names = sorted(f for f in os.listdir(d) if f.startswith("frame-"))[:FRAMES]
            loops[(j, i)] = [read_png(os.path.join(d, f))[..., :3].astype(np.float32) for f in names]
    n = min(len(v) for v in loops.values())
    full = []
    for k in range(n):
        rows = []
        for j in range(len(YS)):
            row = None
            for i in range(len(XS)):
                fr = loops[(j, i)]
                g = np.clip(local_fit(fr[0], fr[k]), 0, 255) if k else fr[0]
                row = g if row is None else join_h(row, g, XS[i])
            rows.append(row)
        acc = rows[0]
        for j in range(1, len(YS)):
            acc = join_v(acc, rows[j], YS[j])
        full.append(acc)
    return full


def sheet8(frames: list, out: str) -> None:
    """Packs the frames into a 4 × 4 sheet and quantises it to 256 colours with ffmpeg."""
    H, W = frames[0].shape[:2]
    cols = 4
    rows = (len(frames) + cols - 1) // cols
    sheet = np.zeros((rows * H, cols * W, 4), np.uint8)
    sheet[..., 3] = 255
    for k, f in enumerate(frames):
        sheet[(k // cols) * H:(k // cols + 1) * H, (k % cols) * W:(k % cols + 1) * W, :3] = (f + 0.5).astype(np.uint8)
    raw = out + ".rgba.png"
    pal = out + ".pal.png"
    write_png(raw, sheet)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-vf", "palettegen=max_colors=256:stats_mode=full", pal], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-i", pal, "-lavfi", "paletteuse=dither=none", out], check=True)
    os.remove(raw)
    os.remove(pal)


def animate_view(name: str, variant: str, dry: bool) -> None:
    still_path = os.path.join(VIEWS, f"{name}.png")
    out = os.path.join(VIEWS, f"{name}.loop.png")
    tiles_dir = os.path.join(VIEWS, f"{name}-tiles")
    img = read_png(still_path)
    if dry:
        print(f"{name}: would animate {img.shape[1]}×{img.shape[0]} as six tiles ({MOTION[variant][:60]}…)", flush=True)
        return
    os.makedirs(tiles_dir, exist_ok=True)
    threads = []
    for j, y in enumerate(YS):
        for i, x in enumerate(XS):
            tile = os.path.join(tiles_dir, f"t{j}{i}.png")
            d = os.path.join(tiles_dir, f"t{j}{i}")
            if os.path.exists(os.path.join(d, f"frame-{FRAMES - 1:02d}.png")):
                continue
            write_png(tile, np.ascontiguousarray(img[y:y + TH, x:x + TW]))
            t = threading.Thread(target=animate_tile, args=(tile, MOTION[variant], d))
            t.start()
            threads.append(t)
    for t in threads:
        t.join()
    frames = stitch(tiles_dir, img[..., :3].astype(np.float32))
    sheet8(frames, out)
    print(f"{name}: {len(frames)} frames → {out[len(ROOT) + 1:]} ({os.path.getsize(out) // 1024} KB)", flush=True)


def main() -> None:
    opt = lambda k, d=None: (sys.argv[sys.argv.index(k) + 1] if k in sys.argv and sys.argv.index(k) + 1 < len(sys.argv) else d)
    only = opt("--only")
    variants = opt("--variants", "golden,night,rain").split(",")
    jobs = int(opt("--jobs", 1))
    force = "--force" in sys.argv
    dry = "--dry" in sys.argv
    hubs = only.split(",") if only else sorted({f[:3] for f in os.listdir(VIEWS) if f.endswith(".png") and "-" not in f and "." not in f[:-4]})
    work = []
    for h in hubs:
        for v in variants:
            name = h if v == "golden" else f"{h}-{v}"
            if not os.path.exists(os.path.join(VIEWS, f"{name}.png")):
                continue
            if not force and os.path.exists(os.path.join(VIEWS, f"{name}.loop.png")):
                continue
            work.append((name, v))
    print(f"{len(work)} views to animate, {12 * len(work)} generations", flush=True)
    sem = threading.Semaphore(jobs)

    def run(name, v):
        with sem:
            try:
                animate_view(name, v, dry)
            except (SystemExit, Exception) as e:  # noqa: BLE001
                print(f"{name}: failed: {e}", flush=True)

    threads = [threading.Thread(target=run, args=w) for w in work]
    for t in threads:
        t.start()
    for t in threads:
        t.join()


if __name__ == "__main__":
    main()
