/* QR Gear – footer.js (modular version, based on Kingdom Connects) */
(() => {
  const footer = document.getElementById("footer");
  if (footer) {
    footer.innerHTML = `
      <footer class="site-footer">
        <div class="footer-inner">
          <div class="footer-grid">
            <div class="footer-section">
              <h4>Products</h4>
              <nav class="footer-links">
                <a href="/products" data-testid="footer-link-products">Browse Products</a>
                <a href="/design" data-testid="footer-link-design">Design Studio</a>
                <a href="/usa-made" data-testid="footer-link-usa">USA Made</a>
              </nav>
            </div>
            
            <div class="footer-section">
              <h4>Account</h4>
              <nav class="footer-links">
                <a href="/account" data-testid="footer-link-account">My Account</a>
                <a href="/orders" data-testid="footer-link-orders">Order History</a>
                <a href="/saved" data-testid="footer-link-saved">Saved Designs</a>
              </nav>
            </div>
            
            <div class="footer-section">
              <h4>Company</h4>
              <nav class="footer-links">
                <a href="/about" data-testid="footer-link-about">About Us</a>
                <a href="/contact" data-testid="footer-link-contact">Contact</a>
                <a href="/faq" data-testid="footer-link-faq">Help & FAQ</a>
              </nav>
            </div>
            
            <div class="footer-section">
              <h4>Legal</h4>
              <nav class="footer-links">
                <a href="/privacy" data-testid="footer-link-privacy">Privacy Policy</a>
                <a href="/terms" data-testid="footer-link-terms">Terms of Service</a>
                <a href="/returns" data-testid="footer-link-returns">Returns & Exchanges</a>
              </nav>
            </div>
          </div>
          
          <div class="footer-bottom">
            <a class="back-to-top" href="#top" data-testid="link-back-to-top">Back to top ↑</a>
            <small>© ${new Date().getFullYear()} QR Gear. All rights reserved.</small>
          </div>
        </div>
      </footer>
    `;
  }
})();
