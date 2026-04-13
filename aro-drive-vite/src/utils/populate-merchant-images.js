import admin from 'firebase-admin';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
  await readFile(join(__dirname, '../../../../.gemini/antigravity/brain/210be323-7bdc-4fe3-aaae-e0abf5b9c6be/scratch/service-account.json'), 'utf8')
);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

const FOOD_IMAGES = {
    'Nasi Goreng': [
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1621213233857-4560700d6477?w=800&fm=webp&q=80'
    ],
    'Ayam': [
        'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1606755962773-d324e0a13ea0?w=800&fm=webp&q=80'
    ],
    'Bakso': [
        'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&fm=webp&q=80'
    ],
    'Cafe': [
        'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1559925393-8be0ec41b44d?w=800&fm=webp&q=80'
    ],
    'Seblak': [
        'https://images.unsplash.com/photo-1593443320739-77f74939d0da?w=800&fm=webp&q=80'
    ],
    'Beverage': [
        'https://images.unsplash.com/photo-1544145945-f904253d0c7e?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1497515114629-f71d768fd07c?w=800&fm=webp&q=80'
    ],
    'Default': [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1473093226795-af9932fe5856?w=800&fm=webp&q=80'
    ]
};

function getRandomImage(category) {
    const list = FOOD_IMAGES[category] || FOOD_IMAGES['Default'];
    return list[Math.floor(Math.random() * list.length)];
}

async function populateMerchantImages() {
    console.log("Starting merchant image population...");
    const snapshot = await db.collection('merchants').get();
    let count = 0;
    let batch = db.batch();

    for (const doc of snapshot.docs) {
        const merchant = doc.data();
        
        let needsUpdate = false;
        let updateData = {};

        // Populate top-level image if empty
        if (!merchant.image) {
            updateData.image = getRandomImage(merchant.category);
            needsUpdate = true;
            count++;
        }

        // Safety: Ensure menu items also have images (just in case)
        const menu = merchant.menu || [];
        let menuUpdated = false;
        const updatedMenu = menu.map(item => {
            if (!item.img) {
                menuUpdated = true;
                return { ...item, img: getRandomImage(merchant.category) };
            }
            return item;
        });

        if (menuUpdated) {
            updateData.menu = updatedMenu;
            needsUpdate = true;
        }

        if (needsUpdate) {
            batch.update(doc.ref, updateData);
        }

        if (count % 400 === 0 && count > 0) {
            await batch.commit();
            batch = db.batch();
            console.log(`Updated ${count} records...`);
        }
    }

    await batch.commit();
    console.log(`Finished! Total merchants updated with top-level images: ${count}`);
    process.exit(0);
}

populateMerchantImages().catch(err => {
    console.error(err);
    process.exit(1);
});
