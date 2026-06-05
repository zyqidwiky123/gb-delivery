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

// POOLS (Same as smart-populate-menu)
const POOLS = {
    DRINK: [
        'https://images.unsplash.com/photo-1544145945-f904253d0c7e?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1497515114629-f71d768fd07c?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800&fm=webp&q=80'
    ],
    POULTRY: [
        'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1606755962773-d324e0a13ea0?w=800&fm=webp&q=80'
    ],
    SOUP: [
        'https://images.unsplash.com/photo-1593443320739-77f74939d0da?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&fm=webp&q=80'
    ],
    MAIN: [
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1621213233857-4560700d6477?w=800&fm=webp&q=80'
    ],
    SNACK: [
        'https://images.unsplash.com/photo-1528975604071-b4dc52a2d18c?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1559925393-8be0ec41b44d?w=800&fm=webp&q=80'
    ]
};

const KEYWORDS = {
    DRINK: ['kopi', 'coffee', 'cafe', 'teh', 'es', 'jeruk', 'jus', 'drink', 'bobba', 'haus'],
    POULTRY: ['ayam', 'bebek', 'puyuh', 'sate', 'geprek', 'fried chicken', 'daging'],
    SOUP: ['bakso', 'pentol', 'soto', 'seblak', 'baso', 'mie ayam', 'siomay', 'batagor'],
    MAIN: ['nasi', 'mie', 'goreng', 'lalapan', 'pecel', 'gudeg', 'lele', 'penyet', 'rames', 'warung', 'kantin', 'rm '],
    SNACK: ['roti', 'martabak', 'snack', 'kue', 'donut', 'donat', 'pisang', 'cimol', 'cilok']
};

function getSmartImage(name, category) {
    const combined = `${name} ${category}`.toLowerCase();
    
    for (const [key, keywords] of Object.entries(KEYWORDS)) {
        if (keywords.some(kw => combined.includes(kw))) {
            return POOLS[key][Math.floor(Math.random() * POOLS[key].length)];
        }
    }
    return POOLS.MAIN[Math.floor(Math.random() * POOLS.MAIN.length)];
}

async function updateMerchantThumbnails() {
    console.log("Updating merchant thumbnails with smart matching...");
    const snapshot = await db.collection('merchants').get();
    let batch = db.batch();
    let count = 0;

    for (const doc of snapshot.docs) {
        const merchant = doc.data();
        const smartImg = getSmartImage(merchant.name || '', merchant.category || '');
        
        batch.update(doc.ref, { image: smartImg });
        count++;

        if (count % 400 === 0) {
            await batch.commit();
            console.log(`Updated ${count} thumbnails...`);
            batch = db.batch();
        }
    }

    await batch.commit();
    console.log(`Finished! Total merchant thumbnails updated: ${count}`);
    process.exit(0);
}

updateMerchantThumbnails().catch(console.error);
