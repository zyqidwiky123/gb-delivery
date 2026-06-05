import admin from 'firebase-admin';
import { readFile } from 'fs/promises';

const SERVICE_ACCOUNT_PATH = '/home/marco/.gemini/antigravity/brain/210be323-7bdc-4fe3-aaae-e0abf5b9c6be/scratch/service-account.json';

if (!admin.apps.length) {
    const serviceAccount = JSON.parse(await readFile(SERVICE_ACCOUNT_PATH, 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function bulkVerify() {
    const snapshot = await db.collection('merchants').where('verified', '==', false).get();
    console.log(`Found ${snapshot.size} unverified merchants.`);

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { verified: true });
        console.log(`Verified: ${doc.data().name}`);
    });

    await batch.commit();
    console.log("--- All Done ---");
    process.exit(0);
}

bulkVerify();
