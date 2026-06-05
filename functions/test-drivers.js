const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function run() {
  const drivers = await admin.firestore().collection("drivers").get();
  drivers.forEach(doc => {
    console.log(doc.id, doc.data().isOnline, doc.data().status, doc.data().location);
  });
}
run();
