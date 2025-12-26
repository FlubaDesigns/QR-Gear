import { Calendar, CheckCircle, Sparkles, Gift, Star, Church, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Schedule different content for each day",
  "Set it once, it runs itself",
  "Perfect for countdowns and daily reveals",
  "Works with any content - verses, tips, surprises",
  "Includes scan analytics to see engagement",
];

const ideas = [
  {
    icon: Church,
    title: "Advent Devotionals",
    description: "Day 1: A new devotional. Day 2: A different verse. Day 12: The grand finale. Daily spiritual content, automated.",
  },
  {
    icon: Gift,
    title: "12 Days of Christmas",
    description: "Each day reveals a new surprise. Recipes, memories, song lyrics, family traditions.",
  },
  {
    icon: Star,
    title: "Birthday Countdowns",
    description: "7 days of birthday messages. Each day, they scan and get a new video, photo, or note from someone who loves them.",
  },
  {
    icon: Calendar,
    title: "Daily Tips & Wisdom",
    description: "30 days of fitness tips. A month of inspirational quotes. Daily recipes. Whatever sequence you want.",
  },
];

export default function AdventQRShirts() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Advent QR Shirts | 12 Days of Christmas, Automated | QR Gear"
        description="Create shirts with QR codes that reveal different content each day. Perfect for Advent devotionals, Christmas countdowns, and daily sequences. Set it once, it runs itself."
        keywords="advent calendar QR, 12 days christmas shirt, daily QR content, countdown shirt, devotional QR, scheduled QR"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0">
              <Calendar className="w-8 h-8 md:w-10 md:h-10 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">QR Dynamics™</p>
              <h1 className="text-2xl md:text-4xl font-bold">Advent QR Shirts</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">12 Days of Christmas, automated.</p>
          <p className="text-lg text-muted-foreground mb-4">
            Day 1: A new devotional. Day 2: A different verse. Day 12: The grand finale. 
            Set it once. It runs itself.
          </p>
          <p className="text-lg text-muted-foreground mb-8 italic">
            Daily reveals without daily work.
          </p>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-red-500" />
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
            <h2 className="font-semibold mb-6">Sequence ideas:</h2>
            <div className="grid gap-4">
              {ideas.map((idea, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                    <idea.icon className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-medium">{idea.title}</h3>
                    <p className="text-sm text-muted-foreground">{idea.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 mb-8 bg-red-500/5 border-red-500/20">
            <div className="flex items-start gap-4">
              <Gift className="w-8 h-8 text-red-500 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Great for groups</h3>
                <p className="text-sm text-muted-foreground">
                  Church groups, families, friend circles - everyone wears the same shirt. 
                  Each day brings a new conversation starter.
                </p>
              </div>
            </div>
          </Card>

          <Link href="/creator?line=dynamics">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-advent">
              Create Your Advent Shirt
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Card className="p-6 mt-8">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              Related Ideas
            </h2>
            <div className="grid gap-3">
              <Link href="/video-time-capsule">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Video Time Capsule</span>
                  <p className="text-sm text-muted-foreground">Messages for the future</p>
                </div>
              </Link>
              <Link href="/band-dynamic-merch">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Band Dynamic Merch</span>
                  <p className="text-sm text-muted-foreground">Updateable musician content</p>
                </div>
              </Link>
              <Link href="/event-qr-shirts">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Event QR Shirts</span>
                  <p className="text-sm text-muted-foreground">Perfect for gatherings</p>
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
