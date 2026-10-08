import { ImageResponse } from "next/og";

/**
 * Social card rendered from pure JSX and prerendered at build time — no binary
 * image file is ever needed in the repository.
 */
export const alt = "VerdictLoop — outcomes agreed by consensus rounds";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Static so the route also exists in the STATIC_EXPORT (GitHub Pages) build.
export const dynamic = "force-static";

const W = 1200;
const H = 630;
const MINT = "#35d5b4";
const NIGHT = "#07110e";
const INK = "#f8fcf9";

// Mark geometry (unit 380 at right-centre)
const unit = 380;
const cx = 880;
const cy = 315;
const R = unit * 0.335;
const tickR = unit * 0.262;
const nodeR = unit * 0.082;
const NODE_A = (-45 * Math.PI) / 180;
const ncx = cx + R * Math.cos(NODE_A);
const ncy = cy + R * Math.sin(NODE_A);

function arrow(angleDeg: number) {
  // border-trick triangle centred on the arc end, pointing along the tangent
  const a = (angleDeg * Math.PI) / 180;
  const px = cx + R * Math.cos(a);
  const py = cy + R * Math.sin(a);
  const tangent = angleDeg + 90; // direction of travel (clockwise, y-down)
  const rotation = tangent + 90; // border-trick apex points "up" = -90deg
  return (
    <div
      key={`arrow-${angleDeg}`}
      style={{
        position: "absolute",
        left: px - 27,
        top: py - 29,
        width: 0,
        height: 0,
        borderLeft: "27px solid transparent",
        borderRight: "27px solid transparent",
        borderBottom: `58px solid ${MINT}`,
        transform: `rotate(${rotation}deg)`,
      }}
    />
  );
}

const checkBars = (() => {
  // Two rotated capsules forming the check inside the node. Coordinates are
  // relative to the node centre, scaled from the icon geometry.
  const s = nodeR / 34;
  const p0 = { x: -14.3 * s, y: 0.7 * s };
  const p1 = { x: -3.1 * s, y: 12.2 * s };
  const p2 = { x: 16.3 * s, y: -12.9 * s };
  const seg = (a: typeof p0, b: typeof p0) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    return {
      left: ncx + (a.x + b.x) / 2 - len / 2,
      top: ncy + (a.y + b.y) / 2 - 4,
      width: len,
      deg,
    };
  };
  return [seg(p0, p1), seg(p1, p2)];
})();

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          background: NIGHT,
          position: "relative",
          overflow: "hidden",
                  }}
      >
        {/* blueprint grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(#35d5b412 1px, transparent 1px), linear-gradient(90deg, #35d5b412 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        {/* glow behind the mark */}
        <div
          style={{
            position: "absolute",
            left: cx - 340,
            top: cy - 340,
            width: 680,
            height: 680,
            borderRadius: 340,
            background:
              "radial-gradient(circle, #35d5b43d 0%, transparent 62%)",
          }}
        />

        {/* ── the loop mark, drawn with absolute divs ─────────────────── */}
        {/* dial ticks */}
        {Array.from({ length: 24 }).map((_, k) => {
          const a = (k * 15 * Math.PI) / 180;
          return (
            <div
              key={k}
              style={{
                position: "absolute",
                left: cx + tickR * Math.cos(a) - 5,
                top: cy + tickR * Math.sin(a) - 5,
                width: 10,
                height: 10,
                borderRadius: 5,
                background: "#35d5b478",
              }}
            />
          );
        })}
        {/* loop ring */}
        <div
          style={{
            position: "absolute",
            left: cx - R,
            top: cy - R,
            width: R * 2,
            height: R * 2,
            borderRadius: R,
            border: `20px solid ${MINT}`,
          }}
        />
        {arrow(150)}
        {arrow(345)}
        {/* check node */}
        <div
          style={{
            position: "absolute",
            left: ncx - nodeR * 1.18,
            top: ncy - nodeR * 1.18,
            width: nodeR * 2.36,
            height: nodeR * 2.36,
            borderRadius: 99,
            background: MINT,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: ncx - nodeR,
            top: ncy - nodeR,
            width: nodeR * 2,
            height: nodeR * 2,
            borderRadius: 99,
            background: "#0b1613",
          }}
        />
        {checkBars.map((b, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: b.left,
              top: b.top,
              width: b.width,
              height: 8,
              borderRadius: 4,
              background: INK,
              transform: `rotate(${b.deg}deg)`,
            }}
          />
        ))}

        {/* ── title block ─────────────────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            left: 72,
            top: 92,
            width: 560,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "#f8fcf994",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 4,
            }}
          >
            <div style={{ width: 14, height: 14, borderRadius: 7, background: MINT }} />
            CONSENSUS-SEALED OUTCOMES
          </div>
          <div
            style={{
              marginTop: 34,
              color: INK,
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: -2,
            }}
          >
            No one announces
          </div>
          <div
            style={{
              color: MINT,
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: -2,
            }}
          >
            the outcome.
          </div>
          <div
            style={{
              marginTop: 28,
              color: "#f8fcf9a8",
              fontSize: 25,
              lineHeight: 1.5,
            }}
          >
            Prediction markets settled by repeated validator rounds reading the
            one committed source page.
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 36 }}>
            {["No admin", "One source", "Repeated agreement"].map((t) => (
              <div
                key={t}
                style={{
                  display: "flex",
                  padding: "12px 22px",
                  border: "2px solid #f8fcf92b",
                  color: "#f8fcf9cc",
                  fontSize: 21,
                  fontWeight: 700,
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
