#!/usr/bin/env python3
"""The head-on title's traffic, modelled for the painting's own camera (Jeff, 2026-11-02: "Each vehicle moving is a
still image that looks like crap in the head on title screen").

Every vehicle that drives up or down the painted road is a model measured in feet: a pickup, a sedan, and rigs from
tools/rig-sheets.py (the tractor with a van, a reefer, a flatbed or a tanker), boxes and cylinders with the old sheets'
colour ramps. title.ts draws them live, every frame, through the camera the painting implies: level, about seven feet
up, looking straight down the road at its vanishing point (211, 89) with a focal length of about 120 px (the ground
alone doesn't fix it; the painted truck's three-quarter view does), the coming lane about 14 feet to its left and the
going lane about 26. So a vehicle turns into three-quarter view as it comes, passes the camera at full size, and its
wheels, springs, lamps and exhaust move at every depth. This also works out, for each pair of kinds, the least gap a
follower keeps behind its leader so that their pictures never overlap at any depth (render() and the preview are for
looking at a model from the same camera).

  title-vehicles.py   → the tables between the vehicle markers in src/title.ts
"""
import importlib.util
import json
import os
import re

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))


def load(name: str, file: str):
    s = importlib.util.spec_from_file_location(name, os.path.join(HERE, file))
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)  # type: ignore[union-attr]
    return m


pm = load("pm", "paint-map.py")
rs = load("rs", "rig-sheets.py")

TITLE = os.path.join(HERE, "..", "assets", "title")
TS = os.path.join(HERE, "..", "src", "title.ts")
CAM = {"px": 211.0, "py": 89.0, "f": 120.0, "h": 7.0}  # the painting's camera, in band pixels and feet: a wide lens
LANES = {"coming": -14.0, "going": -26.0}  # lane centres, feet to the camera's right (so: left)
STEPS = [round(72 / 1.25**k, 2) for k in range(13)]  # depths of the anchor (front or rear), feet
SPAWN = 420.0  # where the coming lane's traffic appears, as lamps on the horizon, and the going lane's leaves it
POSTER_Y = 36.5  # the painting's truck: the rig's front at this depth fills the poster where the painted one stood
SS = 3
SUN = np.array([0.35, -0.6, 0.72])  # toward the key light, in the world: from the right, the camera's side, above
SUN = SUN / np.linalg.norm(SUN)

RAMPS = dict(rs.RAMPS)
RAMPS.update(
    {
        "red": [(64, 16, 24), (110, 26, 32), (158, 40, 40), (204, 62, 52), (236, 110, 88)],
        "cream": [(96, 86, 76), (138, 126, 108), (178, 166, 144), (214, 202, 176), (244, 236, 212)],
        "amberp": [(96, 46, 20), (150, 76, 28), (201, 106, 38), (244, 168, 60), (255, 210, 120)],
        "whitep": [(110, 110, 132), (150, 152, 170), (190, 192, 206), (222, 222, 234), (250, 248, 252)],
        "seam": [(77, 79, 98), (110, 110, 132), (143, 140, 151), (166, 173, 198)],
    }
)
WHEEL_MATS = ("tyre",)


def box(x0, x1, y0, y1, z0, z1, mat, seams=0.0):
    return rs.box(x0, x1, y0, y1, z0, z1, mat, seams)


def wheels_of(xs, r, y_in, y_out):
    return [(x, r, y_in, y_out) for x in xs]


def arches(xs, r, x0, x1, W, z0, z1, mat):
    """A body side from x0 to x1 between heights z0 and z1, cut round wheel arches at xs (radius r)."""
    out, x = [], x0
    for wx in sorted(xs):
        if wx - r > x:
            out.append(box(x, wx - r, -W, W, z0, z1, mat))
        x = wx + r
    if x < x1:
        out.append(box(x, x1, -W, W, z0, z1, mat))
    return out


def wells(xs, r, w_in, z_top):
    """The dark of each wheel arch, behind where the wheel turns."""
    return [box(wx - r, wx + r, -w_in, w_in, 0.9, z_top, "dark") for wx in xs]


def seam(x, W, z0, z1):
    return [box(x - 0.06, x + 0.06, W, W + 0.03, z0, z1, "dark"), box(x - 0.06, x + 0.06, -W - 0.03, -W, z0, z1, "dark")]


