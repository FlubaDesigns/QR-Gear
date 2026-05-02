import { useState, useEffect, useRef } from "react";
import { ArrowRight, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhoneMockupCardProps {
  qrCodeUrl: string | null;
  landingPageSnapshotUrl?: string | null;
  playMediaUrl?: string | null;
  composeImages?: string[] | null;
  qrProductType: string;
  productName?: string;
  className?: string;
}

const TYPE_GLOW: Record<string, string> = {
  "qr-basics":   "rgba(100,116,139,0.35)",
  "qr-plus":     "rgba(59,130,246,0.35)",
  "qr-canvas":   "rgba(147,51,234,0.35)",
  "qr-play":     "rgba(244,63,94,0.35)",
  "qr-dynamics": "rgba(16,185,129,0.35)",
};

const TYPE_SCAN_COLOR: Record<string, string> = {
  "qr-basics":   "#94a3b8",
  "qr-plus":     "#60a5fa",
  "qr-canvas":   "#c084fc",
  "qr-play":     "#fb7185",
  "qr-dynamics": "#34d399",
};

function PhoneFrame({
  children,
  size = "lg",
  glowColor,
  className,
}: {
  children: React.ReactNode;
  size?: "sm" | "lg";
  glowColor?: string;
  className?: string;
}) {
  const isSmall = size === "sm";
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden",
        "bg-[#0d1117] border-2 border-[#30363d]",
        isSmall ? "w-[82px] h-[162px] rounded-[22px]" : "w-[156px] h-[308px] rounded-[32px]",
        className
      )}
      style={{
        boxShadow: glowColor
          ? `0 0 32px 4px ${glowColor}, 0 20px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)`
          : "0 20px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* Side buttons */}
      <div className={cn(
        "absolute right-[-3px] bg-[#21262d] rounded-r-sm",
        isSmall ? "top-8 h-8 w-[3px]" : "top-16 h-14 w-[3px]"
      )} />
      <div className={cn(
        "absolute left-[-3px] bg-[#21262d] rounded-l-sm",
        isSmall ? "top-6 h-5 w-[3px]" : "top-12 h-10 w-[3px]"
      )} />
      <div className={cn(
        "absolute left-[-3px] bg-[#21262d] rounded-l-sm",
        isSmall ? "top-13 h-5 w-[3px]" : "top-24 h-10 w-[3px]"
      )} />

      {/* Dynamic island */}
      <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
        <div
          className="bg-black rounded-full"
          style={{ width: isSmall ? 28 : 48, height: isSmall ? 7 : 12 }}
        />
      </div>

      {/* Screen */}
      <div className="flex-1 overflow-hidden bg-black mx-[2px] mb-[2px] rounded-b-[inherit]">
        {children}
      </div>

      {/* Home indicator */}
      <div
        className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-white/25"
        style={{ width: isSmall ? 24 : 40, height: isSmall ? 3 : 4 }}
      />
    </div>
  );
}

