import { CheckSquare, Square } from "lucide-react";

interface ContentRightsCheckboxProps {
  confirmed: boolean;
  onToggle: () => void;
  contentType?: 'image' | 'video' | 'content';
  className?: string;
}

export function ContentRightsCheckbox({ 
  confirmed, 
  onToggle, 
  contentType = 'content',
  className = ''
}: ContentRightsCheckboxProps) {
  const typeLabel = contentType === 'image' ? 'image' : contentType === 'video' ? 'video' : 'content';
  
  return (
    <div 
      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
        confirmed 
          ? "bg-emerald-500/10 border border-emerald-500/30" 
          : "bg-slate-800/50 border border-slate-600"
      } ${className}`}
      onClick={onToggle}
      data-testid="checkbox-content-rights"
    >
      {confirmed ? (
        <CheckSquare className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
      ) : (
        <Square className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
      )}
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-white">
          I have the right to use this {typeLabel}
        </p>
        <p className="text-xs text-slate-400">
          I own this {typeLabel} or have permission to use it. QR Gear is not responsible for copyright or intellectual property issues.
        </p>
      </div>
    </div>
  );
}
