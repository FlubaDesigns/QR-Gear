import { useState } from "react";
import {
  Check,
  DollarSign,
  QrCode,
} from "lucide-react";
import {
  PlacementOption,
  PlacementGraphicChoice,
  GraphicSize,
  GraphicLocation,
  PLACEMENT_OPTIONS,
  SHIRT_COLORS,
  TextLayoutChoice,
  calculateAutoTextSize,
} from "./wizardTypes";
import { type TextStyleConfig } from "@/features/shared/components/TextStyleEditor";

export function GraphicSizeStep({
  selectedSize,
  selectedColor,
  currentPlacement,
  onSelect
}: {
  selectedSize: GraphicSize;
  selectedColor: string;
  currentPlacement: PlacementOption;
  onSelect: (size: GraphicSize) => void;
}) {
  const colorHex = SHIRT_COLORS.find(c => c.id === selectedColor)?.hex || '#1a1a1a';
  
  const getSizeOptionsForPlacement = () => {
    if (currentPlacement === 'sleeve_left' || currentPlacement === 'sleeve_right') {
      return { small: { w: 16, h: 16 }, medium: { w: 22, h: 22 }, large: { w: 28, h: 28 } };
    }
    if (currentPlacement === 'left_chest') {
      return { small: { w: 15, h: 15 }, medium: { w: 20, h: 20 }, large: { w: 25, h: 25 } };
    }
    return { small: { w: 22, h: 30 }, medium: { w: 33, h: 44 }, large: { w: 41, h: 52 } };
  };
  
  const sizeOptions = getSizeOptionsForPlacement();
  const currentSize = sizeOptions[selectedSize || 'medium'] || sizeOptions.medium;
  
  const isSleeve = currentPlacement === 'sleeve_left' || currentPlacement === 'sleeve_right';
  const isLeftSleeve = currentPlacement === 'sleeve_left';
  const isLeftChest = currentPlacement === 'left_chest';
  const isBack = currentPlacement === 'back';
  
  const renderSleeveView = () => (
    <svg width="140" height="160" viewBox="0 0 180 200" className="drop-shadow-xl">
      <path
        d={isLeftSleeve
          ? "M45,20 Q90,10 110,20 L115,140 Q90,150 40,140 Z"
          : "M70,20 Q90,10 135,20 L140,140 Q90,150 65,140 Z"
        }
        fill={colorHex}
        stroke="#444"
        strokeWidth="2"
      />
      <path
        d={isLeftSleeve
          ? "M45,20 Q90,10 110,20"
          : "M70,20 Q90,10 135,20"
        }
        fill="none"
        stroke="#555"
        strokeWidth="2"
        strokeDasharray="4 2"
      />
      <path
        d={isLeftSleeve
          ? "M40,140 Q90,150 115,140"
          : "M65,140 Q90,150 140,140"
        }
        fill="none"
        stroke="#555"
        strokeWidth="1.5"
      />
      
      <rect
        x={isLeftSleeve ? 78 - currentSize.w/2 : 103 - currentSize.w/2}
        y={80 - currentSize.h/2}
        width={currentSize.w}
        height={currentSize.h}
        fill="transparent"
        stroke="#22c55e"
        strokeWidth="2"
        strokeDasharray="4 2"
        rx="2"
      />
      <g transform={`translate(${isLeftSleeve ? 78 : 103}, 80)`}>
        <rect x={-4} y={-4} width={8} height={8} fill="white" rx="1" />
        <rect x={-3} y={-3} width={2} height={2} fill="#374151" />
        <rect x={1} y={-3} width={2} height={2} fill="#374151" />
        <rect x={-3} y={1} width={2} height={2} fill="#374151" />
      </g>
      
      <text x="90" y="190" textAnchor="middle" fill="#64748b" fontSize="10">
        {isLeftSleeve ? 'Left Sleeve' : 'Right Sleeve'}
      </text>
    </svg>
  );
  
  const renderBodyView = () => {
    const graphicX = isLeftChest ? 77 : 90;
    const graphicY = isLeftChest ? 68 : 79;
    
    return (
      <svg width="150" height="180" viewBox="0 0 180 210" className="drop-shadow-xl">
        <path
          d="M30,52 L52,30 L75,37 L90,30 L105,37 L128,30 L150,52 L142,82 L127,75 L127,180 L53,180 L53,75 L38,82 Z"
          fill={colorHex}
          stroke="#444"
          strokeWidth="2"
        />
        
        {isBack && (
          <text x="90" y="25" textAnchor="middle" fill="#64748b" fontSize="8">BACK</text>
        )}
        
        <rect
          x={graphicX - currentSize.w/2}
          y={graphicY - currentSize.h/2}
          width={currentSize.w}
          height={currentSize.h}
          fill="transparent"
          stroke="#22c55e"
          strokeWidth="1.5"
          strokeDasharray="4 2"
          rx="3"
        />
        
        <text
          x={graphicX}
          y={graphicY - currentSize.h/2 + 10}
          textAnchor="middle"
          fill="#64748b"
          fontSize={isLeftChest ? 4 : 6}
        >
          Header
        </text>
        
        <g transform={`translate(${graphicX - (isLeftChest ? 4 : 6)}, ${graphicY - (isLeftChest ? 4 : 6)})`}>
          <rect width={isLeftChest ? 8 : 12} height={isLeftChest ? 8 : 12} fill="white" rx="1" />
          <rect x="1" y="1" width={isLeftChest ? 2 : 2.5} height={isLeftChest ? 2 : 2.5} fill="#374151" />
          <rect x={isLeftChest ? 5 : 8.5} y="1" width={isLeftChest ? 2 : 2.5} height={isLeftChest ? 2 : 2.5} fill="#374151" />
          <rect x="1" y={isLeftChest ? 5 : 8.5} width={isLeftChest ? 2 : 2.5} height={isLeftChest ? 2 : 2.5} fill="#374151" />
          <rect x={isLeftChest ? 3 : 4.5} y={isLeftChest ? 3 : 4.5} width={isLeftChest ? 2 : 3} height={isLeftChest ? 2 : 3} fill="#374151" />
        </g>
        
        <text
          x={graphicX}
          y={graphicY + currentSize.h/2 - 4}
          textAnchor="middle"
          fill="#64748b"
          fontSize={isLeftChest ? 4 : 6}
        >
          Footer
        </text>
      </svg>
    );
  };
  
  const placementLabel = currentPlacement === 'front' ? 'Front' 
    : currentPlacement === 'back' ? 'Back'
    : currentPlacement === 'left_chest' ? 'Left Chest'
    : currentPlacement === 'sleeve_left' ? 'Left Sleeve'
    : currentPlacement === 'sleeve_right' ? 'Right Sleeve'
    : currentPlacement;

  return (
    <div className="text-center space-y-2 animate-in fade-in slide-in-from-right-5 duration-300">
      <div>
        <h2 className="text-base font-bold text-white mb-0.5">What Size Graphic?</h2>
        <p className="text-slate-400 text-xs">This is your entire print area</p>
      </div>
      
      <div className="flex items-center justify-center gap-3">
        <div className="flex-shrink-0">
          {isSleeve ? renderSleeveView() : renderBodyView()}
        </div>
        <div className="text-left">
          <p className="text-orange-400 font-bold text-sm">{placementLabel}</p>
          <p className="text-slate-500 text-[10px]">
            {isSleeve ? 'QR fits inside this box' : 'Header + QR + Footer fit inside'}
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-2 w-full max-w-xs mx-auto">
        {(['small', 'medium', 'large'] as GraphicSize[]).map((size) => (
          <button
            key={size}
            onClick={() => onSelect(size)}
            className={`py-2.5 rounded-lg border-2 capitalize transition-all text-sm ${
              selectedSize === size
                ? 'border-orange-500 bg-orange-500/15 text-orange-400'
                : 'border-slate-600 bg-slate-800/50 text-white hover:border-slate-400'
            }`}
            data-testid={`button-graphic-size-${size}`}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PlacementCountStep({
  selected,
  onToggle,
  selectedColor,
  placementEarningsBonus = 1.00,
  productPlacements,
  context = 'member'
}: {
  selected: PlacementOption[];
  onToggle: (placement: PlacementOption) => void;
  selectedColor: string;
  placementEarningsBonus?: number;
  productPlacements?: { id: string; title: string; widthPx?: number; heightPx?: number; widthInches?: string; heightInches?: string }[];
  context?: 'member' | 'owner';
}) {
  const [floatingEarning, setFloatingEarning] = useState<{ amount: number; key: number } | null>(null);
  const colorHex = SHIRT_COLORS.find(c => c.id === selectedColor)?.hex || '#1a1a1a';
  
  const handleToggleWithAnimation = (placement: PlacementOption) => {
    const isAdding = !selected.includes(placement);
    const willBeExtra = isAdding && selected.length >= 1;
    if (willBeExtra) {
      setFloatingEarning({ amount: placementEarningsBonus, key: Date.now() });
    }
    onToggle(placement);
  };
  
  const SUPPORTED_PLACEMENTS = ['front', 'back', 'left_chest', 'sleeve_left', 'sleeve_right'];
  
  const filteredPlacements = productPlacements && productPlacements.length > 0
    ? productPlacements
        .filter(p => SUPPORTED_PLACEMENTS.includes(p.id))
        .map(p => ({
          id: p.id as PlacementOption,
          label: p.title,
          description: 'Print area',
          sizeLabel: p.widthInches && p.heightInches ? `${p.widthInches}×${p.heightInches}` : '',
        }))
    : [];
  const displayPlacements = filteredPlacements.length > 0
    ? filteredPlacements
    : [{ id: 'front' as PlacementOption, label: 'Front Center', description: 'Print area', sizeLabel: '' }];
  
  const placementPositions: Record<string, { x: number; y: number; size: number }> = {
    'front': { x: 90, y: 100, size: 24 },
    'left_chest': { x: 70, y: 75, size: 8 },
    'back': { x: 90, y: 100, size: 24 },
    'sleeve_left': { x: 44, y: 52, size: 10 },
    'sleeve_right': { x: 136, y: 52, size: 10 },
  };
  
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-5 duration-300 relative">
      {floatingEarning && (
        <div
          key={floatingEarning.key}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none z-20"
        >
          <div className={`animate-bounce-up font-bold text-2xl flex items-center gap-1 rounded-full px-5 py-2 shadow-xl ${
            context === 'owner'
              ? 'text-blue-200 bg-blue-500/30 border-2 border-blue-400/60 shadow-blue-400/40'
              : 'text-green-200 bg-green-500/30 border-2 border-green-400/60 shadow-green-400/40'
          }`}>
            <DollarSign className="w-5 h-5" />
            +${floatingEarning.amount.toFixed(2)}
          </div>
        </div>
      )}
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-1">Where Do You Want Graphics?</h2>
        <p className="text-slate-400 text-sm">
          {context === 'owner'
            ? `First graphic is included! Each extra adds +$${placementEarningsBonus.toFixed(2)} to your cost`
            : `First graphic is included! Each extra adds +$${placementEarningsBonus.toFixed(2)}`}
        </p>
      </div>
      
      <div className="flex justify-center items-center gap-4 py-2">
        <svg width="180" height="200" viewBox="0 0 180 180" className="drop-shadow-lg">
          <path
            d="M30,52 L52,30 L75,37 L90,30 L105,37 L128,30 L150,52 L142,82 L127,75 L127,180 L53,180 L53,75 L38,82 Z"
            fill={colorHex}
            stroke="#444"
            strokeWidth="2"
          />
          
          {selected.map(placement => {
            const pos = placementPositions[placement];
            if (!pos) return null;
            const displaySize = placement === 'back' ? pos.size * 1.3 : pos.size;
            return (
              <g key={placement} transform={`translate(${pos.x - displaySize/2}, ${pos.y - displaySize/2})`}>
                <rect width={displaySize} height={displaySize} fill="white" rx="2" opacity="0.95" stroke="#22c55e" strokeWidth="2" />
                <rect x="2" y="2" width={displaySize * 0.2} height={displaySize * 0.2} fill="#22c55e" />
                <rect x={displaySize - displaySize * 0.2 - 2} y="2" width={displaySize * 0.2} height={displaySize * 0.2} fill="#22c55e" />
                <rect x="2" y={displaySize - displaySize * 0.2 - 2} width={displaySize * 0.2} height={displaySize * 0.2} fill="#22c55e" />
                {placement === 'back' && (
                  <text x={displaySize/2} y={displaySize/2 + 4} textAnchor="middle" fontSize="8" fill="#22c55e" fontWeight="bold">BACK</text>
                )}
              </g>
            );
          })}
        </svg>
        
        <div className="flex flex-col items-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold transition-all ${
            selected.length > 0 
              ? 'bg-orange-500 text-white' 
              : 'bg-slate-700 text-slate-400'
          }`}>
            {selected.length}
          </div>
          <p className="text-slate-400 text-xs mt-1">selected</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {displayPlacements.map((option) => {
          const isSelected = selected.includes(option.id as PlacementOption);
          return (
            <button
              key={option.id}
              onClick={() => handleToggleWithAnimation(option.id as PlacementOption)}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                isSelected
                  ? 'border-orange-500 bg-orange-500/15'
                  : 'border-slate-600 bg-slate-800/50 hover:border-slate-400'
              }`}
              data-testid={`button-placement-${option.id}`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                  isSelected ? 'border-orange-500 bg-orange-500' : 'border-slate-500'
                }`}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-2">
                    <p className={`font-medium text-sm ${isSelected ? 'text-orange-400' : 'text-white'}`}>
                      {option.label}
                    </p>
                    {option.sizeLabel && (
                      <span className="text-[10px] text-slate-400 bg-slate-700 px-1 py-0.5 rounded w-fit whitespace-nowrap">{option.sizeLabel}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{option.description}</p>
                </div>
              </div>
              {isSelected && (
                <div className="mt-1 ml-6">
                  {selected[0] === option.id ? (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${context === 'owner' ? 'text-blue-400 bg-blue-500/15' : 'text-green-400 bg-green-500/15'}`}>Included</span>
                  ) : (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${context === 'owner' ? 'text-blue-400 bg-blue-500/15' : 'text-green-400 bg-green-500/15'}`}>+${placementEarningsBonus.toFixed(2)}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      <p className="text-center text-slate-500 text-xs">
        {selected.length === 0 ? 'Select at least one placement' : `${selected.length} placement${selected.length > 1 ? 's' : ''} selected`}
      </p>
    </div>
  );
}

export function PlacementDiagram({ placement, size }: { placement: PlacementOption; size: GraphicSize }) {
  const sizeScale = size === 'small' ? 0.7 : size === 'large' ? 1.2 : 1;
  
  const FrontShirt = ({ highlight }: { highlight: 'center' | 'left-chest' | null }) => (
    <svg viewBox="0 0 120 140" className="w-full h-full">
      <path 
        d="M20,45 L10,55 L10,135 L110,135 L110,55 L100,45 L85,45 L75,25 C70,20 50,20 45,25 L35,45 Z" 
        fill="#374151" 
        stroke="#4b5563" 
        strokeWidth="1.5"
      />
      <path 
        d="M20,45 L5,60 L5,80 L20,75 L20,45" 
        fill="#374151" 
        stroke="#4b5563" 
        strokeWidth="1.5"
      />
      <path 
        d="M100,45 L115,60 L115,80 L100,75 L100,45" 
        fill="#374151" 
        stroke="#4b5563" 
        strokeWidth="1.5"
      />
      <ellipse cx="60" cy="28" rx="15" ry="8" fill="#1f2937" stroke="#4b5563" strokeWidth="1"/>
      
      {highlight === 'center' && (
        <g>
          <rect 
            x={60 - 20 * sizeScale} 
            y={55} 
            width={40 * sizeScale} 
            height={50 * sizeScale} 
            fill="rgba(74, 222, 128, 0.3)" 
            stroke="#4ade80" 
            strokeWidth="2" 
            strokeDasharray="4,2"
            rx="3"
          />
          <circle cx="60" cy={55 + 25 * sizeScale} r="12" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5"/>
        </g>
      )}
      
      {highlight === 'left-chest' && (
        <g>
          <rect 
            x={28} 
            y={50} 
            width={22 * sizeScale} 
            height={22 * sizeScale} 
            fill="rgba(74, 222, 128, 0.3)" 
            stroke="#4ade80" 
            strokeWidth="2" 
            strokeDasharray="4,2"
            rx="2"
          />
          <circle cx={39} cy={50 + 11 * sizeScale} r="6" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5"/>
        </g>
      )}
    </svg>
  );
  
  const BackShirt = () => (
    <svg viewBox="0 0 120 140" className="w-full h-full">
      <path 
        d="M20,45 L10,55 L10,135 L110,135 L110,55 L100,45 L85,45 L75,30 C70,25 50,25 45,30 L35,45 Z" 
        fill="#374151" 
        stroke="#4b5563" 
        strokeWidth="1.5"
      />
      <path 
        d="M20,45 L5,60 L5,80 L20,75 L20,45" 
        fill="#374151" 
        stroke="#4b5563" 
        strokeWidth="1.5"
      />
      <path 
        d="M100,45 L115,60 L115,80 L100,75 L100,45" 
        fill="#374151" 
        stroke="#4b5563" 
        strokeWidth="1.5"
      />
      <path d="M45,30 Q60,35 75,30" fill="none" stroke="#4b5563" strokeWidth="1.5"/>
      
      <rect 
        x={60 - 20 * sizeScale} 
        y={50} 
        width={40 * sizeScale} 
        height={50 * sizeScale} 
        fill="rgba(74, 222, 128, 0.3)" 
        stroke="#4ade80" 
        strokeWidth="2" 
        strokeDasharray="4,2"
        rx="3"
      />
      <circle cx="60" cy={50 + 25 * sizeScale} r="12" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5"/>
      
      <text x="60" y="130" textAnchor="middle" fill="#9ca3af" fontSize="8" fontWeight="bold">BACK</text>
    </svg>
  );
  
  const LeftSleeveView = () => (
    <svg viewBox="0 0 120 140" className="w-full h-full">
      <path 
        d="M70,45 L70,135 L90,135 L90,45 Q80,35 70,45" 
        fill="#374151" 
        stroke="#4b5563" 
        strokeWidth="1.5"
      />
      <path 
        d="M70,48 L25,58 L20,80 L25,82 L70,72" 
        fill="#374151" 
        stroke="#4b5563" 
        strokeWidth="1.5"
      />
      <path d="M70,45 Q65,40 70,35 Q80,30 90,35 Q95,40 90,45" fill="#374151" stroke="#4b5563" strokeWidth="1.5"/>
      
      <g transform="rotate(-8, 45, 68)">
        <rect 
          x={35} 
          y={58} 
          width={18 * sizeScale} 
          height={18 * sizeScale} 
          fill="rgba(74, 222, 128, 0.3)" 
          stroke="#4ade80" 
          strokeWidth="2" 
          strokeDasharray="4,2"
          rx="2"
        />
        <circle cx={44} cy={58 + 9 * sizeScale} r="5" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5"/>
      </g>
      
      <text x="60" y="130" textAnchor="middle" fill="#9ca3af" fontSize="7">LEFT SIDE VIEW</text>
    </svg>
  );
  
  const RightSleeveView = () => (
    <svg viewBox="0 0 120 140" className="w-full h-full">
      <path 
        d="M50,45 L50,135 L30,135 L30,45 Q40,35 50,45" 
        fill="#374151" 
        stroke="#4b5563" 
        strokeWidth="1.5"
      />
      <path 
        d="M50,48 L95,58 L100,80 L95,82 L50,72" 
        fill="#374151" 
        stroke="#4b5563" 
        strokeWidth="1.5"
      />
      <path d="M50,45 Q55,40 50,35 Q40,30 30,35 Q25,40 30,45" fill="#374151" stroke="#4b5563" strokeWidth="1.5"/>
      
      <g transform="rotate(8, 75, 68)">
        <rect 
          x={67} 
          y={58} 
          width={18 * sizeScale} 
          height={18 * sizeScale} 
          fill="rgba(74, 222, 128, 0.3)" 
          stroke="#4ade80" 
          strokeWidth="2" 
          strokeDasharray="4,2"
          rx="2"
        />
        <circle cx={76} cy={58 + 9 * sizeScale} r="5" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5"/>
      </g>
      
      <text x="60" y="130" textAnchor="middle" fill="#9ca3af" fontSize="7">RIGHT SIDE VIEW</text>
    </svg>
  );
  
  const renderDiagram = () => {
    switch (placement) {
      case 'front':
        return <FrontShirt highlight="center" />;
      case 'back':
        return <BackShirt />;
      case 'left_chest':
        return <FrontShirt highlight="left-chest" />;
      case 'sleeve_left':
        return <LeftSleeveView />;
      case 'sleeve_right':
        return <RightSleeveView />;
      default:
        return <FrontShirt highlight="center" />;
    }
  };
  
  return (
    <div className="w-32 h-40 mx-auto">
      {renderDiagram()}
    </div>
  );
}

export function PlacementConfigStep({
  currentPlacement,
  currentIndex,
  totalPlacements,
  graphicChoice,
  onGraphicChoiceChange,
  headerStyle,
  footerStyle,
  textLayoutChoice,
  selectedColor,
  graphicSize
}: {
  currentPlacement: PlacementOption;
  currentIndex: number;
  totalPlacements: number;
  graphicChoice: PlacementGraphicChoice;
  onGraphicChoiceChange: (choice: PlacementGraphicChoice) => void;
  headerStyle: TextStyleConfig;
  footerStyle: TextStyleConfig;
  textLayoutChoice: TextLayoutChoice;
  selectedColor: string;
  graphicSize: GraphicSize;
}) {
  const placementLabel = PLACEMENT_OPTIONS.find(p => p.id === currentPlacement)?.label || currentPlacement;
  const showHeader = graphicChoice === 'full' && (textLayoutChoice === 'header' || textLayoutChoice === 'both');
  const showFooter = graphicChoice === 'full' && (textLayoutChoice === 'footer' || textLayoutChoice === 'both');
  const colorHex = SHIRT_COLORS.find(c => c.id === selectedColor)?.hex || '#1a1a1a';
  
  const isLeftChest = currentPlacement === 'left_chest';
  const isSleeve = currentPlacement === 'sleeve_left' || currentPlacement === 'sleeve_right';
  
  const getGraphicDimensions = () => {
    const sizeKey = graphicSize || 'medium';
    const sizes: Record<string, { w: number; h: number }> = {
      small: { w: 22, h: 30 },
      medium: { w: 33, h: 44 },
      large: { w: 41, h: 52 }
    };
    return sizes[sizeKey] || sizes.medium;
  };
  const graphicDims = getGraphicDimensions();
  
  const graphicX = isLeftChest ? 77 : 90;
  const graphicY = isLeftChest ? 68 : 79;

  const qrHeight = graphicDims.h * 0.18;
  const qrWidth = qrHeight;
  const qrY = graphicY - qrHeight / 2;
  const headerZoneTop = graphicY - graphicDims.h / 2 + 2;
  const headerZoneBottom = qrY - 2;
  const footerZoneTop = qrY + qrHeight + 2;
  const footerZoneBottom = graphicY + graphicDims.h / 2 - 2;

  const headerAutoText = calculateAutoTextSize(headerStyle.text || '', headerStyle.fontSize || '18px', graphicDims.w);
  const footerAutoText = calculateAutoTextSize(footerStyle.text || '', footerStyle.fontSize || '18px', graphicDims.w);

  const headerVOffset = headerStyle.verticalOffset ?? 50;
  const headerHOffset = headerStyle.horizontalOffset ?? 50;
  const headerTextY = Math.max(headerZoneTop + headerAutoText.fontSize * 0.8, Math.min(headerZoneBottom - (headerAutoText.lines.length > 1 ? headerAutoText.fontSize : 0), headerZoneTop + ((headerZoneBottom - headerZoneTop) * (headerVOffset / 100))));
  const headerTextX = (graphicX - graphicDims.w / 2) + (graphicDims.w * (headerHOffset / 100));

  const footerVOffset = footerStyle.verticalOffset ?? 50;
  const footerHOffset = footerStyle.horizontalOffset ?? 50;
  const footerTextY = Math.max(footerZoneTop + footerAutoText.fontSize * 0.8, Math.min(footerZoneBottom - (footerAutoText.lines.length > 1 ? footerAutoText.fontSize : 0), footerZoneTop + ((footerZoneBottom - footerZoneTop) * (footerVOffset / 100))));
  const footerTextX = (graphicX - graphicDims.w / 2) + (graphicDims.w * (footerHOffset / 100));

  const ShirtPreviewWithGraphic = () => {
    return (
      <svg viewBox="0 0 180 210" className="w-full h-full drop-shadow-xl">
        <path
          d="M30,52 L52,30 L75,37 L90,30 L105,37 L128,30 L150,52 L142,82 L127,75 L127,180 L53,180 L53,75 L38,82 Z"
          fill={colorHex}
          stroke="#444"
          strokeWidth="2"
        />
        {currentPlacement === 'back' && (
          <path d="M75,37 Q90,42 105,37" fill="none" stroke="#444" strokeWidth="1.5"/>
        )}
        
        {graphicChoice && (
          <>
            {showHeader && headerAutoText.lines.map((line, i) => (
              <text
                key={`hdr-${i}`}
                x={headerTextX}
                y={headerTextY + i * (headerAutoText.fontSize + 1)}
                textAnchor="middle"
                fill={headerStyle.color || '#fff'}
                fontSize={headerAutoText.fontSize}
                fontFamily={headerStyle.fontFamily || 'Arial'}
                fontWeight="bold"
              >
                {line}
              </text>
            ))}
            <g transform={`translate(${graphicX - qrWidth / 2}, ${qrY})`}>
              <rect width={qrWidth} height={qrHeight} fill="white" rx="1" />
              <rect x={qrHeight * 0.08} y={qrHeight * 0.08} width={qrHeight * 0.18} height={qrHeight * 0.18} fill="#333" />
              <rect x={qrWidth - qrHeight * 0.08 - qrHeight * 0.18} y={qrHeight * 0.08} width={qrHeight * 0.18} height={qrHeight * 0.18} fill="#333" />
              <rect x={qrHeight * 0.08} y={qrHeight - qrHeight * 0.08 - qrHeight * 0.18} width={qrHeight * 0.18} height={qrHeight * 0.18} fill="#333" />
              <rect x={qrWidth / 2 - qrHeight * 0.12} y={qrHeight * 0.38} width={qrHeight * 0.24} height={qrHeight * 0.24} fill="#333" />
            </g>
            {showFooter && footerAutoText.lines.map((line, i) => (
              <text
                key={`ftr-${i}`}
                x={footerTextX}
                y={footerTextY + i * (footerAutoText.fontSize + 1)}
                textAnchor="middle"
                fill={footerStyle.color || '#fff'}
                fontSize={footerAutoText.fontSize}
                fontFamily={footerStyle.fontFamily || 'Arial'}
                fontWeight="bold"
              >
                {line}
              </text>
            ))}
          </>
        )}
        
        <text x="90" y="200" textAnchor="middle" fill="#9ca3af" fontSize="10" fontWeight="bold">
          {currentPlacement === 'back' ? 'BACK' : 'FRONT'}
        </text>
      </svg>
    );
  };
  
  const SleevePreviewWithGraphic = ({ side }: { side: 'left' | 'right' }) => {
    const isLeft = side === 'left';
    return (
      <svg viewBox="0 0 120 160" className="w-full h-full drop-shadow-xl">
        {isLeft ? (
          <>
            <path d="M70,50 L70,150 L95,150 L95,50 Q82,38 70,50" fill={colorHex} stroke="#444" strokeWidth="2"/>
            <path d="M70,52 L20,65 L15,95 L22,98 L70,82" fill={colorHex} stroke="#444" strokeWidth="2"/>
            <path d="M70,50 Q62,42 70,35 Q82,28 95,35 Q103,42 95,50" fill={colorHex} stroke="#444" strokeWidth="2"/>
            {graphicChoice && (
              <g transform="translate(32, 72) rotate(-10)">
                <rect width="16" height="16" fill="white" rx="2"/>
                <rect x="2" y="2" width="4" height="4" fill="#333"/>
                <rect x="10" y="2" width="4" height="4" fill="#333"/>
                <rect x="2" y="10" width="4" height="4" fill="#333"/>
                <rect x="6" y="6" width="4" height="4" fill="#333"/>
              </g>
            )}
          </>
        ) : (
          <>
            <path d="M50,50 L50,150 L25,150 L25,50 Q38,38 50,50" fill={colorHex} stroke="#444" strokeWidth="2"/>
            <path d="M50,52 L100,65 L105,95 L98,98 L50,82" fill={colorHex} stroke="#444" strokeWidth="2"/>
            <path d="M50,50 Q58,42 50,35 Q38,28 25,35 Q17,42 25,50" fill={colorHex} stroke="#444" strokeWidth="2"/>
            {graphicChoice && (
              <g transform="translate(72, 72) rotate(10)">
                <rect width="16" height="16" fill="white" rx="2"/>
                <rect x="2" y="2" width="4" height="4" fill="#333"/>
                <rect x="10" y="2" width="4" height="4" fill="#333"/>
                <rect x="2" y="10" width="4" height="4" fill="#333"/>
                <rect x="6" y="6" width="4" height="4" fill="#333"/>
              </g>
            )}
          </>
        )}
        <text x="60" y="155" textAnchor="middle" fill="#9ca3af" fontSize="9" fontWeight="bold">
          {side === 'left' ? 'LEFT SLEEVE' : 'RIGHT SLEEVE'}
        </text>
      </svg>
    );
  };
  
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-5 duration-300">
      <div className="text-center mb-1">
        <h2 className="text-xl font-bold text-white">
          What do you want on the {placementLabel.toLowerCase()}?
        </h2>
        {totalPlacements > 1 && (
          <p className="text-sm text-slate-400 mt-1">Placement {currentIndex + 1} of {totalPlacements}</p>
        )}
      </div>
      
      <div className="flex items-center justify-center gap-3">
        <div className="w-32 h-40">
          {isSleeve ? (
            <SleevePreviewWithGraphic side={currentPlacement === 'sleeve_left' ? 'left' : 'right'} />
          ) : (
            <ShirtPreviewWithGraphic />
          )}
        </div>
        <div className="bg-amber-500/15 border border-amber-500/30 rounded-lg px-3 py-1.5">
          <span className="text-amber-300 font-bold text-sm">{placementLabel}</span>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
          <button
            onClick={() => onGraphicChoiceChange('full')}
            className={`p-4 rounded-xl border-2 transition-all ${
              graphicChoice === 'full'
                ? 'border-orange-400 bg-orange-500/15 shadow-lg shadow-orange-500/20'
                : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
            }`}
            data-testid="button-full-graphic"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-20 bg-slate-700 rounded-lg flex flex-col items-center justify-center gap-1 p-1">
                {(textLayoutChoice === 'header' || textLayoutChoice === 'both') && <div className="w-10 h-2 bg-white/60 rounded-sm" />}
                <QrCode className="w-8 h-8 text-white" />
                {(textLayoutChoice === 'footer' || textLayoutChoice === 'both') && <div className="w-10 h-2 bg-white/60 rounded-sm" />}
              </div>
              <span className="font-medium text-white text-sm">Full Graphic</span>
              <span className="text-xs text-slate-400">Header + QR + Footer</span>
            </div>
          </button>
          
          <button
            onClick={() => onGraphicChoiceChange('qr-only')}
            className={`p-4 rounded-xl border-2 transition-all ${
              graphicChoice === 'qr-only'
                ? 'border-orange-400 bg-orange-500/15 shadow-lg shadow-orange-500/20'
                : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
            }`}
            data-testid="button-qr-only"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-20 bg-slate-700 rounded-lg flex items-center justify-center">
                <QrCode className="w-10 h-10 text-white" />
              </div>
              <span className="font-medium text-white text-sm">QR Only</span>
              <span className="text-xs text-slate-400">Just the QR code</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
