/* QR Gear – header.js (modular version, based on Kingdom Connects) */
(() => {
  const html = document.documentElement;

  // ---------- Load saved theme ----------
  const savedTheme = localStorage.getItem('qrgear-theme');
  if (savedTheme) html.setAttribute('data-theme', savedTheme);

  // ---------- HEADER ----------
  const header = document.getElementById("header");
  if (header) {
    header.innerHTML = `
      <header class="site-header">
        <div class="header-inner">
          <a class="brand" href="/" aria-label="Home">
            <img class="site-logo" src="/img/qr-gear-logo.png" alt="QR Gear logo">
            <h1 class="site-title">QR Gear</h1>
          </a>

          <div class="header-actions">
            <div class="gear-wrap">
              <button id="settingsBtn" class="gear-btn" aria-haspopup="menu" aria-expanded="false" title="Display & theme settings" type="button" data-testid="button-settings">
                <svg viewBox="0 0 24 24" aria-hidden="true" width="24" height="24" fill="currentColor">
                  <path d="M19.14,12.94a7.43,7.43,0,0,0,.05-.94,7.43,7.43,0,0,0-.05-.94l2.11-1.65a.5.5,0,0,0,.12-.64l-2-3.46a.5.5,0,0,0-.6-.22l-2.49,1a7.34,7.34,0,0,0-1.63-.94l-.38-2.65A.5.5,0,0,0,13,0H11a.5.5,0,0,0-.49.41L10.13,3.06a7.34,7.34,0,0,0-1.63.94l-2.49-1a.5.5,0,0,0-.6.22l-2,3.46a.5.5,0,0,0,.12.64L3.65,11.06a7.43,7.43,0,0,0-.05.94,7.43,7.43,0,0,0,.05.94L1.54,14.59a.5.5,0,0,0-.12.64l2,3.46a.5.5,0,0,0,.6.22l2.49-1a7.34,7.34,0,0,0,1.63.94l.38,2.65A.5.5,0,0,0,11,22h2a.5.5,0,0,0,.49-.41l.38-2.65a7.34,7.34,0,0,0,1.63-.94l2.49,1a.5.5,0,0,0,.6-.22l2-3.46a.5.5,0,0,0-.12-.64ZM12,15.5A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"/>
                </svg>
              </button>

              <div id="settingsMenu" role="menu" aria-label="Display & theme settings">
                <h4>Display</h4>
                <div class="setting-row">
                  <span>Theme</span>
                  <button class="theme-toggle" id="themeToggle" aria-label="Toggle light/dark" type="button" data-testid="button-theme-toggle">
                    <span class="toggle-track"><span class="toggle-thumb"></span></span>
                  </button>
                </div>
              </div>
            </div>

            <button class="menu-toggle" id="menuBtn" aria-haspopup="true" aria-expanded="false" aria-controls="navMenu" title="Open menu" type="button" data-testid="button-menu">
              <span class="bar"></span><span class="bar"></span><span class="bar"></span>
            </button>
          </div>

          <ul class="nav-links" id="navMenu">
            <li><a href="/" data-testid="link-nav-home">Home</a></li>
            <li><a href="/products" data-testid="link-nav-products">Products</a></li>
            <li><a href="/design" data-testid="link-nav-design">Design Studio</a></li>
            <li><a href="/account" data-testid="link-nav-account">My Account</a></li>
            <li><a href="/about" data-testid="link-nav-about">About</a></li>
            <li><a href="/contact" data-testid="link-nav-contact">Contact</a></li>
            <li><a href="/login" class="login-link" data-testid="link-login">Login</a></li>
          </ul>
        </div>
      </header>
    `;
  }

  // ---------- MENU ----------
  const menuBtn = document.getElementById("menuBtn");
  const navMenu = document.getElementById("navMenu");
  if (menuBtn && navMenu) {
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = navMenu.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", (e) => {
      if (!navMenu.contains(e.target) && !menuBtn.contains(e.target)) {
        navMenu.classList.remove("open");
        menuBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  // ---------- SETTINGS ----------
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsMenu = document.getElementById("settingsMenu");
  if (settingsBtn && settingsMenu) {
    settingsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      settingsMenu.classList.toggle("open");
      settingsBtn.setAttribute("aria-expanded", settingsMenu.classList.contains("open"));
    });
    document.addEventListener("click", (e) => {
      if (!settingsMenu.contains(e.target) && !settingsBtn.contains(e.target)) {
        settingsMenu.classList.remove("open");
        settingsBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  // ---------- THEME TOGGLE ----------
  const themeToggle = document.getElementById("themeToggle");
  const applyTheme = (mode) => {
    html.setAttribute("data-theme", mode);
    try { localStorage.setItem("qrgear-theme", mode); } catch(_) {}
  };
  if (themeToggle) {
    themeToggle.classList.toggle("is-on", (html.getAttribute("data-theme") || "dark") === "light");
    themeToggle.addEventListener("click", () => {
      const current = html.getAttribute("data-theme") || "dark";
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      themeToggle.classList.toggle("is-on", next === "light");
    });
  }
})();
