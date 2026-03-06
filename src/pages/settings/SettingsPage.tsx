import { useState, useEffect } from "react";
import {
    Settings, Building2, Phone, Mail, Globe,
    Hash, FileSignature, Save, Loader2,
    CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
    MapPin, RefreshCw,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { getCompanySettings, saveCompanySettings } from "../../services/settingsService";
import type { CompanySettings } from "../../services/settingsService";
import { fmtDateID } from "../../lib/quotationConfig";

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function Field({
    label, hint, required, children,
}: {
    label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
            {hint && <p className="text-[11px] text-slate-400 italic">{hint}</p>}
        </div>
    );
}

const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-slate-800";

interface SectionProps {
    title: string;
    icon: React.ReactNode;
    defaultOpen?: boolean;
    children: React.ReactNode;
}

function Section({ title, icon, defaultOpen = true, children }: SectionProps) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
            >
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="text-blue-600">{icon}</span>
                    {title}
                </h2>
                {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>
            {open && (
                <div className="px-5 pb-5 pt-1 border-t border-slate-100 space-y-4">
                    {children}
                </div>
            )}
        </div>
    );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export function SettingsPage() {
    const { user } = useAuthStore();
    const [loading, setLoading]   = useState(true);
    const [saving, setSaving]     = useState(false);
    const [msg, setMsg]           = useState<{ type: "success" | "error"; text: string } | null>(null);

    const [form, setForm] = useState<Omit<CompanySettings, "updatedAt" | "updatedBy">>({
        companyName:    "",
        companyTagline: "",
        headOffice:     "",
        branchOffice:   "",
        telp:           "",
        wa:             "",
        email:          "",
        website:        "",
        nomorPrefix:    "GP",
        ttdNama:        "",
        ttdJabatan:     "",
    });
    const [lastUpdated, setLastUpdated] = useState<Date | undefined>();

    const set = (field: keyof typeof form) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            setForm(prev => ({ ...prev, [field]: e.target.value }));

    const load = async () => {
        if (!user?.companyId) return;
        setLoading(true);
        try {
            const data = await getCompanySettings(user.companyId);
            const { updatedAt, ...rest } = data;
            setForm(rest as typeof form);
            setLastUpdated(updatedAt);
        } catch {
            setMsg({ type: "error", text: "Gagal memuat pengaturan." });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [user?.companyId]);

    const handleSave = async () => {
        if (!user) return;
        if (!form.companyName.trim()) { setMsg({ type: "error", text: "Nama perusahaan wajib diisi." }); return; }
        if (!form.headOffice.trim())  { setMsg({ type: "error", text: "Alamat head office wajib diisi." }); return; }
        if (!form.nomorPrefix.trim()) { setMsg({ type: "error", text: "Prefix nomor surat wajib diisi." }); return; }

        setSaving(true);
        setMsg(null);
        try {
            await saveCompanySettings(user.companyId, form, user.name);
            const now = new Date();
            setLastUpdated(now);
            setMsg({ type: "success", text: "Pengaturan berhasil disimpan." });
        } catch {
            setMsg({ type: "error", text: "Gagal menyimpan pengaturan. Coba lagi." });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[40vh] text-slate-400">
                <Loader2 size={24} className="animate-spin mr-2" /> Memuat pengaturan...
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">

            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Settings size={20} className="text-blue-600" /> Pengaturan
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Konfigurasi perusahaan dan sistem quotation
                    </p>
                </div>
                <button onClick={load} disabled={loading}
                    className="p-2 border border-slate-200 bg-white text-slate-500 rounded-xl hover:bg-slate-50 shrink-0">
                    <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Last saved info */}
            {lastUpdated && (
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 size={11} className="text-emerald-500" />
                    Terakhir disimpan: {fmtDateID(lastUpdated)}
                </p>
            )}

            {/* ── SECTION 1: Info Perusahaan ── */}
            <Section title="Identitas Perusahaan" icon={<Building2 size={15} />} defaultOpen>
                <Field label="Nama Perusahaan" required>
                    <input className={inputCls} value={form.companyName}
                        onChange={set("companyName")} placeholder="PT Nama Perusahaan" />
                </Field>
                <Field label="Tagline / Slogan" hint="Ditampilkan di bawah nama perusahaan pada PDF">
                    <input className={inputCls} value={form.companyTagline ?? ""}
                        onChange={set("companyTagline")} placeholder="Opsional" />
                </Field>
            </Section>

            {/* ── SECTION 2: Alamat ── */}
            <Section title="Alamat & Kantor" icon={<MapPin size={15} />} defaultOpen>
                <Field label="Head Office" required>
                    <textarea className={`${inputCls} resize-none`} rows={2}
                        value={form.headOffice} onChange={set("headOffice")}
                        placeholder="Jl. ..., Kota, Kode Pos" />
                </Field>
                <Field label="Branch Office" hint="Opsional — kosongkan jika tidak ada">
                    <textarea className={`${inputCls} resize-none`} rows={2}
                        value={form.branchOffice ?? ""} onChange={set("branchOffice")}
                        placeholder="Jl. ..., Kota" />
                </Field>
            </Section>

            {/* ── SECTION 3: Kontak ── */}
            <Section title="Kontak" icon={<Phone size={15} />} defaultOpen>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="No. Telepon">
                        <input className={inputCls} value={form.telp}
                            onChange={set("telp")} placeholder="(021) xxxxxxx" />
                    </Field>
                    <Field label="WhatsApp">
                        <input className={inputCls} value={form.wa}
                            onChange={set("wa")} placeholder="08xxxxxxxxxx" />
                    </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Email" >
                        <div className="relative">
                            <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input className={`${inputCls} pl-8`} value={form.email}
                                onChange={set("email")} placeholder="info@perusahaan.com" />
                        </div>
                    </Field>
                    <Field label="Website">
                        <div className="relative">
                            <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input className={`${inputCls} pl-8`} value={form.website}
                                onChange={set("website")} placeholder="www.perusahaan.com" />
                        </div>
                    </Field>
                </div>
            </Section>

            {/* ── SECTION 4: Nomor Surat ── */}
            <Section title="Nomor Surat" icon={<Hash size={15} />} defaultOpen={false}>
                <Field
                    label="Prefix Nomor Surat"
                    required
                    hint={`Format nomor: ${form.nomorPrefix || "GP"}-AR/U/2026/03/0001`}
                >
                    <div className="flex items-center gap-2">
                        <input
                            className={`${inputCls} w-32 font-mono font-bold text-blue-600`}
                            value={form.nomorPrefix}
                            onChange={set("nomorPrefix")}
                            placeholder="GP"
                            maxLength={10}
                        />
                        <span className="text-sm text-slate-400 font-mono">
                            -{form.nomorPrefix || "GP"}-AR/U/2026/03/0001
                        </span>
                    </div>
                </Field>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                    ⚠ Mengubah prefix hanya berlaku untuk nomor surat baru. Nomor surat yang sudah diterbitkan tidak berubah.
                </div>
            </Section>

            {/* ── SECTION 5: Tanda Tangan Default ── */}
            <Section title="Tanda Tangan Default" icon={<FileSignature size={15} />} defaultOpen={false}>
                <p className="text-xs text-slate-500 -mt-1">
                    Nama dan jabatan yang muncul di bagian tanda tangan pada PDF quotation.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Nama Penandatangan">
                        <input className={inputCls} value={form.ttdNama ?? ""}
                            onChange={set("ttdNama")} placeholder="Nama lengkap" />
                    </Field>
                    <Field label="Jabatan">
                        <input className={inputCls} value={form.ttdJabatan ?? ""}
                            onChange={set("ttdJabatan")} placeholder="Direktur / Manager" />
                    </Field>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500">
                    💡 Marketing tetap bisa menggunakan tanda tangan digital mereka sendiri. Ini hanya default jika tidak ada tanda tangan digital.
                </div>
            </Section>

            {/* Feedback message */}
            {msg && (
                <div className={`flex items-start gap-2 text-sm p-4 rounded-xl border
                    ${msg.type === "success"
                        ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                        : "bg-red-50 border-red-100 text-red-600"}`}>
                    {msg.type === "success"
                        ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                        : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
                    {msg.text}
                </div>
            )}

            {/* Save button */}
            <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 bg-blue-600 text-white text-sm font-bold rounded-2xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors shadow-sm shadow-blue-200"
            >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? "Menyimpan..." : "Simpan Pengaturan"}
            </button>

            <p className="text-xs text-slate-400 text-center pb-2">
                Perubahan langsung berlaku untuk seluruh tim di perusahaan ini.
            </p>
        </div>
    );
}