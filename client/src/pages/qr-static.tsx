import { Link } from "wouter";
import { QrCode, CheckCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { QRButton } from "@/components/QRButton";

const features = [
  "Encode any text, URL, or contact info",
  "Permanent QR - never expires or changes",
  "USA-made apparel and accessories",
  "High-quality print that lasts",
];

export default function QRStaticLanding() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Simple QR Code Products | Basic Text & URL QR Gear"
        description="Create simple QR code merchandise with basic text or URL encoding. Perfect for business cards, contact info, and direct links. USA-made products."
        keywords="simple QR code, basic QR products, text QR code, URL QR code, QR merchandise"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <QrCode className="w-10 h-10 text-primary" />
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Simple QR Code Products</h1>
          <p className="text-lg text-muted-foreground mb-8">
            The classic QR experience. Encode your text, URL, or contact info directly into 
            a permanent QR code printed on quality USA-made merchandise.
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

          <Link href="/creator?line=static">
            <QRButton 
              variant="accent" 
              className="min-h-12 px-8"
              data-testid="button-create-simple-qr"
            >
              Create Simple QR Now
            </QRButton>
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
