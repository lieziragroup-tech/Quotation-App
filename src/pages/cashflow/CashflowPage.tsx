import { useState, useEffect, useMemo } from "react";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { formatRupiah } from "../../lib/utils";
import {
    DollarSign, TrendingUp, TrendingDown, FileText,
    RefreshCw, Loader2, ChevronDown, BarChart3,
    ArrowUpRight, Minus,
} from "lucide-react";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface QuoRow {
    id: string;
    noSurat: string;
    kepadaNama: string;
    perihal: string;
    total: number;
    kategori: "AR" | "PCO";
    marketingNama: string;
    marketingUid: string;
    approvedAt: Date;
    createdAt: Date;
    jenisLayanan: string;
}

interface MonthBucket {
    key: string;       // "2026-03"
    label: string;     // "Mar 2026"
    revenue: number;
    count: number;
    ar: number;
    pco: number;
}

interface MarketingRevenue {
    uid: string;
    nama: string;
    revenue: number;
    count: number;
    ar: number;
    pco: number;
}

const MONTHS_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agt","Sep","Okt","Nov","Des"];

function monthKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function monthLabel(key: string) {
    const [y, m] = key.split("-");
    return `${MONTHS_ID[parseInt(m)-1]} ${y}`;
}

// ─── MINI COMPONENTS ──────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color, trend }: {
    icon: React.ReactNode; label: string; value: string;
    sub?: string; color: string; trend?: "up"|"down"|"neutral";
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-0.5">{label}</p>
                <p className="text-xl font-bold text-slate-900 leading-tight">{value}</p>
                {sub && (
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        {trend === "up"      && <ArrowUpRight size={11} className="text-emerald-500" />}
                        {trend === "down"    && <TrendingDown size={11} className="text-red-400" />}
                        {trend === "neutral" && <Minus size={11} className="text-slate-400" />}
                        {sub}
                    </p>
                )}
            </div>
        </div>
    );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{children}</h2>;
}

// ─── BAR CHART ────────────────────────────────────────────────────────────────

