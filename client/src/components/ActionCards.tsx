import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { QRButton } from "@/components/QRButton";
import { QrCode, Palette, Upload, Sparkles, ShoppingBag, Shield } from "lucide-react";

const actionCards = [
  {
    icon: QrCode,
    title: "Simple QR Products",
    description: "Enter any URL or text and we'll create a scannable QR code on your choice of apparel.",
    href: "/qr-static",
    buttonText: "Create Simple QR",
    color: "ice",
  },
  {
    icon: Palette,
    title: "Pre-Designed QR Gifts",
    description: "Choose from curated backgrounds - religious, sports, business themes - with your QR placed perfectly.",
    href: "/qr-url",
    buttonText: "Browse Designs",
    color: "accent",
  },
  {
    icon: Upload,
    title: "Fully Custom QR Gifts",
    description: "Upload your own image, add text overlays, and create a unique QR gift with hosted image viewing.",
    href: "/qr-video",
    buttonText: "Upload & Create",
    color: "ice",
  },
  {
    icon: Sparkles,
    title: "Dynamic QR Products",
    description: "Get a QR that links to a page you control - update the image anytime without reprinting.",
    href: "/qr-dynamics",
    buttonText: "Go Dynamic",
    color: "accent",
  },
];

export default function ActionCards() {
  return (
    <section className="py-16">
      <div className="container">
        <div className="center mb-10">
          <h2>Choose Your QR Product Line</h2>
          <p>Four ways to create custom QR merchandise for any purpose</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {actionCards.map((card, index) => (
            <Card 
              key={index} 
              className="glass-card border-0 hover-elevate transition-all"
              data-testid={`action-card-${index}`}
            >
              <CardContent className="p-6 flex flex-col h-full">
                <div className={`w-12 h-12 rounded-xl icon-bg-${card.color} flex items-center justify-center mb-4`}>
                  <card.icon className={`w-6 h-6 icon-color-${card.color}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{card.title}</h3>
                <p className="text-sm text-muted-foreground flex-1 mb-4">{card.description}</p>
                <Link href={card.href}>
                  <QRButton 
                    variant={card.color === "accent" ? "accent" : "ghost"} 
                    size="small"
                    className="w-full"
                    data-testid={`button-${card.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {card.buttonText}
                  </QRButton>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export function QuickLinks() {
  return (
    <section className="py-12 bg-muted/30">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="glass-card border-0 hover-elevate" data-testid="quick-link-shop">
            <CardContent className="p-6 text-center">
              <ShoppingBag className="w-10 h-10 mx-auto mb-3 icon-color-ice" />
              <h3 className="font-semibold mb-2">Browse Products</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Shop our full catalog of QR-enabled merchandise
              </p>
              <Link href="/store">
                <QRButton variant="ghost" size="small" data-testid="button-browse-products">
                  View Store
                </QRButton>
              </Link>
            </CardContent>
          </Card>

          <Card className="glass-card border-0 hover-elevate" data-testid="quick-link-account">
            <CardContent className="p-6 text-center">
              <QrCode className="w-10 h-10 mx-auto mb-3 icon-color-accent" />
              <h3 className="font-semibold mb-2">My QR Designs</h3>
              <p className="text-sm text-muted-foreground mb-4">
                View and manage your saved QR designs and orders
              </p>
              <Link href="/account">
                <QRButton variant="ghost" size="small" data-testid="button-my-designs">
                  My Account
                </QRButton>
              </Link>
            </CardContent>
          </Card>

          <Card className="glass-card border-0 hover-elevate" data-testid="quick-link-admin">
            <CardContent className="p-6 text-center">
              <Shield className="w-10 h-10 mx-auto mb-3 icon-color-ice" />
              <h3 className="font-semibold mb-2">Admin Dashboard</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Manage products, pricing, and store settings
              </p>
              <Link href="/admin">
                <QRButton variant="ghost" size="small" data-testid="button-admin-dashboard">
                  Admin Panel
                </QRButton>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
