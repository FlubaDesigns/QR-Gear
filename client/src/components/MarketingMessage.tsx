import { Link } from "wouter";
import { ArrowRight, History, ScanLine } from "lucide-react";
import hiddenMessageImg from "@assets/generated_images/marketing_hidden_message.png";
import preciousMomentsImg from "@assets/generated_images/marketing_precious_moments.png";
import qrDynamicsImg from "@assets/generated_images/marketing_qr_dynamics.png";
import brandsCreatorsImg from "@assets/generated_images/marketing_brands_creators.png";

const cards = [
  {
    testId: "message-hidden",
    image: hiddenMessageImg,
    imageAlt: "Person wearing a custom QR code hoodie — scannable hidden message apparel for creative expression",
    title: "Got a Hidden Message?",
    body: "Want to share something personal? Need to show your artwork? Have a video you'd love to share with everyone you meet? Ever thought about being a walking billboard?",
    tagline: "Meet QR Gear — custom gear that speaks for you.",
  },
  {
    testId: "message-customs",
    image: preciousMomentsImg,
    imageAlt: "Family wearing matching custom QR code shirts — scannable keepsake apparel for precious moments and memories",
    title: "Frame Your Precious Moments",
    body: "QR Canvas lets you design something truly yours. Combine today's technology with yesterday's memories. Create a wearable keepsake that tells your story.",
    tagline: "Your design. Your moment. Forever scannable.",
  },
  {
    testId: "message-dynamics",
    image: qrDynamicsImg,
    imageAlt: "Smartphone scanning a QR code with dynamic digital content streaming out — updateable QR merchandise technology",
    title: "Make It Live with QR Dynamics",
    body: "Take the vision further. Build your own collage of images or video. Create a moment and share it — then change it whenever you want. Update your content without reprinting.",
    tagline: "You are Dynamics. The next generation in gear.",
    premium: true,
  },
  {
    testId: "message-business",
    image: brandsCreatorsImg,
    imageAlt: "Professional wearing branded QR code merchandise at a networking event — custom QR gear for businesses and creators",
    title: "For Brands & Creators",
    body: "Track scans, measure engagement, and connect with your audience. Perfect for events, product launches, networking, and marketing campaigns that make an impression.",
    tagline: "Turn every interaction into a connection.",
  },
];

export default function MarketingMessage() {
  const lead = cards[0];

  return (
    <section className="message-section row" aria-labelledby="message-heading">
      <div className="row">
        <header className="section-header">
          <p className="kicker">More than what you wear</p>
          <h2 id="message-heading">Custom Gear That Sends a Message</h2>
          <p>Your story. Your style. Scannable by anyone.</p>
        </header>

        <article className="message-card layout__split-2" data-testid={lead.testId}>
          <div className="message-media">
            <img src={lead.image} alt={lead.imageAlt} loading="lazy" />
            <div className="message-scan-label">
              <ScanLine aria-hidden="true" />
              <div><strong>A little mystery.</strong><span>A whole story behind it.</span></div>
            </div>
          </div>
          <div className="message-copy">
            <p className="kicker">Wear the conversation starter</p>
            <h3>{lead.title}</h3>
            <p>{lead.body}</p>
            <p className="message-tagline">{lead.tagline}</p>
            <Link href="/build" className="qr-btn qr-btn--accent" data-testid="button-create-your-gear">
              Create Your Gear <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </article>

        <div className="message-grid layout__split-3">
          {cards.slice(1).map((card) => (
            <article
              key={card.testId}
              className={`message-card${card.premium ? " premium" : ""}`}
              data-testid={card.testId}
            >
              <div className="message-media">
                <img src={card.image} alt={card.imageAlt} loading="lazy" />
              </div>
              <div className="message-copy">
                <h3>{card.title}</h3>
                <p>{card.body}</p>
                <p className="message-tagline">{card.tagline}</p>
              </div>
            </article>
          ))}
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
