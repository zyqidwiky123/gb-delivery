import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const SERVICE_ACCOUNT_PATH = '/home/marco/.gemini/antigravity/brain/210be323-7bdc-4fe3-aaae-e0abf5b9c6be/scratch/service-account.json';
const PHOTO_MAPPING_PATH = '/home/marco/.gemini/antigravity/brain/210be323-7bdc-4fe3-aaae-e0abf5b9c6be/scratch/photo_mapping.json';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
const photoMapping = JSON.parse(fs.readFileSync(PHOTO_MAPPING_PATH, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function massivePopulate() {
  console.log('🚀 Starting massive menu photo population...');
  
  const merchantsRef = db.collection('merchants');
  const snapshot = await merchantsRef.get();
  
  console.log(`📦 Found ${snapshot.size} merchants. Processing...`);
  
  let totalUpdatedMerchants = 0;
  let totalUpdatedItems = 0;
  
  // Use batch for better performance (Firestore limits 500 per batch)
  let batch = db.batch();
  let countInBatch = 0;
  const BATCH_LIMIT = 500;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.menu || !Array.isArray(data.menu)) continue;

    let docModified = false;
    const updatedMenu = data.menu.map(item => {
      // If image is missing and we have a mapping
      if ((!item.img || item.img === '') && photoMapping[item.name]) {
        totalUpdatedItems++;
        docModified = true;
        return { ...item, img: photoMapping[item.name] };
      }
      return item;
    });

    if (docModified) {
      batch.update(doc.ref, { menu: updatedMenu });
      countInBatch++;
      totalUpdatedMerchants++;

      // If batch is full, commit and start a new one
      if (countInBatch >= BATCH_LIMIT) {
        console.log(`⏳ Committing batch of ${countInBatch} updates...`);
        await batch.commit();
        batch = db.batch();
        countInBatch = 0;
      }
    }
  }

  // Commit remaining updates
  if (countInBatch > 0) {
    console.log(`⏳ Committing final batch of ${countInBatch} updates...`);
    await batch.commit();
  }

  console.log('\n✅ FINISHED!');
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Total Merchants Scanned:  ${snapshot.size}`);
  console.log(`Merchants Updated:       ${totalUpdatedMerchants}`);
  console.log(`Food Items Populated:    ${totalUpdatedItems}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

massivePopulate().catch(err => {
  console.error('❌ FATAL ERROR:', err);
  process.exit(1);
});
