const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
db.collection('libraryAssets').get().then(snapshot => {
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`${doc.id}: assetType="${data.assetType}" name="${data.name}"`);
  });
  process.exit(0);
});
