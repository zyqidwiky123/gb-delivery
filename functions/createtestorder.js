const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = path.join(__dirname, "..", "aro-drive-kotlin", "gb-delivery-41bf6-firebase-adminsdk-fbsvc-14b176524e.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://gb-delivery-41bf6-default-rtdb.asia-southeast1.firebasedatabase.app",
});
const db = admin.firestore();

const now = admin.firestore.Timestamp.now();
const order = {
  createdAt: now,
  updatedAt: now,
  status: "pending",
  customer: {
    name: "Test User",
    phone: "08123456789",
    uid: "testCustomer123",
  },
  pickupLocation: {
    lat: -8.098,
    lng: 112.164,
    address: "Jl. Merdeka No. 1, Blitar",
  },
  dropoffLocation: {
    lat: -8.087,
    lng: 112.172,
    address: "Jl. Sudirman No. 10, Blitar",
  },
  serviceType: "food",
  merchantName: "Test Merchant",
  dispatch: {
    status: "searching",
    regionType: "kota",
    currentRadius: 3,
    iteration: 1,
    notifiedDrivers: [],
    rejectedDrivers: [],
    expansionNeeded: false,
  },
  paymentMethod: "cash",
  statusHistory: [
    { status: "pending", timestamp: now },
  ],
};

db.collection("orders").add(order).then(ref => {
  console.log("Test order created:", ref.id);
  process.exit(0);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
