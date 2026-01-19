import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Zap, Image, Video, Type, QrCode, Palette, Layers, Wand2, LayoutGrid, Play, Settings } from "lucide-react";

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
    <div className="page-wrap" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}>
      <div className="container mobile-compact mobile-compact-stack">
        <div className="glass-card">
          <h1 className="glass-title text-lg flex items-center gap-2 mb-4" data-testid="text-page-title">
            <Zap className="h-5 w-5 text-yellow-400" />
            QR Dynamics
          </h1>
          <p className="text-base text-blue-200 mb-4">
            The most powerful QR product configuration mode
          </p>
          <Link href="/test-products" className="block">
            <button className="qr-btn qr-btn--primary qr-btn--touch qr-btn--full qr-btn--xl" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
              Back to Products
            </button>
          </Link>
        </div>

        <div className="glass-card">
          <h2 className="glass-title text-base flex items-center gap-2 mb-3">
            <Play className="h-5 w-5 text-green-400" />
            What is QR Dynamics?
          </h2>
          <p className="text-base text-blue-200 mb-4">
            Combines all features of QR Canvas and QR Play, plus advanced capabilities for fully customized, dynamic product experiences.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="bg-blue-500/20 px-3 py-1.5 rounded-full text-base text-blue-200">Background Images</span>
            <span className="bg-purple-500/20 px-3 py-1.5 rounded-full text-base text-purple-200">Video Support</span>
            <span className="bg-green-500/20 px-3 py-1.5 rounded-full text-base text-green-200">Custom Text</span>
            <span className="bg-orange-500/20 px-3 py-1.5 rounded-full text-base text-orange-200">Smart QR</span>
            <span className="bg-pink-500/20 px-3 py-1.5 rounded-full text-base text-pink-200">Templates</span>
            <span className="bg-cyan-500/20 px-3 py-1.5 rounded-full text-base text-cyan-200">Multi-Placement</span>
          </div>
        </div>

        <div className="glass-card">
          <h2 className="glass-title text-base mb-4">Features</h2>
          <div className="flex flex-col gap-3">
            {DYNAMICS_FEATURES.map((feature) => (
              <button
                key={feature.title}
                className={`qr-btn qr-btn--touch qr-btn--full text-left ${activeDemo === feature.title ? 'qr-btn--primary' : 'qr-btn--outline'}`}
                onClick={() => setActiveDemo(activeDemo === feature.title ? null : feature.title)}
                data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s/g, "-")}`}
              >
                <feature.icon className={`h-5 w-5 ${feature.color}`} />
                <span className="flex-1">{feature.title}</span>
              </button>
            ))}
          </div>
        </div>

        {activeDemo && (
          <div className="glass-card">
            <h2 className="glass-title text-base flex items-center gap-2 mb-3">
              <Settings className="h-5 w-5 animate-spin" />
              {activeDemo} Configuration
            </h2>
            <p className="text-base text-blue-200 mb-4">
              Configuration UI for "{activeDemo}" coming soon...
            </p>
            <button
              className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full"
              onClick={() => setActiveDemo(null)}
              data-testid="button-close-demo"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
