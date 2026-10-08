#!/usr/bin/env python3
"""Deterministic icon generator for VerdictLoop — pure standard library.

Draws the project mark (a consensus loop: two arrowed arc segments, an inner
dial of ticks and a check node sealing the loop) and writes every icon the
console needs, with no third-party packages and no binary inputs:

    src/app/icon.png            512x512, rounded  — App Router favicon (auto-served)
    src/app/apple-icon.png      180x180, square   — iOS home-screen icon
    src/assets/logo.png         512x512           — in-app logo (bundled import)
    public/images/logo.png      512x512           — public master
    public/images/og.png        1200x630          — social card
    public/icons/icon-192.png   192x192
    public/icons/icon-512.png   512x512
    public/favicon.ico          16/32/48 multi-size

Run:  python3 scripts/generate_icons.py
"""

import math
import os
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# ── palette (0..1 floats) ──────────────────────────────────────────────────
BG = (7 / 255, 17 / 255, 14 / 255)          # #07110e
MINT = (53 / 255, 213 / 255, 180 / 255)     # #35d5b4
MINT_DIM = tuple(BG[i] + (MINT[i] - BG[i]) * 0.45 for i in range(3))
NODE_BG = (11 / 255, 22 / 255, 19 / 255)    # #0b1613
CHECK = (251 / 255, 252 / 255, 249 / 255)   # #fbfcf9

SS = 3  # supersampling factor for antialiasing


def write_png(path: Path, width: int, height: int, pixels: bytearray) -> None:
    """Minimal RGBA8 PNG writer (filter 0, zlib level 9)."""
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = b"".join(
        b"\x00" + bytes(pixels[y * width * 4 : (y + 1) * width * 4])
        for y in range(height)
    )
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)
    print(f"  wrote {path.relative_to(ROOT)} ({width}x{height}, {len(png):,} bytes)")


