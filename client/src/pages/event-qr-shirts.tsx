import { Calendar, CheckCircle, Users, Camera, Music, PartyPopper, ArrowRight } from "lucide-react";
import { Link } from "wouter";
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
    <div className="vanity-page">
      <SEO 
        title="Event QR Shirts | Wearable Event Links | QR Gear"
        description="Create event shirts with QR codes linking to schedules, photos, and group info. Perfect for reunions, parties, and group activities. USA options available."
        keywords="event QR shirt, reunion shirt, party QR code, group event shirt, festival merch, event merchandise"
      />
      <Navbar />
      <main className="vanity-content">
        <div className="vanity-container">
          <div className="vanity-header">
            <div className="vanity-header-icon">
              <Calendar />
            </div>
            <div className="vanity-header-text">
              <p className="vanity-category">QR Plus</p>
              <h1 className="vanity-title">Event QR Shirts</h1>
            </div>
          </div>
          
          <p className="vanity-tagline">People know what they're getting before they scan.</p>
          <p className="vanity-description">
            Header text like "EVENT SCHEDULE" or "PHOTOS FROM TODAY" tells everyone exactly what to expect. 
            No mystery, just clarity.
          </p>

          <div className="glass-card vanity-features">
            <h2 className="vanity-features-title">
              <Calendar />
              What you get:
            </h2>
            <ul className="vanity-features-list">
              {features.map((feature, i) => (
                <li key={i} className="vanity-feature-item">
                  <CheckCircle />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-card vanity-items">
            <h2 className="vanity-items-title">Perfect for:</h2>
            <div className="vanity-items-grid">
              {events.map((event, i) => (
                <div key={i} className="vanity-item">
                  <div className="vanity-item-icon">
                    <event.icon />
                  </div>
                  <div className="vanity-item-content">
                    <h3>{event.title}</h3>
                    <p>{event.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card vanity-highlight">
            <div className="vanity-highlight-inner">
              <div className="vanity-highlight-icon">
                <Camera />
              </div>
              <div className="vanity-highlight-content">
                <h3>The shirt becomes the souvenir</h3>
                <p>
                  Long after the event ends, they still have the shirt. Years later, they scan and relive the day.
                </p>
              </div>
            </div>
          </div>

          <Link href="/creator?line=static-plus">
            <button className="vanity-cta" data-testid="button-create-event">
              Create Your Event Shirts
              <ArrowRight />
            </button>
          </Link>

          <div className="glass-card vanity-related">
            <h2 className="vanity-related-title">
              <Camera />
              Related Ideas
            </h2>
            <div className="vanity-related-grid">
              <Link href="/family-reunion-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Family Reunion Shirts</span>
                  <p>Photo memories for the whole family</p>
                </div>
              </Link>
              <Link href="/wedding-qr-shirts">
                <div className="glass-card vanity-related-link">
                  <span>Wedding QR Shirts</span>
                  <p>Wearable wedding favors</p>
                </div>
              </Link>
              <Link href="/band-dynamic-merch">
                <div className="glass-card vanity-related-link">
                  <span>Band Dynamic Merch</span>
                  <p>Updateable content for musicians</p>
                </div>
              </Link>
            </div>
          </div>

          <Link href="/qr-static-plus">
            <button className="vanity-back" data-testid="button-back-plus">
              ← Back to QR Plus
            </button>
          </Link>

        </div>
      </main>
      <Footer />
    </div>
  );
}
