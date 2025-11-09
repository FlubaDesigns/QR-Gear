/* Kingdom Connects – footer_public.js (modular version) */
(() => {
  const footer = document.getElementById("footer");
  if (footer) {
    footer.innerHTML = `
      <footer class="site-footer">
        <div class="footer-inner">
          <div class="footer-grid">
            <div class="footer-section">
              <h4>Directories</h4>
              <nav class="footer-links">
                <a href="business.html">Businesses</a>
                <a href="church_directory.html">Churches</a>
              </nav>
            </div>
            
            <div class="footer-section">
              <h4>Get Listed</h4>
              <nav class="footer-links">
                <a href="submit_business.html">Submit Business</a>
                <a href="submit_church.html">Submit Church</a>
              </nav>
            </div>
            
            <div class="footer-section">
              <h4>Company</h4>
              <nav class="footer-links">
                <a href="about.html">About</a>
                <a href="contact.html">Contact</a>
                <a href="faq.html">Help & FAQ</a>
              </nav>
            </div>
            
            <div class="footer-section">
              <h4>Legal</h4>
              <nav class="footer-links">
                <a href="privacy.html">Privacy Policy</a>
                <a href="terms.html">Terms of Service</a>
              </nav>
            </div>
          </div>
          
          <div class="footer-bottom">
            <a class="back-to-top" href="#top">Back to top ↑</a>
            <small>© ${new Date().getFullYear()} Kingdom Connects. All rights reserved.</small>
          </div>
        </div>
      </footer>
    `;
  }
})();
