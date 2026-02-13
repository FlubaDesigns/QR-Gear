import { Link } from "wouter";
import { QRButton } from "@/components/QRButton";
import { MessageSquare, Image, Video, Sparkles, History, ArrowRight } from "lucide-react";

export default function MarketingMessage() {
  return (
    <section className="message-section">
      <div className="container">
        <div className="section-header">
          <h2>Custom Gear That Sends a Message</h2>
          <p>Your story. Your style. Scannable by anyone.</p>
        </div>

        <div className="message-grid">
          <div className="glass-card message-card" data-testid="message-hidden">
            <h3>Got a Hidden Message?</h3>
            <p>
              Want to share something personal? Need to show your artwork? 
              Have a video you'd love to share with everyone you meet? 
              Ever thought about being a walking billboard?
            </p>
            <p className="message-tagline">
              Meet QR Gear — custom gear that speaks for you.
            </p>
          </div>

          <div className="glass-card message-card" data-testid="message-customs">
            <h3>Frame Your Precious Moments</h3>
            <p>
              QR Customs lets you design something truly yours. 
              Combine today's technology with yesterday's memories. 
              Create a wearable keepsake that tells your story.
            </p>
            <p className="message-tagline">
              Your design. Your moment. Forever scannable.
            </p>
          </div>

          <div className="glass-card message-card premium" data-testid="message-dynamics">
            <h3>Make It Live with QR Dynamics</h3>
            <p>
              Take the vision further. Build your own collage of images or video. 
              Create a moment and share it — then change it whenever you want. 
              Update your content without reprinting.
            </p>
            <p className="message-tagline">
              You are Dynamics. The next generation in gear.
            </p>
          </div>

          <div className="glass-card message-card" data-testid="message-business">
            <h3>For Brands &amp; Creators</h3>
            <p>
              Track scans, measure engagement, and connect with your audience. 
              Perfect for events, product launches, networking, and marketing campaigns 
              that make an impression.
            </p>
            <p className="message-tagline">
              Turn every interaction into a connection.
            </p>
          </div>
        </div>

        <div className="section-cta">
          <Link href="/build">
            <QRButton variant="accent" size="default" data-testid="button-create-your-gear">
              Create Your Gear
            </QRButton>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function HistoryTeaser() {
  return (
    <section className="home-section-muted">
      <div className="container">
        <Link href="/qr-history" className="block">
          <div className="glass-card history-teaser hover-elevate" data-testid="history-teaser">
            <div className="history-teaser-icon icon-bg-ice">
              <History className="icon-color-ice" />
            </div>
            <div className="history-teaser-content">
              <h4>Did You Know?</h4>
              <p>QR codes were invented in 1994 to track car parts. Today, they connect the physical and digital worlds. Learn the story behind the square.</p>
            </div>
            <ArrowRight className="icon-color-ice" />
          </div>
        </Link>
      </div>
    </section>
  );
}
