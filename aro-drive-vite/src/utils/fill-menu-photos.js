const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin (Assumes credentials are set via environment or default)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();

const IMAGE_MAPPING = {
  'Nasi Goreng Spesial': 'https://images.unsplash.com/photo-1621213233857-4560700d6477?w=800&fm=webp&q=80',
  'Es Teh Manis': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&fm=webp&q=80',
  'Mie Goreng Jawa': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&fm=webp&q=80',
  'Es Jeruk': 'https://images.unsplash.com/photo-1552590635-27c2c2128a15?w=800&fm=webp&q=80',
  'Sate Ayam Madura (10 tusuk)': 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=800&fm=webp&q=80',
  'Bakso': 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=800&fm=webp&q=80',
  'Ceker': 'https://images.unsplash.com/photo-1506477331477-33d6d8b3dc3c?w=800&fm=webp&q=80'
};

async function checkImageUrl(url) {
  try {
    const response = await axios.head(url);
    return response.status === 200;
  } catch (error) {
    console.error(`Error checking URL ${url}:`, error.message);
    return false;
  }
}

async function fillMenuPhotos() {
  console.log('Starting menu photo update...');
  
  const merchantsRef = db.collection('merchants');
  const snapshot = await merchantsRef.get();
  
  if (snapshot.empty) {
    console.log('No merchants found.');
    return;
  }

  let totalUpdated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    let updated = false;
    const newMenu = [...(data.menu || [])];

    for (let i = 0; i < newMenu.length; i++) {
      const item = newMenu[i];
      if ((!item.img || item.img === '') && IMAGE_MAPPING[item.name]) {
        const imageUrl = IMAGE_MAPPING[item.name];
        
        console.log(`Checking image for ${item.name} at ${doc.id}...`);
        const isValid = await checkImageUrl(imageUrl);
        
        if (isValid) {
          newMenu[i].img = imageUrl;
          updated = true;
          totalUpdated++;
          console.log(`Updated ${item.name} with ${imageUrl}`);
        }
      }
    }

    if (updated) {
      await merchantsRef.doc(doc.id).update({ menu: newMenu });
      console.log(`Successfully updated merchant: ${data.name} (${doc.id})`);
    }
  }

  console.log(`Finished! Total items updated: ${totalUpdated}`);
}

fillMenuPhotos().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
