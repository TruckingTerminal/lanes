#!/usr/bin/env python3
"""The title loop as a side-view parallax (Jeff, 2026-11-01: in the old loop the road moved and nothing beside it did).

The truck holds its place with its wheels turning while the world streams past at speeds set by distance: the sky
and the mesas stay put; the shoulder (its poles, wires, cacti and the diner) and the road move 4 px a frame; the
scrub in front of the road 6. Every moving layer repeats a whole number of times in the 96 frames, so the frame
after the last is the first and the loop simply repeats (mapart.ts TITLE_LOOP).

Layers (apps/web/assets/title/parallax, painted by asset-pass.sh titleparallax): back.png, the sky, the mesas and
the far desert; diner.png; scrub.png, a sheet of plants cut apart here; rig.loop.png, the truck's 16-frame roll, in
true side profile (an eight-direction object's east view, dimmed toward the dusk by RIG_GRADE) so that it drives
along the road and not across it. title.ts cuts between this shot and the head-on one (tools/title-approach.py).

  title-parallax.py [--frames <dir>]
      → assets/title/title.loop.png (+ .json), 96 frames of 256 × 144 in 12 columns, played at 24 fps, and the
        poster assets/title/loop/frame-01.png (the first frame); --frames also writes frame-00 … for previews.
"""
import importlib.util
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("pm", os.path.join(HERE, "paint-map.py"))
pm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pm)  # type: ignore[union-attr]

ASSETS = os.path.join(HERE, "..", "assets", "title")
LAYERS = os.path.join(ASSETS, "parallax")
W, H, N, COLS = 256, 144, 96, 12
ROAD_V, FORE_V = 4, 6  # px a frame: the shoulder and the road, and the scrub in front of the road
NEAR_W = ROAD_V * N  # 384: the shoulder and the road come round once a loop
FORE_W = FORE_V * N // 2  # 288: the foreground comes round twice

# Rows: the shoulder behind the road, the road's far edge line, centre dashes and near edge line, the foreground.
SHOULDER, ROAD, CENTRE, ROAD_END = 96, 106, 114, 124
POLE_TOP, ARM = 44, 48
TRUCK_X, TRUCK_FOOT = 58, 121  # the rig sprite's left edge and the row its tyres stand on

DIRT, PEBBLE = (104, 64, 54), (72, 46, 40)
ASPHALT, SHEEN = (46, 42, 60), (64, 54, 74)
LINE, DASH = (196, 176, 150), (230, 186, 92)
SAND, SAND_DEEP = (80, 47, 41), (62, 37, 35)
POLE, POLE_DARK, INSULATOR, WIRE = (60, 40, 34), (40, 27, 26), (220, 210, 190), (34, 24, 28)
RIG_GRADE = np.array([0.9, 0.8, 0.84], np.float32)


def load(name: str) -> np.ndarray:
    return pm.read_png(os.path.join(LAYERS, name))


def crop(img: np.ndarray) -> np.ndarray:
    ys, xs = np.nonzero(img[..., 3] > 0)
    return img[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]


def sprites(sheet: np.ndarray) -> list:
    """The sheet's plants, left to right, split at the empty columns between them."""
    filled = (sheet[..., 3] > 0).any(axis=0)
    out, x = [], 0
    while x < len(filled):
        if filled[x]:
            start = x
            while x < len(filled) and filled[x]:
                x += 1
            out.append(crop(sheet[:, start:x]))
        x += 1
    return out


def over(dst: np.ndarray, src: np.ndarray, x: int, y: int, alpha: float = 1.0) -> None:
    """Composites src onto dst with its top-left at (x, y), clipped to dst."""
    h, w = src.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(dst.shape[1], x + w), min(dst.shape[0], y + h)
    if x0 >= x1 or y0 >= y1:
        return
    s = src[y0 - y : y1 - y, x0 - x : x1 - x].astype(np.float32)
    d = dst[y0:y1, x0:x1].astype(np.float32)
    a = s[..., 3:4] / 255 * alpha
    d[..., :3] = s[..., :3] * a + d[..., :3] * (1 - a)
    d[..., 3:4] = np.maximum(d[..., 3:4], a * 255)
    dst[y0:y1, x0:x1] = d.round().astype(np.uint8)


