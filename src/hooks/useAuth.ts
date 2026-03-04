import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, authSecondary, db } from "../lib/firebase";
import { useAuthStore } from "../store/authStore";
import type { AppUser } from "../types";

export function useAuth() {
    const { user, loading, setUser, setLoading } = useAuthStore();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (
                firebaseUser &&
                authSecondary.currentUser?.uid === firebaseUser.uid &&
                auth.currentUser?.uid !== firebaseUser.uid
            ) {
                return;
            }

            if (firebaseUser) {
                try {
                    const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));

                    if (userDoc.exists()) {
                        const userData = userDoc.data() as AppUser;

                        if (userData.role === "super_admin") {
                            setUser({ ...userData, uid: firebaseUser.uid });
                        } else if (!userData.isActive) {
                            await auth.signOut();
                            setUser(null);
                        } else {
                            const companyDoc = await getDoc(doc(db, "companies", userData.companyId));
                            if (companyDoc.exists() && companyDoc.data().isActive) {
                                setUser({ ...userData, uid: firebaseUser.uid });
                            } else {
                                await auth.signOut();
                                setUser(null);
                            }
                        }
                    } else {
                        if (auth.currentUser?.uid === firebaseUser.uid) {
                            await auth.signOut();
                        }
                        setUser(null);
                    }
                } catch {
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