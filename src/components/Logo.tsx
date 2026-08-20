const RINGS = [
  { r: 5.5, count: 6, dot: 1.9 },
  { r: 11, count: 12, dot: 1.7 },
  { r: 17, count: 16, dot: 1.5 },
];

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      role="img"
      aria-label="AI Chat Simulation logo"
      className="shrink-0"
    >
      <circle cx="22" cy="22" r="2.6" fill="currentColor" className="text-primary" />
      {RINGS.map((ring) =>
        Array.from({ length: ring.count }).map((_, i) => {
          const angle = (i / ring.count) * Math.PI * 2;
          return (
            <circle
              key={`${ring.r}-${i}`}
              cx={22 + Math.cos(angle) * ring.r}
              cy={22 + Math.sin(angle) * ring.r}
              r={ring.dot}
              fill="currentColor"
              className="text-primary"
            />
          );
        }),
      )}
    </svg>
  );
}
