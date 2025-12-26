import { QrCode, CheckCircle, Coffee, Dumbbell, Briefcase, Heart } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Encode any text, URL, or contact info",
  "Up to 2,000 characters - that's a LOT of info!",
  "Permanent QR - never expires or changes",
  "USA-made apparel and accessories",
];

const examples = [
  {
    icon: Coffee,
    title: "Office Coffee Mug",
    text: "Your name, department, and extension so coworkers know whose mug they borrowed",
  },
  {
    icon: Dumbbell,
    title: "Gym Bag Tag",
    text: "Full contact info - name, phone, email, address - in case it gets lost",
  },
  {
    icon: Briefcase,
    title: "Networking Polo",
    text: "Your complete vCard with business info - one scan saves your contact",
  },
  {
    icon: Heart,
    title: "Medical Alert",
    text: "Emergency contacts, allergies, medications, blood type - vital info when it matters",
  },
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
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <QrCode className="w-8 h-8 md:w-10 md:h-10 text-primary" />
            </div>
            <h1 className="text-2xl md:text-4xl font-bold">Simple QR Code Products</h1>
          </div>
          
          <p className="text-lg text-muted-foreground mb-8">
            The classic QR experience. Encode your text, URL, or contact info directly into 
            a permanent QR code printed on quality USA-made merchandise.
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

        </div>
      </main>
      <Footer />
    </div>
  );
}
