/* Kingdom Connects – Church Admin Dashboard Footer */
(() => {
  const footer = document.getElementById("footer");
  if (footer) {
    footer.innerHTML = `
      <footer class="site-footer">
        <div class="footer-inner">
          <nav class="footer-nav">
            <a href="index.html">Dashboard</a>
            <a href="businesses.html">Businesses</a>
            <a href="profile.html">Church Profile</a>
          </nav>
          <a class="back-to-top" href="#top">Back to top ↑</a>
          <small>© ${new Date().getFullYear()} Kingdom Connects Church Admin</small>
        </div>
      </footer>
    `;
  }
})();
