import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import heroImage from "@assets/generated_images/Hero_lifestyle_QR_shirt_bd1f5f41.png";

export default function Hero() {
  return (
    <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/60" />
      
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
