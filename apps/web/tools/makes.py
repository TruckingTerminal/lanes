#!/usr/bin/env python3
"""The three tractor makes (Jeff, 2026-11-02), one per tier the economy already runs: Keystone the workhorse
(workhorse), Meridian the economical highway truck (highwayPro), Ironwood the premium driver's favourite (flagship).

Each is a model measured in feet, in rig-sheets.py's frame (x from the front bumper back, y to the truck's right, z
up), so the Dealer's card and the map draw the same truck:

- Keystone: square and plain. A mid-length hood with a flat top, a steel bumper and a grey grille of horizontal bars,
  a flat-top sleeper no taller than the cab, one grey stack, aluminium tanks, steel wheels.
- Meridian: smooth and tall. A short nose sloping down to a wraparound bumper, a small black grille, a raked
  windshield, a roof that rises to the trailer's height, skirts hiding the tanks and steps, extenders closing the gap
  to the trailer, no stacks and almost no chrome.
- Ironwood: long and bright. The longest hood, square, with an upright chrome grille of vertical bars, swept fenders,
  round chrome air cleaners at the cowl, an upright windshield under a chrome visor with five amber lamps, horns on the
  roof, a stand-up sleeper, two tall chrome stacks, chrome tanks, deck plate, bumper and wheels.

No badges and no lettering: the names wait on counsel's trademark search, and the shapes are what tell them apart.

The card is a three-quarter view from the front right, the truck facing right as on the rig cards, at their density
(about 4.3 px a foot), all three at one scale on one ground line so the differences in length and height are true.
The model is rendered as the card's layout, lit warm from the front and above. PixelLab then repaints that layout as
painterly pixel art, since cards are painterly and only the map is sprites: a Pro edit, which keeps the layout, told
in words what the make is (with an image reference instead, it copied the reference or gave the Meridian stacks).
Last, the paint is fitted back onto the rig cards' cyan and colours. The map sheets are rig-sheets.py's render of the same
models (less the parts too small to show) in its 68-px cells and its colours, the cab's cyan still alone in its hue
band so the owner recolour works, pulling each trailer and none (bobtail).

  makes.py layouts  → assets/makes/src/{make}-layout.png, each card's layout; asset-pass.sh makes repaints each
                      → src/{make}-paint.png
  makes.py fit      → assets/makes/{keystone,meridian,ironwood}.png (the Dealer's cards, 128 × 96)
  makes.py map      → assets/trucks/makes/{make}-{van,reefer,flatbed,bobtail}.png and layout.json (the map)
"""
import importlib.util
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))


def load(name: str, file: str):
    s = importlib.util.spec_from_file_location(name, os.path.join(HERE, file))
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)  # type: ignore[union-attr]
    return m


pm = load("pm", "paint-map.py")
rs = load("rs", "rig-sheets.py")
box, cyl, block = rs.box, rs.cyl, rs.block

ASSETS = os.path.join(HERE, "..", "assets")
MAKES = ("keystone", "meridian", "ironwood")


def sides(y0, y1):
    """The span y0..y1 on the truck's right and its mirror on the left."""
    return ((y0, y1), (-y1, -y0))


def both(x0, x1, y0, y1, z0, z1, mat, cuts=()):
    """A block on each side: `cuts` are given for the right, and their y is mirrored for the left."""
    out = []
    for s, (a, b) in zip((1, -1), sides(y0, y1)):
        cc = []
        for ax, a0, b0, a1, b1 in cuts:
            if ax == "xy":
                cc.append((ax, a0, s * b0, a1, s * b1))
            elif ax == "yz":
                cc.append((ax, s * a0, b0, s * a1, b1))
            else:
                cc.append((ax, a0, b0, a1, b1))
        out.append(block(x0, x1, a, b, z0, z1, mat, cc))
    return out


def pane(p0, p1, y0, y1, mat, out=0.05, depth=0.2, f0=0.0, f1=1.0):
    """A thin pane on a slope in the x-z plane: the part f0..f1 of the segment p0 → p1, from `out` in front of it to
    `depth` behind (front is the side toward -x, the way the truck faces), y0..y1 across."""
    (x0, z0), (x1, z1) = p0, p1
    a = (x0 + f0 * (x1 - x0), z0 + f0 * (z1 - z0))
    b = (x0 + f1 * (x1 - x0), z0 + f1 * (z1 - z0))
    tx, tz = b[0] - a[0], b[1] - a[1]
    ln = np.hypot(tx, tz)
    tx, tz = tx / ln, tz / ln
    nx, nz = -tz, tx  # the normal toward the front
    if nx > 0:
        nx, nz = -nx, -nz
    na = nx * a[0] + nz * a[1]
    planes = [
        (nx, 0, nz, na + out),
        (-nx, 0, -nz, -(na - depth)),
        (-tx, 0, -tz, -(tx * a[0] + tz * a[1])),
        (tx, 0, tz, tx * b[0] + tz * b[1]),
        (0, -1, 0, -y0),
        (0, 1, 0, y1),
    ]
    return ("poly", tuple(planes), mat, 0.0)