function RevenueBarChart({ buckets }: { buckets: MonthBucket[] }) {
    const maxRev = Math.max(...buckets.map(b => b.revenue), 1);
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <p className="text-sm font-bold text-slate-800">Tren Revenue</p>
                    <p className="text-xs text-slate-400 mt-0.5">dari quotation approved</p>
                </div>
                <BarChart3 size={16} className="text-slate-300" />
            </div>
            <div className="flex items-end gap-2" style={{ height: 140 }}>
                {buckets.map((b, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-500 leading-none">
                            {b.revenue > 0 ? (b.revenue >= 1_000_000 ? `${(b.revenue/1_000_000).toFixed(0)}jt` : `${(b.revenue/1_000).toFixed(0)}k`) : ""}
                        </span>
                        <div className="w-full flex flex-col justify-end rounded-t-md overflow-hidden" style={{ height: 100 }}>
                            {/* PCO layer */}
                            <div className="w-full bg-blue-400 transition-all duration-500"
                                style={{ height: `${maxRev > 0 ? (b.pco / maxRev) * 100 : 0}%`, opacity: b.pco > 0 ? 1 : 0 }} />
                            {/* AR layer */}
                            <div className="w-full bg-emerald-400 transition-all duration-500"
                                style={{ height: `${maxRev > 0 ? (b.ar / maxRev) * 100 : 0}%`, opacity: b.ar > 0 ? 1 : 0 }} />
                            {b.revenue === 0 && <div className="w-full bg-slate-100 rounded-t-md" style={{ height: 4 }} />}
                        </div>
                        <span className="text-[10px] text-slate-400 leading-none">{b.label}</span>
                    </div>
                ))}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" /> Anti Rayap
                </span>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="w-3 h-3 rounded-sm bg-blue-400 inline-block" /> Pest Control
                </span>
            </div>
        </div>
    );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export function CashflowPage() {
    const { user } = useAuthStore();
    const companyId = user?.companyId ?? "";

    const [rows, setRows] = useState<QuoRow[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const currentYear  = new Date().getFullYear();
    const [filterYear, setFilterYear] = useState(currentYear);
    const [filterMonth, setFilterMonth] = useState<number | "all">("all"); // 1-12 or "all"

    const yearOptions = useMemo(() => {
        const years = [];
        for (let y = currentYear; y >= currentYear - 3; y--) years.push(y);
        return years;
    }, [currentYear]);

    const load = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(query(
                collection(db, "quotations"),
                where("companyId", "==", companyId),
                where("status", "==", "approved"),
            ));
            setRows(snap.docs.map(d => {
                const x = d.data();
                return {
                    id: d.id,
                    noSurat: x.noSurat as string,
                    kepadaNama: x.kepadaNama as string,
                    perihal: x.perihal as string,
                    total: (x.total as number) ?? 0,
                    kategori: x.kategori as "AR" | "PCO",
                    marketingNama: x.marketingNama as string,
                    marketingUid: x.marketingUid as string,
                    approvedAt: x.approvedAt ? (x.approvedAt as Timestamp).toDate() : (x.createdAt as Timestamp).toDate(),
                    createdAt: (x.createdAt as Timestamp).toDate(),
                    jenisLayanan: x.jenisLayanan as string,
                };
            }));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [companyId]); // eslint-disable-line

    // ── Filtered data ──────────────────────────────────────────────────────────
    const filtered = useMemo(() => rows.filter(r => {
        const y = r.approvedAt.getFullYear();
        const m = r.approvedAt.getMonth() + 1;
        if (y !== filterYear) return false;
        if (filterMonth !== "all" && m !== filterMonth) return false;
        return true;
    }), [rows, filterYear, filterMonth]);

    // ── Monthly buckets (always 12 months of selected year) ──────────────────
    const monthBuckets = useMemo<MonthBucket[]>(() => {
        const map: Record<string, MonthBucket> = {};
        for (let m = 1; m <= 12; m++) {
            const key = `${filterYear}-${String(m).padStart(2,"0")}`;
            map[key] = { key, label: `${MONTHS_ID[m-1]}`, revenue: 0, count: 0, ar: 0, pco: 0 };
        }
        rows.filter(r => r.approvedAt.getFullYear() === filterYear).forEach(r => {
            const key = monthKey(r.approvedAt);
            if (map[key]) {
                map[key].revenue += r.total;
                map[key].count++;
                if (r.kategori === "AR") map[key].ar += r.total;
                else map[key].pco += r.total;
            }
        });
        return Object.values(map);
    }, [rows, filterYear]);

    // ── Displayed buckets (filter by month if selected) ──────────────────────
    const displayBuckets = useMemo(() => {
        if (filterMonth === "all") return monthBuckets;
        return monthBuckets.filter(b => b.key === `${filterYear}-${String(filterMonth).padStart(2,"0")}`);
    }, [monthBuckets, filterYear, filterMonth]);

    // ── Stats ─────────────────────────────────────────────────────────────────
    const totalRevenue = filtered.reduce((s, r) => s + r.total, 0);
    const arRevenue    = filtered.filter(r => r.kategori === "AR").reduce((s, r) => s + r.total, 0);
    const pcoRevenue   = filtered.filter(r => r.kategori === "PCO").reduce((s, r) => s + r.total, 0);
    const arPct        = totalRevenue > 0 ? Math.round((arRevenue / totalRevenue) * 100) : 0;
    const pcoPct       = 100 - arPct;

    // ── Marketing breakdown ───────────────────────────────────────────────────
    const marketingMap = useMemo<MarketingRevenue[]>(() => {
        const map: Record<string, MarketingRevenue> = {};
        filtered.forEach(r => {
            if (!map[r.marketingUid]) {
                map[r.marketingUid] = { uid: r.marketingUid, nama: r.marketingNama, revenue: 0, count: 0, ar: 0, pco: 0 };
            }
            map[r.marketingUid].revenue += r.total;
            map[r.marketingUid].count++;
            if (r.kategori === "AR") map[r.marketingUid].ar += r.total;
            else map[r.marketingUid].pco += r.total;
        });
        return Object.values(map).sort((a, b) => b.revenue - a.revenue);
    }, [filtered]);

    const maxMktRevenue = marketingMap[0]?.revenue ?? 1;

    // ── Month-over-month delta ────────────────────────────────────────────────
    const thisMonthKey = monthKey(new Date());
    const lastMonthKey = (() => {
        const d = new Date(); d.setMonth(d.getMonth() - 1);
        return monthKey(d);
    })();
    const thisMonthRev = monthBuckets.find(b => b.key === thisMonthKey)?.revenue ?? 0;
    const lastMonthRev = monthBuckets.find(b => b.key === lastMonthKey)?.revenue ?? 0;
    const delta = lastMonthRev > 0 ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100 : null;

    const periodLabel = filterMonth === "all"
        ? `Tahun ${filterYear}`
        : `${MONTHS_ID[filterMonth - 1]} ${filterYear}`;

    return (
        <div className="p-4 md:p-6 max-w-screen-xl mx-auto space-y-6">

            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <DollarSign size={22} className="text-emerald-600" /> Cashflow
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">Revenue dari quotation approved</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400 mr-1">Periode:</span>
                {/* Year */}
                <div className="relative">
                    <select
                        value={filterYear}
                        onChange={e => setFilterYear(Number(e.target.value))}
                        className="appearance-none pl-3 pr-7 py-1.5 text-sm font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 cursor-pointer"
                    >
                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                {/* Month */}
                <div className="relative">
                    <select
                        value={filterMonth}
                        onChange={e => setFilterMonth(e.target.value === "all" ? "all" : Number(e.target.value))}
                        className="appearance-none pl-3 pr-7 py-1.5 text-sm font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 cursor-pointer"
                    >
                        <option value="all">Semua Bulan</option>
                        {MONTHS_ID.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <span className="text-xs text-slate-400 ml-1">— {periodLabel}</span>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                    <Loader2 size={22} className="animate-spin mr-2" /> Memuat data...
                </div>
            ) : (
                <>
                    {/* ── Stat cards ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard icon={<DollarSign size={20} />} label="Total Revenue" value={formatRupiah(totalRevenue)}
                            sub={delta !== null ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% vs bulan lalu` : "periode dipilih"}
                            color="bg-emerald-100 text-emerald-600"
                            trend={delta === null ? "neutral" : delta >= 0 ? "up" : "down"} />
                        <StatCard icon={<FileText size={20} />} label="Quotation Approved" value={String(filtered.length)}
                            sub="dalam periode ini" color="bg-blue-100 text-blue-600" trend="neutral" />
                        <StatCard icon={<TrendingUp size={20} />} label="Anti Rayap" value={formatRupiah(arRevenue)}
                            sub={`${arPct}% dari total`} color="bg-emerald-100 text-emerald-700" trend="neutral" />
                        <StatCard icon={<TrendingUp size={20} />} label="Pest Control" value={formatRupiah(pcoRevenue)}
                            sub={`${pcoPct}% dari total`} color="bg-blue-100 text-blue-700" trend="neutral" />
                    </div>

                    {/* ── Chart + AR/PCO breakdown ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="md:col-span-2">
                            <RevenueBarChart buckets={filterMonth === "all" ? monthBuckets : monthBuckets} />
                        </div>

                        {/* AR vs PCO donut-style */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                            <SectionTitle>Breakdown Layanan</SectionTitle>
                            <div className="space-y-4 mt-2">
                                {[
                                    { label: "Anti Rayap", revenue: arRevenue, pct: arPct, color: "bg-emerald-500" },
                                    { label: "Pest Control", revenue: pcoRevenue, pct: pcoPct, color: "bg-blue-500" },
                                ].map(s => (
                                    <div key={s.label}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-slate-700">{s.label}</span>
                                            <span className="text-sm font-bold text-slate-900">{s.pct}%</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2.5">
                                            <div className={`h-2.5 rounded-full ${s.color} transition-all duration-700`}
                                                style={{ width: `${s.pct}%` }} />
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">{formatRupiah(s.revenue)}</p>
                                    </div>
                                ))}

                                <div className="pt-3 border-t border-slate-100">
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Rata-rata per Quotation</p>
                                    <p className="text-lg font-bold text-slate-900">
                                        {filtered.length > 0 ? formatRupiah(Math.round(totalRevenue / filtered.length)) : "—"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Marketing revenue ranking ── */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                        <SectionTitle>Revenue per Marketing</SectionTitle>
                        {marketingMap.length === 0 ? (
                            <p className="text-sm text-slate-400 py-4 text-center">Tidak ada data untuk periode ini.</p>
                        ) : (
                            <div className="space-y-3">
                                {marketingMap.map((m, i) => (
                                    <div key={m.uid} className="flex items-center gap-4">
                                        {/* Rank */}
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                            i === 0 ? "bg-amber-100 text-amber-700" :
                                            i === 1 ? "bg-slate-200 text-slate-600" :
                                            i === 2 ? "bg-orange-100 text-orange-700" :
                                            "bg-slate-100 text-slate-500"
                                        }`}>{i + 1}</div>
                                        {/* Avatar */}
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">
                                            {m.nama[0]?.toUpperCase()}
                                        </div>
                                        {/* Bar + info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-semibold text-slate-800 truncate">{m.nama}</span>
                                                <span className="text-sm font-bold text-slate-900 ml-2 flex-shrink-0">{formatRupiah(m.revenue)}</span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                                                <div className="h-1.5 rounded-full bg-emerald-500 transition-all duration-700"
                                                    style={{ width: `${(m.revenue / maxMktRevenue) * 100}%` }} />
                                            </div>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-xs text-slate-400">{m.count} quotation</span>
                                                <span className="text-xs text-emerald-600">AR: {formatRupiah(m.ar)}</span>
                                                <span className="text-xs text-blue-600">PCO: {formatRupiah(m.pco)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Detail table ── */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                            <SectionTitle>Detail Transaksi</SectionTitle>
                            <span className="text-xs text-slate-400">{filtered.length} quotation</span>
                        </div>
                        {filtered.length === 0 ? (
                            <p className="text-sm text-slate-400 py-8 text-center">Tidak ada data untuk periode ini.</p>
                        ) : (
                            <>
                            {/* Desktop table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr>
                                            {["No. Surat", "Klien", "Layanan", "Marketing", "Approved", "Revenue"].map(h => (
                                                <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400 bg-slate-50 border-b border-slate-100 whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered
                                            .sort((a, b) => b.approvedAt.getTime() - a.approvedAt.getTime())
                                            .map(r => (
                                                <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{r.noSurat}</td>
                                                    <td className="px-4 py-3">
                                                        <p className="text-sm font-medium text-slate-800 max-w-[160px] truncate">{r.kepadaNama}</p>
                                                        <p className="text-xs text-slate-400 max-w-[160px] truncate">{r.perihal}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${r.kategori === "AR" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                                                            {r.kategori === "AR" ? "Anti Rayap" : "Pest Control"}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-600">{r.marketingNama}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                                                        {r.approvedAt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-bold text-slate-900 whitespace-nowrap">{formatRupiah(r.total)}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-50 border-t border-slate-200">
                                            <td colSpan={5} className="px-4 py-3 text-sm font-bold text-slate-700">Total</td>
                                            <td className="px-4 py-3 text-sm font-bold text-emerald-700">{formatRupiah(totalRevenue)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Mobile cards */}
                            <div className="md:hidden divide-y divide-slate-100">
                                {filtered
                                    .sort((a, b) => b.approvedAt.getTime() - a.approvedAt.getTime())
                                    .map(r => (
                                        <div key={r.id} className="p-4 space-y-1.5">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-slate-800 truncate">{r.kepadaNama}</p>
                                                    <code className="text-xs text-slate-400 font-mono">{r.noSurat}</code>
                                                </div>
                                                <p className="text-sm font-bold text-slate-900 whitespace-nowrap shrink-0">{formatRupiah(r.total)}</p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${r.kategori === "AR" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                                                    {r.kategori === "AR" ? "Anti Rayap" : "Pest Control"}
                                                </span>
                                                <span className="text-xs text-slate-400">{r.marketingNama}</span>
                                                <span className="text-xs text-slate-400">{r.approvedAt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</span>
                                            </div>
                                        </div>
                                    ))}
                                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                                    <span className="text-sm font-bold text-slate-700">Total</span>
                                    <span className="text-sm font-bold text-emerald-700">{formatRupiah(totalRevenue)}</span>
                                </div>
                            </div>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}