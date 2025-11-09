/* Kingdom Connects – breadcrumbs.js */
/* Auto-generates breadcrumbs based on page hierarchy */
(() => {
  const breadcrumbContainer = document.getElementById('breadcrumbs');
  if (!breadcrumbContainer) return;

  const path = window.location.pathname;
  const segments = path.split('/').filter(s => s && s !== 'index.html');
  
  // Define page hierarchy and friendly names
  const pageNames = {
    'index.html': 'Home',
    'business.html': 'Businesses',
    'church_directory.html': 'Churches',
    'submit_business.html': 'Submit Business',
    'submit_church.html': 'Submit Church',
    'submit_review.html': 'Submit Review',
    'about.html': 'About',
    'contact.html': 'Contact',
    'faq.html': 'Help & FAQ',
    'privacy.html': 'Privacy Policy',
    'terms.html': 'Terms of Service',
    'login.html': 'Login',
    'search_businesses.html': 'Search Results'
  };

  // Build breadcrumb trail
  const breadcrumbs = [{ label: 'Home', url: 'index.html' }];
  
  // Get current page
  const currentPage = segments[segments.length - 1] || 'index.html';
  const pageName = pageNames[currentPage] || currentPage.replace('.html', '').replace(/_/g, ' ');
  
  // For detail pages (church.html, business.html with ID parameter), add intermediate level
  const urlParams = new URLSearchParams(window.location.search);
  const hasId = urlParams.get('id');
  
  if (currentPage === 'church.html' && hasId) {
    breadcrumbs.push({ label: 'Churches', url: 'church_directory.html' });
    breadcrumbs.push({ label: 'Church Details', url: null });
  } else if (currentPage === 'business.html' && hasId) {
    breadcrumbs.push({ label: 'Businesses', url: 'business.html' });
    breadcrumbs.push({ label: 'Business Details', url: null });
  } else if (currentPage !== 'index.html') {
    breadcrumbs.push({ label: pageName, url: null });
  }

  // Render breadcrumbs
  const html = breadcrumbs.map((crumb, index) => {
    const isLast = index === breadcrumbs.length - 1;
    
    if (isLast || !crumb.url) {
      return `<span class="current">${crumb.label}</span>`;
    } else {
      return `<a href="${crumb.url}">${crumb.label}</a><span class="separator">›</span>`;
    }
  }).join('');

  breadcrumbContainer.innerHTML = `<nav class="breadcrumbs" aria-label="Breadcrumb">${html}</nav>`;
})();
