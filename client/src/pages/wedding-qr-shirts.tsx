import { Heart, CheckCircle, Sparkles, Camera, Users, Gift, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Upload your favorite wedding photo",
  "Each guest gets a unique, personal keepsake",
  "Scan years later - memories come flooding back",
  "Perfect for rehearsal dinners, bachelorette parties, or the big day",
  "Optional text printed on the shirt (names, date, hashtag)",
];

const ideas = [
  {
    title: "First Dance Photo",
    description: "Capture that magical moment. Every time someone scans, they see you two dancing.",
  },
  {
    title: "Engagement Shoot",
    description: "Those gorgeous photos deserve more than a frame. Put them on shirts your guests will actually wear.",
  },
  {
    title: "The Whole Crew",
    description: "Wedding party shirts with the group photo. Bridesmaids and groomsmen will love it.",
  },
  {
    title: "Save the Date Shirts",
    description: "Pre-wedding hype. Guests scan to see details, photos, or your wedding website.",
  },
];

export default function WeddingQRShirts() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Wedding QR Shirts | Custom Photo Favors Your Guests Will Keep | QR Gear"
        description="Create unique wedding favor shirts with scannable QR codes. Guests scan to see your wedding photos. Personal, memorable, and they'll actually wear them. USA options available."
        keywords="wedding favors, wedding shirts, custom wedding gifts, QR wedding favors, photo wedding shirts, unique wedding ideas, personalized wedding gifts"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-pink-500/10 flex items-center justify-center shrink-0">
              <Heart className="w-8 h-8 md:w-10 md:h-10 text-pink-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">QR Canvas</p>
              <h1 className="text-2xl md:text-4xl font-bold">Wedding QR Shirts</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">Wearable wedding favors that actually mean something.</p>
          <p className="text-lg text-muted-foreground mb-4">
            Forget the koozies nobody keeps. Give your guests something unique and personal — 
            a shirt they'll wear for years. And when they scan the QR? Your wedding photo fills their screen.
          </p>
          <p className="text-lg text-muted-foreground mb-8 italic">
            "Years later, they scan and see the couple's first dance photo. Timeless."
          </p>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-pink-500" />
              Why couples love this:
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
              <Camera className="w-5 h-5 text-primary" />
              Photo Ideas:
            </h2>
            <div className="grid gap-4">
              {ideas.map((idea, i) => (
                <div key={i} className="border-l-2 border-pink-500/30 pl-4">
                  <h3 className="font-medium">{idea.title}</h3>
                  <p className="text-sm text-muted-foreground">{idea.description}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 mb-8 bg-pink-500/5 border-pink-500/20">
            <div className="flex items-start gap-4">
              <Gift className="w-8 h-8 text-pink-500 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Bulk orders? We've got you.</h3>
                <p className="text-sm text-muted-foreground">
                  Planning for 50+ guests? Reach out for volume pricing. Every shirt is made-to-order with your custom QR.
                </p>
              </div>
            </div>
          </Card>

          <Link href="/creator?line=url">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-wedding">
              Create Your Wedding Shirts
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Card className="p-6 mt-8">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Related Ideas
            </h2>
            <div className="grid gap-3">
              <Link href="/family-reunion-shirts">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Family Reunion Shirts</span>
                  <p className="text-sm text-muted-foreground">Photo memories for the whole family</p>
                </div>
              </Link>
              <Link href="/memorial-qr-gifts">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Memorial Photo Gifts</span>
                  <p className="text-sm text-muted-foreground">Honor loved ones with lasting tributes</p>
                </div>
              </Link>
              <Link href="/artist-qr-apparel">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Artist Portfolio Shirts</span>
                  <p className="text-sm text-muted-foreground">Turn your artwork into wearables</p>
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
