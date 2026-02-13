import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Shield, FlaskConical, Users, Sparkles, Store, Wand2, Layers, ArrowRight, Flag, Palette, Film, DollarSign, Image, Box, Type, Library, Package } from "lucide-react";
import Navbar from "@/components/Navbar";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import Hero from "@/components/Hero";
import ActionCards, { QuickLinks } from "@/components/ActionCards";
import HowItWorks from "@/components/HowItWorks";
import MarketingMessage, { HistoryTeaser } from "@/components/MarketingMessage";
import FeaturedProducts from "@/components/FeaturedProducts";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Product = {
  id: string;
  name: string;
  imageUrl?: string | null;
};

function AdminQuickAccess() {
  const { isAdmin } = useAuth();

  if (!isAdmin) return null;

  return (
    <div className="admin-quick-bar">
      <Link href="/admin" className="admin-quick-link" data-testid="link-admin-quick">
        <Shield className="w-4 h-4" />
        Admin Panel
      </Link>
      <Link href="/admin/products" className="admin-quick-link" data-testid="link-products">
        <FlaskConical className="w-4 h-4" />
        Products
      </Link>
      <Link href="/member" className="admin-quick-link" data-testid="link-member">
        <Users className="w-4 h-4" />
        Member Area
      </Link>
      <Link href="/member?wizard=super-simple" className="admin-quick-link" data-testid="link-super-simple-wizard">
        <Sparkles className="w-4 h-4" />
        Super Simple
      </Link>
      <Link href="/member?wizard=simple" className="admin-quick-link" data-testid="link-simple-wizard">
        <Wand2 className="w-4 h-4" />
        Simple Wizard
      </Link>
      <Link href="/member?wizard=advanced" className="admin-quick-link" data-testid="link-advanced-wizard">
        <Layers className="w-4 h-4" />
        Advanced
      </Link>
      <Link href="/admin/store-builder" className="admin-quick-link" data-testid="link-store-builder">
        <Store className="w-4 h-4" />
        Store Builder
      </Link>
    </div>
  );
}

function FeaturedStores() {
  const stores = [
    {
      title: "USA 250",
      subtitle: "Patriotic drops + limited runs",
      href: "/shop/usa/250",
      badge: "Preview Store",
      icon: <Flag className="w-5 h-5" />,
    },
    {
      title: "Wedding QR Shirts",
      subtitle: "Photo + video + RSVP memories",
      href: "/wedding-qr-shirts",
      badge: "Use Case",
      icon: <Sparkles className="w-5 h-5" />,
    },
    {
      title: "Memorial QR Gifts",
      subtitle: "Stories that live on",
      href: "/memorial-qr-gifts",
      badge: "Use Case",
      icon: <Users className="w-5 h-5" />,
    },
  ];

  return (
    <section className="px-4 md:px-6 lg:px-8 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Featured Stores</h2>
            <p className="text-muted-foreground">
              Click into a mini-store (even if it's not fully stocked yet). This is the public funnel.
            </p>
          </div>

          <Link href="/store" className="text-sm text-primary hover:underline inline-flex items-center gap-2" data-testid="link-browse-all-products">
            Browse all products
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map((s) => (
            <Card key={s.title} className="glass-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                  <div className="flex items-center gap-2">
                    {s.icon}
                    <h3 className="text-lg font-semibold text-foreground">{s.title}</h3>
                  </div>
                  <Badge variant="secondary">{s.badge}</Badge>
                </div>

                <p className="text-muted-foreground mb-5">{s.subtitle}</p>

                <Link href={s.href}>
                  <Button className="w-full" data-testid={`button-store-${s.title.replace(/\s+/g, "-").toLowerCase()}`}>
                    Enter
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function NoProductsYet() {
  return (
    <section className="px-4 md:px-6 lg:px-8 py-10">
      <div className="max-w-6xl mx-auto">
        <Card className="glass-card">
          <CardContent className="p-8 md:p-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-2">No products live yet</h2>
                <p className="text-muted-foreground">
                  That's fine — the public site is still "real" right now. Use the builders or click into a featured store
                  like <span className="text-foreground font-medium">USA 250</span> while inventory is being staged.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <Link href="/build">
                  <Button className="w-full sm:w-auto" data-testid="button-home-build">
                    Build Your QR Gear
                    <Wand2 className="w-4 h-4 ml-2" />
                  </Button>
                </Link>

                <Link href="/store">
                  <Button variant="secondary" className="w-full sm:w-auto" data-testid="button-home-store">
                    Browse Store
                    <Store className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export default function Home() {
  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const hasProducts = Array.isArray(products) && products.length > 0;

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="QR Gear - Custom QR Code Merchandise | Promotional Products"
        description="Create custom QR code merchandise with QR Gear. Apparel, hats, mugs, bags and more featuring your personalized QR codes. USA-made options available. Perfect for businesses, events, and leave-behind marketing."
        keywords="QR code merchandise, custom promotional products, QR code shirts, QR code hats, business marketing"
      />
      <Navbar />
      <BreadcrumbTrail />
      <AdminQuickAccess />

      <main className="flex-1">
        <Hero />
        <ActionCards />
        <div className="hidden md:block">
          <MarketingMessage />
        </div>
        <div className="hidden md:block">
          <HistoryTeaser />
        </div>
        <div className="hidden md:block">
          <QuickLinks />
        </div>
        <div className="hidden md:block">
          <HowItWorks />
        </div>
        <FeaturedStores />
        <div className="hidden md:block">
          {hasProducts ? <FeaturedProducts /> : <NoProductsYet />}
        </div>
      </main>

      <Footer />
    </div>
  );
}