def side_pane(p0, p1, y0, y1, mat, out=0.05, depth=0.2, f0=0.0, f1=1.0):
    """A pane on a slope in the x-y plane (a swept corner seen from above), z given as y0..y1 here: p0 and p1 are (x, y)
    on the right side; it's drawn on both."""
    res = []
    for s in (1, -1):
        (x0, a0), (x1, a1) = p0, p1
        a = (x0 + f0 * (x1 - x0), s * (a0 + f0 * (a1 - a0)))
        b = (x0 + f1 * (x1 - x0), s * (a0 + f1 * (a1 - a0)))
        tx, ty = b[0] - a[0], b[1] - a[1]
        ln = np.hypot(tx, ty)
        tx, ty = tx / ln, ty / ln
        nx, ny = -ty, tx
        if nx > 0:
            nx, ny = -nx, -ny
        na = nx * a[0] + ny * a[1]
        res.append(("poly", ((nx, ny, 0, na + out), (-nx, -ny, 0, -(na - depth)), (-tx, -ty, 0, -(tx * a[0] + ty * a[1])), (tx, ty, 0, tx * b[0] + ty * b[1]), (0, 0, -1, -y0), (0, 0, 1, y1)), mat, 0.0))
    return res


def axle(x, dual, rim, card, r=1.75):
    """Tyres on both ends, the outer one's wheel face showing: its disc, and the hub proud of it."""
    p = []
    for s in (1, -1):
        y0, y1 = (2.0, 4.25) if dual else (3.05, 4.15)
        a, b = (y0, y1) if s > 0 else (-y1, -y0)
        p.append(cyl("y", x, r, r, a, b, "tyre"))
        face = b if s > 0 else a
        lo, hi = (face - 0.1, face + 0.03) if s > 0 else (face - 0.03, face + 0.1)
        p.append(cyl("y", x, r, r * 0.6, lo, hi, rim))
        if card:
            lo, hi = (face, face + 0.22) if s > 0 else (face - 0.22, face)
            p.append(cyl("y", x, r, r * 0.22, lo, hi, "dark" if rim == "steel" else rim))
            lo, hi = (face + 0.02, face + 0.05) if s > 0 else (face - 0.05, face - 0.02)
            p.append(cyl("y", x, r, r * 0.45, lo, hi, "dark" if rim != "chrome" else "steel"))  # the ring of nuts
    return p


def keystone(card: bool) -> tuple[list, float]:
    """The workhorse; returns the parts and where a trailer's nose goes (feet from the bumper)."""
    p = [
        block(0.0, 1.0, -4.1, 4.1, 1.4, 2.8, "steel", [("xy", 0, 3.6, 0.5, 4.1), ("xy", 0, -3.6, 0.5, -4.1), ("xz", 0, 1.8, 0.4, 1.4)]),
        block(1.0, 1.5, -2.0, 2.0, 2.8, 5.3, "grille"),  # the grille: a grey frame round a dark mesh
        box(0.85, 1.4, -2.05, 2.05, 5.05, 5.4, "steel"),
        box(0.85, 1.4, -2.05, 2.05, 2.8, 3.05, "steel"),
        block(1.4, 7.0, -2.25, 2.25, 3.0, 5.75, "paint", [("xz", 1.4, 5.3, 7.0, 5.75), ("yz", 1.85, 5.75, 2.25, 5.35), ("yz", -1.85, 5.75, -2.25, 5.35)]),  # the hood
        *both(1.5, 6.6, 2.25, 4.0, 3.45, 4.7, "paint", [("xz", 1.5, 4.1, 2.3, 4.7), ("yz", 3.75, 4.7, 4.0, 4.45)]),  # square fenders
        *both(1.5, 6.6, 2.25, 4.0, 2.9, 3.45, "black", [("xz", 1.5, 3.2, 1.9, 2.9)]),  # their black aprons
        block(7.0, 11.0, -4.0, 4.0, 3.6, 9.5, "paint", [("xz", 7.0, 6.5, 7.55, 9.5), ("yz", 3.65, 9.5, 4.0, 9.15), ("yz", -3.65, 9.5, -4.0, 9.15), ("xy", 7.0, 3.6, 7.4, 4.0), ("xy", 7.0, -3.6, 7.4, -4.0)]),  # the cab
        pane((7.0, 6.5), (7.55, 9.5), -3.55, 3.55, "glass", f0=0.06, f1=0.92),
        block(11.0, 14.6, -4.0, 4.0, 3.6, 9.5, "paint", [("yz", 3.65, 9.5, 4.0, 9.15), ("yz", -3.65, 9.5, -4.0, 9.15), ("xy", 14.25, 4.0, 14.6, 3.65), ("xy", 14.25, -4.0, 14.6, -3.65)]),  # the flat-top sleeper
        *both(7.9, 10.3, 3.98, 4.04, 6.7, 9.15, "glass", [("xz", 7.6, 6.7, 8.15, 9.15)]),  # door windows
        block(1.4, 22.2, -1.6, 1.6, 2.4, 3.6, "dark"),  # frame
        box(14.6, 21.8, -2.0, 2.0, 3.6, 3.85, "dark"),  # deck plate
        box(16.2, 19.2, -2.6, 2.6, 3.6, 4.15, "dark"),  # fifth wheel
        *both(21.7, 22.0, 2.2, 4.3, 0.6, 3.0, "black"),  # mud flaps
        cyl("z", 15.0, 3.45, 0.42, 4.0, 12.3, "steel"),  # one stack, grey
        cyl("x", 3.45, 2.6, 1.0, 7.6, 11.4, "steel"),  # aluminium tanks
        cyl("x", -3.45, 2.6, 1.0, 7.6, 11.4, "steel"),
        *both(11.6, 13.6, 3.0, 4.0, 1.9, 3.5, "black"),  # battery boxes
    ]
    p += axle(4.0, False, "steel", card) + axle(15.6, True, "steel", card) + axle(19.8, True, "steel", card)
    if card:
        p += [
            *both(1.42, 1.52, 2.55, 3.65, 3.5, 3.95, "lamp"),  # square headlights in the fender fronts
            *[box(0.92, 1.05, -1.85, 1.85, z, z + 0.16, "steel") for z in (3.35, 3.8, 4.25, 4.7)],  # the grille's bars
            cyl("z", 15.0, 3.45, 0.47, 12.15, 12.45, "black"),  # the stack's cap
            cyl("z", 15.0, 3.45, 0.48, 6.0, 9.6, "steel"),  # its heat shield
            *[cyl("x", s * 3.45, 2.6, 1.03, x, x + 0.18, "black") for s in (1, -1) for x in (8.3, 10.4)],  # tank straps
            *both(10.95, 11.05, 3.99, 4.03, 3.9, 9.2, "black"),  # door seam
            *both(9.4, 10.0, 4.0, 4.07, 6.25, 6.4, "steel"),  # door handle
            *both(7.3, 7.5, 4.0, 4.65, 7.6, 7.75, "black"),  # mirror arm
            *both(7.2, 7.5, 4.55, 4.85, 6.8, 8.8, "black"),  # mirror
            *both(11.6, 13.7, 3.99, 4.03, 4.3, 6.5, "dark", [("xz", 11.6, 4.3, 11.6, 6.5)]),  # sleeper luggage door
            *both(11.75, 13.55, 4.0, 4.05, 4.45, 6.35, "paint"),
            *both(15.0, 22.0, 2.0, 4.35, 3.65, 3.8, "black"),  # quarter fenders over the drives
            *[box(7.2, 7.35, y - 0.12, y + 0.12, 9.42, 9.58, "amber") for y in (-0.6, 0.0, 0.6)],  # roof lamps, three
        ]
    return p, 18.0


