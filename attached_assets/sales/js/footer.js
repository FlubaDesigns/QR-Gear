/* Kingdom Connects – Sales Dashboard Footer */
(() => {
  const footer = document.getElementById("footer");
  if (footer) {
    footer.innerHTML = `
      <footer class="site-footer">
        <div class="footer-inner">
          <nav class="footer-nav">
            <a href="index.html">Dashboard</a>
            <a href="commissions.html">Commissions</a>
            <a href="conversions.html">Conversions</a>
            <a href="agents.html">Agents</a>
          </nav>
          <a class="back-to-top" href="#top">Back to top ↑</a>
          <small>© ${new Date().getFullYear()} Kingdom Connects Sales</small>
        </div>
      </footer>
    `;
  }
})();
