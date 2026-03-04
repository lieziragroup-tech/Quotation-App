import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useAuthStore } from "../store/authStore";
import { activateUserAfterVerification } from "../services/userService";
import type { AppUser } from "../types";

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
                const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));

                if (!userDoc.exists()) {
                    await auth.signOut();
                    setUser(null);
                    setLoading(false);
                    return;
                }

                const userData = userDoc.data() as AppUser;

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
                        // Cek apakah user baru saja klik link aktivasi email.
                        // Firebase Auth set emailVerified = true setelah link diklik.
                        // Jika iya, aktifkan user di Firestore otomatis.
                        if (firebaseUser.emailVerified) {
                            await activateUserAfterVerification(firebaseUser.uid);
                            setUser({ ...userData, uid: firebaseUser.uid, isActive: true });
                        } else {
                            // Belum verifikasi email — tolak login
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