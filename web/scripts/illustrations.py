#!/usr/bin/env python3
"""
Generates the isometric Vendo illustrations used by the landing site.

    python3 scripts/illustrations.py

Stdlib only. Output goes to public/illustrations/*.svg. Brand logos are read
from public/brand/ and embedded as data URIs so each SVG is self-contained
(an <img src="x.svg"> cannot load external files).
"""
import base64
import math
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "illustrations")
C30 = math.cos(math.pi / 6)

BLUE = "#0064FF"
BLUE_D = "#0052D6"
BLUE_DD = "#003C9E"
BLUE_L = "#4D93FF"
BLUE_XL = "#DCE9FF"
NAVY = "#0A1633"
SLATE = "#8B97AD"
FONT = "Outfit, 'Avenir Next', 'Helvetica Neue', Arial, sans-serif"

# Every scene is rendered twice: light (name.svg) and dark (name-dark.svg).
# tc() maps a light-theme colour to its dark equivalent. "#FFFFFE" marks a white
# *surface* (darkens at night); plain "#FFFFFF" is paint/paper and stays white.
THEME = "light"
PALETTES = {
    "light": {"#FFFFFE": "#FFFFFF", "#FFFFFD": "#FFFFFF", "#0A1634": NAVY},
    "dark": {
        "#FFFFFE": "#23335C",   # white surfaces (planters, plaques, platforms)
        "#FFFFFD": "#3A5088",   # highlight edges
        "#0A1634": BLUE,  # label pills
        "#0A1633": "#E6EDFA",   # dark text on light plates -> light text
        "#DCE9FF": "#123A9C",   # hero halo
        "#D5DFEC": "#1A2749",   # floor grid
        "#D5DDEA": "#131D38",   # platform sides
        "#F2F5FA": "#1A2747", "#DCE3EE": "#131D38", "#C9D3E2": "#0E1630",  # map slab
        "#E1E7F0": "#22315A",   # map roads, paper sides
        "#D6ECD8": "#173A33",   # parks
        "#E9EEF5": "#2A3A62",   # sign pole
        "#C9D3E1": "#142040",   # sign plate backs
        "#E3EAF5": "#2A3A62",   # calendar cells
        "#0B2A5B": "#01040C",   # shadows
    },
}


def tc(color):
    return PALETTES[THEME].get(color, color)


def bg_colors(c1, c2):
    if THEME == "dark":
        return ("#0E1830", "#0A1226") if c1 == "#FFFFFF" else ("#16213B", "#0F182D")
    return c1, c2


