import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, authSecondary, db } from "../lib/firebase";
import { useAuthStore } from "../store/authStore";
import type { AppUser } from "../types";

export function useAuth() {
    const { user, loading, setUser, setLoading } = useAuthStore();

    useEffect(() => {
        // CRITICAL FIX:
        // `authSecondary` pakai project ID yang sama, sehingga Firebase SDK
        // menshare auth state. Saat createUserByAdmin() sign in via authSecondary,
        // onAuthStateChanged di sini ikut terpicu dengan user baru tersebut.
        // Akibatnya: useAuth mendeteksi user baru (admin yang baru dibuat),
        // gagal cek company (kompanyId belum ter-set sempurna), dan melakukan
        // signOut() → super_admin yang sedang login jadi ter-logout.
        //
        // Solusi: cek apakah auth event berasal dari secondary instance.
        // Jika currentUser di secondary sama dengan firebaseUser yang masuk,
        // dan currentUser di primary BERBEDA, berarti ini event dari secondary → skip.
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            // Jika event ini dipicu oleh secondary auth (bukan primary),
            // abaikan — jangan ubah state primary user.
            if (firebaseUser && authSecondary.currentUser?.uid === firebaseUser.uid
                && auth.currentUser?.uid !== firebaseUser.uid) {
                // Ini event dari secondary, skip
                return;
            }

            if (firebaseUser) {
                try {
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
                        // Dokumen user tidak ada di Firestore —
                        // Jika primary auth tidak punya currentUser saat ini
                        // (artinya ini bukan login super_admin), baru logout.
                        // Hindari logout super_admin saat secondary auth aktif.
                        if (auth.currentUser?.uid === firebaseUser.uid) {
                            await auth.signOut();
                        }
                        setUser(null);
                    }
                } catch {
                    // Jangan signOut saat error network/Firestore,
                    // cukup set user null dan biarkan loading selesai
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