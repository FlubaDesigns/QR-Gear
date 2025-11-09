/* Kingdom Connects - Loading Skeleton Components */

/**
 * Creates a skeleton loader for business cards
 */
function createBusinessCardSkeleton() {
  return `
    <div class="skeleton-card">
      <div class="skeleton-header">
        <div class="skeleton-title"></div>
        <div class="skeleton-badge"></div>
      </div>
      <div class="skeleton-line short"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-footer">
        <div class="skeleton-line short"></div>
        <div class="skeleton-line short"></div>
      </div>
    </div>
  `;
}

/**
 * Creates a skeleton loader for church cards
 */
function createChurchCardSkeleton() {
  return `
    <div class="skeleton-card">
      <div class="skeleton-title"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line short"></div>
      <div class="skeleton-line short"></div>
    </div>
  `;
}

/**
 * Creates a skeleton loader for review cards
 */
function createReviewSkeleton() {
  return `
    <div class="skeleton-card">
      <div class="skeleton-header">
        <div class="skeleton-avatar"></div>
        <div style="flex: 1;">
          <div class="skeleton-line short"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line short"></div>
    </div>
  `;
}

/**
 * Creates a skeleton loader for stats
 */
function createStatsSkeleton() {
  return `
    <div class="skeleton-stats">
      <div class="skeleton-stat">
        <div class="skeleton-number"></div>
        <div class="skeleton-line short"></div>
      </div>
      <div class="skeleton-stat">
        <div class="skeleton-number"></div>
        <div class="skeleton-line short"></div>
      </div>
      <div class="skeleton-stat">
        <div class="skeleton-number"></div>
        <div class="skeleton-line short"></div>
      </div>
    </div>
  `;
}

/**
 * Show loading skeletons in a container
 * @param {string} containerId - ID of container element
 * @param {string} type - Type of skeleton (business, church, review, stats)
 * @param {number} count - Number of skeletons to show
 */
function showSkeletons(containerId, type = 'business', count = 3) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  let skeletonHTML = '';
  
  switch(type) {
    case 'business':
      for (let i = 0; i < count; i++) {
        skeletonHTML += createBusinessCardSkeleton();
      }
      break;
    case 'church':
      for (let i = 0; i < count; i++) {
        skeletonHTML += createChurchCardSkeleton();
      }
      break;
    case 'review':
      for (let i = 0; i < count; i++) {
        skeletonHTML += createReviewSkeleton();
      }
      break;
    case 'stats':
      skeletonHTML = createStatsSkeleton();
      break;
    default:
      for (let i = 0; i < count; i++) {
        skeletonHTML += createBusinessCardSkeleton();
      }
  }
  
  container.innerHTML = skeletonHTML;
}

/**
 * Hide loading skeletons and show actual content
 * @param {string} containerId - ID of container element
 * @param {string} content - HTML content to display
 */
function hideSkeletons(containerId, content) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = content;
}

// Export functions for use in other scripts
window.showSkeletons = showSkeletons;
window.hideSkeletons = hideSkeletons;
