#!/usr/bin/env python3
"""
Re-projects the painted map from the Albers cone it was painted in (1408 × 960, parallels as
arcs) to the straight projection map.ts draws now (1584 × 856, the 49th parallel a level line;
the frame is sized so the painting is nowhere shrunk — the middle keeps the old painting's scale
within 2.5% and only the coasts, where the cone's meridians leaned, are turned),
without spending a generation: every pixel of the new frame looks up its longitude and latitude,
finds that spot in the old painting and takes its nearest pixel, so the pixel art stays crisp
(--smooth samples bilinearly instead: soft, and twice the file). Beyond the old frame the
painting fades into its own edge sea. Level 1 is warped at twice the size. The cone's meridians
lean up to 18° at the coasts, so a plain warp would lean the painted cities there with them:
around every hub the warp blends into a plain shift instead (the city keeps the cone's upright
drawing and only moves), feathered into the turned country around it.

  reproject-map.py [--smooth] [--check] [files...]      default: l0-summer l0-autumn l0-winter l0-spring l1-summer

--check prints how far the warp stretches or shrinks the old painting over the US (its longest
source step per new pixel must stay at or under 1 for no row or column of it to be dropped).

The projections are the ones in apps/web/src/map.ts (the old cone kept here for the warp) fitted
to tools/us-ring.json, the US outline the TypeScript fits the frame to. Writes in place.
"""
import importlib.util
import json
import math
import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("paint_map", os.path.join(HERE, "paint-map.py"))
_pm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_pm)
read_png, write_png = _pm.read_png, _pm.write_png

MAP = os.path.join(os.path.dirname(HERE), "assets", "map")
_GEO = json.load(open(os.path.join(HERE, "us-ring.json")))
RING = _GEO["US_RING"]
HUBS = _GEO["hubs"]
# How far (level-0 pixels) a hub's painted city reaches, where it is kept upright, and the feather beyond.
CITY_R = {3: 60, 2: 48, 1: 40, 0: 32}
CITY_FEATHER = 30
OLD_W, OLD_H = 1408, 960
NEW_W, NEW_H = 1584, 856

RAD = math.pi / 180
PHI1, PHI2, PHI0, LAM0 = 29.5 * RAD, 45.5 * RAD, 37.5 * RAD, -96 * RAD
N = (math.sin(PHI1) + math.sin(PHI2)) / 2
C = math.cos(PHI1) ** 2 + 2 * N * math.sin(PHI1)
RHO0 = math.sqrt(C - 2 * N * math.sin(PHI0)) / N
KX = math.cos(PHI0)


def albers(lon, lat):
    rho = np.sqrt(C - 2 * N * np.sin(lat * RAD)) / N
    th = N * (lon * RAD - LAM0)
    return rho * np.sin(th), RHO0 - rho * np.cos(th)


def flat(lon, lat):
    return (lon * RAD - LAM0) * KX, lat * RAD


def fit(proj, W: int, H: int) -> dict:
    """fitProjection() of map.ts: the US ring with a 3% margin, centred."""
    pts = [proj(lo, la) for lo, la in RING]
    minX, maxX = min(p[0] for p in pts), max(p[0] for p in pts)
    minY, maxY = min(p[1] for p in pts), max(p[1] for p in pts)
    m = max(6, round(min(W, H) * 0.03))
    s = min((W - 2 * m) / (maxX - minX), (H - 2 * m) / (maxY - minY))
    return dict(minX=minX, maxX=maxX, minY=minY, maxY=maxY, s=s, offX=(W - (maxX - minX) * s) / 2, offY=(H - (maxY - minY) * s) / 2)


OLD = fit(albers, OLD_W, OLD_H)
NEW = fit(flat, NEW_W, NEW_H)


