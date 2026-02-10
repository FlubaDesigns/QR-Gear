import { QrCode } from "lucide-react";
import type { TextStyleConfig } from "@/features/shared/components/TextStyleEditor";

interface TextStyleProp {
  text?: string;
  enabled?: boolean;
  fontFamily?: string;
  fontSize?: string;
  color?: string;
  verticalOffset?: number;
  horizontalOffset?: number;
}

function getMiniFont(size?: string) {
  if (size === '12px' || size === 'sm') return '10px';
  if (size === '24px' || size === 'lg') return '16px';
  if (size === '32px' || size === 'xl') return '22px';
  return '12px';
}

function getMidFont(size?: string) {
  if (size === '12px' || size === 'sm') return '12px';
  if (size === '24px' || size === 'lg') return '20px';
  if (size === '32px' || size === 'xl') return '26px';
  return '16px';
}

interface ZoneLayoutProps {
  headerText?: string;
  footerText?: string;
  headerStyle?: TextStyleProp | TextStyleConfig;
  footerStyle?: TextStyleProp | TextStyleConfig;
  qrCodeUrl?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  fontScale?: 'mini' | 'mid';
  className?: string;
}

export function ZoneLayout({
  headerText,
  footerText,
  headerStyle,
  footerStyle,
  qrCodeUrl,
  backgroundColor,
  backgroundImage,
  fontScale = 'mini',
  className = '',
}: ZoneLayoutProps) {
  const getFont = fontScale === 'mid' ? getMidFont : getMiniFont;

  return (
    <div
      className={`qr-canvas ${className}`}
      style={{
        backgroundColor: backgroundColor || undefined,
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="qr-canvas__header">
        <div className="zone-content" style={{ position: 'relative' }}>
          {headerText && (headerStyle as any)?.enabled && (
            <div
              className="max-w-full"
              style={{
                position: 'absolute',
                color: (headerStyle as any)?.color || '#ffffff',
                fontSize: getFont((headerStyle as any)?.fontSize),
                fontFamily: (headerStyle as any)?.fontFamily || 'sans-serif',
                fontWeight: 'bold',
                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                top: `${(headerStyle as any)?.verticalOffset ?? 50}%`,
                left: `${(headerStyle as any)?.horizontalOffset ?? 50}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {headerText}
            </div>
          )}
        </div>
      </div>
      <div className="qr-canvas__middle">
        <div className="qr-area bg-white rounded-lg">
          {qrCodeUrl ? (
            <img src={qrCodeUrl} alt="QR Code" />
          ) : (
            <QrCode className="w-2/3 h-2/3 text-slate-800" />
          )}
        </div>
      </div>
      <div className="qr-canvas__footer">
        <div className="zone-content" style={{ position: 'relative' }}>
          {footerText && (footerStyle as any)?.enabled && (
            <div
              className="max-w-full"
              style={{
                position: 'absolute',
                color: (footerStyle as any)?.color || '#ffffff',
                fontSize: getFont((footerStyle as any)?.fontSize),
                fontFamily: (footerStyle as any)?.fontFamily || 'sans-serif',
                fontWeight: 'bold',
                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                top: `${(footerStyle as any)?.verticalOffset ?? 50}%`,
                left: `${(footerStyle as any)?.horizontalOffset ?? 50}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {footerText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ZoneThumbnailProps {
  showHeader?: boolean;
  showFooter?: boolean;
  isSelected?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function ZoneThumbnail({
  showHeader = false,
  showFooter = false,
  isSelected = false,
  size = 'sm',
  className = '',
}: ZoneThumbnailProps) {
  const isSm = size === 'sm';
  const w = isSm ? 'w-8' : 'w-16';
  const h = isSm ? 'h-12' : 'h-20';
  const barH = isSm ? 'h-1.5' : 'h-2';

  return (
    <div
      className={`${w} ${h} rounded flex-shrink-0 qr-canvas ${
        isSelected ? 'bg-orange-900/40' : 'bg-slate-700'
      } ${className}`}
      style={{ padding: '2px' }}
    >
      <div className="qr-canvas__header">
        <div className="zone-content">
          {showHeader && (
            <div className={`w-full ${barH} bg-yellow-400 border border-yellow-200 rounded shadow-lg`} />
          )}
        </div>
      </div>
      <div className="qr-canvas__middle">
        <div className="qr-area bg-white/90 rounded">
          <QrCode className={`${isSm ? 'w-3 h-3' : 'w-5 h-5'} text-slate-800`} />
        </div>
      </div>
      <div className="qr-canvas__footer">
        <div className="zone-content">
          {showFooter && (
            <div className={`w-full ${barH} bg-yellow-400 border border-yellow-200 rounded shadow-lg`} />
          )}
        </div>
      </div>
    </div>
  );
}

interface DesignPreviewProps {
  headerEnabled?: boolean;
  footerEnabled?: boolean;
  headerText?: string;
  footerText?: string;
  headerFontFamily?: string;
  footerFontFamily?: string;
  headerFontSize?: string;
  footerFontSize?: string;
  className?: string;
}

export function DesignPreview({
  headerEnabled,
  footerEnabled,
  headerText,
  footerText,
  headerFontFamily = 'sans-serif',
  footerFontFamily = 'sans-serif',
  headerFontSize = '18px',
  footerFontSize = '18px',
  className = '',
}: DesignPreviewProps) {
  return (
    <div
      className={`border-2 border-dashed rounded-lg bg-white p-6 mx-auto max-w-xs ${className}`}
      style={{ aspectRatio: '2/3' }}
      data-testid="design-preview"
    >
      <div className="qr-canvas" style={{ height: '100%' }}>
        <div className="qr-canvas__header">
          <div className="zone-content">
            {headerEnabled && headerText && (
              <div
                className="text-black font-bold px-2"
                style={{
                  fontFamily: headerFontFamily,
                  fontSize: `${Math.min(parseInt(headerFontSize), 24)}px`,
                }}
              >
                {headerText}
              </div>
            )}
          </div>
        </div>
        <div className="qr-canvas__middle">
          <div className="qr-area bg-gray-200 border-2 border-gray-300 rounded">
            <div className="text-center text-gray-500 text-xs">
              <QrCode className="h-12 w-12 mx-auto mb-1 text-gray-400" />
              QR Code
            </div>
          </div>
        </div>
        <div className="qr-canvas__footer">
          <div className="zone-content">
            {footerEnabled && footerText ? (
              <div
                className="text-black font-bold px-2"
                style={{
                  fontFamily: footerFontFamily,
                  fontSize: `${Math.min(parseInt(footerFontSize), 20)}px`,
                }}
              >
                {footerText}
              </div>
            ) : !headerEnabled && !footerEnabled ? (
              <p className="text-xs text-gray-400">
                Enable text above to see preview
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PlaceholderPreviewProps {
  className?: string;
}

export function PlaceholderPreview({ className = '' }: PlaceholderPreviewProps) {
  return (
    <div className={`bg-slate-700 rounded-lg qr-canvas ${className}`}>
      <div className="qr-canvas__header" />
      <div className="qr-canvas__middle">
        <div className="qr-area bg-white/20 rounded">
          <QrCode className="w-10 h-10 text-slate-500" />
        </div>
      </div>
      <div className="qr-canvas__footer" />
    </div>
  );
}
