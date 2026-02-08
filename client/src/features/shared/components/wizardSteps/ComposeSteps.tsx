import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Library,
  Loader2,
  AlertCircle,
  Play,
  ImagePlus,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  Store,
  Send,
  Sparkles,
  Plus,
  ArrowRight,
  Zap,
} from "lucide-react";

const COMPOSE_DURATION_PRESETS = [
  { label: '1 hour', seconds: 3600 },
  { label: '6 hours', seconds: 21600 },
  { label: '12 hours', seconds: 43200 },
  { label: '1 day', seconds: 86400 },
  { label: '1 week', seconds: 604800 },
  { label: '1 month', seconds: 2592000 },
];

function formatComposeDuration(seconds: number): string {
  const preset = COMPOSE_DURATION_PRESETS.find(p => p.seconds === seconds);
  if (preset) return preset.label;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function ComposePickItemsStep({
  availableItems,
  selectedItems,
  onToggleItem,
  isLoading,
}: {
  availableItems: any[];
  selectedItems: Array<{ packetId: string; name: string; thumbnailUrl: string; type: 'qr-canvas' | 'qr-play'; durationSeconds: number; order: number }>;
  onToggleItem: (item: any) => void;
  isLoading: boolean;
}) {
  const selectedIds = selectedItems.map(i => i.packetId);
  const [enlargedItem, setEnlargedItem] = useState<any>(null);
  
  return (
    <div className="animate-in fade-in slide-in-from-right-5 duration-300">
      <div className="text-center mb-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mx-auto mb-3">
          <Library className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">Pick Your Rotation Items</h2>
        <p className="text-slate-400 text-sm">Select at least 2 published items for your playlist</p>
        <Badge className="mt-2 bg-amber-600">{selectedItems.length} selected</Badge>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        </div>
      ) : availableItems.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No published Canvas or Play items found.</p>
          <p className="text-sm mt-1">Create and publish some items first!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto">
          {availableItems.map((item: any) => {
            const isSelected = selectedIds.includes(item.packetId || item.id);
            const imgSrc = item.thumbnailUrl || item.urlGraphic || item.qrCanvasMockup || item.qrPlayMockup;
            return (
              <div
                key={item.packetId || item.id}
                className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                  isSelected 
                    ? 'border-amber-400 ring-2 ring-amber-400/30' 
                    : 'border-slate-600 hover:border-slate-500'
                }`}
                data-testid={`button-compose-item-${item.packetId || item.id}`}
              >
                <div 
                  className="aspect-square bg-slate-800"
                  onClick={() => {
                    if (imgSrc) {
                      setEnlargedItem(item);
                    } else {
                      onToggleItem(item);
                    }
                  }}
                >
                  {imgSrc ? (
                    <img 
                      src={imgSrc} 
                      alt={item.title || item.name || 'Item'} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {item.packetType === 'qr-play' ? (
                        <Play className="w-8 h-8 text-slate-500" />
                      ) : (
                        <ImagePlus className="w-8 h-8 text-slate-500" />
                      )}
                    </div>
                  )}
                </div>
                <button
                  className="w-full p-2 bg-slate-800 text-left"
                  onClick={() => onToggleItem(item)}
                  data-testid={`button-compose-toggle-${item.packetId || item.id}`}
                >
                  <p className="text-white text-xs font-medium truncate">{item.title || item.name || 'Untitled'}</p>
                  <Badge variant="outline" className="text-[10px] mt-1">
                    {item.packetType === 'qr-play' ? 'Video' : 'Image'}
                  </Badge>
                </button>
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center pointer-events-none">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {enlargedItem && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setEnlargedItem(null)}
          data-testid="overlay-enlarged-item"
        >
          <div 
            className="relative max-w-[85vw] max-h-[80vh] animate-in zoom-in-90 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={enlargedItem.thumbnailUrl || enlargedItem.urlGraphic || enlargedItem.qrCanvasMockup || enlargedItem.qrPlayMockup} 
              alt={enlargedItem.title || enlargedItem.name || 'Item'} 
              className="w-full h-auto max-h-[65vh] object-contain rounded-xl"
            />
            <p className="text-white text-center text-sm font-medium mt-3 mb-3">{enlargedItem.title || enlargedItem.name || 'Untitled'}</p>
            <Button
              onClick={() => {
                if (!selectedIds.includes(enlargedItem.packetId || enlargedItem.id)) {
                  onToggleItem(enlargedItem);
                }
                setEnlargedItem(null);
              }}
              className={`w-full transition-all duration-300 ${
                selectedIds.includes(enlargedItem.packetId || enlargedItem.id)
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/40'
              }`}
              style={!selectedIds.includes(enlargedItem.packetId || enlargedItem.id) ? { animation: "glow 1.2s ease-in-out infinite" } : undefined}
              data-testid="button-enlarged-select"
            >
              {selectedIds.includes(enlargedItem.packetId || enlargedItem.id) ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Already Selected
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Select This Item
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ComposeDurationsStep({
  items,
  onUpdateDuration,
}: {
  items: Array<{ packetId: string; name: string; thumbnailUrl: string; type: string; durationSeconds: number; order: number }>;
  onUpdateDuration: (packetId: string, seconds: number) => void;
}) {
  const totalSeconds = items.reduce((acc, i) => acc + i.durationSeconds, 0);
  
  return (
    <div className="animate-in fade-in slide-in-from-right-5 duration-300">
      <div className="text-center mb-4">
        <h2 className="text-lg font-bold text-white mb-1">Set Rotation Durations</h2>
        <p className="text-slate-400 text-sm">How long should each item stay active?</p>
        <Badge className="mt-2 bg-purple-600">Full cycle: {formatComposeDuration(totalSeconds)}</Badge>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.packetId} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700">
            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-slate-700">
              {item.thumbnailUrl ? (
                <img src={item.thumbnailUrl} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImagePlus className="w-5 h-5 text-slate-500" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{item.name}</p>
              <select
                value={String(item.durationSeconds)}
                onChange={(e) => onUpdateDuration(item.packetId, parseInt(e.target.value))}
                className="mt-1 w-full bg-slate-700 text-white text-sm rounded-lg border border-slate-600 px-2 py-1"
                data-testid={`select-duration-${item.packetId}`}
              >
                {COMPOSE_DURATION_PRESETS.map(p => (
                  <option key={p.seconds} value={String(p.seconds)}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ComposeOrderStep({
  items,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  items: Array<{ packetId: string; name: string; thumbnailUrl: string; type: string; durationSeconds: number; order: number }>;
  onMoveUp: (packetId: string) => void;
  onMoveDown: (packetId: string) => void;
  onRemove: (packetId: string) => void;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-right-5 duration-300">
      <div className="text-center mb-4">
        <h2 className="text-lg font-bold text-white mb-1">Playlist Order</h2>
        <p className="text-slate-400 text-sm">Arrange the rotation sequence</p>
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={item.packetId} className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-xl border border-slate-700">
            <div className="w-8 h-8 flex items-center justify-center bg-amber-600 rounded-lg text-white text-sm font-bold flex-shrink-0">
              {idx + 1}
            </div>
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-slate-700">
              {item.thumbnailUrl ? (
                <img src={item.thumbnailUrl} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImagePlus className="w-4 h-4 text-slate-500" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm truncate">{item.name}</p>
              <p className="text-slate-400 text-xs">{formatComposeDuration(item.durationSeconds)}</p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button size="icon" variant="ghost" onClick={() => onMoveUp(item.packetId)} disabled={idx === 0} data-testid={`button-move-up-${item.packetId}`}>
                <ChevronLeft className="w-4 h-4 rotate-90" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => onMoveDown(item.packetId)} disabled={idx === items.length - 1} data-testid={`button-move-down-${item.packetId}`}>
                <ChevronRight className="w-4 h-4 rotate-90" />
              </Button>
              <Button size="icon" variant="ghost" className="text-red-400" onClick={() => onRemove(item.packetId)} data-testid={`button-remove-${item.packetId}`}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ComposeHostingStep({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (term: '1-year' | '3-year' | '5-year') => void;
}) {
  const terms = [
    { id: '1-year' as const, label: '1 Year', price: '$4.99/yr', description: 'Great for trying it out' },
    { id: '3-year' as const, label: '3 Years', price: '$3.99/yr', description: 'Best value - save 20%', popular: true },
    { id: '5-year' as const, label: '5 Years', price: '$2.99/yr', description: 'Maximum savings - save 40%' },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-right-5 duration-300">
      <div className="text-center mb-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mx-auto mb-3">
          <Store className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">Choose Your Space Term</h2>
        <p className="text-slate-400 text-sm">How long should your rotating QR stay active?</p>
      </div>

      <div className="flex flex-col gap-3 max-w-sm mx-auto">
        {terms.map((term) => (
          <button
            key={term.id}
            onClick={() => onSelect(term.id)}
            className={`relative p-4 rounded-xl border-2 transition-all text-left ${
              selected === term.id
                ? 'border-green-400 bg-green-500/10'
                : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
            }`}
            data-testid={`button-hosting-${term.id}`}
          >
            {term.popular && (
              <Badge className="absolute -top-2 right-3 bg-green-500 text-xs">Most Popular</Badge>
            )}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-lg">{term.label}</h3>
                <p className="text-slate-400 text-sm">{term.description}</p>
              </div>
              <div className="text-right">
                <p className="text-green-400 font-bold text-lg">{term.price}</p>
              </div>
            </div>
            {selected === term.id && (
              <Check className="absolute top-3 left-3 w-5 h-5 text-green-400" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ComposePreviewStep({
  items,
  hostingTerm,
  mockupUrl,
  isLoadingMockup,
  selectedColor,
  selectedSize,
}: {
  items: Array<{ packetId: string; name: string; thumbnailUrl: string; type: string; durationSeconds: number; order: number }>;
  hostingTerm: string;
  mockupUrl: string;
  isLoadingMockup: boolean;
  selectedColor: string;
  selectedSize: string;
}) {
  const totalSeconds = items.reduce((acc, i) => acc + i.durationSeconds, 0);
  
  return (
    <div className="animate-in fade-in slide-in-from-right-5 duration-300">
      <div className="text-center mb-4">
        <h2 className="text-lg font-bold text-white mb-1">QR Compose Summary</h2>
        <p className="text-slate-400 text-sm">Review your rotating playlist</p>
      </div>

      {isLoadingMockup ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="w-10 h-10 animate-spin text-amber-400 mb-3" />
          <p className="text-slate-300 text-sm">Generating product preview...</p>
        </div>
      ) : mockupUrl ? (
        <div className="mx-auto max-w-[200px] mb-4">
          <img src={mockupUrl} alt="Product mockup" className="w-full rounded-xl border border-slate-600" />
        </div>
      ) : null}

      <div className="space-y-2 bg-slate-800/50 rounded-xl p-3 border border-slate-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Items in rotation</span>
          <span className="text-white font-medium">{items.length}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Full cycle</span>
          <span className="text-white font-medium">{formatComposeDuration(totalSeconds)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Product</span>
          <span className="text-white font-medium">{selectedColor} / {selectedSize}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Hosting term</span>
          <span className="text-green-400 font-medium">{hostingTerm.replace('-', ' ')}</span>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Playlist</p>
        {items.map((item, idx) => (
          <div key={item.packetId} className="flex items-center gap-2 p-2 bg-slate-800/30 rounded-lg">
            <span className="text-amber-400 text-xs font-bold w-5">{idx + 1}.</span>
            <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-slate-700">
              {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />}
            </div>
            <span className="text-white text-sm flex-1 truncate">{item.name}</span>
            <span className="text-slate-500 text-xs">{formatComposeDuration(item.durationSeconds)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ComposePublishStep({
  isPublishing,
  itemCount,
}: {
  isPublishing: boolean;
  itemCount: number;
}) {
  return (
    <div className="text-center space-y-6 animate-in fade-in duration-500">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mx-auto">
        <Send className="w-8 h-8 text-white" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-white mb-2">Ready to Publish</h2>
        <p className="text-slate-300">
          Your rotating playlist with {itemCount} items will go live
        </p>
      </div>
      {isPublishing && (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          <p className="text-slate-300 text-sm">Creating your QR Compose experience...</p>
        </div>
      )}
    </div>
  );
}

export function ComposeConfirmStep({
  instanceId,
  resolverUrl,
  itemCount,
}: {
  instanceId: string | null;
  resolverUrl: string | null;
  itemCount: number;
}) {
  return (
    <div className="text-center space-y-4 animate-in fade-in duration-500">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mx-auto">
        <Check className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-xl font-bold text-white">QR Compose Published!</h2>
      <p className="text-slate-300">
        Your rotating playlist with {itemCount} items is now live
      </p>
      {resolverUrl && (
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 max-w-sm mx-auto">
          <p className="text-slate-400 text-xs mb-1">Resolver URL</p>
          <p className="text-amber-400 text-sm font-mono break-all">{resolverUrl}</p>
        </div>
      )}
    </div>
  );
}

export function ComposeExplainerCard({
  onCreateMoment,
  onBack,
  publishedItemCount
}: {
  onCreateMoment: () => void;
  onBack: () => void;
  publishedItemCount: number;
}) {
  return (
    <div className="text-center space-y-5 animate-in fade-in slide-in-from-right-5 duration-300">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mx-auto">
        <Sparkles className="w-7 h-7 text-white" />
      </div>
      
      <div>
        <h2 className="text-xl font-bold text-white mb-3">Compose — Moments Over Time</h2>
        <p className="text-slate-300 text-sm max-w-md mx-auto leading-relaxed">
          Compose lets one QR show different moments based on time of day, scan order, or a schedule you control.
        </p>
      </div>
      
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 max-w-sm mx-auto text-left space-y-2">
        <p className="text-slate-300 text-sm font-medium">Example: A restaurant shirt</p>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-amber-400">Morning</span> — Welcome image moment
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-amber-400">Lunch</span> — Menu document moment
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-amber-400">Evening</span> — Drone footage video moment
          </div>
        </div>
      </div>
      
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 max-w-sm mx-auto">
        <p className="text-amber-300 text-sm">
          You have <span className="font-bold">{publishedItemCount}</span> moment{publishedItemCount !== 1 ? 's' : ''}. 
          You need at least <span className="font-bold">2</span> to use Compose.
        </p>
      </div>
      
      <div className="flex flex-col gap-3 max-w-sm mx-auto">
        <Button
          onClick={onCreateMoment}
          className="w-full py-5 text-lg bg-gradient-to-r from-purple-600 to-blue-600"
          data-testid="button-create-another-moment"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create another moment
        </Button>
        <Button
          onClick={onBack}
          variant="outline"
          className="w-full py-4 text-slate-300 border-slate-600"
          data-testid="button-compose-explainer-back"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>
    </div>
  );
}

export function PlatformAcknowledgementCard({
  momentCount,
  onContinue,
  onManageMoments
}: {
  momentCount: number;
  onContinue: () => void;
  onManageMoments: () => void;
}) {
  return (
    <div className="text-center space-y-5 animate-in fade-in slide-in-from-right-5 duration-300">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mx-auto">
        <Zap className="w-8 h-8 text-white" />
      </div>
      
      <div>
        <h2 className="text-xl font-bold text-white mb-3">You're building a living QR platform</h2>
        <p className="text-slate-300 text-sm max-w-md mx-auto leading-relaxed">
          Your QR can now show different moments over time. This turns your QR into a digital surface you control.
        </p>
      </div>
      
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 max-w-sm mx-auto text-left space-y-2">
        <p className="text-slate-300 text-sm font-medium">With Compose, you can:</p>
        <div className="space-y-1.5 text-sm text-slate-400">
          <div className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span>Rotate moments — each scan shows the next</span>
          </div>
          <div className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span>Schedule moments — breakfast / lunch / dinner</span>
          </div>
          <div className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span>Run sequences — 12 days of Christmas, 30 days of prayer</span>
          </div>
        </div>
      </div>
      
      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 max-w-sm mx-auto">
        <p className="text-green-300 text-sm">
          You currently have <span className="font-bold">{momentCount} moments</span> — Compose is ready.
        </p>
      </div>
      
      <div className="flex flex-col gap-3 max-w-sm mx-auto">
        <Button
          onClick={onContinue}
          className="w-full py-5 text-lg bg-gradient-to-r from-green-600 to-emerald-600"
          data-testid="button-continue-platform"
        >
          <ArrowRight className="w-5 h-5 mr-2" />
          Continue building my platform
        </Button>
        <Button
          onClick={onManageMoments}
          variant="outline"
          className="w-full py-4 text-slate-300 border-slate-600"
          data-testid="button-manage-moments"
        >
          Manage moments
        </Button>
      </div>
    </div>
  );
}
