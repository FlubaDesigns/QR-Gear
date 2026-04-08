import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Package,
  QrCode,
  Eye,
  Send,
  Loader2,
  Layers,
} from "lucide-react";
import { type TextStyleConfig } from "@/features/shared/components/TextStyleEditor";
import { GraphicPreviewView } from "@/features/shared/components/skins/GraphicPreviewView";
import {
  type QRType,
  type GraphicSize,
  type PlacementOption,
  type GraphicLocation,
  type TextLayoutChoice,
  type PlacementGraphicChoice,
  type ProductItem,
  QR_TYPES,
  SHIRT_COLORS,
  getPrintAreaDims,
  GRAPHIC_CENTER,
  isSleevePlacement,
  isLeftSleevePlacement,
  isRightSleevePlacement,
  isPocketPlacement,
  isBackPlacement,
  isFrontPlacement,
} from "./wizardTypes";

export { UrlTitleStep, UrlDescriptionStep, UrlCreationStep } from "./UrlSteps";

function calculateAutoTextSize(text: string, baseSize: string, areaWidth: number): { lines: string[]; fontSize: number } {
  const sizeMap: Record<string, number> = { '12px': 7, '18px': 9, '24px': 12 };
  const baseSvgSize = sizeMap[baseSize] || 5;
  const maxCharsPerLine = 20;

  if (!text) return { lines: [''], fontSize: baseSvgSize };

  let lines: string[];
  const hasNewline = text.includes('\n');
  if (hasNewline) {
    lines = text.split('\n').slice(0, 2);
  } else if (text.length > maxCharsPerLine) {
    const mid = Math.ceil(text.length / 2);
    const spaceIdx = text.lastIndexOf(' ', mid);
    const breakAt = spaceIdx > 0 ? spaceIdx : maxCharsPerLine;
    lines = [text.slice(0, breakAt).trim(), text.slice(breakAt).trim()];
  } else {
    lines = [text];
  }

  const longestLine = Math.max(...lines.map(l => l.length), 1);
  let effectiveSize = baseSvgSize;
  if (longestLine > 8) {
    effectiveSize = baseSvgSize * Math.max(0.5, 8 / longestLine);
  }

  return { lines, fontSize: Math.round(effectiveSize * 100) / 100 };
}

