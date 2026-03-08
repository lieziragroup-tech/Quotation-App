import { useState, useEffect, useMemo } from "react";
import {
    ClipboardList, RefreshCw, Search, Filter,
    CheckCircle2, Clock, XCircle, AlertCircle,
    ChevronDown, ChevronUp, Banknote, Wrench,
    TrendingUp, Loader2, Save, CalendarDays,
} from "lucide-react";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import {
    getTrackingByCompany, upsertTracking,
    type OrderTracking, type StatusPembayaran, type StatusPengerjaan,
} from "../../services/trackingService";
import type { Quotation } from "../../types";
import { formatRupiah, formatDate } from "../../lib/utils";
import { fmtIDR } from "../../lib/quotationConfig";

// ─── CONFIGS ──────────────────────────────────────────────────────────────────

const PEMBAYARAN_CFG: Record<StatusPembayaran, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    belum_bayar: { label: "Belum Bayar", color: "#dc2626", bg: "#fee2e2", icon: <AlertCircle size={12} /> },
    dp:          { label: "DP",          color: "#d97706", bg: "#fef3c7", icon: <Banknote size={12} /> },
    lunas:       { label: "Lunas",       color: "#15803d", bg: "#dcfce7", icon: <CheckCircle2 size={12} /> },
    nunggak:     { label: "Nunggak",     color: "#7c3aed", bg: "#f3e8ff", icon: <AlertCircle size={12} /> },
};

const PENGERJAAN_CFG: Record<StatusPengerjaan, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    pending:     { label: "Pending",     color: "#64748b", bg: "#f1f5f9", icon: <Clock size={12} /> },
    berlanjut:   { label: "Berlanjut",   color: "#1d4ed8", bg: "#dbeafe", icon: <RefreshCw size={12} /> },
    selesai:     { label: "Selesai",     color: "#15803d", bg: "#dcfce7", icon: <CheckCircle2 size={12} /> },
    dibatalkan:  { label: "Dibatalkan",  color: "#6b7280", bg: "#f3f4f6", icon: <XCircle size={12} /> },
};

function PembayaranBadge({ status }: { status: StatusPembayaran }) {
    const c = PEMBAYARAN_CFG[status];
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: c.bg, color: c.color }}>
            {c.icon} {c.label}
        </span>
    );
}

function PengerjaanBadge({ status }: { status: StatusPengerjaan }) {
    const c = PENGERJAAN_CFG[status];
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: c.bg, color: c.color }}>
            {c.icon} {c.label}
        </span>
    );
}

// ─── EDIT MODAL ───────────────────────────────────────────────────────────────

