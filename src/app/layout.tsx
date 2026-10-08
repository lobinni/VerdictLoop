import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SITE_URL } from "@/lib/config";
import { WalletProvider } from "@/components/WalletProvider";
import "./globals.css";

/**
 * Manrope is loaded with ordinary <link> tags instead of next/font/google so
 * that production builds never fetch anything at build time — the build stays
 * deterministic everywhere, and the font simply streams at runtime with the
 * system-sans fallback until it lands.
 */
const MANROPE_CSS =
  "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap";

// Absolute metadata base: the Vercel-assigned domain of the current deployment
// when present, the configured public URL (production default) otherwise.
const siteUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : SITE_URL;

// Icons come from App Router file conventions: src/app/icon.svg (text, always
// present) plus the build-generated src/app/icon.png / apple-icon.png, and the
// social card is rendered by src/app/opengraph-image.tsx — no committed
// binary asset is ever required.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "VerdictLoop — outcomes agreed by consensus rounds",
  description:
    "VerdictLoop settles prediction markets without trusting a single announcer: independent validator rounds read the committed source page and only repeated agreement makes an outcome final.",
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "VerdictLoop — outcomes agreed by consensus rounds",
    description:
      "Independent validator rounds read the committed source page; only repeated agreement makes an outcome final.",
  },
  twitter: {
    card: "summary_large_image",
    title: "VerdictLoop — outcomes agreed by consensus rounds",
    description:
      "Independent validator rounds read the committed source page; only repeated agreement makes an outcome final.",
  },
};

export const viewport: Viewport = {
  themeColor: "#07110e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- runtime-only font loading by design */}
        <link rel="stylesheet" href={MANROPE_CSS} />
      </head>
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
