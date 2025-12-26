import { Palette, CheckCircle, Image, Crop, Smartphone, ArrowRight } from "lucide-react";
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
];

const examples = [
  {
    icon: Image,
    title: "Your Own Photos",
    text: "Upload a family photo, company logo backdrop, or any image you want",
  },
  {
    icon: Crop,
    title: "Easy Cropping",
    text: "Drag to select exactly the part of your image you want to show",
  },
  {
    icon: Smartphone,
    title: "Mobile-Ready",
    text: "Optimized for phones - looks great when people scan your QR",
  },
];

export default function QRUrlLanding() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Custom Background QR Products | Upload Your Own Image"
        description="Create QR code merchandise with custom backgrounds. Upload your own image or choose from templates. The background appears when people scan your QR. USA-made products."
        keywords="custom QR background, upload image QR, personalized QR, custom QR merchandise"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Palette className="w-8 h-8 md:w-10 md:h-10 text-primary" />
            </div>
            <h1 className="text-2xl md:text-4xl font-bold">Custom Backgrounds</h1>
          </div>
          
          <p className="text-lg text-muted-foreground mb-8">
            When someone scans your QR, they see your custom background on their phone. 
            Upload your own image or pick from our templates - it's the backdrop for your message.
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
            <h2 className="font-semibold mb-4">How it works:</h2>
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
              Create Custom Background QR
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
