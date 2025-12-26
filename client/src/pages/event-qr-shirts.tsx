import { Calendar, CheckCircle, Users, Camera, Music, PartyPopper, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Event name as header text",
  "Instructions or schedule link as footer",
  "People know what they're getting before they scan",
  "Permanent QR - works long after the event",
  "USA options available",
];

const exampleTexts = [
  "EVENT SCHEDULE",
  "JOIN THE GROUP",
  "PHOTOS FROM TODAY",
  "TEAM ROSTER",
  "REUNION 2024",
];

const events = [
  {
    icon: Users,
    title: "Family Reunions",
    description: "Everyone gets a shirt. QR links to the shared photo album. Header says 'SMITH REUNION 2024'.",
  },
  {
    icon: PartyPopper,
    title: "Parties & Celebrations",
    description: "Birthday bash? Bachelor party? The shirt IS the invitation. Scan for details.",
  },
  {
    icon: Music,
    title: "Concerts & Festivals",
    description: "Band merch that links to the setlist, exclusive content, or the merch store.",
  },
  {
    icon: Camera,
    title: "Group Activities",
    description: "5K runs, charity walks, team building. Scan to see all the photos from the day.",
  },
];

export default function EventQRShirts() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Event QR Shirts | Wearable Event Links | QR Gear"
        description="Create event shirts with QR codes linking to schedules, photos, and group info. Perfect for reunions, parties, and group activities. USA options available."
        keywords="event QR shirt, reunion shirt, party QR code, group event shirt, festival merch, event merchandise"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-purple-500/10 flex items-center justify-center shrink-0">
              <Calendar className="w-8 h-8 md:w-10 md:h-10 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">QR Plus</p>
              <h1 className="text-2xl md:text-4xl font-bold">Event QR Shirts</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">People know what they're getting before they scan.</p>
          <p className="text-lg text-muted-foreground mb-4">
            Header text like "EVENT SCHEDULE" or "PHOTOS FROM TODAY" tells everyone exactly what to expect. 
            No mystery, just clarity.
          </p>

          <div className="flex flex-wrap gap-2 mb-8">
            {exampleTexts.map((text, i) => (
              <span key={i} className="text-xs bg-muted px-3 py-1.5 rounded font-mono">{text}</span>
            ))}
          </div>

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-500" />
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
            <h2 className="font-semibold mb-6">Perfect for:</h2>
            <div className="grid gap-4">
              {events.map((event, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                    <event.icon className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-medium">{event.title}</h3>
                    <p className="text-sm text-muted-foreground">{event.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 mb-8 bg-purple-500/5 border-purple-500/20">
            <div className="flex items-start gap-4">
              <Camera className="w-8 h-8 text-purple-500 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">The shirt becomes the souvenir</h3>
                <p className="text-sm text-muted-foreground">
                  Long after the event ends, they still have the shirt. Years later, they scan and relive the day.
                </p>
              </div>
            </div>
          </Card>

          <Link href="/creator?line=static-plus">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-event">
              Create Your Event Shirts
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Card className="p-6 mt-8">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Related Ideas
            </h2>
            <div className="grid gap-3">
              <Link href="/family-reunion-shirts">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Family Reunion Shirts</span>
                  <p className="text-sm text-muted-foreground">Photo memories for the whole family</p>
                </div>
              </Link>
              <Link href="/wedding-qr-shirts">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Wedding QR Shirts</span>
                  <p className="text-sm text-muted-foreground">Wearable wedding favors</p>
                </div>
              </Link>
              <Link href="/band-dynamic-merch">
                <div className="p-3 rounded-lg border hover-glow-accent cursor-pointer">
                  <span className="font-medium">Band Dynamic Merch</span>
                  <p className="text-sm text-muted-foreground">Updateable content for musicians</p>
                </div>
              </Link>
            </div>
          </Card>

          <Link href="/qr-static-plus">
            <Button variant="ghost" className="w-full min-h-12 mt-4" data-testid="button-back-plus">
              ← Back to QR Plus
            </Button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