def pickup():
    """An American full-size pickup, square-bodied, red: chrome bumpers and grille, a long hood, a regular cab, the bed."""
    L, W = 19.1, 3.3
    ax = (3.3, 15.0)
    w = wheels_of(ax, 1.45, 2.55, 3.35)
    red = "red"
    p = [
        box(0.0, 0.45, -3.35, 3.35, 1.05, 1.85, "chrome"),  # front bumper
        box(0.1, 0.5, -3.0, 3.0, 0.8, 1.05, "dark"),
        box(0.35, 0.55, -2.35, 2.35, 1.9, 3.35, "chrome"),  # grille surround
        box(0.28, 0.4, -2.15, 2.15, 2.0, 3.25, "dark"),
        *[box(0.25, 0.3, -2.15, 2.15, z, z + 0.12, "chrome") for z in (2.3, 2.65, 3.0)],
        box(0.35, 0.55, 2.35, 3.25, 2.45, 3.35, "chrome"),  # headlight bezels and lamps
        box(0.35, 0.55, -3.25, -2.35, 2.45, 3.35, "chrome"),
        box(0.27, 0.36, 2.45, 3.15, 2.55, 3.25, "lamp"),
        box(0.27, 0.36, -3.15, -2.45, 2.55, 3.25, "lamp"),
        box(0.5, 6.0, -3.25, 3.25, 2.95, 3.6, red),  # hood
        box(5.8, 6.4, -3.25, 3.25, 3.6, 4.0, red),  # cowl
        box(6.0, 10.6, -W, W, 2.95, 4.0, red),  # doors
        box(6.4, 10.4, -3.1, 3.1, 4.0, 6.2, red),  # cab
        box(6.6, 10.3, -2.95, 2.95, 6.2, 6.33, red),  # roof
        box(6.33, 6.43, -2.85, 2.85, 4.1, 6.05, "glass"),
        box(6.9, 10.0, 3.1, 3.14, 4.2, 5.95, "glass"),
        box(6.9, 10.0, -3.14, -3.1, 4.2, 5.95, "glass"),
        box(10.38, 10.48, -2.6, 2.6, 4.3, 5.85, "glass"),
        box(6.5, 6.9, 3.3, 3.9, 4.4, 4.9, "dark"),  # mirrors
        box(6.5, 6.9, -3.9, -3.3, 4.4, 4.9, "dark"),
        box(9.6, 9.95, 3.3, 3.34, 3.45, 3.62, "chrome"),  # door handles
        box(9.6, 9.95, -3.34, -3.3, 3.45, 3.62, "chrome"),
        box(0.6, 18.6, 3.3, 3.34, 2.95, 3.05, "chrome"),  # side trim
        box(0.6, 18.6, -3.34, -3.3, 2.95, 3.05, "chrome"),
        box(10.6, 18.6, -2.9, 2.9, 2.0, 2.6, "dark"),  # the bed: floor, sides, front, tailgate
        box(10.6, 18.8, 2.9, W, 2.95, 3.95, red),
        box(10.6, 18.8, -W, -2.9, 2.95, 3.95, red),
        box(10.6, 18.8, 2.85, W, 3.95, 4.05, "chrome"),
        box(10.6, 18.8, -W, -2.85, 3.95, 4.05, "chrome"),
        box(10.6, 10.9, -W, W, 2.0, 3.95, red),
        box(18.5, 18.8, -W, W, 2.0, 3.85, red),
        box(18.79, 18.83, -2.0, 2.0, 2.6, 3.5, "dark"),
        box(18.78, 18.88, 2.6, 3.25, 2.6, 3.7, "tail"),
        box(18.78, 18.88, -3.25, -2.6, 2.6, 3.7, "tail"),
        box(18.7, L, -3.35, 3.35, 1.05, 1.85, "chrome"),  # rear bumper
        *seam(6.05, W, 2.1, 3.95), *seam(10.5, W, 2.1, 3.95),
        *wells(ax, 1.7, 3.0, 2.95),
    ]
    p += arches(ax, 1.7, 0.5, 18.7, W, 1.0, 2.95, red)  # the sides below the trim, round the arches
    return {"L": L, "W": W, "top": 6.33, "prims": p, "wheels": w, "over": True,
            "heads": [[0.3, 2.8, 2.9], [0.3, -2.8, 2.9]], "tails": [[18.9, 2.92, 3.15], [18.9, -2.92, 3.15]],
            "stacks": [], "pipe": [18.9, 2.2, 1.0]}


