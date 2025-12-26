import { Home, CheckCircle, Play, Heart, Users, MessageCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Compile video messages from the whole family",
  "Scan anytime for instant comfort",
  "Perfect for someone living far away",
  "Cloud-hosted, plays on any phone",
  "A gift they'll treasure forever",
];

const scenarios = [
  {
    title: "Going to College",
    description: "The whole family records encouragement. When homesickness hits, they scan and hear everyone's voice.",
  },
  {
    title: "Moving Away",
    description: "New city, new life, but family is always close. One scan brings them all back.",
  },
  {
    title: "Military Deployment",
    description: "Mom, dad, siblings, the dog - everyone says 'we love you.' Home in their pocket, wherever they go.",
  },
  {
    title: "Long-Distance Grandparents",
    description: "Grandkids grow up fast. Give grandparents a shirt full of giggles and 'I love you's.",
  },
];

export default function FamilyVideoMessages() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Family Video Messages | Home in Their Pocket | QR Gear"
        description="Create shirts with QR codes that play video messages from the whole family. Perfect for college students, military deployment, or anyone far from home. Instant comfort."
        keywords="family video shirt, going away gift, college student gift, military gift, long distance family, video message shirt"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <Home className="w-8 h-8 md:w-10 md:h-10 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">QR Play</p>
              <h1 className="text-2xl md:text-4xl font-bold">Family Video Messages</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">Home in their pocket.</p>
          <p className="text-lg text-muted-foreground mb-4">
            The whole family recorded messages. Now every time they miss you, they scan the shirt. Instant comfort.
          </p>
          <p className="text-lg text-muted-foreground mb-8 italic">
            Distance disappears. One scan and everyone is there.
          </p>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-blue-500" />
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
              <Users className="w-5 h-5 text-primary" />
              Perfect for:
            </h2>
            <div className="grid gap-4">
              {scenarios.map((scenario, i) => (
                <div key={i} className="border-l-2 border-blue-500/30 pl-4">
                  <h3 className="font-medium">{scenario.title}</h3>
                  <p className="text-sm text-muted-foreground">{scenario.description}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 mb-8 bg-blue-500/5 border-blue-500/20">
            <div className="flex items-start gap-4">
              <MessageCircle className="w-8 h-8 text-blue-500 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Easy to make</h3>
                <p className="text-sm text-muted-foreground">
                  Have everyone record a short clip on their phone. Stitch them together with any free video editor. 
                  Upload, and you've got a gift that lasts forever.
                </p>
              </div>
            </div>
          </Card>

          <Link href="/creator?line=video">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-family-video">
              Create Your Family Message Shirt
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Card className="p-6 mt-8">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Related Ideas
            </h2>
            <div className="grid gap-3">
              <Link href="/memorial-video-shirts">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Memorial Video Shirts</span>
                  <p className="text-sm text-muted-foreground">Keep loved ones close</p>
                </div>
              </Link>
              <Link href="/video-time-capsule">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Video Time Capsule</span>
                  <p className="text-sm text-muted-foreground">Messages for the future</p>
                </div>
              </Link>
              <Link href="/family-reunion-shirts">
                <div className="p-3 rounded-lg border hover-elevate cursor-pointer">
                  <span className="font-medium">Family Reunion Shirts</span>
                  <p className="text-sm text-muted-foreground">Photo memories for the family</p>
                </div>
              </Link>
            </div>
          </Card>

          <Link href="/qr-video">
            <Button variant="ghost" className="w-full min-h-12 mt-4" data-testid="button-back-play">
              ← Back to QR Play
            </Button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
