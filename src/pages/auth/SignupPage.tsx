import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { getInviteByToken, markInviteUsed } from "../../services/inviteService";
import { countActiveUsers, MAX_USERS_PER_COMPANY } from "../../services/userService";
import { AlertCircle, Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";
import type { Invite } from "../../services/inviteService";

const ROLE_LABELS: Record<string, string> = {
    administrator: "Administrator",
    marketing: "Marketing",
    admin_ops: "Admin Operasional",
    teknisi: "Teknisi",
};

const ROLE_COLORS: Record<string, string> = {
    administrator: "bg-indigo-100 text-indigo-700",
    marketing: "bg-blue-100 text-blue-700",
    admin_ops: "bg-amber-100 text-amber-700",
    teknisi: "bg-emerald-100 text-emerald-700",
};

export function SignupPage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const token = params.get("invite") ?? "";

    const [invite, setInvite] = useState<Invite | null>(null);
    const [loadingInvite, setLoadingInvite] = useState(true);
    const [inviteError, setInviteError] = useState("");

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (!token) {
            setInviteError("Link undangan tidak valid atau tidak ditemukan.");
            setLoadingInvite(false);
            return;
        }
        getInviteByToken(token).then(inv => {
            if (!inv) {
                setInviteError("Link undangan tidak valid, sudah digunakan, atau sudah kadaluarsa.");
            } else {
                setInvite(inv);
            }
            setLoadingInvite(false);
        });
    }, [token]);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!invite) return;
        setError("");

        if (!name.trim()) { setError("Nama lengkap wajib diisi."); return; }
        if (password.length < 8) { setError("Password minimal 8 karakter."); return; }
        if (password !== confirmPassword) { setError("Konfirmasi password tidak cocok."); return; }

        setLoading(true);
        try {
            // Cek slot sebelum buat akun
            const count = await countActiveUsers(invite.companyId);
            if (count >= MAX_USERS_PER_COMPANY) {
                setError(`Slot pengguna perusahaan sudah penuh (max ${MAX_USERS_PER_COMPANY} user).`);
                return;
            }

            // Buat Auth user
            const credential = await createUserWithEmailAndPassword(auth, email, password);
            const uid = credential.user.uid;

            // Buat Firestore user doc (Document ID = UID)
            await setDoc(doc(db, "users", uid), {
                uid,
                email,
                name: name.trim(),
                role: invite.role,
                companyId: invite.companyId,
                isActive: true,
                jabatan: "",
                wa: "",
            });

            // Tandai invite sebagai terpakai
            await markInviteUsed(token, uid);

            setDone(true);
            // Bug fix: administrator is a per-company role, not super_admin.
            // All non-super_admin roles (including administrator) go to /dashboard.
            setTimeout(() => {
                navigate("/dashboard");
            }, 2000);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "";
            if (msg.includes("email-already-in-use")) {
                setError("Email sudah terdaftar. Gunakan email lain.");
            } else {
                setError("Terjadi kesalahan. Coba lagi.");
            }
        } finally {
            setLoading(false);
        }
    };

    // ── Loading invite ─────────────────────────────────────────────────────────
    if (loadingInvite) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-blue-600" />
            </div>
        );
    }

    // ── Invalid invite ─────────────────────────────────────────────────────────
    if (inviteError) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-sm w-full text-center">
                    <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={28} className="text-red-600" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 mb-2">Link Tidak Valid</h2>
                    <p className="text-sm text-slate-500">{inviteError}</p>
                </div>
            </div>
        );
    }

    // ── Success ────────────────────────────────────────────────────────────────
    if (done) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-sm w-full text-center">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 size={28} className="text-emerald-600" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 mb-2">Akun Berhasil Dibuat!</h2>
                    <p className="text-sm text-slate-500">Mengalihkan ke aplikasi...</p>
                </div>
            </div>
        );
    }

    // ── Form ───────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                {/* Brand */}
                <div className="text-center mb-7">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white mb-4">
                        <ShieldCheck size={28} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Buat Akun</h1>
                    <p className="text-slate-500 text-sm mt-1">ERP Pest Control</p>
                </div>

                {/* Invite info */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
                    <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide font-semibold">Undangan dari</p>
                    <p className="font-bold text-slate-900">{invite!.companyName}</p>
                    <p className="text-sm text-slate-500 mt-1">
                        Kamu diundang sebagai{" "}
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${ROLE_COLORS[invite!.role]}`}>
                            {ROLE_LABELS[invite!.role]}
                        </span>
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                        Berlaku sampai: {invite!.expiresAt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                </div>

                {/* Form */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <form onSubmit={handleSignup} className="space-y-4">
                        {/* Nama */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Nama Lengkap *
                            </label>
                            <input
                                type="text" required
                                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="Nama lengkap kamu"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Email *
                            </label>
                            <input
                                type="email" required
                                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="email@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                autoComplete="email"
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Password * <span className="text-slate-400 font-normal">(min. 8 karakter)</span>
                            </label>
                            <input
                                type="password" required
                                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="Buat password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoComplete="new-password"
                            />
                        </div>

                        {/* Confirm password */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Konfirmasi Password *
                            </label>
                            <input
                                type="password" required
                                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="Ulangi password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                autoComplete="new-password"
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 text-sm">
                                <AlertCircle size={15} className="flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 size={15} className="animate-spin" />}
                            {loading ? "Membuat Akun..." : "Buat Akun"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
