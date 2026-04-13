import admin from 'firebase-admin';
import fs from 'fs';

// Initialize with project ID. This might fail if no credentials are found.
admin.initializeApp({
  projectId: 'gb-delivery-41bf6'
});

const db = admin.firestore();

const updatesFile = '/home/marco/.gemini/antigravity/brain/210be323-7bdc-4fe3-aaae-e0abf5b9c6be/scratch/updates_to_apply.json';

async function run() {
  try {
    const data = JSON.parse(fs.readFileSync(updatesFile, 'utf8'));
    console.log(`Found ${data.length} updates to apply.`);

    const batch = db.batch();
    let count = 0;

    for (const item of data) {
      const docRef = db.collection('merchants').doc(item.id);
      
      // We only want to update the menu field.
      // Converting the 'fields' structure from REST format to flat JS object
      const menuValues = item.fields.menu.arrayValue.values;
      const updatedMenu = menuValues.map(v => {
        const f = v.mapValue.fields;
        return {
          desc: f.desc.stringValue,
          id: f.id.stringValue,
          img: f.img.stringValue,
          name: f.name.stringValue,
          price: parseInt(f.price.integerValue)
        };
      });

      batch.update(docRef, { menu: updatedMenu });
      count++;

      // Firestore batches are limited to 500 operations
      if (count >= 400) {
        await batch.commit();
        console.log(`Committed batch of ${count}`);
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
      console.log(`Committed final batch of ${count}`);
    }

    console.log('Update completed successfully.');
  } catch (err) {
    console.error('Error applying updates:', err);
    process.exit(1);
  }
}

run();
