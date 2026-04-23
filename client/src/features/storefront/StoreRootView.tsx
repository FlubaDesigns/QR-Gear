/**
 * StoreRootView — renders the QR Gear parent store landing page.
 *
 * Route: /shop/internal/qrgear
 */

import { Link } from "wouter";
import { ArrowRight, QrCode, ScanLine, Share2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StorefrontLayout from "@/components/StorefrontLayout";
import type { StoreConfig } from "@/data/shopHierarchy";
import heroImg from "@assets/store_hero.png";

interface StoreRootViewProps {
  storeConfig: StoreConfig;
}

const HOW_IT_WORKS = [
  { icon: ScanLine, text: "Scan the code with your phone" },
  { icon: QrCode,   text: "Unlock the story behind the design" },
  { icon: Share2,   text: "Share the experience with others" },
];

export function StoreRootView({ storeConfig }: StoreRootViewProps) {
  const storeBasePath = `/shop/${storeConfig.storeType}/${storeConfig.storeName}`;
  const primaryChannel = storeConfig.channels[0];

  return (
    <StorefrontLayout>
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden" style={{ minHeight: "520px" }}>
        <img
          src={heroImg}
          alt="QR Gear — Wear the Story"
          className="absolute inset-0 w-full h-full object-cover"
          data-testid="img-store-hero"
        />
        {/* Dark wash for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />

        <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-24">
          <h1
            className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-4 max-w-3xl leading-tight"
            data-testid="text-store-title"
          >
            Wear the Story.
            <br className="hidden sm:block" /> Scan the Experience.
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-xl mb-10 leading-relaxed">
            Each design connects to a deeper story through a scannable QR experience.
            History, meaning, and message — right on your shirt.
          </p>

          {primaryChannel && (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Link href={`${storeBasePath}/${primaryChannel.slug}`}>
                <Button
                  size="lg"
                  className="text-base px-8"
                  data-testid="button-hero-primary-cta"
                >
                  Explore the {primaryChannel.label} Collection
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href={`${storeBasePath}`}>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-base px-8 bg-white/10 border-white/40 text-white backdrop-blur-sm"
                  data-testid="button-hero-secondary-cta"
                >
                  Browse All Collections
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <div className="container max-w-4xl py-16 px-4">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold mb-2">Scan. Learn. Connect.</h2>
          <p className="text-muted-foreground">Every piece of QR Gear tells a story — here's how it works.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {HOW_IT_WORKS.map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex flex-col items-center text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium leading-snug">{text}</p>
            </div>
          ))}
        </div>

        {/* ── Channel entry cards ───────────────────────────────────────────── */}
        {storeConfig.channels.length > 0 && (
          <div className="mt-16 space-y-4">
            <h2 className="text-xl font-bold mb-6 text-center">Collections</h2>
            {storeConfig.channels.map((channel) => (
              <Link key={channel.slug} href={`${storeBasePath}/${channel.slug}`}>
                <Card
                  className="hover-elevate cursor-pointer"
                  data-testid={`card-channel-${channel.slug}`}
                >
                  <CardContent className="p-7 flex items-center justify-between gap-6 flex-wrap">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold mb-1">{channel.label}</h3>
                      <p className="text-muted-foreground text-sm leading-snug">
                        {channel.description}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="default"
                      className="flex-shrink-0"
                      tabIndex={-1}
                      data-testid={`button-enter-${channel.slug}`}
                    >
                      Explore <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </StorefrontLayout>
  );
}
