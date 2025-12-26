import { Users, CheckCircle, Briefcase, Handshake, Smartphone, Zap, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Your vCard encoded directly in the QR",
  "Saves to their phone contacts instantly",
  "Name, email, phone, website - all in one scan",
  "No business cards to lose or forget",
  "Works at conferences, meetups, anywhere",
];

const scenarios = [
  {
    title: "Conference Mode",
    description: "Skip the business card shuffle. They scan, you're saved. Move on to the next connection.",
  },
  {
    title: "Networking Events",
    description: "You're in their phone before the handshake ends. Follow-up is already half done.",
  },
  {
    title: "Trade Shows",
    description: "Standing at your booth all day? Let them scan instead of collecting cards you'll never sort.",
  },
  {
    title: "Casual Encounters",
    description: "Met someone interesting at coffee? No need to fumble for a card. Just 'scan my shirt.'",
  },
];

export default function NetworkingQRShirts() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Networking QR Shirts | Skip the Business Card | QR Gear"
        description="Create shirts with QR codes that save your contact info directly to their phone. Skip the business card shuffle at conferences and networking events. USA options available."
        keywords="networking QR shirt, digital business card, vCard QR code, conference shirt, contact info QR, professional networking"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0">
              <Users className="w-8 h-8 md:w-10 md:h-10 text-indigo-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">QR Basics</p>
              <h1 className="text-2xl md:text-4xl font-bold">Networking QR Shirts</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">Networking on autopilot.</p>
          <p className="text-lg text-muted-foreground mb-4">
            Skip the business card shuffle. They scan, your vCard saves. 
            You're in their phone before the handshake ends.
          </p>
          <p className="text-lg text-muted-foreground mb-8 italic">
            The business card you wear, not carry.
          </p>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-500" />
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
              <Handshake className="w-5 h-5 text-primary" />
              Perfect for:
            </h2>
            <div className="grid gap-4">
              {scenarios.map((scenario, i) => (
                <div key={i} className="border-l-2 border-indigo-500/30 pl-4">
                  <h3 className="font-medium">{scenario.title}</h3>
                  <p className="text-sm text-muted-foreground">{scenario.description}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 mb-8 bg-indigo-500/5 border-indigo-500/20">
            <div className="flex items-start gap-4">
              <Smartphone className="w-8 h-8 text-indigo-500 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">vCard magic</h3>
                <p className="text-sm text-muted-foreground">
                  When they scan, their phone asks to save your contact. One tap and you're in. 
                  Name, email, phone, company, website - all of it.
                </p>
              </div>
            </div>
          </Card>

          <Link href="/creator?line=static">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-networking">
              Create Your Networking Shirt
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Card className="p-6 mt-8">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Handshake className="w-5 h-5 text-primary" />
              Related Ideas
            </h2>
            <div className="grid gap-3">
              <Link href="/website-qr-shirts">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Website QR Shirts</span>
                  <p className="text-sm text-muted-foreground">Link directly to your portfolio</p>
                </div>
              </Link>
              <Link href="/business-qr-plus">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Business QR Plus</span>
                  <p className="text-sm text-muted-foreground">Add company branding text</p>
                </div>
              </Link>
              <Link href="/realtor-qr-shirts">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Realtor QR Shirts</span>
                  <p className="text-sm text-muted-foreground">Dynamic content for real estate</p>
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
