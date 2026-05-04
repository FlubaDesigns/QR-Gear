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
        {/* Q outer angular square */}
        <rect
          x="4"
          y="4"
          width="68"
          height="68"
          rx="5"
          stroke="currentColor"
          strokeWidth="7"
          fill="none"
        />
        {/* Q tail — angular diagonal, extends beyond the box */}
        <line
          x1="55"
          y1="55"
          x2="91"
          y2="91"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="square"
        />

        {/* Finder square — top left */}
        <rect
          x="16"
          y="16"
          width="17"
          height="17"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
        />
        <rect x="20.5" y="20.5" width="8" height="8" rx="1" fill="currentColor" />

        {/* Finder square — top right */}
        <rect
          x="43"
          y="16"
          width="17"
          height="17"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
        />
        <rect x="47.5" y="20.5" width="8" height="8" rx="1" fill="currentColor" />

        {/* Finder square — bottom center */}
        <rect
          x="29.5"
          y="43"
          width="17"
          height="17"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
        />
        <rect x="34" y="47.5" width="8" height="8" rx="1" fill="currentColor" />
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
