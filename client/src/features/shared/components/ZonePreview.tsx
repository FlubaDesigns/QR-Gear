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
      className={`flex flex-col w-full h-full relative ${className}`}
      style={{
        backgroundColor: backgroundColor || undefined,
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="relative flex items-center justify-center overflow-hidden" style={{ height: '25%' }}>
        {headerText && (headerStyle as any)?.enabled && (
          <div
            className="absolute text-center px-1 max-w-full"
            style={{
              color: (headerStyle as any)?.color || '#ffffff',
              fontSize: getFont((headerStyle as any)?.fontSize),
              fontFamily: (headerStyle as any)?.fontFamily || 'sans-serif',
              fontWeight: 'bold',
              textShadow: '0 1px 3px rgba(0,0,0,0.5)',
              top: `${(headerStyle as any)?.verticalOffset ?? 50}%`,
              left: `${1 + ((headerStyle as any)?.horizontalOffset ?? 50) * 0.98}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {headerText}
          </div>
        )}
      </div>
      <div className="relative flex items-center justify-center" style={{ height: '50%' }}>
        <div
          style={{ width: '80%', height: '80%' }}
          className="bg-white rounded-lg flex items-center justify-center overflow-hidden"
        >
          {qrCodeUrl ? (
            <img src={qrCodeUrl} alt="QR Code" className="w-full h-full object-contain" />
          ) : (
            <QrCode className="w-2/3 h-2/3 text-slate-800" />
          )}
        </div>
      </div>
      <div className="relative flex items-center justify-center overflow-hidden" style={{ height: '25%' }}>
        {footerText && (footerStyle as any)?.enabled && (
          <div
            className="absolute text-center px-1 max-w-full"
            style={{
              color: (footerStyle as any)?.color || '#ffffff',
              fontSize: getFont((footerStyle as any)?.fontSize),
              fontFamily: (footerStyle as any)?.fontFamily || 'sans-serif',
              fontWeight: 'bold',
              textShadow: '0 1px 3px rgba(0,0,0,0.5)',
              top: `${(footerStyle as any)?.verticalOffset ?? 50}%`,
              left: `${1 + ((footerStyle as any)?.horizontalOffset ?? 50) * 0.98}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {footerText}
          </div>
        )}
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
      className={`${w} ${h} rounded flex flex-col p-0.5 flex-shrink-0 ${
        isSelected ? 'bg-orange-900/40' : 'bg-slate-700'
      } ${className}`}
    >
      <div className="flex items-center justify-center" style={{ height: '25%' }}>
        {showHeader && (
          <div className={`w-full ${barH} bg-yellow-400 border border-yellow-200 rounded shadow-lg`} />
        )}
      </div>
      <div className="flex items-center justify-center" style={{ height: '50%' }}>
        <div
          className="bg-white/90 rounded flex items-center justify-center"
          style={{ width: '80%', height: '80%' }}
        >
          <QrCode className={`${isSm ? 'w-3 h-3' : 'w-5 h-5'} text-slate-800`} />
        </div>
      </div>
      <div className="flex items-center justify-center" style={{ height: '25%' }}>
        {showFooter && (
          <div className={`w-full ${barH} bg-yellow-400 border border-yellow-200 rounded shadow-lg`} />
        )}
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
      <div className="h-full flex flex-col">
        <div className="relative flex items-center justify-center overflow-hidden" style={{ height: '25%' }}>
          {headerEnabled && headerText && (
            <div
              className="text-center text-black font-bold px-2"
              style={{
                fontFamily: headerFontFamily,
                fontSize: `${Math.min(parseInt(headerFontSize), 24)}px`,
              }}
            >
              {headerText}
            </div>
          )}
        </div>
        <div className="relative flex items-center justify-center" style={{ height: '50%' }}>
          <div
            className="bg-gray-200 border-2 border-gray-300 rounded flex items-center justify-center"
            style={{ width: '80%', height: '80%' }}
          >
            <div className="text-center text-gray-500 text-xs">
              <QrCode className="h-12 w-12 mx-auto mb-1 text-gray-400" />
              QR Code
            </div>
          </div>
        </div>
        <div className="relative flex items-center justify-center overflow-hidden" style={{ height: '25%' }}>
          {footerEnabled && footerText ? (
            <div
              className="text-center text-black font-bold px-2"
              style={{
                fontFamily: footerFontFamily,
                fontSize: `${Math.min(parseInt(footerFontSize), 20)}px`,
              }}
            >
              {footerText}
            </div>
          ) : !headerEnabled && !footerEnabled ? (
            <p className="text-xs text-gray-400 text-center">
              Enable text above to see preview
            </p>
          ) : null}
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
    <div className={`bg-slate-700 rounded-lg flex flex-col ${className}`}>
      <div style={{ height: '25%' }} />
      <div className="flex items-center justify-center" style={{ height: '50%' }}>
        <div className="bg-white/20 rounded flex items-center justify-center" style={{ width: '80%', height: '80%' }}>
          <QrCode className="w-10 h-10 text-slate-500" />
        </div>
      </div>
      <div style={{ height: '25%' }} />
    </div>
  );
}