def sedan():
    """A big American sedan, cream: chrome bumpers, quad lamps, a long hood and trunk, a formal roof."""
    L, W = 16.4, 3.1
    ax = (3.0, 12.9)
    w = wheels_of(ax, 1.25, 2.35, 3.08)
    c = "cream"
    p = [
        box(0.0, 0.4, -3.15, 3.15, 0.9, 1.6, "chrome"),
        box(0.1, 0.45, -2.8, 2.8, 0.7, 0.9, "dark"),
        box(0.3, 0.45, -1.9, 1.9, 1.75, 2.7, "chrome"),
        box(0.25, 0.35, -1.75, 1.75, 1.85, 2.6, "dark"),
        *[box(0.22, 0.27, -1.75, 1.75, z, z + 0.1, "chrome") for z in (2.05, 2.35)],
        box(0.3, 0.45, 1.95, 3.0, 1.95, 2.75, "chrome"),
        box(0.3, 0.45, -3.0, -1.95, 1.95, 2.75, "chrome"),
        box(0.25, 0.32, 2.05, 2.9, 2.05, 2.65, "lamp"),
        box(0.25, 0.32, -2.9, -2.05, 2.05, 2.65, "lamp"),
        box(0.45, 16.0, -W, W, 2.45, 3.0, c),  # beltline and up: hood, doors, trunk
        box(4.8, 11.2, -2.75, 2.75, 3.0, 4.4, c),  # the greenhouse
        box(5.3, 10.9, -2.6, 2.6, 4.4, 4.55, c),
        box(4.75, 4.85, -2.5, 2.5, 3.1, 4.3, "glass"),
        box(11.15, 11.25, -2.4, 2.4, 3.1, 4.25, "glass"),
        box(5.3, 7.9, 2.75, 2.79, 3.12, 4.3, "glass"),
        box(8.2, 10.7, 2.75, 2.79, 3.12, 4.3, "glass"),
        box(5.3, 7.9, -2.79, -2.75, 3.12, 4.3, "glass"),
        box(8.2, 10.7, -2.79, -2.75, 3.12, 4.3, "glass"),
        box(0.6, 15.9, W, W + 0.04, 2.25, 2.33, "chrome"),
        box(0.6, 15.9, -W - 0.04, -W, 2.25, 2.33, "chrome"),
        box(15.98, 16.08, 1.6, 3.0, 2.2, 2.85, "tail"),
        box(15.98, 16.08, -3.0, -1.6, 2.2, 2.85, "tail"),
        box(16.0, L, -3.15, 3.15, 0.9, 1.6, "chrome"),
        *seam(4.9, W, 1.7, 2.95), *seam(8.05, W, 1.7, 2.95), *seam(11.0, W, 1.7, 2.95),
        *wells(ax, 1.5, 2.8, 2.45),
    ]
    p += arches(ax, 1.5, 0.45, 16.0, W, 1.0, 2.45, c)
    return {"L": L, "W": W, "top": 4.55, "prims": p, "wheels": w, "over": True,
            "heads": [[0.28, 2.48, 2.35], [0.28, -2.48, 2.35]], "tails": [[16.1, 2.3, 2.5], [16.1, -2.3, 2.5]],
            "stacks": [], "pipe": [16.4, 2.0, 0.9]}


