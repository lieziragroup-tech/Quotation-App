import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    Hash, Plus, Download, Loader2, AlertCircle,
    CheckCircle2, Clock, XCircle, FileText,
    ChevronDown, X, PenLine, Search, Filter, RefreshCw
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { getNomorSuratLog, addManualNomorSurat } from "../../services/nomorSuratService";
import { fmtDateID, TIPE_LABELS } from "../../lib/quotationConfig";
import type { NomorSuratLog, KategoriSurat, TipeKontrak, QuotationStatus, JenisLayanan } from "../../types";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<QuotationStatus, { label: string; color: string; icon: React.ReactNode }> = {
    draft:    { label: "Draft",    color: "bg-slate-100 text-slate-600",   icon: <Clock size={11} /> },
    pending:  { label: "Pending",  color: "bg-amber-100 text-amber-700",   icon: <Clock size={11} /> },
    approved: { label: "Disetujui", color: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 size={11} /> },
    rejected: { label: "Ditolak",  color: "bg-red-100 text-red-600",        icon: <XCircle size={11} /> },
};

function StatusBadge({ status }: { status: QuotationStatus }) {
    const cfg = STATUS_CONFIG[status];
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
            {cfg.icon} {cfg.label}
        </span>
    );
}

function KategoriBadge({ kategori, isManual }: { kategori: string; isManual?: boolean }) {
    if (isManual) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                <PenLine size={10} /> Manual
            </span>
        );
    }
    if (kategori === "AR") {
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">🛡️ AR</span>;
    }
    if (kategori === "PCO") {
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-700">🦟 PCO</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">📄 Lainnya</span>;
}

// ─── MODAL TAMBAH MANUAL ──────────────────────────────────────────────────────

interface ManualModalProps {
    companyId: string;
    byUid: string;
    byName: string;
    onClose: () => void;
    onAdded: () => void;
}

