import { Palette, CheckCircle, Image, Crop, Smartphone, Gift, Building, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Upload your own background image",
  "Or choose from our pre-designed templates",
  "Easy crop tool to get the perfect frame",
  "Mobile-optimized 9:16 display (optional)",
  "Optional header/footer text on the product",
];

const examples = [
  {
    icon: Gift,
    title: "The Gift That Keeps Giving",
    text: "Grandma scans the hoodie. Her screen fills with the family reunion photo. Tears guaranteed.",
  },
  {
    icon: Building,
    title: "Brand Immersion in 3 Seconds",
    text: "They scan. Your logo fills their screen. Your colors. Your vibe. Instant brand moment - no app download.",
  },
  {
    icon: Image,
    title: "Wearable Wedding Favors",
    text: "Guests take home shirts. Years later, they scan - and see the couple's first dance photo. Timeless.",
  },
  {
    icon: Smartphone,
    title: "Your Art, Full Screen",
    text: "Painters, photographers, designers - your best work becomes the QR Space. A portable gallery on every shirt.",
  },
];

export default function QRUrlLanding() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="QR Canvas | Custom Background QR Products | QR Gear"
        description="Create QR Canvas merchandise - upload your own image that appears when people scan your QR. Custom backgrounds, templates, and optional text. USA-made products."
        keywords="QR Canvas, custom QR background, upload image QR, personalized QR, custom QR merchandise"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Palette className="w-8 h-8 md:w-10 md:h-10 text-primary" />
            </div>
            <h1 className="text-2xl md:text-4xl font-bold">QR Canvas</h1>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">Design a custom image your QR opens to</p>
          <p className="text-lg text-muted-foreground mb-8">
            Your creative canvas for the scan experience. When someone scans your QR, they land on your hosted QR Space 
            showing your custom background image. Upload your own or pick from templates - plus optional header/footer text on the product.
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

          <Link href="/creator?line=url">
            <Button size="lg" className="w-full min-h-14 text-lg bg-orange-500 hover:bg-orange-600 text-white" data-testid="button-create-url">
              Create Your QR Canvas
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
