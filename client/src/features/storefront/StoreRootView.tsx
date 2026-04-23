/**
 * StoreRootView — renders the QR Gear parent store landing page.
 *
 * Route: /shop/internal/qrgear
 *
 * Responsibilities:
 *  - QR Gear identity block (title, tagline, description)
 *  - Featured channel tiles (driven by config, not hardcoded)
 *  - Entry point into experiences/channels
 */

import { Link } from "wouter";
import { ArrowLeft, ArrowRight, QrCode, Flag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StorefrontLayout from "@/components/StorefrontLayout";
import type { StoreConfig } from "@/data/shopHierarchy";

interface StoreRootViewProps {
  storeConfig: StoreConfig;
}

const CHANNEL_ICONS: Record<string, typeof Flag> = {
  usa250: Flag,
};

export function StoreRootView({ storeConfig }: StoreRootViewProps) {
  const storeBasePath = `/shop/${storeConfig.storeType}/${storeConfig.storeName}`;

  return (
    <StorefrontLayout>
      <div className="container max-w-6xl py-8 px-4">
        <Link href="/">
          <Button variant="ghost" className="mb-6" data-testid="button-back-home">
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back to Home
          </Button>
        </Link>

        {/* Store identity block */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <QrCode className="h-7 w-7 text-primary" />
            </div>
            <h1
              className="text-4xl md:text-5xl font-bold"
              data-testid="text-store-title"
            >
              {storeConfig.label}
            </h1>
          </div>
          <p className="text-base font-medium text-muted-foreground mb-2">
            {storeConfig.tagline}
          </p>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            {storeConfig.description}
          </p>
        </div>

        {/* Featured channels / experiences */}
        {storeConfig.channels.length > 0 && (
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Experiences</h2>
              <p className="text-sm text-muted-foreground">
                Browse curated QR Gear collections
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {storeConfig.channels.map((channel) => {
                const IconComponent = CHANNEL_ICONS[channel.slug] ?? Flag;
                return (
                  <Link
                    key={channel.slug}
                    href={`${storeBasePath}/${channel.slug}`}
                  >
                    <Card
                      className="hover-elevate cursor-pointer h-full"
                      data-testid={`card-channel-${channel.slug}`}
                    >
                      <CardContent className="p-6 flex flex-col gap-2">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-1">
                          <IconComponent className="h-5 w-5 text-primary" />
                        </div>
                        <h3 className="font-semibold text-lg">{channel.label}</h3>
                        <p className="text-sm text-muted-foreground flex-1">
                          {channel.intro}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-primary font-medium mt-2">
                          Enter <ArrowRight className="h-3 w-3" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </StorefrontLayout>
  );
}
