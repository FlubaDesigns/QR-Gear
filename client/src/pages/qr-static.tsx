import { QrCode, CheckCircle, Coffee, Dumbbell, Briefcase, Heart, Link2, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Encode any text, URL, or contact info",
  "Up to 2,000 characters - that's a LOT of info!",
  "Permanent QR - never expires or changes",
  "USA-made products available",
];

const examples = [
  {
    icon: Link2,
    title: "Instant Website Access",
    text: "\"Just scan my shirt.\" One tap lands them on your site, portfolio, or booking page. No typing, no searching.",
  },
  {
    icon: Coffee,
    title: "The Mug That Finds Its Way Home",
    text: "When Karen \"borrows\" your mug again, she'll know exactly whose it is. Name, desk, extension - all encoded.",
  },
  {
    icon: Dumbbell,
    title: "Lost & Found Hero",
    text: "Gym bag goes missing? Your contact info is baked right in. Good samaritans just scan and call.",
  },
  {
    icon: Briefcase,
    title: "Networking on Autopilot",
    text: "Skip the business card shuffle. They scan, your vCard saves. You're in their phone before the handshake ends.",
  },
  {
    icon: Heart,
    title: "Silent Lifesaver",
    text: "Allergies. Blood type. Emergency contacts. Medications. When you can't speak, your shirt can.",
  },
];

export default function QRStaticLanding() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="QR Basics | Text & URL QR Code Products | QR Gear"
        description="Create QR Basics merchandise - encode text, URLs, or contact info directly into a permanent QR code. Perfect for business cards, contact info, and direct links. USA options available."
        keywords="QR Basics, simple QR code, basic QR products, text QR code, URL QR code, QR merchandise"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <QrCode className="w-8 h-8 md:w-10 md:h-10 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-bold">QR Basics</h1>
              <span className="text-sm text-muted-foreground/70 uppercase tracking-wide">Permanent</span>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-1">A clean, scannable QR code.</p>
          <p className="text-lg text-muted-foreground mb-6">Permanent. No subscriptions. Just works.</p>
          
          <p className="text-base text-muted-foreground mb-2">
            Encode your text, URL, or contact info directly into a permanent QR code printed on quality merchandise.
            Need a simple link to your website? This is it.
          </p>
          <p className="text-sm text-muted-foreground/80 italic mb-8">
            Best for: websites, contact info, lost & found, emergency info
          </p>

          <div className="bg-card rounded-xl p-6 mb-6 text-left">
            <h2 className="font-semibold mb-4">What you get:</h2>
            <ul className="space-y-3">
              {features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-card rounded-xl p-6 mb-8 text-left">
            <h2 className="font-semibold mb-4">Popular Uses:</h2>
            <div className="grid gap-4">
              {examples.map((example, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <example.icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium">{example.title}</h3>
                    <p className="text-sm text-muted-foreground">{example.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Link href="/creator?line=static">
            <Button size="lg" className="w-full min-h-14 text-lg bg-orange-500 hover:bg-orange-600 text-white" data-testid="button-create-static">
              Create Your QR Basics
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
