import * as admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'qrgear-c1ffd.firebasestorage.app'
  });
}

async function testHttpEndpoint() {
  console.log('[HTTP TEST] Testing production HTTP endpoint...');
  
  // Get admin user ID
  const db = admin.firestore();
  const usersSnapshot = await db.collection('users').where('isAdmin', '==', true).limit(1).get();
  const adminUserId = usersSnapshot.docs[0]?.id;
  
  if (!adminUserId) {
    console.log('[HTTP TEST] No admin user found');
    return false;
  }
  
  console.log(`[HTTP TEST] Admin user: ${adminUserId}`);
  
  // Create a custom token and exchange it for an ID token
  const customToken = await admin.auth().createCustomToken(adminUserId);
  
  // Use Firebase REST API to exchange custom token for ID token
  const apiKey = 'AIzaSyAM98_U3QT7XQFI4h-_yI5z-YZ3p8fvT0c'; // This is public Firebase API key
  
  const tokenResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true
      })
    }
  );
  
  const tokenData = await tokenResponse.json() as any;
  
  if (!tokenData.idToken) {
    console.log('[HTTP TEST] Failed to get ID token:', tokenData);
    return false;
  }
  
  console.log('[HTTP TEST] Got ID token (length):', tokenData.idToken.length);
  
  // Now test the actual HTTP endpoint
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  const testName = `http-test-${Date.now()}`;
  
  console.log('[HTTP TEST] Calling production endpoint...');
  
  // NOTE: background-assets endpoint removed (410 Gone). Testing save-grf instead.
  const response = await fetch('https://api-b3rye3vhuq-uc.a.run.app/api/admin/graphics/save-grf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenData.idToken}`
    },
    body: JSON.stringify({
      typeCode: '01',
      roleCode: '1',
      imageUrl: `data:image/png;base64,${testImageBase64}`,
      name: testName,
      mimeType: 'image/png'
    })
  });
  
  console.log(`[HTTP TEST] Response status: ${response.status}`);
  
  const result = await response.json();
  console.log('[HTTP TEST] Response:', JSON.stringify(result, null, 2));
  
  if (response.ok && result.grfId) {
    console.log('[HTTP TEST] ✅ HTTP ENDPOINT VERIFIED!');
    console.log(`[HTTP TEST] Created GRF: ${result.grfId}`);
    return true;
  } else {
    console.log('[HTTP TEST] ❌ HTTP ENDPOINT FAILED');
    return false;
  }
}

testHttpEndpoint().then(ok => process.exit(ok ? 0 : 1));