def meridian(card: bool) -> tuple[list, float]:
    """The aerodynamic highway truck."""
    rake = ((6.4, 6.2), (8.4, 9.9))
    p = [
        block(0.2, 1.6, -4.05, 4.05, 1.1, 3.1, "paint", [("xy", 0.2, 2.6, 1.6, 4.05), ("xy", 0.2, -2.6, 1.6, -4.05), ("xz", 0.2, 1.6, 0.6, 1.1)]),  # wraparound bumper
        block(0.3, 1.4, -3.6, 3.6, 0.95, 1.4, "black", [("xy", 0.3, 2.3, 1.4, 3.6), ("xy", 0.3, -2.3, 1.4, -3.6)]),  # air dam
        block(0.4, 6.4, -4.0, 4.0, 3.1, 6.3, "paint", [("xz", 0.4, 4.7, 6.4, 6.3), ("xz", 0.4, 4.25, 1.5, 5.0), ("xy", 0.4, 2.4, 2.6, 4.0), ("xy", 0.4, -2.4, 2.6, -4.0), ("yz", 3.3, 6.3, 4.0, 5.3), ("yz", -3.3, 6.3, -4.0, 5.3)]),  # the sloping nose
        block(0.3, 0.55, -1.9, 1.9, 3.2, 4.3, "grille"),  # a wide black grille, no chrome
        block(6.4, 17.6, -4.0, 4.0, 3.3, 13.3, "paint", [("xz", *rake[0], *rake[1]), ("xz", 8.4, 9.9, 12.0, 13.3), ("yz", 3.5, 13.3, 4.0, 12.6), ("yz", -3.5, 13.3, -4.0, 12.6), ("xy", 6.4, 3.4, 7.0, 4.0), ("xy", 6.4, -3.4, 7.0, -4.0), ("xy", 17.2, 4.0, 17.6, 3.6), ("xy", 17.2, -4.0, 17.6, -3.6)]),  # cab and high roof in one
        pane(*rake, -3.5, 3.5, "glass", f0=0.05, f1=0.93),
        *both(7.6, 10.2, 3.98, 4.04, 6.5, 9.5, "glass", [("xz", 6.9, 6.5, 8.5, 9.5)]),  # door windows
        *both(17.6, 18.5, 3.75, 4.0, 4.2, 13.0, "paint"),  # extenders to the trailer
        *both(6.0, 14.5, 3.9, 4.02, 1.05, 3.45, "paint", [("xz", 6.0, 1.8, 6.6, 1.05), ("xz", 14.0, 1.05, 14.5, 1.7)]),  # skirts flush with the cab, over tanks and steps
        block(1.0, 22.9, -1.6, 1.6, 2.4, 3.3, "dark"),
        box(17.6, 22.6, -2.0, 2.0, 3.3, 3.55, "dark"),
        box(17.2, 20.2, -2.6, 2.6, 3.4, 4.0, "dark"),
        *both(22.5, 22.8, 2.2, 4.3, 0.6, 3.0, "black"),
    ]
    p += axle(3.8, False, "chrome", card) + axle(16.6, True, "chrome", card) + axle(20.8, True, "chrome", card)
    if card:
        p += [
            *side_pane((0.4, 2.4), (2.6, 4.0), 3.55, 4.2, "lamp", out=0.04, f0=0.3, f1=0.9),  # swept headlights
            *side_pane((0.4, 2.4), (2.6, 4.0), 3.45, 4.3, "black", out=0.02, f0=0.25, f1=0.95),
            *side_pane((0.2, 2.6), (1.6, 4.05), 1.6, 2.0, "lamp", out=0.03, f0=0.45, f1=0.75),  # fog lamps
            *both(6.1, 14.4, 4.0, 4.05, 1.05, 1.35, "black"),  # the skirts' lower trim
            *both(10.3, 10.4, 3.99, 4.03, 3.6, 9.4, "black"),  # door seam
            *both(9.1, 9.6, 4.0, 4.06, 6.1, 6.22, "black"),  # door handle
            *both(7.1, 7.3, 4.0, 4.55, 7.4, 7.55, "black"),  # mirror arm
            *both(6.95, 7.45, 4.4, 4.75, 6.9, 8.2, "paint"),  # aero mirror
            *both(15.2, 22.4, 2.0, 4.35, 3.6, 3.75, "black"),  # quarter fenders
            *[box(11.75, 12.0, y - 0.12, y + 0.12, 13.2, 13.36, "amber") for y in (-0.8, 0.0, 0.8)],  # roof lamps
        ]
    return p, 19.0


