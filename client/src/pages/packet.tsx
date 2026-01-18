import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, QrCode, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";

interface TextStyleConfig {
  text: string;
  enabled: boolean;
  fontFamily: string;
  fontSize: string;
  color: string;
  letterSpacing: number;
  strokeColor: string;
  strokeWidth: number;
  verticalOffset: number;
  horizontalOffset: number;
}

interface PacketData {
  id: string;
  qrOnlyUrl: string | null;
  compositeUrl: string | null;
  qrContent: string | null;
  backgroundUrl: string | null;
  headerStyle: TextStyleConfig | null;
  footerStyle: TextStyleConfig | null;
  headerText: string | null;
  footerText: string | null;
  productName: string | null;
  productImageUrl: string | null;
  pricing: {
    customerPrice: number;
  } | null;
}

function StyledText({ 
  style, 
  position 
}: { 
  style: TextStyleConfig;
  position: "top" | "bottom";
}) {
  if (!style.enabled || !style.text) return null;

  const fontSize = parseInt(style.fontSize) || 144;
  const scaledFontSize = Math.max(16, Math.min(fontSize * 0.3, 72));
  
  const verticalOffset = style.verticalOffset ?? 20;
  const horizontalOffset = style.horizontalOffset ?? 0;

  const positionStyle = position === "top" 
    ? { top: `${Math.max(2, 35 - verticalOffset * 0.33)}%` }
    : { bottom: `${Math.max(2, 35 - verticalOffset * 0.33)}%` };

  return (
    <div 
      className="absolute left-0 right-0 px-4 z-10"
      style={{
        ...positionStyle,
        transform: `translateX(${horizontalOffset * 0.5}%)`,
        textAlign: 'center',
      }}
    >
      <span 
        style={{ 
          fontFamily: style.fontFamily, 
          fontSize: `${scaledFontSize}px`,
          color: style.color,
          letterSpacing: `${style.letterSpacing * 0.1}px`,
          textShadow: style.strokeColor && style.strokeWidth > 0 
            ? `0 0 ${Math.max(2, style.strokeWidth)}px ${style.strokeColor}` 
            : "2px 2px 8px rgba(0,0,0,0.8)",
          fontWeight: 'bold',
          display: 'inline-block',
          maxWidth: '100%',
          wordBreak: 'break-word',
        }}
      >
        {style.text}
      </span>
    </div>
  );
}

export default function PacketPage() {
  const [match, params] = useRoute("/p/:id");
  const packetId = params?.id;

  const { data, isLoading, error } = useQuery<{ success: boolean; packet: PacketData }>({
    queryKey: ["/api/test/packets", packetId],
    enabled: !!packetId,
  });

  const packet = data?.packet;

  if (!match || !packetId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-gray-900 to-black">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <QrCode className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-xl font-bold mb-2">Content Not Found</h1>
            <p className="text-muted-foreground mb-4">
              The content you're looking for doesn't exist or the link is invalid.
            </p>
            <Link href="/">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (error || !packet) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-gray-900 to-black">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <QrCode className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-xl font-bold mb-2">Content Not Found</h1>
            <p className="text-muted-foreground mb-4">
              This content could not be loaded.
            </p>
            <Link href="/">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasBackground = !!packet.backgroundUrl;
  const hasHeaderStyle = packet.headerStyle?.enabled && packet.headerStyle.text;
  const hasFooterStyle = packet.footerStyle?.enabled && packet.footerStyle.text;

  return (
    <div 
      className="min-h-screen relative"
      style={{
        background: hasBackground && packet.backgroundUrl
          ? `url(${packet.backgroundUrl}) center/cover no-repeat`
          : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      }}
    >
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Header text with fancy styling */}
      {hasHeaderStyle && packet.headerStyle && (
        <StyledText style={packet.headerStyle} position="top" />
      )}

      {/* Center content area */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
        {/* Product info or QR placeholder */}
        {packet.productName && (
          <div className="text-center text-white z-10">
            <h1 className="text-3xl font-bold mb-2 drop-shadow-lg">
              {packet.productName}
            </h1>
            {packet.pricing && (
              <p className="text-xl text-white/90 drop-shadow-md">
                ${packet.pricing.customerPrice.toFixed(2)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer text with fancy styling */}
      {hasFooterStyle && packet.footerStyle && (
        <StyledText style={packet.footerStyle} position="bottom" />
      )}
    </div>
  );
}
