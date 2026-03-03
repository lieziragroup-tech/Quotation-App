import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { isCompanyActive } from "../../services/companyService";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import type { AppUser } from "../../types";

export function LoginPage() {
    const navigate = useNavigate();
    const { setUser } = useAuthStore();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            // 1. Firebase Auth
            const credential = await signInWithEmailAndPassword(auth, email, password);
            const uid = credential.user.uid;

            // 2. Ambil data user dari Firestore
            const userSnap = await getDoc(doc(db, "users", uid));
            if (!userSnap.exists()) {
                await signOut(auth);
                setError("Data akun tidak ditemukan. Hubungi administrator.");
                return;
            }
            const userData = userSnap.data() as AppUser;

            // 3. Cek isActive user
            if (!userData.isActive) {
                await signOut(auth);
                setError("Akun Anda dinonaktifkan. Hubungi administrator perusahaan.");
                return;
            }

            // 4. Cek company aktif (skip untuk super_admin)
            if (userData.role !== "super_admin") {
                const companyOk = await isCompanyActive(userData.companyId);
                if (!companyOk) {
                    await signOut(auth);
                    setError("Langganan perusahaan Anda tidak aktif. Hubungi Super Admin.");
                    return;
                }
            }

            // 5. FIX: inject uid dari firebaseUser, bukan dari userData
            //    (userData.uid di Firestore mungkin stale atau tidak ter-set)
            setUser({ ...userData, uid });

            if (userData.role === "super_admin") {
                navigate("/super-admin/companies");
            } else {
                navigate("/dashboard");
            }
        } catch {
            setError("Email atau password salah. Silakan coba lagi.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                {/* Logo / Brand */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white mb-4">
                        <ShieldCheck size={28} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">ERP Pest Control</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Masuk ke akun kamu untuk melanjutkan
                    </p>
                </div>

                {/* Form */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                                Email
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="nama@perusahaan.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="h-11 text-base"
                                autoComplete="email"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                                Password
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Masukkan password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="h-11 text-base"
                                autoComplete="current-password"
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 text-sm">
                                <AlertCircle size={16} className="flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-11 text-base font-medium"
                            disabled={loading}
                        >
                            {loading ? (
                                <><Loader2 size={18} className="animate-spin mr-2" /> Memproses...</>
                            ) : (
                                "Masuk"
                            )}
                        </Button>
                    </form>
                </div>

                <p className="text-center text-xs text-slate-400 mt-6">
                    Lupa password? Hubungi administrator perusahaan kamu.
                </p>
            </div>
        </div>
    );
}
