const admin = require('firebase-admin');
const https = require('https');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'qrgear-c1ffd.firebasestorage.app'
});

const db = admin.firestore();

async function test() {
  console.log('=== STEP 1: Check Firestore data ===');
  const snapshot = await db.collection('libraryAssets').get();
  console.log('Total docs:', snapshot.size);
  
  const backgrounds = [];
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.assetType === 'background' && data.isActive === true) {
      backgrounds.push({ id: doc.id, ...data });
    }
  });
  console.log('Background assets found:', backgrounds.length);
  
  console.log('\n=== STEP 2: Test image serving endpoint ===');
  const testAsset = backgrounds[0];
  const imageUrl = `https://qrgear-c1ffd.web.app${testAsset.publicUrl}`;
  
  await new Promise((resolve, reject) => {
    https.get(imageUrl, (res) => {
      console.log('Image endpoint status:', res.statusCode);
      let size = 0;
      res.on('data', chunk => size += chunk.length);
      res.on('end', () => {
        console.log('Response size:', size, 'bytes');
        console.log(res.statusCode === 200 && size > 1000 ? 'SUCCESS: Image serving!' : 'ERROR');
        resolve();
      });
    }).on('error', reject);
  });
  
  console.log('\n=== STEP 3: Generate admin token and test API ===');
  const uid = 'xHUmudG0t5OkCQhqyhB4nXhCUfs1';
  const customToken = await admin.auth().createCustomToken(uid);
  
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  const exchangeUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`;
  
  const idToken = await new Promise((resolve, reject) => {
    const postData = JSON.stringify({ token: customToken, returnSecureToken: true });
    const req = https.request(exchangeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        if (result.idToken) {
          resolve(result.idToken);
        } else {
          console.log('Token exchange failed:', data.substring(0, 300));
          reject(new Error('Failed to get ID token'));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
  
  console.log('ID token obtained, testing admin endpoint...');
  
  const apiUrl = 'https://qrgear-c1ffd.web.app/api/admin/background-assets';
  await new Promise((resolve, reject) => {
    https.get(apiUrl, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Admin API status:', res.statusCode);
        if (res.statusCode === 200) {
          const assets = JSON.parse(data);
          console.log('Assets returned:', assets.length);
          if (assets.length > 0) {
            console.log('First asset name:', assets[0].name);
            console.log('First asset proxyUrl:', assets[0].proxyUrl);
            console.log('\n=== ALL TESTS PASSED ===');
          } else {
            console.log('ERROR: API returned empty array');
          }
        } else {
          console.log('ERROR:', data.substring(0, 500));
        }
        resolve();
      });
    }).on('error', reject);
  });
  
  process.exit(0);
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