def rig(kind: str, paint: str):
    """A tractor in `paint` with a `kind` trailer; its painted wheels become wheel rows, its cyan becomes the paint."""
    parts = rs.tractor() + rs.trailer(kind)
    prims, wheels = [], []
    for pr in parts:
        k, g, mat, seams = pr
        if k == "cyl" and g[0] == "y":  # a tyre or its rim: rolled in code instead
            if mat == "tyre":
                wheels.append((g[1], g[3], min(abs(g[4]), abs(g[5])), max(abs(g[4]), abs(g[5]))))
            continue
        prims.append((k, g, paint if mat == "cyan" else mat, 0.0))
        if k == "box" and seams:  # the trailer's panel seams, as thin strips on both sides
            x0, x1, y0, y1, z0, z1 = g
            x = x0 + seams
            while x < x1 - 0.5:
                prims.append(("box", (x - 0.11, x + 0.11, y1, y1 + 0.03, z0 + 0.7, z1 - 0.4), "seam", 0.0))
                prims.append(("box", (x - 0.11, x + 0.11, y0 - 0.03, y0, z0 + 0.7, z1 - 0.4), "seam", 0.0))
                x += seams
    seen, ws = set(), []
    for x, r, a, b in wheels:  # one row per axle (both sides drawn from it)
        key = (round(x, 2), round(a, 2))
        if key not in seen:
            seen.add(key)
            ws.append((x, r, a, b))
    L = rs.L
    sx = rs.LONG
    # Close up the rig fills the screen, so it carries the detail a passing truck shows: door and sleeper seams, a sleeper
    # window, steps, the visor and mirrors on the tractor; rails, marker lamps, rear doors with latch bars, mud flaps.
    t = [
        rs.box(7.6, 8.1, -3.9, 3.9, 9.4, 9.8, "chrome"),  # visor
        rs.box(7.7, 8.0, 4.0, 4.9, 6.4, 8.2, "dark"), rs.box(7.7, 8.0, -4.9, -4.0, 6.4, 8.2, "dark"),  # mirrors
        rs.box(8.6, 11.4, 4.0, 4.35, 2.2, 2.5, "chrome"), rs.box(8.6, 11.4, -4.35, -4.0, 2.2, 2.5, "chrome"),  # steps
        rs.box(13.4, 15.6, 4.0, 4.06, 7.8, 9.4, "glass"), rs.box(13.4, 15.6, -4.06, -4.0, 7.8, 9.4, "glass"),
        rs.box(8.0, 16.8, 4.0, 4.05, 5.0, 5.25, "chrome"), rs.box(8.0, 16.8, -4.05, -4.0, 5.0, 5.25, "chrome"),
        rs.box(10.9, 11.5, 4.0, 4.07, 6.9, 7.1, "chrome"), rs.box(10.9, 11.5, -4.07, -4.0, 6.9, 7.1, "chrome"),
    ]
    for x in (8.15, 12.0, 16.6):
        t += [rs.box(x - 0.07, x + 0.07, 4.0, 4.05, 3.8, 9.5, "dark"), rs.box(x - 0.07, x + 0.07, -4.05, -4.0, 3.8, 9.5, "dark")]
    for k, g, mat, seams in t:
        prims.append((k, (g[0] * sx, g[1] * sx, *g[2:]), paint if mat == "cyan" else mat, 0.0))
    x0 = 20.8 * sx
    if kind in ("van", "reefer"):
        prims += [
            ("box", (x0, L, 4.24, 4.31, 13.25, 13.6), "chrome", 0.0), ("box", (x0, L, -4.31, -4.24, 13.25, 13.6), "chrome", 0.0),
            ("box", (L + 0.04, L + 0.08, -0.06, 0.06, 4.7, 13.1), "dark", 0.0),  # where the doors meet
            *[("box", (L + 0.04, L + 0.1, y - 0.07, y + 0.07, 4.8, 13.0), "chrome", 0.0) for y in (-2.9, -1.0, 1.0, 2.9)],  # latch bars
            ("box", (x0 + 26, x0 + 26.4, 4.26, 4.32, 12.6, 13.0), "lamp", 0.0), ("box", (x0 + 26, x0 + 26.4, -4.32, -4.26, 12.6, 13.0), "lamp", 0.0),
            ("box", (x0 + 0.2, x0 + 0.6, 4.26, 4.32, 12.6, 13.0), "lamp", 0.0), ("box", (x0 + 0.2, x0 + 0.6, -4.32, -4.26, 12.6, 13.0), "lamp", 0.0),
        ]
    prims += [("box", (L - 2.6, L - 2.3, 2.2, 4.2, 0.5, 3.4), "dark", 0.0), ("box", (L - 2.6, L - 2.3, -4.2, -2.2, 0.5, 3.4), "dark", 0.0)]
    return {"L": L, "W": 4.25, "top": 13.6 if kind in ("van", "reefer") else 13.2, "prims": prims, "wheels": ws, "over": False,
            "heads": [[1.95 * sx, 3.2, 3.5], [1.95 * sx, -3.2, 3.5]], "tails": [[L + 0.05, 3.55, 5.0], [L + 0.05, -3.55, 5.0]],
            "stacks": [[12.3 * sx, 4.35, 13.2], [12.3 * sx, -4.35, 13.2]], "pipe": None}


