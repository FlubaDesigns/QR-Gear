import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { QRButton } from "@/components/QRButton";
import { QrCode, Type, Palette, Upload, Sparkles, ShoppingBag, Shield } from "lucide-react";

const actionCards = [
  {
    icon: QrCode,
    title: "QR Basics",
    description: "A simple, scannable QR code. Text, URL, or contact info encoded permanently.",
    href: "/qr-static",
    buttonText: "Create QR Basics",
    color: "ice",
  },
  {
    icon: Type,
    title: "QR Plus",
    description: "Add a message above and below your QR. Perfect for calls-to-action.",
    href: "/qr-static-plus",
    buttonText: "Create QR Plus",
    color: "accent",
  },
  {
    icon: Palette,
    title: "QR Canvas",
    description: "Design a custom image your QR opens to. Your QR Space, your visual.",
    href: "/qr-url",
    buttonText: "Create QR Canvas",
    color: "ice",
  },
  {
    icon: Upload,
    title: "QR Play",
    description: "Bring your QR to life with video. Plays instantly in your QR Space.",
    href: "/qr-video",
    buttonText: "Create QR Play",
    color: "accent",
  },
  {
    icon: Sparkles,
    title: "QR Dynamics™",
    description: "Content that changes over time. Scheduled updates, rotating content, analytics.",
    href: "/qr-dynamics",
    buttonText: "Create QR Dynamics",
    color: "ice",
  },
];

export default function ActionCards() {
  return (
    <section className="py-16">
      <div className="container">
        <div className="center mb-10">
          <h2>Choose Your QR Product Line</h2>
          <p>Five ways to create custom QR merchandise for any purpose</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {actionCards.map((card, index) => (
            <Link 
              key={index}
              href={card.href}
              className="block"
              data-testid={`action-card-${index}`}
            >
              <Card className="glass-card border-0 hover-elevate active:scale-[0.98] transition-all h-full cursor-pointer">
                <CardContent className="p-6 flex flex-col h-full">
                  <div className={`w-12 h-12 rounded-xl icon-bg-${card.color} flex items-center justify-center mb-4`}>
                    <card.icon className={`w-6 h-6 icon-color-${card.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{card.title}</h3>
                  <p className="text-sm text-muted-foreground flex-1">{card.description}</p>
                </CardContent>
              </Card>
            </Link>
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
