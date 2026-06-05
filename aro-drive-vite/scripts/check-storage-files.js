import admin from 'firebase-admin';
import { readFile } from 'fs/promises';

const SERVICE_ACCOUNT_PATH = '/home/marco/.gemini/antigravity/brain/210be323-7bdc-4fe3-aaae-e0abf5b9c6be/scratch/service-account.json';

const serviceAccount = JSON.parse(await readFile(SERVICE_ACCOUNT_PATH, 'utf8'));
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: "gb-delivery-41bf6.firebasestorage.app"
    });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function repairMerchant() {
    const merchantId = 'google_ChIJCUdOYADteC4RdjXq0MYZJRM';
    const prefix = `merchants/${merchantId}/`;
    console.log(`Repairing merchant: ${merchantId}`);
    
    try {
        const [files] = await bucket.getFiles({ prefix });
        
        const webpFiles = files
            .map(f => f.name)
            .filter(name => name.endsWith('.webp') && !name.includes('maps_thumbnail') && !name.includes('thumbnail'));
            
        console.log("Found WebP files in Storage:", webpFiles);
        
        if (webpFiles.length === 0) {
            console.log("No WebP menu files found to repair.");
            process.exit(0);
        }
        
        const urls = webpFiles.map(name => `https://storage.googleapis.com/${bucket.name}/${name}`);
        
        // The first one will be originalMenuImage
        const originalMenuImage = urls[0];
        const menu_thumbnails = urls.slice(1);
        
        console.log("Updating Firestore...");
        await db.collection('merchants').doc(merchantId).update({
            originalMenuImage,
            menu_thumbnails,
            menu: admin.firestore.FieldValue.delete()
        });
        
        console.log("✅ Merchant repaired successfully!");
    } catch (error) {
        console.error("❌ Error repairing merchant:", error.message);
    }
    process.exit(0);
}

repairMerchant();
