import { Music, CheckCircle, Sparkles, Disc, Radio, TrendingUp, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Update the destination anytime",
  "Tour ends? Switch to the new album",
  "Single drops? Link it instantly",
  "Same shirt - always current",
  "Track scans to see what fans engage with",
];

const scenarios = [
  {
    icon: Disc,
    title: "Album Releases",
    description: "Shirt linked to the old album? One click and it's pointing to the new one. No reprint.",
  },
  {
    icon: Radio,
    title: "Single Drops",
    description: "New single out Friday? Update the link Thursday night. Fans scan and hear it first.",
  },
  {
    icon: TrendingUp,
    title: "Tour Updates",
    description: "City to city, update the link to local show info, setlists, or exclusive content.",
  },
  {
    icon: Music,
    title: "Exclusive Content",
    description: "Rotate between behind-the-scenes, unreleased tracks, and fan Q&As. Keep them coming back.",
  },
];

export default function BandDynamicMerch() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Band Dynamic Merch | Merch That Never Goes Stale | QR Gear"
        description="Create band merch with QR codes you can update anytime. Tour ends? New album? Just update the link. Same shirt, always current. Track fan engagement."
        keywords="band merch QR, dynamic band shirt, updateable merch, tour merchandise, musician QR, album merch"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-violet-500/10 flex items-center justify-center shrink-0">
              <Music className="w-8 h-8 md:w-10 md:h-10 text-violet-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">QR Dynamics™</p>
              <h1 className="text-2xl md:text-4xl font-bold">Band Dynamic Merch</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">Merch that never goes stale.</p>
          <p className="text-lg text-muted-foreground mb-4">
            Tour ends? Update to the new album. Single drops? Link it. 
            Same shirt — always current.
          </p>
          <p className="text-lg text-muted-foreground mb-8 italic">
            Your music evolves. So should your merch.
          </p>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-500" />
              What you get:
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
            <h2 className="font-semibold mb-6">Keep it current:</h2>
            <div className="grid gap-4">
              {scenarios.map((scenario, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                    <scenario.icon className="w-5 h-5 text-violet-500" />
                  </div>
                  <div>
                    <h3 className="font-medium">{scenario.title}</h3>
                    <p className="text-sm text-muted-foreground">{scenario.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 mb-8 bg-violet-500/5 border-violet-500/20">
            <div className="flex items-start gap-4">
              <TrendingUp className="w-8 h-8 text-violet-500 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">See what works</h3>
                <p className="text-sm text-muted-foreground">
                  Track every scan. Know which cities, which days, which content gets traction. 
                  Data that helps you connect with fans.
                </p>
              </div>
            </div>
          </Card>

          <Link href="/creator?line=dynamics">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-band-dynamic">
              Create Your Dynamic Merch
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Card className="p-6 mt-8">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Disc className="w-5 h-5 text-primary" />
              Related Ideas
            </h2>
            <div className="grid gap-3">
              <Link href="/musician-merch">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Musician Merch</span>
                  <p className="text-sm text-muted-foreground">Album art and video shirts</p>
                </div>
              </Link>
              <Link href="/artist-qr-apparel">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Artist Portfolio Shirts</span>
                  <p className="text-sm text-muted-foreground">Wearable gallery for creatives</p>
                </div>
              </Link>
              <Link href="/advent-qr-shirts">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Advent QR Shirts</span>
                  <p className="text-sm text-muted-foreground">Scheduled daily content</p>
                </div>
              </Link>
            </div>
          </Card>

          <Link href="/qr-dynamics">
            <Button variant="ghost" className="w-full min-h-12 mt-4" data-testid="button-back-dynamics">
              ← Back to QR Dynamics™
            </Button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