def ironwood(card: bool) -> tuple[list, float]:
    """The long-nose flagship."""
    fender = [("xz", 1.9, 3.6, 3.4, 4.8), ("xz", 6.4, 4.8, 8.2, 3.6), ("yz", 3.8, 4.8, 4.1, 4.5)]
    p = [
        block(0.0, 1.3, -4.25, 4.25, 1.3, 2.9, "chrome", [("xy", 0, 3.7, 0.6, 4.25), ("xy", 0, -3.7, 0.6, -4.25), ("xz", 0, 1.7, 0.35, 1.3), ("xz", 0, 2.6, 0.25, 2.9)]),  # big chrome bumper
        block(1.4, 1.8, -1.7, 1.7, 3.2, 5.95, "grille"),
        box(1.15, 1.75, -2.0, 2.0, 5.95, 6.4, "chrome"),  # the upright chrome grille's frame
        box(1.15, 1.75, -2.0, 2.0, 2.9, 3.2, "chrome"),
        *both(1.15, 1.75, 1.7, 2.0, 3.2, 5.95, "chrome"),
        block(1.75, 10.4, -2.1, 2.1, 3.0, 6.3, "paint", [("yz", 1.75, 6.3, 2.1, 5.95), ("yz", -1.75, 6.3, -2.1, 5.95), ("xz", 1.75, 6.15, 1.95, 6.3)]),  # the long hood
        *both(1.9, 8.2, 2.1, 4.1, 3.3, 4.8, "paint", fender),  # swept fenders
        cyl("z", 9.4, 3.05, 0.95, 3.9, 6.4, "chrome"),  # air cleaners at the cowl
        cyl("z", 9.4, -3.05, 0.95, 3.9, 6.4, "chrome"),
        block(10.4, 14.6, -4.0, 4.0, 3.6, 10.0, "paint", [("xz", 10.4, 6.7, 10.75, 10.0), ("yz", 3.7, 10.0, 4.0, 9.7), ("yz", -3.7, 10.0, -4.0, 9.7), ("xy", 10.4, 3.7, 10.7, 4.0), ("xy", 10.4, -3.7, 10.7, -4.0)]),  # the cab
        pane((10.4, 6.7), (10.75, 10.0), 0.12, 3.5, "glass", f0=0.07, f1=0.86),  # the split windshield
        pane((10.4, 6.7), (10.75, 10.0), -3.5, -0.12, "glass", f0=0.07, f1=0.86),
        block(9.95, 10.8, -3.95, 3.95, 9.6, 10.05, "chrome", [("xz", 9.95, 9.85, 10.8, 10.05)]),  # the chrome visor
        *both(11.0, 13.4, 3.98, 4.04, 6.9, 9.55, "glass"),  # door windows
        block(14.6, 20.6, -4.0, 4.0, 3.6, 12.2, "paint", [("xz", 14.6, 10.6, 15.6, 12.2), ("yz", 3.7, 12.2, 4.0, 11.9), ("yz", -3.7, 12.2, -4.0, 11.9), ("xy", 20.3, 4.0, 20.6, 3.7), ("xy", 20.3, -4.0, 20.6, -3.7)]),  # stand-up sleeper
        cyl("z", 20.95, 3.55, 0.5, 4.2, 14.4, "chrome"),  # twin chrome stacks
        cyl("z", 20.95, -3.55, 0.5, 4.2, 14.4, "chrome"),
        cyl("x", 3.5, 2.55, 1.05, 11.2, 15.6, "chrome"),  # chrome tanks
        cyl("x", -3.5, 2.55, 1.05, 11.2, 15.6, "chrome"),
        *both(15.8, 17.6, 3.0, 4.05, 1.9, 3.5, "chrome"),  # step boxes
        block(1.6, 26.0, -1.6, 1.6, 2.4, 3.6, "dark"),
        box(20.6, 25.6, -2.0, 2.0, 3.6, 3.85, "chrome"),  # chrome deck plate
        box(19.8, 22.8, -2.6, 2.6, 3.6, 4.15, "dark"),
        *both(25.6, 25.9, 2.2, 4.3, 0.6, 3.0, "black"),
    ]
    p += axle(4.7, False, "chrome", card) + axle(19.6, True, "chrome", card) + axle(23.8, True, "chrome", card)
    if not card:
        # On the map the five visor lamps, far too small to show one by one, are one amber bar across the cab's brow:
        # the mark a Keystone or Meridian never has, drawn larger than life as the map draws the whole rig.
        p.append(box(10.1, 11.5, -3.4, 3.4, 10.0, 10.3, "amber"))
    if card:
        p += [
            *[box(1.3, 1.42, y - 0.07, y + 0.07, 3.2, 5.95, "chrome") for y in np.linspace(-1.45, 1.45, 9)],  # vertical bars
            pane((1.9, 3.6), (3.4, 4.8), 2.45, 3.75, "chrome", out=0.04, f0=0.2, f1=0.8),  # headlights in the fenders
            pane((1.9, 3.6), (3.4, 4.8), 2.6, 3.6, "lamp", out=0.07, f0=0.3, f1=0.7),
            pane((1.9, 3.6), (3.4, 4.8), -3.75, -2.45, "chrome", out=0.04, f0=0.2, f1=0.8),
            pane((1.9, 3.6), (3.4, 4.8), -3.6, -2.6, "lamp", out=0.07, f0=0.3, f1=0.7),
            cyl("z", 9.4, 3.05, 1.0, 6.4, 6.55, "chrome"),  # the cleaners' caps
            cyl("z", 9.4, -3.05, 1.0, 6.4, 6.55, "chrome"),
            *[box(10.15, 10.4, y - 0.14, y + 0.14, 10.0, 10.2, "amber") for y in (-2.4, -1.2, 0.0, 1.2, 2.4)],  # visor lamps
            cyl("x", 1.3, 10.25, 0.17, 11.4, 13.6, "chrome"),  # air horns on the roof
            cyl("x", 1.75, 10.2, 0.14, 11.6, 13.2, "chrome"),
            *both(10.4, 20.6, 3.98, 4.07, 3.6, 3.9, "chrome"),  # chrome trim under the cab and sleeper
            *both(13.95, 14.05, 3.99, 4.03, 3.95, 9.6, "black"),  # door seam
            *both(13.0, 13.6, 4.0, 4.07, 6.4, 6.55, "chrome"),  # door handle
            *both(16.2, 17.6, 3.98, 4.04, 8.5, 9.5, "glass"),  # sleeper window
            *both(10.6, 10.8, 4.0, 4.75, 8.0, 8.15, "chrome"),  # mirror arm
            *both(10.5, 10.85, 4.6, 4.95, 7.0, 9.2, "chrome"),  # west-coast mirror
            cyl("z", 20.95, 3.55, 0.56, 7.5, 11.2, "chrome"),  # heat shields
            cyl("z", 20.95, -3.55, 0.56, 7.5, 11.2, "chrome"),
            *[cyl("x", s * 3.5, 2.55, 1.08, x, x + 0.16, "dark") for s in (1, -1) for x in (11.9, 14.7)],  # tank straps
            *both(18.0, 25.4, 2.0, 4.35, 3.65, 3.8, "chrome"),  # chrome quarter fenders
        ]
    return p, 21.6


