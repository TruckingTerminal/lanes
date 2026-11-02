#!/usr/bin/env python3
"""The map's trucks as tractor-trailers (Jeff, 2026-11-02: "my trucks are box trucks on the map, not semis").

The painted sheets drew a cab with a short box flush behind it, so at every zoom they read as straight trucks. These
are rendered instead from a model of a real rig, measured in feet, so the proportions hold in all eight headings: a
long-nose conventional tractor (hood, cab, raised sleeper, stacks, fuel tanks, a steer axle and a tandem of drive
axles) and, coupled over its drive axles with a gap behind the sleeper, a 53-foot trailer whose roof stands above the
cab's, on its own rear tandem with the landing gear down at the front. A dry van, a reefer (its unit on the nose, a
grey stripe) or a flatbed with a tarped load. Seen from high up at the map's angle, lit from the south-west, snapped to
the old sheets' colours with their dark outline. The cab keeps the player's cyan (hue 181-209) and nothing else does,
since assets.ts turns that hue lime for other players and grey for the AI.

Same layout as before, so assets.ts and mapview.ts read them unchanged: 68-px cells, one row of eight headings (south,
south-east, east, north-east, north, north-west, west, south-west), the rig centred in each.

  rig-sheets.py   → assets/trucks/{van64,reefer64,flatbed64}/*.png
"""
import importlib.util
import os

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("pm", os.path.join(HERE, "paint-map.py"))
pm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pm)  # type: ignore[union-attr]

TRUCKS = os.path.join(HERE, "..", "assets", "trucks")
CELL = 68
SS = 4  # supersampling
SCALE = 0.86  # pixels a foot
TILT = np.radians(50)  # the camera's angle above the ground
LONG = 1.12  # the tractor drawn this much longer than it is, so the cab reads beside 53 feet of trailer
L = 20.8 * LONG + 51.7  # bumper to the trailer's rear, feet
WIDE = 1.45  # the rig drawn this much wider than it is, as sprites are, so it isn't a stick from above
DIRS = {"south": 90, "south-east": 45, "east": 0, "north-east": -45, "north": -90, "north-west": -135, "west": 180, "south-west": 135}
SUN = np.array([-0.5, 0.25, 0.85])  # from the west, high, a little south (map x east, y south, z up)
SUN = SUN / np.linalg.norm(SUN)

# Colour ramps, dark to light, from the old sheets; the cab's cyan is the only paint in the recoloured hue band.
RAMPS = {
    "cyan": [(12, 37, 60), (23, 86, 110), (32, 124, 143), (49, 185, 193), (95, 226, 229)],
    "white": [(143, 140, 151), (166, 173, 198), (184, 189, 208), (214, 216, 230), (242, 240, 252)],
    "chrome": [(59, 51, 70), (77, 79, 98), (110, 110, 132), (143, 140, 151), (202, 199, 206)],
    "dark": [(13, 11, 34), (38, 35, 57), (59, 51, 70)],
    "tyre": [(13, 11, 34), (24, 21, 42), (38, 35, 57)],
    "glass": [(13, 11, 34), (24, 26, 44), (40, 44, 66), (77, 79, 98)],
    "stripe": [(98, 104, 128), (126, 133, 158), (150, 157, 180)],
    "deck": [(38, 35, 57), (70, 58, 62), (96, 76, 70)],
    "tarp": [(52, 56, 30), (72, 78, 40), (96, 102, 54), (124, 130, 72), (150, 154, 94)],
    "strap": [(150, 70, 30), (201, 106, 38), (232, 140, 60)],
    "lamp": [(244, 168, 60), (255, 217, 106)],
    "tail": [(142, 42, 36), (216, 74, 58)],
}
INK = (13, 11, 34)


def box(x0, x1, y0, y1, z0, z1, mat, seams=0.0):
    return ("box", (x0, x1, y0, y1, z0, z1), mat, seams)


