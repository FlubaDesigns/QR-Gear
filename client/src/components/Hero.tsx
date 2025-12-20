import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { QrCode, ShoppingBag, Lock } from "lucide-react";
import heroImage from "@assets/generated_images/Hero_lifestyle_QR_shirt_bd1f5f41.png";

export default function Hero() {
  return (
    <section className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden py-24 px-4">
      <img 
        src={heroImage} 
        alt="" 
        className="absolute inset-0 w-full h-full object-cover"
        aria-hidden="true"
      />
      <div className="absolute inset-0 hero-gradient" />
      
      <div className="relative z-10 text-center max-w-4xl mx-auto mb-12">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
          Your Message, Your Style,{" "}
          <span className="text-cyan">One Scan Away</span>
        </h1>
        <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
          QR Gear creates custom apparel and products with scannable QR codes. 
          Share your story, promote your business, or keep your info private — all on quality USA-made gear.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/creator">
            <Button
              size="lg"
              className="text-lg px-8 btn-cyan text-white"
              data-testid="button-create-design"
            >
              Create Your Design
            </Button>
          </Link>
          <Link href="/gallery">
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 bg-white/10 backdrop-blur-md border-white/30 text-white hover:bg-white/20"
              data-testid="button-shop-gallery"
            >
              Shop Gallery
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <Link href="/creator" className="block">
          <div 
            className="glass-card rounded-2xl p-6 text-center hover-elevate cursor-pointer transition-all duration-200 h-full"
            data-testid="card-create-qr"
          >
            <div className="w-14 h-14 rounded-xl icon-bg-cyan flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-7 h-7 icon-color-cyan" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Create Your QR</h3>
            <p className="text-sm text-white/70">
              Design a custom QR code with your text, link, or contact info
            </p>
          </div>
        </Link>

        <Link href="/gallery" className="block">
          <div 
            className="glass-card rounded-2xl p-6 text-center hover-elevate cursor-pointer transition-all duration-200 h-full"
            data-testid="card-shop-products"
          >
            <div className="w-14 h-14 rounded-xl icon-bg-gold flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-7 h-7 icon-color-gold" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Shop Products</h3>
            <p className="text-sm text-white/70">
              T-shirts, hats, bags & more — many made right here in the USA
            </p>
          </div>
        </Link>

        <div 
          className="glass-card rounded-2xl p-6 text-center h-full"
          data-testid="card-privacy"
        >
          <div className="w-14 h-14 rounded-xl icon-bg-cyan flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 icon-color-cyan" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Protect Your Privacy</h3>
          <p className="text-sm text-white/70">
            QR code your gym bag so people don't see your address, email, or phone number
          </p>
        </div>
      </div>
    </section>
  );
}
