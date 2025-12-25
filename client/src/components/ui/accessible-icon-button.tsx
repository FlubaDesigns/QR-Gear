import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export interface AccessibleIconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "destructive" | "default" | "outline" | "ghost";
  children: ReactNode;
}

const variantStyles = {
  destructive: "bg-destructive text-destructive-foreground",
  default: "bg-primary text-primary-foreground",
  outline: "border border-input bg-background",
  ghost: "bg-transparent",
};

export const AccessibleIconButton = forwardRef<
  HTMLButtonElement,
  AccessibleIconButtonProps
>(({ className, variant = "default", children, ...props }, ref) => {
  return (
    <button
      type="button"
      ref={ref}
      className={cn(
        "h-12 w-12 flex items-center justify-center rounded-md",
        "hover-elevate active-elevate-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});

AccessibleIconButton.displayName = "AccessibleIconButton";
