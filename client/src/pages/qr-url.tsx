import { Link } from "wouter";
import { Palette, CheckCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { QRButton } from "@/components/QRButton";

const features = [
  "Pre-designed gift backgrounds",
  "Religious, sports, and business themes",
  "Professional QR placement included",
  "Perfect for gifts and special occasions",
];

export default function QRUrlLanding() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Gift Background QR Products | Pre-Designed QR Templates"
        description="Choose from beautiful pre-designed backgrounds for your QR code gifts. Religious, sports, business themes with perfect QR placement. USA-made merchandise."
        keywords="QR gift backgrounds, QR templates, pre-designed QR, gift QR products, themed QR merchandise"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Palette className="w-10 h-10 text-primary" />
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Gift Backgrounds</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Browse our collection of beautiful pre-designed backgrounds. 
            Your QR code is placed perfectly on themes for any occasion.
          </p>

          <div className="bg-card rounded-xl p-6 mb-8 text-left">
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

          <Link href="/creator?line=url">
            <QRButton 
              variant="accent" 
              className="min-h-12 px-8"
              data-testid="button-browse-designs"
            >
              Browse Designs Now
            </QRButton>
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
