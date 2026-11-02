#!/usr/bin/env python3
"""The world around the map (Jeff, 2026-11-02: "When zoomed all the way out we should see more of the world / ocean,
not a blank gray background").

The painted map (assets/map/l0-<season>.png, 1584 × 856) ends at the lower 48's frame, so a tall phone at Fit shows
grey above and below it. This paints the surround, one picture per season at a quarter of the map's resolution (it's
the edge of the view, seen small): the Pacific and the Atlantic, the Gulf of Mexico and the Caribbean with Cuba,
Hispaniola, Jamaica, Puerto Rico and the Bahamas on their shallow banks, Mexico and Central America to the south,
Canada with Hudson Bay and Labrador to the north. The coasts are traced here, coarse (tools' geo.ts has only the US and
its rim), in the map's own projection; the painted map goes in the middle, shrunk; PixelLab's Pro editor repaints the
whole in the map's style and season, keeping the coasts; then the rim right round the map is eased back into the map's
own edge pixels so the seam doesn't show: the map's own edge is feathered (its last 48 pixels fade out, alpha baked
into assets/map/l0-<season>.png), so where the two meet the surround shows through and nothing draws a line.

The result registers to the map like this: painted pixel (bx, by) covers map pixels (4·bx − 208 … 4·bx − 205,
4·by − 464 … 4·by − 461). It ships at the map's own scale, each painted pixel four across and four down (500 × 446 →
2000 × 1784), so mapview draws it one to one at map coordinates (−208, −464), the map centred in it with equal
margins, behind the map, which covers its middle exactly.

  map-surround.py <season> [--seed N] [--base-only] [--feather-only]
      → assets/map/surround-<season>.png (the base and the editor's output in assets/map/surround-src), and the map's
        feathered edge
"""
import importlib.util
import os
import re
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("pm", os.path.join(HERE, "paint-map.py"))
pm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pm)  # type: ignore[union-attr]

MAPS = os.path.join(HERE, "..", "assets", "map")
GEO = os.path.join(HERE, "..", "src", "geo.ts")
W0, H0 = 1584, 856  # the map
SCALE = 4
MX, MY = 208, 464  # the surround's reach beyond the map, in map pixels
BW, BH = (W0 + 2 * MX) // SCALE, (H0 + 2 * MY) // SCALE  # 500 × 446


def geo(name: str) -> list:
    s = open(GEO).read()
    m = re.search(r"export const " + name + r"[^=]*=\s*\[(.*?)\];", s, re.S)
    return [(float(a), float(b)) for a, b in re.findall(r"\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]", m.group(1))]


def projection():
    """map.ts's fitProjection for the 1584 × 856 map, into surround pixels."""
    rad = np.pi / 180
    kx = np.cos(37.5 * rad)
    flat = lambda lon, lat: ((lon * rad + 96 * rad) * kx, lat * rad)
    ring = geo("PACIFIC") + geo("MEX_BORDER") + geo("GULF_ATLANTIC") + geo("CANADA_BORDER")
    pts = [flat(lo, la) for lo, la in ring]
    minx, maxx = min(p[0] for p in pts), max(p[0] for p in pts)
    miny, maxy = min(p[1] for p in pts), max(p[1] for p in pts)
    margin = max(6, round(min(W0, H0) * 0.03))
    scale = min((W0 - 2 * margin) / (maxx - minx), (H0 - 2 * margin) / (maxy - miny))
    offx = (W0 - (maxx - minx) * scale) / 2
    offy = (H0 - (maxy - miny) * scale) / 2

    def project(lon, lat):
        x, y = flat(lon, lat)
        return ((offx + (x - minx) * scale + MX) / SCALE, (offy + (maxy - y) * scale + MY) / SCALE)

    return project


