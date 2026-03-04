import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useAuthStore } from "../store/authStore";
import type { AppUser } from "../types";

export function useAuth() {
    const { user, loading, setUser, setLoading } = useAuthStore();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                // User logged out
                setUser(null);
                setLoading(false);
                return;
            }

            try {
                const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));

                if (!userDoc.exists()) {
                    // User ada di Auth tapi tidak ada di Firestore — paksa logout
                    await auth.signOut();
                    setUser(null);
                    setLoading(false);
                    return;
                }

                const userData = userDoc.data() as AppUser;

                if (userData.role === "super_admin") {
                    // Super admin tidak perlu cek companyId atau isActive
                    setUser({ ...userData, uid: firebaseUser.uid });
                } else if (!userData.isActive) {
                    // User dinonaktifkan
                    await auth.signOut();
                    setUser(null);
                } else {
                    // User biasa — cek status company
                    // PERBAIKAN: super_admin tidak punya companyId yang valid,
                    // jadi pengecekan company hanya untuk non-super_admin
                    if (!userData.companyId) {
                        await auth.signOut();
                        setUser(null);
                    } else {
                        const companyDoc = await getDoc(
                            doc(db, "companies", userData.companyId)
                        );
                        if (companyDoc.exists() && companyDoc.data().isActive) {
                            setUser({ ...userData, uid: firebaseUser.uid });
                        } else {
                            // Company tidak aktif atau tidak ditemukan
                            await auth.signOut();
                            setUser(null);
                        }
                    }
                }
            } catch (err) {
                console.error("[useAuth] Error fetching user data:", err);
                // Jika error (misal permission denied), paksa logout agar tidak stuck
                try {
                    await auth.signOut();
                } catch (_) {
                    void _;
                }
                setUser(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, [setUser, setLoading]);

    return { user, loading };
}