
const admin = require('firebase-admin');

// Use the project ID from .env
const projectId = 'gb-delivery-41bf6';

admin.initializeApp({
  projectId: projectId
});

const db = admin.firestore();

async function diagnose() {
  console.log("=== FIRESTORE DIAGNOSIS ===");
  
  // 1. Check orders with status 'searching'
  const ordersRef = db.collection('orders');
  const searchingOrders = await ordersRef.where('status', '==', 'searching').get();
  
  console.log(`Found ${searchingOrders.size} orders with status 'searching'`);
  searchingOrders.forEach(doc => {
    console.log(`Order ID: ${doc.id}`);
    console.log(`Data: ${JSON.stringify(doc.data(), null, 2)}`);
  });

  // 2. Check drivers
  const driversRef = db.collection('drivers');
  const drivers = await driversRef.get();
  console.log(`Total drivers in database: ${drivers.size}`);
  drivers.forEach(doc => {
    const d = doc.data();
    console.log(`Driver ID: ${doc.id} | Name: ${d.name} | isOnline: ${d.isOnline} | status: ${d.status}`);
  });
}

diagnose().catch(console.error);