MODELS = {"keystone": keystone, "meridian": meridian, "ironwood": ironwood}

# ---------------------------------------------------------------------------------------------------------------- card

W, H = 128, 96
SS = 4
YAW = np.radians(24)  # from square side-on toward the front
PITCH = np.radians(8)  # looking down a little
TALL = 1.0  # the card drawn this much taller than true
KEY = np.array([-0.5, 0.35, 0.8])  # toward the warm key light, in the truck's frame: ahead, on our side, high
KEY = KEY / np.linalg.norm(KEY)
INK = (2, 1, 4)

# Ramps, dark to light, all from the rig cards (assets/rigs/*.png).
CARD = {
    "paint": [(35, 71, 87), (37, 96, 110), (40, 128, 148), (43, 153, 171), (41, 184, 188), (59, 189, 201), (78, 190, 198), (105, 214, 218), (240, 199, 153)],
    "chrome": [(50, 34, 53), (98, 73, 71), (129, 84, 66), (149, 95, 75), (196, 163, 151), (220, 165, 131), (229, 166, 121), (247, 197, 136), (250, 224, 177), (253, 242, 200), (254, 252, 243)],
    "steel": [(33, 37, 69), (49, 53, 69), (66, 68, 81), (92, 97, 108), (114, 122, 145), (133, 136, 142), (151, 165, 184), (183, 200, 224), (207, 220, 240)],
    "dark": [(1, 1, 8), (13, 15, 39), (24, 27, 53), (36, 34, 47), (49, 53, 69)],
    "black": [(1, 1, 8), (13, 15, 39), (24, 27, 53), (36, 34, 47), (49, 53, 69), (66, 68, 81)],
    "tyre": [(1, 1, 8), (13, 15, 39), (24, 27, 53), (36, 34, 47), (58, 58, 73)],
    "grille": [(1, 1, 8), (13, 15, 39), (24, 27, 53)],
    "glass": [(13, 15, 39), (33, 54, 87), (60, 112, 156), (113, 148, 176), (158, 182, 210), (207, 220, 240)],
    "lamp": [(250, 169, 98), (252, 219, 139), (255, 249, 201)],
    "amber": [(237, 114, 40), (242, 129, 52), (250, 169, 98)],
    "tail": [(164, 38, 42), (191, 46, 49)],
}