export default function PhoneMockupCard({
  qrCodeUrl,
  landingPageSnapshotUrl,
  playMediaUrl,
  composeImages,
  qrProductType,
  productName,
  className,
}: PhoneMockupCardProps) {
  const [entered, setEntered] = useState(false);
  const [composeIndex, setComposeIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!composeImages || composeImages.length <= 1) return;
    const interval = setInterval(() => {
      setComposeIndex((i) => (i + 1) % composeImages!.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [composeImages]);

  const isPlay = qrProductType === "qr-play";
  const isCompose = qrProductType === "qr-compose";
  const glowColor = TYPE_GLOW[qrProductType] || TYPE_GLOW["qr-basics"];
  const scanColor = TYPE_SCAN_COLOR[qrProductType] || TYPE_SCAN_COLOR["qr-basics"];

  const hasDestination =
    landingPageSnapshotUrl ||
    playMediaUrl ||
    (composeImages && composeImages.length > 0);

  if (!qrCodeUrl && !hasDestination) return null;

  return (
    <div
      className={cn("relative overflow-hidden rounded-md", className)}
      style={{
        background: "linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0d1117 100%)",
        border: "1px solid #21262d",
      }}
    >
      {/* Ambient glow layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 70% 50%, ${glowColor} 0%, transparent 65%)`,
        }}
      />

      {/* Grid texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Header */}
      <div className="relative flex items-center gap-2 px-5 pt-4 pb-1">
        <ScanLine className="h-3.5 w-3.5 flex-shrink-0" style={{ color: scanColor }} />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
          Scan it — this opens
        </span>
      </div>

      {/* Phones stage */}
      <div className="relative flex items-center justify-center" style={{ height: 310 }}>

        {/* Large phone — destination (right, slightly back) */}
        {hasDestination && (
          <div
            className="absolute"
            style={{
              right: "10%",
              top: "50%",
              transform: `translateY(-50%) ${entered ? "translateX(0)" : "translateX(20px)"}`,
              opacity: entered ? 1 : 0,
              transition: "opacity 0.65s ease-out, transform 0.65s ease-out",
            }}
          >
            <PhoneFrame size="lg" glowColor={glowColor}>
              {/* Status bar */}
              <div className="flex items-center justify-between px-3 pt-1.5 pb-0.5 flex-shrink-0">
                <span className="text-[8px] font-semibold text-white/50">9:41</span>
                <div className="flex items-center gap-[3px]">
                  <div className="flex items-end gap-[1px] h-2.5">
                    {[2, 4, 6, 8, 10].map((h, i) => (
                      <div key={i} className="w-[2px] rounded-sm bg-white/50" style={{ height: h }} />
                    ))}
                  </div>
                  <svg viewBox="0 0 14 8" className="w-3 h-2 fill-white/50 ml-0.5">
                    <rect x="0" y="0" width="12" height="8" rx="2" fillOpacity={0.3} />
                    <rect x="1" y="1" width="8" height="6" rx="1" />
                    <rect x="12.5" y="2.5" width="1.5" height="3" rx="0.75" />
                  </svg>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden">
                {isPlay && playMediaUrl ? (
                  <video
                    ref={videoRef}
                    src={playMediaUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : isCompose && composeImages && composeImages.length > 0 ? (
                  <div className="relative w-full h-full">
                    {composeImages.map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt={`View ${i + 1}`}
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{
                          opacity: i === composeIndex ? 1 : 0,
                          transition: "opacity 0.7s ease-in-out",
                        }}
                      />
                    ))}
                  </div>
                ) : landingPageSnapshotUrl ? (
                  <img
                    src={landingPageSnapshotUrl}
                    alt={`${productName || "Product"} — digital experience`}
                    className="w-full h-full object-cover object-top"
                    data-testid="img-phone-destination"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#0d1117]">
                    <span className="text-white/15 text-[10px] text-center px-3 leading-relaxed">
                      Preview coming soon
                    </span>
                  </div>
                )}
              </div>
            </PhoneFrame>
          </div>
        )}

        {/* Small phone — QR code (left, front) */}
        {qrCodeUrl && (
          <div
            className="absolute z-10"
            style={{ left: "8%", top: "50%", transform: "translateY(-50%)" }}
          >
            <PhoneFrame size="sm">
              <div className="flex flex-col h-full items-center pt-2 pb-4 px-1">
                {/* Mini status */}
                <div className="flex justify-between w-full px-1 mb-1.5">
                  <span style={{ fontSize: 6, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
                    9:41
                  </span>
                  <span style={{ fontSize: 6, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
                    QR
                  </span>
                </div>

                {/* QR code box */}
                <div className="flex-1 flex items-center justify-center">
                  <div
                    className="relative overflow-hidden rounded-sm"
                    style={{ width: 54, height: 54 }}
                  >
                    <div className="absolute inset-0 bg-white rounded-sm p-1">
                      <img
                        src={qrCodeUrl}
                        alt="Scannable QR code"
                        className="w-full h-full object-contain"
                        data-testid="img-phone-qr-code"
                      />
                    </div>
                    {/* Scan line */}
                    <div
                      className="absolute left-0 right-0 h-[2px] rounded-full pointer-events-none"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${scanColor}, transparent)`,
                        animation: "qr-scan-line 1.8s ease-in-out infinite",
                        boxShadow: `0 0 6px 1px ${scanColor}`,
                      }}
                    />
                  </div>
                </div>

                <p
                  className="text-center mt-1"
                  style={{ fontSize: 6, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}
                >
                  SCAN ME
                </p>
              </div>
            </PhoneFrame>

            {/* Corner brackets — targeting indicator */}
            {["top-0 left-0 border-t-2 border-l-2 rounded-tl-sm",
              "top-0 right-0 border-t-2 border-r-2 rounded-tr-sm",
              "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-sm",
              "bottom-0 right-0 border-b-2 border-r-2 rounded-br-sm",
            ].map((cls, i) => (
              <div
                key={i}
                className={`absolute w-3 h-3 ${cls}`}
                style={{
                  borderColor: scanColor,
                  opacity: 0.6,
                  margin: -6,
                }}
              />
            ))}
          </div>
        )}

        {/* Arrow badge — floats between phones */}
        {qrCodeUrl && hasDestination && (
          <div
            className="absolute z-20 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              opacity: entered ? 1 : 0,
              transform: `translate(-50%, -50%) scale(${entered ? 1 : 0.6})`,
              transition: "opacity 0.5s ease-out 0.4s, transform 0.5s ease-out 0.4s",
            }}
          >
            <div
              className="flex items-center gap-1 rounded-full px-2.5 py-1.5 backdrop-blur-md"
              style={{
                background: "rgba(13,17,23,0.7)",
                border: `1px solid ${scanColor}40`,
                boxShadow: `0 0 12px ${scanColor}30`,
              }}
            >
              <ArrowRight className="h-3 w-3" style={{ color: scanColor }} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="relative px-5 pb-4 text-center">
        <p className="text-[10px] text-white/25 tracking-wide">
          No app needed — any phone camera works
        </p>
      </div>

      <style>{`
        @keyframes qr-scan-line {
          0%   { top: 8%; }
          50%  { top: 82%; }
          100% { top: 8%; }
        }
      `}</style>
    </div>
  );
}
