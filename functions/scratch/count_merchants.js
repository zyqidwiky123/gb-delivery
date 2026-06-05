import admin from 'firebase-admin';
import { readFile } from 'fs/promises';

const SERVICE_ACCOUNT_PATH = '/home/marco/.gemini/antigravity/brain/210be323-7bdc-4fe3-aaae-e0abf5b9c6be/scratch/service-account.json';
const serviceAccount = JSON.parse(await readFile(SERVICE_ACCOUNT_PATH, 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function countFoodMerchants() {
    const snapshot = await db.collection('merchants').where('type', '==', 'food').count().get();
    console.log(`TOTAL_FOOD_MERCHANTS: ${snapshot.data().count}`);
    process.exit(0);
}

countFoodMerchants();