def camera():
    c = np.array([-np.sin(YAW) * np.cos(PITCH), np.cos(YAW) * np.cos(PITCH), np.sin(PITCH)])  # toward the camera
    r = np.array([-np.cos(YAW), -np.sin(YAW), 0.0])  # screen right: the way the truck faces
    u = np.cross(c, r)
    return c, r, u


def taller(pr):
    """A part drawn TALL times as tall."""
    kind, g, mat, seams = pr
    if kind == "box":
        return (kind, (*g[:4], g[4] * TALL, g[5] * TALL), mat, seams)
    if kind == "poly":
        return (kind, tuple((nx, ny, nz / TALL, dd) for nx, ny, nz, dd in g), mat, seams)
    axis, c0, c1, r, lo, hi = g
    if axis == "z":
        return (kind, (axis, c0, c1, r, lo * TALL, hi * TALL), mat, seams)
    if axis == "x":  # a cylinder along x keeps its round section; only its centre rises
        return (kind, (axis, c0, c1 * TALL, r, lo, hi), mat, seams)
    return (kind, (axis, c0, c1 * TALL, r, lo, hi), mat, seams)


def trace(prims, o, d):
    best = np.full(o.shape[0], np.inf)
    nrm = np.zeros(o.shape)
    mat = np.full(o.shape[0], -1)
    for i, pr in enumerate(prims):
        t, nn = rs.hits(pr, o, d)
        closer = t < best
        best[closer] = t[closer]
        nrm[closer] = nn[closer]
        mat[closer] = i
    return best, nrm, mat


def bounds(pr):
    """A part's box, (lo, hi) per axis, or None for a pane (it lies inside a body anyway)."""
    kind, g, _m, _s = pr
    if kind == "box":
        return [(g[0], g[1]), (g[2], g[3]), (g[4], g[5])]
    if kind == "poly":
        lo, hi = [None] * 3, [None] * 3
        for *n, dd in g:
            nz = [i for i in range(3) if n[i] != 0]
            if len(nz) == 1:
                i = nz[0]
                if n[i] < 0:
                    lo[i] = dd / n[i]
                else:
                    hi[i] = dd / n[i]
        if None in lo or None in hi:
            return None
        return list(zip(lo, hi))
    axis, c0, c1, rr, lo_, hi_ = g
    a = "xyz".index(axis)
    u, v = [i for i in range(3) if i != a]
    out = [None] * 3
    out[a], out[u], out[v] = (lo_, hi_), (c0 - rr, c0 + rr), (c1 - rr, c1 + rr)
    return out


def extent(prims) -> tuple[float, float, float, float]:
    """The model's outline on the card's screen, in feet: left, right, top, bottom (screen up positive)."""
    c, r, u = camera()
    pts = []
    for pr in prims:
        b = bounds(pr)
        if b is None:
            continue
        pts += [(x, y, z) for x in b[0] for y in b[1] for z in b[2]]
    pts = np.array(pts)
    sx, sy = pts @ r, pts @ u
    return sx.min(), sx.max(), sy.max(), sy.min()


