import { Palette, CheckCircle, Heart, Camera, Users, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Upload your own background image",
  "Or choose from pre-designed templates",
  "Easy crop tool to frame it just right",
  "Mobile-optimized 9:16 display",
  "Optional header/footer text on the product",
];

const popularUses = [
  {
    icon: Heart,
    title: "The Gift That Keeps Giving",
    description: "Grandma scans the hoodie.\nHer screen fills with the family reunion photo.\nTears guaranteed.",
    link: "/family-reunion-shirts",
    linkText: "Family & Gift Ideas",
  },
  {
    icon: Sparkles,
    title: "Wearable Wedding Favors",
    description: "Guests take home shirts.\nYears later, they scan and see the couple's first dance photo.\nTimeless.",
    link: "/wedding-qr-shirts",
    linkText: "Wedding Ideas",
  },
  {
    icon: Camera,
    title: "Your Art, Full Screen",
    description: "Painters, photographers, designers —\nyour work becomes the destination.\nA portable gallery on every shirt.",
    link: "/artist-qr-apparel",
    linkText: "Artist Ideas",
  },
  {
    icon: Users,
    title: "Memories You Can Wear",
    description: "A favorite vacation.\nA loved one.\nA moment you don't want to lose.\nScan and relive it — instantly.",
    link: "/memorial-qr-gifts",
    linkText: "Memory Ideas",
  },
];

export default function QRUrlLanding() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="QR Canvas | Custom Background QR Products | QR Gear"
        description="Create QR Canvas merchandise - upload your own image that appears when people scan your QR. Perfect for weddings, family gifts, artists, and treasured memories. USA options available."
        keywords="QR Canvas, custom QR background, wedding QR shirts, family photo gifts, artist QR apparel, memorial QR gifts"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Palette className="w-8 h-8 md:w-10 md:h-10 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">State: Visual</p>
              <h1 className="text-2xl md:text-4xl font-bold">QR Canvas</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">Design a custom image your QR opens to.</p>
          <p className="text-lg text-muted-foreground mb-8">
            Your creative canvas for the scan experience. When someone scans your QR, they land on your hosted QR Space 
            showing a custom background image — a photo, artwork, memory, or moment. Upload your own or choose from templates.
            Optional header and footer text can be printed on the product.
          </p>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4">What you get:</h2>
            <ul className="space-y-3">
              {features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6 mb-8">
            <h2 className="font-semibold mb-6">Popular Uses:</h2>
            <div className="grid gap-6">
              {popularUses.map((use, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <use.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">{use.title}</h3>
                    <p className="text-muted-foreground whitespace-pre-line mb-3">{use.description}</p>
                    <Link href={use.link}>
                      <Button variant="outline" size="sm" className="min-h-12" data-testid={`button-use-${i}`}>
                        {use.linkText}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Link href="/creator?line=url">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-canvas">
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
