/* Kingdom Connects - Homepage Enhancements */
import { db } from './firebase-config.js';
import { collection, query, where, getDocs, limit, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Import loading skeleton utilities
import './loading-skeletons.js';

// ========== LIVE STATS ==========
async function loadStats() {
  const statsContainer = document.getElementById('statsBusinesses')?.parentElement?.parentElement;
  
  // Show skeleton while loading
  if (statsContainer && window.showSkeletons) {
    window.showSkeletons(statsContainer.id || 'liveStats', 'stats', 1);
  }
  
  try {
    const businessesSnap = await getDocs(collection(db, 'business_listings'));
    const churchesSnap = await getDocs(collection(db, 'churches'));
    
    const businessCount = businessesSnap.size;
    const churchCount = churchesSnap.size;
    
    // Calculate total tithed (placeholder - will be real when payments are implemented)
    const tithedAmount = businessCount * 10; // $10 per business placeholder
    
    const businessEl = document.getElementById('statsBusinesses');
    const churchEl = document.getElementById('statsChurches');
    const tithedEl = document.getElementById('statsTithed');
    
    if (businessEl) businessEl.textContent = businessCount.toLocaleString();
    if (churchEl) churchEl.textContent = churchCount.toLocaleString();
    if (tithedEl) tithedEl.textContent = '$' + tithedAmount.toLocaleString();
    
  } catch (error) {
    console.error('Error loading stats:', error);
    const businessEl = document.getElementById('statsBusinesses');
    const churchEl = document.getElementById('statsChurches');
    const tithedEl = document.getElementById('statsTithed');
    
    if (businessEl) businessEl.textContent = '0';
    if (churchEl) churchEl.textContent = '0';
    if (tithedEl) tithedEl.textContent = '$0';
  }
}

// ========== FEATURED PRO BUSINESSES ==========
async function loadFeaturedBusinesses() {
  const container = document.getElementById('featuredBusinesses');
  if (!container) return;
  
  // Show skeleton while loading
  if (window.showSkeletons) {
    window.showSkeletons('featuredBusinesses', 'business', 6);
  }
  
  try {
    const q = query(
      collection(db, 'business_listings'),
      where('pro_status', '==', true),
      orderBy('created_at', 'desc'),
      limit(6)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      container.innerHTML = `
        <div class="text-muted text-center" style="grid-column: 1 / -1; padding: 40px 20px;">
          <p>No Pro businesses yet. Be the first to upgrade!</p>
          <a href="pricing.html" class="action-button btn-gold" style="margin-top: 12px;">Upgrade to Pro</a>
        </div>
      `;
      return;
    }
    
    const businesses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const content = businesses.map(biz => {
      const rating = biz.average_rating || 0;
      const stars = '⭐'.repeat(Math.round(rating));
      
      return `
        <div class="business-card" style="cursor: pointer;" onclick="window.location.href='business.html?id=${biz.id}'">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <h3 class="gold" style="margin: 0; font-size: 1.1rem;">${biz.business_name || 'Business'}</h3>
            <span style="background: var(--gold); color: var(--dark-blue); padding: 4px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 800;">PRO</span>
          </div>
          <p style="margin: 4px 0; color: var(--text-muted); font-size: 0.875rem;">${biz.primary_category || 'Uncategorized'}</p>
          <p style="margin: 8px 0; font-size: 0.9rem; line-height: 1.4;">${(biz.description || '').substring(0, 100)}${biz.description?.length > 100 ? '...' : ''}</p>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
            <span style="font-size: 0.9rem;">${stars || '☆☆☆☆☆'}</span>
            <span class="gold" style="font-size: 0.85rem; font-weight: 600;">View Details →</span>
          </div>
        </div>
      `;
    }).join('');
    
    // Hide skeletons and show content
    if (window.hideSkeletons) {
      window.hideSkeletons('featuredBusinesses', content);
    } else {
      container.innerHTML = content;
    }
    
  } catch (error) {
    console.error('Error loading featured businesses:', error);
    container.innerHTML = `
      <div class="text-muted text-center" style="grid-column: 1 / -1; padding: 40px 20px;">
        <p>Unable to load featured businesses at this time.</p>
      </div>
    `;
  }
}

// ========== NEWSLETTER SIGNUP ==========
const newsletterForm = document.getElementById('newsletterForm');
if (newsletterForm) {
  newsletterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    
    // TODO: Integrate with email service (Mailchimp, SendGrid, etc.)
    alert(`Thanks for subscribing! We'll send updates to ${email}`);
    e.target.reset();
  });
}

// ========== STICKY HEADER ==========
const header = document.querySelector('.site-header');
if (header) {
  header.classList.add('sticky');
}

// ========== FLOATING BACK TO TOP BUTTON ==========
function addFloatingBackToTop() {
  const btn = document.createElement('a');
  btn.href = '#top';
  btn.className = 'back-to-top-float';
  btn.innerHTML = '↑';
  btn.setAttribute('aria-label', 'Back to top');
  document.body.appendChild(btn);
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  });
  
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ========== INITIALIZE ==========
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadFeaturedBusinesses();
  addFloatingBackToTop();
});
