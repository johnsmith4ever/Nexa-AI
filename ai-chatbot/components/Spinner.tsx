// 3x3 dot-grid loader. One bright dot runs around the edge and spirals into the centre,
// dragging a fading tail behind it. Black in light mode, white in dark mode (currentColor).
const SPIRAL = [0, 1, 2, 5, 8, 7, 6, 3, 4]; // grid cells (row-major) in spiral order: edge -> centre
const DURATION = 1.8; // seconds per full loop

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="status" aria-label="Loading">
      {Array.from({ length: 9 }).map((_, cell) => {
        const row = Math.floor(cell / 3);
        const col = cell % 3;
        const p = SPIRAL.indexOf(cell); // position along the spiral path
        return (
          <circle
            key={cell}
            cx={4 + col * 8}
            cy={4 + row * 8}
            r="2.2"
            fill="currentColor"
            style={{
              animation: `nexa-grid ${DURATION}s linear infinite`,
              animationDelay: `${(p / 9 - 1) * DURATION}s`,
              transformOrigin: "center",
              transformBox: "fill-box",
            }}
          />
        );
      })}
    </svg>
  );
}

// Default export for backward compatibility
export default Spinner;