def wrapped(dst: np.ndarray, src: np.ndarray, x: int, y: int, period: int) -> None:
    """Draws src at x and at every whole period either side, so a strip's edges join."""
    for k in (-1, 0, 1):
        over(dst, src, x + k * period, y)


def textured(w: int, h: int, base, spread: int, seed: int) -> np.ndarray:
    """A band of base colour with fixed noise, w wide so that it tiles at w."""
    rng = np.random.default_rng(seed)
    band = np.zeros((h, w, 4), np.float32)
    band[..., :3] = base
    band[..., :3] += rng.integers(-spread, spread + 1, (h, w, 1))
    band[..., 3] = 255
    return band.clip(0, 255).astype(np.uint8)


def paint(strip: np.ndarray, x: int, y: int, color, period: int) -> None:
    strip[y, x % period, :3] = color
    strip[y, x % period, 3] = 255


def near_layer(diner: np.ndarray, cacti: list) -> np.ndarray:
    """The shoulder and the road: poles and wires, cacti, the diner once a loop, asphalt with its lines."""
    s = np.zeros((H, NEAR_W, 4), np.uint8)
    s[SHOULDER:ROAD] = textured(NEAR_W, ROAD - SHOULDER, DIRT, 9, 1)
    rng = np.random.default_rng(2)
    for _ in range(40):
        paint(s, int(rng.integers(0, NEAR_W)), int(rng.integers(SHOULDER + 1, ROAD)), PEBBLE, NEAR_W)
    road = textured(NEAR_W, ROAD_END - ROAD, ASPHALT, 5, 3)
    road[0:3, :, :3] = SHEEN
    road[1, :, :3] = LINE
    road[ROAD_END - ROAD - 2, :, :3] = LINE
    for x in range(0, NEAR_W, 32):
        road[CENTRE - ROAD : CENTRE - ROAD + 2, x : x + 12, :3] = DASH
    s[ROAD:ROAD_END] = road
    poles = [32, 128, 320]  # the diner stands where a fourth would
    for i, px in enumerate(poles):
        nxt = poles[(i + 1) % len(poles)] + (NEAR_W if i + 1 == len(poles) else 0)
        span = nxt - px
        sag = 4 + span // 48
        for end in (-6, 6):
            for k in range(span + 1):
                t = k / span
                paint(s, px + end + k, ARM + 1 + int(round(4 * sag * t * (1 - t))), WIRE, NEAR_W)
    for px in poles:
        for y in range(POLE_TOP, ROAD):
            paint(s, px, y, POLE, NEAR_W)
            paint(s, px + 1, y, POLE_DARK, NEAR_W)
        for dx in range(-7, 8):
            paint(s, px + dx, ARM, POLE, NEAR_W)
            paint(s, px + dx, ARM + 1, POLE_DARK, NEAR_W)
        for dx in (-6, 0, 6):
            paint(s, px + dx, ARM - 1, INSULATOR, NEAR_W)
    wrapped(s, diner, 168, ROAD - 1 - diner.shape[0], NEAR_W)
    for cx, cactus in zip((80, 290), cacti):
        wrapped(s, cactus, cx, ROAD - 2 - cactus.shape[0], NEAR_W)
    return s


def fore_layer(plants: list) -> np.ndarray:
    """The ground in front of the road with low scrub, cropped by the bottom of the frame."""
    f = np.zeros((H, FORE_W, 4), np.uint8)
    f[ROAD_END:H] = textured(FORE_W, H - ROAD_END, SAND, 7, 4)
    f[H - 6 : H] = textured(FORE_W, 6, SAND_DEEP, 6, 5)
    for x, i in ((10, 0), (66, 1), (118, 2), (176, 3), (226, 0), (262, 1)):
        p = plants[i]
        wrapped(f, p, x, H + 5 - p.shape[0], FORE_W)
    return f


