import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCD-XA0JNCCituvX2aWqSVAR6eITahriAw",
  authDomain: "ai-microlearning-generator.firebaseapp.com",
  projectId: "ai-microlearning-generator",
  storageBucket: "ai-microlearning-generator.firebasestorage.app",
  messagingSenderId: "1061284723121",
  appId: "1:1061284723121:web:b89b52cc4b66e73bda6590",
  measurementId: "G-4W4BT0Q0BT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app; 