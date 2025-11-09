/**
 * Admin Authentication Guard
 * Ensures only users with admin role can access admin pages
 */

import { db } from "../../js/firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * Verify user has admin role and redirect if not
 * @param {Object} authUser - Firebase Auth user object
 * @returns {Promise<boolean>} - True if admin, redirects otherwise
 */
export async function verifyAdminAccess(authUser) {
  if (!authUser) {
    window.location.href = "/login.html";
    return false;
  }

  try {
    // Check user role in Firestore
    const userDoc = await getDoc(doc(db, "users", authUser.uid));
    
    if (!userDoc.exists()) {
      console.error('User document not found');
      alert('Access Denied: User account not properly configured.');
      window.location.href = "/index.html";
      return false;
    }

    const userData = userDoc.data();
    const userRole = userData.role;

    if (userRole !== 'admin') {
      console.warn('Non-admin user attempted to access admin page:', authUser.email);
      alert('Access Denied: You do not have administrator privileges.');
      window.location.href = "/index.html";
      return false;
    }

    return true;

  } catch (error) {
    console.error('Error verifying admin access:', error);
    alert('Access verification failed. Please try again.');
    window.location.href = "/index.html";
    return false;
  }
}