# Coasts beyond geo.ts, traced coarse (lon, lat).
NORTH_PACIFIC = [(-150, 75), (-140, 60), (-136.5, 58.5), (-134, 56.5), (-131.5, 54.5)]
SOUTH_PACIFIC = [(-106.4, 23.2), (-105.6, 21.9), (-105.3, 20.6), (-104.9, 19.4), (-104.3, 19.1), (-103.4, 18.3), (-101.9, 17.8),
                 (-100.5, 17.2), (-99.9, 16.8), (-98.5, 16.3), (-97.0, 15.8), (-96.0, 15.7), (-95.1, 16.2), (-94.0, 16.2), (-93.2, 15.6),
                 (-92.2, 14.6), (-91.3, 13.9), (-90.0, 13.9), (-89.2, 13.5), (-88.0, 13.2), (-87.4, 13.0), (-86.7, 12.2), (-86.0, 11.6),
                 (-85.7, 11.1), (-85.9, 10.6), (-85.7, 9.9), (-84.6, 9.5), (-83.5, 8.5), (-82.9, 8.0), (-82.5, 4.0), (-77.0, 4.0),
                 (-77.5, 8.8), (-79.5, 9.6), (-81.5, 9.0), (-82.8, 9.5)]
CARIBBEAN = [(-83.7, 10.9), (-83.7, 11.6), (-83.6, 12.5), (-83.5, 13.6), (-83.3, 14.5), (-83.2, 15.0), (-84.0, 15.4), (-85.0, 15.9),
             (-86.5, 15.8), (-87.8, 15.8), (-88.2, 15.7), (-88.5, 16.3), (-88.2, 17.0), (-88.3, 17.9), (-88.0, 18.5), (-87.6, 19.5),
             (-87.4, 20.3), (-86.8, 21.2), (-87.1, 21.6), (-88.2, 21.5), (-89.5, 21.3), (-90.4, 21.1), (-90.5, 20.0), (-90.6, 19.4),
             (-91.5, 18.6), (-92.7, 18.6), (-94.0, 18.3), (-94.8, 18.6), (-95.8, 18.8), (-96.4, 19.5), (-96.9, 20.4), (-97.4, 21.2),
             (-97.8, 22.1), (-97.8, 23.0), (-97.8, 24.2), (-97.5, 25.0)]
ATLANTIC_CANADA = [(-66.0, 45.3), (-65.7, 44.0), (-65.4, 43.5), (-63.5, 44.4), (-61.5, 45.0), (-60.0, 45.8), (-61.0, 47.0),
                   (-64.5, 47.8), (-64.2, 48.9), (-66.5, 49.2), (-68.7, 48.6), (-70.8, 47.1), (-69.8, 48.2), (-67.5, 49.4),
                   (-65.0, 50.2), (-61.0, 50.2), (-59.0, 50.6), (-57.2, 51.4), (-55.8, 52.3), (-56.5, 53.8), (-58.5, 54.5),
                   (-60.5, 55.8), (-61.6, 56.9), (-62.4, 58.0), (-63.5, 59.0), (-64.6, 60.3), (-65.0, 61.0), (-60.0, 75.0)]
CONTINENT = (NORTH_PACIFIC + geo("BC_COAST") + geo("PACIFIC") + geo("MEXICO")[:-3] + SOUTH_PACIFIC + CARIBBEAN
             + geo("GULF_ATLANTIC") + ATLANTIC_CANADA)
HUDSON = [(-80.0, 51.3), (-79.0, 51.6), (-78.8, 52.8), (-79.0, 54.4), (-77.2, 55.6), (-76.8, 57.0), (-77.4, 58.3), (-78.0, 59.5),
          (-77.6, 60.6), (-78.2, 62.2), (-77.0, 63.5), (-78.0, 66.0), (-90.0, 66.0), (-93.5, 64.0), (-94.0, 62.0), (-94.8, 60.0),
          (-94.2, 58.8), (-92.5, 57.2), (-90.0, 57.0), (-88.0, 56.5), (-85.0, 55.3), (-82.3, 55.2), (-82.2, 53.0), (-81.4, 52.2)]
