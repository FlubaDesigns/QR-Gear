import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface NumericInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  defaultValue?: number;
  allowNegative?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function NumericInput({
  value,
  onChange,
  min = 0,
  max = 100,
  defaultValue,
  allowNegative = false,
  className,
  ...props
}: NumericInputProps) {
  const [display, setDisplay] = useState(String(value));

  useEffect(() => {
    setDisplay(String(value));
  }, [value]);

  const def = defaultValue ?? min;
  const pattern = allowNegative ? /^-?\d*$/ : /^\d*$/;

  return (
    <input
      type="text"
      inputMode={allowNegative ? "text" : "numeric"}
      value={display}
      onChange={(e) => {
        const raw = e.target.value;
        if (!pattern.test(raw)) return;
        setDisplay(raw);
        const v = parseInt(raw, 10);
        if (!isNaN(v)) {
          onChange(Math.min(max, Math.max(min, v)));
        }
      }}
      onBlur={() => {
        const v = parseInt(display, 10);
        const clamped = Math.min(max, Math.max(min, isNaN(v) ? def : v));
        setDisplay(String(clamped));
        onChange(clamped);
      }}
      className={cn(className)}
      {...props}
    />
  );
}
