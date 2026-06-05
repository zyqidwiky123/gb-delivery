import { db } from '../aro-drive-vite/src/firebase/config.js';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

async function addVisitCount() {
  console.log("Starting update of merchants with visitCount...");
  const querySnapshot = await getDocs(collection(db, "merchants"));
  let count = 0;

  for (const document of querySnapshot.docs) {
    const merchantRef = doc(db, "merchants", document.id);
    await updateDoc(merchantRef, {
      visitCount: 0
    });
    count++;
    if (count % 20 === 0) console.log(`Updated ${count} merchants...`);
  }

  console.log(`Finished updating ${count} merchants.`);
}

addVisitCount().catch(console.error);