def card(make: str, scale: float, ground: float) -> np.ndarray:
    prims = [taller(q) for q in MODELS[make](True)[0]]
    c, r, u = camera()
    left, right, _top, bot = extent(prims)
    mid = (left + right) / 2
    N = W * SS, H * SS
    px = (np.arange(N[0]) + 0.5) / SS
    py = (np.arange(N[1]) + 0.5) / SS
    gx, gy = np.meshgrid(px, py)
    sx = (gx.ravel() - W / 2) / scale + mid
    sy = (ground - gy.ravel()) / scale + bot  # the truck's lowest point (the near front tyre) on the ground row
    o = sx[:, None] * r + sy[:, None] * u + 200.0 * c  # rays from far off toward the truck
    d = np.broadcast_to(-c, o.shape).copy()
    best, nrm, mat = trace(prims, o, d)
    hit = np.isfinite(best)
    pos = o + np.where(hit, best, 0)[:, None] * d
    # Light: Lambert from the warm key, a cool fill, and shadows cast by the key.
    lam = np.clip(nrm @ KEY, 0, 1)
    so = pos + nrm * 0.03 + KEY * 0.02
    sb, _, _ = trace(prims, so[hit], np.broadcast_to(KEY, (hit.sum(), 3)).copy())
    shadow = np.zeros(len(best), bool)
    shadow[np.nonzero(hit)[0][np.isfinite(sb)]] = True
    lam[shadow] *= 0.25
    tone = 0.22 + 0.78 * lam
    # Mirrors: the reflected ray's height picks sky, a bright horizon, the dark line under it, or the warm ground, a
    # little brighter toward the sun's side; an upright face looks a little below level, so it shows the horizon.
    refl = d - 2 * (d * nrm).sum(1)[:, None] * nrm
    rz = refl[:, 2]
    env = np.select([rz > 0.45, rz > 0.12, rz > -0.22, rz > -0.38], [0.6, 0.78, 0.95, 0.08], 0.36)
    kxy = KEY[:2] / np.linalg.norm(KEY[:2])
    env = env + 0.12 * (refl[:, :2] @ kxy) / np.maximum(np.linalg.norm(refl[:, :2], axis=1), 1e-6) - 0.04
    glint = refl @ KEY > 0.985
    half = KEY + c
    half /= np.linalg.norm(half)
    spec = np.clip(nrm @ half, 0, 1) ** 24
    kinds = np.array([pr[2] for pr in prims] + ["none"])
    mname = kinds[mat]
    val = tone.copy()
    m = (mname == "chrome") | (mname == "glass")
    val[m] = env[m] * np.where(shadow[m], 0.7, 1.0) * (0.75 + 0.25 * lam[m]) + 0.1 * lam[m]
    val[(mname == "chrome") & glint & ~shadow] = 1.0
    g = mname == "glass"
    glare = ((gx.ravel() + gy.ravel()) % 26) < 3.5  # a diagonal glare across the glass
    val[g] = 0.08 + 0.5 * env[g] + np.where(glare[g], 0.3, 0)
    p = mname == "paint"
    val[p] = np.minimum(tone[p] * 0.92, 0.86) + np.where(spec[p] > 0.6, 0.3, 0)
    val[(mname == "lamp") | (mname == "amber") | (mname == "tail")] = 0.6 + 0.4 * lam[(mname == "lamp") | (mname == "amber") | (mname == "tail")]
    # Each sample to a ramp step; each pixel takes its commonest part, and that part's commonest step.
    step = np.zeros(len(val), int)
    for k, ramp in CARD.items():
        s = mname == k
        step[s] = np.clip((val[s] * len(ramp)).astype(int), 0, len(ramp) - 1)
    mat_px = mat.reshape(H, SS, W, SS).transpose(0, 2, 1, 3).reshape(H, W, SS * SS)
    step_px = step.reshape(H, SS, W, SS).transpose(0, 2, 1, 3).reshape(H, W, SS * SS)
    dep_px = np.where(hit, best, np.inf).reshape(H, SS, W, SS).transpose(0, 2, 1, 3).reshape(H, W, SS * SS)
    out = np.zeros((H, W, 4), np.uint8)
    depth = np.full((H, W), np.inf)
    owner = np.full((H, W), -1)
    stp = np.zeros((H, W), int)
    for yy in range(H):
        for xx in range(W):
            ms = mat_px[yy, xx]
            on = ms >= 0
            if on.sum() < SS * SS / 2:
                continue
            vals, cnt = np.unique(ms[on], return_counts=True)
            mi = vals[cnt.argmax()]
            sel = ms == mi
            sv, sc = np.unique(step_px[yy, xx][sel], return_counts=True)
            k = kinds[mi]
            st = sv[sc.argmax()] if sc.max() * 2 > sel.sum() else int(round(step_px[yy, xx][sel].mean()))
            stp[yy, xx] = st
            out[yy, xx, 3] = 255
            depth[yy, xx] = dep_px[yy, xx][sel].min()
            owner[yy, xx] = mi
    on = out[..., 3] > 0
    # A light edge along every top edge in the warm light: two steps up where the pixel above is sky or farther off.
    above_off = np.zeros_like(on)
    above_off[1:] = ~on[:-1] | (depth[:-1] - depth[1:] > 0.5)
    above_off[0] = True
    for yy, xx in zip(*np.nonzero(on & above_off)):
        k = kinds[owner[yy, xx]]
        if k in ("paint", "chrome", "steel"):
            stp[yy, xx] = min(stp[yy, xx] + 2, len(CARD[k]) - 1)
    for yy, xx in zip(*np.nonzero(on)):
        out[yy, xx, :3] = CARD[kinds[owner[yy, xx]]][stp[yy, xx]]
    # Inner lines where the depth jumps: the farther pixel goes to its part's darkest, or to ink over a big step.
    edge_s = np.zeros_like(on)
    edge_b = np.zeros_like(on)
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        nb = np.roll(np.roll(depth, dy, 0), dx, 1)
        nbon = np.roll(np.roll(on, dy, 0), dx, 1)
        jump = depth - nb
        edge_b |= on & nbon & (jump > 2.5)
        edge_s |= on & nbon & (jump > 0.5)
    for yy, xx in zip(*np.nonzero(edge_s & ~edge_b)):
        out[yy, xx, :3] = CARD[kinds[owner[yy, xx]]][0]
    out[edge_b, :3] = INK
    ring = np.zeros_like(on)
    ring[1:] |= on[:-1]
    ring[:-1] |= on[1:]
    ring[:, 1:] |= on[:, :-1]
    ring[:, :-1] |= on[:, 1:]
    ring &= ~on
    out[ring, :3] = INK
    out[ring, 3] = 255
    return out


