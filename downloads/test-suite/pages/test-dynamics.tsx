import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Zap, Image, Video, Type, QrCode, Palette, Layers, Wand2, LayoutGrid, Play, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const DYNAMICS_FEATURES = [
  {
    icon: Image,
    title: "Background Images",
    description: "Upload or select from library. Auto-crop to 9:16 ratio for phone screens.",
    color: "text-blue-500",
  },
  {
    icon: Video,
    title: "Video Backgrounds",
    description: "Support for uploaded videos or YouTube/Vimeo URLs as dynamic backgrounds.",
    color: "text-purple-500",
  },
  {
    icon: Type,
    title: "Custom Text",
    description: "Header and footer text with font selection, sizing, color, and warp effects.",
    color: "text-green-500",
  },
  {
    icon: QrCode,
    title: "Smart QR Codes",
    description: "Auto-contrast QR codes that adapt to background luminance for scanability.",
    color: "text-orange-500",
  },
  {
    icon: Palette,
    title: "Style Presets",
    description: "Save and reuse text styles, backgrounds, and layouts as templates.",
    color: "text-pink-500",
  },
  {
    icon: Layers,
    title: "Multi-Placement",
    description: "Configure front-chest, front-center, back, and shoulder placements.",
    color: "text-cyan-500",
  },
  {
    icon: Wand2,
    title: "Auto-Landing Pages",
    description: "QR codes link to auto-generated landing pages with your content.",
    color: "text-yellow-500",
  },
  {
    icon: LayoutGrid,
    title: "Product Variants",
    description: "Apply designs across multiple product colors and sizes automatically.",
    color: "text-indigo-500",
  },
];

export default function TestDynamicsPage() {
  const [activeDemo, setActiveDemo] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/test-products">
            <Button 
              variant="outline" 
              size="default"
              className="min-h-[48px] min-w-[48px] bg-white/10 border-white/20 text-white hover:bg-white/20"
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Zap className="h-8 w-8 text-yellow-400" />
              QR Dynamics
            </h1>
            <p className="text-blue-200 mt-1">
              The most powerful QR product configuration mode
            </p>
          </div>
        </div>

        <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Play className="h-5 w-5 text-green-400" />
              What is QR Dynamics?
            </CardTitle>
            <CardDescription className="text-blue-200">
              QR Dynamics combines all the features of QR Canvas and QR Play, plus advanced 
              capabilities for creating fully customized, dynamic product experiences.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <div className="bg-blue-500/20 px-3 py-1.5 rounded-full text-sm">
                Background Images
              </div>
              <div className="bg-purple-500/20 px-3 py-1.5 rounded-full text-sm">
                Video Support
              </div>
              <div className="bg-green-500/20 px-3 py-1.5 rounded-full text-sm">
                Custom Text
              </div>
              <div className="bg-orange-500/20 px-3 py-1.5 rounded-full text-sm">
                Smart QR
              </div>
              <div className="bg-pink-500/20 px-3 py-1.5 rounded-full text-sm">
                Templates
              </div>
              <div className="bg-cyan-500/20 px-3 py-1.5 rounded-full text-sm">
                Multi-Placement
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {DYNAMICS_FEATURES.map((feature) => (
            <Card 
              key={feature.title}
              className="bg-white/5 backdrop-blur-lg border-white/10 text-white hover:bg-white/10 transition-colors cursor-pointer"
              onClick={() => setActiveDemo(feature.title)}
              data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s/g, "-")}`}
            >
              <CardContent className="pt-6">
                <feature.icon className={`h-10 w-10 ${feature.color} mb-3`} />
                <h3 className="font-semibold text-lg mb-1">{feature.title}</h3>
                <p className="text-sm text-blue-200">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {activeDemo && (
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 animate-spin" />
                {activeDemo} Configuration
              </CardTitle>
              <CardDescription className="text-blue-200">
                This is where detailed configuration for {activeDemo} would appear.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-8 border border-dashed border-white/30 rounded-lg text-center">
                <p className="text-white/60 text-sm">
                  Configuration UI for "{activeDemo}" coming soon...
                </p>
                <Button
                  variant="outline"
                  size="default"
                  className="mt-4 min-h-[48px] bg-white/10 border-white/20 text-white hover:bg-white/20"
                  onClick={() => setActiveDemo(null)}
                  data-testid="button-close-demo"
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 text-center">
          <Link href="/test-products">
            <Button 
              size="lg"
              className="min-h-[48px] bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0"
              data-testid="button-back-to-builder"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Products Builder
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
