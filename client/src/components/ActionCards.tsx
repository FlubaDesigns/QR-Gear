import { Link } from "wouter";
import { QRButton } from "@/components/QRButton";
import { QrCode, Type, Palette, Upload, Sparkles, ShoppingBag, Shield } from "lucide-react";

const actionCards = [
  {
    icon: QrCode,
    title: "QR Basics",
    state: "Permanent",
    description: "A simple, scannable QR code. Text, URL, or contact info encoded permanently.",
    tagline: "No updates. No subscriptions.",
    href: "/qr-static",
    color: "ice",
  },
  {
    icon: Type,
    title: "QR Plus",
    state: "Permanent + Messaging",
    description: "Add a message above and below your QR. Perfect for calls-to-action and instructions.",
    tagline: "Printed once. Works forever.",
    href: "/qr-static-plus",
    color: "accent",
  },
  {
    icon: Palette,
    title: "QR Canvas",
    state: "Visual Space",
    description: "Design a custom image your QR opens to. Your QR Space. Your visual.",
    tagline: "Saved to your personal library.",
    href: "/qr-url",
    color: "ice",
  },
  {
    icon: Upload,
    title: "QR Play",
    state: "Motion",
    description: "Bring your QR to life with video. Plays instantly in your QR Space.",
    tagline: "No apps. Just scan.",
    href: "/qr-video",
    color: "accent",
  },
  {
    icon: Sparkles,
    title: "QR Dynamics™",
    state: "Living Space",
    description: "Content that changes over time. Scheduled updates, rotating content, analytics.",
    tagline: "Available as yearly or multi-year personal QR Spaces.",
    href: "/qr-dynamics",
    color: "ice",
  },
];

export default function ActionCards() {
  return (
    <section className="home-section">
      <div className="container">
        <div className="section-header">
          <h2>Choose Your QR Product Line</h2>
          <p>Five ways to create custom QR merchandise for any purpose</p>
        </div>

        <div className="action-cards-grid">
          {actionCards.map((card, index) => (
            <Link 
              key={index}
              href={card.href}
              className="action-card"
              data-testid={`action-card-${index}`}
            >
              <div className="glass-card action-card-inner hover-elevate">
                <div className={`action-card-icon icon-bg-${card.color}`}>
                  <card.icon className={`icon-color-${card.color}`} />
                </div>
                <h3>{card.title}</h3>
                <span className="action-card-state">{card.state}</span>
                <p className="action-card-description">{card.description}</p>
                <p className="action-card-tagline">{card.tagline}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function QuickLinks() {
  return (
    <section className="home-section-muted">
      <div className="container">
        <div className="quick-links-grid">
          <div className="glass-card quick-link-card hover-elevate" data-testid="quick-link-shop">
            <div className="quick-link-icon icon-color-ice">
              <ShoppingBag />
            </div>
            <h3>Browse Products</h3>
            <p>Shop our full catalog of QR-enabled merchandise</p>
            <Link href="/store">
              <QRButton variant="ghost" size="small" data-testid="button-browse-products">
                View Store
              </QRButton>
            </Link>
          </div>

          <div className="glass-card quick-link-card hover-elevate" data-testid="quick-link-account">
            <div className="quick-link-icon icon-color-accent">
              <QrCode />
            </div>
            <h3>My QR Designs</h3>
            <p>View and manage your saved QR designs and orders</p>
            <Link href="/account">
              <QRButton variant="ghost" size="small" data-testid="button-my-designs">
                My Account
              </QRButton>
            </Link>
          </div>

          <div className="glass-card quick-link-card hover-elevate" data-testid="quick-link-admin">
            <div className="quick-link-icon icon-color-ice">
              <Shield />
            </div>
            <h3>Admin Dashboard</h3>
            <p>Manage products, pricing, and store settings</p>
            <Link href="/admin">
              <QRButton variant="ghost" size="small" data-testid="button-admin-dashboard">
                Admin Panel
              </QRButton>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