def card_layout() -> tuple[float, float]:
    """One scale and one ground line for all three, so the biggest fills the card with a few pixels to spare."""
    c, r, u = camera()
    wide = tall = 0.0
    for make in MAKES:
        left, right, top, bot = extent([taller(q) for q in MODELS[make](True)[0]])
        wide, tall = max(wide, right - left), max(tall, top - bot)
    scale = min((W - 10) / wide, (H - 10) / tall)
    return scale, H - 4


# ----------------------------------------------------------------------------------------------------------------- map

MAP_MATS = {"paint": "cyan", "chrome": "chrome", "steel": "stripe", "dark": "dark", "black": "dark", "tyre": "tyre", "grille": "dark", "glass": "glass", "lamp": "lamp", "amber": "lamp", "tail": "tail"}


def on_map(make: str, kind: str) -> np.ndarray:
    parts, nose = MODELS[make](False)
    tractor = [rs.stretched((k, g, MAP_MATS[m], s)) for k, g, m, s in parts]
    if kind == "bobtail":
        prims, length = tractor, max(rear(parts), nose) * rs.LONG
    else:
        prims, length = tractor + rs.trailer(kind, nose), nose * rs.LONG + 51.7
    order = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
    return np.concatenate([rs.render(prims, rs.DIRS[h], length) for h in order], 1)


def rear(parts) -> float:
    return max(b[0][1] for b in map(bounds, parts) if b is not None)


def fit(paint: np.ndarray) -> np.ndarray:
    """The repainted card in the rig cards' own colours: its paint (the teal band) takes the cards' cab cyan, a ramp of
    their eight commonest cab colours matched by brightness (the repaint's spread stretched onto the cab's), and every
    other pixel snaps to the nearest colour the cards use."""
    cards = [pm.read_png(os.path.join(ASSETS, "rigs", f"{n}.png")) for n in ("van", "reefer", "flatbed")]
    pal = np.array(sorted({tuple(c) for a in cards for c in a[a[..., 3] > 0][:, :3]}), float)
    cab = np.concatenate([a[:, 150:][a[:, 150:, 3] > 0][:, :3] for a in cards]).astype(float)
    hue, light, sat = hls(cab)
    cab = cab[(hue > 175) & (hue < 200) & (sat > 0.3) & (light > 0.15)]
    cols, counts = np.unique(cab, axis=0, return_counts=True)
    ramp = cols[np.argsort(-counts)[:8]]
    ramp = ramp[np.argsort(ramp.mean(1))]
    cab_l = cab.mean(1)
    img = paint.astype(float)
    op = img[..., 3] > 0
    hue, light, sat = hls(img[..., :3])
    teal = op & (hue > 160) & (hue < 205) & (sat > 0.2) & (light > 0.12)
    v = img[..., :3][teal].mean(1)
    want = cab_l.mean() + (v - v.mean()) * cab_l.std() / max(v.std(), 1e-6)
    img[..., :3][teal] = ramp[np.abs(ramp.mean(1)[None] - want[:, None]).argmin(1)]
    rest = op & ~teal
    q = img[..., :3][rest]
    img[..., :3][rest] = pal[((q[:, None] - pal[None]) ** 2).sum(-1).argmin(1)]
    img[..., 3] = np.where(op, 255, 0)
    return img.astype(np.uint8)


def hls(rgb: np.ndarray):
    r, g, b = (rgb[..., i] / 255 for i in range(3))
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    light = (mx + mn) / 2
    d = mx - mn
    with np.errstate(divide="ignore", invalid="ignore"):
        sat = np.where(d == 0, 0, d / (1 - np.abs(2 * light - 1)))
        hue = np.select([d == 0, mx == r, mx == g], [0, ((g - b) / d) % 6, (b - r) / d + 2], (r - g) / d + 4) * 60
    return hue, light, sat


def main() -> None:
    what = sys.argv[1:] or ["layouts", "fit", "map"]
    src = os.path.join(ASSETS, "makes", "src")
    if "layouts" in what:
        os.makedirs(src, exist_ok=True)
        scale, ground = card_layout()
        print(f"layouts: {scale:.2f} px a foot")
        for make in MAKES:
            pm.write_png(os.path.join(src, f"{make}-layout.png"), card(make, scale, ground))
            print(f"makes/src/{make}-layout.png: {W}×{H}")
    if "fit" in what:
        for make in MAKES:
            pm.write_png(os.path.join(ASSETS, "makes", f"{make}.png"), fit(pm.read_png(os.path.join(src, f"{make}-paint.png"))))
            print(f"makes/{make}.png: {W}×{H}")
    if "map" in what:
        os.makedirs(os.path.join(ASSETS, "trucks", "makes"), exist_ok=True)
        for make in MAKES:
            for kind in ("van", "reefer", "flatbed", "bobtail"):
                sheet = on_map(make, kind)
                pm.write_png(os.path.join(ASSETS, "trucks", "makes", f"{make}-{kind}.png"), sheet)
                print(f"trucks/makes/{make}-{kind}.png: {sheet.shape[1]}×{sheet.shape[0]}")
        layout = {"spritesheet": {"cell_size": {"width": rs.CELL, "height": rs.CELL}, "columns": 8, "rows": [{"row": 0, "type": "rotations", "frame_count": 8, "directions": ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]}]}}
        with open(os.path.join(ASSETS, "trucks", "makes", "layout.json"), "w") as f:
            json.dump(layout, f, indent=2)
            f.write("\n")


if __name__ == "__main__":
    main()
