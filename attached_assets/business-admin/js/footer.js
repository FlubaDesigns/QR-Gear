/* Kingdom Connects – Business Admin Dashboard Footer */
(() => {
  const footer = document.getElementById("footer");
  if (footer) {
    footer.innerHTML = `
      <footer class="site-footer">
        <div class="footer-inner">
          <nav class="footer-nav">
            <a href="index.html">Dashboard</a>
            <a href="edit-listing.html">Edit Listing</a>
            <a href="reviews.html">Reviews</a>
          </nav>
          <a class="back-to-top" href="#top">Back to top ↑</a>
          <small>© ${new Date().getFullYear()} Kingdom Connects Business Portal</small>
        </div>
      </footer>
    `;
  }
})();