def data_uri(name):
    with open(os.path.join(ROOT, "public", "brand", name), "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode()


LOGO_NAVY = data_uri("logo-navy.png")
LOGO_WHITE = data_uri("logo-white.png")
LOGO_BLUE = data_uri("logo-blue.png")
ICON_WHITE = data_uri("icon-white.png")
ICON_BLUE = data_uri("icon-blue.png")
LOGO_RATIO = 140 / 575  # height / width of the extracted wordmark
ICON_RATIO = 134 / 120

# Motion shared by every scene. SVG-as-<img> still runs CSS animations, and the
# reduced-motion query is honoured inside the image too.
ANIM_CSS = """<style>
.pulse{animation:vpulse 2.6s ease-in-out infinite}
.pulse-slow{animation:vpulse 4.5s ease-in-out infinite}
.bob{animation:vbob 1.6s ease-in-out infinite}
.float{animation:vfloat 5s ease-in-out infinite}
.dash{animation:vdash 1.4s linear infinite}
.dash19{animation:vdash19 1.6s linear infinite}
.ring{transform-box:fill-box;transform-origin:center;animation:vring 2.2s ease-out infinite}
@keyframes vpulse{0%,100%{opacity:.55}50%{opacity:1}}
@keyframes vbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}
@keyframes vfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes vdash{to{stroke-dashoffset:-24}}
@keyframes vdash19{to{stroke-dashoffset:-38}}
@keyframes vring{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.6);opacity:0}}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}
</style>"""


def common_defs():
    dark = THEME == "dark"
    wl = ("#2E3F6C", "#1F2D54") if dark else ("#FFFFFF", "#E6ECF5")
    wr = ("#213059", "#172342") if dark else ("#EDF1F7", "#D3DCE9")
    wt = ("#3A4D82", "#2E4070") if dark else ("#FFFFFF", "#F3F6FB")
    win, win2 = ("#F5C96B", "#5C86D6") if dark else ("#CFE0FF", "#9FBDF2")
    return ANIM_CSS + f"""
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
<filter id="soft2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="haze" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
  <feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<linearGradient id="wallL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{wl[0]}"/><stop offset="1" stop-color="{wl[1]}"/></linearGradient>
<linearGradient id="wallR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{wr[0]}"/><stop offset="1" stop-color="{wr[1]}"/></linearGradient>
<linearGradient id="wallT" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{wt[0]}"/><stop offset="1" stop-color="{wt[1]}"/></linearGradient>
<linearGradient id="blueL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2F7DFF"/><stop offset="1" stop-color="{BLUE_D}"/></linearGradient>
<linearGradient id="blueR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{BLUE_D}"/><stop offset="1" stop-color="{BLUE_DD}"/></linearGradient>
<linearGradient id="blueT" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5C9DFF"/><stop offset="1" stop-color="#2E7BFF"/></linearGradient>
<linearGradient id="kraftL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E2B98A"/><stop offset="1" stop-color="#CF9E68"/></linearGradient>
<linearGradient id="kraftR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C8935E"/><stop offset="1" stop-color="#B07A48"/></linearGradient>
<linearGradient id="kraftT" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F1D2A8"/><stop offset="1" stop-color="#E6BF8E"/></linearGradient>
<linearGradient id="darkL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A4458"/><stop offset="1" stop-color="#252D3D"/></linearGradient>
<linearGradient id="door" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B2E78"/><stop offset=".55" stop-color="#0A4FD0"/><stop offset="1" stop-color="#3D8BFF"/></linearGradient>
<radialGradient id="glowBlue"><stop offset="0" stop-color="#5EA0FF" stop-opacity=".85"/><stop offset="1" stop-color="#5EA0FF" stop-opacity="0"/></radialGradient>
<radialGradient id="glowWhite"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".95"/><stop offset=".35" stop-color="#E4EEFF" stop-opacity=".6"/><stop offset="1" stop-color="#E4EEFF" stop-opacity="0"/></radialGradient>
<radialGradient id="glowWarm"><stop offset="0" stop-color="#FFF4D6" stop-opacity=".95"/><stop offset="1" stop-color="#FFE3A3" stop-opacity="0"/></radialGradient>
<radialGradient id="leaf1" cx=".35" cy=".3"><stop offset="0" stop-color="#8DD48A"/><stop offset="1" stop-color="#3E9A52"/></radialGradient>
<radialGradient id="leaf2" cx=".35" cy=".3"><stop offset="0" stop-color="#6CC274"/><stop offset="1" stop-color="#2C7A3F"/></radialGradient>
<radialGradient id="gold" cx=".35" cy=".35"><stop offset="0" stop-color="#FFE08A"/><stop offset="1" stop-color="#E8A92C"/></radialGradient>
<pattern id="win" width="26" height="30" patternUnits="userSpaceOnUse"><rect x="6" y="6" width="14" height="17" rx="2" fill="{win}"/></pattern>
<pattern id="winDark" width="26" height="30" patternUnits="userSpaceOnUse"><rect x="6" y="6" width="14" height="17" rx="2" fill="{win2}"/></pattern>
"""


class Scene:
    """Isometric canvas. World axes: x -> screen right-down, y -> screen left-down, z -> up.
    Visible faces of a box: top, 'L' (the y-max face) and 'R' (the x-max face)."""

    def __init__(self, W, H, ox, oy, k):
        self.W, self.H, self.ox, self.oy, self.k = W, H, ox, oy, k
        self.defs = [common_defs()]
        self.body = []

    # --- projection -------------------------------------------------------
    def P(self, x, y, z=0.0):
        return (self.ox + (x - y) * C30 * self.k, self.oy + (x + y) * 0.5 * self.k - z * self.k)

    def pts(self, p3):
        return " ".join("%.1f,%.1f" % self.P(*p) for p in p3)

    # --- primitives -------------------------------------------------------
    def add(self, el):
        self.body.append(el)

    def group(self, cls, style=""):
        self.add(f'<g class="{cls}"' + (f' style="{style}"' if style else "") + ">")

    def end(self):
        self.add("</g>")

    def vec(self, dx, dy, dz=0.0):
        """Screen-space offset of a world-space movement."""
        return ((dx - dy) * C30 * self.k, (dx + dy) * 0.5 * self.k - dz * self.k)

    def keyframes(self, name, frames, duration, timing="linear", delay=0):
        """frames: list of (percent, (dx, dy, dz) world offset, opacity)."""
        steps = []
        for pct, (dx, dy, dz), op in frames:
            x, y = self.vec(dx, dy, dz)
            steps.append(f"{pct}%{{transform:translate({x:.1f}px,{y:.1f}px);opacity:{op}}}")
        self.defs.append(f"<style>@keyframes {name}{{{''.join(steps)}}}"
                         f".{name}{{animation:{name} {duration}s {timing} {delay}s infinite}}</style>")

    def poly(self, p3, fill, attrs=""):
        seam = "" if "stroke" in attrs else f' stroke="{fill}" stroke-width=".8" stroke-linejoin="round"'
        self.add(f'<polygon points="{self.pts(p3)}" fill="{fill}"{seam} {attrs}/>')

    def line(self, a, b, stroke, w=2, attrs=""):
        (x1, y1), (x2, y2) = self.P(*a), self.P(*b)
        self.add(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{stroke}" '
                 f'stroke-width="{w}" stroke-linecap="round" {attrs}/>')

    def path3(self, p3, stroke, w=2, attrs=""):
        d = "M" + " L".join("%.1f,%.1f" % self.P(*p) for p in p3)
        self.add(f'<path d="{d}" fill="none" stroke="{stroke}" stroke-width="{w}" '
                 f'stroke-linecap="round" stroke-linejoin="round" {attrs}/>')

    def box(self, x, y, z, w, d, h, top="url(#wallT)", left="url(#wallL)", right="url(#wallR)",
            attrs="", edge=None):
        X, Y, Z = x + w, y + d, z + h
        self.poly([(x, Y, z), (X, Y, z), (X, Y, Z), (x, Y, Z)], left, attrs)
        self.poly([(X, y, z), (X, Y, z), (X, Y, Z), (X, y, Z)], right, attrs)
        self.poly([(x, y, Z), (X, y, Z), (X, Y, Z), (x, Y, Z)], top, attrs)
        if edge:
            self.path3([(x, Y, Z), (X, Y, Z), (X, y, Z)], edge, 1.6, 'opacity=".9"')
            self.line((X, Y, z), (X, Y, Z), edge, 1.2, 'opacity=".55"')

    def shadow(self, p3, opacity=0.16, color="#0B2A5B"):
        color = tc(color)
        self.add(f'<polygon points="{self.pts(p3)}" fill="{color}" opacity="{opacity}" filter="url(#soft)"/>')

    def box_shadow(self, x, y, w, d, h, opacity=0.16, reach=0.9):
        # light from the back-right: shadows fall towards +y (screen left-down)
        s = h * reach
        self.shadow([(x, y, 0), (x + w, y, 0), (x + w, y + d + s, 0), (x, y + d + s, 0)], opacity)

    def face(self, kind, o3, inner):
        """Draw `inner` in a face-local frame (1 local unit = 1/100 world unit, v points down).
        L: plane y=const, u along +x.  R: plane x=const, u along -y.  T: plane z=const, u=+x, v=+y."""
        a = self.k / 100
        ox, oy = self.P(*o3)
        m = {"L": (C30 * a, 0.5 * a, 0, a), "R": (C30 * a, -0.5 * a, 0, a),
             "T": (C30 * a, 0.5 * a, -C30 * a, 0.5 * a)}[kind]
        self.add(f'<g transform="matrix({m[0]:.4f},{m[1]:.4f},{m[2]:.4f},{m[3]:.4f},{ox:.1f},{oy:.1f})">{inner}</g>')

    def glow(self, x, y, z, r, grad="glowBlue", opacity=1):
        cx, cy = self.P(x, y, z)
        self.add(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" fill="url(#{grad})" opacity="{opacity}"/>')

    def cylinder(self, x, y, z, r, h, side, top, attrs=""):
        rx, ry = 1.2247 * r * self.k, 0.7071 * r * self.k
        cx, yb = self.P(x, y, z)
        yt = yb - h * self.k
        self.add(f'<path d="M{cx - rx:.1f},{yb:.1f} A{rx:.1f},{ry:.1f} 0 0 0 {cx + rx:.1f},{yb:.1f} '
                 f'L{cx + rx:.1f},{yt:.1f} L{cx - rx:.1f},{yt:.1f} Z" fill="{side}" {attrs}/>')
        self.add(f'<ellipse cx="{cx:.1f}" cy="{yt:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" fill="{top}" {attrs}/>')

    def extrude(self, poly2, y0, y1, front, side_up, side_down, back=None):
        """Extrude a polygon drawn in the x/z plane between y0 and y1 (front face at y1)."""
        area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(poly2, poly2[1:] + poly2[:1]))
        if area < 0:
            poly2 = poly2[::-1]
        self.poly([(u, y0, z) for u, z in poly2], back or side_down)
        for a, b in zip(poly2, poly2[1:] + poly2[:1]):
            du, dz = b[0] - a[0], b[1] - a[1]
            nx, nz = dz, -du
            if nx + nz <= 0:
                continue
            ln = math.hypot(nx, nz) or 1
            col = side_up if nz / ln > 0.35 else side_down
            self.poly([(a[0], y0, a[1]), (b[0], y0, b[1]), (b[0], y1, b[1]), (a[0], y1, a[1])], col)
        self.poly([(u, y1, z) for u, z in poly2], front)

    def render(self, bg="", view=None):
        x, y, w, h = view or (0, 0, self.W, self.H)
        return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
                f'viewBox="{x} {y} {w} {h}" width="{w}" height="{h}">'
                f'<defs>{"".join(self.defs)}</defs>{bg}{"".join(self.body)}</svg>')


# ---------------------------------------------------------------------------
# Reusable props
# ---------------------------------------------------------------------------

def parcel(s, x, y, z, w=0.9, d=0.9, h=0.7, label=True, shadow=True):
    if shadow and z == 0:
        s.box_shadow(x, y, w, d, h, 0.18, 0.6)
    s.box(x, y, z, w, d, h, "url(#kraftT)", "url(#kraftL)", "url(#kraftR)")
    X, Y, Z = x + w, y + d, z + h
    tape = "#F4DDBC"
    s.poly([(x + w * .44, y, Z), (x + w * .56, y, Z), (x + w * .56, Y, Z), (x + w * .44, Y, Z)], tape)
    s.poly([(x + w * .44, Y, Z), (x + w * .56, Y, Z), (x + w * .56, Y, Z - h * .3), (x + w * .44, Y, Z - h * .3)], tape)
    if label:
        lw, lh = w * 100 * .34, h * 100 * .36
        s.face("L", (x + w * .1, Y, z + h * .55),
               f'<rect width="{lw:.0f}" height="{lh:.0f}" rx="3" fill="{BLUE}"/>'
               f'<image href="{ICON_WHITE}" x="{lw * .25:.1f}" y="{lh * .18:.1f}" width="{lw * .5:.1f}" '
               f'height="{lw * .5 * ICON_RATIO:.1f}"/>')
        s.face("R", (X, y + d * .7, z + h * .6),
               f'<rect width="{d * 100 * .38:.0f}" height="{h * 100 * .3:.0f}" rx="2" fill="#FFFFFF" opacity=".85"/>'
               f'<rect x="4" y="5" width="{d * 100 * .26:.0f}" height="2" fill="#9AA6BA"/>'
               f'<rect x="4" y="10" width="{d * 100 * .18:.0f}" height="2" fill="#9AA6BA"/>')


def tree(s, x, y, size=1.0, planter=True):
    if planter:
        s.box_shadow(x - .7, y - .7, 1.4, 1.4, .8, .14, 1.1)
        s.box(x - .7, y - .7, 0, 1.4, 1.4, .8, edge=tc("#FFFFFD"))
        s.poly([(x - .55, y - .55, .8), (x + .55, y - .55, .8), (x + .55, y + .55, .8), (x - .55, y + .55, .8)], "#6B4F3A")
        base = .8
    else:
        s.shadow([(x - .6, y - .6, 0), (x + .6, y - .6, 0), (x + .6, y + 1.4, 0), (x - .6, y + 1.4, 0)], .14)
        base = 0
    s.line((x, y, base), (x, y, base + 1.6 * size), "#7A5638", 5 * size)
    cx, cy = s.P(x, y, base + 2.35 * size)
    r = s.k * .55 * size
    blobs = [(-.55, .15, .75, "leaf2"), (.55, .1, .75, "leaf2"), (0, -.55, .8, "leaf2"),
             (-.3, -.2, .8, "leaf1"), (.35, -.25, .75, "leaf1"), (0, .3, .8, "leaf1"), (0, -.05, .7, "leaf1")]
    for dx, dy, rr, g in blobs:
        s.add(f'<circle cx="{cx + dx * r:.1f}" cy="{cy + dy * r:.1f}" r="{rr * r:.1f}" fill="url(#{g})"/>')


def lamp(s, x, y, h=4.2, warm=False):
    s.shadow([(x - .2, y - .2, 0), (x + .2, y - .2, 0), (x + .2, y + 2.5, 0), (x - .2, y + 2.5, 0)], .1)
    s.box(x - .12, y - .12, 0, .24, .24, h, "#3A4458", "url(#darkL)", "#1F2635")
    s.box(x - .28, y - .28, h, .56, .56, .35, "#46516A", "#2B3345", "#1F2635")
    s.group("pulse-slow")
    s.glow(x, y, h - .1, s.k * 1.3, "glowWarm" if warm else "glowWhite")
    s.end()


def wheel(s, cx, y, cz, r, w):
    n = 28
    circle = [(cx + r * math.cos(2 * math.pi * i / n), cz + r * math.sin(2 * math.pi * i / n)) for i in range(n)]
    s.extrude(circle, y - w / 2, y + w / 2, "#1C2230", "#2E3648", "#161B26")
    y1 = y + w / 2 + .001
    for rr, col in ((.68, "#B8C3D3"), (.52, "#2A3244"), (.2, "#DDE3EC")):
        s.poly([(cx + r * rr * math.cos(2 * math.pi * i / n), y1, cz + r * rr * math.sin(2 * math.pi * i / n))
                for i in range(n)], col)


def bike(s, bx, by, k=1.0, box_color="blue", lights=True):
    """Vendo electric delivery motorcycle heading +x (screen right-down), side view on the L face."""
    def U(p):
        return [(bx + u * k, z * k) for u, z in p]

    s.shadow([(bx - 1.8 * k, by - .5 * k, 0), (bx + 1.7 * k, by - .5 * k, 0),
              (bx + 1.7 * k, by + 1.6 * k, 0), (bx - 1.8 * k, by + 1.6 * k, 0)], .22)
    r = .5
    wheel(s, bx - 1.1 * k, by, r * k, r * k, .28 * k)
    wheel(s, bx + 1.12 * k, by, r * k, r * k, .28 * k)
    y0, y1 = by - .22 * k, by + .22 * k
    # frame / battery housing
    s.extrude(U([(-1.0, .5), (.75, .5), (.9, .82), (-.75, .88)]), by - .18 * k, by + .18 * k,
              "#2B3446", "#3B4559", "#1A2030")
    # fork
    s.extrude(U([(1.06, .5), (1.18, .5), (.82, 1.72), (.7, 1.72)]), by - .07 * k, by + .07 * k,
              "#9AA6BA", "#C4CDDA", "#6F7B90")
    # body shell
    s.extrude(U([(-1.42, .98), (-.35, .82), (.35, .86), (.82, 1.36), (.62, 1.5), (-.08, 1.24), (-1.25, 1.4)]),
              y0, y1, "url(#blueL)", "#5C9DFF", BLUE_DD)
    # white side panel stripe
    s.poly([(bx - 1.1 * k, y1 + .002, 1.05 * k), (bx - .4 * k, y1 + .002, .93 * k),
            (bx - .38 * k, y1 + .002, 1.02 * k), (bx - 1.08 * k, y1 + .002, 1.16 * k)], "#FFFFFF", 'opacity=".9"')
    # seat
    s.extrude(U([(-1.2, 1.38), (-.12, 1.22), (-.08, 1.36), (-1.15, 1.55)]), by - .2 * k, by + .2 * k,
              "#1B2130", "#2F384A", "#10141D")
    # front cowl + headlight
    s.extrude(U([(.58, 1.3), (1.0, 1.36), (.95, 1.8), (.62, 1.74)]), by - .22 * k, by + .22 * k,
              "#FFFFFF", "#FFFFFF", "#C9D2E0")
    s.box(bx + .66 * k, by - .45 * k, 1.8 * k, .1 * k, .9 * k, .08 * k, "#3B4559", "#2B3446", "#1A2030")
    # delivery box
    bxw = .95 * k
    s.box(bx - 1.62 * k, by - .45 * k, 1.5 * k, bxw, .9 * k, .95 * k,
          "url(#blueT)" if box_color == "blue" else "url(#wallT)",
          "url(#blueL)" if box_color == "blue" else "url(#wallL)",
          "url(#blueR)" if box_color == "blue" else "url(#wallR)",
          edge="#8CB8FF" if box_color == "blue" else "#FFFFFF")
    lw = bxw * 100 * .8
    logo = LOGO_WHITE if box_color == "blue" else LOGO_BLUE
    s.face("L", (bx - 1.62 * k + bxw * .1, by + .45 * k, (1.5 + .95 * .62) * k),
           f'<image href="{logo}" width="{lw:.1f}" height="{lw * LOGO_RATIO:.1f}"/>')
    if lights:
        hx, hy = s.P(bx + 1.0 * k, by, 1.55 * k)
        s.add(f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="{7 * k:.1f}" fill="#FFFFFF"/>')
        s.group("pulse")
        s.glow(bx + 1.0 * k, by, 1.55 * k, 34 * k, "glowWhite")
        s.end()
        s.glow(bx - 1.45 * k, by, 1.02 * k, 12 * k, "glowBlue")


def signpost(s, px, py, words, ztop=4.8, h=5.2):
    s.shadow([(px - .2, py - .2, 0), (px + .2, py - .2, 0), (px + .2, py + 3, 0), (px - .2, py + 3, 0)], .1)
    s.box(px - .1, py - .1, 0, .2, .2, h, tc("#E9EEF5"), "url(#wallL)", "url(#wallR)")
    for i, word in enumerate(words):
        zt = ztop - i * .78
        plate = 'M0,0 H205 Q214,0 220,6 L240,26 Q244,30 240,34 L220,54 Q214,60 205,60 H10 Q0,60 0,50 V10 Q0,0 10,0 Z'
        s.face("R", (px - .02, py + .35, zt), f'<path d="{plate}" fill="{tc("#C9D3E1")}"/>')
        s.face("R", (px + .1, py + .35, zt),
               f'<path d="{plate}" fill="{tc("#FFFFFE")}"/>'
               f'<text x="26" y="42" font-family="{FONT}" font-size="31" font-weight="500" fill="{tc(NAVY)}">{word}</text>')


def bg_rect(W, H, c1="#FFFFFF", c2="#E9F0FB", gid="bg"):
    c1, c2 = bg_colors(c1, c2)
    return (f'<linearGradient id="{gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/>'
            f'<stop offset="1" stop-color="{c2}"/></linearGradient>', f'<rect width="{W}" height="{H}" fill="url(#{gid})"/>')


def floor_grid(s, x0, x1, y0, y1, step=2.0, color="#D5DFEC", opacity=.7):
    color = tc(color)
    parts = []
    x = x0
    while x <= x1:
        (a, b), (c, d) = s.P(x, y0), s.P(x, y1)
        parts.append(f'M{a:.1f},{b:.1f} L{c:.1f},{d:.1f}')
        x += step
    y = y0
    while y <= y1:
        (a, b), (c, d) = s.P(x0, y), s.P(x1, y)
        parts.append(f'M{a:.1f},{b:.1f} L{c:.1f},{d:.1f}')
        y += step
    s.add(f'<path d="{" ".join(parts)}" stroke="{color}" stroke-width="1.2" opacity="{opacity}" fill="none"/>')


# ---------------------------------------------------------------------------
# Scenes
# ---------------------------------------------------------------------------

def hero():
    # Wide canvas: the scene sits on the right so the page headline has clean space on the left.
    s = Scene(1800, 1000, 1330, 330, 44)
    d, r = bg_rect(1800, 1000, "#FFFFFF", "#E6EEFA")
    s.defs.append(d)
    s.defs.append(f'<radialGradient id="halo" cx=".74" cy=".45" r=".45"><stop offset="0" stop-color="{tc(BLUE_XL)}" '
                  f'stop-opacity=".9"/><stop offset="1" stop-color="{tc(BLUE_XL)}" stop-opacity="0"/></radialGradient>'
                  '<linearGradient id="road" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2A3244"/>'
                  '<stop offset="1" stop-color="#1E2534"/></linearGradient>'
                  '<linearGradient id="fadeG" gradientUnits="userSpaceOnUse" x1="860" y1="0" x2="1180" y2="0">'
                  '<stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>'
                  '<mask id="fadeL"><rect width="1800" height="1000" fill="url(#fadeG)"/></mask>')
    s.add('<rect width="1800" height="1000" fill="url(#halo)"/>')
    s.add('<g mask="url(#fadeL)">')
    floor_grid(s, -14, 22, -10, 22, 2.0)
    s.add('</g>')

    # distant hazy blocks
    for (x, y, w, dd, h) in [(2, -9, 4, 3, 6.5), (8, -8, 3, 4, 3.5), (13, -7, 3, 3, 5), (17, -4, 3, 3, 3)]:
        s.add('<g filter="url(#haze)" opacity=".5">')
        s.box(x, y, 0, w, dd, h)
        s.add('</g>')

    # road (fades out towards the headline on the left)
    s.add('<g mask="url(#fadeL)">')
    s.poly([(-6, 9.2, 0), (24, 9.2, 0), (24, 12.6, 0), (-6, 12.6, 0)], "url(#road)")
    s.poly([(-6, 12.6, 0), (24, 12.6, 0), (24, 12.6, -.25), (-6, 12.6, -.25)], "#141A26")
    # lane markings stream backwards so the parked bike reads as riding
    s.keyframes("roadflow", [(0, (0, 0, 0), 1), (100, (-2, 0, 0), 1)], 1.1)
    s.group("roadflow")
    for x in range(-6, 26, 2):
        s.poly([(x, 10.83, 0), (x + 1, 10.83, 0), (x + 1, 10.97, 0), (x, 10.97, 0)], "#FFFFFF", 'opacity=".55"')
    s.end()
    s.group("pulse-slow")
    for yy in (9.35, 12.45):
        s.path3([(-6, yy, .02), (24, yy, .02)], BLUE_L, 3, 'filter="url(#glow)"')
    s.end()
    s.add('</g>')

    tree(s, 8.6, -3.2, 1.1)

    # hub building
    s.box_shadow(0, 0, 6, 5, 5.2, .2, .8)
    s.box(0, 0, 0, 6, 5, 5.2, edge=tc("#FFFFFD"))
    s.box(3.6, .6, 5.2, 1.4, 1.2, .5, edge=tc("#FFFFFD"))  # rooftop unit
    s.box(.6, .5, 5.2, 2.6, .3, .35, edge=tc("#FFFFFD"))
    # door (on L face, y=5)
    s.poly([(1.1, 5.01, 0), (4.5, 5.01, 0), (4.5, 5.01, 3.25), (1.1, 5.01, 3.25)], BLUE)
    s.poly([(1.3, 5.02, 0), (4.3, 5.02, 0), (4.3, 5.02, 3.05), (1.3, 5.02, 3.05)], "url(#door)")
    for i in range(1, 8):
        z = 3.05 - i * .16
        s.path3([(1.3, 5.03, z), (4.3, 5.03, z)], "#FFFFFF", 1, 'opacity=".07"')
    s.group("pulse-slow")
    s.glow(2.8, 5.1, .6, 150, "glowBlue", .6)
    s.end()
    lw = 380
    s.face("L", (.95, 5.0, 4.55), f'<image href="{LOGO_WHITE if THEME == "dark" else LOGO_NAVY}" width="{lw}" height="{lw * LOGO_RATIO:.0f}"/>')
    s.group("pulse")
    s.face("L", (4.8, 5.0, 2.0), f'<image href="{ICON_BLUE}" width="60" height="{60 * ICON_RATIO:.0f}" filter="url(#glow)"/>')
    s.end()
    s.face("R", (6.0, 4.5, 4.3), "".join(
        f'<text x="0" y="{i * 60}" font-family="{FONT}" font-size="50" font-weight="300" fill="{SLATE}">{t}</text>'
        for i, t in enumerate(["Fast.", "Reliable.", "Delivered."])))

    # blue fin, beside the building (always in front of it: x > 6)
    s.box_shadow(6.1, -1.9, .6, 3.4, 7.6, .18, .5)
    s.box(6.1, -1.9, 0, .6, 3.4, 7.6, "url(#blueT)", "url(#blueL)", "url(#blueR)", edge="#8CB8FF")
    slats = "".join(f'<rect x="{u}" y="0" width="3" height="760" fill="#FFFFFF" opacity=".08"/>' for u in range(12, 340, 18))
    s.face("R", (6.7, 1.5, 7.6), slats + "".join(
        f'<text x="30" y="{95 + i * 56}" font-family="{FONT}" font-size="42" font-weight="400" fill="#FFFFFF">{t}</text>'
        for i, t in enumerate(["Food.", "Parcels.", "Possibilities."])) +
        '<rect x="32" y="290" width="46" height="4" rx="2" fill="#FFFFFF"/>')

    # conveyor
    s.poly([(1.5, 5, 0), (4.1, 5, 0), (4.1, 9.1, 0), (1.5, 9.1, 0)], tc("#0B2A5B"), 'opacity=".18" filter="url(#soft)"')
    s.box(1.5, 5, 0, 2.6, 4.0, .55, "#232B3B", "#C3CCDA", "#AEB9CA")
    for yy in [5.4 + i * .45 for i in range(9)]:
        s.path3([(1.6, yy, .56), (4.0, yy, .56)], "#39445A", 1.4)
    s.path3([(4.1, 5.05, .56), (4.1, 9.0, .56)], BLUE_L, 3, 'filter="url(#glow)"')
    s.path3([(1.5, 9.0, .56), (4.1, 9.0, .56)], BLUE_L, 3, 'filter="url(#glow)"')
    # parcels ride the belt out of the door, half a cycle apart
    s.keyframes("beltA", [(0, (0, 0, 0), 0), (6, (0, .16, 0), 1), (94, (0, 2.44, 0), 1), (100, (0, 2.6, 0), 0)], 8)
    s.keyframes("beltB", [(0, (0, 0, 0), 1), (47, (0, 1.22, 0), 1), (50, (0, 1.3, 0), 0),
                          (50.01, (0, -1.3, 0), 0), (53, (0, -1.22, 0), 1), (100, (0, 0, 0), 1)], 8)
    s.group("beltA")
    parcel(s, 1.9, 5.25, .55, 1.0, .95, .75, shadow=False)
    parcel(s, 2.6, 5.6, 1.3, .7, .7, .5, shadow=False, label=False)
    s.end()
    s.group("beltB")
    parcel(s, 2.3, 6.55, .55, .85, .85, .6, shadow=False)
    s.end()

    lamp(s, 8.6, 5.0, 4.4)

    # plaque
    s.box_shadow(6.8, 6.0, 3.6, 1.8, .55, .14, 1.4)
    s.box(6.8, 6.0, 0, 3.6, 1.8, .55, edge=tc("#FFFFFD"))
    s.face("T", (7.05, 6.3, .551),
           f'<text x="0" y="52" font-family="{FONT}" font-size="50" font-weight="400" fill="{SLATE}">More than</text>'
           f'<text x="0" y="112" font-family="{FONT}" font-size="50" font-weight="400" fill="{SLATE}">delivery.</text>'
           f'<rect x="4" y="136" width="44" height="6" rx="3" fill="{BLUE}"/>')

    signpost(s, 11.2, 2.0, ["Faster", "Safer", "Closer"], 5.0, 5.4)
    tree(s, 12.2, 5.4, .9)

    parcel(s, 13.4, 7.7, 0, 1.3, 1.2, 1.0)
    parcel(s, 14.9, 8.0, 0, .9, .9, .7)
    s.group("bob")
    bike(s, 10.4, 10.9, 1.45)
    s.end()
    return s.render(r)


def tracking():
    s = Scene(960, 620, 470, 130, 34)
    rnd = random.Random(7)
    d, r = bg_rect(960, 620, "#F7F9FD", "#E7EEF9")
    s.defs.append(d)
    s.box_shadow(0, 0, 12, 10, .4, .18, 3)
    s.box(0, 0, -.4, 12, 10, .4, tc("#F2F5FA"), tc("#DCE3EE"), tc("#C9D3E2"))
    roads_x = [3.9, 8.6]   # roads running along y at these x
    roads_y = [3.4, 6.9]   # roads running along x at these y
    for rx in roads_x:
        s.poly([(rx - .4, 0, .005), (rx + .4, 0, .005), (rx + .4, 10, .005), (rx - .4, 10, .005)], tc("#E1E7F0"))
    for ry in roads_y:
        s.poly([(0, ry - .4, .006), (12, ry - .4, .006), (12, ry + .4, .006), (0, ry + .4, .006)], tc("#E1E7F0"))
    cells_x = [(.3, 3.4), (4.4, 8.1), (9.1, 11.7)]
    cells_y = [(.3, 2.9), (3.9, 6.4), (7.4, 9.7)]
    cells = [(cx, cy) for cy in cells_y for cx in cells_x]
    parks = {(1, 1), (2, 2)}
    for i, (cx, cy) in enumerate(cells):
        ix, iy = i % 3, i // 3
        if (ix, iy) in parks:
            s.poly([(cx[0], cy[0], .01), (cx[1], cy[0], .01), (cx[1], cy[1], .01), (cx[0], cy[1], .01)], tc("#D6ECD8"))
            continue
        n = rnd.choice([1, 2, 2])
        width = (cx[1] - cx[0]) / n
        for j in range(n):
            bx0 = cx[0] + j * width + .15
            h = rnd.choice([1.2, 1.8, 2.4, 3.2])
            dd = cy[1] - cy[0] - .3
            s.box(bx0, cy[0] + .15, 0, width - .3, dd, h, edge=tc("#FFFFFD"))
            s.face("L", (bx0 + .15, cy[0] + .15 + dd, h - .25),
                   f'<rect width="{(width - .6) * 100:.0f}" height="{(h - .5) * 100:.0f}" fill="url(#win)"/>')
            s.face("R", (bx0 + width - .3, cy[0] + dd, h - .25),
                   f'<rect width="{(dd - .3) * 100:.0f}" height="{(h - .5) * 100:.0f}" fill="url(#winDark)" opacity=".7"/>')
    # trees in parks (drawn back to front)
    for (tx, ty) in [(5.2, 4.6), (7.0, 5.2), (6.0, 5.8), (9.9, 8.1), (11, 8.8), (10.2, 9.3)]:
        tree(s, tx, ty, .55, planter=False)
    # route
    route = [(.2, 6.9, .05), (3.9, 6.9, .05), (3.9, 3.4, .05), (8.6, 3.4, .05), (8.6, .4, .05)]
    s.path3(route, BLUE_L, 12, 'opacity=".35" filter="url(#soft2)"')
    s.path3(route, BLUE, 6)
    s.path3(route, "#FFFFFF", 2, 'class="dash" stroke-dasharray="2 10" opacity=".9"')
    # start marker
    sx, sy = s.P(*route[0])
    s.add(f'<circle class="ring" cx="{sx:.1f}" cy="{sy:.1f}" r="13" fill="none" stroke="{BLUE}" stroke-width="3"/>'
          f'<circle cx="{sx:.1f}" cy="{sy:.1f}" r="13" fill="#FFFFFF" stroke="{BLUE}" stroke-width="5"/>'
          f'<circle cx="{sx:.1f}" cy="{sy:.1f}" r="4" fill="{BLUE}"/>')
    # bike on route
    # the rider drives the whole route (keyframes proportional to segment length)
    bx, by = 6.2, 3.4
    seg = [math.dist(a[:2], b[:2]) for a, b in zip(route, route[1:])]
    total, acc = sum(seg), 0.0
    frames = [(0, (route[0][0] - bx, route[0][1] - by, 0), 0), (3, (route[0][0] - bx, route[0][1] - by, 0), 1)]
    for pt, ln in zip(route[1:], seg):
        acc += ln
        frames.append((round(3 + 90 * acc / total, 2), (pt[0] - bx, pt[1] - by, 0), 1))
    frames.append((100, (route[-1][0] - bx, route[-1][1] - by, 0), 0))
    s.keyframes("ride", frames, 10)
    s.group("ride")
    bike(s, bx, by, .42, lights=False)
    s.end()
    # destination pin (screen space)
    px, py = s.P(8.6, .4, 0)
    s.add('<g class="float" style="animation-duration:1.8s">')
    s.add(f'<ellipse cx="{px:.1f}" cy="{py:.1f}" rx="16" ry="7" fill="#0B2A5B" opacity=".25" filter="url(#soft2)"/>'
          f'<path d="M{px:.1f},{py - 4:.1f} C{px - 8:.1f},{py - 26:.1f} {px - 30:.1f},{py - 40:.1f} {px - 30:.1f},{py - 64:.1f} '
          f'A30,30 0 1 1 {px + 30:.1f},{py - 64:.1f} C{px + 30:.1f},{py - 40:.1f} {px + 8:.1f},{py - 26:.1f} {px:.1f},{py - 4:.1f} Z" '
          f'fill="{BLUE}"/><circle cx="{px:.1f}" cy="{py - 64:.1f}" r="12" fill="#FFFFFF"/>')
    s.add('</g>')
    return s.render(r)


def card_scene(W=420, H=300, ox=205, oy=150, k=44):
    s = Scene(W, H, ox, oy, k)
    d, r = bg_rect(W, H, "#F6F8FC", "#E6EDF8")
    s.defs.append(d)
    return s, r


def svc_food():
    s, r = card_scene()
    s.cylinder(.8, .8, 0, 2.3, .25, tc("#D5DDEA"), tc("#FFFFFE"))
    s.group("float")
    # takeaway bag
    s.box_shadow(-.3, -.1, 1.5, 1.0, 1.9, .16, .6)
    s.box(-.3, -.1, .25, 1.5, 1.0, 1.9, "#B98450", "url(#kraftL)", "url(#kraftR)")
    s.poly([(-.3, .9, 2.15), (1.2, .9, 2.15), (1.2, .9, 2.35), (-.3, .9, 2.35)], "#E8C79C")
    s.face("L", (-.3, .9, 2.15), f'<path d="M45,0 C45,-55 105,-55 105,0" fill="none" stroke="#8C5E33" stroke-width="7"/>')
    s.face("L", (0, .9, 1.55), f'<circle cx="45" cy="38" r="38" fill="{BLUE}"/>'
                              f'<image href="{ICON_WHITE}" x="27" y="17" width="38" height="{38 * ICON_RATIO:.0f}"/>')
    # cup
    s.cylinder(1.7, 1.5, .25, .42, 1.3, "#FFFFFF", "#EEF2F8")
    s.cylinder(1.7, 1.5, .8, .43, .35, BLUE, BLUE_L)
    s.cylinder(1.7, 1.5, 1.55, .46, .1, "#DCE3EE", "#F5F7FB")
    s.line((1.75, 1.45, 1.65), (1.95, 1.3, 2.4), BLUE_D, 5)
    # burger box
    parcel(s, .15, 1.4, .25, 1.0, .9, .45, label=False, shadow=False)
    s.end()
    return s.render(r)


def svc_parcel():
    s, r = card_scene()
    s.cylinder(.8, .8, 0, 2.3, .25, tc("#D5DDEA"), tc("#FFFFFE"))
    s.group("float")
    x, y, w, d, h = -.2, -.1, 1.6, 1.4, 1.1
    X, Y, Z = x + w, y + d, .25 + h
    s.box_shadow(x, y, w, d, h, .16, .7)
    s.poly([(x, y, Z), (X, y, Z), (X, y - .45, Z + .75), (x, y - .45, Z + .75)], "#D9AE7C")
    s.poly([(x, y, Z), (x, Y, Z), (x - .45, Y, Z + .75), (x - .45, y, Z + .75)], "#CFA06D")
    s.box(x, y, .25, w, d, h, "#8E6238", "url(#kraftL)", "url(#kraftR)")
    s.poly([(x, Y, Z), (X, Y, Z), (X, Y + .5, Z + .55), (x, Y + .5, Z + .55)], "#EACB9F")
    s.poly([(X, y, Z), (X, Y, Z), (X + .5, Y, Z + .55), (X + .5, y, Z + .55)], "#D7AA75")
    s.face("L", (x + .25, Y, .25 + h * .6), f'<rect width="46" height="34" rx="4" fill="{BLUE}"/>'
                                            f'<image href="{ICON_WHITE}" x="13" y="6" width="20" height="{20 * ICON_RATIO:.0f}"/>')
    # envelope
    s.box(1.1, 1.6, .25, 1.2, .8, .06, "#FFFFFF", "#E1E7F0", "#CFD8E5")
    s.poly([(1.1, 1.6, .32), (2.3, 1.6, .32), (1.7, 2.0, .32)], BLUE_L)
    s.end()
    return s.render(r)


def svc_scheduled():
    s, r = card_scene()
    s.cylinder(.8, .8, 0, 2.3, .25, tc("#D5DDEA"), tc("#FFFFFE"))
    s.group("float")
    # calendar standing, big face = R (x=const)
    s.box_shadow(0, -.3, .3, 2.0, 2.1, .14, .5)
    s.box(0, -.3, .25, .3, 2.0, 2.1, "#FFFFFF", "#E1E7F0", "#FFFFFF")
    grid = "".join(f'<rect x="{18 + (i % 5) * 34}" y="{72 + (i // 5) * 34}" width="24" height="22" rx="4" '
                   f'fill="{BLUE if i == 8 else tc("#E3EAF5")}"/>' for i in range(20))
    s.face("R", (.3, 1.7, 2.35), f'<rect width="200" height="52" fill="{BLUE}"/>'
                                 f'<circle cx="55" cy="0" r="8" fill="{NAVY}"/><circle cx="145" cy="0" r="8" fill="{NAVY}"/>'
                                 f'<text x="100" y="36" text-anchor="middle" font-family="{FONT}" font-size="24" '
                                 f'font-weight="600" fill="#FFFFFF">SAT</text>{grid}')
    # clock on L plane
    s.face("L", (1.0, 2.05, 2.0), '<circle cx="50" cy="50" r="52" fill="#C9D3E1"/>')
    s.face("L", (1.0, 2.15, 2.0), f'<circle cx="50" cy="50" r="50" fill="#FFFFFF" stroke="{BLUE}" stroke-width="7"/>'
                                  f'<path d="M50,50 V20 M50,50 L70,60" stroke="{NAVY}" stroke-width="6" stroke-linecap="round"/>'
                                  f'<circle cx="50" cy="50" r="5" fill="{BLUE}"/>')
    parcel(s, 1.1, .1, .25, .9, .9, .7, shadow=False)
    s.end()
    return s.render(r)


def svc_business():
    s, r = card_scene()
    s.cylinder(.8, .8, 0, 2.3, .25, tc("#D5DDEA"), tc("#FFFFFE"))
    s.group("float")
    s.box_shadow(-.2, -.2, 2.2, 2.2, 2, .16, .5)
    for i in range(4):  # pallet slats
        s.box(-.2, -.2 + i * .58, .25, 2.2, .45, .12, "#D9B889", "#C39A66", "#AD8452")
    s.box(-.2, -.2, .37, 2.2, 2.2, .06, "#E3C396", "#C39A66", "#AD8452")
    for (x, y, z) in [(-.1, -.1, .43), (.95, -.1, .43), (-.1, .95, .43), (.95, .95, .43),
                      (-.1, -.1, 1.23), (.95, -.1, 1.23), (-.1, .95, 1.23), (.4, .4, 2.03)]:
        parcel(s, x, y, z, .98, .98, .8, label=(z > 1.9 or y > .5), shadow=False)
    s.end()
    return s.render(r)


def join_rider():
    s, r = card_scene(520, 360, 255, 185, 54)
    s.cylinder(0, 0, 0, 2.6, .28, tc("#D5DDEA"), tc("#FFFFFE"))
    s.group("bob")
    bike(s, 0, 0, 1.0)
    s.end()
    return s.render(r)


def join_vendor():
    s, r = card_scene(520, 360, 250, 190, 42)
    s.cylinder(.9, .9, 0, 3.0, .25, tc("#D5DDEA"), tc("#FFFFFE"))
    s.group("float")
    x, y, w, d, h = -.6, -.6, 3.0, 2.4, 3.0
    s.box_shadow(x, y, w, d, h, .16, .5)
    s.box(x, y, .25, w, d, h, edge=tc("#FFFFFD"))
    Y = y + d
    s.poly([(x + .3, Y + .01, .25), (x + w - .3, Y + .01, .25), (x + w - .3, Y + .01, 1.95), (x + .3, Y + .01, 1.95)], "url(#door)")
    s.face("L", (x + .45, Y, 3.05), f'<image href="{LOGO_BLUE}" width="210" height="{210 * LOGO_RATIO:.0f}"/>')
    n = 8
    for i in range(n):  # striped awning sloping out from the wall
        u0, u1 = x + i * w / n, x + (i + 1) * w / n
        s.poly([(u0, Y, 2.4), (u1, Y, 2.4), (u1, Y + .8, 2.0), (u0, Y + .8, 2.0)], BLUE if i % 2 == 0 else "#FFFFFF")
    s.poly([(x, Y + .8, 2.0), (x + w, Y + .8, 2.0), (x + w, Y + .8, 1.85), (x, Y + .8, 1.85)], BLUE_D)
    s.box(x + .2, Y, .25, w - .4, .45, .9, tc("#FFFFFE"), "url(#wallL)", "url(#wallR)", edge=tc("#FFFFFD"))  # counter
    parcel(s, x + .5, Y + .02, 1.15, .6, .4, .4, label=False, shadow=False)
    s.cylinder(x + 1.9, Y + .22, 1.15, .18, .45, "#FFFFFF", BLUE_L)
    tree(s, 3.3, .2, .6, planter=True)
    s.end()
    return s.render(r)


def join_invest():
    s, r = card_scene(520, 360, 260, 185, 50)
    s.cylinder(0, 0, 0, 2.7, .28, tc("#D5DDEA"), tc("#FFFFFE"))
    s.group("float")
    bike(s, -.5, -.5, .95, box_color="white")
    for j, (cx, cy, n) in enumerate([(1.3, 1.2, 5), (1.9, .5, 8), (.6, 1.8, 3)]):
        for i in range(n):
            s.cylinder(cx, cy, .28 + i * .16, .38, .16, "#D99A20", "url(#gold)")
    s.end()
    return s.render(r)


def big_parcel():
    s = Scene(520, 460, 250, 210, 58)
    d, r = bg_rect(520, 460, "#F6F8FC", "#E6EDF8")
    s.defs.append(d)
    s.cylinder(.9, .9, 0, 2.6, .3, "url(#blueR)", "url(#blueT)")
    s.group("float")
    parcel(s, -.3, -.2, .3, 2.4, 2.2, 2.1, label=False, shadow=False)
    s.face("L", (-.1, 2.0, 1.95),
           f'<text x="0" y="40" font-family="{FONT}" font-size="36" font-weight="600" fill="#7A4E26" opacity=".85">Good things</text>'
           f'<text x="0" y="82" font-family="{FONT}" font-size="36" font-weight="600" fill="#7A4E26" opacity=".85">travel fast.</text>')
    s.face("R", (2.1, 1.7, 1.3), f'<image href="{LOGO_BLUE}" width="150" height="{150 * LOGO_RATIO:.0f}"/>')
    s.end()
    return s.render(r)


def cta():
    s = Scene(1400, 520, 640, -40, 44)
    s.defs.append(f'<linearGradient id="bgd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B1838"/>'
                  f'<stop offset="1" stop-color="#050B1C"/></linearGradient>'
                  f'<radialGradient id="haloD" cx=".7" cy=".6" r=".5"><stop offset="0" stop-color="{BLUE}" stop-opacity=".35"/>'
                  f'<stop offset="1" stop-color="{BLUE}" stop-opacity="0"/></radialGradient>')
    bg = '<rect width="1400" height="520" fill="url(#bgd)"/><rect width="1400" height="520" fill="url(#haloD)"/>'
    floor_grid(s, -6, 24, -6, 24, 2.0, "#1B2A4F", .8)
    s.poly([(0, 6, 0), (26, 6, 0), (26, 9.4, 0), (0, 9.4, 0)], "#141C2E")
    s.keyframes("roadflow", [(0, (0, 0, 0), 1), (100, (-2, 0, 0), 1)], 1.1)
    s.group("roadflow")
    for x in range(0, 28, 2):
        s.poly([(x, 7.63, 0), (x + 1, 7.63, 0), (x + 1, 7.77, 0), (x, 7.77, 0)], "#FFFFFF", 'opacity=".35"')
    s.end()
    for yy in (6.15, 9.25):
        s.path3([(0, yy, .02), (26, yy, .02)], BLUE_L, 3, 'filter="url(#glow)"')
    s.box(8, -1, 0, 5, 4.5, 4.2, "#1D2A4A", "#16213C", "#0F182D", edge="#2D3E66")
    s.face("L", (8.6, 3.5, 3.4), f'<image href="{LOGO_WHITE}" width="340" height="{340 * LOGO_RATIO:.0f}" opacity=".9"/>')
    s.poly([(9, 3.51, 0), (12, 3.51, 0), (12, 3.51, 2.4), (9, 3.51, 2.4)], "url(#door)")
    s.glow(10.5, 3.6, .5, 120, "glowBlue", .7)
    lamp(s, 14.5, 4.6, 4.4, warm=True)
    parcel(s, 15.6, 3.4, 0, 1.1, 1.1, .9)
    parcel(s, 16.9, 3.6, 0, .9, .9, .7)
    parcel(s, 15.9, 3.6, .9, .8, .8, .6, label=False, shadow=False)
    s.group("bob")
    bike(s, 13.2, 7.6, 1.5)
    s.end()
    lamp(s, 21.5, 4.2, 4.4)
    return s.render(bg)


def cities():
    s = Scene(1200, 720, 600, 0, 30)
    d, r = bg_rect(1200, 720, "#F7F9FD", "#E6EEFA")
    s.defs.append(d)
    rnd = random.Random(3)
    def at(sx, sy):  # world (x, y) on the ground that projects to screen (sx, sy)
        a, b = (sx - s.ox) / (C30 * s.k), (sy - s.oy) / (.5 * s.k)
        return ((a + b) / 2, (b - a) / 2)
    spots = {"Kano": at(790, 190), "Kaduna": at(640, 350), "Abuja": at(820, 530), "Lagos": at(330, 560)}
    order = sorted(spots.items(), key=lambda kv: kv[1][0] + kv[1][1])
    # routes (screen-space curves)
    links = [("Kano", "Kaduna"), ("Kaduna", "Abuja"), ("Abuja", "Lagos")]
    for a, b in links:
        (x1, y1), (x2, y2) = s.P(*spots[a], .3), s.P(*spots[b], .3)
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2 - 90
        s.add(f'<path d="M{x1:.1f},{y1:.1f} Q{mx:.1f},{my:.1f} {x2:.1f},{y2:.1f}" fill="none" stroke="{BLUE_L}" '
              f'stroke-width="10" opacity=".3" filter="url(#soft2)"/>'
              f'<path d="M{x1:.1f},{y1:.1f} Q{mx:.1f},{my:.1f} {x2:.1f},{y2:.1f}" fill="none" stroke="{BLUE}" '
              f'stroke-width="3.5" class="dash19" stroke-dasharray="10 9" stroke-linecap="round"/>')
    for name, (cx, cy) in order:
        s.cylinder(cx, cy, 0, 3.2, .5, "url(#blueR)", tc("#FFFFFE"))
        for (dx, dy, h) in sorted([(-1.2, -1.0, rnd.choice([1.5, 2.2])), (.2, -1.4, rnd.choice([2.6, 3.4])),
                                   (-1.4, .4, rnd.choice([1.2, 1.8])), (.6, .2, rnd.choice([1.6, 2.4]))],
                                  key=lambda t: t[0] + t[1]):
            s.box(cx + dx, cy + dy, .5, 1.0, 1.0, h, edge=tc("#FFFFFD"))
            s.face("L", (cx + dx + .15, cy + dy + 1.0, .5 + h - .2),
                   f'<rect width="70" height="{(h - .4) * 100:.0f}" fill="url(#win)"/>')
        tree(s, cx + 1.8, cy + 1.2, .6, planter=False)
        px, py = s.P(cx - .2, cy + 2.3, .5)
        label = name + (" · HQ" if name == "Kaduna" else "")
        w = 62 + (26 if name == "Kaduna" else 0)
        s.add(f'<g transform="translate({px:.1f},{py:.1f})">'
              f'<rect x="-{w}" y="-20" width="{2 * w}" height="40" rx="20" fill="{tc("#0A1634")}"/>'
              f'<text x="0" y="7" text-anchor="middle" font-family="{FONT}" font-size="19" font-weight="600" fill="#FFFFFF">{label}</text></g>')
    # crop to the content so the map sits centred in its frame
    return s.render(r, (160, 40, 820, 640))


def main():
    global THEME
    os.makedirs(OUT, exist_ok=True)
    scenes = {
        "hero-scene": hero, "tracking-scene": tracking, "service-food": svc_food, "service-parcel": svc_parcel,
        "service-scheduled": svc_scheduled, "service-business": svc_business, "join-rider": join_rider,
        "join-vendor": join_vendor, "join-invest": join_invest, "parcel-big": big_parcel, "cta-scene": cta,
        "cities": cities,
    }
    for THEME in ("light", "dark"):
        for name, fn in scenes.items():
            if THEME == "dark" and name == "cta-scene":
                continue
            path = os.path.join(OUT, name + ("-dark" if THEME == "dark" else "") + ".svg")
            with open(path, "w") as f:
                f.write(fn())
            print(f"{os.path.basename(path):26s} {os.path.getsize(path) // 1024:>4d} KB")


if __name__ == "__main__":
    main()
