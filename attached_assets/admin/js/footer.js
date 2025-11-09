/* Kingdom Connects – Admin Dashboard Footer */
(() => {
  const footer = document.getElementById("footer");
  if (footer) {
    footer.innerHTML = `
      <footer class="site-footer">
        <div class="footer-inner">
          <nav class="footer-nav">
            <a href="index.html">Dashboard</a>
            <a href="businesses.html">Businesses</a>
            <a href="churches.html">Churches</a>
            <a href="users.html">Users</a>
          </nav>
          <a class="back-to-top" href="#top">Back to top ↑</a>
          <small>© ${new Date().getFullYear()} Kingdom Connects Admin</small>
        </div>
      </footer>
    `;
  }
})();
