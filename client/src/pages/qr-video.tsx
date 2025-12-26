import { Upload, CheckCircle } from "lucide-react";
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
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
            <Upload className="w-10 h-10 text-accent" />
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Video QR</h1>
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

        </div>
      </main>
      <Footer />
    </div>
  );
}