def cyl(axis, c0, c1, r, lo, hi, mat):
    """A cylinder along `axis` ('x', 'y' or 'z') through (c0, c1) in the other two axes, from lo to hi."""
    return ("cyl", (axis, c0, c1, r, lo, hi), mat, 0.0)


def wheel(x, y0, y1, r=1.8):
    # The tyre, and the rim's face on the outside.
    out = y1 if abs(y1) > abs(y0) else y0
    rim = (out - 0.05, out + 0.02) if out > 0 else (out - 0.02, out + 0.05)
    return [cyl("y", x, r, r, y0, y1, "tyre"), cyl("y", x, r, r * 0.55, rim[0], rim[1], "chrome")]


def tractor() -> list:
    return [stretched(q) for q in _tractor()]


def stretched(pr):
    """A tractor part drawn LONG times as long, from the bumper back."""
    kind, g, mat, seams = pr
    if kind == "box":
        return (kind, (g[0] * LONG, g[1] * LONG, *g[2:]), mat, seams)
    axis, c0, c1, r, lo, hi = g
    if axis == "x":
        return (kind, (axis, c0, c1, r, lo * LONG, hi * LONG), mat, seams)
    return (kind, (axis, c0 * LONG, c1, r, lo, hi), mat, seams)


def _tractor() -> list:
    p = [
        box(0.0, 1.2, -4.1, 4.1, 1.3, 2.6, "chrome"),  # bumper
        box(1.0, 1.7, -1.7, 1.7, 2.6, 5.5, "chrome"),  # grille
        box(1.7, 8.0, -2.1, 2.1, 3.0, 5.7, "cyan"),  # the long hood
        box(2.0, 6.8, 2.1, 4.1, 2.5, 4.3, "cyan"),  # front fenders
        box(2.0, 6.8, -4.1, -2.1, 2.5, 4.3, "cyan"),
        box(1.9, 2.1, 2.6, 3.8, 3.1, 3.9, "lamp"),  # headlights
        box(1.9, 2.1, -3.8, -2.6, 3.1, 3.9, "lamp"),
        box(8.0, 12.0, -4.0, 4.0, 3.6, 9.6, "cyan"),  # cab
        box(7.85, 8.05, -3.7, 3.7, 6.6, 9.4, "glass"),  # windshield
        box(8.5, 11.6, 3.95, 4.08, 6.4, 9.4, "glass"),  # side windows
        box(8.5, 11.6, -4.08, -3.95, 6.4, 9.4, "glass"),
        box(12.0, 16.8, -4.0, 4.0, 3.6, 11.2, "cyan"),  # the raised sleeper
        box(8.0, 16.8, -4.0, 4.0, 9.6, 9.75, "cyan"),
        box(1.5, 25.0, -1.6, 1.6, 2.4, 3.6, "dark"),  # frame
        box(16.8, 20.8, -2.0, 2.0, 3.6, 3.9, "dark"),  # deck plate behind the sleeper
        box(19.0, 22.0, -2.6, 2.6, 3.6, 4.1, "dark"),  # fifth wheel
        box(24.4, 24.8, 2.2, 4.2, 0.6, 3.0, "dark"),  # mud flaps
        box(24.4, 24.8, -4.2, -2.2, 0.6, 3.0, "dark"),
        cyl("z", 12.3, 4.35, 0.5, 4.5, 13.2, "chrome"),  # stacks
        cyl("z", 12.3, -4.35, 0.5, 4.5, 13.2, "chrome"),
        cyl("x", 3.55, 2.6, 1.05, 8.4, 12.0, "chrome"),  # fuel tanks
        cyl("x", -3.55, 2.6, 1.05, 8.4, 12.0, "chrome"),
    ]
    p += wheel(4.7, 3.1, 4.15) + wheel(4.7, -4.15, -3.1)  # steer axle
    for x in (18.6, 22.8):  # drive tandem, duals
        p += wheel(x, 2.0, 4.25) + wheel(x, -4.25, -2.0)
    return p


