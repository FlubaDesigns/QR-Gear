import { Sparkles, CheckCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Update your QR destination anytime",
  "Never reprint when content changes",
  "Analytics and scan tracking",
  "Premium subscription service",
];

export default function QRDynamicsLanding() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="QR Dynamics™ | Living QR Codes You Can Update Anytime"
        description="Create QR Dynamics - living QR codes that link to pages you control. Update your content anytime without reprinting. Premium subscription QR merchandise."
        keywords="QR Dynamics, dynamic QR code, living QR code, updateable QR, subscription QR, premium QR merchandise"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-primary" />
            </div>
            <h1 className="text-2xl md:text-4xl font-bold">QR Dynamics™</h1>
          </div>
          
          <p className="text-lg text-muted-foreground mb-8">
            Living QR codes you can update anytime. Change where your QR points 
            without reprinting. Includes scan analytics and tracking.
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

        </div>
      </main>
      <Footer />
    </div>
  );
}
