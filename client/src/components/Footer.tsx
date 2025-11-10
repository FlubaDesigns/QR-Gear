import { Link } from "wouter";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-section">
            <h4>Products</h4>
            <nav className="footer-links">
              <Link href="/products" data-testid="footer-link-products">
                Browse Products
              </Link>
              <Link href="/design" data-testid="footer-link-design">
                Design Studio
              </Link>
              <Link href="/usa-made" data-testid="footer-link-usa">
                USA Made
              </Link>
            </nav>
          </div>

          <div className="footer-section">
            <h4>Account</h4>
            <nav className="footer-links">
              <Link href="/account" data-testid="footer-link-account">
                My Account
              </Link>
              <Link href="/orders" data-testid="footer-link-orders">
                Order History
              </Link>
              <Link href="/saved" data-testid="footer-link-saved">
                Saved Designs
              </Link>
            </nav>
          </div>

          <div className="footer-section">
            <h4>Company</h4>
            <nav className="footer-links">
              <Link href="/about" data-testid="footer-link-about">
                About Us
              </Link>
              <Link href="/contact" data-testid="footer-link-contact">
                Contact
              </Link>
              <Link href="/faq" data-testid="footer-link-faq">
                Help & FAQ
              </Link>
            </nav>
          </div>

          <div className="footer-section">
            <h4>Legal</h4>
            <nav className="footer-links">
              <Link href="/privacy" data-testid="footer-link-privacy">
                Privacy Policy
              </Link>
              <Link href="/terms" data-testid="footer-link-terms">
                Terms of Service
              </Link>
              <Link href="/returns" data-testid="footer-link-returns">
                Returns & Exchanges
              </Link>
            </nav>
          </div>
        </div>

        <div className="footer-bottom">
          <a className="back-to-top" href="#top" data-testid="link-back-to-top">
            Back to top ↑
          </a>
          <small>© {currentYear} QR Gear. All rights reserved.</small>
        </div>
      </div>
    </footer>
  );
}