class Canvas:
    def __init__(self, width: int, height: int):
        self.w = width
        self.h = height
        self.px = bytearray(width * height * 4)

    def blend(self, x: int, y: int, color, coverage: float = 1.0) -> None:
        if coverage <= 0.0 or not (0 <= x < self.w and 0 <= y < self.h):
            return
        i = (y * self.w + x) * 4
        a = min(1.0, coverage)
        self.px[i] = int(255 * (self.px[i] / 255 * (1 - a) + color[0] * a) + 0.5)
        self.px[i + 1] = int(255 * (self.px[i + 1] / 255 * (1 - a) + color[1] * a) + 0.5)
        self.px[i + 2] = int(255 * (self.px[i + 2] / 255 * (1 - a) + color[2] * a) + 0.5)
        self.px[i + 3] = 255

    def disc(self, cx: float, cy: float, r: float, color) -> None:
        x0, x1 = int(cx - r - 1), int(cx + r + 1) + 1
        y0, y1 = int(cy - r - 1), int(cy + r + 1) + 1
        for y in range(max(0, y0), min(self.h, y1)):
            for x in range(max(0, x0), min(self.w, x1)):
                d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
                cov = r + 0.5 - d  # 1px soft edge
                if cov > 0:
                    self.blend(x, y, color, cov)

    def ring_band(self, cx: float, cy: float, r: float, t: float, color,
                  arc_start: float = 0.0, arc_end: float = 360.0) -> None:
        """Annulus band, optionally limited to an angle range [deg, clockwise from +x]."""
        outer = r + t / 2
        x0, x1 = int(cx - outer - 1), int(cx + outer + 1) + 1
        y0, y1 = int(cy - outer - 1), int(cy + outer + 1) + 1
        lo, hi = r - t / 2, r + t / 2
        full = (arc_end - arc_start) >= 360.0
        for y in range(max(0, y0), min(self.h, y1)):
            for x in range(max(0, x0), min(self.w, x1)):
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                d = math.hypot(dx, dy)
                if d < lo - 0.5 or d > hi + 0.5:
                    continue
                if not full:
                    ang = math.degrees(math.atan2(dy, dx)) % 360.0
                    s = arc_start % 360.0
                    e = arc_end % 360.0
                    inside = (s <= ang < e) if s < e else (ang >= s or ang < e)
                    if not inside:
                        continue
                if lo - 0.5 <= d <= hi + 0.5:
                    self.blend(x, y, color, 1.0)

    def triangle(self, tip, b1, b2, color) -> None:
        xs = [tip[0], b1[0], b2[0]]
        ys = [tip[1], b1[1], b2[1]]
        x0, x1 = int(min(xs)) - 1, int(max(xs)) + 2
        y0, y1 = int(min(ys)) - 1, int(max(ys)) + 2

        def sign(p, a, b):
            return (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1])

        for y in range(max(0, y0), min(self.h, y1)):
            for x in range(max(0, x0), min(self.w, x1)):
                p = (x + 0.5, y + 0.5)
                d1 = sign(p, tip, b1)
                d2 = sign(p, b1, b2)
                d3 = sign(p, b2, tip)
                neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
                pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
                if not (neg and pos):
                    self.blend(x, y, color, 1.0)

    def capsule(self, p1, p2, width: float, color) -> None:
        x0, x1 = int(min(p1[0], p2[0]) - width), int(max(p1[0], p2[0]) + width) + 1
        y0, y1 = int(min(p1[1], p2[1]) - width), int(max(p1[1], p2[1]) + width) + 1
        vx, vy = p2[0] - p1[0], p2[1] - p1[1]
        seg_len2 = vx * vx + vy * vy or 1.0
        half = width / 2
        for y in range(max(0, y0), min(self.h, y1)):
            for x in range(max(0, x0), min(self.w, x1)):
                px, py = x + 0.5 - p1[0], y + 0.5 - p1[1]
                t = max(0.0, min(1.0, (px * vx + py * vy) / seg_len2))
                dx, dy = px - vx * t, py - vy * t
                d = math.hypot(dx, dy)
                cov = half + 0.5 - d
                if cov > 0:
                    self.blend(x, y, color, cov)

    def glow(self, cx: float, cy: float, radius: float, strength: float) -> None:
        x0, x1 = int(cx - radius), int(cx + radius) + 1
        y0, y1 = int(cy - radius), int(cy + radius) + 1
        for y in range(max(0, y0), min(self.h, y1)):
            for x in range(max(0, x0), min(self.w, x1)):
                d = math.hypot(x + 0.5 - cx, y + 0.5 - cy) / radius
                if d < 1.0:
                    f = (1.0 - d) ** 2 * strength
                    self.blend(x, y, (
                        BG[0] + (MINT[0] - BG[0]) * f,
                        BG[1] + (MINT[1] - BG[1]) * f,
                        BG[2] + (MINT[2] - BG[2]) * f,
                    ))

    def fill_bg(self, color=BG) -> None:
        x0 = self.w // 2
        for y in range(self.h):
            row = bytes((int(color[0] * 255), int(color[1] * 255), int(color[2] * 255), 255))
            self.px[y * self.w * 4 : y * self.w * 4 + self.w * 4] = row * self.w

    def cut_rounded_corners(self, radius: float) -> None:
        """Alpha-out everything outside a rounded-rect of `radius`."""
        w, h = self.w, self.h

        def sdf(x: float, y: float) -> float:
            qx = abs(x - w / 2) - (w / 2 - radius)
            qy = abs(y - h / 2) - (h / 2 - radius)
            ox = max(qx, 0.0)
            oy = max(qy, 0.0)
            return math.hypot(ox, oy) + min(max(qx, qy), 0.0) - radius

        for y in range(h):
            for x in range(w):
                d = sdf(x + 0.5, y + 0.5)
                if d > 0.5:
                    i = (y * w + x) * 4
                    self.px[i + 3] = 0
                elif d > -0.5:
                    i = (y * w + x) * 4
                    self.px[i + 3] = int(255 * (0.5 - d))

    def downsample(self, factor: int) -> "Canvas":
        """Box-average a factor-N supersampled canvas back to 1/N size."""
        out = Canvas(self.w // factor, self.h // factor)
        for y in range(out.h):
            for x in range(out.w):
                acc = [0, 0, 0, 0]
                for sy in range(factor):
                    for sx in range(factor):
                        i = ((y * factor + sy) * self.w + (x * factor + sx)) * 4
                        for c in range(4):
                            acc[c] += self.px[i + c]
                o = (y * out.w + x) * 4
                n = factor * factor
                for c in range(4):
                    out.px[o + c] = acc[c] // n
        return out


def paint_mark(cv: Canvas, cx: float, cy: float, unit: float) -> None:
    """Paint the consensus-loop mark centred at (cx, cy) onto an existing canvas.

    `unit` is the *unit size*: coordinates below are fractions of it, so the same
    routine serves icons and the social card without a jarring background plate.
    Only mark pixels are touched — the canvas background stays untouched.
    """
    R = unit * 0.335          # loop radius
    T = unit * 0.052          # stroke thickness
    NODE_A = -45.0            # check node sits top-right

    # inner dial ticks
    tick_r = unit * 0.262
    for k in range(24):
        a = math.radians(k * 15.0)
        cv.disc(cx + tick_r * math.cos(a), cy + tick_r * math.sin(a),
                unit * 0.0085 if k % 6 else unit * 0.012, MINT_DIM)

    # two arrowed arcs with a gap at the node; arrows lead into the node
    gap = 15.0
    arc1 = (NODE_A + gap, NODE_A + 195.0)
    arc2 = (NODE_A + 210.0, NODE_A + 345.0)
    for start, end in (arc1, arc2):
        cv.ring_band(cx, cy, R, T, MINT, start, end)
        # arrowhead at the clockwise end, pointing along the tangent
        a = math.radians(end)
        px, py = cx + R * math.cos(a), cy + R * math.sin(a)
        tx, ty = -math.sin(a), math.cos(a)          # tangent (clockwise, y-down)
        nx, ny = math.cos(a), math.sin(a)           # outward normal
        L, HW = T * 2.9, T * 1.35
        back = 0.55 * T
        cv.triangle(
            (px + tx * L - tx * back, py + ty * L - ty * back),
            (px + nx * HW - tx * back, py + ny * HW - ty * back),
            (px - nx * HW - tx * back, py - ny * HW - ty * back),
            MINT,
        )

    # check node: dark disc with mint rim, off-white check inside
    a = math.radians(NODE_A)
    ncx, ncy = cx + R * math.cos(a), cy + R * math.sin(a)
    node_r = unit * 0.082
    cv.disc(ncx, ncy, node_r * 1.18, MINT)
    cv.disc(ncx, ncy, node_r, NODE_BG)
    s = node_r
    cv.capsule((ncx - 0.42 * s, ncy + 0.02 * s), (ncx - 0.09 * s, ncy + 0.36 * s),
               0.30 * s, CHECK)
    cv.capsule((ncx - 0.09 * s, ncy + 0.36 * s), (ncx + 0.48 * s, ncy - 0.38 * s),
               0.30 * s, CHECK)


def draw_mark(size: int, rounded: bool) -> Canvas:
    """Draw the consensus-loop mark at `size` px (supersampled inside)."""
    W = size * SS
    cv = Canvas(W, W)
    cv.fill_bg()
    cv.glow(W * 0.5, W * 0.44, W * 0.52, 0.55)   # soft radial glow, slightly above centre
    paint_mark(cv, W * 0.5, W * 0.5, W)

    out = cv.downsample(SS)
    if rounded:
        out.cut_rounded_corners(size * 0.225)
    return out


def downscaled(source: Canvas, target: int) -> Canvas:
    """Nearest-free resample: shrink by integer steps then area-average."""
    src = source
    while src.w // 2 >= target * 2:
        src = src.downsample(2)
    # direct area average from src to target
    out = Canvas(target, target)
    scale = src.w / target
    for y in range(target):
        for x in range(target):
            acc = [0, 0, 0, 0]
            y0, y1 = int(y * scale), max(int((y + 1) * scale), int(y * scale) + 1)
            x0, x1 = int(x * scale), max(int((x + 1) * scale), int(x * scale) + 1)
            for sy in range(y0, min(src.h, y1)):
                for sx in range(x0, min(src.w, x1)):
                    i = (sy * src.w + sx) * 4
                    for c in range(4):
                        acc[c] += src.px[i + c]
            n = (min(src.w, x1) - x0) * (min(src.h, y1) - y0) or 1
            o = (y * target + x) * 4
            for c in range(4):
                out.px[o + c] = acc[c] // n
    return out


def draw_og(width: int = 1200, height: int = 630) -> Canvas:
    """Social card: night background, glow, big mark right of centre, dial accents."""
    scale = 2
    W, H = width * scale, height * scale
    cv = Canvas(W, H)
    cv.fill_bg()

    # faint blueprint grid
    step = 56 * scale
    grid_col = tuple(BG[i] + (MINT[i] - BG[i]) * 0.06 for i in range(3))
    for gx in range(0, W, step):
        for y in range(H):
            cv.blend(gx, y, grid_col, 0.8)
    for gy in range(0, H, step):
        for x in range(W):
            cv.blend(x, gy, grid_col, 0.8)

    cv.glow(W * 0.74, H * 0.5, H * 0.72, 0.5)

    # mark painted straight onto the background — no visible plate edges
    paint_mark(cv, W * 0.74, H * 0.5, H * 0.62)

    # three consensus tick rows on the left (dial accents)
    for k in range(3):
        yy = H * (0.5 + (k - 1) * 0.09)
        x0 = W * 0.08
        for j in range(3):
            cv.disc(x0 + j * H * 0.045, yy, H * 0.012,
                    MINT if j < k + 1 else MINT_DIM)

    return cv.downsample(scale)


def write_ico(path: Path, sizes) -> None:
    """Multi-size ICO wrapping PNG entries (valid for all modern browsers)."""
    entries = []
    blobs = []
    for size in sizes:
        mark = downscaled(draw_mark(192, rounded=False), size)
        def chunk(tag: bytes, data: bytes) -> bytes:
            return (struct.pack(">I", len(data)) + tag + data
                    + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))
        raw = b"".join(
            b"\x00" + bytes(mark.px[y * mark.w * 4 : (y + 1) * mark.w * 4])
            for y in range(mark.h)
        )
        blob = (b"\x89PNG\r\n\x1a\n"
                + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
                + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))
        entries.append((size, blob))
        blobs.append(blob)

    header = struct.pack("<HHH", 0, 1, len(entries))
    offset = 6 + 16 * len(entries)
    directory = b""
    body = b""
    for size, blob in entries:
        directory += struct.pack(
            "<BBBBHHII",
            size if size < 256 else 0, size if size < 256 else 0,
            0, 0, 1, 32, len(blob), offset,
        )
        body += blob
        offset += len(blob)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(header + directory + body)
    print(f"  wrote {path.relative_to(ROOT)} ({'/'.join(str(s) for s in sizes)}, "
          f"{len(header + directory + body):,} bytes)")


def main() -> None:
    print("VerdictLoop icon generator")
    master = draw_mark(512, rounded=True)
    master_sq = downscaled(draw_mark(512, rounded=False), 180)

    write_png(ROOT / "src/app/icon.png", 512, 512, master.px)
    write_png(ROOT / "src/app/apple-icon.png", 180, 180, master_sq.px)

    square512 = draw_mark(512, rounded=False)
    write_png(ROOT / "src/assets/logo.png", 512, 512, square512.px)
    write_png(ROOT / "public/images/logo.png", 512, 512, square512.px)

    write_png(ROOT / "public/icons/icon-512.png", 512, 512, downscaled(square512, 512).px)
    i192 = downscaled(square512, 192)
    write_png(ROOT / "public/icons/icon-192.png", 192, 192, i192.px)

    og = draw_og()
    write_png(ROOT / "public/images/og.png", 1200, 630, og.px)

    write_ico(ROOT / "public/favicon.ico", (16, 32, 48))
    print("done.")


if __name__ == "__main__":
    main()
