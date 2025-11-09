const footerHTML = `
<footer class="site-footer">
  <div class="container">
    <p>&copy; ${new Date().getFullYear()} Kingdom Connects. All rights reserved.</p>
    <p class="text-sm opacity-70">Marketing Manager Dashboard</p>
  </div>
</footer>
`;

document.getElementById('footer').innerHTML = footerHTML;