WINNIPEG = [(-96.8, 50.4), (-96.3, 51.5), (-97.0, 52.8), (-98.0, 53.8), (-99.3, 53.4), (-98.5, 52.0), (-97.2, 50.6)]
ISLANDS = {
    "cuba": [(-84.95, 21.86), (-84.0, 22.5), (-83.0, 22.95), (-82.0, 23.15), (-80.6, 23.1), (-79.3, 22.4), (-77.7, 21.8), (-76.0, 21.2),
             (-74.5, 20.3), (-74.1, 20.2), (-75.6, 19.9), (-77.5, 19.85), (-77.1, 20.6), (-79.6, 21.6), (-81.2, 22.0), (-83.5, 22.2),
             (-84.4, 21.8)],
    "hispaniola": [(-74.45, 18.45), (-73.4, 19.65), (-72.8, 19.9), (-71.6, 19.9), (-70.0, 19.7), (-69.0, 19.3), (-68.35, 18.6),
                   (-69.0, 18.4), (-70.0, 18.2), (-71.1, 17.6), (-72.0, 18.1), (-73.4, 18.2)],
    "jamaica": [(-78.35, 18.45), (-77.4, 18.5), (-76.35, 18.15), (-76.8, 17.9), (-77.8, 17.85)],
    "puerto rico": [(-67.25, 18.5), (-65.6, 18.45), (-65.6, 18.0), (-67.2, 17.95)],
    "grand bahama": [(-78.98, 26.75), (-77.9, 26.65), (-77.95, 26.5), (-78.95, 26.55)],
    "abaco": [(-77.25, 26.95), (-76.95, 26.4), (-77.2, 25.9), (-77.45, 26.4)],
    "andros": [(-78.25, 25.2), (-77.7, 24.9), (-77.6, 24.2), (-77.9, 23.8), (-78.3, 24.4)],
    "eleuthera": [(-76.7, 25.5), (-76.1, 25.1), (-76.15, 24.65), (-76.4, 25.0)],
    "long island": [(-75.4, 23.6), (-75.0, 23.0), (-74.85, 23.1), (-75.25, 23.7)],
    "inagua": [(-73.75, 21.2), (-73.05, 21.15), (-73.3, 20.9)],
    "haida gwaii": [(-133.1, 54.2), (-131.8, 53.9), (-131.0, 52.2), (-131.5, 52.0), (-132.6, 53.2)],
    "newfoundland": [(-59.4, 47.6), (-58.0, 48.4), (-58.9, 49.2), (-57.4, 50.8), (-55.6, 51.6), (-55.4, 50.0), (-53.6, 49.2),
                     (-52.6, 47.6), (-53.6, 46.7), (-55.9, 47.1), (-57.6, 47.6)],
    "pei": [(-64.4, 46.6), (-63.0, 46.5), (-62.0, 46.4), (-62.5, 46.1), (-64.0, 46.2)],
}
BANKS = [  # shallow water, turquoise
    [(-79.3, 25.9), (-78.9, 25.6), (-77.9, 25.3), (-76.6, 23.8), (-75.5, 22.8), (-75.6, 22.3), (-77.5, 22.5), (-78.9, 23.1),
     (-80.0, 23.8), (-79.4, 24.6)],
    [(-79.2, 27.1), (-77.0, 27.3), (-76.8, 26.2), (-78.8, 26.3)],
    [(-76.7, 25.7), (-75.9, 25.4), (-74.9, 22.9), (-75.6, 22.9), (-76.4, 24.5)],
    [(-73.9, 21.4), (-72.9, 21.3), (-72.9, 20.8), (-73.9, 20.8)],
]
SEASON = {
    "winter": "deep winter: snow lies over Canada and the northern woods, Hudson Bay and the northern lakes frozen white, "
              "bare grey forest, dry brown grass and snow-dusted mountains in northern Mexico, green tropical forest in the far "
              "south, low cold blue light",
    "spring": "spring: Canada's forests fresh green with the last snow on the far northern hills, lakes thawing, Mexico "
              "greening after rain, bright tropical green in the south, soft clear light",
    "summer": "high summer: deep green boreal forest across Canada, blue lakes, golden dry hills and desert in northern Mexico, "
              "lush green jungle in Central America and the islands, bright warm light",
    "autumn": "autumn: Canada's forests orange, red and gold among dark green pines, the first snow on the far north, dry "
              "tawny hills in Mexico, green in the tropical south, warm low light",
}
LAND = {  # base colours: Canada, northern Mexico, the tropics
    "winter": ((205, 214, 228), (176, 146, 110), (70, 112, 70)),
    "spring": ((88, 124, 78), (170, 150, 100), (66, 122, 66)),
    "summer": ((62, 104, 60), (190, 156, 104), (60, 116, 60)),
    "autumn": ((168, 104, 52), (182, 140, 94), (68, 114, 64)),
}
SEA = np.array([40, 56, 92], float)
DEEP = np.array([28, 36, 66], float)
SHALLOW = np.array([72, 150, 166], float)


