/**
 * The VerdictLoop mark as pure SVG — no image file, no bundler asset, nothing
 * to go missing from a deployment checkout. Geometry matches the generated
 * icon set (scripts/generate_icons.py / scripts/verdictloop_icons.mjs).
 */
export function LogoMark({ size = 32 }: { size?: number | string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label="VerdictLoop"
      className="shrink-0"
    >
      <defs>
        <radialGradient id="vlm-glow" cx="50%" cy="44%" r="55%">
          <stop offset="0%" stopColor="#35d5b4" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#35d5b4" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="512" height="512" rx="115" fill="#07110e" />
      <rect width="512" height="512" rx="115" fill="url(#vlm-glow)" />
      {/* inner dial of consensus ticks (24 dots on a dashed circle) */}
      <circle
        cx="256"
        cy="256"
        r="134"
        fill="none"
        stroke="#35d5b4"
        strokeOpacity="0.45"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray="0.1 34.98"
      />
      {/* two arrowed arc segments forming the loop */}
      <path
        d="M405 170 A172 172 0 0 1 107 342"
        fill="none"
        stroke="#35d5b4"
        strokeWidth="26.6"
        strokeLinecap="round"
      />
      <path
        d="M89.8 300.5 A172 172 0 0 1 422.2 211.5"
        fill="none"
        stroke="#35d5b4"
        strokeWidth="26.6"
        strokeLinecap="round"
      />
      {/* arrowheads at each arc end, aimed along the tangent */}
      <path d="M75.7 287.9 L83.2 372.7 L145.4 336.6 Z" fill="#35d5b4" />
      <path d="M438.4 271.9 L453.1 188.1 L383.7 206.7 Z" fill="#35d5b4" />
      {/* check node sealing the loop, top-right */}
      <circle cx="377.6" cy="134.4" r="49.6" fill="#35d5b4" />
      <circle cx="377.6" cy="134.4" r="42" fill="#0b1613" />
      <polyline
        points="363.3,135.1 374.5,146.6 393.9,121.5"
        fill="none"
        stroke="#fbfcf9"
        strokeWidth="10.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
