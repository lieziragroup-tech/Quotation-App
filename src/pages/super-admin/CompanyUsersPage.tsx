import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    ArrowLeft, UserPlus, RefreshCw, Loader2,
    CheckCircle2, Users, AlertCircle, Trash2,
    Mail, Check, ShieldCheck, X,
} from "lucide-react";
import { getCompanyById } from "../../services/companyService";
import { getUsersByCompany } from "../../services/userService";
import { createUserByAdmin, sendActivationEmail } from "../../services/adminCreateUser";
import { doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { Company, AppUser, UserRole } from "../../types";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

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

const ADDABLE_ROLES: { value: UserRole; label: string }[] = [
    { value: "administrator", label: "Administrator" },
    { value: "marketing", label: "Marketing" },
    { value: "admin_ops", label: "Admin Ops" },
    { value: "teknisi", label: "Teknisi" },
];

// ─── CONFIRM DIALOG ───────────────────────────────────────────────────────────

function ConfirmDialog({
    name,
    onConfirm,
    onCancel,
    loading,
}: {
    name: string;
    onConfirm: () => void;
    onCancel: () => void;
    loading: boolean;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={20} className="text-red-500" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">Hapus User?</h3>
                <p className="text-sm text-slate-500 mb-5">
                    <span className="font-semibold text-slate-700">{name}</span> akan dihapus dari sistem.
                    Tindakan ini tidak bisa dibatalkan.
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                    >
                        {loading && <Loader2 size={13} className="animate-spin" />}
                        Hapus
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── ADD USER MODAL ───────────────────────────────────────────────────────────

function AddUserModal({
    companyId,
    companyName,
    onClose,
    onCreated,
}: {
    companyId: string;
    companyName: string;
    onClose: () => void;
    onCreated: () => void;
}) {
    const [step, setStep] = useState<"form" | "success">("form");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [jabatan, setJabatan] = useState("");
    const [role, setRole] = useState<UserRole>("administrator");
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    const [createdName, setCreatedName] = useState("");
    const [createdEmail, setCreatedEmail] = useState("");
    const [sendingLink, setSendingLink] = useState(false);
    const [linkSent, setLinkSent] = useState(false);
    const [autoSent, setAutoSent] = useState(false);
    const [linkErr, setLinkErr] = useState("");
    const sentRef = useRef(false);

    // Generate a random secure temp password (user will reset via email anyway)
    const generateTempPassword = () => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$";
        return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    };

    const handleCreate = async () => {
        setErr("");
        if (!name.trim()) { setErr("Nama wajib diisi."); return; }
        if (!email.trim()) { setErr("Email wajib diisi."); return; }

        setSaving(true);
        try {
            const tempPassword = generateTempPassword();
            await createUserByAdmin({
                email: email.trim(),
                password: tempPassword,
                name: name.trim(),
                role: role as "administrator" | "marketing" | "admin_ops" | "teknisi",
                companyId,
                jabatan: jabatan.trim() || ROLE_LABELS[role],
            });
            setCreatedName(name.trim());
            setCreatedEmail(email.trim());
            setStep("success");
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes("email-already-in-use")) {
                setErr("Email sudah terdaftar. Gunakan email lain.");
            } else if (msg.includes("permission-denied")) {
                setErr("Akses ditolak. Periksa Firestore Security Rules.");
            } else {
                setErr(`Gagal membuat akun: ${msg}`);
            }
        } finally {
            setSaving(false);
        }
    };

    // Auto-send activation link when step changes to success
    useEffect(() => {
        if (step === "success" && !sentRef.current) {
            sentRef.current = true;
            (async () => {
                setSendingLink(true);
                try {
                    await sendActivationEmail(createdEmail);
                    setLinkSent(true);
                    setAutoSent(true);
                } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    setLinkErr(`Gagal kirim email: ${msg}`);
                } finally {
                    setSendingLink(false);
                }
            })();
        }
    }, [step, createdEmail]);

    const handleResend = async () => {
        setSendingLink(true);
        setLinkErr("");
        setLinkSent(false);
        try {
            await sendActivationEmail(createdEmail);
            setLinkSent(true);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setLinkErr(`Gagal kirim email: ${msg}`);
        } finally {
            setSendingLink(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">

                {step === "form" ? (
                    <>
                        {/* Header */}
                        <div className="flex items-start justify-between mb-5">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                    <UserPlus size={18} className="text-indigo-600" /> Tambah User Baru
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    untuk <span className="font-semibold text-slate-600">{companyName}</span>
                                </p>
                            </div>
                            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {/* Role selector */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1.5">Role *</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {ADDABLE_ROLES.map(r => (
                                        <button
                                            key={r.value}
                                            onClick={() => setRole(r.value)}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all text-left ${
                                                role === r.value
                                                    ? "bg-indigo-600 text-white border-indigo-600"
                                                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                                            }`}
                                        >
                                            {r.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Nama Lengkap *</label>
                                <input
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                    value={name} onChange={e => setName(e.target.value)}
                                    placeholder="Nama user"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Jabatan</label>
                                <input
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                    value={jabatan} onChange={e => setJabatan(e.target.value)}
                                    placeholder={ROLE_LABELS[role]}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Email *</label>
                                <input
                                    type="email"
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                    value={email} onChange={e => setEmail(e.target.value)}
                                    placeholder="user@perusahaan.com"
                                />
                            </div>

                            {/* Info: password otomatis */}
                            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                                <Mail size={13} className="flex-shrink-0 mt-0.5" />
                                <span>Link aktivasi akan otomatis dikirim ke email user setelah akun dibuat. User set password sendiri lewat link tersebut.</span>
                            </div>

                            {err && (
                                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                                    <span>{err}</span>
                                </div>
                            )}

                            <div className="flex gap-2 pt-1">
                                <button onClick={onClose}
                                    className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors">
                                    Batal
                                </button>
                                <button onClick={handleCreate} disabled={saving}
                                    className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                                    {saving && <Loader2 size={13} className="animate-spin" />}
                                    {saving ? "Membuat..." : "Buat & Kirim Aktivasi"}
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    /* ── SUCCESS STEP ── */
                    <div className="text-center">
                        <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 size={32} className="text-emerald-600" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900">Akun Berhasil Dibuat!</h3>
                        <p className="text-sm text-slate-500 mt-1 mb-5">
                            <span className="font-semibold text-slate-700">{createdName}</span> siap diaktivasi.
                        </p>

                        {/* Email status */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 text-left">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Status Pengiriman Email</p>
                            {sendingLink ? (
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Loader2 size={14} className="animate-spin text-indigo-500" />
                                    Mengirim link aktivasi ke <span className="font-mono font-semibold">{createdEmail}</span>...
                                </div>
                            ) : linkSent ? (
                                <div className="flex items-center gap-2 text-sm text-emerald-700">
                                    <Check size={14} className="flex-shrink-0" />
                                    <span>
                                        {autoSent ? "Otomatis terkirim" : "Terkirim"} ke{" "}
                                        <span className="font-mono font-semibold">{createdEmail}</span>.{" "}
                                        User akan aktif setelah klik link di email.
                                    </span>
                                </div>
                            ) : linkErr ? (
                                <div className="space-y-2">
                                    <div className="flex items-start gap-2 text-sm text-red-600">
                                        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                                        {linkErr}
                                    </div>
                                    <button
                                        onClick={handleResend}
                                        className="text-xs text-indigo-600 font-semibold hover:underline"
                                    >
                                        Coba kirim ulang
                                    </button>
                                </div>
                            ) : null}
                        </div>

                        {/* Info aktivasi */}
                        <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-700 text-left mb-5">
                            <ShieldCheck size={13} className="flex-shrink-0 mt-0.5" />
                            <span>Status user akan berubah menjadi <strong>Aktif</strong> secara otomatis setelah user mengklik link aktivasi dan mengatur password di emailnya.</span>
                        </div>

                        {linkSent && (
                            <button
                                onClick={handleResend}
                                disabled={sendingLink}
                                className="text-xs text-slate-500 hover:text-indigo-600 font-medium mb-4 flex items-center gap-1 mx-auto transition-colors"
                            >
                                <Mail size={11} /> Kirim ulang link aktivasi
                            </button>
                        )}

                        <button
                            onClick={onCreated}
                            className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            Selesai
                        </button>
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

    const [company, setCompany] = useState<Company | null>(null);
    const [users, setUsers] = useState<AppUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [addOpen, setAddOpen] = useState(false);

    // Remove state
    const [confirmRemove, setConfirmRemove] = useState<AppUser | null>(null);
    const [removingUid, setRemovingUid] = useState<string | null>(null);

    // Resend activation
    const [resendingUid, setResendingUid] = useState<string | null>(null);
    const [resendDoneUid, setResendDoneUid] = useState<string | null>(null);

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

    useEffect(() => { load(); }, [companyId]); // eslint-disable-line

    const handleRemove = async () => {
        if (!confirmRemove) return;
        setRemovingUid(confirmRemove.uid);
        try {
            // Hapus dokumen user dari Firestore
            // (Firebase Auth user tetap ada — bisa dihapus via Admin SDK / Cloud Function jika diperlukan)
            await deleteDoc(doc(db, "users", confirmRemove.uid));
            setConfirmRemove(null);
            await load();
        } catch (e) {
            console.error("Remove user failed:", e);
        } finally {
            setRemovingUid(null);
        }
    };

    const handleResendActivation = async (u: AppUser) => {
        setResendingUid(u.uid);
        setResendDoneUid(null);
        try {
            await sendActivationEmail(u.email);
            setResendDoneUid(u.uid);
            setTimeout(() => setResendDoneUid(null), 4000);
        } finally {
            setResendingUid(null);
        }
    };

    return (
        <div className="p-6 max-w-screen-lg mx-auto space-y-5">

            {/* ── Header ── */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navigate("/super-admin/companies")}
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                >
                    <ArrowLeft size={16} />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Users size={20} className="text-indigo-600" />
                        {loading ? "Memuat..." : company?.name ?? "Perusahaan"}
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">Kelola akun pengguna perusahaan</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={load}
                        className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={() => setAddOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <UserPlus size={15} /> Tambah User
                    </button>
                </div>
            </div>

            {/* ── Info aktivasi ── */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-3">
                <ShieldCheck size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">
                    Status user menjadi <span className="font-semibold">Aktif</span> setelah user mengklik link aktivasi di emailnya dan mengatur password.
                    Kirim ulang link lewat tombol <span className="font-semibold">Link Aktivasi</span> jika belum diterima.
                </p>
            </div>

            {/* ── Users table ── */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Daftar User ({users.length})</span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12 text-slate-400">
                        <Loader2 size={20} className="animate-spin mr-2" /> Memuat...
                    </div>
                ) : users.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <Users size={32} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm mb-3">Belum ada user di perusahaan ini.</p>
                        <button
                            onClick={() => setAddOpen(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            <UserPlus size={14} /> Tambah User Pertama
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    {["Nama", "Email", "Role", "Status", "Aksi"].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400 border-b border-slate-100 bg-slate-50 whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.uid} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
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
                                            {u.isActive ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                                    <CheckCircle2 size={11} /> Aktif
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                                                    <Mail size={11} /> Menunggu Aktivasi
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                {/* Link Aktivasi */}
                                                <button
                                                    onClick={() => handleResendActivation(u)}
                                                    disabled={resendingUid === u.uid}
                                                    title="Kirim link aktivasi ke email"
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors disabled:opacity-40"
                                                >
                                                    {resendingUid === u.uid
                                                        ? <Loader2 size={11} className="animate-spin" />
                                                        : resendDoneUid === u.uid
                                                            ? <Check size={11} className="text-emerald-600" />
                                                            : <Mail size={11} />}
                                                    {resendDoneUid === u.uid ? "Terkirim!" : "Link Aktivasi"}
                                                </button>

                                                {/* Remove */}
                                                <button
                                                    onClick={() => setConfirmRemove(u)}
                                                    disabled={removingUid === u.uid}
                                                    title="Hapus user"
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 transition-colors disabled:opacity-40"
                                                >
                                                    {removingUid === u.uid
                                                        ? <Loader2 size={11} className="animate-spin" />
                                                        : <Trash2 size={11} />}
                                                    Hapus
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Modals ── */}
            {addOpen && companyId && company && (
                <AddUserModal
                    companyId={companyId}
                    companyName={company.name}
                    onClose={() => setAddOpen(false)}
                    onCreated={() => { setAddOpen(false); load(); }}
                />
            )}

            {confirmRemove && (
                <ConfirmDialog
                    name={confirmRemove.name}
                    onConfirm={handleRemove}
                    onCancel={() => setConfirmRemove(null)}
                    loading={removingUid === confirmRemove.uid}
                />
            )}
        </div>
    );
}