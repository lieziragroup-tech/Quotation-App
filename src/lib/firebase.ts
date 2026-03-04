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

/**
 * Secondary app — dipakai untuk membuat user baru tanpa logout super_admin.
 * Hanya auth-nya yang di-secondary; Firestore tetap pakai `db` (dari primary app)
 * karena Firestore client SDK tidak punya "auth context" per-instance —
 * akses rules diatur oleh token user yang sedang login di primary auth.
 */
const secondaryApp =
    getApps().find((a) => a.name === "secondary") ??
    initializeApp(firebaseConfig, "secondary");

export const auth = getAuth(app);
export const authSecondary = getAuth(secondaryApp);

// PERBAIKAN: Hanya satu instance Firestore & Storage (dari primary app).
// dbSecondary dihapus — tidak ada manfaatnya karena Firestore tidak punya
// auth context per-instance, dan justru bisa menyebabkan listener ganda.
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;