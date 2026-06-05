import admin from 'firebase-admin';
import axios from 'axios';
import { readFile } from 'fs/promises';

const API_KEY = "AIzaSyAMdIaOkJQ8t_rokwEDkBWTJjjw9tmYzUk";
const SERVICE_ACCOUNT_PATH = '/home/marco/.gemini/antigravity/brain/210be323-7bdc-4fe3-aaae-e0abf5b9c6be/scratch/service-account.json';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(await readFile(SERVICE_ACCOUNT_PATH, 'utf8'));
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function syncPopularity() {
    console.log("🚀 Memulai sinkronisasi popularitas merchant...");
    
    // Ambil semua merchant (fokus ke food dulu jika perlu)
    const snapshot = await db.collection('merchants').where('type', '==', 'food').get();
    console.log(`Found ${snapshot.size} food merchants.`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        let placeId = data.place_id;
        
        // If no explicit place_id, try to extract from doc.id (e.g. google_ChIJ...)
        if (!placeId && doc.id.startsWith('google_')) {
            placeId = doc.id.replace('google_', '');
        }

        // Skip jika tidak punya place_id atau place_id manual
        if (!placeId || placeId.includes('manual')) {
            skippedCount++;
            continue;
        }

        try {
            // Fetch Place Details from Google Maps
            const response = await axios.get(`https://maps.googleapis.com/maps/api/place/details/json`, {
                params: {
                    place_id: placeId,
                    fields: 'user_ratings_total,rating',
                    key: API_KEY
                }
            });

            const result = response.data.result;
            if (result && result.user_ratings_total !== undefined) {
                await doc.ref.update({
                    reviewsCount: result.user_ratings_total,
                    rating: result.rating || data.rating || 0,
                    popularitySyncedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`✅ Updated ${data.name}: ${result.user_ratings_total} reviews.`);
                updatedCount++;
            } else {
                console.log(`⚠️ No rating data for ${data.name}`);
                skippedCount++;
            }
            
            // Avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
            console.error(`❌ Error updating ${data.name}:`, error.message);
        }
    }

    console.log("\n--- Selesai ---");
    console.log(`Total Updated: ${updatedCount}`);
    console.log(`Total Skipped: ${skippedCount}`);
    process.exit(0);
}

syncPopularity();
