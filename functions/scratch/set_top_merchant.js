import admin from "firebase-admin";
import { readFile } from 'fs/promises';

const SERVICE_ACCOUNT_PATH = '/home/marco/.gemini/antigravity/brain/210be323-7bdc-4fe3-aaae-e0abf5b9c6be/scratch/service-account.json';

if (admin.apps.length === 0) {
    const serviceAccount = JSON.parse(await readFile(SERVICE_ACCOUNT_PATH, 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function setTop() {
    // Cari merchant dengan nama DIKICHI
    const snapshot = await db.collection("merchants")
        .where("name", ">=", "DIKICHI")
        .where("name", "<=", "DIKICHI\uf8ff")
        .get();

    if (snapshot.empty) {
        console.log("Merchant DIKICHI tidak ditemukan");
        return;
    }

    const doc = snapshot.docs[0];
    console.log(`Mengupdate merchant: ${doc.data().name} (ID: ${doc.id})`);

    // Set reviewsCount menjadi sangat tinggi agar selalu di atas
    await doc.ref.update({
        reviewsCount: 999999
    });

    console.log("Berhasil! Merchant DIKICHI sekarang ada di posisi paling atas.");
}

setTop();
