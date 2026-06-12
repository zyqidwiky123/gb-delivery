const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function run() {
  const driversSnapshot = await db.collection("drivers")
    .where("isOnline", "==", true)
    .where("status", "==", "online")
    .get();
  
  console.log(`Found ${driversSnapshot.size} online drivers.`);
  
  const now = Date.now();
  driversSnapshot.forEach(doc => {
    const d = doc.data();
    console.log(`Driver: ${d.name} (${doc.id})`);
    console.log(`  Location: ${JSON.stringify(d.location)}`);
    console.log(`  lastLocationUpdate: ${d.lastLocationUpdate ? d.lastLocationUpdate.toDate() : null}`);
    console.log(`  onlineAt: ${d.onlineAt ? d.onlineAt.toDate() : null}`);
    console.log(`  statusChangedAt: ${d.statusChangedAt ? d.statusChangedAt.toDate() : null}`);
    console.log(`  updatedAt: ${d.updatedAt ? d.updatedAt.toDate() : null}`);
    
    // Check session
    let sessionStart = null;
    if (d.onlineAt) sessionStart = d.onlineAt.toMillis();
    else if (d.statusChangedAt) sessionStart = d.statusChangedAt.toMillis();
    else if (d.updatedAt) sessionStart = d.updatedAt.toMillis();
    
    let isSessionExpired = false;
    if (!sessionStart) {
       const lastLoc = d.lastLocationUpdate ? d.lastLocationUpdate.toMillis() : null;
       if (!lastLoc || (now - lastLoc >= 12 * 60 * 60 * 1000)) isSessionExpired = true;
    } else {
       if (now - sessionStart >= 12 * 60 * 60 * 1000) isSessionExpired = true;
    }
    console.log(`  isSessionExpired: ${isSessionExpired}`);
    
    // Check location fresh
    let isLocFresh = false;
    const lastLoc = d.lastLocationUpdate ? d.lastLocationUpdate.toMillis() : null;
    if (lastLoc && (now - lastLoc < 5 * 60 * 1000)) isLocFresh = true;
    console.log(`  isLocationFresh: ${isLocFresh}`);
  });
  process.exit(0);
}
run();