function ManualEntryModal({ companyId, byUid, byName, onClose, onAdded }: ManualModalProps) {
    const [noSurat, setNoSurat]           = useState("");
    const [kategori, setKategori]         = useState<KategoriSurat | "LAINNYA">("AR");
    const [tipe, setTipe]                 = useState<TipeKontrak>("U");
    const [kepada, setKepada]             = useState("");
    const [keterangan, setKeterangan]     = useState("");
    const [tanggal, setTanggal]           = useState(() => new Date().toISOString().split("T")[0]);
    const [loading, setLoading]           = useState(false);
    const [err, setErr]                   = useState("");

    // Auto-generate format nomor surat ketika input pendukung berubah
    useEffect(() => {
        const dateObj = new Date(tanggal);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        
        let catCode = kategori;
        if (kategori === "LAINNYA") catCode = "MISC" as any;

        // Draft format: GP-AR/U/2026/03/XXXX
        const generated = `GP-${catCode}/${tipe}/${year}/${month}/`;
        setNoSurat(prev => {
            // Jika sebelumnya kosong atau sudah berisi format otomatis, update. 
            // Jika user sedang mengetik detail nomor urut, coba pertahankan ujungnya jika memungkinkan
            return generated + (prev.split('/').pop() || "XXXX");
        });
    }, [kategori, tipe, tanggal]);

    const handleSave = async () => {
        if (!noSurat.trim() || noSurat.endsWith("XXXX")) { setErr("Lengkapi nomor surat dengan benar."); return; }
        if (!kepada.trim())   { setErr("Nama tujuan wajib diisi."); return; }

        setLoading(true);
        setErr("");
        try {
            await addManualNomorSurat({
                noSurat: noSurat.trim(),
                kategori: kategori as KategoriSurat,
                tipe,
                jenisLayanan: "manual_entry" as JenisLayanan, // Dihilangkan dari UI, diisi default
                kepada: kepada.trim(),
                byUid, byName, companyId,
                keteranganManual: keterangan.trim(),
                dibuat: new Date(tanggal),
            });
            onAdded();
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Terjadi kesalahan.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="font-bold text-slate-900 flex items-center gap-2">
                        <PenLine size={16} className="text-amber-600" />
                        Tambah Nomor Surat Manual
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Kategori</label>
                            <select className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                                value={kategori} onChange={e => setKategori(e.target.value as any)}>
                                <option value="AR">Anti Rayap (AR)</option>
                                <option value="PCO">Pest Control (PCO)</option>
                                <option value="LAINNYA">Lainnya</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Tipe</label>
                            <select className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                                value={tipe} onChange={e => setTipe(e.target.value as TipeKontrak)}>
                                <option value="U">Umum</option>
                                <option value="K">Kontrak</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Tanggal Surat</label>
                        <input type="date" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                            value={tanggal} onChange={e => setTanggal(e.target.value)} />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Nomor Surat *</label>
                        <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 font-mono font-bold text-blue-600"
                            placeholder="Contoh: GP-AR/U/2026/03/0001"
                            value={noSurat} onChange={e => setNoSurat(e.target.value)} />
                        <p className="text-[10px] text-slate-400 italic">* Sesuaikan bagian akhir nomor sesuai urutan manual Anda.</p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Ditujukan Kepada *</label>
                        <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                            placeholder="Nama klien / perusahaan"
                            value={kepada} onChange={e => setKepada(e.target.value)} />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Keterangan</label>
                        <textarea className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                            rows={2} placeholder="Keterangan tambahan (opsional)"
                            value={keterangan} onChange={e => setKeterangan(e.target.value)} />
                    </div>

                    {err && (
                        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                            <AlertCircle size={14} /> {err}
                        </div>
                    )}
                </div>

                <div className="flex gap-3 px-6 pb-5">
                    <button onClick={onClose} disabled={loading}
                        className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
                        Batal
                    </button>
                    <button onClick={handleSave} disabled={loading}
                        className="flex-1 px-4 py-2.5 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors flex items-center justify-center gap-2">
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        {loading ? "Menyimpan..." : "Simpan"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export function NomorSuratLogPage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const [logs, setLogs]           = useState<NomorSuratLog[]>([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState("");
    const [showModal, setShowModal] = useState(false);
    const [showFilter, setShowFilter] = useState(false);

    const [searchQ, setSearchQ]         = useState("");
    const [fKategori, setFKategori]     = useState<"" | KategoriSurat | "LAINNYA">("");
    const [fTipe, setFTipe]             = useState<"" | TipeKontrak>("");
    const [fStatus, setFStatus]         = useState<"" | QuotationStatus>("");
    const [fSource, setFSource]         = useState<"" | "system" | "manual">("");

    const canManage = user?.role === "administrator" || user?.role === "admin_ops";

    const fetchLogs = async () => {
        if (!user?.companyId) return;
        setLoading(true);
        setError("");
        try {
            const data = await getNomorSuratLog({ companyId: user.companyId });
            setLogs(data);
        } catch (e) {
            setError("Gagal memuat data. Periksa koneksi.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLogs(); }, [user?.companyId]);

    const filtered = logs.filter(log => {
        if (searchQ) {
            const q = searchQ.toLowerCase();
            if (!log.noSurat.toLowerCase().includes(q) &&
                !log.kepada.toLowerCase().includes(q) &&
                !log.byName.toLowerCase().includes(q)) return false;
        }
        if (fKategori && log.kategori !== fKategori) return false;
        if (fTipe     && log.tipe     !== fTipe)     return false;
        if (fStatus   && log.status   !== fStatus)   return false;
        if (fSource === "system" && log.isManual)    return false;
        if (fSource === "manual" && !log.isManual)   return false;
        return true;
    });

    const stats = {
        total:    logs.length,
        system:   logs.filter(l => !l.isManual).length,
        manual:   logs.filter(l => l.isManual).length,
        approved: logs.filter(l => l.status === "approved").length,
        pending:  logs.filter(l => l.status === "pending").length,
    };

    const hasActiveFilter = fKategori || fTipe || fStatus || fSource || searchQ;

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto">
            <div className="flex items-start justify-between mb-6 gap-4">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Hash size={20} className="text-blue-600" />
                        Log Nomor Surat
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">Dokumentasi nomor surat otomatis dan manual</p>
                </div>
                {canManage && (
                    <button onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors shrink-0 shadow-sm shadow-amber-200">
                        <PenLine size={15} />
                        Tambah Manual
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                {[
                    { label: "Total Surat",   value: stats.total,    color: "text-slate-700",   bg: "bg-slate-50" },
                    { label: "Dari Sistem",   value: stats.system,   color: "text-blue-700",    bg: "bg-blue-50"  },
                    { label: "Manual",        value: stats.manual,   color: "text-amber-700",   bg: "bg-amber-50" },
                    { label: "Disetujui",     value: stats.approved, color: "text-emerald-700", bg: "bg-emerald-50" },
                    { label: "Pending",       value: stats.pending,  color: "text-orange-700",  bg: "bg-orange-50" },
                ].map(s => (
                    <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-white`}>
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                <div className="flex items-center gap-2 flex-1 min-w-48 bg-white border border-slate-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                    <Search size={14} className="text-slate-400 shrink-0" />
                    <input
                        className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
                        placeholder="Cari nomor, klien, atau pembuat..."
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                    />
                    {searchQ && (
                        <button onClick={() => setSearchQ("")} className="text-slate-400 hover:text-slate-600">
                            <X size={13} />
                        </button>
                    )}
                </div>

                <button onClick={() => setShowFilter(f => !f)}
                    className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-sm font-medium transition-colors
                        ${hasActiveFilter ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                    <Filter size={14} />
                    Filter
                    <ChevronDown size={12} className={`transition-transform ${showFilter ? "rotate-180" : ""}`} />
                </button>

                <button onClick={fetchLogs} disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white text-slate-600 rounded-xl text-sm hover:bg-slate-50 transition-colors">
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {showFilter && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-wrap gap-3 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-1 min-w-32">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Kategori</label>
                        <select className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                            value={fKategori} onChange={e => setFKategori(e.target.value as any)}>
                            <option value="">Semua</option>
                            <option value="AR">Anti Rayap</option>
                            <option value="PCO">Pest Control</option>
                            <option value="LAINNYA">Lainnya</option>
                        </select>
                    </div>
                    {/* ... (Filter tipe & status tetap sama) */}
                    <div className="space-y-1 min-w-32">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Tipe</label>
                        <select className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                            value={fTipe} onChange={e => setFTipe(e.target.value as any)}>
                            <option value="">Semua</option>
                            <option value="U">Umum</option>
                            <option value="K">Kontrak</option>
                        </select>
                    </div>
                    <div className="space-y-1 min-w-32">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Status</label>
                        <select className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                            value={fStatus} onChange={e => setFStatus(e.target.value as any)}>
                            <option value="">Semua</option>
                            <option value="approved">Disetujui</option>
                            <option value="pending">Pending</option>
                            <option value="rejected">Ditolak</option>
                        </select>
                    </div>
                    <button onClick={() => { setFKategori(""); setFTipe(""); setFStatus(""); setFSource(""); setSearchQ(""); }}
                        className="self-end px-3 py-2 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                        Reset
                    </button>
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-slate-400">
                        <Loader2 size={24} className="animate-spin mr-2" /> Memuat data...
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-center">
                        <Hash size={32} className="mb-3 opacity-20" />
                        <p className="font-medium">Tidak ada data ditemukan</p>
                    </div>
                ) : (
                    <>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide font-semibold">
                                    <th className="px-4 py-3 text-left">Nomor Surat</th>
                                    <th className="px-4 py-3 text-left">Tipe</th>
                                    <th className="px-4 py-3 text-left">Ditujukan Kepada</th>
                                    <th className="px-4 py-3 text-left">Pembuat</th>
                                    <th className="px-4 py-3 text-left">Tanggal</th>
                                    <th className="px-4 py-3 text-left">Status</th>
                                    <th className="px-4 py-3 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filtered.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <code className="text-xs font-bold font-mono text-slate-800">{log.noSurat}</code>
                                                <KategoriBadge kategori={log.kategori} isManual={log.isManual} />
                                            </div>
                                            {log.keteranganManual && (
                                                <p className="text-[10px] text-slate-400 mt-0.5 italic">{log.keteranganManual}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${log.tipe === "K" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                                                {TIPE_LABELS[log.tipe]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-700 font-medium max-w-[180px] truncate">
                                            {log.kepada}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500">
                                            {log.byName}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                                            {fmtDateID(log.dibuat)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge status={log.status} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                {log.quoId && !log.isManual && (
                                                    <button onClick={() => navigate(`/quotations`)}
                                                        title="Lihat List"
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                                        <FileText size={14} />
                                                    </button>
                                                )}
                                                {!log.isManual && log.quoId && (
                                                    <DownloadPdfButton quoId={log.quoId} noSurat={log.noSurat} />
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden divide-y divide-slate-100">
                        {filtered.map(log => (
                            <div key={log.id} className="p-4 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                        <code className="text-xs font-bold font-mono text-slate-800">{log.noSurat}</code>
                                        <KategoriBadge kategori={log.kategori} isManual={log.isManual} />
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${log.tipe === "K" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                                            {TIPE_LABELS[log.tipe]}
                                        </span>
                                    </div>
                                    <StatusBadge status={log.status} />
                                </div>
                                <p className="text-sm font-medium text-slate-700 truncate">{log.kepada}</p>
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <p className="text-xs text-slate-400">{log.byName}</p>
                                        <p className="text-xs text-slate-400">{fmtDateID(log.dibuat)}</p>
                                        {log.keteranganManual && <p className="text-[10px] text-slate-400 italic">{log.keteranganManual}</p>}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {log.quoId && !log.isManual && (
                                            <button onClick={() => navigate(`/quotations`)} title="Lihat List"
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                                <FileText size={14} />
                                            </button>
                                        )}
                                        {!log.isManual && log.quoId && (
                                            <DownloadPdfButton quoId={log.quoId} noSurat={log.noSurat} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    </>
                )}
            </div>

            {showModal && user && (
                <ManualEntryModal
                    companyId={user.companyId}
                    byUid={user.uid}
                    byName={user.name}
                    onClose={() => setShowModal(false)}
                    onAdded={() => { setShowModal(false); fetchLogs(); }}
                />
            )}
        </div>
    );
}

// ─── DOWNLOAD BUTTON ──────────────────────────────────────────────────────────

function DownloadPdfButton({ quoId, noSurat }: { quoId: string; noSurat: string }) {
    const [loading, setLoading] = useState(false);

    const handleClick = async () => {
        setLoading(true);
        try {
            const { getQuotationById } = await import("../../services/quotationService");
            const quo = await getQuotationById(quoId);
            if (!quo?.pdfUrl) { alert("PDF tidak ditemukan."); return; }
            window.open(quo.pdfUrl, "_blank", "noopener,noreferrer");
        } catch {
            alert("Gagal mengunduh PDF.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <button onClick={handleClick} disabled={loading}
            title="Download PDF"
            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        </button>
    );
}