KINDS = {  # the head-on shot's far lane carries these (the rig is the painting's own; rig() is kept for a closer look)
    "pickup": lambda: pickup(),
    "sedan": lambda: sedan(),
}


def tanker_prims():
    """The tanker trailer, which rig-sheets doesn't have: a long steel barrel on the same running gear."""
    x0, x1 = 20.8 * rs.LONG, rs.L
    p = [rs.box(x0, x1, -1.5, 1.5, 3.6, 4.3, "dark"),
         rs.box(x0 + 9.5, x0 + 10.3, 2.7, 3.4, 0.6, 4.3, "dark"),
         rs.box(x0 + 9.5, x0 + 10.3, -3.4, -2.7, 0.6, 4.3, "dark"),
         rs.box(x1 - 0.6, x1, -3.8, 3.8, 1.5, 2.2, "dark"),
         rs.cyl("x", 0.0, 8.6, 4.0, x0 + 0.5, x1 - 0.3, "chrome"),
         rs.box(x0 + 14, x0 + 14.6, -4.05, 4.05, 4.6, 12.7, "dark"),
         rs.box(x0 + 30, x0 + 30.6, -4.05, 4.05, 4.6, 12.7, "dark"),
         rs.box(x1 - 0.05, x1 + 0.03, 3.1, 4.0, 4.6, 5.4, "tail"),
         rs.box(x1 - 0.05, x1 + 0.03, -4.0, -3.1, 4.6, 5.4, "tail")]
    for x in (x1 - 8.6, x1 - 4.4):
        p += rs.wheel(x, 2.0, 4.25) + rs.wheel(x, -4.25, -2.0)
    return p


_trailer = rs.trailer


def trailer_with_tanker(kind):
    return tanker_prims() if kind == "tanker" else _trailer(kind)


rs.trailer = trailer_with_tanker


def to_vehicle(view: str, Y: float, L: float, X: float):
    """The ray from the camera, in a vehicle's own frame (x from its front bumper back, y to its right, z up), for a
    vehicle whose anchor (front centre coming, rear centre going) stands at depth Y in lane X."""
    H = CAM["h"]
    if view == "coming":
        return np.array([-Y, X, H]), lambda dx, dy, dz: (dy, -dx, dz)
    return np.array([L + Y, -X, H]), lambda dx, dy, dz: (-dy, dx, dz)


def project(view: str, Y: float, X: float, L: float, pts):
    """Vehicle-frame points to band pixels."""
    out = []
    for x, y, z in pts:
        if view == "coming":
            wx, wy = X - y, Y + x
        else:
            wx, wy = X + y, Y + (L - x)
        if wy < 0.4:
            out.append(None)
            continue
        out.append((CAM["px"] + CAM["f"] * wx / wy, CAM["py"] + CAM["f"] * (CAM["h"] - z) / wy))
    return out


