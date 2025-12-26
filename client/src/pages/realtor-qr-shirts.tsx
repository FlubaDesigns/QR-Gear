import { Building2, CheckCircle, Sparkles, Home, MapPin, Calendar, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Update the listing link anytime",
  "Same polo - different property every week",
  "Track which listings get the most scans",
  "Open house? Update for the weekend",
  "No reprinting, no new shirts needed",
];

const scenarios = [
  {
    icon: Home,
    title: "Weekly Listings",
    description: "Monday it's the downtown condo. Friday it's the lakefront estate. Same shirt, different property.",
  },
  {
    icon: Calendar,
    title: "Open House Ready",
    description: "Update to the current listing before each open house. Visitors scan and get all the details.",
  },
  {
    icon: MapPin,
    title: "Neighborhood Tours",
    description: "Walking a new client around? Point to your shirt. They scan, they see the listing.",
  },
  {
    icon: Building2,
    title: "Portfolio Showcase",
    description: "Link to your full listings page. Or rotate through featured properties. You control it.",
  },
];

export default function RealtorQRShirts() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Realtor QR Shirts | One Polo, Infinite Listings | QR Gear"
        description="Create realtor shirts with QR codes you can update for every listing. Same polo, different property every week. Track scans and engagement. No reprinting needed."
        keywords="realtor QR shirt, real estate polo, listing QR code, open house shirt, agent merchandise, property QR"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Building2 className="w-8 h-8 md:w-10 md:h-10 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">QR Dynamics™</p>
              <h1 className="text-2xl md:text-4xl font-bold">Realtor QR Shirts</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">One polo, infinite listings.</p>
          <p className="text-lg text-muted-foreground mb-4">
            Monday it's the downtown condo. Friday it's the lakefront estate. 
            Same shirt. Different property every week.
          </p>
          <p className="text-lg text-muted-foreground mb-8 italic">
            Your wardrobe stays simple. Your listings stay fresh.
          </p>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-500" />
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
            <h2 className="font-semibold mb-6">How realtors use it:</h2>
            <div className="grid gap-4">
              {scenarios.map((scenario, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <scenario.icon className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="font-medium">{scenario.title}</h3>
                    <p className="text-sm text-muted-foreground">{scenario.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 mb-8 bg-emerald-500/5 border-emerald-500/20">
            <div className="flex items-start gap-4">
              <MapPin className="w-8 h-8 text-emerald-500 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Dress code friendly</h3>
                <p className="text-sm text-muted-foreground">
                  Polo shirts and professional apparel that look sharp at showings. 
                  The QR is subtle but scannable. Professional meets practical.
                </p>
              </div>
            </div>
          </Card>

          <Link href="/creator?line=dynamics">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-realtor">
              Create Your Realtor Shirt
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Card className="p-6 mt-8">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Related Ideas
            </h2>
            <div className="grid gap-3">
              <Link href="/business-qr-plus">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Business QR Plus</span>
                  <p className="text-sm text-muted-foreground">Professional with text prompts</p>
                </div>
              </Link>
              <Link href="/networking-qr-shirts">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Networking Shirts</span>
                  <p className="text-sm text-muted-foreground">Save contacts instantly</p>
                </div>
              </Link>
              <Link href="/business-analytics-qr">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Business Analytics QR</span>
                  <p className="text-sm text-muted-foreground">Track engagement and performance</p>
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
