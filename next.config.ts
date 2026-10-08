import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import type { NextConfig } from "next";

/**
 * Icon binaries are generated, never required in the checkout.
 *
 * Some deployment pipelines drop binary assets from the repository snapshot —
 * which is precisely why the console's logo, avatar glyphs and social card are
 * pure SVG/JSX. For the few places that still need real PNG/ICO files (favicon
 * fallbacks, PWA icons, the public logo master), we regenerate them from the
 * text-based generator before the routes are scanned, whenever they are
 * missing. Pure Node standard library, ~2 seconds. Set SKIP_ICONGEN=1 to skip.
 */
const iconOutputs = [
  "src/app/icon.png",
  "src/app/apple-icon.png",
  "public/favicon.ico",
  "public/icons/icon-192.png",
  "public/images/logo.png",
];
if (
  process.env.SKIP_ICONGEN !== "1" &&
  iconOutputs.some((p) => !existsSync(p))
) {
  const r = spawnSync(process.execPath, ["scripts/verdictloop_icons.mjs"], {
    stdio: "inherit",
  });
  if (r.status !== 0) {
    console.warn(
      "[icons] generator failed — the text-only icon.svg fallback still works",
    );
  }
}

/**
 * Two build modes:
 *  - default: a normal server build (what the platform preview and Vercel run);
 *  - STATIC_EXPORT=1: a static export to `out/` for GitHub Pages publishing
 *    (used by .github/workflows/pages.yml). Static export requires
 *    unoptimized images — enabling it unconditionally keeps both modes
 *    byte-identical in behaviour.
 */
const nextConfig: NextConfig = {
  output: process.env.STATIC_EXPORT === "1" ? "export" : undefined,
  images: { unoptimized: true },
};

export default nextConfig;
