const PALETTES = [
  { skin: "#f3c9a4", hair: "#2c2018", bg: ["#fdf0ea", "#f6d9c4"] },
  { skin: "#eab98f", hair: "#241a14", bg: ["#fff2ef", "#ffe3da"] },
  { skin: "#f6d3ae", hair: "#3b2a20", bg: ["#f4ece3", "#e8d6c4"] },
  { skin: "#e9b48c", hair: "#1f1712", bg: ["#fbeadb", "#f2cdb0"] },
];

function hashId(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function TherapistAvatar({ id, src, size = 56, className }: { id: string; src?: string | null; size?: number; className?: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="Ảnh đại diện KTV" width={size} height={size} className={`object-cover ${className ?? ""}`} />
    );
  }
  const palette = PALETTES[hashId(id) % PALETTES.length];
  const bangVariant = hashId(`${id}-bang`) % 2;
  const gradientId = `avatar-grad-${id}`;

  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} role="img" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette.bg[0]} />
          <stop offset="100%" stopColor={palette.bg[1]} />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill={`url(#${gradientId})`} />
      <path d="M10 63c2-11 10-18 22-18s20 7 22 18z" fill={palette.hair} opacity="0.9" />
      <ellipse cx="32" cy="33" rx="13" ry="14" fill={palette.skin} />
      <path
        d="M14 29c0-12 8-20 18-20s18 8 18 20c0 4-1 7-2 9-1-9-5-12-16-12s-15 3-16 12c-1-2-2-5-2-9z"
        fill={palette.hair}
      />
      {bangVariant === 0 ? (
        <path d="M19 25c2-6 7-9 13-9s11 3 13 9c-3-2-8-3-13-3s-10 1-13 3z" fill={palette.hair} />
      ) : (
        <path d="M19 24c3-5 8-7 13-7s10 2 13 7c-1 2-3 3-3 3s-4-3-10-3-9 3-10 3c0 0-2-1-3-3z" fill={palette.hair} />
      )}
      <circle cx="27" cy="33" r="1.3" fill="#2c2018" />
      <circle cx="37" cy="33" r="1.3" fill="#2c2018" />
      <path d="M27.5 38.5c2 1.6 7 1.6 9 0" stroke="#a15a44" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="23.5" cy="37" r="2.1" fill="#f4a58a" opacity="0.45" />
      <circle cx="40.5" cy="37" r="2.1" fill="#f4a58a" opacity="0.45" />
    </svg>
  );
}
