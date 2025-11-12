import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import heroImage from "@assets/generated_images/Hero_lifestyle_QR_shirt_bd1f5f41.png";
import "@/styles/hero.css";

export default function Hero() {
  return (
    <section className="hero-section">
      <div className="hero-background" style={{ backgroundImage: `url(${heroImage})` }} />
      <div className="hero-overlay" />
      
      <div className="hero-content">
        <h1 className="hero-title">
          Your Message. Their Discovery.
        </h1>
        <p className="hero-description">
          Create custom QR codes on premium products. Hidden messages, instant connections, proudly American-made.
        </p>
        <div className="hero-actions">
          <Link href="/creator">
            <Button
              size="lg"
              variant="default"
              className="text-lg px-8"
              data-testid="button-create-design"
            >
              Create Your Design
            </Button>
          </Link>
          <Link href="/gallery">
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 bg-background/10 backdrop-blur-sm border-white/20 text-white hover:bg-background/20"
              data-testid="button-shop-gallery"
            >
              Shop Gallery
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