def glow(frame: np.ndarray, left: int, right: int) -> None:
    """The truck's shadow under it and its headlights' wash on the road ahead (left, right: its outline's ends)."""
    shade = np.zeros((4, right - left - 4, 4), np.uint8)
    shade[..., 3] = 90
    over(frame, shade, left + 2, TRUCK_FOOT - 2)
    beam = np.zeros((ROAD_END - ROAD - 3, 56, 4), np.uint8)
    for x in range(56):
        half = 1 + x // 8
        mid = (TRUCK_FOOT - 4) - ROAD
        beam[max(0, mid - half) : mid + half + 1, x, :3] = (255, 226, 150)
        beam[max(0, mid - half) : mid + half + 1, x, 3] = int(80 * (1 - x / 56))
    over(frame, beam, right, ROAD + 1)


def dusk(rig: np.ndarray) -> np.ndarray:
    """The truck's flat game colours dimmed and warmed toward the evening light of the painted layers."""
    out = rig.copy()
    out[..., :3] = (rig[..., :3].astype(np.float32) * RIG_GRADE).round().clip(0, 255).astype(np.uint8)
    return out


def main() -> None:
    back = load("back.png")
    diner = crop(load("diner.png"))
    plants = sprites(load("scrub.png"))  # sagebrush, grass, saguaro, prickly pear, rocks, tumbleweed
    low = [plants[0], plants[1], plants[4], plants[5]]
    cacti = [plants[2], plants[3]]
    sheet = load("rig.loop.png")
    meta = json.load(open(os.path.join(LAYERS, "rig.loop.json")))
    rw, rh, rn = meta["w"], meta["h"], meta["frames"]
    rig = [dusk(sheet[(i // meta["cols"]) * rh : (i // meta["cols"] + 1) * rh, (i % meta["cols"]) * rw : (i % meta["cols"] + 1) * rw]) for i in range(rn)]
    xs = np.nonzero((rig[0][..., 3] > 0).any(axis=0))[0]
    left, right = TRUCK_X + int(xs.min()), TRUCK_X + int(xs.max()) + 1
    near, fore = near_layer(diner, cacti), fore_layer(low)
    frames = []
    for t in range(N):
        f = back.copy()
        wrapped(f, near, -((t * ROAD_V) % NEAR_W), 0, NEAR_W)
        glow(f, left, right)
        over(f, rig[t % rn], TRUCK_X, TRUCK_FOOT - rh + 1)
        wrapped(f, fore, -((t * FORE_V) % FORE_W), 0, FORE_W)
        frames.append(f)
    rows = -(-N // COLS)
    out = np.zeros((rows * H, COLS * W, 4), np.uint8)
    for i, f in enumerate(frames):
        r, c = divmod(i, COLS)
        out[r * H : (r + 1) * H, c * W : (c + 1) * W] = f
    pm.write_png(os.path.join(ASSETS, "title.loop.png"), out)
    json.dump({"frames": N, "cols": COLS, "w": W, "h": H}, open(os.path.join(ASSETS, "title.loop.json"), "w"))
    pm.write_png(os.path.join(ASSETS, "loop", "frame-01.png"), frames[0])
    if "--frames" in sys.argv:
        d = sys.argv[sys.argv.index("--frames") + 1]
        os.makedirs(d, exist_ok=True)
        pm.write_png(os.path.join(d, "frame-00.png"), frames[0])
        for i, f in enumerate(frames):
            pm.write_png(os.path.join(d, f"frame-{i + 1:02d}.png"), f)
    print(f"title.loop.png: {N} frames of {W}×{H} in {COLS} columns; poster loop/frame-01.png")


if __name__ == "__main__":
    main()