export function ShirtPreviewStep({
  selectedColor,
  graphicLocation,
  graphicSize,
  headerStyle,
  footerStyle,
  textLayoutChoice,
  selectedPlacements = [],
  qrPositionX = 50,
  qrPositionY = 50,
  qrSizePercent = 75,
  areaImageUrl,
  perPlacementConfigs = {},
  graphicLayoutMode,
}: {
  selectedColor: string;
  graphicLocation: GraphicLocation;
  graphicSize: GraphicSize;
  headerStyle: TextStyleConfig;
  footerStyle: TextStyleConfig;
  textLayoutChoice: TextLayoutChoice;
  selectedPlacements?: PlacementOption[];
  qrPositionX?: number;
  qrPositionY?: number;
  qrSizePercent?: number;
  areaImageUrl?: string;
  perPlacementConfigs?: Record<PlacementOption, { graphicChoice: PlacementGraphicChoice; size: GraphicSize }>;
  graphicLayoutMode?: "zone" | "freeform";
}) {
  const colorHex = SHIRT_COLORS.find(c => c.id === selectedColor)?.hex || '#1a1a1a';
  
  const hasFrontPlacement = selectedPlacements.some(p => isFrontPlacement(p) || isPocketPlacement(p));
  const hasBackPlacement = selectedPlacements.some(p => isBackPlacement(p));
  const hasLeftSleeve = selectedPlacements.some(p => isLeftSleevePlacement(p));
  const hasRightSleeve = selectedPlacements.some(p => isRightSleevePlacement(p));
  
  const graphicDims = getPrintAreaDims('front', graphicSize);
  const isLeftChest = graphicLocation === 'left-chest';
  const graphicX = isLeftChest ? GRAPHIC_CENTER.pocket.x : GRAPHIC_CENTER.front.x;
  const graphicY = isLeftChest ? GRAPHIC_CENTER.pocket.y : GRAPHIC_CENTER.front.y;

  const getPlacementGraphicChoice = (view: 'front' | 'back'): PlacementGraphicChoice => {
    const matchingPlacement = selectedPlacements.find(p =>
      view === 'back' ? isBackPlacement(p) : (isFrontPlacement(p) || isPocketPlacement(p))
    );
    if (matchingPlacement && perPlacementConfigs[matchingPlacement]) {
      return perPlacementConfigs[matchingPlacement].graphicChoice;
    }
    return 'full';
  };

  const computeViewLayout = (viewGraphicChoice: PlacementGraphicChoice) => {
    const viewIsQrOnly = viewGraphicChoice === 'qr-only';
    const viewShowHeader = !viewIsQrOnly && (textLayoutChoice === 'header' || textLayoutChoice === 'both');
    const viewShowFooter = !viewIsQrOnly && (textLayoutChoice === 'footer' || textLayoutChoice === 'both');
    const viewHasText = !viewIsQrOnly && (textLayoutChoice === 'header' || textLayoutChoice === 'footer' || textLayoutChoice === 'both');
    const sizeRatio = qrSizePercent / 100;
    const maxQrScale = viewHasText ? 0.7 : 0.85;
    const vQrWidth = graphicDims.w * maxQrScale * sizeRatio;
    const vQrHeight = vQrWidth;
    const safeMargin = graphicDims.w * 0.03;
    const areaLeft = graphicX - graphicDims.w / 2 + safeMargin;
    const areaTop = graphicY - graphicDims.h / 2 + safeMargin;
    const areaRight = graphicX + graphicDims.w / 2 - safeMargin;
    const areaBottom = graphicY + graphicDims.h / 2 - safeMargin;
    const qrCX = areaLeft + vQrWidth / 2 + (areaRight - areaLeft - vQrWidth) * (qrPositionX / 100);
    const qrCY = areaTop + vQrHeight / 2 + (areaBottom - areaTop - vQrHeight) * (qrPositionY / 100);
    const vQrX = qrCX - vQrWidth / 2;
    const vQrY = qrCY - vQrHeight / 2;
    const hdrZoneTop = graphicY - graphicDims.h / 2 + 2;
    const hdrZoneBottom = vQrY - 2;
    const ftrZoneTop = vQrY + vQrHeight + 2;
    const ftrZoneBottom = graphicY + graphicDims.h / 2 - 2;
    const hdrAutoText = calculateAutoTextSize(headerStyle.text || '', headerStyle.fontSize || '18px', graphicDims.w);
    const ftrAutoText = calculateAutoTextSize(footerStyle.text || '', footerStyle.fontSize || '18px', graphicDims.w);
    const hdrVOff = headerStyle.verticalOffset ?? 50;
    const hdrHOff = headerStyle.horizontalOffset ?? 50;
    const hdrTextY = Math.max(hdrZoneTop + hdrAutoText.fontSize * 0.8, Math.min(hdrZoneBottom - (hdrAutoText.lines.length > 1 ? hdrAutoText.fontSize : 0), hdrZoneTop + ((hdrZoneBottom - hdrZoneTop) * (hdrVOff / 100))));
    const hdrTextX = (graphicX - graphicDims.w / 2) + (graphicDims.w * (hdrHOff / 100));
    const ftrVOff = footerStyle.verticalOffset ?? 50;
    const ftrHOff = footerStyle.horizontalOffset ?? 50;
    const ftrTextY = Math.max(ftrZoneTop + ftrAutoText.fontSize * 0.8, Math.min(ftrZoneBottom - (ftrAutoText.lines.length > 1 ? ftrAutoText.fontSize : 0), ftrZoneTop + ((ftrZoneBottom - ftrZoneTop) * (ftrVOff / 100))));
    const ftrTextX = (graphicX - graphicDims.w / 2) + (graphicDims.w * (ftrHOff / 100));
    return { viewShowHeader, viewShowFooter, vQrWidth, vQrHeight, vQrX, vQrY, hdrAutoText, ftrAutoText, hdrTextX, hdrTextY, ftrTextX, ftrTextY };
  };

  const ShirtFrontBackView = ({ view }: { view: 'front' | 'back' }) => {
    const viewChoice = getPlacementGraphicChoice(view);
    const layout = computeViewLayout(viewChoice);
    const { viewShowHeader, viewShowFooter, vQrWidth, vQrHeight, vQrX, vQrY, hdrAutoText, ftrAutoText, hdrTextX, hdrTextY, ftrTextX, ftrTextY } = layout;
    const areaX = graphicX - graphicDims.w / 2;
    const areaY = graphicY - graphicDims.h / 2;
    const pocketZoom = isLeftChest && view === 'front';
    const vb = pocketZoom ? "70 25 80 100" : "0 0 180 210";
    return (
    <svg viewBox={vb} className="w-full h-full drop-shadow-xl">
      <path
        d="M30,52 L52,30 L75,37 L90,30 L105,37 L128,30 L150,52 L142,82 L127,75 L127,180 L53,180 L53,75 L38,82 Z"
        fill={colorHex}
        stroke="#444"
        strokeWidth="2"
      />
      {view === 'back' && (
        <path d="M75,37 Q90,42 105,37" fill="none" stroke="#444" strokeWidth="1.5"/>
      )}
      
      <rect
        x={areaX}
        y={areaY}
        width={graphicDims.w}
        height={graphicDims.h}
        fill="rgba(255,255,255,0.06)"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="0.8"
        strokeDasharray="3,2"
        rx="1"
      />
      
      {viewShowHeader && hdrAutoText.lines.map((line, i) => (
        <text
          key={`hdr-${i}`}
          x={hdrTextX}
          y={hdrTextY + i * (hdrAutoText.fontSize + 1)}
          textAnchor="middle"
          fill={headerStyle.color || '#fff'}
          fontSize={hdrAutoText.fontSize}
          fontFamily={headerStyle.fontFamily || 'Arial'}
          fontWeight="bold"
        >
          {line}
        </text>
      ))}
      <g transform={`translate(${vQrX}, ${vQrY})`}>
        <rect width={vQrWidth} height={vQrHeight} fill="white" rx="1" />
        <rect x={vQrHeight * 0.08} y={vQrHeight * 0.08} width={vQrHeight * 0.18} height={vQrHeight * 0.18} fill="#333" />
        <rect x={vQrWidth - vQrHeight * 0.08 - vQrHeight * 0.18} y={vQrHeight * 0.08} width={vQrHeight * 0.18} height={vQrHeight * 0.18} fill="#333" />
        <rect x={vQrHeight * 0.08} y={vQrHeight - vQrHeight * 0.08 - vQrHeight * 0.18} width={vQrHeight * 0.18} height={vQrHeight * 0.18} fill="#333" />
        <rect x={vQrWidth / 2 - vQrHeight * 0.12} y={vQrHeight * 0.38} width={vQrHeight * 0.24} height={vQrHeight * 0.24} fill="#333" />
      </g>
      {viewShowFooter && ftrAutoText.lines.map((line, i) => (
        <text
          key={`ftr-${i}`}
          x={ftrTextX}
          y={ftrTextY + i * (ftrAutoText.fontSize + 1)}
          textAnchor="middle"
          fill={footerStyle.color || '#fff'}
          fontSize={ftrAutoText.fontSize}
          fontFamily={footerStyle.fontFamily || 'Arial'}
          fontWeight="bold"
        >
          {line}
        </text>
      ))}
      <text x={pocketZoom ? 110 : 90} y={pocketZoom ? 120 : 200} textAnchor="middle" fill="#9ca3af" fontSize={pocketZoom ? 7 : 10} fontWeight="bold">
        {view === 'back' ? 'BACK' : (pocketZoom ? 'LEFT CHEST' : 'FRONT')}
      </text>
    </svg>
  );
  };
  
  const LeftSleeveView = () => (
    <svg viewBox="0 0 120 160" className="w-full h-full drop-shadow-xl">
      <path d="M70,50 L70,150 L95,150 L95,50 Q82,38 70,50" fill={colorHex} stroke="#444" strokeWidth="2"/>
      <path d="M70,52 L20,65 L15,95 L22,98 L70,82" fill={colorHex} stroke="#444" strokeWidth="2"/>
      <path d="M70,50 Q62,42 70,35 Q82,28 95,35 Q103,42 95,50" fill={colorHex} stroke="#444" strokeWidth="2"/>
      <g transform="translate(32, 72) rotate(-10)">
        <rect width="16" height="16" fill="white" rx="2"/>
        <rect x="2" y="2" width="4" height="4" fill="#333"/>
        <rect x="10" y="2" width="4" height="4" fill="#333"/>
        <rect x="2" y="10" width="4" height="4" fill="#333"/>
        <rect x="6" y="6" width="4" height="4" fill="#333"/>
      </g>
      <text x="60" y="155" textAnchor="middle" fill="#9ca3af" fontSize="9" fontWeight="bold">LEFT SLEEVE</text>
    </svg>
  );
  
  const RightSleeveView = () => (
    <svg viewBox="0 0 120 160" className="w-full h-full drop-shadow-xl">
      <path d="M50,50 L50,150 L25,150 L25,50 Q38,38 50,50" fill={colorHex} stroke="#444" strokeWidth="2"/>
      <path d="M50,52 L100,65 L105,95 L98,98 L50,82" fill={colorHex} stroke="#444" strokeWidth="2"/>
      <path d="M50,50 Q58,42 50,35 Q38,28 25,35 Q17,42 25,50" fill={colorHex} stroke="#444" strokeWidth="2"/>
      <g transform="translate(72, 72) rotate(10)">
        <rect width="16" height="16" fill="white" rx="2"/>
        <rect x="2" y="2" width="4" height="4" fill="#333"/>
        <rect x="10" y="2" width="4" height="4" fill="#333"/>
        <rect x="2" y="10" width="4" height="4" fill="#333"/>
        <rect x="6" y="6" width="4" height="4" fill="#333"/>
      </g>
      <text x="60" y="155" textAnchor="middle" fill="#9ca3af" fontSize="9" fontWeight="bold">RIGHT SLEEVE</text>
    </svg>
  );
  
  const views: { id: string; component: JSX.Element }[] = [];
  if (hasFrontPlacement || (!hasBackPlacement && !hasLeftSleeve && !hasRightSleeve)) {
    views.push({ id: 'front', component: <ShirtFrontBackView view="front" /> });
  }
  if (hasBackPlacement) {
    views.push({ id: 'back', component: <ShirtFrontBackView view="back" /> });
  }
  if (hasLeftSleeve) {
    views.push({ id: 'left-sleeve', component: <LeftSleeveView /> });
  }
  if (hasRightSleeve) {
    views.push({ id: 'right-sleeve', component: <RightSleeveView /> });
  }
  
  return (
    <div className="text-center space-y-2 animate-in fade-in slide-in-from-right-5 duration-300">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Your Design Preview</h2>
        <p className="text-slate-400 text-sm">Here's how your graphic will look</p>
      </div>
      
      <div className={`flex justify-center items-start gap-2 ${views.length > 2 ? 'flex-wrap' : ''}`}>
        {views.map(view => (
          <div key={view.id} className={`${views.length === 1 ? 'w-56 h-64' : views.length === 2 ? 'w-44 h-52' : 'w-36 h-44'}`}>
            {view.component}
          </div>
        ))}
      </div>
      
      <p className="text-green-400 text-sm">Looking good! Proceed to create your URL.</p>
    </div>
  );
}

