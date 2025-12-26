import { Heart, CheckCircle, Play, Camera, Users, Star, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Upload a video of your loved one",
  "Their voice, their laugh, their stories - preserved",
  "Scan anytime to see them again",
  "Cloud-hosted for reliable playback",
  "Share the same design with family",
];

const ideas = [
  {
    title: "Their Favorite Story",
    description: "That fishing tale. The embarrassing wedding toast. The bedtime story. Forever on video.",
  },
  {
    title: "A Message They Left",
    description: "A birthday greeting. A word of advice. A simple 'I love you.' One scan brings them back.",
  },
  {
    title: "Clips That Capture Them",
    description: "Laughing. Cooking. Dancing in the kitchen. The little moments that meant everything.",
  },
  {
    title: "Family Remembrances",
    description: "Multiple family members share memories. A video tribute everyone can wear.",
  },
];

export default function MemorialVideoShirts() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Memorial Video Shirts | Keep Their Voice Alive | QR Gear"
        description="Create memorial shirts with QR codes that play video of your loved one. Their voice, their laugh, their stories - preserved forever. Scan anytime to see them again."
        keywords="memorial video shirt, remembrance video gift, loved one video QR, tribute shirt, memorial keepsake, grandpa memorial"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0">
              <Heart className="w-8 h-8 md:w-10 md:h-10 text-rose-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">QR Play</p>
              <h1 className="text-2xl md:text-4xl font-bold">Memorial Video Shirts</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">Grandpa lives on.</p>
          <p className="text-lg text-muted-foreground mb-4">
            The hoodie has his photo. Scan it, and there he is — telling his favorite fishing story. Forever.
          </p>
          <p className="text-lg text-muted-foreground mb-8 italic">
            Their voice. Their laugh. Their stories. Always with you.
          </p>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-rose-500" />
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
            <h2 className="font-semibold mb-6 flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Video ideas:
            </h2>
            <div className="grid gap-4">
              {ideas.map((idea, i) => (
                <div key={i} className="border-l-2 border-rose-500/30 pl-4">
                  <h3 className="font-medium">{idea.title}</h3>
                  <p className="text-sm text-muted-foreground">{idea.description}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 mb-8 bg-rose-500/5 border-rose-500/20">
            <div className="flex items-start gap-4">
              <Users className="w-8 h-8 text-rose-500 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">For the whole family</h3>
                <p className="text-sm text-muted-foreground">
                  Order matching shirts for everyone who wants to carry that memory. 
                  Same video, same QR — different sizes for each person. Wear them together.
                </p>
              </div>
            </div>
          </Card>

          <Link href="/creator?line=video">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-memorial-video">
              Create Your Memorial Shirt
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Card className="p-6 mt-8">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Related Ideas
            </h2>
            <div className="grid gap-3">
              <Link href="/memorial-qr-gifts">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Memorial Photo Gifts</span>
                  <p className="text-sm text-muted-foreground">Photo-based remembrance shirts</p>
                </div>
              </Link>
              <Link href="/family-video-messages">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Family Video Messages</span>
                  <p className="text-sm text-muted-foreground">Comfort for those far from home</p>
                </div>
              </Link>
              <Link href="/video-time-capsule">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Video Time Capsule</span>
                  <p className="text-sm text-muted-foreground">Messages for the future</p>
                </div>
              </Link>
            </div>
          </Card>

          <Link href="/qr-video">
            <Button variant="ghost" className="w-full min-h-12 mt-4" data-testid="button-back-play">
              ← Back to QR Play
            </Button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