def trailer(kind: str) -> list:
    x0, x1 = 20.8 * LONG, L  # its nose four feet behind the sleeper, over the drive axles
    p = [
        box(x0, x1, -1.5, 1.5, 3.6, 4.3, "dark"),  # rails
        box(x0 + 9.5, x0 + 10.3, 2.7, 3.4, 0.6, 4.3, "dark"),  # landing gear
        box(x0 + 9.5, x0 + 10.3, -3.4, -2.7, 0.6, 4.3, "dark"),
        box(x1 - 0.6, x1, -3.8, 3.8, 1.5, 2.2, "dark"),  # rear bumper
    ]
    for x in (x1 - 8.6, x1 - 4.4):  # the rear tandem
        p += wheel(x, 2.0, 4.25) + wheel(x, -4.25, -2.0)
    if kind == "flatbed":
        p.append(box(x0, x1, -4.25, 4.25, 4.3, 5.3, "deck"))
        n = 4
        span = (x1 - x0 - 5.0) / n
        for i in range(n):  # the load in four tarped bundles, gaps between them, two straps over each
            b0 = x0 + 2.5 + i * span + 0.8
            b1 = b0 + span - 1.6
            p.append(box(b0, b1, -3.9, 3.9, 5.3, 9.4, "tarp"))
            for q in (0.3, 0.7):
                x = b0 + q * (b1 - b0)
                p.append(box(x - 0.6, x + 0.6, -4.0, 4.0, 5.3, 9.5, "strap"))
        p.append(box(x1 - 0.1, x1 + 0.02, 3.0, 3.9, 4.4, 5.2, "tail"))
        p.append(box(x1 - 0.1, x1 + 0.02, -3.9, -3.0, 4.4, 5.2, "tail"))
    else:
        p.append(box(x0, x1, -4.25, 4.25, 4.3, 13.6, "white", seams=4.0))
        p.append(box(x0, x1, 4.24, 4.32, 4.3, 5.0, "chrome"))  # the rub rails along the bottom
        p.append(box(x0, x1, -4.32, -4.24, 4.3, 5.0, "chrome"))
        p.append(box(x1 - 0.02, x1 + 0.04, -4.1, 4.1, 4.4, 13.4, "chrome", seams=0))  # the rear doors' frame
        p.append(box(x1 + 0.03, x1 + 0.06, -3.9, 3.9, 4.6, 13.2, "white"))
        p.append(box(x1 - 0.05, x1 + 0.03, 3.1, 4.0, 4.6, 5.4, "tail"))
        p.append(box(x1 - 0.05, x1 + 0.03, -4.0, -3.1, 4.6, 5.4, "tail"))
        if kind == "reefer":
            p.append(box(x0 - 0.9, x0, -3.2, 3.2, 9.0, 13.2, "chrome"))  # the refrigeration unit on its nose
            p.append(box(x0 + 0.5, x1 - 0.5, 4.24, 4.3, 6.2, 7.0, "stripe"))
            p.append(box(x0 + 0.5, x1 - 0.5, -4.3, -4.24, 6.2, 7.0, "stripe"))
    return p


