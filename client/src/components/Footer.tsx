import { Link } from "wouter";
import { QrCode, Mail, MapPin, Phone } from "lucide-react";
import { SiFacebook, SiInstagram, SiX } from "react-icons/si";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container footer__content">
        <div className="footer__grid">
          <div className="footer__col">
            <div className="footer__brand">
              <QrCode className="w-6 h-6 text-ice" />
              <span>QRGear.com</span>
            </div>
            <p className="footer__tagline">
              Custom QR code merchandise with USA options. Bridge the physical and digital world.
            </p>
            <div className="footer__social">
              <a href="#" aria-label="Facebook" className="footer__social-link" data-testid="link-facebook">
                <SiFacebook className="w-5 h-5" />
              </a>
              <a href="#" aria-label="Instagram" className="footer__social-link" data-testid="link-instagram">
                <SiInstagram className="w-5 h-5" />
              </a>
              <a href="#" aria-label="X" className="footer__social-link" data-testid="link-x">
                <SiX className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div className="footer__col">
            <h4 className="footer__heading">Shop</h4>
            <nav className="footer__nav">
              <Link href="/store" className="footer__link" data-testid="footer-link-store">All Products</Link>
              <Link href="/build" className="footer__link" data-testid="footer-link-creator">Create Custom</Link>
              <Link href="/gallery" className="footer__link" data-testid="footer-link-gallery">Gallery</Link>
            </nav>
          </div>

          <div className="footer__col">
            <h4 className="footer__heading">Support</h4>
            <nav className="footer__nav">
              <a href="#" className="footer__link" data-testid="footer-link-faq">FAQ</a>
              <a href="#" className="footer__link" data-testid="footer-link-shipping">Shipping Info</a>
              <a href="#" className="footer__link" data-testid="footer-link-returns">Returns</a>
              <a href="#" className="footer__link" data-testid="footer-link-contact">Contact Us</a>
            </nav>
          </div>

          <div className="footer__col">
            <h4 className="footer__heading">Connect</h4>
            <div className="footer__contact">
              <div className="footer__contact-item">
                <Mail className="w-4 h-4" />
                <span>support@qrgear.com</span>
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
          </div>
        </div>

        <div className="footer__bottom">
          <div className="footer__legal">
            <span>{currentYear} QRGear.com. All rights reserved.</span>
            <a href="#" className="footer__link">Privacy Policy</a>
            <a href="#" className="footer__link">Terms of Service</a>
          </div>
          <div className="footer__powered">
            <span>Powered by Printify</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
