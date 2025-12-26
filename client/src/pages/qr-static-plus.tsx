import { Link } from "wouter";
import { Type, CheckCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { QRButton } from "@/components/QRButton";

const features = [
  "Add custom header text above your QR",
  "Add footer text below for context",
  "Multiple font styles and sizes",
  "Perfect for calls-to-action",
];

export default function QRStaticPlusLanding() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="QR Code with Text | Header & Footer Custom QR Gear"
        description="Create QR code merchandise with custom header and footer text. Add context and calls-to-action around your QR codes. USA-made products."
        keywords="QR code with text, custom text QR, header footer QR, QR merchandise with text"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
            <Type className="w-10 h-10 text-accent" />
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-4">QR Code + Text</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Make your QR code stand out with custom header and footer text. 
            Add context, instructions, or a call-to-action right on the product.
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

          <Link href="/creator?line=static-plus">
            <QRButton 
              variant="accent" 
              className="min-h-12 px-8"
              data-testid="button-create-qr-text"
            >
              Create QR + Text Now
            </QRButton>
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
