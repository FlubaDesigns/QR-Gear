import { Link } from "wouter";
import { Facebook, Twitter, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import UsaFlag from "./UsaFlag";

export default function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="container mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="font-heading font-bold text-lg mb-4">About</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/about" className="hover:text-foreground transition-colors">Our Story</Link></li>
              <li><Link href="/sustainability" className="hover:text-foreground transition-colors">Sustainability</Link></li>
              <li><Link href="/careers" className="hover:text-foreground transition-colors">Careers</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-heading font-bold text-lg mb-4">Shop</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/shop/tshirts" className="hover:text-foreground transition-colors">T-Shirts</Link></li>
              <li><Link href="/shop/hats" className="hover:text-foreground transition-colors">Hats & Caps</Link></li>
              <li><Link href="/shop/bags" className="hover:text-foreground transition-colors">Bags & Accessories</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-heading font-bold text-lg mb-4">Support</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/faq" className="hover:text-foreground transition-colors">FAQ</Link></li>
              <li><Link href="/shipping" className="hover:text-foreground transition-colors">Shipping</Link></li>
              <li><Link href="/returns" className="hover:text-foreground transition-colors">Returns</Link></li>
              <li><Link href="/contact" className="hover:text-foreground transition-colors">Contact Us</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-heading font-bold text-lg mb-4">Newsletter</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get QR code inspiration weekly
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Email address"
                className="text-sm"
                data-testid="input-newsletter-email"
              />
              <Button size="sm" data-testid="button-newsletter-subscribe">Subscribe</Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t">
          <div className="flex items-center gap-4">
            <UsaFlag className="w-8 h-5" />
            <p className="text-sm text-muted-foreground">
              © 2024 QRGear. All rights reserved.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" data-testid="button-social-facebook">
              <Facebook className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" data-testid="button-social-twitter">
              <Twitter className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" data-testid="button-social-instagram">
              <Instagram className="w-5 h-5" />
            </Button>
            <p className="text-sm text-muted-foreground ml-4">
              Powered by Printify
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
