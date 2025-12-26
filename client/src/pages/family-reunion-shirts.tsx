import { Users, CheckCircle, Heart, Camera, Gift, Home, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Upload the family photo everyone loves",
  "Each family member gets their own shirt",
  "Grandparents, cousins, everyone can scan and see the memory",
  "Perfect for reunions, holidays, or 'just because'",
  "Optional text: family name, reunion year, inside joke",
];

const occasions = [
  {
    title: "The Annual Reunion",
    description: "This year's group photo becomes next year's shirt. Start a tradition.",
  },
  {
    title: "Grandparent Gift",
    description: "Grandma scans the hoodie. Her screen fills with all her grandkids. Tears guaranteed.",
  },
  {
    title: "Holiday Gatherings",
    description: "Thanksgiving, Christmas, Hanukkah — capture the chaos and wear it proudly.",
  },
  {
    title: "Milestone Birthdays",
    description: "80th birthday? 50th anniversary? Put the celebration photo on something they'll actually use.",
  },
];

export default function FamilyReunionShirts() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Family Reunion Shirts | Custom Photo QR Apparel | QR Gear"
        description="Create family reunion shirts with scannable QR codes. Everyone scans to see the family photo. Perfect for reunions, holidays, and gifts for grandparents. USA options available."
        keywords="family reunion shirts, custom family shirts, grandparent gifts, family photo shirts, reunion apparel, family gathering shirts, personalized family gifts"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <Users className="w-8 h-8 md:w-10 md:h-10 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">QR Canvas</p>
              <h1 className="text-2xl md:text-4xl font-bold">Family Reunion Shirts</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">The gift that keeps giving.</p>
          <p className="text-lg text-muted-foreground mb-4">
            Family photos deserve more than a spot on the mantle. Put them on shirts everyone actually wears — 
            and when they scan the QR, the whole family appears on their screen.
          </p>
          <p className="text-lg text-muted-foreground mb-8 italic">
            "Grandma scans the hoodie. Her screen fills with the family reunion photo. Tears guaranteed."
          </p>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              What makes it special:
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
              <Home className="w-5 h-5 text-primary" />
              Perfect for:
            </h2>
            <div className="grid gap-4">
              {occasions.map((occasion, i) => (
                <div key={i} className="border-l-2 border-blue-500/30 pl-4">
                  <h3 className="font-medium">{occasion.title}</h3>
                  <p className="text-sm text-muted-foreground">{occasion.description}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 mb-8 bg-blue-500/5 border-blue-500/20">
            <div className="flex items-start gap-4">
              <Gift className="w-8 h-8 text-blue-500 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Ordering for the whole family?</h3>
                <p className="text-sm text-muted-foreground">
                  Mix sizes, mix styles. Everyone gets the same QR that opens the same photo. 
                  Uncle Bob's 3XL hoodie and little Timmy's youth tee — same memory, different fit.
                </p>
              </div>
            </div>
          </Card>

          <Link href="/creator?line=url">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-family">
              Create Your Family Shirts
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Card className="p-6 mt-8">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Related Ideas
            </h2>
            <div className="grid gap-3">
              <Link href="/wedding-qr-shirts">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Wedding Photo Shirts</span>
                  <p className="text-sm text-muted-foreground">Wearable favors for your big day</p>
                </div>
              </Link>
              <Link href="/memorial-qr-gifts">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Memorial Photo Gifts</span>
                  <p className="text-sm text-muted-foreground">Honor loved ones with lasting tributes</p>
                </div>
              </Link>
              <Link href="/event-qr-shirts">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Event QR Shirts</span>
                  <p className="text-sm text-muted-foreground">Perfect for any gathering</p>
                </div>
              </Link>
            </div>
          </Card>

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
