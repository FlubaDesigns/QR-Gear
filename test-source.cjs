const admin = require('firebase-admin');
const https = require('https');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), storageBucket: 'qrgear-c1ffd.firebasestorage.app' });
}
const db = admin.firestore();

async function test() {
  // Verify Firestore has source type
  const snapshot = await db.collection('libraryAssets').get();
  const sources = snapshot.docs.filter(d => d.data().assetType === 'source');
  console.log('Assets with assetType=source:', sources.length);
  
  // Get token and test API
  const uid = 'xHUmudG0t5OkCQhqyhB4nXhCUfs1';
  const customToken = await admin.auth().createCustomToken(uid);
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  const exchangeUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`;
  
  const idToken = await new Promise((resolve, reject) => {
    const postData = JSON.stringify({ token: customToken, returnSecureToken: true });
    const req = https.request(exchangeUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }}, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data).idToken));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
  
  // Test admin API
  await new Promise((resolve) => {
    https.get('https://qrgear-c1ffd.web.app/api/admin/background-assets', {
      headers: { 'Authorization': `Bearer ${idToken}` }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('API status:', res.statusCode);
        if (res.statusCode === 200) {
          const assets = JSON.parse(data);
          console.log('Assets returned:', assets.length);
          if (assets.length > 0) console.log('SUCCESS - Images should display!');
        } else {
          console.log('Response:', data.substring(0, 200));
        }
        resolve();
      });
    });
  });
}
test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
