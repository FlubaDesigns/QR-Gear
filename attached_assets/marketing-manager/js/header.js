import { auth } from "../../js/firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const headerHTML = `
<header class="site-header">
  <nav class="nav-bar">
    <div class="container flex-between">
      <div class="logo-section">
        <a href="/index.html">
          <img src="/img/kingdom-connects-logo.png" alt="Kingdom Connects Logo" class="logo">
        </a>
      </div>
      <ul class="nav-links">
        <li><a href="/marketing-manager/index.html">Dashboard</a></li>
        <li><a href="/marketing-manager/team.html">Sales Team</a></li>
        <li><a href="/marketing-manager/analytics.html">Analytics</a></li>
        <li><a href="/marketing-manager/reports.html">Reports</a></li>
        <li><a href="/admin/email-campaigns.html">Campaigns</a></li>
        <li><a href="#" id="logoutLink" class="btn-logout">Logout</a></li>
      </ul>
    </div>
  </nav>
</header>
`;

document.getElementById('header').innerHTML = headerHTML;

document.getElementById('logoutLink').addEventListener('click', async (e) => {
  e.preventDefault();
  if (confirm('Are you sure you want to log out?')) {
    try {
      await signOut(auth);
      window.location.href = '/login.html';
    } catch (error) {
      console.error('Logout error:', error);
      alert('Error logging out. Please try again.');
    }
  }
});
