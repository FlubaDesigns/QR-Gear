import { auth, db } from "../../js/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function verifyMarketingManagerAccess(user) {
  if (!user) {
    alert('Please log in to access the Marketing Manager dashboard.');
    window.location.href = '/login.html';
    return false;
  }

  try {
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      alert('User profile not found. Please contact support.');
      window.location.href = '/index.html';
      return false;
    }

    const userData = userDoc.data();
    const userRole = userData.role || 'user';

    if (userRole !== 'marketing_manager' && userRole !== 'admin') {
      alert('Access Denied: Marketing Manager privileges required.');
      window.location.href = '/index.html';
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error verifying marketing manager access:', error);
    alert('Error verifying permissions. Please try again.');
    window.location.href = '/index.html';
    return false;
  }
}

onAuthStateChanged(auth, async (user) => {
  await verifyMarketingManagerAccess(user);
});