def fill(mask: np.ndarray, poly, project) -> None:
    """A polygon (lon, lat) filled into a boolean mask, by even-odd scanlines at pixel centres."""
    pts = [project(lo, la) for lo, la in poly]
    h, w = mask.shape
    for y in range(h):
        cy = y + 0.5
        xs = []
        for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
            if (y0 <= cy) != (y1 <= cy):
                xs.append(x0 + (cy - y0) / (y1 - y0) * (x1 - x0))
        xs.sort()
        for a, b in zip(xs[::2], xs[1::2]):
            l, r = max(0, int(np.ceil(a - 0.5))), min(w - 1, int(np.floor(b - 0.5)))
            if r >= l:
                mask[y, l : r + 1] ^= True


def base(season: str) -> tuple:
    project = projection()
    land = np.zeros((BH, BW), bool)
    fill(land, CONTINENT, project)
    for poly in ISLANDS.values():
        isle = np.zeros_like(land)
        fill(isle, poly, project)
        land |= isle
    water = np.zeros_like(land)
    for poly in (HUDSON, WINNIPEG):
        fill(water, poly, project)
    land &= ~water
    banks = np.zeros_like(land)
    for poly in BANKS:
        b = np.zeros_like(land)
        fill(b, poly, project)
        banks |= b
    ys, xs = np.mgrid[0:BH, 0:BW]
    rng = np.random.default_rng(7)
    grain = rng.normal(0, 1, (BH, BW))
    # Sea: deeper away from the coasts (a cheap distance, by repeated growing).
    near = land.copy()
    dist = np.full(land.shape, 12.0)
    for d in range(12):
        dist[near & (dist > d)] = d
        g = near.copy()
        g[1:] |= near[:-1]; g[:-1] |= near[1:]; g[:, 1:] |= near[:, :-1]; g[:, :-1] |= near[:, 1:]
        near = g
    f = (np.clip(dist, 0, 12) / 12)[..., None]
    img = SEA * (1 - f) + DEEP * f + grain[..., None] * 3
    img[banks & ~land] = SHALLOW + grain[banks & ~land][:, None] * 6
    # Land: Canada above the map's latitude band, the tropics below 20° N, northern Mexico between.
    north, mex, trop = (np.array(c, float) for c in LAND[season])
    lat = 49.8 - (ys - (MY / SCALE)) * (26.1 / (H0 / SCALE))  # latitude by row, near enough
    t = np.clip((lat - 17.0) / 6.0, 0, 1)[..., None]
    southland = trop * (1 - t) + mex * t
    landcol = np.where((lat > 40)[..., None], north, southland) + grain[..., None] * 9
    img = np.where(land[..., None], landcol, img)
    if season == "winter":
        img[water] = np.array([214, 222, 236]) + grain[water][:, None] * 4  # frozen
    else:
        img[water] = SEA + grain[water][:, None] * 3
    out = np.zeros((BH, BW, 4), np.uint8)
    out[..., :3] = np.clip(img, 0, 255)
    out[..., 3] = 255
    # The painted map in the middle, shrunk.
    m = pm.read_png(os.path.join(MAPS, f"l0-{season}.png"))
    small = m.reshape(H0 // SCALE, SCALE, W0 // SCALE, SCALE, 4).mean((1, 3)).round().astype(np.uint8)
    x0, y0 = MX // SCALE, MY // SCALE
    out[y0 : y0 + small.shape[0], x0 : x0 + small.shape[1]] = small
    return out, small


FEATHER = 48  # map pixels over which the map's edge fades into the surround


HAZE = 170  # map pixels: how far in from its frame the painting's sea fades pale


def feather(season: str, painted: np.ndarray) -> None:
    """The map's edge made to meet the surround: over the sea in its outer HAZE pixels the painting's pale frame haze
    is drawn toward the surround's sea (the painted texture kept, the land left alone), and its last FEATHER pixels fade
    out (alpha from the distance to the edge, so it comes out the same however often it runs). Reads the untouched
    painting from surround-src/l0-<season>.png, saved there the first time."""
    path = os.path.join(MAPS, f"l0-{season}.png")
    keep = os.path.join(MAPS, "surround-src", f"l0-{season}.png")
    if not os.path.exists(keep):
        pm.write_png(keep, pm.read_png(path))
    m = pm.read_png(keep).copy()
    ys, xs = np.mgrid[0:H0, 0:W0]
    d = np.minimum(np.minimum(xs, W0 - 1 - xs), np.minimum(ys, H0 - 1 - ys)).astype(float)
    # Where the sea is: off the continent and its islands, traced in map pixels.
    project = projection()
    to_map = lambda lon, lat: tuple(v * SCALE - o for v, o in zip(project(lon, lat), (MX, MY)))
    land = np.zeros((H0, W0), bool)
    fill(land, CONTINENT, to_map)
    for poly in ISLANDS.values():
        isle = np.zeros_like(land)
        fill(isle, poly, to_map)
        land |= isle
    grown = land.copy()
    for _ in range(6):  # keep clear of the coasts
        g = grown.copy()
        g[1:] |= grown[:-1]; g[:-1] |= grown[1:]; g[:, 1:] |= grown[:, :-1]; g[:, :-1] |= grown[:, 1:]
        grown = g
    sea = ~grown & (d < HAZE)
    sur = painted[..., :3].astype(float)
    sx = np.clip((xs + MX) / SCALE - 0.5, 0, BW - 1.001)
    sy = np.clip((ys + MY) / SCALE - 0.5, 0, BH - 1.001)
    ix, iy = sx.astype(int), sy.astype(int)
    fx, fy = (sx - ix)[..., None], (sy - iy)[..., None]
    under = (sur[iy, ix] * (1 - fx) * (1 - fy) + sur[iy, ix + 1] * fx * (1 - fy) + sur[iy + 1, ix] * (1 - fx) * fy
             + sur[iy + 1, ix + 1] * fx * fy)
    w = (np.clip(1 - d / HAZE, 0, 1) ** 1.4)[..., None] * 0.9
    # The texture stays: only the colour's local level moves, by the difference between the surround and the
    # painting's own neighbourhood average, weighted.
    mine = m[..., :3].astype(float)
    r = 7
    c = np.pad(mine, ((r + 1, r), (r + 1, r), (0, 0)), mode="edge").cumsum(0).cumsum(1)
    k = 2 * r + 1
    avg = (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)
    shift = (under - avg) * w
    m[..., :3] = np.where(sea[..., None], np.clip(mine + shift, 0, 255), mine).round().astype(np.uint8)
    t = np.clip((d + 0.5) / FEATHER, 0, 1)
    m[..., 3] = (t * t * (3 - 2 * t) * 255).round().astype(np.uint8)
    pm.write_png(path, m)


def tame(season: str, painted: np.ndarray) -> np.ndarray:
    """The painter's greens held to the map's own: no green in the surround more saturated than the season's map uses
    (summer's Yucatán came back a loud lime), its lightness kept."""
    m = pm.read_png(os.path.join(MAPS, "surround-src", f"l0-{season}.png"))[..., :3].astype(float)
    chroma = lambda a: a.max(-1) - a.min(-1)
    green = lambda a: a[..., 1] - np.maximum(a[..., 0], a[..., 2]) > 0.3 * chroma(a)  # not the sea's cyan glints
    cap = np.percentile(chroma(m)[green(m)], 99.5)
    out = painted.copy()
    px = out[..., :3].astype(float)
    grey = px.mean(-1, keepdims=True)
    k = np.where(green(px) & (chroma(px) > cap), cap / np.maximum(chroma(px), 1), 1)[..., None]
    out[..., :3] = (grey + (px - grey) * k).round().clip(0, 255).astype(np.uint8)
    return out


def ship(season: str, painted: np.ndarray) -> None:
    """The surround at the map's own scale, each painted pixel SCALE across and down, and the map's edge fed into it."""
    pm.write_png(os.path.join(MAPS, f"surround-{season}.png"), np.repeat(np.repeat(painted, SCALE, 0), SCALE, 1))
    feather(season, painted)


def ease(painted: np.ndarray, small: np.ndarray) -> np.ndarray:
    """(Unused since the map's edge is feathered: the map's own shrunk pixels back in the middle, eased outward.)"""
    out = painted[..., :4].copy()
    out[..., 3] = 255
    x0, y0 = MX // SCALE, MY // SCALE
    h, w = small.shape[:2]
    for d in range(1, 7):
        k = 1 - d / 7
        for (ya, yb, xa, xb, src) in (
            (y0 - d, y0 - d + 1, x0, x0 + w, small[0:1]),
            (y0 + h + d - 1, y0 + h + d, x0, x0 + w, small[-1:]),
            (y0, y0 + h, x0 - d, x0 - d + 1, small[:, 0:1]),
            (y0, y0 + h, x0 + w + d - 1, x0 + w + d, small[:, -1:]),
        ):
            cur = out[ya:yb, xa:xb, :3].astype(float)
            out[ya:yb, xa:xb, :3] = (cur * (1 - k) + src[..., :3].astype(float) * k).round().astype(np.uint8)
    out[y0 : y0 + h, x0 : x0 + w] = small
    return out


def main() -> None:
    season = sys.argv[1]
    if "--feather-only" in sys.argv:
        out = os.path.join(MAPS, "surround-src", f"painted-{season}.png")
        painted = pm.read_png(out)
        painted[..., 3] = 255
        ship(season, tame(season, painted))
        return
    seed = None
    if "--seed" in sys.argv:
        seed = sys.argv[sys.argv.index("--seed") + 1]
    img, small = base(season)
    os.makedirs(os.path.join(MAPS, "surround-src"), exist_ok=True)
    src = os.path.join(MAPS, "surround-src", f"base-{season}.png")
    pm.write_png(src, img)
    if "--base-only" in sys.argv:
        print(f"{src}: {BW}×{BH}")
        return
    desc = ("repaint this isometric tycoon game map of North America around the United States, keeping every coastline, "
            "island, bay, lake and shallow bank exactly where it is and in the same highly detailed HD painterly pixel art "
            "shading with layered depth and a saturated palette as the United States in the middle, which stays as it is: "
            "the deep blue Pacific Ocean to the west, the Atlantic to the east, the Gulf of Mexico and the Caribbean Sea with "
            "Cuba, Hispaniola, Jamaica and Puerto Rico, the turquoise shallow banks of the Bahamas with their small islands, "
            "Mexico and Central America to the south, Canada with Hudson Bay, Lake Winnipeg, Labrador and Newfoundland to the "
            f"north; the season is {SEASON[season]}. Gentle waves and a soft darker vignette toward the open ocean. Never "
            "write any words, names, letters, borders, grid lines or labels anywhere.")
    out = os.path.join(MAPS, "surround-src", f"painted-{season}.png")
    cmd = [sys.executable, os.path.join(HERE, "pixellab.py"), "edit", src, desc, out]
    if seed:
        cmd += ["--seed", seed]
    subprocess.run(cmd, check=True)
    painted = pm.read_png(out)
    assert painted.shape[:2] == (BH, BW), painted.shape
    painted[..., 3] = 255
    ship(season, tame(season, painted))
    print(f"surround-{season}.png: {BW * SCALE}×{BH * SCALE}, drawn one to one at map (-{MX}, -{MY})")


if __name__ == "__main__":
    main()
