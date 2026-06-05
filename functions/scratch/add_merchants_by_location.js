import admin from "firebase-admin";
import axios from "axios";

import { readFile } from 'fs/promises';

// Ganti sesuai kebutuhan
const QUERIES = [
    "dikichi blitar"
];
const TYPE = "food"; // food, shop, jek
const GOOGLE_MAPS_API_KEY = "AIzaSyAMdIaOkJQ8t_rokwEDkBWTJjjw9tmYzUk";
const SERVICE_ACCOUNT_PATH = '/home/marco/.gemini/antigravity/brain/210be323-7bdc-4fe3-aaae-e0abf5b9c6be/scratch/service-account.json';

// Inisialisasi Firebase
if (admin.apps.length === 0) {
    const serviceAccount = JSON.parse(await readFile(SERVICE_ACCOUNT_PATH, 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function scrapeAndAddMerchants() {
    let totalAdded = 0;
    let totalSkipped = 0;
    let totalClosed = 0;

    for (const query of QUERIES) {
        console.log(`🚀 Mencari merchant dengan query: "${query}"...`);

        try {
            const response = await axios.get(`https://maps.googleapis.com/maps/api/place/textsearch/json`, {
                params: {
                    query: query,
                    key: GOOGLE_MAPS_API_KEY
                }
            });

            const results = response.data.results;
            console.log(`Found ${results.length} results for "${query}".`);

            for (const place of results) {
                // Filter bisnis yang tutup permanen atau sementara
                if (place.business_status && place.business_status !== "OPERATIONAL") {
                    console.log(`🚫 Skipped (Closed): ${place.name} status: ${place.business_status}`);
                    totalClosed++;
                    continue;
                }

                const placeId = place.place_id;
                const docId = `google_${placeId}`;

                // Cek apakah sudah ada
                const docRef = db.collection("merchants").doc(docId);
                const docSnap = await docRef.get();

                if (docSnap.exists) {
                    // console.log(`⏭️ Skipped (Existing): ${place.name}`);
                    totalSkipped++;
                    continue;
                }

                // Ambil foto utama jika ada
                let imageUrl = "";
                if (place.photos && place.photos.length > 0) {
                    const photoRef = place.photos[0].photo_reference;
                    imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`;
                }

                // Siapkan data
                const merchantData = {
                    id: docId,
                    name: place.name,
                    address: place.formatted_address || "",
                    lat: place.geometry.location.lat,
                    lng: place.geometry.location.lng,
                    rating: place.rating || 0,
                    reviewsCount: place.user_ratings_total || 0,
                    type: TYPE,
                    place_id: placeId,
                    verified: true,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    image: imageUrl
                };

                await docRef.set(merchantData);
                console.log(`✅ Added: ${place.name} (${place.user_ratings_total || 0} reviews)`);
                totalAdded++;
            }
        } catch (error) {
            console.error(`❌ Error scraping "${query}":`, error.message);
        }
    }

    console.log(`\n--- Ringkasan Akhir ---`);
    console.log(`Total Added: ${totalAdded}`);
    console.log(`Total Skipped (Existing): ${totalSkipped}`);
    console.log(`Total Closed: ${totalClosed}`);
}

scrapeAndAddMerchants();
