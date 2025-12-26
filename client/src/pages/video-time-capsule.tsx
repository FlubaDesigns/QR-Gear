import { Clock, CheckCircle, Play, Heart, Baby, GraduationCap, Gift, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Record a message for the future",
  "Scan years later to hear your own voice",
  "Perfect for kids, partners, or yourself",
  "Cloud-hosted and preserved",
  "A gift that gains meaning with time",
];

const ideas = [
  {
    icon: Baby,
    title: "For Your Child",
    description: "Record a message when they're born. Give them the shirt on their 18th birthday. Watch them cry (happy tears).",
  },
  {
    icon: Heart,
    title: "For Your Partner",
    description: "Anniversary coming up? Record why you love them. Save it for a decade from now.",
  },
  {
    icon: GraduationCap,
    title: "For Your Future Self",
    description: "What would you tell yourself 10 years from now? Record it. Wear the reminder.",
  },
  {
    icon: Gift,
    title: "Milestone Moments",
    description: "Graduations, weddings, new jobs. Capture the feeling right now. Relive it whenever you scan.",
  },
];

export default function VideoTimeCapsule() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Video Time Capsule | A Message for Tomorrow | QR Gear"
        description="Record a video for your child, partner, or future self. Years later, one scan brings your voice back to life. The gift that gains meaning with time."
        keywords="video time capsule, future message, message for child, future self video, time capsule shirt, milestone gift"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <Clock className="w-8 h-8 md:w-10 md:h-10 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">QR Play</p>
              <h1 className="text-2xl md:text-4xl font-bold">Video Time Capsule</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">A message for tomorrow.</p>
          <p className="text-lg text-muted-foreground mb-4">
            Record a video for your child, partner, or future self. 
            Years later, one scan brings your voice back to life.
          </p>
          <p className="text-lg text-muted-foreground mb-8 italic">
            The gift that gains meaning with time.
          </p>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
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
            <h2 className="font-semibold mb-6">Time capsule ideas:</h2>
            <div className="grid gap-4">
              {ideas.map((idea, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <idea.icon className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-medium">{idea.title}</h3>
                    <p className="text-sm text-muted-foreground">{idea.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 mb-8 bg-amber-500/5 border-amber-500/20">
            <div className="flex items-start gap-4">
              <Gift className="w-8 h-8 text-amber-500 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Save it for the right moment</h3>
                <p className="text-sm text-muted-foreground">
                  Create it now, give it later. Store the shirt in a memory box. 
                  When the time comes, it'll be the most meaningful gift they've ever received.
                </p>
              </div>
            </div>
          </Card>

          <Link href="/creator?line=video">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-time-capsule">
              Create Your Time Capsule
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Card className="p-6 mt-8">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              Related Ideas
            </h2>
            <div className="grid gap-3">
              <Link href="/family-video-messages">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Family Video Messages</span>
                  <p className="text-sm text-muted-foreground">Home in their pocket</p>
                </div>
              </Link>
              <Link href="/memorial-video-shirts">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Memorial Video Shirts</span>
                  <p className="text-sm text-muted-foreground">Keep voices alive</p>
                </div>
              </Link>
              <Link href="/advent-qr-shirts">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Advent QR Shirts</span>
                  <p className="text-sm text-muted-foreground">Daily reveals and countdowns</p>
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
