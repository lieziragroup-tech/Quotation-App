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
            if (firebaseUser) {
                // Ambil data user dari Firestore (collection: "users", bukan "users_index")
                const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));

                if (userDoc.exists()) {
                    const userData = userDoc.data() as AppUser;

                    // super_admin tidak perlu cek company
                    if (userData.role === "super_admin") {
                        setUser({ ...userData, uid: firebaseUser.uid });
                    } else {
                        // Cek apakah user masih aktif
                        if (!userData.isActive) {
                            await auth.signOut();
                            setUser(null);
                        } else {
                            // Cek apakah perusahaan masih aktif
                            const companyDoc = await getDoc(
                                doc(db, "companies", userData.companyId)
                            );

                            if (companyDoc.exists() && companyDoc.data().isActive) {
                                setUser({ ...userData, uid: firebaseUser.uid });
                            } else {
                                // Perusahaan nonaktif → logout paksa
                                await auth.signOut();
                                setUser(null);
                            }
                        }
                    }
                } else {
                    // Dokumen user tidak ada di Firestore
                    await auth.signOut();
                    setUser(null);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [setUser, setLoading]);

    return { user, loading };
}
