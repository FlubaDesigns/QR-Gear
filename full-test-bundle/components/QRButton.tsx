import { forwardRef, ButtonHTMLAttributes } from "react";

interface QRButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "accent" | "ghost";
  size?: "default" | "small";
}

const QRButton = forwardRef<HTMLButtonElement, QRButtonProps>(
  ({ className = "", variant = "ghost", size = "default", children, ...props }, ref) => {
    const baseClasses = "qr-btn";
    const variantClasses = variant === "accent" ? "qr-btn--accent" : "qr-btn--ghost";
    const sizeClasses = size === "small" ? "qr-btn--small" : "";
    
    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`.trim()}
        {...props}
      >
        {children}
      </button>
    );
  }
);

QRButton.displayName = "QRButton";

export { QRButton };