function EditModal({
    open, onClose, onSaved, tracking, quotation,
}: {
    open: boolean;
    onClose: () => void;
    onSaved: (updated: Partial<OrderTracking>) => void;
    tracking: OrderTracking | null;
    quotation: Quotation;
}) {
    const [statusPembayaran, setStatusPembayaran] = useState<StatusPembayaran>("belum_bayar");
    const [nominalDibayar, setNominalDibayar] = useState(0);
    const [catatanPembayaran, setCatatanPembayaran] = useState("");
    const [statusPengerjaan, setStatusPengerjaan] = useState<StatusPengerjaan>("pending");
    const [catatanPengerjaan, setCatatanPengerjaan] = useState("");
    const [tanggalMulai, setTanggalMulai] = useState("");
    const [tanggalSelesai, setTanggalSelesai] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        if (tracking) {
            setStatusPembayaran(tracking.statusPembayaran);
            setNominalDibayar(tracking.nominalDibayar);
            setCatatanPembayaran(tracking.catatanPembayaran ?? "");
            setStatusPengerjaan(tracking.statusPengerjaan);
            setCatatanPengerjaan(tracking.catatanPengerjaan ?? "");
            setTanggalMulai(tracking.tanggalMulai ? tracking.tanggalMulai.toISOString().slice(0,10) : "");
            setTanggalSelesai(tracking.tanggalSelesai ? tracking.tanggalSelesai.toISOString().slice(0,10) : "");
        } else {
            setStatusPembayaran("belum_bayar");
            setNominalDibayar(0);
            setCatatanPembayaran("");
            setStatusPengerjaan("pending");
            setCatatanPengerjaan("");
            setTanggalMulai("");
            setTanggalSelesai("");
        }
    }, [open, tracking]);

    const sisa = quotation.total - nominalDibayar;

    const handleSave = async () => {
        setSaving(true);
        try {
            const data = {
                quotationId:       quotation.id,
                noSurat:           quotation.noSurat,
                kepadaNama:        quotation.kepadaNama,
                total:             quotation.total,
                companyId:         quotation.companyId,
                marketingUid:      quotation.marketingUid,
                marketingNama:     quotation.marketingNama,
                tanggalDeal:       (quotation as any).dealAt,
                statusPembayaran,
                nominalDibayar,
                catatanPembayaran: catatanPembayaran || undefined,
                statusPengerjaan,
                catatanPengerjaan: catatanPengerjaan || undefined,
                tanggalMulai:      tanggalMulai  ? new Date(tanggalMulai)  : undefined,
                tanggalSelesai:    tanggalSelesai ? new Date(tanggalSelesai) : undefined,
            };
            await upsertTracking(data);
            onSaved({ statusPembayaran, nominalDibayar, catatanPembayaran, statusPengerjaan, catatanPengerjaan });
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 shrink-0">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <ClipboardList size={16} className="text-blue-600" />
                        Update Tracking
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <code className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{quotation.noSurat}</code>
                        <span className="text-sm font-semibold text-slate-700">{quotation.kepadaNama}</span>
                        <span className="text-sm font-bold text-slate-800 ml-auto">{formatRupiah(quotation.total)}</span>
                    </div>
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                    {/* Pembayaran */}
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-1.5">
                            <Banknote size={13} /> Status Pembayaran
                        </p>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            {(Object.entries(PEMBAYARAN_CFG) as [StatusPembayaran, typeof PEMBAYARAN_CFG[StatusPembayaran]][]).map(([val, cfg]) => (
                                <button key={val} type="button" onClick={() => setStatusPembayaran(val)}
                                    className={`px-3 py-2.5 border rounded-xl text-left text-xs font-medium transition-all
                                        ${statusPembayaran === val ? "ring-2 font-semibold" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
                                    style={statusPembayaran === val ? { background: cfg.bg, color: cfg.color, borderColor: cfg.color, outline: "none" } : {}}>
                                    <span className="flex items-center gap-1.5">{cfg.icon} {cfg.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Nominal Dibayar (Rp)</label>
                                <input type="number" min={0} className={inputCls}
                                    value={nominalDibayar}
                                    onChange={e => setNominalDibayar(parseInt(e.target.value) || 0)} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Sisa Tagihan</label>
                                <div className={`px-3 py-2 text-sm font-bold rounded-lg ${sisa > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
                                    {fmtIDR(Math.max(0, sisa))}
                                </div>
                            </div>
                        </div>
                        <div className="mt-2">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Catatan Pembayaran</label>
                            <input className={inputCls} value={catatanPembayaran}
                                onChange={e => setCatatanPembayaran(e.target.value)}
                                placeholder="Mis: DP 50% transfer BCA, 12 Mar 2026" />
                        </div>
                    </div>

                    {/* Pengerjaan */}
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-1.5">
                            <Wrench size={13} /> Status Pengerjaan
                        </p>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            {(Object.entries(PENGERJAAN_CFG) as [StatusPengerjaan, typeof PENGERJAAN_CFG[StatusPengerjaan]][]).map(([val, cfg]) => (
                                <button key={val} type="button" onClick={() => setStatusPengerjaan(val)}
                                    className={`px-3 py-2.5 border rounded-xl text-left text-xs font-medium transition-all
                                        ${statusPengerjaan === val ? "ring-2 font-semibold" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
                                    style={statusPengerjaan === val ? { background: cfg.bg, color: cfg.color, borderColor: cfg.color, outline: "none" } : {}}>
                                    <span className="flex items-center gap-1.5">{cfg.icon} {cfg.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-2">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Tanggal Mulai</label>
                                <input type="date" className={inputCls} value={tanggalMulai}
                                    onChange={e => setTanggalMulai(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Tanggal Selesai</label>
                                <input type="date" className={inputCls} value={tanggalSelesai}
                                    onChange={e => setTanggalSelesai(e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Catatan Pengerjaan</label>
                            <textarea className={`${inputCls} resize-none`} rows={2}
                                value={catatanPengerjaan}
                                onChange={e => setCatatanPengerjaan(e.target.value)}
                                placeholder="Keterangan tambahan pengerjaan..." />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex gap-2 shrink-0">
                    <button onClick={onClose} className="flex-1 py-2 text-sm rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium">
                        Batal
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 py-2 text-sm rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? "Menyimpan..." : "Simpan"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── TRACKING CARD ────────────────────────────────────────────────────────────

function TrackingCard({
    quotation, tracking, onEdit,
}: {
    quotation: Quotation;
    tracking: OrderTracking | null;
    onEdit: () => void;
}) {
    const [open, setOpen] = useState(false);
    const sisa = quotation.total - (tracking?.nominalDibayar ?? 0);
    const pct  = quotation.total > 0 ? Math.min(100, Math.round((tracking?.nominalDibayar ?? 0) / quotation.total * 100)) : 0;

    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-xs font-bold font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                {quotation.noSurat}
                            </code>
                            {tracking ? (
                                <>
                                    <PembayaranBadge status={tracking.statusPembayaran} />
                                    <PengerjaanBadge status={tracking.statusPengerjaan} />
                                </>
                            ) : (
                                <span className="text-xs text-slate-400 italic">Belum ada tracking</span>
                            )}
                        </div>
                        <p className="font-semibold text-slate-900 text-sm mt-1 truncate">{quotation.kepadaNama}</p>
                        <p className="text-xs text-slate-400">{quotation.marketingNama}</p>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="font-bold text-slate-800 font-mono text-sm">{formatRupiah(quotation.total)}</p>
                        {tracking && sisa > 0 && (
                            <p className="text-xs text-red-500 font-medium">Sisa {formatRupiah(sisa)}</p>
                        )}
                        {tracking && sisa <= 0 && (
                            <p className="text-xs text-emerald-600 font-medium">✓ Lunas</p>
                        )}
                    </div>
                </div>

                {/* Progress bar pembayaran */}
                {tracking && tracking.nominalDibayar > 0 && (
                    <div className="mb-3">
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span>Pembayaran</span>
                            <span>{pct}% ({fmtIDR(tracking.nominalDibayar)})</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                                style={{ width: `${pct}%` }} />
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <button onClick={onEdit}
                        className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors">
                        {tracking ? "Update Tracking" : "+ Tambah Tracking"}
                    </button>
                    {tracking && (
                        <button onClick={() => setOpen(o => !o)}
                            className="p-1.5 text-slate-400 hover:text-slate-600">
                            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    )}
                </div>
            </div>

            {/* Detail */}
            {open && tracking && (
                <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 text-xs text-slate-600 space-y-1.5">
                    {tracking.catatanPembayaran && (
                        <p><span className="font-semibold text-slate-700">Catatan Bayar:</span> {tracking.catatanPembayaran}</p>
                    )}
                    {tracking.tanggalMulai && (
                        <p><span className="font-semibold text-slate-700">Mulai:</span> {formatDate(tracking.tanggalMulai)}</p>
                    )}
                    {tracking.tanggalSelesai && (
                        <p><span className="font-semibold text-slate-700">Selesai:</span> {formatDate(tracking.tanggalSelesai)}</p>
                    )}
                    {tracking.catatanPengerjaan && (
                        <p><span className="font-semibold text-slate-700">Catatan Kerja:</span> {tracking.catatanPengerjaan}</p>
                    )}
                    <p className="text-slate-400">Diupdate: {formatDate(tracking.updatedAt)}</p>
                </div>
            )}
        </div>
    );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export function TrackingPage() {
    const { user } = useAuthStore();
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [trackingMap, setTrackingMap] = useState<Record<string, OrderTracking>>({});
    const [loading, setLoading]   = useState(true);
    const [search, setSearch]     = useState("");
    const [filterPembayaran, setFilterPembayaran] = useState<StatusPembayaran | "all">("all");
    const [filterPengerjaan, setFilterPengerjaan] = useState<StatusPengerjaan | "all">("all");
    const [editTarget, setEditTarget] = useState<Quotation | null>(null);

    const load = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Load deal quotations
            const snap = await getDocs(query(
                collection(db, "quotations"),
                where("companyId", "==", user.companyId),
                where("status", "==", "deal"),
            ));
            const rows = snap.docs.map(d => {
                const x = d.data() as Record<string, unknown>;
                return {
                    id: d.id, ...x,
                    tanggal: x.tanggal ? (x.tanggal as Timestamp).toDate() : new Date(),
                    dealAt:  x.dealAt  ? (x.dealAt  as Timestamp).toDate() : undefined,
                } as Quotation;
            });
            rows.sort((a, b) => {
                const ad = (a as any).dealAt ?? a.tanggal;
                const bd = (b as any).dealAt ?? b.tanggal;
                return bd.getTime() - ad.getTime();
            });
            setQuotations(rows);

            // Load tracking data
            const trackings = await getTrackingByCompany(user.companyId);
            const map: Record<string, OrderTracking> = {};
            trackings.forEach(t => { map[t.quotationId] = t; });
            setTrackingMap(map);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [user]);

    const stats = useMemo(() => {
        const tr = Object.values(trackingMap);
        return {
            totalDeal:    quotations.length,
            lunas:        tr.filter(t => t.statusPembayaran === "lunas").length,
            dp:           tr.filter(t => t.statusPembayaran === "dp").length,
            nunggak:      tr.filter(t => t.statusPembayaran === "nunggak").length,
            selesai:      tr.filter(t => t.statusPengerjaan === "selesai").length,
            berlanjut:    tr.filter(t => t.statusPengerjaan === "berlanjut").length,
            totalLunas:   tr.filter(t => t.statusPembayaran === "lunas").reduce((s, t) => s + t.total, 0),
            totalDibayar: tr.reduce((s, t) => s + t.nominalDibayar, 0),
        };
    }, [quotations, trackingMap]);

    const displayed = useMemo(() => {
        let rows = [...quotations];
        if (filterPembayaran !== "all") rows = rows.filter(q => trackingMap[q.id]?.statusPembayaran === filterPembayaran);
        if (filterPengerjaan !== "all") rows = rows.filter(q => trackingMap[q.id]?.statusPengerjaan === filterPengerjaan);
        if (search) {
            const s = search.toLowerCase();
            rows = rows.filter(q =>
                q.noSurat.toLowerCase().includes(s) ||
                q.kepadaNama.toLowerCase().includes(s) ||
                q.marketingNama.toLowerCase().includes(s)
            );
        }
        return rows;
    }, [quotations, trackingMap, filterPembayaran, filterPengerjaan, search]);

    return (
        <div className="p-4 md:p-6 max-w-screen-lg mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <ClipboardList size={20} className="text-blue-600" />
                        Tracking Order
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">Status pembayaran & pengerjaan quotation yang deal</p>
                </div>
                <button onClick={load} className="p-2 border border-slate-200 bg-white rounded-xl text-slate-400 hover:bg-slate-50">
                    <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-blue-700">{stats.totalDeal}</p>
                    <p className="text-xs text-slate-400 mt-1">Total Deal</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-700">{stats.lunas}</p>
                    <p className="text-xs text-emerald-500 mt-1">Lunas</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-amber-700">{stats.dp}</p>
                    <p className="text-xs text-amber-500 mt-1">DP</p>
                </div>
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-purple-700">{stats.nunggak}</p>
                    <p className="text-xs text-purple-500 mt-1">Nunggak</p>
                </div>
            </div>

            {/* Revenue summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                    <TrendingUp size={18} className="text-emerald-600 shrink-0" />
                    <div>
                        <p className="text-xs text-emerald-600 font-semibold">Total Sudah Dibayar</p>
                        <p className="text-base font-bold text-emerald-700 font-mono">{formatRupiah(stats.totalDibayar)}</p>
                    </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                    <Wrench size={18} className="text-blue-600 shrink-0" />
                    <div>
                        <p className="text-xs text-blue-600 font-semibold">Selesai Dikerjakan</p>
                        <p className="text-base font-bold text-blue-700">{stats.selesai} dari {stats.totalDeal} order</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Cari nomor surat, klien, marketing..."
                        className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <Filter size={12} className="text-slate-400" />
                    <span className="text-xs text-slate-400">Bayar:</span>
                    {([["all","Semua"],["belum_bayar","Belum"],["dp","DP"],["lunas","Lunas"],["nunggak","Nunggak"]] as const).map(([val, lbl]) => (
                        <button key={val} onClick={() => setFilterPembayaran(val)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
                                ${filterPembayaran === val ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                            {lbl}
                        </button>
                    ))}
                    <span className="text-xs text-slate-400 ml-2">Kerja:</span>
                    {([["all","Semua"],["pending","Pending"],["berlanjut","Berlanjut"],["selesai","Selesai"],["dibatalkan","Batal"]] as const).map(([val, lbl]) => (
                        <button key={val} onClick={() => setFilterPengerjaan(val)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
                                ${filterPengerjaan === val ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                            {lbl}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                    <RefreshCw size={20} className="animate-spin mr-2" /> Memuat data...
                </div>
            ) : displayed.length === 0 ? (
                <div className="text-center py-16 text-slate-400 bg-white border border-slate-200 rounded-2xl">
                    <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium text-slate-500">Belum ada order</p>
                    <p className="text-sm mt-1">Order akan muncul di sini setelah quotation berstatus Deal.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {displayed.map(q => (
                        <TrackingCard key={q.id}
                            quotation={q}
                            tracking={trackingMap[q.id] ?? null}
                            onEdit={() => setEditTarget(q)}
                        />
                    ))}
                    <p className="text-xs text-slate-400 text-center py-1">{displayed.length} order ditampilkan</p>
                </div>
            )}

            {/* Edit Modal */}
            {editTarget && (
                <EditModal
                    open={!!editTarget}
                    onClose={() => setEditTarget(null)}
                    quotation={editTarget}
                    tracking={trackingMap[editTarget.id] ?? null}
                    onSaved={(updated) => {
                        setTrackingMap(prev => ({
                            ...prev,
                            [editTarget.id]: {
                                ...(prev[editTarget.id] ?? {
                                    id: editTarget.id,
                                    quotationId: editTarget.id,
                                    noSurat: editTarget.noSurat,
                                    kepadaNama: editTarget.kepadaNama,
                                    total: editTarget.total,
                                    companyId: editTarget.companyId,
                                    marketingUid: editTarget.marketingUid,
                                    marketingNama: editTarget.marketingNama,
                                    createdAt: new Date(),
                                }),
                                ...updated,
                                updatedAt: new Date(),
                            } as OrderTracking,
                        }));
                        setEditTarget(null);
                    }}
                />
            )}
        </div>
    );
}