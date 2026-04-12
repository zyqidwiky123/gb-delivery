import { serverTimestamp } from 'firebase/firestore';
console.log("SERVER TIMESTAMP CONSTRUCTOR:", serverTimestamp().constructor === Object);
