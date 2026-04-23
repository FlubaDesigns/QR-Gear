/**
 * StoreRootView — renders the QR Gear parent store landing page.
 *
 * Route: /shop/internal/qrgear
 */

import { Link } from "wouter";
import { ArrowRight, QrCode, ScanLine, Share2, ShoppingBag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />

        <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-24">
          <h1
            className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-4 max-w-3xl leading-tight"
            data-testid="text-store-title"
          >
            Wear the Story.
            <br className="hidden sm:block" /> Scan the Experience.
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mb-3 leading-relaxed">
            Premium apparel that goes deeper than a design. Every piece connects to a scannable
            story — history, tribute, and meaning right on your shirt.
          </p>
          <p className="text-base text-white/60 mb-10 italic">
            Wear history. Scan meaning. Share the story.
          </p>

          {primaryChannel && (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Link href={`${storeBasePath}/${primaryChannel.slug}`}>
                <Button
                  size="lg"
                  className="text-base px-8"
                  data-testid="button-hero-primary-cta"
                >
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  Shop the {primaryChannel.label} Collection
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
          <h2 className="text-2xl font-bold mb-2">More than apparel.</h2>
          <p className="text-muted-foreground">Each piece connects the physical to a digital experience — scan and discover.</p>
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
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold">Shop the Collections</h2>
              <p className="text-sm text-muted-foreground mt-1">Each collection is a curated drop built around a theme worth wearing.</p>
            </div>
            {storeConfig.channels.map((channel, i) => (
              <Link key={channel.slug} href={`${storeBasePath}/${channel.slug}`}>
                <Card
                  className="hover-elevate cursor-pointer"
                  data-testid={`card-channel-${channel.slug}`}
                >
                  <CardContent className="p-7 flex items-center justify-between gap-6 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold">{channel.label}</h3>
                        {i === 0 && (
                          <Badge variant="default" className="text-xs">
                            Popular
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm leading-snug">
                        {channel.intro}
                      </p>
                    </div>
                    <Button
                      variant="default"
                      size="default"
                      className="flex-shrink-0"
                      tabIndex={-1}
                      data-testid={`button-enter-${channel.slug}`}
                    >
                      Shop <ArrowRight className="ml-2 h-4 w-4" />
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