def render(model, view: str, Y: float):
    """The body (no wheels) at anchor depth Y: an RGBA sprite and the band pixel its top-left corner sits at."""
    X = LANES[view]
    L, W, top = model["L"], model["W"], model["top"]
    corners = [(x, y, z) for x in (0, L) for y in (-W, W) for z in (0, top)]
    pts = [p for p in project(view, Y, X, L, corners) if p]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0 = int(np.floor(max(-4, min(xs)))) - 2
    x1 = int(np.ceil(min(262, max(xs)))) + 2
    y0 = int(np.floor(max(-40, min(ys)))) - 2
    y1 = int(np.ceil(min(420, max(ys)))) + 2
    if x1 <= x0 or y1 <= y0:
        return None
    w, h = x1 - x0, y1 - y0
    gx = x0 + (np.arange(w * SS) + 0.5) / SS
    gy = y0 + (np.arange(h * SS) + 0.5) / SS
    sx, sy = np.meshgrid(gx, gy)
    sx, sy = sx.ravel(), sy.ravel()
    o, rot = to_vehicle(view, Y, L, X)
    dxw = (sx - CAM["px"]) / CAM["f"]
    dzw = -(sy - CAM["py"]) / CAM["f"]
    dv = np.stack(rot(dxw, np.ones_like(dxw), dzw), 1)
    ov = np.broadcast_to(o, dv.shape).copy()
    best = np.full(len(sx), np.inf)
    nrm = np.zeros(dv.shape)
    mat = np.full(len(sx), -1)
    prims = model["prims"]
    for i, pr in enumerate(prims):
        t, nn = rs.hits(pr, ov, dv)
        closer = t < best
        best[closer] = t[closer]
        nrm[closer] = nn[closer]
        mat[closer] = i
    lv = np.array(rot(SUN[0], SUN[1], SUN[2]))
    lit = np.clip(nrm @ lv, 0, 1)
    shade = 0.3 + 0.7 * lit
    hitp = ov + np.where(np.isfinite(best), best, 0)[:, None] * dv
    rgb = np.zeros((len(sx), 3))
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
        idx = np.clip((s * len(ramp)).astype(int), 0, len(ramp) - 1)
        rgb[m] = ramp[idx]
    cov = (mat >= 0).reshape(h * SS, w * SS).astype(float)
    rgb = rgb.reshape(h * SS, w * SS, 3)
    c = cov.reshape(h, SS, w, SS).mean((1, 3))
    acc = (rgb * cov[..., None]).reshape(h, SS, w, SS, 3).sum((1, 3)) / np.maximum(cov.reshape(h, SS, w, SS).sum((1, 3)), 1)[..., None]
    pal = np.array(sorted({col for r in RAMPS.values() for col in r}), float)
    near = np.zeros((h, w), int)
    for r0 in range(0, h, 32):  # in strips, to keep the distance table small
        near[r0 : r0 + 32] = ((acc[r0 : r0 + 32, :, None, :] - pal[None, None]) ** 2).sum(-1).argmin(-1)
    out = np.zeros((h, w, 4), np.uint8)
    on = c >= 0.45
    out[..., :3] = pal[near].astype(np.uint8)
    out[..., 3] = np.where(on, 255, 0)
    dep = np.where(np.isfinite(best), best, 1e9).reshape(h, SS, w, SS).min((1, 3))
    edge = np.zeros_like(on)
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        nb = np.roll(np.roll(dep, dy, 0), dx, 1)
        nbon = np.roll(np.roll(on, dy, 0), dx, 1)
        edge |= on & nbon & (dep - nb > 0.06 * Y + 1.5)
    out[edge, :3] = rs.INK
    ring = np.zeros_like(on)
    ring[1:] |= on[:-1]
    ring[:-1] |= on[1:]
    ring[:, 1:] |= on[:, :-1]
    ring[:, :-1] |= on[:, 1:]
    ring &= ~on
    out[ring, :3] = rs.INK
    out[ring, 3] = 255
    ys_, xs_ = np.nonzero(out[..., 3])
    if not len(xs_):
        return None
    cx0, cx1, cy0, cy1 = xs_.min(), xs_.max() + 1, ys_.min(), ys_.max() + 1
    return out[cy0:cy1, cx0:cx1], (x0 + int(cx0), y0 + int(cy0))


def screen_box(model, view: str, Y: float):
    """The band-pixel box a vehicle covers at anchor depth Y, clipped to the band and below it, or None if unseen."""
    L, W, top = model["L"], model["W"], model["top"]
    corners = [(x, y, z) for x in (0, L) for y in (-W, W) for z in (0, top)]
    pts = [p for p in project(view, Y, LANES[view], L, corners) if p]
    if len(pts) < 2:
        return None
    x0, x1 = max(-6, min(p[0] for p in pts)), min(262, max(p[0] for p in pts))
    y0, y1 = max(-60, min(p[1] for p in pts)), min(420, max(p[1] for p in pts))
    return (x0, y0, x1, y1) if x1 > x0 and y1 > y0 else None


def apart(a, b, margin=1.5):
    return a is None or b is None or a[2] + margin <= b[0] or b[2] + margin <= a[0] or a[3] + margin <= b[1] or b[3] + margin <= a[1]


