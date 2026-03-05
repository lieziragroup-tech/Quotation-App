import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useAuthStore } from "../store/authStore";
import { activateUserAfterVerification } from "../services/userService";
import type { AppUser } from "../types";

/**
 * FIX — Race condition pada signup via invite link.
 *
 * Root cause:
 *   createUserWithEmailAndPassword() selesai → Firebase langsung trigger
 *   onAuthStateChanged → useAuth mencoba getDoc(users/uid) → doc BELUM ADA
 *   karena setDoc() di SignupPage belum selesai → auth.signOut() dipanggil
 *   → user di-kick padahal baru saja daftar.
 *
 * Fix:
 *   Tambah retry polling pada getDoc, maksimal 10 kali dengan interval 400ms
 *   (total tunggu maksimal 4 detik). Cukup untuk Firestore write latency normal.
 *   Jika setelah retry habis doc masih tidak ada → baru dianggap invalid.
 */
async function getDocWithRetry(
    uid: string,
    maxRetries = 10,
    intervalMs = 400,
) {
    for (let i = 0; i < maxRetries; i++) {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) return snap;
        if (i < maxRetries - 1) {
            await new Promise(r => setTimeout(r, intervalMs));
        }
    }
    return null;
}

export function useAuth() {
    const { user, loading, setUser, setLoading } = useAuthStore();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                setUser(null);
                setLoading(false);
                return;
            }

            try {
                // Gunakan retry agar tidak race condition dengan setDoc di SignupPage
                const userDocSnap = await getDocWithRetry(firebaseUser.uid);

                if (!userDocSnap) {
                    // Benar-benar tidak ada setelah retry → kick
                    await auth.signOut();
                    setUser(null);
                    setLoading(false);
                    return;
                }

                const userData = userDocSnap.data() as AppUser;

                if (userData.role === "super_admin") {
                    setUser({ ...userData, uid: firebaseUser.uid });

                } else if (!userData.companyId) {
                    await auth.signOut();
                    setUser(null);

                } else {
                    const companyDoc = await getDoc(doc(db, "companies", userData.companyId));

                    if (!companyDoc.exists() || !companyDoc.data().isActive) {
                        await auth.signOut();
                        setUser(null);

                    } else if (!userData.isActive) {
                        if (firebaseUser.emailVerified) {
                            await activateUserAfterVerification(firebaseUser.uid);
                            setUser({ ...userData, uid: firebaseUser.uid, isActive: true });
                        } else {
                            await auth.signOut();
                            setUser(null);
                        }

                    } else {
                        setUser({ ...userData, uid: firebaseUser.uid });
                    }
                }
            } catch (err) {
                console.error("[useAuth] Error fetching user data:", err);
                try { await auth.signOut(); } catch (_) { void _; }
                setUser(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, [setUser, setLoading]);

    return { user, loading };
}
