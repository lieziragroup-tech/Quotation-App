/**
 * NomorSuratLogPage — Halaman log dan arsip nomor surat
 * Menampilkan semua nomor surat yang pernah di-generate oleh sistem,
 * baik yang auto-generated maupun yang diinput manual (untuk tracking).
 */

import { useState, useEffect } from "react";
import {
    Hash, RefreshCw, Search, Filter,
    CheckCircle2, Clock, XCircle, FileX2,
    Download, ExternalLink, AlertCircle, Plus,
    FileText, User, Calendar,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { getNomorSuratLog } from "../../services/nomorSuratService";
import { getQuotationById } from "../../services/quotationService";
import type { NomorSuratLog, QuotationStatus, KategoriSurat, TipeKontrak } from "../../types";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface ManualEntry {
    id: string;
    noSurat: string;
    keterangan: string;
    createdBy: string;
    createdAt: Date;
    isManual: true;
}

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<QuotationStatus, { label: string; icon: React.ReactNode; bg: string; text: string; dot: string }> = {
    draft: { label: "Draft", icon: <FileX2 size={11} />, bg: "#f1f5f9", text: "#64748b", dot: "#94a3b8" },
    pending: { label: "Menunggu", icon: <Clock size={11} />, bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
    approved: { label: "Disetujui", icon: <CheckCircle2 size={11} />, bg: "#dcfce7", text: "#14532d", dot: "#16a34a" },
    rejected: { label: "Ditolak", icon: <XCircle size={11} />, bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
};

function StatusBadge({ status }: { status: QuotationStatus }) {
    const c = STATUS_CFG[status];
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: c.bg, color: c.text }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
            {c.label}
        </span>
    );
}

// ─── MANUAL ENTRY MODAL ───────────────────────────────────────────────────────

function ManualEntryModal({
    onClose,
    onAdd,
    currentUser,
}: {
    onClose: () => void;
    onAdd: (entry: ManualEntry) => void;
    currentUser: string;
}) {
    const [noSurat, setNoSurat] = useState("");
    const [keterangan, setKeterangan] = useState("");
    const [err, setErr] = useState("");

    const handleAdd = () => {
        if (!noSurat.trim()) { setErr("Nomor surat wajib diisi."); return; }
        if (!keterangan.trim()) { setErr("Keterangan wajib diisi."); return; }

        const entry: ManualEntry = {
            id: `manual-${Date.now()}`,
            noSurat: noSurat.trim(),
            keterangan: keterangan.trim(),
            createdBy: currentUser,
            createdAt: new Date(),
            isManual: true,
        };
        onAdd(entry);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
                <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                    <Plus size={16} className="text-amber-500" />
                    Tambah Catatan Manual
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                    Untuk surat yang dibuat di luar sistem (manual / fisik), tambahkan keterangan agar tetap terlacak.
                </p>

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">
                            Nomor Surat *
                        </label>
                        <input
                            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 font-mono"
                            placeholder="Contoh: GP-AR/U/2026/03/0001"
                            value={noSurat}
                            onChange={e => { setNoSurat(e.target.value); setErr(""); }}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">
                            Keterangan *
                        </label>
                        <textarea
                            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                            rows={3}
                            placeholder="Contoh: Surat dibuat manual oleh Bpk. Ahmad untuk klien PT XYZ pada 1 Maret 2026"
                            value={keterangan}
                            onChange={e => { setKeterangan(e.target.value); setErr(""); }}
                        />
                    </div>
                    {err && (
                        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                            <AlertCircle size={12} /> {err}
                        </div>
                    )}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs text-amber-700">
                            <strong>Catatan:</strong> Entri manual hanya tersimpan di sesi ini untuk keperluan tracking. 
                            Hubungi administrator untuk integrasi permanen ke sistem.
                        </p>
                    </div>
                </div>

                <div className="flex gap-2 mt-5">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 text-sm rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium">
                        Batal
                    </button>
                    <button onClick={handleAdd}
                        className="flex-1 py-2.5 text-sm rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600">
                        Tambah Catatan
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── ROW DETAIL ───────────────────────────────────────────────────────────────

function LogRow({
    log,
    isManual,
    onDownload,
}: {
    log: NomorSuratLog | ManualEntry;
    isManual: boolean;
    onDownload?: (quoId: string) => void;
}) {
    if (isManual) {
        const m = log as ManualEntry;
        return (
            <tr className="hover:bg-amber-50/50 transition-colors border-b border-slate-100 last:border-0">
                <td className="px-4 py-3">
                    <code className="text-xs font-bold px-2 py-1 rounded bg-amber-50 text-amber-700 font-mono">
                        {m.noSurat}
                    </code>
                </td>
                <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                        <AlertCircle size={10} />
                        Manual / Luar Sistem
                    </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 max-w-xs">
                    <span className="italic">{m.keterangan}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{m.createdBy}</td>
                <td className="px-4 py-3 text-xs text-slate-400">
                    {m.createdAt.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className="px-4 py-3">
                    <span className="text-xs text-slate-300 italic">—</span>
                </td>
                <td className="px-4 py-3">
                    <span className="text-xs text-slate-300 italic">—</span>
                </td>
            </tr>
        );
    }

    const l = log as NomorSuratLog;
    const isAR = l.kategori === "AR";

    return (
        <tr className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
            <td className="px-4 py-3 whitespace-nowrap">
                <code className={`text-xs font-bold px-2 py-1 rounded font-mono
                    ${isAR ? "bg-purple-50 text-purple-700" : "bg-cyan-50 text-cyan-700"}`}>
                    {l.noSurat}
                </code>
            </td>
            <td className="px-4 py-3">
                <StatusBadge status={l.status} />
            </td>
            <td className="px-4 py-3 text-sm text-slate-700 max-w-xs">
                <div className="font-medium text-slate-900 truncate">{l.kepada}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                    {isAR ? "🛡 Anti Rayap" : "🦟 Pest Control"} · {l.tipeLabel}
                </div>
            </td>
            <td className="px-4 py-3 text-xs text-slate-500">{l.byName}</td>
            <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                {l.dibuat.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                <div className="text-slate-300">
                    {l.dibuat.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </div>
            </td>
            <td className="px-4 py-3">
                {l.quoId ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-mono">
                        <CheckCircle2 size={11} /> Terhubung
                    </span>
                ) : (
                    <span className="text-xs text-slate-300 italic">—</span>
                )}
            </td>
            <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                    {l.quoId && onDownload && (
                        <button
                            onClick={() => onDownload(l.quoId!)}
                            title="Download PDF dari arsip"
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-green-600 transition-colors"
                        >
                            <Download size={13} />
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export function NomorSuratLogPage() {
    const { user } = useAuthStore();
    const [logs, setLogs] = useState<NomorSuratLog[]>([]);
    const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterKat, setFilterKat] = useState<"all" | KategoriSurat>("all");
    const [filterTipe, setFilterTipe] = useState<"all" | TipeKontrak>("all");
    const [filterStatus, setFilterStatus] = useState<"all" | QuotationStatus>("all");
    const [showManualModal, setShowManualModal] = useState(false);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    const load = async () => {
        if (!user?.companyId) return;
        setLoading(true);
        try {
            const data = await getNomorSuratLog({ companyId: user.companyId });
            setLogs(data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [user?.companyId]);

    const handleDownloadFromArchive = async (quoId: string) => {
        setDownloadingId(quoId);
        try {
            const quo = await getQuotationById(quoId);
            if (quo?.pdfUrl) {
                // Buka PDF di tab baru (dari Firebase Storage URL)
                window.open(quo.pdfUrl, "_blank", "noopener,noreferrer");
            } else {
                alert("PDF tidak ditemukan di arsip. Mungkin belum di-upload atau terjadi kesalahan saat penyimpanan.");
            }
        } finally {
            setDownloadingId(null);
        }
    };

    // Filter logs
    let displayedLogs = [...logs];
    if (search) {
        const s = search.toLowerCase();
        displayedLogs = displayedLogs.filter(l =>
            l.noSurat.toLowerCase().includes(s) ||
            l.kepada.toLowerCase().includes(s) ||
            l.byName.toLowerCase().includes(s)
        );
    }
    if (filterKat !== "all") displayedLogs = displayedLogs.filter(l => l.kategori === filterKat);
    if (filterTipe !== "all") displayedLogs = displayedLogs.filter(l => l.tipe === filterTipe);
    if (filterStatus !== "all") displayedLogs = displayedLogs.filter(l => l.status === filterStatus);

    // Filter manual entries
    const displayedManual = manualEntries.filter(m => {
        if (!search) return true;
        const s = search.toLowerCase();
        return m.noSurat.toLowerCase().includes(s) || m.keterangan.toLowerCase().includes(s);
    });

    // Stats
    const totalSystem = logs.length;
    const totalApproved = logs.filter(l => l.status === "approved").length;
    const totalPending = logs.filter(l => l.status === "pending").length;
    const totalManual = manualEntries.length;

    return (
        <div className="p-6 max-w-screen-xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Hash size={20} className="text-blue-600" />
                        Log Nomor Surat
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Riwayat semua nomor surat yang digenerate oleh sistem + catatan manual
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load}
                        className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                        title="Refresh">
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={() => setShowManualModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg hover:bg-amber-600 transition-colors"
                    >
                        <Plus size={16} />
                        Tambah Catatan Manual
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total (Sistem)", value: totalSystem, color: "#1d4ed8", icon: <FileText size={16} /> },
                    { label: "Disetujui", value: totalApproved, color: "#15803d", icon: <CheckCircle2 size={16} /> },
                    { label: "Menunggu", value: totalPending, color: "#92400e", icon: <Clock size={16} /> },
                    { label: "Catatan Manual", value: totalManual, color: "#b45309", icon: <AlertCircle size={16} /> },
                ].map(s => (
                    <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-400 font-semibold">{s.label}</span>
                            <span style={{ color: s.color }}>{s.icon}</span>
                        </div>
                        <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Filter bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex flex-wrap gap-2 items-center">
                    <div className="relative flex-1 min-w-48">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Cari nomor surat, klien, atau nama pembuat..."
                            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                    </div>
                    <Filter size={14} className="text-slate-400" />
                    {(["all", "AR", "PCO"] as const).map(v => (
                        <button key={v} onClick={() => setFilterKat(v)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                                ${filterKat === v ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                            {v === "all" ? "Semua" : v === "AR" ? "Anti Rayap" : "Pest Control"}
                        </button>
                    ))}
                    {(["all", "U", "K"] as const).map(v => (
                        <button key={v} onClick={() => setFilterTipe(v)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                                ${filterTipe === v ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                            {v === "all" ? "Semua Tipe" : v === "U" ? "Umum" : "Kontrak"}
                        </button>
                    ))}
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
                        className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-600 focus:outline-none">
                        <option value="all">Semua Status</option>
                        <option value="draft">Draft</option>
                        <option value="pending">Menunggu</option>
                        <option value="approved">Disetujui</option>
                        <option value="rejected">Ditolak</option>
                    </select>
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-purple-100 border border-purple-200" />
                    Auto-generate sistem (AR)
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-cyan-100 border border-cyan-200" />
                    Auto-generate sistem (PCO)
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-amber-100 border border-amber-200" />
                    Catatan manual (luar sistem)
                </span>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-slate-400">
                        <RefreshCw size={20} className="animate-spin mr-2" /> Memuat log...
                    </div>
                ) : displayedLogs.length === 0 && displayedManual.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <Hash size={36} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium text-slate-500">Belum ada log nomor surat</p>
                        <p className="text-sm mt-1">
                            Log akan muncul setelah quotation pertama dibuat.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    {["Nomor Surat", "Status", "Kepada / Keterangan", "Dibuat Oleh", "Tanggal", "Quotation", "Aksi"].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400 border-b border-slate-100 bg-slate-50 whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {/* System logs */}
                                {displayedLogs.map(log => (
                                    <LogRow
                                        key={log.id}
                                        log={log}
                                        isManual={false}
                                        onDownload={downloadingId ? undefined : handleDownloadFromArchive}
                                    />
                                ))}
                                {/* Manual entries */}
                                {displayedManual.map(entry => (
                                    <LogRow
                                        key={entry.id}
                                        log={entry}
                                        isManual={true}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                <ExternalLink size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                    <strong>Tentang Log ini:</strong> Setiap kali quotation digenerate melalui sistem, nomor surat otomatis tercatat di sini beserta status dan pembuat. 
                    Untuk surat yang dibuat di luar sistem (fisik/manual), gunakan tombol "Tambah Catatan Manual" agar tetap bisa di-tracking.
                    PDF arsip bisa didownload ulang dengan klik tombol <Download size={12} className="inline" /> pada baris yang sudah terhubung ke quotation.
                </div>
            </div>

            {/* Modals */}
            {showManualModal && user && (
                <ManualEntryModal
                    onClose={() => setShowManualModal(false)}
                    onAdd={entry => setManualEntries(prev => [entry, ...prev])}
                    currentUser={user.name}
                />
            )}
        </div>
    );
}
