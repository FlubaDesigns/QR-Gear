import { Heart, CheckCircle, Star, Camera, Users, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Upload their favorite photo",
  "Scan anytime to see them again",
  "A comfort you can wear close",
  "Share the same design with family members",
  "Optional text: their name, dates, a meaningful phrase",
];

const uses = [
  {
    title: "Remembering a Loved One",
    description: "Their smile, their laugh, their face — right there when you need it. Scan and feel close again.",
  },
  {
    title: "Pet Memorials",
    description: "That goofy face. That perfect moment. Wear them with you, and see them whenever you want.",
  },
  {
    title: "Tribute Shirts",
    description: "For memorial services, anniversary remembrances, or just because you miss them.",
  },
  {
    title: "Comfort Gifts",
    description: "Give someone grieving a way to keep their person close. More meaningful than flowers.",
  },
];

export default function MemorialQRGifts() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Memorial QR Gifts | Remembrance Photo Shirts | QR Gear"
        description="Create memorial shirts with scannable QR codes that show a photo of your loved one. A meaningful way to keep memories close. Perfect for remembrance and tribute. USA options available."
        keywords="memorial shirts, remembrance gifts, in memory of shirts, tribute apparel, pet memorial, loved one shirts, grief gifts, memorial QR"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0">
              <Heart className="w-8 h-8 md:w-10 md:h-10 text-rose-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">QR Canvas</p>
              <h1 className="text-2xl md:text-4xl font-bold">Memorial QR Gifts</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">Memories you can wear.</p>
          <p className="text-lg text-muted-foreground mb-4">
            A favorite vacation. A loved one. A moment you don't want to lose. 
            Put their photo on a shirt, and scan anytime to see them again.
          </p>
          <p className="text-lg text-muted-foreground mb-8 italic">
            "Scan and relive it — instantly."
          </p>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-rose-500" />
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
              <Camera className="w-5 h-5 text-primary" />
              Ways to remember:
            </h2>
            <div className="grid gap-4">
              {uses.map((use, i) => (
                <div key={i} className="border-l-2 border-rose-500/30 pl-4">
                  <h3 className="font-medium">{use.title}</h3>
                  <p className="text-sm text-muted-foreground">{use.description}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 mb-8 bg-rose-500/5 border-rose-500/20">
            <div className="flex items-start gap-4">
              <Users className="w-8 h-8 text-rose-500 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">For the whole family</h3>
                <p className="text-sm text-muted-foreground">
                  Order matching shirts for everyone who wants to carry that memory. 
                  Same photo, same QR — different sizes for each person.
                </p>
              </div>
            </div>
          </Card>

          <Link href="/creator?line=url">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-memorial">
              Create Your Memorial Shirt
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Link href="/qr-url">
            <Button variant="ghost" className="w-full min-h-12 mt-4" data-testid="button-back-canvas">
              ← Back to QR Canvas
            </Button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