def headway(models) -> dict:
    """The least gap, in feet, a follower keeps behind its leader in each lane, both at one speed, so that their pictures
    never overlap at any depth: coming, from the follower's spawn on the horizon until the leader has passed the camera;
    going, from the follower coming out from behind the camera until the leader reaches the horizon and is gone."""
    out = {"coming": {}, "going": {}}
    for view in ("coming", "going"):
        for la, ma in models.items():
            for fb, mb in models.items():
                gap = 4.0
                while gap < SPAWN:
                    ok = True
                    if view == "coming":
                        y1 = SPAWN - gap
                        while y1 > -ma["L"] and ok:
                            ok = apart(screen_box(ma, view, y1), screen_box(mb, view, y1 + gap))
                            y1 -= max(0.5, y1 * 0.04)
                    else:
                        yf = -mb["L"]
                        while yf + gap < SPAWN and ok:
                            ok = apart(screen_box(mb, view, yf), screen_box(ma, view, yf + gap))
                            yf += max(0.5, abs(yf) * 0.04)
                    if ok:
                        break
                    gap *= 1.08
                out[view][f"{la}>{fb}"] = round(gap + 2, 1)
    return out


def poster(model) -> np.ndarray:
    """The head-on painting with the cyan rig where its truck stood, wheels and all: the title's first frame."""
    back = pm.read_png(os.path.join(TITLE, "approach.png"))
    m = dict(model)
    m["prims"] = list(model["prims"])
    for x, r, a, b in model["wheels"]:
        m["prims"] += rs.wheel(x, a, b, r) + rs.wheel(x, -b, -a, r)
    img, (x0, y0) = render(m, "coming", POSTER_Y)
    out = back.copy()
    h, w = img.shape[:2]
    for yy in range(h):
        for xx in range(w):
            X, Yp = x0 + xx, y0 + yy
            if 0 <= X < out.shape[1] and 0 <= Yp < out.shape[0] and img[yy, xx, 3]:
                out[Yp, X] = img[yy, xx]
    return out


def serial(pr) -> list:
    kind, g, mat, _ = pr
    r = lambda v: round(float(v), 3)
    if kind == "box":
        return ["b", *[r(v) for v in g], mat]
    axis, c0, c1, rad, lo, hi = g
    return ["c", axis, r(c0), r(c1), r(rad), r(lo), r(hi), mat]


def main() -> None:
    models, full, mats = {}, {}, set()
    for kind, make in KINDS.items():
        model = make()
        full[kind] = model
        prims = [serial(p) for p in model["prims"]]
        mats |= {p[-1] for p in prims}
        models[kind] = {
            "L": round(model["L"], 3), "W": model["W"], "top": model["top"], "over": model["over"],
            "prims": prims, "wheels": [[round(float(v), 3) for v in w] for w in model["wheels"]],
            "heads": model["heads"], "tails": model["tails"], "stacks": model["stacks"], "pipe": model["pipe"],
        }
    mats |= {"tyre", "chrome", "white"}
    gaps = headway(full)
    block = (
        "// <vehicles> written by tools/title-vehicles.py\n"
        f"const VCAM = {json.dumps(CAM)} as const;\n"
        f"const VLANES = {json.dumps(LANES)} as const;\n"
        f"const VSPAWN = {SPAWN};\n"
        f"const VPOSTER = {POSTER_Y};\n"
        f"const VSUN = {json.dumps([round(float(v), 4) for v in SUN])} as const;\n"
        f"const VRAMPS: Record<string, readonly (readonly [number, number, number])[]> = {json.dumps({m: RAMPS[m] for m in sorted(mats)})};\n"
        f"const VMODELS = {json.dumps(models, separators=(',', ':'))} as const;\n"
        f"const VGAP = {json.dumps(gaps)} as const;\n"
        "// </vehicles>"
    )
    src = open(TS).read()
    src, n = re.subn(r"// <vehicles>.*?// </vehicles>", lambda _: block, src, flags=re.S)
    assert n == 1, "title.ts needs the vehicle markers"
    open(TS, "w").write(src)
    print(f"{len(models)} models, {sum(len(m['prims']) for m in models.values())} solids; headway table written")


if __name__ == "__main__":
    main()
