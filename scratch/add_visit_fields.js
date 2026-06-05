import { db } from '../aro-drive-vite/src/firebase/config.js';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

async function addVisitFields() {
  console.log("Starting update of merchants...");
  const querySnapshot = await getDocs(collection(db, "merchants"));
  let count = 0;

  for (const document of querySnapshot.docs) {
    const merchantRef = doc(db, "merchants", document.id);
    await updateDoc(merchantRef, {
      peak_day: "Belum diatur", // Placeholder
      peak_hours: "Belum diatur" // Placeholder
    });
    count++;
    if (count % 10 === 0) console.log(`Updated ${count} merchants...`);
  }

  console.log(`Finished updating ${count} merchants.`);
}

addVisitFields().catch(console.error);
