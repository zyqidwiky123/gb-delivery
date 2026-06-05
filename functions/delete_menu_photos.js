const admin = require('firebase-admin');

// Set DRY_RUN to false to actually delete
const DRY_RUN = true;

try {
  admin.initializeApp({
    projectId: 'gb-delivery-41bf6'
  });
  const db = admin.firestore();
  console.log("Firebase Admin initialized.");

  db.collection('merchants').get().then(async (snapshot) => {
    console.log(`Found ${snapshot.size} merchants total.`);
    let updateCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const updates = {};

      if (data.menu_thumbnails) {
        updates.menu_thumbnails = admin.firestore.FieldValue.delete();
      }
      if (data.originalMenuImage) {
        updates.originalMenuImage = admin.firestore.FieldValue.delete();
      }

      if (Object.keys(updates).length > 0) {
        updateCount++;
        console.log(`[${updateCount}] Merchant: ${data.name || doc.id} (${doc.id})`);
        if (data.menu_thumbnails) console.log(`  - Will delete menu_thumbnails`);
        if (data.originalMenuImage) console.log(`  - Will delete originalMenuImage`);

        if (!DRY_RUN) {
          await doc.ref.update(updates);
          console.log(`  -> Deleted.`);
        }
      }
    }

    console.log(`\nTotal merchants to update: ${updateCount}`);
    if (DRY_RUN) {
      console.log("DRY RUN: No changes were made.");
    } else {
      console.log("Execution completed.");
    }
    process.exit(0);
  }).catch(err => {
    console.error("Error fetching merchants:", err);
    process.exit(1);
  });
} catch (e) {
  console.error("Initialization failed:", e);
  process.exit(1);
}
