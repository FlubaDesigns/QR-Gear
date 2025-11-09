import { Link } from "wouter";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  const cartItemCount = 0;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 hover-elevate active-elevate-2 px-2 py-1 rounded-md">
          <span className="text-2xl font-heading font-bold">
            QR<span className="text-primary">Gear</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-shop">
            Shop
          </Link>
          <Link href="/creator" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-creator">
            Custom Creator
          </Link>
          <Link href="/gallery" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-gallery">
            Gallery
          </Link>
          <Link href="/account" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-account">
            Account
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" className="relative" data-testid="button-cart">
            <ShoppingCart className="h-5 w-5" />
            {cartItemCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                {cartItemCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
