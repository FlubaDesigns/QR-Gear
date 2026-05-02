import { useState } from "react";
import { Link } from "wouter";
import { QrCode, Mail, MapPin, ChevronDown } from "lucide-react";
import { SiFacebook, SiInstagram, SiX, SiTiktok, SiYoutube } from "react-icons/si";

function FooterSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="footer__col footer__accordion">
      <button
        className={`footer__accordion-btn${open ? " footer__accordion-btn--open" : ""}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        data-testid={`footer-accordion-${title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <h4 className="footer__heading">{title}</h4>
        <ChevronDown className="footer__accordion-chevron" aria-hidden="true" />
      </button>
      <div className={`footer__accordion-content${open ? " footer__accordion-content--open" : ""}`}>
        {children}
      </div>
    </div>
  );
}

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container footer__content">
        <div className="footer__grid">

          <div className="footer__col footer__col--brand">
            <div className="footer__brand">
              <QrCode className="w-6 h-6 text-ice" />
              <span>QRGear.com</span>
            </div>
            <p className="footer__tagline">
              Physical gear. Digital world.
            </p>
            <div className="footer__social">
              <a href="https://www.facebook.com/ShopQRGear" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="footer__social-link" data-testid="link-facebook">
                <SiFacebook className="w-5 h-5" />
              </a>
              <a href="https://www.instagram.com/ShopQRGear" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="footer__social-link" data-testid="link-instagram">
                <SiInstagram className="w-5 h-5" />
              </a>
              <a href="https://www.tiktok.com/@qrgear" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="footer__social-link" data-testid="link-tiktok">
                <SiTiktok className="w-5 h-5" />
              </a>
              <a href="https://www.youtube.com/@GetTheGear" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="footer__social-link" data-testid="link-youtube">
                <SiYoutube className="w-5 h-5" />
              </a>
              <a href="https://x.com/ShopQRGear" target="_blank" rel="noopener noreferrer" aria-label="X" className="footer__social-link" data-testid="link-x">
                <SiX className="w-5 h-5" />
              </a>
            </div>
          </div>

          <FooterSection title="Shop">
            <nav className="footer__nav">
              <Link href="/shop/internal/qrgear" className="footer__link" data-testid="footer-link-store">All Products</Link>
              <Link href="/build" className="footer__link" data-testid="footer-link-creator">Create Custom</Link>
              <Link href="/gallery" className="footer__link" data-testid="footer-link-gallery">Gallery</Link>
            </nav>
          </FooterSection>

          <FooterSection title="Learn More">
            <nav className="footer__nav">
              <Link href="/qr-basics" className="footer__link" data-testid="footer-link-qr-basics">QR Basics</Link>
              <Link href="/qr-plus" className="footer__link" data-testid="footer-link-qr-plus">QR Plus</Link>
              <Link href="/qr-canvas" className="footer__link" data-testid="footer-link-qr-canvas">QR Canvas</Link>
              <Link href="/qr-play" className="footer__link" data-testid="footer-link-qr-play">QR Play</Link>
            </nav>
          </FooterSection>

          <FooterSection title="Connect">
            <div className="footer__contact">
              <div className="footer__contact-item">
                <Mail className="w-4 h-4" />
                <a href="mailto:info@qrgear.com" className="footer__link" data-testid="footer-link-email">info@qrgear.com</a>
              </div>
              <div className="footer__contact-item">
                <MapPin className="w-4 h-4" />
                <span>USA Products Available</span>
              </div>
            </div>
            <div className="footer__partner">
              <span className="text-xs text-muted-foreground">Partner of</span>
              <a href="https://kingdomconnects.com" target="_blank" rel="noopener noreferrer" className="footer__link">
                Kingdom Connects
              </a>
            </div>
          </FooterSection>

        </div>

        <div className="footer__bottom">
          <div className="footer__legal">
            <span>{currentYear} QRGear.com. All rights reserved.</span>
            <Link href="/privacy" className="footer__link" data-testid="footer-link-privacy">Privacy Policy</Link>
            <Link href="/terms" className="footer__link" data-testid="footer-link-terms">Terms of Service</Link>
          </div>
          <div className="footer__powered">
            <span>Powered by Printify</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
