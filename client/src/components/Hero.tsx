import { Link } from "wouter";
import { useState, useEffect } from "react";
import { QRButton } from "@/components/QRButton";
import blueShirtImage from "@assets/generated_images/blue_shirt_qr_lifestyle_flat_lay.png";
import hoodieImage from "@assets/generated_images/navy_hoodie_with_qr_code.png";
import capImage from "@assets/generated_images/Phone_scanning_QR_cap_37352447.png";
import bagImage from "@assets/generated_images/Gym_bag_QR_mockup_9450e53d.png";
import mugImage from "@assets/generated_images/white_mug_with_qr_code.png";

const productImages = [
  { src: hoodieImage, label: "Hoodie" },
  { src: capImage, label: "Cap" },
  { src: bagImage, label: "Bag" },
  { src: mugImage, label: "Mug" },
];

function ProductCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % productImages.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-20 flex flex-col gap-2">
      <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-white/10">
        <img 
          src={productImages[current].src} 
          alt={productImages[current].label}
          className="w-full h-full object-cover transition-opacity duration-500"
        />
      </div>
      <span className="text-xs text-center text-white/80">{productImages[current].label}</span>
      <div className="flex justify-center gap-1">
        {productImages.map((_, i) => (
          <div 
            key={i} 
            className={`w-1.5 h-1.5 rounded-full transition-colors ${i === current ? 'bg-white' : 'bg-white/30'}`}
          />
        ))}
      </div>
    </div>
  );
}

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
            <Link href="/customize">
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
          </div>

          <div className="flex gap-4 items-center">
            <div className="product__media flex-1">
              <img 
                src={blueShirtImage} 
                alt="QR Gear blue shirt mockup" 
                data-testid="img-hero-product"
              />
            </div>
            <ProductCarousel />
          </div>

          <div className="flex justify-between items-center">
            <div className="product__label">Yours Alone • Made to Order</div>
            <span className="text-xs text-white/70">🇺🇸 USA Options</span>
          </div>
        </div>
      </div>
    </section>
  );
}
