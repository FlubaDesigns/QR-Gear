interface QRGearLogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function QRGearLogo({
  size = 32,
  showWordmark = true,
  className = "",
  style,
}: QRGearLogoProps) {
  const gap = Math.round(size * 0.28);
  const fontSize = Math.round(size * 0.42);

  return (
    <span
      className={`qr-gear-logo-mark ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: `${gap}px`,
        lineHeight: 1,
        ...style,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 96 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ display: "block", flexShrink: 0 }}
      >
        {/* Q outer angular square — slightly smaller */}
        <rect
          x="8"
          y="8"
          width="58"
          height="58"
          rx="5"
          stroke="currentColor"
          strokeWidth="6.5"
          fill="none"
        />
        {/* Q tail — angular diagonal */}
        <line
          x1="50"
          y1="50"
          x2="87"
          y2="87"
          stroke="currentColor"
          strokeWidth="6.5"
          strokeLinecap="square"
        />

        {/* Finder square — top left */}
        <rect
          x="15"
          y="15"
          width="15"
          height="15"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
        />
        <rect x="19" y="19" width="7" height="7" rx="1" fill="currentColor" />

        {/* Finder square — top right */}
        <rect
          x="44"
          y="15"
          width="15"
          height="15"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
        />
        <rect x="48" y="19" width="7" height="7" rx="1" fill="currentColor" />

        {/* Finder square — bottom center */}
        <rect
          x="29.5"
          y="44"
          width="15"
          height="15"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
        />
        <rect x="33.5" y="48" width="7" height="7" rx="1" fill="currentColor" />
      </svg>

      {showWordmark && (
        <span
          style={{
            fontFamily:
              '"Orbitron", "Eurostile", "Bank Gothic", system-ui, sans-serif',
            fontWeight: 700,
            fontSize: `${fontSize}px`,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "currentColor",
            whiteSpace: "nowrap",
          }}
        >
          QR GEAR
        </span>
      )}
    </span>
  );
}
