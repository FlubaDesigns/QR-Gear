import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FontPickerProps {
  value: string;
  onChange: (font: string) => void;
  fonts: string[];
  previewText?: string;
  className?: string;
  "data-testid"?: string;
}

export function FontPicker({
  value,
  onChange,
  fonts,
  previewText = "QR Gear",
  className,
  "data-testid": testId,
}: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const closeAndFocus = useCallback(() => {
    setOpen(false);
    setFocusedIndex(-1);
    triggerRef.current?.focus();
  }, []);

  const handleSelect = useCallback((font: string) => {
    onChange(font);
    closeAndFocus();
  }, [onChange, closeAndFocus]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setFocusedIndex(-1);
      }
    }
    
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    if (open && focusedIndex >= 0 && optionRefs.current[focusedIndex]) {
      optionRefs.current[focusedIndex]?.focus();
    }
  }, [open, focusedIndex]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      const currentIndex = fonts.indexOf(value);
      setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
    }
  };

  const handleOptionKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        closeAndFocus();
        break;
      case "ArrowDown":
        e.preventDefault();
        if (index < fonts.length - 1) {
          setFocusedIndex(index + 1);
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (index > 0) {
          setFocusedIndex(index - 1);
        } else {
          closeAndFocus();
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        handleSelect(fonts[index]);
        break;
      case "Tab":
        closeAndFocus();
        break;
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!open) {
            setOpen(true);
            const currentIndex = fonts.indexOf(value);
            setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
          } else {
            closeAndFocus();
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "w-full h-12 px-3 border rounded-md text-sm bg-background",
          "flex items-center justify-between gap-2",
          "hover-elevate active-elevate-2",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        data-testid={testId}
      >
        <span 
          className="truncate text-left flex-1"
          style={{ fontFamily: value }}
        >
          {value}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div 
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg overflow-hidden"
          role="listbox"
          aria-activedescendant={focusedIndex >= 0 ? `font-option-${focusedIndex}` : undefined}
        >
          <ScrollArea className="h-72">
            <div className="p-2 space-y-1">
              {fonts.filter(Boolean).map((font, index) => (
                <button
                  key={font}
                  id={`font-option-${index}`}
                  ref={(el) => { optionRefs.current[index] = el; }}
                  type="button"
                  role="option"
                  aria-selected={value === font}
                  onClick={() => handleSelect(font)}
                  onKeyDown={(e) => handleOptionKeyDown(e, index)}
                  className={cn(
                    "w-full px-3 py-3 rounded-md text-left",
                    "flex flex-col gap-1",
                    "hover-elevate active-elevate-2",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    value === font && "bg-accent"
                  )}
                  data-testid={`font-option-${(font || '').replace(/\s+/g, '-').toLowerCase()}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{font}</span>
                    {value === font && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <span 
                    className="text-xl truncate"
                    style={{ fontFamily: font }}
                  >
                    {previewText}
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
