const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "gb-delivery-41bf6"
});

const db = admin.firestore();

async function checkDrivers() {
  try {
    console.log("Fetching drivers...");
    const snapshot = await db.collection("drivers").limit(10).get();
    if (snapshot.empty) {
      console.log("No drivers found.");
      return;
    }
    snapshot.forEach(doc => {
      console.log(`Driver ID: ${doc.id}`);
      const data = doc.data();
      console.log(`Name: ${data.name}, isOnline: ${data.isOnline}, status: ${data.status}, fcmToken: ${data.fcmToken ? 'Exists' : 'MISSING'}`);
    });
  } catch (error) {
    console.error("Error fetching drivers:", error);
  }
}

checkDrivers();
