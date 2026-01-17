import { useState, useRef, useEffect } from "react";
import { ChevronDown, Loader2, Check } from "lucide-react";

interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function CustomDropdown({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  loading = false,
  className = "",
  "data-testid": testId,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className="w-full min-h-12 text-base px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-white flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-ice-2 disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid={testId}
      >
        <span className="flex items-center gap-2 truncate">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              Loading...
            </>
          ) : selectedOption ? (
            <>
              {selectedOption.icon}
              {selectedOption.label}
            </>
          ) : (
            <span className="text-white/50">{placeholder}</span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && options.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-white/20 bg-slate-900 shadow-xl">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              className={`w-full min-h-12 px-4 py-3 text-left text-base flex items-center gap-2 hover:bg-white/10 transition-colors ${
                value === opt.value ? "bg-ice-2/20 text-ice-2" : "text-white"
              }`}
              data-testid={`option-${opt.value}`}
            >
              {opt.icon}
              <span className="flex-1">{opt.label}</span>
              {value === opt.value && <Check className="h-4 w-4 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
