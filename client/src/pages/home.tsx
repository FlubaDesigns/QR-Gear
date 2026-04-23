import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Shield, FlaskConical, Users, Store, Wand2, ArrowRight, Flag, Palette, Film, DollarSign, Image, Box, Type, Library, Package, Sparkles, CheckCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
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
      <Link href="/members" className="admin-quick-link" data-testid="link-member">
        <Users className="w-4 h-4" />
        Member Dashboard
      </Link>
      <Link href="/admin/store-builder" className="admin-quick-link" data-testid="link-store-builder">
        <Store className="w-4 h-4" />
        Store Builder
      </Link>
    </div>
  );
}

function BecomeMember() {
  const benefits = [
    { text: "Design your own QR products and earn on every sale", icon: DollarSign },
    { text: "Access the full product builder with guided wizard", icon: Wand2 },
    { text: "Your own member studio to manage designs and orders", icon: Palette },
    { text: "No upfront costs — products are made when they sell", icon: CheckCircle },
  ];

  return (
    <section className="home-section">
      <div className="container">
        <Card className="glass-card overflow-visible">
          <CardContent className="p-8 md:p-12">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-8">
              <div className="flex-1 space-y-5">
                <div>
                  <Badge variant="secondary" className="mb-3">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Free to Join
                  </Badge>
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                    Become a Member
                  </h2>
                  <p className="text-muted-foreground mt-2 text-base md:text-lg max-w-xl">
                    Turn your ideas into real products. As a QR Gear member, you design custom 
                    merchandise with built-in QR codes and earn money every time someone buys your creation. 
                    No inventory, no risk.
                  </p>
                </div>

                <ul className="space-y-3">
                  {benefits.map((b, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="rounded-full p-1.5 bg-primary/10 mt-0.5 flex-shrink-0">
                        <b.icon className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-sm text-foreground">{b.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-3 w-full lg:w-auto lg:min-w-[200px]">
                <Link href="/members">
                  <Button className="w-full" data-testid="button-become-member">
                    <Users className="w-4 h-4 mr-2" />
                    Join Now
                  </Button>
                </Link>
                <Link href="/earn">
                  <Button variant="outline" className="w-full" data-testid="button-learn-earning">
                    Learn How You Earn
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <p className="text-xs text-muted-foreground text-center mt-1">
                  Sign up in seconds. Start building immediately.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function FeaturedStores() {
  const stores = [
    {
      title: "USA 250",
      subtitle: "Monuments, Armed Forces, Founding Fathers",
      href: "/shop/internal/qr-gear/usa250",
      badge: "Preview Store",
      icon: <Flag className="w-5 h-5" />,
    },
  ];

  return (
    <section className="px-4 md:px-6 lg:px-8 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Featured Stores</h2>
            <p className="text-muted-foreground">
              Explore curated collections of QR-embedded gear — each one tells a story worth wearing.
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
                <h2 className="text-xl font-semibold text-foreground mb-2">New drops coming soon</h2>
                <p className="text-muted-foreground">
                  Our catalog is being stocked. In the meantime, explore featured collections
                  like <span className="text-foreground font-medium">USA 250</span> or design your own custom QR gear.
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
        <BecomeMember />
        <FeaturedStores />
        {hasProducts ? (
          <div className="hidden md:block"><FeaturedProducts /></div>
        ) : (
          <NoProductsYet />
        )}
      </main>

      <Footer />
    </div>
  );
}
