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

// ENHANCED PHOTO POOLS
const POOLS = {
    DRINK: [
        'https://images.unsplash.com/photo-1544145945-f904253d0c7e?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1497515114629-f71d768fd07c?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1536935338218-d413524ccf53?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1517701614591-688ac4150217?w=800&fm=webp&q=80'
    ],
    POULTRY: [
        'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1606755962773-d324e0a13ea0?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1626645272640-9b49728aa29e?w=800&fm=webp&q=80'
    ],
    SOUP: [
        'https://images.unsplash.com/photo-1593443320739-77f74939d0da?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1615485240318-22ba186ef19a?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1607528971846-990590a2aedb?w=800&fm=webp&q=80'
    ],
    MAIN: [
        'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1621213233857-4560700d6477?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1615937657715-bc7b4b7962c1?w=800&fm=webp&q=80'
    ],
    SNACK: [
        'https://images.unsplash.com/photo-1528975604071-b4dc52a2d18c?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1559925393-8be0ec41b44d?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&fm=webp&q=80',
        'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&fm=webp&q=80'
    ]
};

const KEYWORDS = {
    DRINK: ['teh', 'es', 'jeruk', 'kopi', 'susu', 'jus', 'drink', 'cola', 'boba', 'air', 'mineral', 'kelapa', 'cappucino', 'latte', 'matcha', 'tea', 'ice', 'water', 'lemon', 'coffee', 'milk'],
    POULTRY: ['ayam', 'bebek', 'puyuh', 'sate', 'wings', 'fried chicken', 'chicken', 'daging', 'kfc'],
    SOUP: ['bakso', 'pentol', 'soto', 'kuah', 'cilok', 'seblak', 'siomay', 'batagor', 'baso', 'mie ayam', 'soup', 'ramen'],
    MAIN: ['nasi', 'mie', 'goreng', 'lalapan', 'pecel', 'gudeg', 'rawon', 'rames', 'warteg', 'penyet', 'lele', 'ikan', 'seafood', 'fried rice', 'noodle', 'nasgor', 'miegor'],
    SNACK: ['roti', 'martabak', 'cemilan', 'snack', 'kue', 'dessert', 'pisang', 'bolu', 'donut', 'donat', 'bread', 'cake']
};

function getRandomFromPool(poolKey) {
    const list = POOLS[poolKey];
    return list[Math.floor(Math.random() * list.length)];
}

function getSmartImage(itemName, merchantCategory) {
    const nameLower = itemName.toLowerCase();
    
    // 1. Check Keywords
    for (const [key, keywords] of Object.entries(KEYWORDS)) {
        if (keywords.some(kw => nameLower.includes(kw))) {
            return getRandomFromPool(key);
        }
    }

    // 2. Fallback to Merchant Category Mapping
    const catLower = (merchantCategory || '').toLowerCase();
    if (catLower.includes('cafe')) return getRandomFromPool('SNACK');
    if (catLower.includes('ayam') || catLower.includes('bebek')) return getRandomFromPool('POULTRY');
    if (catLower.includes('nasi') || catLower.includes('goreng')) return getRandomFromPool('MAIN');
    if (catLower.includes('seblak') || catLower.includes('bakso')) return getRandomFromPool('SOUP');

    // 3. Absolute Fallback
    return getRandomFromPool('MAIN');
}

async function smartPopulateMenu() {
    console.log("Starting smart menu population...");
    const snapshot = await db.collection('merchants').get();
    let totalItemsUpdated = 0;
    let batch = db.batch();
    let batchSize = 0;

    for (const doc of snapshot.docs) {
        const merchant = doc.data();
        const menu = merchant.menu || [];
        
        if (menu.length === 0) continue;

        const updatedMenu = menu.map(item => {
            return {
                ...item,
                img: getSmartImage(item.name || '', merchant.category || '')
            };
        });

        batch.update(doc.ref, { menu: updatedMenu });
        totalItemsUpdated += menu.length;
        batchSize++;

        if (batchSize >= 400) {
            await batch.commit();
            console.log(`Updated items for ${totalItemsUpdated} entries...`);
            batch = db.batch();
            batchSize = 0;
        }
    }

    if (batchSize > 0) {
        await batch.commit();
    }

    console.log(`Finished! Total menu items re-populated: ${totalItemsUpdated}`);
    process.exit(0);
}

smartPopulateMenu().catch(err => {
    console.error(err);
    process.exit(1);
});
