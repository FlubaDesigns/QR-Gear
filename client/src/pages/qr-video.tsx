import { Play, CheckCircle, ArrowRight, Heart, Home, Clock, Briefcase } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Upload any video file",
  "Plays instantly when the QR is scanned",
  "Cloud-hosted for fast, reliable playback",
  "Perfect for personal messages and storytelling",
  "Optional header/footer text on the product",
];

const personalUses = [
  {
    icon: Heart,
    title: "Grandpa Lives On",
    description: "The hoodie has his photo.\nScan it, and there he is — telling his favorite fishing story.\nForever.",
    link: "/memorial-video-shirts",
    linkText: "Memorial Ideas",
  },
  {
    icon: Home,
    title: "Home in Their Pocket",
    description: "The whole family recorded messages.\nNow every time they miss you, they scan the shirt.\nInstant comfort.",
    link: "/family-video-messages",
    linkText: "Family Message Ideas",
  },
  {
    icon: Clock,
    title: "A Message for Tomorrow",
    description: "Record a video for your child, partner, or future self.\nYears later, one scan brings your voice back to life.",
    link: "/video-time-capsule",
    linkText: "Time Capsule Ideas",
  },
];

const businessUses = [
  {
    title: "Training That Travels",
    description: "New hire scans the uniform, gets the how-to video. No shadowing needed.",
  },
  {
    title: "The Handshake Before the Handshake",
    description: "Client scans your polo. Watches your company story. By the time you meet, they already trust you.",
  },
];

export default function QRVideoLanding() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="QR Play | Video QR Code Products | QR Gear"
        description="Create QR Play merchandise - upload your video that plays instantly when scanned. Perfect for personal messages, memories, and stories meant to be seen, heard, and felt. USA options available."
        keywords="QR Play, video QR code, video message shirt, memorial video gift, personal video QR, scannable video merchandise"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-orange-500/10 flex items-center justify-center shrink-0">
              <Play className="w-8 h-8 md:w-10 md:h-10 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">State: Motion</p>
              <h1 className="text-2xl md:text-4xl font-bold">QR Play</h1>
            </div>
          </div>
          
          <p className="text-xl font-medium text-foreground mb-2">Bring your QR to life with video.</p>
          <p className="text-lg text-muted-foreground mb-8">
            Upload a video that plays instantly in your hosted QR Space when scanned. 
            QR Play is built for real moments — messages, memories, and stories meant to be seen, heard, and felt.
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

          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-6">Popular Uses:</h2>
            <div className="grid gap-6">
              {personalUses.map((use, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                    <use.icon className="w-6 h-6 text-orange-500" />
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

          <Card className="p-6 mb-8 bg-muted/30">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-semibold text-muted-foreground">Also great for business:</h2>
            </div>
            <div className="grid gap-3">
              {businessUses.map((use, i) => (
                <div key={i} className="border-l-2 border-muted-foreground/20 pl-4">
                  <h3 className="font-medium text-sm">{use.title}</h3>
                  <p className="text-sm text-muted-foreground">{use.description}</p>
                </div>
              ))}
            </div>
          </Card>

          <Link href="/creator?line=video">
            <Button size="lg" className="w-full min-h-14 text-lg" data-testid="button-create-video">
              Create Your QR Play
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
