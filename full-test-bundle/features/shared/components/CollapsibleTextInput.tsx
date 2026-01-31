import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface CollapsibleTextInputProps {
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  rows?: number;
  defaultOpen?: boolean;
  testId?: string;
  badge?: React.ReactNode;
}

export function CollapsibleTextInput({
  label,
  icon,
  value,
  onChange,
  placeholder,
  maxLength = 100,
  multiline = false,
  rows = 3,
  defaultOpen = false,
  testId,
  badge,
}: CollapsibleTextInputProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-background rounded-lg border">
      <div 
        className="mobile-compact-module-header flex items-center cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
        data-testid={testId ? `collapsible-${testId}` : undefined}
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        {icon && <span className="text-primary ml-1">{icon}</span>}
        <Label className="font-semibold text-base flex-1 cursor-pointer ml-2">{label}</Label>
        {badge}
        {value && !isOpen && (
          <span className="text-xs text-muted-foreground mr-2 truncate max-w-[100px]">{value}</span>
        )}
      </div>
      
      {isOpen && (
        <div className="mobile-compact-module-content">
          {multiline ? (
            <textarea
              inputMode="text"
              autoComplete="off"
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              maxLength={maxLength}
              rows={rows}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid={testId ? `input-${testId}` : undefined}
            />
          ) : (
            <Input
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              maxLength={maxLength}
              className="min-h-[48px]"
              data-testid={testId ? `input-${testId}` : undefined}
            />
          )}
        </div>
      )}
    </div>
  );
}
