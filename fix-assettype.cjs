const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function fix() {
  const snapshot = await db.collection('libraryAssets').get();
  const batch = db.batch();
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.assetType === 'background') {
      console.log(`Updating ${doc.id}: background -> source`);
      batch.update(doc.ref, { assetType: 'source' });
    }
  });
  
  await batch.commit();
  console.log('Done. All assets now have assetType: source');
  
  // Verify
  const verify = await db.collection('libraryAssets').get();
  verify.docs.forEach(doc => {
    console.log(`${doc.id}: assetType="${doc.data().assetType}"`);
  });
}

fix().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
