import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// Secondary app — dipakai untuk membuat user baru tanpa logout super_admin
const secondaryApp = getApps().find(a => a.name === "secondary")
    ?? initializeApp(firebaseConfig, "secondary");

export const auth = getAuth(app);
export const authSecondary = getAuth(secondaryApp);
export const db = getFirestore(app);
export const dbSecondary = getFirestore(secondaryApp); // Firestore pakai auth context dari app yang sama
export const storage = getStorage(app);
export default app;
