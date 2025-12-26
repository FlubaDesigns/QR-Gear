import { Palette, CheckCircle, Camera, Brush, Image, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Your artwork fills their entire screen when scanned",
  "No cropping, no compression — full resolution display",
  "Mobile-optimized 9:16 vertical format",
  "Works for paintings, photos, digital art, designs",
  "Add your signature, title, or website as printed text",
];

const artistTypes = [
  {
    title: "Painters & Illustrators",
    description: "Your canvas work, full screen. Every scan is a mini gallery showing.",
  },
  {
    title: "Photographers",
    description: "That shot you're most proud of. Not a thumbnail — the whole thing, high-res.",
  },
  {
    title: "Digital Artists & Designers",
    description: "Your portfolio piece becomes wearable. Clients scan and see your work instantly.",
  },
  {
    title: "Tattoo Artists",
    description: "Flash sheets or finished pieces. Walking advertisement that people actually want to look at.",
  },
];

export default function ArtistQRApparel() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Artist QR Apparel | Wearable Portfolio Shirts | QR Gear"
        description="Turn your artwork into wearable merch. When people scan, your art fills their screen. Perfect for painters, photographers, designers, and digital artists. USA options available."
        keywords="artist merch, custom artist shirts, photographer apparel, wearable portfolio, art QR shirts, designer merchandise, creative apparel"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-purple-500/10 flex items-center justify-center shrink-0">
              <Palette className="w-8 h-8 md:w-10 md:h-10 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">QR Canvas</p>
              <h1 className="text-2xl md:text-4xl font-bold">Artist QR Apparel</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">Your art, full screen.</p>
          <p className="text-lg text-muted-foreground mb-4">
            Painters, photographers, designers — your work becomes the destination. 
            When someone scans your shirt, your art fills their entire screen. No app. No gallery visit. Just your work, front and center.
          </p>
          <p className="text-lg text-muted-foreground mb-8 italic">
            "A portable gallery on every shirt."
          </p>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Why artists love this:
            </h2>
            <ul className="space-y-3">
              {features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-6 flex items-center gap-2">
              <Brush className="w-5 h-5 text-primary" />
              Made for creatives:
            </h2>
            <div className="grid gap-4">
              {artistTypes.map((type, i) => (
                <div key={i} className="border-l-2 border-purple-500/30 pl-4">
                  <h3 className="font-medium">{type.title}</h3>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 mb-8 bg-purple-500/5 border-purple-500/20">
            <div className="flex items-start gap-4">
              <Image className="w-8 h-8 text-purple-500 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Sell your merch</h3>
                <p className="text-sm text-muted-foreground">
                  Create once, sell forever. Your fans wear your art and become walking galleries. 
                  Each shirt is print-on-demand — no inventory, no minimums.
                </p>
              </div>
            </div>
          </Card>

          <Link href="/creator?line=url">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-artist">
              Create Your Artist Merch
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Card className="p-6 mt-8">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Brush className="w-5 h-5 text-primary" />
              Related Ideas
            </h2>
            <div className="grid gap-3">
              <Link href="/musician-merch">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Musician Merch</span>
                  <p className="text-sm text-muted-foreground">Album art and video shirts for bands</p>
                </div>
              </Link>
              <Link href="/band-dynamic-merch">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Band Dynamic Merch</span>
                  <p className="text-sm text-muted-foreground">Updateable tour dates and content</p>
                </div>
              </Link>
              <Link href="/wedding-qr-shirts">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Wedding Photo Shirts</span>
                  <p className="text-sm text-muted-foreground">Event photography on apparel</p>
                </div>
              </Link>
            </div>
          </Card>

          <Link href="/qr-url">
            <Button variant="ghost" className="w-full min-h-12 mt-4" data-testid="button-back-canvas">
              ← Back to QR Canvas
            </Button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
