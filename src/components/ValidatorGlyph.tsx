/**
 * Abstract validator dial avatars for the hero — pure SVG, zero image files.
 * Variants share one construction grammar: a dark dial plate, an accent ring
 * with a moving tick layout and a centered geometric core. No two validators
 * look alike, and nothing ships as a binary asset.
 */

type Variant = 0 | 1 | 2 | 3;

const ACCENTS = ["#35d5b4", "#8ad8ff", "#f0a74b", "#7ce3a1"] as const;
const SOFTS = ["#35d5b455", "#8ad8ff55", "#f0a74b55", "#7ce3a155"] as const;

function ticksFor(variant: Variant): string {
  switch (variant) {
    case 0: return "0.1 52.25"; // 12 ticks
    case 1: return "0.1 26.075"; // 24 ticks
    case 2: return "26.18 26.18"; // 8 dash pairs
    default: return "0.1 104.6"; // 4 ticks
  }
}

function Core({ variant, accent }: { variant: Variant; accent: string }) {
  switch (variant) {
    case 0:
      /* consensus loop: small arc cycle + node */
      return (
        <>
          <path d="M64 35 A34 34 0 0 1 39 79" fill="none" stroke={accent} strokeWidth="6.5" strokeLinecap="round" />
          <path d="M36 75 A34 34 0 0 1 65 32" fill="none" stroke={accent} strokeOpacity="0.55" strokeWidth="6.5" strokeLinecap="round" />
          <circle cx="67.5" cy="28.5" r="8.5" fill={accent} />
          <circle cx="67.5" cy="28.5" r="5" fill="#0b1210" />
        </>
      );
    case 1:
      /* scanning eye: searching the source page */
      return (
        <>
          <ellipse cx="50" cy="52" rx="21" ry="13.5" fill="none" stroke={accent} strokeWidth="5.5" />
          <circle cx="50" cy="52" r="7" fill={accent} />
        </>
      );
    case 2:
      /* hand verdict: scales bar + base */
      return (
        <>
          <path d="M50 30 V70" stroke={accent} strokeWidth="5.5" strokeLinecap="round" />
          <path d="M32 38 H68" stroke={accent} strokeWidth="5.5" strokeLinecap="round" />
          <path d="M32 38 L25 52 A8 8 0 0 0 39 52 Z" fill={accent} />
          <path d="M68 38 L61 52 A8 8 0 0 0 75 52 Z" fill={accent} />
          <path d="M38 74 H62" stroke={accent} strokeWidth="5.5" strokeLinecap="round" />
        </>
      );
    default:
      /* seal: hex ring + check */
      return (
        <>
          <path
            d="M50 27 L72 39 V65 L50 77 L28 65 V39 Z"
            fill="none"
            stroke={accent}
            strokeWidth="6"
            strokeLinejoin="round"
          />
          <polyline
            points="40,52 47,60 62,44"
            fill="none"
            stroke={accent}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
  }
}

export function ValidatorGlyph({ variant }: { variant: Variant }) {
  const accent = ACCENTS[variant];
  const soft = SOFTS[variant];
  const isOrbit = variant === 3;
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" role="img" aria-label="validator">
      <circle cx="50" cy="50" r="50" fill="#0b1210" />
      <circle cx="50" cy="50" r="49" fill="none" stroke={soft} strokeWidth="1.5" />
      {/* dial ticks */}
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke={soft}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={ticksFor(variant)}
      />
      {/* status spark at 1 o'clock */}
      <circle cx="50" cy="10" r="4" fill={accent} />
      {isOrbit && <circle cx="90" cy="50" r="3" fill={soft} />}
      <Core variant={variant} accent={accent} />
    </svg>
  );
}
