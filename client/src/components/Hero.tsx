import { Link } from "wouter";
import { QRButton } from "@/components/QRButton";
import heroImage from "@assets/generated_images/Hero_lifestyle_QR_shirt_bd1f5f41.png";

export default function Hero() {
  return (
    <section className="hero">
      <div className="container hero__grid">
        <div className="hero__panel">
          <div className="kicker">Bridge Physical & Digital</div>
          <h1>QR Gear That Actually Works</h1>
          <p>
            Apparel and gear with built-in QR codes — designed to be scanned,
            tracked, updated, and reused in the real world.
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
            Real Product
            <span className="pill">Fabric + Stitch</span>
          </div>

          <div className="product__media">
            <img 
              src={heroImage} 
              alt="QR Gear shirt mockup" 
              data-testid="img-hero-product"
            />
          </div>

          <div className="product__label">Stitch • Scan • Connect</div>
        </div>
      </div>
    </section>
  );
}
