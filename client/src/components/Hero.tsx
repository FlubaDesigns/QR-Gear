import { Link } from "wouter";
import { QRButton } from "@/components/QRButton";
import heroImage from "@assets/generated_images/Hero_lifestyle_QR_shirt_bd1f5f41.png";

export default function Hero() {
  return (
    <section className="hero">
      <div className="container hero__grid">
        <div className="hero__panel">
          <div className="kicker">Clothing That Connects</div>
          <h1>Your Shirt Just Got Smarter</h1>
          <p>
            Real gear with built-in QR codes. Scan to watch a video, save a contact, 
            or open content you control. No apps. Just point and scan.
          </p>

          <div className="hero__actions">
            <Link href="/creator">
              <QRButton variant="accent" data-testid="button-create-qr-gear">
                Create Your QR Gear
              </QRButton>
            </Link>
            <Link href="/gallery">
              <QRButton variant="ghost" data-testid="button-view-examples">
                View Examples
              </QRButton>
            </Link>
          </div>
        </div>

        <div className="glass card product">
          <div className="card__title">
            One-of-a-Kind Gear
            <span className="pill">USA-Made</span>
          </div>

          <div className="product__media">
            <img 
              src={heroImage} 
              alt="QR Gear shirt mockup" 
              data-testid="img-hero-product"
            />
          </div>

          <div className="product__label">Yours Alone • Made to Order</div>
        </div>
      </div>
    </section>
  );
}
