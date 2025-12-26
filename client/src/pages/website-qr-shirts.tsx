import { Link2, CheckCircle, Globe, Smartphone, Zap, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Your URL encoded directly in the QR",
  "One tap lands them on your site",
  "No typing, no searching, no mistakes",
  "Works with any website, portfolio, or booking page",
  "Permanent QR - never expires",
];

const useCases = [
  {
    title: "Portfolio Access",
    description: "Artists, designers, photographers - wear your work. They scan, your portfolio opens.",
  },
  {
    title: "Booking Pages",
    description: "Consultants, coaches, service providers - skip the 'how do I book you?' Just scan.",
  },
  {
    title: "Social Profiles",
    description: "Link to your Instagram, TikTok, YouTube, or LinkTree. One scan, all your links.",
  },
  {
    title: "Event Registration",
    description: "Running an event? Wear the registration link. Instant sign-ups wherever you go.",
  },
];

export default function WebsiteQRShirts() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Website QR Shirts | Wearable Links to Your Site | QR Gear"
        description="Create shirts with QR codes that link directly to your website, portfolio, or booking page. One scan lands them on your site. No typing required. USA options available."
        keywords="website QR shirt, portfolio QR code, wearable link, booking page QR, URL QR shirt, scannable website shirt"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <Link2 className="w-8 h-8 md:w-10 md:h-10 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">QR Basics</p>
              <h1 className="text-2xl md:text-4xl font-bold">Website QR Shirts</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">Instant website access.</p>
          <p className="text-lg text-muted-foreground mb-4">
            "Just scan my shirt." One tap lands them on your site, portfolio, or booking page. 
            No typing, no searching. Your URL, encoded and ready to go.
          </p>
          <p className="text-lg text-muted-foreground mb-8 italic">
            The easiest business card you'll ever hand out.
          </p>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-500" />
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
              <Globe className="w-5 h-5 text-primary" />
              Perfect for:
            </h2>
            <div className="grid gap-4">
              {useCases.map((use, i) => (
                <div key={i} className="border-l-2 border-blue-500/30 pl-4">
                  <h3 className="font-medium">{use.title}</h3>
                  <p className="text-sm text-muted-foreground">{use.description}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 mb-8 bg-blue-500/5 border-blue-500/20">
            <div className="flex items-start gap-4">
              <Smartphone className="w-8 h-8 text-blue-500 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Works on any phone</h3>
                <p className="text-sm text-muted-foreground">
                  iPhone, Android, any camera app. Point, scan, done. No special apps needed.
                </p>
              </div>
            </div>
          </Card>

          <Link href="/creator?line=static">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-website">
              Create Your Website Shirt
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Link href="/qr-static">
            <Button variant="ghost" className="w-full min-h-12 mt-4" data-testid="button-back-basics">
              ← Back to QR Basics
            </Button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
