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

async function syncOpeningHours() {
    console.log("🚀 Memulai sinkronisasi jam buka merchant...");
    
    // Ambil semua merchant food
    const snapshot = await db.collection('merchants').where('type', '==', 'food').get();
    console.log(`Ditemukan ${snapshot.size} merchant food.`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        
        // Skip jika sudah punya data jam buka (opsional, tapi biar hemat API)
        // if (data.openingHours) {
        //     skippedCount++;
        //     continue;
        // }

        let placeId = data.place_id;
        if (!placeId && doc.id.startsWith('google_')) {
            placeId = doc.id.replace('google_', '');
        }

        if (!placeId || placeId.includes('manual')) {
            skippedCount++;
            continue;
        }

        try {
            // Fetch Place Details specifically for opening_hours
            const response = await axios.get(`https://maps.googleapis.com/maps/api/place/details/json`, {
                params: {
                    place_id: placeId,
                    fields: 'opening_hours',
                    key: API_KEY
                }
            });

            const result = response.data.result;
            
            if (result && result.opening_hours) {
                await doc.ref.update({
                    openingHours: {
                        weekdayText: result.opening_hours.weekday_text || [],
                        periods: result.opening_hours.periods || [],
                        openNow: result.opening_hours.open_now !== undefined ? result.opening_hours.open_now : null
                    },
                    hoursSyncedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`✅ Updated Jam Buka: ${data.name}`);
                updatedCount++;
            } else {
                console.log(`⚠️ Tidak ada data jam buka untuk: ${data.name}`);
                skippedCount++;
            }
            
            // Delay sedikit untuk menghindari rate limit (Google recomends delay for batch tasks)
            await new Promise(resolve => setTimeout(resolve, 150));

        } catch (error) {
            console.error(`❌ Error updating ${data.name}:`, error.message);
            errorCount++;
        }
    }

    console.log("\n--- Ringkasan Sinkronisasi ---");
    console.log(`Total Berhasil Update: ${updatedCount}`);
    console.log(`Total Dilewati: ${skippedCount}`);
    console.log(`Total Error: ${errorCount}`);
    process.exit(0);
}

syncOpeningHours();