export function PhoneMockupWithQR({ 
  background, 
  headerText,
  footerText,
  headerStyle,
  footerStyle,
  qrCodeUrl
}: { 
  background: string;
  headerText?: string;
  footerText?: string;
  headerStyle?: TextStyleConfig;
  footerStyle?: TextStyleConfig;
  qrCodeUrl?: string;
}) {
  const getFontSize = (size: string) => {
    if (size === '12px' || size === 'sm') return '12px';
    if (size === '24px' || size === 'lg') return '20px';
    return '16px';
  };

  return (
    <div className="relative mx-auto" style={{ width: '180px' }}>
      <div className="relative rounded-[1.5rem] border-4 border-slate-700 bg-black overflow-hidden shadow-2xl">
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-12 h-3 bg-slate-700 rounded-full z-10" />
        <div className="aspect-[9/19] relative">
          {background && (
            <img 
              src={background} 
              alt="Background" 
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 flex flex-col">
            <div className="relative flex items-center justify-center overflow-hidden" style={{ height: '25%' }}>
              {headerText && headerStyle?.enabled && (
                <div 
                  className="absolute text-center px-1 max-w-full"
                  style={{
                    color: headerStyle.color || '#ffffff',
                    fontSize: getFontSize(headerStyle.fontSize),
                    fontFamily: headerStyle.fontFamily || 'sans-serif',
                    fontWeight: 'bold',
                    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                    top: `${headerStyle.verticalOffset ?? 50}%`,
                    left: `${1 + (headerStyle.horizontalOffset ?? 50) * 0.98}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {headerText}
                </div>
              )}
            </div>
            <div className="relative flex items-center justify-center" style={{ height: '50%' }}>
              <div style={{ width: '80%', height: '80%' }} className="bg-white rounded-lg flex items-center justify-center overflow-hidden">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="QR Code" className="w-full h-full object-contain" />
                ) : (
                  <QrCode className="w-2/3 h-2/3 text-slate-800" />
                )}
              </div>
            </div>
            <div className="relative flex items-center justify-center overflow-hidden" style={{ height: '25%' }}>
              {footerText && footerStyle?.enabled && (
                <div 
                  className="absolute text-center px-1 max-w-full"
                  style={{
                    color: footerStyle.color || '#ffffff',
                    fontSize: getFontSize(footerStyle.fontSize),
                    fontFamily: footerStyle.fontFamily || 'sans-serif',
                    fontWeight: 'bold',
                    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                    top: `${footerStyle.verticalOffset ?? 50}%`,
                    left: `${1 + (footerStyle.horizontalOffset ?? 50) * 0.98}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {footerText}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PhoneMockup({ 
  background, 
  headerText,
  footerText,
  headerStyle,
  footerStyle,
  className = ""
}: { 
  background: string;
  headerText?: string;
  footerText?: string;
  headerStyle?: TextStyleConfig;
  footerStyle?: TextStyleConfig;
  className?: string;
}) {
  const getFontSize = (size: string) => {
    if (size === '12px' || size === 'sm') return '10px';
    if (size === '24px' || size === 'lg') return '16px';
    return '12px';
  };

  return (
    <div className={`relative mx-auto ${className}`} style={{ width: '160px' }}>
      <div className="relative rounded-[1.5rem] border-4 border-slate-700 bg-black overflow-hidden shadow-2xl">
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-12 h-3 bg-slate-700 rounded-full z-10" />
        <div className="aspect-[9/19] relative">
          {background && (
            <img 
              src={background} 
              alt="Background" 
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 flex flex-col">
            <div className="relative flex items-center justify-center overflow-hidden" style={{ height: '25%' }}>
              {headerText && headerStyle?.enabled && (
                <div 
                  className="absolute text-center px-1 max-w-full"
                  style={{
                    color: headerStyle.color || '#ffffff',
                    fontSize: getFontSize(headerStyle.fontSize),
                    fontFamily: headerStyle.fontFamily || 'sans-serif',
                    fontWeight: 'bold',
                    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                    top: `${headerStyle.verticalOffset ?? 50}%`,
                    left: `${1 + (headerStyle.horizontalOffset ?? 50) * 0.98}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {headerText}
                </div>
              )}
            </div>
            <div className="relative flex items-center justify-center" style={{ height: '50%' }}>
              <div style={{ width: '80%', height: '80%' }} className="bg-white rounded-lg flex items-center justify-center">
                <QrCode className="w-2/3 h-2/3 text-slate-800" />
              </div>
            </div>
            <div className="relative flex items-center justify-center overflow-hidden" style={{ height: '25%' }}>
              {footerText && footerStyle?.enabled && (
                <div 
                  className="absolute text-center px-1 max-w-full"
                  style={{
                    color: footerStyle.color || '#ffffff',
                    fontSize: getFontSize(footerStyle.fontSize),
                    fontFamily: footerStyle.fontFamily || 'sans-serif',
                    fontWeight: 'bold',
                    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                    top: `${footerStyle.verticalOffset ?? 50}%`,
                    left: `${1 + (footerStyle.horizontalOffset ?? 50) * 0.98}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {footerText}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PreviewStep({ 
  product, 
  qrType,
  headerStyle,
  footerStyle,
  background,
  graphicLayoutMode,
}: { 
  product: ProductItem | null;
  qrType: QRType;
  headerStyle: TextStyleConfig;
  footerStyle: TextStyleConfig;
  background: string;
  graphicLayoutMode?: "zone" | "freeform";
}) {
  const showGraphicPreview = qrType === 'qr-plus' || qrType === 'qr-canvas' || qrType === 'qr-play';
  
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold text-white mb-2">Preview Your Creation</h2>
        <p className="text-slate-400">Review before publishing to your store</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-300">Product</p>
          <div className="aspect-square bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700">
            {product?.thumbnailUrl ? (
              <img 
                src={product.thumbnailUrl} 
                alt={product.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center">
                <Package className="w-16 h-16 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">{product?.name || 'No product'}</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-300">QR Graphic</p>
          <div className="flex justify-center">
            {showGraphicPreview ? (
              <GraphicPreviewView
                backgroundColor={background ? undefined : '#1a1a2e'}
                backgroundImage={background || undefined}
                headerStyle={headerStyle}
                footerStyle={footerStyle}
                showQRCode={true}
                aspectRatio="portrait"
                graphicLayoutMode={graphicLayoutMode}
              />
            ) : (
              <div className="w-48 h-48 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700">
                <QrCode className="w-16 h-16 text-slate-600" />
              </div>
            )}
          </div>
        </div>
      </div>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-400">Product</p>
              <p className="text-white font-medium">{product?.name || 'Not selected'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">QR Type</p>
              <p className="text-white font-medium">{QR_TYPES.find(t => t.id === qrType)?.label || qrType}</p>
            </div>
            {(headerStyle.enabled || footerStyle.enabled) && (
              <div>
                <p className="text-xs text-slate-400">Text Lines</p>
                <p className="text-white font-medium">
                  {[headerStyle.enabled && 'Header', footerStyle.enabled && 'Footer'].filter(Boolean).join(' + ')}
                </p>
              </div>
            )}
            {background && (
              <div>
                <p className="text-xs text-slate-400">Background</p>
                <Badge className="bg-purple-600/20 text-purple-400">Custom Image</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function PublishStep({ 
  isPublishing,
  onPublish,
  selectedChannel
}: { 
  isPublishing: boolean;
  onPublish: () => void;
  selectedChannel: { id: string; name: string } | null;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-2">Ready to Publish!</h2>
        <p className="text-slate-400">Your product will be added to your channel</p>
      </div>

      <div className="max-w-md mx-auto space-y-4">
        <div className="p-4 bg-slate-800/50 border border-slate-600 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Publishing to</p>
              <p className="text-lg font-medium text-white">{selectedChannel?.name || 'Unknown Channel'}</p>
            </div>
          </div>
        </div>

        <Button
          onClick={onPublish}
          disabled={isPublishing || !selectedChannel}
          className="w-full bg-blue-600 hover:bg-blue-700"
          data-testid="button-publish"
        >
          {isPublishing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Publishing...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Publish Item
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
