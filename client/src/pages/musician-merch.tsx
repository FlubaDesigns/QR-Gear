import { Music, CheckCircle, Play, Disc, Users, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const canvasFeatures = [
  "Album art fills the screen when scanned",
  "High-res display, no cropping",
  "Add band name or song title as printed text",
  "Perfect for tour merch or online sales",
  "Each shirt is print-on-demand — no inventory",
];

const playFeatures = [
  "Upload a music video or live performance",
  "Fans scan and your video plays instantly",
  "No app needed — works in any phone browser",
  "Exclusive content your fans can wear",
];

const ideas = [
  {
    title: "Album Art Shirts",
    description: "Your cover art deserves better than a tiny square. Full screen, high res, every scan.",
  },
  {
    title: "Tour Merch",
    description: "Each city gets a shirt. Fans scan to see tour photos or exclusive behind-the-scenes.",
  },
  {
    title: "Music Video Shirts",
    description: "Upgrade to QR Play — fans scan and your video starts playing. Wearable media.",
  },
  {
    title: "Exclusive Drops",
    description: "Limited edition merch with unreleased content. Only people with the shirt can see it.",
  },
];

export default function MusicianMerch() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Musician Merch | Band Shirts with Scannable Media | QR Gear"
        description="Create band merch with scannable QR codes. Fans scan to see album art or watch music videos. Perfect for tours, album drops, and exclusive content. USA options available."
        keywords="band merch, musician shirts, album art shirts, tour merchandise, music video shirts, artist merch, band merchandise, QR music"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-orange-500/10 flex items-center justify-center shrink-0">
              <Music className="w-8 h-8 md:w-10 md:h-10 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">QR Canvas + QR Play</p>
              <h1 className="text-2xl md:text-4xl font-bold">Musician Merch</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">Merch that plays.</p>
          <p className="text-lg text-muted-foreground mb-4">
            Your fans don't just wear your shirt — they interact with it. 
            Album art that fills their screen. Music videos that play on scan. 
            This is merch for the streaming era.
          </p>
          <p className="text-lg text-muted-foreground mb-8 italic">
            "Album art that plays when scanned."
          </p>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Disc className="w-5 h-5 text-orange-500" />
              QR Canvas — Album Art:
            </h2>
            <ul className="space-y-3">
              {canvasFeatures.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Play className="w-5 h-5 text-orange-500" />
              QR Play — Video Content:
            </h2>
            <ul className="space-y-3">
              {playFeatures.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-6 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Ideas for your drop:
            </h2>
            <div className="grid gap-4">
              {ideas.map((idea, i) => (
                <div key={i} className="border-l-2 border-orange-500/30 pl-4">
                  <h3 className="font-medium">{idea.title}</h3>
                  <p className="text-sm text-muted-foreground">{idea.description}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 mb-8 bg-orange-500/5 border-orange-500/20">
            <div className="flex items-start gap-4">
              <Users className="w-8 h-8 text-orange-500 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">No minimums, no inventory</h3>
                <p className="text-sm text-muted-foreground">
                  Every shirt is made when ordered. Sell through your website, at shows, or wherever your fans find you. 
                  You focus on the music — we handle the printing.
                </p>
              </div>
            </div>
          </Card>

          <div className="grid gap-3 mb-4">
            <Link href="/creator?line=url">
              <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-album-art">
                Create Album Art Merch (QR Canvas)
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/creator?line=video">
              <Button size="lg" variant="outline" className="w-full min-h-14 text-lg" data-testid="button-create-video-merch">
                Create Video Merch (QR Play)
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>

          <Card className="p-6 mt-8">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Related Ideas
            </h2>
            <div className="grid gap-3">
              <Link href="/artist-qr-apparel">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Artist Portfolio Shirts</span>
                  <p className="text-sm text-muted-foreground">Wearable gallery for visual artists</p>
                </div>
              </Link>
              <Link href="/band-dynamic-merch">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Band Dynamic Merch</span>
                  <p className="text-sm text-muted-foreground">Updateable tour dates and setlists</p>
                </div>
              </Link>
              <Link href="/event-qr-shirts">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Event QR Shirts</span>
                  <p className="text-sm text-muted-foreground">Perfect for concerts and festivals</p>
                </div>
              </Link>
            </div>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <Link href="/qr-url" className="flex-1">
              <Button variant="ghost" className="w-full min-h-12" data-testid="button-back-canvas">
                ← Back to QR Canvas
              </Button>
            </Link>
            <Link href="/qr-video" className="flex-1">
              <Button variant="ghost" className="w-full min-h-12" data-testid="button-see-play">
                See QR Play →
              </Button>
            </Link>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}