def hits(prim, o, d):
    """The ray parameter of the first hit on `prim` for rays o + t·d (arrays of shape (n, 3)), inf where missed, and
    the normals there."""
    n = o.shape[0]
    t = np.full(n, np.inf)
    nrm = np.zeros((n, 3))
    kind, g, _mat, _ = prim
    if kind == "box":
        lo = np.array([g[0], g[2], g[4]])
        hi = np.array([g[1], g[3], g[5]])
        with np.errstate(divide="ignore", invalid="ignore"):
            inv = 1.0 / d
            t0 = (lo - o) * inv
            t1 = (hi - o) * inv
        tmin = np.minimum(t0, t1)
        tmax = np.maximum(t0, t1)
        tn = np.nanmax(tmin, axis=1)
        tf = np.nanmin(tmax, axis=1)
        ok = (tn <= tf) & (tf > 0)
        t[ok] = tn[ok]
        ax = np.nanargmax(tmin, axis=1)
        sgn = -np.sign(d[np.arange(n), ax])
        nrm[np.arange(n), ax] = sgn
        return t, nrm
    axis, c0, c1, r, lo, hi = g
    a = "xyz".index(axis)
    u, v = [i for i in range(3) if i != a]
    ou, ov, oa = o[:, u] - c0, o[:, v] - c1, o[:, a]
    du, dv, da = d[:, u], d[:, v], d[:, a]
    A = du * du + dv * dv
    B = 2 * (ou * du + ov * dv)
    C = ou * ou + ov * ov - r * r
    disc = B * B - 4 * A * C
    with np.errstate(invalid="ignore", divide="ignore"):
        s = np.sqrt(np.maximum(disc, 0))
        tc = (-B - s) / (2 * A)
    pa = oa + tc * da
    side = (disc >= 0) & (A > 1e-12) & (tc > 0) & (pa >= lo) & (pa <= hi)
    t[side] = tc[side]
    nrm[side, u] = (ou + tc * du)[side] / r
    nrm[side, v] = (ov + tc * dv)[side] / r
    for cap, sgn in ((lo, -1.0), (hi, 1.0)):  # the end caps
        with np.errstate(divide="ignore", invalid="ignore"):
            tp = (cap - oa) / da
        pu, pv = ou + tp * du, ov + tp * dv
        ok = (tp > 0) & (pu * pu + pv * pv <= r * r) & (tp < t)
        t[ok] = tp[ok]
        nrm[ok] = 0
        nrm[ok, a] = sgn
    return t, nrm


def widened(pr):
    kind, g, mat, seams = pr
    if kind == "box":
        return (kind, (g[0], g[1], g[2] * WIDE, g[3] * WIDE, g[4], g[5]), mat, seams)
    axis, c0, c1, r, lo, hi = g
    if axis == "y":
        return (kind, (axis, c0, c1, r, lo * WIDE, hi * WIDE), mat, seams)
    if axis == "z":
        return (kind, (axis, c0, c1 * WIDE, r, lo, hi), mat, seams)
    return (kind, (axis, c0 * WIDE, c1, r, lo, hi), mat, seams)


