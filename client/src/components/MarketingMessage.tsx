import { Link } from "wouter";
import { QRButton } from "@/components/QRButton";
import { ArrowRight, History } from "lucide-react";
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
    body: "QR Customs lets you design something truly yours. Combine today's technology with yesterday's memories. Create a wearable keepsake that tells your story.",
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
  return (
    <section className="message-section">
      <div className="container">
        <div className="section-header">
          <h2>Custom Gear That Sends a Message</h2>
          <p>Your story. Your style. Scannable by anyone.</p>
        </div>

        <div className="message-grid">
          {cards.map((card) => (
            <div
              key={card.testId}
              className={`glass-card message-card overflow-hidden !p-0${card.premium ? " premium" : ""}`}
              data-testid={card.testId}
            >
              <div className="w-full h-44 overflow-hidden">
                <img
                  src={card.image}
                  alt={card.imageAlt}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-8">
                <h3>{card.title}</h3>
                <p>{card.body}</p>
                <p className="message-tagline">{card.tagline}</p>
              </div>
            </div>
          ))}
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
