import { Coffee, CheckCircle, Tag, Smile, Building, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Your name and contact info encoded in the QR",
  "Dishwasher safe, microwave safe",
  "High-quality ceramic that lasts",
  "Permanent QR - never wears off",
  "USA options available",
];

const scenarios = [
  {
    title: "The Chronic Borrower",
    description: "Karen takes your mug again. One scan tells her exactly whose it is. Name, desk, extension.",
  },
  {
    title: "The Conference Room Rescue",
    description: "Left your mug in meeting room C? Whoever finds it knows exactly where to return it.",
  },
  {
    title: "The Remote Worker",
    description: "Your mug goes to the coworking space with you. Now it has a permanent home address.",
  },
  {
    title: "The Personal Touch",
    description: "Add a fun message, your favorite quote, or a link to your Spotify playlist.",
  },
];

export default function OfficeQRMug() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Office QR Mug | The Mug That Finds Its Way Home | QR Gear"
        description="Create a personalized office mug with your contact info encoded in a QR code. Never lose your mug to the office borrower again. USA options available."
        keywords="office mug QR, personalized mug, contact info mug, office supplies QR, custom work mug, scannable mug"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <Coffee className="w-8 h-8 md:w-10 md:h-10 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">QR Basics</p>
              <h1 className="text-2xl md:text-4xl font-bold">Office QR Mug</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">The mug that finds its way home.</p>
          <p className="text-lg text-muted-foreground mb-4">
            When Karen "borrows" your mug again, she'll know exactly whose it is. 
            Name, desk, extension - all encoded. One scan, zero confusion.
          </p>
          <p className="text-lg text-muted-foreground mb-8 italic">
            Finally, a mug that can speak for itself.
          </p>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5 text-amber-500" />
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
              <Building className="w-5 h-5 text-primary" />
              Office scenarios:
            </h2>
            <div className="grid gap-4">
              {scenarios.map((scenario, i) => (
                <div key={i} className="border-l-2 border-amber-500/30 pl-4">
                  <h3 className="font-medium">{scenario.title}</h3>
                  <p className="text-sm text-muted-foreground">{scenario.description}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 mb-8 bg-amber-500/5 border-amber-500/20">
            <div className="flex items-start gap-4">
              <Smile className="w-8 h-8 text-amber-500 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Great team gift</h3>
                <p className="text-sm text-muted-foreground">
                  Order for the whole office. Each mug gets personalized with the person's info. 
                  No more mug mysteries in the break room.
                </p>
              </div>
            </div>
          </Card>

          <Link href="/creator?line=static">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-mug">
              Create Your Office Mug
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Card className="p-6 mt-8">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Building className="w-5 h-5 text-primary" />
              Related Ideas
            </h2>
            <div className="grid gap-3">
              <Link href="/networking-qr-shirts">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Networking Shirts</span>
                  <p className="text-sm text-muted-foreground">Skip the business card shuffle</p>
                </div>
              </Link>
              <Link href="/website-qr-shirts">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Website QR Shirts</span>
                  <p className="text-sm text-muted-foreground">Instant links to your site</p>
                </div>
              </Link>
              <Link href="/personal-items-qr">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Personal Items QR</span>
                  <p className="text-sm text-muted-foreground">Label anything that's yours</p>
                </div>
              </Link>
            </div>
          </Card>

          <Link href="/qr-static">
            <Button variant="ghost" className="w-full min-h-12 mt-4" data-testid="button-back-basics">
              ← Back to QR Basics
            </Button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
