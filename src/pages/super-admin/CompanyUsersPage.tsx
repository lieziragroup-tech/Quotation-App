import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    ArrowLeft, UserPlus, RefreshCw, Loader2,
    CheckCircle2, XCircle, Users, AlertCircle, Eye, EyeOff,
} from "lucide-react";
import { getCompanyById } from "../../services/companyService";
import { getUsersByCompany } from "../../services/userService";
import { createUserByAdmin } from "../../services/adminCreateUser";
import { useAuthStore } from "../../store/authStore";
import type { Company, AppUser } from "../../types";

const ROLE_LABELS: Record<string, string> = {
    administrator: "Administrator",
    marketing: "Marketing",
    admin_ops: "Admin Ops",
    teknisi: "Teknisi",
    super_admin: "Super Admin",
};
const ROLE_COLORS: Record<string, string> = {
    administrator: "bg-indigo-100 text-indigo-700",
    marketing: "bg-blue-100 text-blue-700",
    admin_ops: "bg-amber-100 text-amber-700",
    teknisi: "bg-emerald-100 text-emerald-700",
    super_admin: "bg-slate-200 text-slate-600",
};

// ─── CREATE ADMIN MODAL ───────────────────────────────────────────────────────

function CreateAdminModal({
    companyId, onClose, onCreated,
}: { companyId: string; onClose: () => void; onCreated: () => void }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [jabatan, setJabatan] = useState("Administrator");
    const [showPw, setShowPw] = useState(false);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");
    const [success, setSuccess] = useState(false);

    const handleCreate = async () => {
        setErr("");
        if (!name.trim()) { setErr("Nama wajib diisi."); return; }
        if (!email.trim()) { setErr("Email wajib diisi."); return; }
        if (password.length < 8) { setErr("Password minimal 8 karakter."); return; }
        if (password !== confirmPassword) { setErr("Konfirmasi password tidak cocok."); return; }

        setSaving(true);
        try {
            await createUserByAdmin({
                email: email.trim(),
                password,
                name: name.trim(),
                role: "administrator",
                companyId,
                jabatan: jabatan.trim(),
            });
            setSuccess(true);
            setTimeout(() => { onCreated(); }, 1500);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes("email-already-in-use")) {
                setErr("Email sudah terdaftar. Gunakan email lain.");
            } else {
                setErr(`Gagal: ${msg}`);
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
                <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                    <UserPlus size={18} className="text-indigo-600" /> Buat Akun Administrator
                </h3>
                <p className="text-sm text-slate-400 mb-5">
                    Administrator akan login dengan email & password ini, dan bisa ganti password sendiri dari halaman Profil.
                </p>

                {success ? (
                    <div className="text-center py-6">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                            <CheckCircle2 size={24} className="text-emerald-600" />
                        </div>
                        <p className="font-semibold text-slate-900">Akun berhasil dibuat!</p>
                        <p className="text-sm text-slate-400 mt-1">Menutup...</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Nama */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Nama Lengkap *</label>
                            <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                value={name} onChange={e => setName(e.target.value)} placeholder="Nama lengkap administrator" />
                        </div>

                        {/* Jabatan */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Jabatan</label>
                            <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                value={jabatan} onChange={e => setJabatan(e.target.value)} placeholder="Administrator" />
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Email *</label>
                            <input type="email" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@perusahaan.com" />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">
                                Password Awal * <span className="text-slate-300 font-normal">(min. 8 karakter)</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showPw ? "text" : "password"}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 pr-10"
                                    value={password} onChange={e => setPassword(e.target.value)}
                                    placeholder="Buat password awal" />
                                <button type="button" onClick={() => setShowPw(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm password */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Konfirmasi Password *</label>
                            <input
                                type={showPw ? "text" : "password"}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="Ulangi password" />
                        </div>

                        {err && (
                            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                                <span>{err}</span>
                            </div>
                        )}

                        <div className="flex gap-2 pt-1">
                            <button onClick={onClose}
                                className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200">
                                Batal
                            </button>
                            <button onClick={handleCreate} disabled={saving}
                                className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                {saving && <Loader2 size={13} className="animate-spin" />}
                                {saving ? "Membuat..." : "Buat Akun"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export function CompanyUsersPage() {
    const { companyId } = useParams<{ companyId: string }>();
    const navigate = useNavigate();
    useAuthStore();

    const [company, setCompany] = useState<Company | null>(null);
    const [users, setUsers] = useState<AppUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);

    const load = async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const [comp, usr] = await Promise.all([
                getCompanyById(companyId),
                getUsersByCompany(companyId),
            ]);
            setCompany(comp);
            setUsers(usr);
        } finally {
            setLoading(false);
        }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, [companyId]);

    const hasAdmin = users.some(u => u.role === "administrator");

    return (
        <div className="p-6 max-w-screen-lg mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => navigate("/super-admin/companies")}
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                    <ArrowLeft size={16} />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Users size={20} className="text-indigo-600" />
                        {loading ? "Memuat..." : company?.name ?? "Perusahaan"}
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">Kelola akun pengguna perusahaan</p>
                </div>
                <button onClick={load}
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Administrator status card */}
            <div className={`rounded-xl border p-5 ${hasAdmin ? "bg-white border-slate-200" : "bg-indigo-50 border-indigo-200"}`}>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="font-semibold text-slate-900">
                            {hasAdmin ? "✅ Administrator sudah ada" : "⚠️ Belum ada Administrator"}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                            {hasAdmin
                                ? "Perusahaan ini sudah memiliki Administrator. Administrator dapat mengelola tim dari menu Tim."
                                : "Buat akun Administrator untuk perusahaan ini. Mereka yang akan mengelola Marketing, Admin Ops, dan Teknisi."}
                        </p>
                    </div>
                    {!hasAdmin && (
                        <button onClick={() => setCreateOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap flex-shrink-0">
                            <UserPlus size={14} />
                            Buat Akun Administrator
                        </button>
                    )}
                </div>
            </div>

            {/* Users table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                    <span className="text-sm font-semibold text-slate-700">Daftar User ({users.length})</span>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center py-12 text-slate-400">
                        <Loader2 size={20} className="animate-spin mr-2" /> Memuat...
                    </div>
                ) : users.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <Users size={32} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Belum ada user di perusahaan ini.</p>
                    </div>
                ) : (
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                {["Nama", "Email", "Role", "Status"].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400 border-b border-slate-100 bg-slate-50">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.uid} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="text-sm font-semibold text-slate-900">{u.name}</div>
                                        {u.jabatan && <div className="text-xs text-slate-400">{u.jabatan}</div>}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{u.email}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${ROLE_COLORS[u.role] ?? ""}`}>
                                            {ROLE_LABELS[u.role] ?? u.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                                            ${u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                                            {u.isActive
                                                ? <><CheckCircle2 size={11} /> Aktif</>
                                                : <><XCircle size={11} /> Nonaktif</>}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Create admin modal */}
            {createOpen && companyId && (
                <CreateAdminModal
                    companyId={companyId}
                    onClose={() => setCreateOpen(false)}
                    onCreated={() => { setCreateOpen(false); load(); }}
                />
            )}
        </div>
    );
}
