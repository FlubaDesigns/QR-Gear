import { Clock, Calendar, CalendarDays, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface QRDynamicsScanItem {
  id: string;
  name: string;
  thumbnailUrl?: string;
  contentType: 'image' | 'video' | 'document';
  rotationInterval: 'daily' | 'weekly' | 'monthly';
  order: number;
}

interface QRDynamicsScanSkinProps {
  item: QRDynamicsScanItem;
  onClose: () => void;
  onIntervalChange: (interval: 'daily' | 'weekly' | 'monthly') => void;
  isUpdating?: boolean;
}

const intervalOptions = [
  { value: 'daily' as const, label: 'Daily', icon: Clock, description: 'Rotates every day' },
  { value: 'weekly' as const, label: 'Weekly', icon: Calendar, description: 'Rotates every Sunday' },
  { value: 'monthly' as const, label: 'Monthly', icon: CalendarDays, description: 'Rotates on the 1st' },
];

export function QRDynamicsScanSkin({
  item,
  onClose,
  onIntervalChange,
  isUpdating = false,
}: QRDynamicsScanSkinProps) {
  return (
    <div 
      className="bg-slate-900/95 rounded-xl border border-slate-700 p-4 w-full max-w-sm mx-auto"
      onClick={(e) => e.stopPropagation()}
      data-testid="panel-qr-dynamics-scan"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate">{item.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
              #{item.order}
            </Badge>
            <Badge variant="outline" className="text-xs border-slate-600 text-slate-300 capitalize">
              {item.contentType}
            </Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="shrink-0 text-slate-400 hover:text-white"
          data-testid="button-close-scan"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {item.thumbnailUrl && (
        <div className="mb-4 rounded-lg overflow-hidden bg-slate-800 aspect-video">
          <img
            src={item.thumbnailUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm text-slate-400 mb-3">Rotation Interval</p>
        {intervalOptions.map(({ value, label, icon: Icon, description }) => (
          <button
            key={value}
            onClick={() => onIntervalChange(value)}
            disabled={isUpdating}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-lg border transition-all",
              item.rotationInterval === value
                ? "border-purple-500 bg-purple-500/20 text-white"
                : "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800"
            )}
            data-testid={`button-interval-${value}`}
          >
            {isUpdating && item.rotationInterval !== value ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Icon className={cn(
                "h-5 w-5",
                item.rotationInterval === value ? "text-purple-400" : "text-slate-500"
              )} />
            )}
            <div className="text-left flex-1">
              <div className="font-medium">{label}</div>
              <div className="text-xs text-slate-500">{description}</div>
            </div>
            {item.rotationInterval === value && (
              <Badge className="bg-purple-500 text-white">Active</Badge>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
