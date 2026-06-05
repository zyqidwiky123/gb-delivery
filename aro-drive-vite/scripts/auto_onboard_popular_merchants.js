import admin from 'firebase-admin';
import axios from 'axios';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CONFIGURATION
const API_KEY = "AIzaSyAMdIaOkJQ8t_rokwEDkBWTJjjw9tmYzUk";
const SERVICE_ACCOUNT_PATH = '/home/marco/.gemini/antigravity/brain/210be323-7bdc-4fe3-aaae-e0abf5b9c6be/scratch/service-account.json';
const BLITAR_LOCATION = "-8.0983,112.1682"; // Blitar Center
const SEARCH_RADIUS = 10000; // 10km radius

// Initialize Firebase Admin
const serviceAccount = JSON.parse(await readFile(SERVICE_ACCOUNT_PATH, 'utf8'));
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: "gb-delivery-41bf6.firebasestorage.app"
    });
}
const db = admin.firestore();
const bucket = admin.storage().bucket();

const CATEGORIES = [
    { id: 'ayam', query: 'Ayam Goreng Blitar' },
    { id: 'ayam', query: 'Ayam Bakar Blitar' },
    { id: 'mie', query: 'Mie Ayam Blitar' },
    { id: 'nasi', query: 'Pecel Blitar' },
    { id: 'nasi', query: 'Nasi Goreng Blitar' },
    { id: 'seblak', query: 'Seblak Blitar' },
    { id: 'bakso', query: 'Bakso Blitar' },
    { id: 'camilan', query: 'Martabak Blitar' },
    { id: 'camilan', query: 'Roti Blitar' },
    { id: 'minuman', query: 'Kopi Blitar' },
    { id: 'minuman', query: 'Boba Blitar' }
];

async function onboardMerchant(category, place) {
    try {
        const merchantId = `google_${place.place_id}`;
        
        // Check if already exists
        const existing = await db.collection('merchants').doc(merchantId).get();
        if (existing.exists) {
            console.log(`[Skip] ${place.name} already exists.`);
            return;
        }

        console.log(`[Processing] ${place.name} (${category}) - ${place.user_ratings_total} reviews`);

        // 1. Fetch Photo if available
        let imageUrl = '';
        if (place.photos && place.photos.length > 0) {
            const photoRef = place.photos[0].photo_reference;
            const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${API_KEY}`;
            
            try {
                const imgResponse = await axios.get(photoUrl, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(imgResponse.data, 'binary');
                const filePath = `merchants/${merchantId}/thumbnail.jpg`;
                const file = bucket.file(filePath);

                await file.save(buffer, { metadata: { contentType: 'image/jpeg' } });
                await file.makePublic();
                imageUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
            } catch (imgError) {
                console.error(`  - Failed to fetch photo for ${place.name}`);
            }
        }

        // 2. Prepare Merchant Data
        const merchantData = {
            id: merchantId,
            name: place.name,
            address: place.formatted_address || place.vicinity || 'Blitar',
            category: category,
            rating: place.rating || 0,
            reviewsCount: place.user_ratings_total || 0,
            location: {
                lat: place.geometry.location.lat,
                lng: place.geometry.location.lng
            },
            image: imageUrl,
            verified: false,
            status: 'pending',
            active: true,
            featured: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            menu: [] // Explicitly empty as requested
        };

        // 3. Save to Firestore
        await db.collection('merchants').doc(merchantId).set(merchantData);
        console.log(`  ✅ Successfully onboarded ${place.name}`);

    } catch (error) {
        console.error(`  ❌ Error onboarding ${place.name}:`, error.message);
    }
}

async function runOnboarding() {
    console.log("🚀 Starting Popular Merchant Onboarding...");
    
    for (const cat of CATEGORIES) {
        console.log(`\n--- Searching for: ${cat.query} ---`);
        const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(cat.query)}&location=${BLITAR_LOCATION}&radius=${SEARCH_RADIUS}&key=${API_KEY}`;
        
        try {
            const response = await axios.get(searchUrl);
            const results = response.data.results || [];

            // Filter by: Operational + has reviews + sorted by popularity
            const refinedResults = results
                .filter(p => p.business_status === 'OPERATIONAL')
                .filter(p => (p.user_ratings_total || 0) > 10) // Min 10 reviews to ensure popular
                .sort((a, b) => (b.user_ratings_total || 0) - (a.user_ratings_total || 0))
                .slice(0, 10); // Top 10 per sub-category

            console.log(`Found ${refinedResults.length} popular candidates.`);

            for (const place of refinedResults) {
                await onboardMerchant(cat.id, place);
            }
        } catch (error) {
            console.error(`Search error for ${cat.query}:`, error.message);
        }
    }

    console.log("\n✅ ALL DONE!");
    process.exit(0);
}

runOnboarding();