def warp(img: np.ndarray, smooth: bool = False) -> np.ndarray:
    ls = img.shape[1] // OLD_W
    assert img.shape[1] == OLD_W * ls and img.shape[0] == OLD_H * ls, img.shape
    Wn, Hn = NEW_W * ls, NEW_H * ls
    X, Y = np.meshgrid((np.arange(Wn, dtype=np.float64) + 0.5) / ls, (np.arange(Hn, dtype=np.float64) + 0.5) / ls)
    # The new frame's pixel centres → longitude and latitude → the old frame.
    x = (X - NEW["offX"]) / NEW["s"] + NEW["minX"]
    y = NEW["maxY"] - (Y - NEW["offY"]) / NEW["s"]
    lon = (x / KX + LAM0) / RAD
    lat = y / RAD
    ax, ay = albers(lon, lat)
    ox = (OLD["offX"] + (ax - OLD["minX"]) * OLD["s"]) * ls - 0.5
    oy = (OLD["offY"] + (OLD["maxY"] - ay) * OLD["s"]) * ls - 0.5
    # Keep every city upright: inside its radius the mapping is the plain shift that puts the hub where
    # the new frame puts it, blended into the turned mapping over the feather.
    for h in HUBS:
        fx, fy = flat(h["lon"], h["lat"])
        nx = (NEW["offX"] + (fx - NEW["minX"]) * NEW["s"]) * ls
        ny = (NEW["offY"] + (NEW["maxY"] - fy) * NEW["s"]) * ls
        hx, hy = albers(h["lon"], h["lat"])
        hox = (OLD["offX"] + (hx - OLD["minX"]) * OLD["s"]) * ls
        hoy = (OLD["offY"] + (OLD["maxY"] - hy) * OLD["s"]) * ls
        cls = 3 if h["weight"] >= 2.2 else 2 if h["weight"] >= 1.4 else 1 if h["weight"] >= 0.8 else 0
        r = CITY_R[cls] * ls
        f = CITY_FEATHER * ls
        x0, x1 = max(0, int(nx - r - f) - 1), min(Wn, int(nx + r + f) + 2)
        y0, y1 = max(0, int(ny - r - f) - 1), min(Hn, int(ny + r + f) + 2)
        px = X[y0:y1, x0:x1] * ls
        py = Y[y0:y1, x0:x1] * ls
        d = np.hypot(px - nx, py - ny)
        w = np.clip((r + f - d) / f, 0, 1)
        w = w * w * (3 - 2 * w)
        sx = px - nx + hox - 0.5
        sy = py - ny + hoy - 0.5
        ox[y0:y1, x0:x1] = ox[y0:y1, x0:x1] * (1 - w) + sx * w
        oy[y0:y1, x0:x1] = oy[y0:y1, x0:x1] * (1 - w) + sy * w
    # How far (in level-0 pixels) outside the old painting the sample falls: it fades to the edge sea there.
    outside = np.maximum.reduce([-ox, ox - (img.shape[1] - 1), -oy, oy - (img.shape[0] - 1), np.zeros_like(ox)]) / ls
    fade = np.clip((outside - 6) / 40, 0, 1)[..., None].astype(np.float32)
    ox = np.clip(ox, 0, img.shape[1] - 1)
    oy = np.clip(oy, 0, img.shape[0] - 1)
    src = img[..., :3].astype(np.float32)
    if smooth:
        x0 = np.floor(ox).astype(np.int32)
        y0 = np.floor(oy).astype(np.int32)
        x1 = np.minimum(x0 + 1, img.shape[1] - 1)
        y1 = np.minimum(y0 + 1, img.shape[0] - 1)
        fx = (ox - x0)[..., None].astype(np.float32)
        fy = (oy - y0)[..., None].astype(np.float32)
        out = (src[y0, x0] * (1 - fx) + src[y0, x1] * fx) * (1 - fy) + (src[y1, x0] * (1 - fx) + src[y1, x1] * fx) * fy
    else:
        out = src[np.rint(oy).astype(np.int32), np.rint(ox).astype(np.int32)]
    edge = np.concatenate([src[0], src[-1], src[:, 0], src[:, -1]]).reshape(-1, 3)
    sea = np.median(edge, axis=0)
    out = out * (1 - fade) + sea * fade
    res = np.empty((Hn, Wn, 4), np.uint8)
    res[..., :3] = (out + 0.5).astype(np.uint8)
    res[..., 3] = 255
    return res


def check() -> None:
    X, Y = np.meshgrid(np.arange(NEW_W, dtype=np.float64) + 0.5, np.arange(NEW_H, dtype=np.float64) + 0.5)
    lon = (((X - NEW["offX"]) / NEW["s"] + NEW["minX"]) / KX + LAM0) / RAD
    lat = (NEW["maxY"] - (Y - NEW["offY"]) / NEW["s"]) / RAD
    ax, ay = albers(lon, lat)
    ox = OLD["offX"] + (ax - OLD["minX"]) * OLD["s"]
    oy = OLD["offY"] + (OLD["maxY"] - ay) * OLD["s"]
    a, b = np.gradient(ox, axis=1), np.gradient(ox, axis=0)
    c, d = np.gradient(oy, axis=1), np.gradient(oy, axis=0)
    q = a * a + b * b + c * c + d * d
    sv = np.sqrt((q + np.sqrt(np.maximum(q * q - 4 * (a * d - b * c) ** 2, 0))) / 2)
    us = (lon > -125) & (lon < -66.5) & (lat > 24.5) & (lat < 49.5)
    print(f"over the US: longest source step {sv[us].max():.3f} px, across {np.abs(a[us]).max():.3f}, down {np.abs(d[us]).max():.3f}; turn up to {np.degrees(np.arctan2(c, a))[us].max():.1f}° / {np.degrees(np.arctan2(c, a))[us].min():.1f}°")


def main() -> None:
    smooth = "--smooth" in sys.argv
    names = [a for a in sys.argv[1:] if not a.startswith("--")] or ["l0-summer", "l0-autumn", "l0-winter", "l0-spring", "l1-summer"]
    print(f"old cone {OLD_W}×{OLD_H} → straight {NEW_W}×{NEW_H}; new scale {NEW['s'] * RAD:.2f} px per degree ({'bilinear' if smooth else 'nearest pixel'})", flush=True)
    if "--check" in sys.argv:
        check()
        return
    for n in names:
        t = time.time()
        path = os.path.join(MAP, f"{n}.png")
        img = read_png(path)
        out = warp(img, smooth)
        write_png(path, out)
        print(f"{n}: {img.shape[1]}×{img.shape[0]} → {out.shape[1]}×{out.shape[0]} in {time.time() - t:.0f}s", flush=True)


if __name__ == "__main__":
    main()
