import { Upload, CheckCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const features = [
  "Upload any video file",
  "Plays when QR is scanned",
  "Great for video messages and tutorials",
  "Cloud-hosted for instant playback",
];

export default function QRVideoLanding() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title="Video QR Products | Upload Video for Scannable Merchandise"
        description="Upload your video and create scannable QR merchandise. Perfect for video messages, tutorials, and multimedia content. USA-made products."
        keywords="video QR code, video QR products, scannable video, multimedia QR, video merchandise"
      />
      <Navbar />
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-accent/10 flex items-center justify-center shrink-0">
              <Upload className="w-8 h-8 md:w-10 md:h-10 text-accent" />
            </div>
            <h1 className="text-2xl md:text-4xl font-bold">Video QR</h1>
          </div>
          
          <p className="text-lg text-muted-foreground mb-8">
            Upload a video that plays when your QR code is scanned. 
            Perfect for personal messages, tutorials, and multimedia content.
          </p>

          <div className="bg-card rounded-xl p-6 mb-8 text-left">
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

          <Link href="/creator?line=video">
            <Button size="lg" className="w-full min-h-14 text-lg bg-orange-500 hover:bg-orange-600 text-white" data-testid="button-create-video">
              Create Your Video QR
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
