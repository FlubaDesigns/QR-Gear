import { TrendingUp, CheckCircle, Sparkles, BarChart3, RefreshCw, Target, Users, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Track every scan with detailed analytics",
  "See which rep, location, or campaign gets traction",
  "Update the destination mid-campaign",
  "No reprint required - ever",
  "A/B test different landing pages",
];

const capabilities = [
  {
    icon: BarChart3,
    title: "Scan Analytics",
    description: "How many scans? When? Where? Data that tells you what's working.",
  },
  {
    icon: RefreshCw,
    title: "Mid-Campaign Updates",
    description: "Promotion changing? New offer? Update the link without touching the shirt.",
  },
  {
    icon: Target,
    title: "Performance Tracking",
    description: "Issue different shirts to different reps. See who drives the most engagement.",
  },
  {
    icon: Users,
    title: "Team Insights",
    description: "Which team member's shirt gets scanned most? Which event had the best response?",
  },
];

export default function BusinessAnalyticsQR() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Business Analytics QR | The Shirt That Reports Back | QR Gear"
        description="Create business shirts with QR codes that track every scan. See what gets traction, update destinations mid-campaign, and optimize your marketing. No reprint required."
        keywords="business QR analytics, marketing QR shirt, trackable QR, campaign QR, sales analytics shirt, team performance QR"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-cyan-500/10 flex items-center justify-center shrink-0">
              <TrendingUp className="w-8 h-8 md:w-10 md:h-10 text-cyan-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">QR Dynamics™</p>
              <h1 className="text-2xl md:text-4xl font-bold">Business Analytics QR</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">The shirt that reports back.</p>
          <p className="text-lg text-muted-foreground mb-4">
            Track every scan. See which rep gets traction. 
            Update the destination mid-campaign without printing a thing.
          </p>
          <p className="text-lg text-muted-foreground mb-8 italic">
            Marketing that measures itself.
          </p>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-500" />
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
            <h2 className="font-semibold mb-6">Business intelligence built in:</h2>
            <div className="grid gap-4">
              {capabilities.map((cap, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                    <cap.icon className="w-5 h-5 text-cyan-500" />
                  </div>
                  <div>
                    <h3 className="font-medium">{cap.title}</h3>
                    <p className="text-sm text-muted-foreground">{cap.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 mb-8 bg-cyan-500/5 border-cyan-500/20">
            <div className="flex items-start gap-4">
              <Target className="w-8 h-8 text-cyan-500 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Perfect for teams</h3>
                <p className="text-sm text-muted-foreground">
                  Each team member gets their own shirt, their own QR, their own analytics. 
                  Compare performance, optimize campaigns, reward top performers.
                </p>
              </div>
            </div>
          </Card>

          <Link href="/creator?line=dynamics">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-analytics">
              Create Your Analytics Shirt
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

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
