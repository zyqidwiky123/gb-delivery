import { initializeApp } from "firebase/app";
import { getFirestore, collection, setDoc, doc } from "firebase/firestore";
import axios from "axios";

// This script should be run using Node.js v20+ with the --env-file flag
// e.g. node --env-file=.env src/utils/fetch-food.js

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const GOOGLE_MAPS_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY;

const sampleMenus = [
  { id: '1', name: 'Nasi Goreng Spesial', price: 25000, desc: 'Dilengkapi dengan telor ceplok dan ayam suwir', img: '' },
  { id: '2', name: 'Es Teh Manis', price: 5000, desc: 'Es Teh Manis segar', img: '' },
  { id: '3', name: 'Mie Goreng Jawa', price: 22000, desc: 'Mie goreng khas jawa dengan bumbu asli', img: '' },
  { id: '4', name: 'Es Jeruk', price: 8000, desc: 'Perasan jeruk asli murni', img: '' },
  { id: '5', name: 'Sate Ayam Madura (10 tusuk)', price: 28000, desc: 'Sate ayam bumbu kacang', img: '' },
  { id: '6', name: 'Ayam Geprek Jumbo', price: 20000, desc: 'Ayam geprek dengan sambal bawang level pedas', img: '' },
  { id: '7', name: 'Lalapan Ayam Goreng', price: 22000, desc: 'Ayam goreng lengkap dengan sambal dan lalapan', img: '' },
  { id: '8', name: 'Bebek Goreng Kremes', price: 35000, desc: 'Bebek goreng empuk dengan bumbu kremes', img: '' },
  { id: '9', name: 'Sambel Belut Spesial', price: 25000, desc: 'Belut goreng dengan sambal korek', img: '' },
  { id: '10', name: 'Pentol Cilot Bumbu Kacang', price: 10000, desc: 'Pentol kenyal dengan bumbu kacang pedas', img: '' },
  { id: '11', name: 'Paket Lesehan Ayam Bakar', price: 30000, desc: 'Nasi, Ayam Bakar, Lalapan, dan Sambal', img: '' },
  { id: '12', name: 'Seblak Komplit Level Pedas', price: 18000, desc: 'Seblak dengan sosis, bakso, ceker, dan kerupuk', img: '' },
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchAndSeedFood() {
  if (!GOOGLE_MAPS_API_KEY) {
    console.error("VITE_GOOGLE_MAPS_API_KEY is not set in environment.");
    return;
  }

  const categories = [
    'bakso', 'cafe', 'rumah makan', 'street food', 'pecel', 
    'mie ayam', 'sate', 'kopi', 'angkringan', 'mie gacoan', 
    'lalapan', 'ayam geprek', 'ayam bakar', 'bebek goreng', 
    'sambel belut', 'lesehan', 'cilot', 'seblak', 'nasi goreng', 'nasi', 'mie'
  ];

  const cities = ['Blitar', 'Wlingi', 'Srengat', 'Kanigoro', 'Garum', 'Sanan Kulon'];
  
  console.log(`Expanding search area to: ${cities.join(', ')}...`);

  try {
    let totalSaved = 0;
    
    for (let city of cities) {
      console.log(`\n--- Searching in ${city.toUpperCase()} ---`);
      
      for (let cat of categories) {
        const q = `${cat} in ${city}`;
        console.log(`Searching for: ${q}...`);
        
        await sleep(1000); // 1s delay to respect API limits
        
        const response = await axios.get(`https://maps.googleapis.com/maps/api/place/textsearch/json`, {
          params: {
            query: q,
            key: GOOGLE_MAPS_API_KEY
          }
        });

        const results = response.data.results;
        if (!results || results.length === 0) {
          console.log(`No results found for ${q}.`);
          continue;
        }

        console.log(`Found ${results.length} places for ${q}. Saving to Firestore...`);

        for (let place of results) {
          // Map place type to category
          let category = 'Warung';
          const nameLower = place.name.toLowerCase();
          
          if (q.includes('cafe') || (place.types && place.types.includes('cafe')) || nameLower.includes('kopi')) category = 'Cafe';
          else if (nameLower.includes('soto')) category = 'Soto';
          else if (nameLower.includes('bakso') || q.includes('bakso')) category = 'Bakso';
          else if (nameLower.includes('sate') || q.includes('sate')) category = 'Sate';
          else if (nameLower.includes('mie') || q.includes('mie')) category = 'Mie';
          else if (nameLower.includes('pecel') || q.includes('pecel')) category = 'Pecel';
          else if (nameLower.includes('ayam') || q.includes('ayam')) category = 'Ayam';
          else if (nameLower.includes('bebek') || q.includes('bebek')) category = 'Bebek';
          else if (nameLower.includes('belut') || q.includes('belut')) category = 'Belut';
          else if (nameLower.includes('lalapan') || q.includes('lalapan')) category = 'Lalapan';
          else if (nameLower.includes('lesehan') || q.includes('lesehan')) category = 'Lesehan';
          else if (nameLower.includes('cilot') || q.includes('cilot') || nameLower.includes('pentol')) category = 'Pentol';
          else if (nameLower.includes('seblak') || q.includes('seblak')) category = 'Seblak';
          else if (nameLower.includes('nasi goreng') || q.includes('nasi goreng')) category = 'Nasi Goreng';
          else if (nameLower.includes('nasi') || q.includes('nasi')) category = 'Nasi';
          else if (q.includes('rumah makan')) category = 'Rumah Makan';
          else if (q.includes('street food')) category = 'Street Food';

          const merchantRef = doc(db, "merchants", place.place_id);
          const merchantData = {
            name: place.name,
            searchName: place.name.toLowerCase(),
            keywords: generateKeywords(place.name),
            category: category,
            rating: place.rating || 4.0,
            address: place.formatted_address,
            location: {
              lat: place.geometry.location.lat,
              lng: place.geometry.location.lng
            },
            deliveryTime: Math.floor(Math.random() * 20) + 15, // random 15-35 mins
            menu: sampleMenus, // Using our generic sample menu
            placeId: place.place_id,
            createdAt: new Date().toISOString()
          };

          await setDoc(merchantRef, merchantData);
          totalSaved++;
        }
      }
    }

    console.log(`Successfully seeded ${totalSaved} warung/restoran data to Firestore!`);
    process.exit(0);

  } catch (err) {
    console.error("Error generating or saving data:", err.message);
    if (err.response) {
      console.error(err.response.data);
    }
    process.exit(1);
  }
}

fetchAndSeedFood();
