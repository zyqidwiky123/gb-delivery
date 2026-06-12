const admin = require("firebase-admin");

// Initialize firebase admin using the default configuration (it should pick up project credentials if logged in via firebase)
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
      console.log(JSON.stringify(doc.data(), null, 2));
      console.log("-----------------------------------");
    });
  } catch (error) {
    console.error("Error fetching drivers:", error);
  }
}

checkDrivers();
