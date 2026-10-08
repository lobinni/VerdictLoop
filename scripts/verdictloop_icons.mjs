#!/usr/bin/env node
/**
 * VerdictLoop icon generator — pure Node standard library (no dependencies).
 *
 * Draws the consensus-loop mark (two arrowed arc segments, an inner dial of
 * ticks, a check node sealing the loop) and writes every PNG the console
 * needs, so deployments never depend on committed binary assets. This script
 * runs automatically from next.config.ts when the outputs are missing; it can
 * also be run directly:
 *
 *   node scripts/verdictloop_icons.mjs
 *
 * Mirrors scripts/generate_icons.py (the Python variant); both draw the same
 * geometry into the same files.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SS = 3; // supersampling for antialiasing

// ── palette (0..1) ─────────────────────────────────────────────────────────
const BG = [7 / 255, 17 / 255, 14 / 255];
const MINT = [53 / 255, 213 / 255, 180 / 255];
const MINT_DIM = BG.map((v, i) => v + (MINT[i] - v) * 0.45);
const NODE_BG = [11 / 255, 22 / 255, 19 / 255];
const CHECK = [251 / 255, 252 / 255, 249 / 255];

// ── tiny PNG writer ────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c;
}

function pngChunk(tag, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(tag, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (width * 4 + 1);
    raw[o] = 0; // filter: none
    Buffer.from(px.buffer, y * width * 4, width * 4).copy(raw, o + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function savePng(rel, width, height, px) {
  const path = join(ROOT, rel);
  mkdirSync(dirname(path), { recursive: true });
  const buf = encodePng(width, height, px);
  writeFileSync(path, buf);
  console.log(`  wrote ${rel} (${width}x${height}, ${buf.length.toLocaleString()} bytes)`);
}

// ── raster canvas ──────────────────────────────────────────────────────────
class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h * 4);
  }

  fillBg(color = BG) {
    const [r, g, b] = color.map((v) => Math.round(v * 255));
    for (let i = 0; i < this.px.length; i += 4) {
      this.px[i] = r;
      this.px[i + 1] = g;
      this.px[i + 2] = b;
      this.px[i + 3] = 255;
    }
  }

  blend(x, y, color, coverage = 1) {
    x |= 0;
    y |= 0;
    if (coverage <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const a = coverage > 1 ? 1 : coverage;
    const i = (y * this.w + x) * 4;
    this.px[i] = (this.px[i] * (1 - a) + color[0] * 255 * a + 0.5) | 0;
    this.px[i + 1] = (this.px[i + 1] * (1 - a) + color[1] * 255 * a + 0.5) | 0;
    this.px[i + 2] = (this.px[i + 2] * (1 - a) + color[2] * 255 * a + 0.5) | 0;
    this.px[i + 3] = 255;
  }

  disc(cx, cy, r, color) {
    for (let y = Math.max(0, (cy - r - 1) | 0); y < Math.min(this.h, (cy + r + 2) | 0); y++)
      for (let x = Math.max(0, (cx - r - 1) | 0); x < Math.min(this.w, (cx + r + 2) | 0); x++) {
        const cov = r + 0.5 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (cov > 0) this.blend(x, y, color, cov);
      }
  }

  ringBand(cx, cy, r, t, color, arcStart = 0, arcEnd = 360) {
    const outer = r + t / 2 + 1;
    const lo = r - t / 2;
    const hi = r + t / 2;
    const full = arcEnd - arcStart >= 360;
    const s = ((arcStart % 360) + 360) % 360;
    const e = ((arcEnd % 360) + 360) % 360;
    for (let y = Math.max(0, (cy - outer) | 0); y < Math.min(this.h, (cy + outer) | 0); y++)
      for (let x = Math.max(0, (cx - outer) | 0); x < Math.min(this.w, (cx + outer) | 0); x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d = Math.hypot(dx, dy);
        if (d < lo - 0.5 || d > hi + 0.5) continue;
        if (!full) {
          const ang = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
          const inside = s < e ? ang >= s && ang < e : ang >= s || ang < e;
          if (!inside) continue;
        }
        this.blend(x, y, color, 1);
      }
  }

  triangle(tip, b1, b2, color) {
    const sign = (p, a, b) => (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
    const x0 = Math.max(0, Math.min(tip[0], b1[0], b2[0]) | 0);
    const x1 = Math.min(this.w, (Math.max(tip[0], b1[0], b2[0]) + 2) | 0);
    const y0 = Math.max(0, Math.min(tip[1], b1[1], b2[1]) | 0);
    const y1 = Math.min(this.h, (Math.max(tip[1], b1[1], b2[1]) + 2) | 0);
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const p = [x + 0.5, y + 0.5];
        const d1 = sign(p, tip, b1);
        const d2 = sign(p, b1, b2);
        const d3 = sign(p, b2, tip);
        if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) this.blend(x, y, color, 1);
      }
  }

  capsule(p1, p2, width, color) {
    const half = width / 2;
    const vx = p2[0] - p1[0];
    const vy = p2[1] - p1[1];
    const len2 = vx * vx + vy * vy || 1;
    const x0 = Math.max(0, (Math.min(p1[0], p2[0]) - half - 1) | 0);
    const x1 = Math.min(this.w, (Math.max(p1[0], p2[0]) + half + 2) | 0);
    const y0 = Math.max(0, (Math.min(p1[1], p2[1]) - half - 1) | 0);
    const y1 = Math.min(this.h, (Math.max(p1[1], p2[1]) + half + 2) | 0);
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const px = x + 0.5 - p1[0];
        const py = y + 0.5 - p1[1];
        let t = (px * vx + py * vy) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cov = half + 0.5 - Math.hypot(px - vx * t, py - vy * t);
        if (cov > 0) this.blend(x, y, color, cov);
      }
  }

  glow(cx, cy, radius, strength) {
    for (let y = Math.max(0, (cy - radius) | 0); y < Math.min(this.h, (cy + radius + 1) | 0); y++)
      for (let x = Math.max(0, (cx - radius) | 0); x < Math.min(this.w, (cx + radius + 1) | 0); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / radius;
        if (d < 1) {
          const f = (1 - d) ** 2 * strength;
          this.blend(x, y, BG.map((v, i) => v + (MINT[i] - v) * f));
        }
      }
  }

  cutRoundedCorners(radius) {
    const { w, h } = this;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const qx = Math.abs(x + 0.5 - w / 2) - (w / 2 - radius);
        const qy = Math.abs(y + 0.5 - h / 2) - (h / 2 - radius);
        const d =
          Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
        const i = (y * w + x) * 4;
        if (d > 0.5) this.px[i + 3] = 0;
        else if (d > -0.5) this.px[i + 3] = (255 * (0.5 - d)) | 0;
      }
  }

  downsample(factor) {
    const out = new Canvas(this.w / factor, this.h / factor);
    for (let y = 0; y < out.h; y++)
      for (let x = 0; x < out.w; x++) {
        const acc = [0, 0, 0, 0];
        for (let sy = 0; sy < factor; sy++)
          for (let sx = 0; sx < factor; sx++) {
            const i = ((y * factor + sy) * this.w + x * factor + sx) * 4;
            for (let c = 0; c < 4; c++) acc[c] += this.px[i + c];
          }
        const o = (y * out.w + x) * 4;
        const n = factor * factor;
        for (let c = 0; c < 4; c++) out.px[o + c] = (acc[c] / n) | 0;
      }
    return out;
  }
}

// ── the mark ───────────────────────────────────────────────────────────────
function paintMark(cv, cx, cy, unit) {
  const R = unit * 0.335;
  const T = unit * 0.052;
  const NODE_A = -45;

  const tickR = unit * 0.262;
  for (let k = 0; k < 24; k++) {
    const a = (k * 15 * Math.PI) / 180;
    cv.disc(cx + tickR * Math.cos(a), cy + tickR * Math.sin(a), unit * (k % 6 ? 0.0085 : 0.012), MINT_DIM);
  }

  const gap = 15;
  for (const [start, end] of [
    [NODE_A + gap, NODE_A + 195],
    [NODE_A + 210, NODE_A + 345],
  ]) {
    cv.ringBand(cx, cy, R, T, MINT, start, end);
    const a = (end * Math.PI) / 180;
    const px = cx + R * Math.cos(a);
    const py = cy + R * Math.sin(a);
    const tx = -Math.sin(a);
    const ty = Math.cos(a);
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    const L = T * 2.9;
    const HW = T * 1.35;
    const back = 0.55 * T;
    cv.triangle(
      [px + tx * (L - back), py + ty * (L - back)],
      [px + nx * HW - tx * back, py + ny * HW - ty * back],
      [px - nx * HW - tx * back, py - ny * HW - ty * back],
      MINT,
    );
  }

  const a = (NODE_A * Math.PI) / 180;
  const ncx = cx + R * Math.cos(a);
  const ncy = cy + R * Math.sin(a);
  const nodeR = unit * 0.082;
  cv.disc(ncx, ncy, nodeR * 1.18, MINT);
  cv.disc(ncx, ncy, nodeR, NODE_BG);
  const s = nodeR;
  cv.capsule([ncx - 0.42 * s, ncy + 0.02 * s], [ncx - 0.09 * s, ncy + 0.36 * s], 0.3 * s, CHECK);
  cv.capsule([ncx - 0.09 * s, ncy + 0.36 * s], [ncx + 0.48 * s, ncy - 0.38 * s], 0.3 * s, CHECK);
}

function drawMark(size, rounded) {
  const W = size * SS;
  const cv = new Canvas(W, W);
  cv.fillBg();
  cv.glow(W * 0.5, W * 0.44, W * 0.52, 0.55);
  paintMark(cv, W * 0.5, W * 0.5, W);
  const out = cv.downsample(SS);
  if (rounded) out.cutRoundedCorners(size * 0.225);
  return out;
}

function resample(src, target) {
  let cur = src;
  while (cur.w / 2 >= target * 2) cur = cur.downsample(2);
  const scale = cur.w / target;
  const out = new Canvas(target, target);
  for (let y = 0; y < target; y++)
    for (let x = 0; x < target; x++) {
      const acc = [0, 0, 0, 0];
      const y0 = (y * scale) | 0;
      const y1 = Math.max((((y + 1) * scale) | 0) - 0, y0 + 1);
      const x0 = (x * scale) | 0;
      const x1 = Math.max((((x + 1) * scale) | 0) - 0, x0 + 1);
      let n = 0;
      for (let sy = y0; sy < Math.min(cur.h, y1); sy++)
        for (let sx = x0; sx < Math.min(cur.w, x1); sx++) {
          const i = (sy * cur.w + sx) * 4;
          for (let c = 0; c < 4; c++) acc[c] += cur.px[i + c];
          n++;
        }
      const o = (y * target + x) * 4;
      for (let c = 0; c < 4; c++) out.px[o + c] = (acc[c] / (n || 1)) | 0;
    }
  return out;
}

function saveIco(rel, sizes) {
  const entries = sizes.map((size) => {
    const cv = resample(drawMark(192, false), size);
    return { size, blob: encodePng(size, size, cv.px) };
  });
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let dir = Buffer.alloc(0);
  let body = Buffer.alloc(0);
  let offset = 6 + 16 * entries.length;
  for (const { size, blob } of entries) {
    const e = Buffer.alloc(16);
    e[0] = size < 256 ? size : 0;
    e[1] = e[0];
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(blob.length, 8);
    e.writeUInt32LE(offset, 12);
    dir = Buffer.concat([dir, e]);
    body = Buffer.concat([body, blob]);
    offset += blob.length;
  }
  const out = join(ROOT, rel);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.concat([header, dir, body]));
  console.log(`  wrote ${rel} (${sizes.join("/")})`);
}

// ── main ───────────────────────────────────────────────────────────────────
console.log("VerdictLoop icon generator (node)");
const master = drawMark(512, true);
savePng("src/app/icon.png", 512, 512, master.px);
savePng("src/app/apple-icon.png", 180, 180, resample(drawMark(512, false), 180).px);
const square512 = drawMark(512, false);
savePng("public/images/logo.png", 512, 512, square512.px);
savePng("public/icons/icon-512.png", 512, 512, square512.px);
savePng("public/icons/icon-192.png", 192, 192, resample(square512, 192).px);
saveIco("public/favicon.ico", [16, 32, 48]);
console.log("done.");