def render(prims: list, heading: float) -> np.ndarray:
    prims = [widened(p) for p in prims]
    th = np.radians(heading)
    f = np.array([np.cos(th), np.sin(th)])  # forward, on the map
    rgt = np.array([-np.sin(th), np.cos(th)])  # the rig's right side
    N = CELL * SS
    sy_c = (13.6 * np.cos(TILT)) / 2  # lift the picture so the rig, not its footprint, is centred
    px = (np.arange(N) + 0.5) / SS - CELL / 2
    sx, sy = np.meshgrid(px, px)
    sx = sx.ravel() / SCALE
    sy = sy.ravel() / SCALE - sy_c
    D0 = 200.0
    # World (map x east, y south, z up), centred on the rig's middle: the rays come down the camera's line of sight.
    X = sx
    Y = sy * np.sin(TILT) + D0 * np.cos(TILT)
    Z = -sy * np.cos(TILT) + D0 * np.sin(TILT)
    vw = np.array([0.0, -np.cos(TILT), -np.sin(TILT)])
    # Into the rig's frame: x from the bumper back, y to its right, z up.
    lx = L / 2 - (X * f[0] + Y * f[1])
    ly = X * rgt[0] + Y * rgt[1]
    o = np.stack([lx, ly, Z], 1)
    dl = np.array([-(vw[0] * f[0] + vw[1] * f[1]), vw[0] * rgt[0] + vw[1] * rgt[1], vw[2]])
    d = np.broadcast_to(dl, o.shape).copy()
    best = np.full(o.shape[0], np.inf)
    nrm = np.zeros(o.shape)
    mat = np.full(o.shape[0], -1)
    for i, pr in enumerate(prims):
        t, nn = hits(pr, o, d)
        closer = t < best
        best[closer] = t[closer]
        nrm[closer] = nn[closer]
        mat[closer] = i
    # Shade: the normal back on the map, lit by the sun; the trailer's panel seams a step darker.
    nw = np.stack([-nrm[:, 0] * f[0] + nrm[:, 1] * rgt[0], -nrm[:, 0] * f[1] + nrm[:, 1] * rgt[1], nrm[:, 2]], 1)
    lit = np.clip(nw @ SUN, 0, 1)
    shade = 0.28 + 0.72 * lit
    rgb = np.zeros((o.shape[0], 3))
    hitp = o + best[:, None] * d
    for i, pr in enumerate(prims):
        m = mat == i
        if not m.any():
            continue
        ramp = np.array(RAMPS[pr[2]], float)
        s = shade[m].copy()
        if pr[3]:
            seam = (np.mod(hitp[m, 0] - pr[1][0], pr[3]) < 0.35) & (np.abs(nrm[m, 1]) > 0.5)
            s[seam] -= 0.18
        if pr[2] in ("lamp", "tail"):
            s[:] = 1
        if pr[2] == "cyan":
            s *= 0.86  # the paint a step deeper than the white beside it, so the cab holds against a pale map
        idx = np.clip((s * len(ramp)).astype(int), 0, len(ramp) - 1)
        rgb[m] = ramp[idx]
    cov = (mat >= 0).reshape(N, N).astype(float)
    rgb = rgb.reshape(N, N, 3)
    # Down to the cell: the average of each pixel's samples, snapped to the ramps' colours, opaque where mostly covered.
    c = cov.reshape(CELL, SS, CELL, SS).mean((1, 3))
    acc = (rgb * cov[..., None]).reshape(CELL, SS, CELL, SS, 3).sum((1, 3)) / np.maximum(cov.reshape(CELL, SS, CELL, SS).sum((1, 3)), 1)[..., None]
    pal = np.array(sorted({col for r in RAMPS.values() for col in r}), float)
    near = ((acc[:, :, None, :] - pal[None, None]) ** 2).sum(-1).argmin(-1)
    out = np.zeros((CELL, CELL, 4), np.uint8)
    on = c >= 0.45
    out[..., :3] = pal[near].astype(np.uint8)
    out[..., 3] = np.where(on, 255, 0)
    # Inner outlines where the depth jumps (the gap behind the sleeper, the wheels under the body, the cab's edges): the
    # farther pixel of the two goes dark.
    dep = np.where(np.isfinite(best), best, 1e9).reshape(CELL, SS, CELL, SS).min((1, 3))
    edge = np.zeros_like(on)
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        nb = np.roll(np.roll(dep, dy, 0), dx, 1)
        nbon = np.roll(np.roll(on, dy, 0), dx, 1)
        edge |= on & nbon & (dep - nb > 2.5)
    out[edge, :3] = RAMPS["dark"][0]
    # The dark outline round the silhouette.
    ring = np.zeros_like(on)
    ring[1:] |= on[:-1]
    ring[:-1] |= on[1:]
    ring[:, 1:] |= on[:, :-1]
    ring[:, :-1] |= on[:, 1:]
    ring &= ~on
    out[ring, :3] = INK
    out[ring, 3] = 255
    return out


def main() -> None:
    order = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
    for kind in ("van", "reefer", "flatbed"):
        prims = tractor() + trailer(kind)
        sheet = np.concatenate([render(prims, DIRS[h]) for h in order], 1)
        path = os.path.join(TRUCKS, f"{kind}64", f"{kind}64.png")
        pm.write_png(path, sheet)
        print(f"{kind}64.png: {sheet.shape[1]}×{sheet.shape[0]}")


if __name__ == "__main__":
    main()
