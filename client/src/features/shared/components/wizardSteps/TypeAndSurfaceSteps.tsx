import { Button } from "@/components/ui/button";
import {
  QrCode,
  Type,
  ImagePlus,
  Play,
  Sparkles,
  Check,
  X,
  Smartphone,
  ArrowRight,
} from "lucide-react";
import type { QRType, GraphicLocation, GraphicSize } from "./wizardTypes";
import { SHIRT_COLORS } from "./wizardTypes";

export function TypePickerStep({ 
  selectedType, 
  onSelect 
}: { 
  selectedType: QRType;
  onSelect: (type: QRType) => void;
}) {
  const allTypes = [
    { 
      id: 'qr-basic' as QRType, 
      label: 'QR Basic', 
      description: 'Just the QR code - simple and clean',
      icon: QrCode,
      color: 'bg-slate-600'
    },
    { 
      id: 'qr-plus' as QRType, 
      label: 'QR Plus', 
      description: 'QR code with header and footer text',
      icon: Type,
      color: 'bg-blue-600'
    },
    { 
      id: 'qr-canvas' as QRType, 
      label: 'QR Canvas', 
      description: 'QR code with a custom background image',
      icon: ImagePlus,
      color: 'bg-purple-600'
    },
    { 
      id: 'qr-play' as QRType, 
      label: 'QR Play', 
      description: 'QR code that opens a video',
      icon: Play,
      color: 'bg-rose-600'
    },
    { 
      id: 'qr-compose' as QRType, 
      label: 'QR Compose', 
      description: 'Build a rotating playlist from your images & videos',
      icon: Sparkles,
      color: 'bg-amber-600'
    },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-right-5 duration-300">
      <div className="text-center mb-3">
        <h2 className="text-lg font-bold text-white mb-2">What do you want to create?</h2>
        <p className="text-slate-400">Choose the type of QR experience</p>
      </div>

      <div className="grid grid-cols-1 gap-3 max-w-md mx-auto">
        {allTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => onSelect(type.id)}
            className={`p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
              selectedType === type.id
                ? 'border-white bg-white/10'
                : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
            }`}
            data-testid={`button-type-${type.id}`}
          >
            <div className={`w-12 h-12 rounded-full ${type.color} flex items-center justify-center flex-shrink-0`}>
              <type.icon className="w-6 h-6 text-white" />
            </div>
            <div className="text-left flex-1">
              <h3 className="font-bold text-white">{type.label}</h3>
              <p className="text-slate-400 text-sm">{type.description}</p>
            </div>
            {selectedType === type.id && (
              <Check className="w-6 h-6 text-green-400 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CapabilityOverviewStep({ 
  onBasicOffRamp,
  onContinue,
  publishedMomentCount
}: { 
  onBasicOffRamp: () => void;
  onContinue: () => void;
  publishedMomentCount: number;
}) {
  const tiers = [
    { 
      label: 'QR Basic', 
      description: 'A simple QR code — points to a URL or shows text. No internet needed to scan. Perfect for basic links.',
      icon: QrCode,
      color: 'bg-slate-600',
      badge: 'Server-free',
      badgeColor: 'text-slate-300 bg-slate-500/20',
      isOffRamp: true,
    },
    { 
      label: 'QR Plus', 
      description: 'QR code with your custom header and footer text on the product. The QR connects to your living platform.',
      icon: Type,
      color: 'bg-blue-600',
      badge: 'Platform',
      badgeColor: 'text-blue-300 bg-blue-500/20',
    },
    { 
      label: 'Image Moment', 
      description: 'When someone scans, they see a custom landing page with your image, title, and description.',
      icon: ImagePlus,
      color: 'bg-purple-600',
      badge: 'Platform',
      badgeColor: 'text-purple-300 bg-purple-500/20',
    },
    { 
      label: 'Video Moment', 
      description: 'When someone scans, they watch a video you uploaded or linked.',
      icon: Play,
      color: 'bg-rose-600',
      badge: 'Platform',
      badgeColor: 'text-rose-300 bg-rose-500/20',
    },
    { 
      label: 'Compose', 
      description: 'Rotate or schedule different moments over time. One QR, many experiences.',
      icon: Sparkles,
      color: 'bg-amber-600',
      badge: publishedMomentCount >= 2 ? 'Ready' : `Needs ${2 - publishedMomentCount} more moment${2 - publishedMomentCount !== 1 ? 's' : ''}`,
      badgeColor: publishedMomentCount >= 2 ? 'text-green-300 bg-green-500/20' : 'text-amber-300 bg-amber-500/20',
      isLocked: publishedMomentCount < 2,
    },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-right-5 duration-300">
      <div className="text-center mb-4">
        <h2 className="text-lg font-bold text-white mb-2">What can your QR do?</h2>
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          Here's everything that's possible. You'll choose your experience as you build.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 max-w-md mx-auto mb-5">
        {tiers.map((tier, index) => (
          <div
            key={tier.label}
            className={`p-3 rounded-xl border transition-all flex items-center gap-3 ${
              tier.isLocked 
                ? 'border-slate-700 bg-slate-800/30 opacity-60' 
                : 'border-slate-600 bg-slate-800/50'
            }`}
            data-testid={`tier-${tier.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-700 text-slate-400 text-xs font-bold flex-shrink-0">
              {index + 1}
            </div>
            <div className={`w-10 h-10 rounded-full ${tier.color} flex items-center justify-center flex-shrink-0`}>
              <tier.icon className="w-5 h-5 text-white" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-white text-sm">{tier.label}</h3>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tier.badgeColor}`}>
                  {tier.badge}
                </span>
              </div>
              <p className="text-slate-400 text-xs leading-tight mt-0.5">{tier.description}</p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex flex-col gap-3 max-w-sm mx-auto">
        <Button
          onClick={onContinue}
          className="w-full py-5 text-lg bg-gradient-to-r from-blue-600 to-purple-600"
          data-testid="button-continue-platform"
        >
          <ArrowRight className="w-5 h-5 mr-2" />
          Continue Building
        </Button>
        <Button
          onClick={onBasicOffRamp}
          variant="outline"
          className="w-full py-4 text-slate-300 border-slate-600"
          data-testid="button-basic-offramp"
        >
          <QrCode className="w-4 h-4 mr-2" />
          I just want a basic QR code
        </Button>
      </div>
    </div>
  );
}

export function SurfacePickerStep({
  onCanvas,
  onPlay,
  onSkip,
  onCompose,
  publishedItemCount
}: {
  onCanvas: () => void;
  onPlay: () => void;
  onSkip: () => void;
  onCompose: () => void;
  publishedItemCount?: number;
}) {
  const composeReady = (publishedItemCount || 0) >= 2;
  
  return (
    <div className="text-center space-y-4 animate-in fade-in slide-in-from-right-5 duration-300">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mx-auto">
        <Smartphone className="w-7 h-7 text-white" />
      </div>
      
      <div>
        <h2 className="text-xl font-bold text-white mb-3">What Happens When They Scan?</h2>
        <p className="text-slate-300 text-sm max-w-md mx-auto">
          Choose the moment people experience when they scan your QR code
        </p>
      </div>
      
      <div className="flex flex-col gap-3 max-w-sm mx-auto pt-2">
        <Button
          onClick={onCanvas}
          className="w-full py-6 text-lg bg-gradient-to-r from-purple-600 to-blue-600"
          data-testid="button-surface-canvas"
        >
          <ImagePlus className="w-5 h-5 mr-2" />
          Image Moment
        </Button>
        <Button
          onClick={onPlay}
          className="w-full py-6 text-lg bg-gradient-to-r from-emerald-600 to-teal-600"
          data-testid="button-surface-play"
        >
          <Play className="w-5 h-5 mr-2" />
          Video Moment
        </Button>
        <Button
          onClick={onCompose}
          className={`w-full py-6 text-lg bg-gradient-to-r from-amber-600 to-orange-600`}
          data-testid="button-surface-compose"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Compose
          {!composeReady && publishedItemCount !== undefined && (
            <span className="ml-2 text-xs opacity-75">
              ({publishedItemCount}/2 moments)
            </span>
          )}
        </Button>
        <Button
          onClick={onSkip}
          variant="outline"
          className="w-full py-4 text-slate-300 border-slate-600"
          data-testid="button-surface-skip"
        >
          No thanks, just the product
        </Button>
      </div>
    </div>
  );
}

export function GenerateGraphicStep({
  selectedColor,
  graphicLocation,
  graphicSize,
  onYes,
  onNo,
  context = 'member'
}: {
  selectedColor: string;
  graphicLocation: GraphicLocation;
  graphicSize: GraphicSize;
  onYes: () => void;
  onNo: () => void;
  context?: 'member' | 'owner';
}) {
  const colorHex = SHIRT_COLORS.find(c => c.id === selectedColor)?.hex || '#1a1a1a';
  
  const getQrSize = () => {
    const sizeKey = graphicSize || 'medium';
    if (graphicLocation === 'left-chest') {
      const sizes: Record<string, number> = { small: 10, medium: 18, large: 26 };
      return sizes[sizeKey] || 18;
    }
    const sizes: Record<string, number> = { small: 25, medium: 45, large: 65 };
    return sizes[sizeKey] || 45;
  };
  
  const qrSize = getQrSize();
  
  return (
    <div className="text-center space-y-3 animate-in fade-in slide-in-from-right-5 duration-300">
      <div>
        <h2 className="text-base font-bold text-white mb-0.5">Add a Header or Footer</h2>
        <p className={`font-semibold text-sm ${context === 'owner' ? 'text-blue-400' : 'text-green-400'}`}>
          {context === 'owner' ? 'Customize your product!' : 'Make more money!'}
        </p>
      </div>
      
      {/* Shirt with $ QR $ visual cue */}
      <div className="flex justify-center">
        <svg width="140" height="165" viewBox="0 0 180 210" className="drop-shadow-lg">
          <path
            d="M30,52 L52,30 L75,37 L90,30 L105,37 L128,30 L150,52 L142,82 L127,75 L127,180 L53,180 L53,75 L38,82 Z"
            fill={colorHex}
            stroke="#444"
            strokeWidth="2"
          />
          
          {/* Header box with $ above QR */}
          {graphicLocation === 'left-chest' ? (
            <>
              <rect x={67} y={56} width={20} height={8} rx="1" fill="none" stroke="white" strokeWidth="0.8" strokeDasharray="2 1" />
              <text x={77} y={62} textAnchor="middle" fill={context === 'owner' ? '#60a5fa' : '#22c55e'} fontSize={6} fontWeight="bold">{context === 'owner' ? 'Aa' : '$'}</text>
            </>
          ) : (
            <>
              <rect x={72} y={56} width={36} height={14} rx="1" fill="none" stroke="white" strokeWidth="1" strokeDasharray="3 1.5" />
              <text x={90} y={67} textAnchor="middle" fill={context === 'owner' ? '#60a5fa' : '#22c55e'} fontSize={10} fontWeight="bold">{context === 'owner' ? 'Aa' : '$'}</text>
            </>
          )}
          
          {/* QR Code with white outline box */}
          {graphicLocation === 'left-chest' ? (
            <g transform={`translate(${77 - 5}, ${68 - 5})`}>
              <rect x={-2} y={-2} width={14} height={14} rx="1.5" fill="none" stroke="white" strokeWidth="1" />
              <rect width="10" height="10" fill="white" rx="1" />
              <rect x="1" y="1" width="2" height="2" fill="#333" />
              <rect x="7" y="1" width="2" height="2" fill="#333" />
              <rect x="1" y="7" width="2" height="2" fill="#333" />
              <rect x="4" y="4" width="2" height="2" fill="#333" />
            </g>
          ) : (
            <g transform={`translate(${90 - 8}, ${79 - 8})`}>
              <rect x={-3} y={-3} width={22} height={22} rx="2" fill="none" stroke="white" strokeWidth="1.2" />
              <rect width="16" height="16" fill="white" rx="1" />
              <rect x="1" y="1" width="3" height="3" fill="#333" />
              <rect x="12" y="1" width="3" height="3" fill="#333" />
              <rect x="1" y="12" width="3" height="3" fill="#333" />
              <rect x="6" y="6" width="4" height="4" fill="#333" />
            </g>
          )}
          
          {/* Footer box with $ below QR */}
          {graphicLocation === 'left-chest' ? (
            <>
              <rect x={67} y={78} width={20} height={8} rx="1" fill="none" stroke="white" strokeWidth="0.8" strokeDasharray="2 1" />
              <text x={77} y={84} textAnchor="middle" fill={context === 'owner' ? '#60a5fa' : '#22c55e'} fontSize={6} fontWeight="bold">{context === 'owner' ? 'Aa' : '$'}</text>
            </>
          ) : (
            <>
              <rect x={72} y={96} width={36} height={14} rx="1" fill="none" stroke="white" strokeWidth="1" strokeDasharray="3 1.5" />
              <text x={90} y={107} textAnchor="middle" fill={context === 'owner' ? '#60a5fa' : '#22c55e'} fontSize={10} fontWeight="bold">{context === 'owner' ? 'Aa' : '$'}</text>
            </>
          )}
        </svg>
      </div>
      
      <div className="flex flex-wrap justify-center gap-4">
        <Button
          onClick={onYes}
          className="px-8 py-4 bg-green-600 hover:bg-green-700 text-lg"
          data-testid="button-want-text-yes"
        >
          <Check className="w-5 h-5 mr-2" />
          Yes, add text
        </Button>
        <Button
          onClick={onNo}
          variant="outline"
          className="px-8 py-4 text-lg"
          data-testid="button-want-text-no"
        >
          <X className="w-5 h-5 mr-2" />
          No, just the QR
        </Button>
      </div>
    </div>
  );
}

export function GraphicLocationStep({
  selectedLocation,
  selectedColor,
  onSelect
}: {
  selectedLocation: GraphicLocation;
  selectedColor: string;
  onSelect: (location: GraphicLocation) => void;
}) {
  const colorHex = SHIRT_COLORS.find(c => c.id === selectedColor)?.hex || '#1a1a1a';
  
  return (
    <div className="text-center space-y-2 animate-in fade-in slide-in-from-right-5 duration-300">
      <div>
        <h2 className="text-lg font-bold text-white mb-2">Where Do You Want Your Graphic?</h2>
        <p className="text-slate-400">Tap a location to select</p>
      </div>
      
      {/* Shirt with location boxes */}
      <div className="flex justify-center">
        <svg width="120" height="140" viewBox="0 0 180 210" className="drop-shadow-lg">
          {/* Shirt shape */}
          <path
            d="M30,52 L52,30 L75,37 L90,30 L105,37 L128,30 L150,52 L142,82 L127,75 L127,180 L53,180 L53,75 L38,82 Z"
            fill={colorHex}
            stroke="#444"
            strokeWidth="2"
          />
          
          {/* Left Chest location */}
          <rect
            x="60" y="65" width="25" height="25"
            fill={selectedLocation === 'left-chest' ? '#22c55e' : '#666'}
            fillOpacity={selectedLocation === 'left-chest' ? 0.8 : 0.4}
            stroke={selectedLocation === 'left-chest' ? '#22c55e' : '#888'}
            strokeWidth="2"
            strokeDasharray={selectedLocation === 'left-chest' ? '0' : '4'}
            rx="3"
            className="cursor-pointer"
            onClick={() => onSelect('left-chest')}
          />
          
          {/* Front Center location */}
          <rect
            x="65" y="100" width="50" height="50"
            fill={selectedLocation === 'front-center' ? '#22c55e' : '#666'}
            fillOpacity={selectedLocation === 'front-center' ? 0.8 : 0.4}
            stroke={selectedLocation === 'front-center' ? '#22c55e' : '#888'}
            strokeWidth="2"
            strokeDasharray={selectedLocation === 'front-center' ? '0' : '4'}
            rx="3"
            className="cursor-pointer"
            onClick={() => onSelect('front-center')}
          />
        </svg>
      </div>
      
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={() => onSelect('left-chest')}
          className={`px-3 py-1.5 rounded-lg border-2 transition-all ${
            selectedLocation === 'left-chest'
              ? 'border-orange-500 bg-orange-500/15 text-orange-400'
              : 'border-slate-600 bg-slate-800/50 text-white hover:border-slate-400'
          }`}
          data-testid="button-location-left-chest"
        >
          Left Chest
        </button>
        <button
          onClick={() => onSelect('front-center')}
          className={`px-3 py-1.5 rounded-lg border-2 transition-all ${
            selectedLocation === 'front-center'
              ? 'border-orange-500 bg-orange-500/15 text-orange-400'
              : 'border-slate-600 bg-slate-800/50 text-white hover:border-slate-400'
          }`}
          data-testid="button-location-front-center"
        >
          Front Center
        </button>
        <button
          onClick={() => onSelect('back-center')}
          className={`px-3 py-1.5 rounded-lg border-2 transition-all ${
            selectedLocation === 'back-center'
              ? 'border-orange-500 bg-orange-500/15 text-orange-400'
              : 'border-slate-600 bg-slate-800/50 text-white hover:border-slate-400'
          }`}
          data-testid="button-location-back-center"
        >
          Back Center
        </button>
      </div>
    </div>
  );
}
