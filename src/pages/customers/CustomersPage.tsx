import { useState, useEffect } from "react";
import {
    Users, Search, X, RefreshCw, Loader2,
    FileText, TrendingUp, ChevronDown, ChevronUp, CheckCircle2, MessageCircle,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { getQuotations } from "../../services/quotationService";
import { formatRupiah, formatDate } from "../../lib/utils";
import { LAYANAN_CONFIG } from "../../lib/quotationConfig";
import type { Quotation } from "../../types";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface DerivedCustomer {
    name: string;
    quotations: Quotation[];
    totalApproved: number;
    totalRevenue: number;
    lastDate: Date;
    address: string;
    wa: string;
}

function useDebounce<T>(value: T, delay = 350): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

// ─── CUSTOMER CARD ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
    draft:    "bg-slate-100 text-slate-500",
    pending:  "bg-amber-100 text-amber-700",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-600",
};
const STATUS_LABEL: Record<string, string> = {
    draft: "Draft", pending: "Pending", approved: "Disetujui", rejected: "Ditolak",
};

function CustomerCard({ customer, expanded, onToggle }: {
    customer: DerivedCustomer;
    expanded: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <button onClick={onToggle}
                className="w-full px-5 py-4 flex items-start gap-4 text-left hover:bg-slate-50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                    {customer.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{customer.name}</p>
                    {customer.address && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">{customer.address}</p>
                    )}
                    {customer.wa && (
                        <a href={`https://wa.me/${customer.wa.replace(/^0/, "62").replace(/\D/g, "")}`}
                            target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-green-600 hover:text-green-700 font-medium">
                            <MessageCircle size={10} /> {customer.wa}
                        </a>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                            <FileText size={11} /> {customer.quotations.length} quotation
                        </span>
                        {customer.totalApproved > 0 && (
                            <span className="text-xs text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 size={11} /> {customer.totalApproved} disetujui
                            </span>
                        )}
                        {customer.totalRevenue > 0 && (
                            <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                                <TrendingUp size={11} /> {formatRupiah(customer.totalRevenue)}
                            </span>
                        )}
                    </div>
                </div>
                <div className="shrink-0 text-slate-400 mt-1">
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </button>

            {expanded && (
                <div className="border-t border-slate-100">
                    <p className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50">
                        Riwayat Quotation
                    </p>
                    <div className="divide-y divide-slate-50">
                        {customer.quotations.map(q => (
                            <div key={q.id} className="px-5 py-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <code className={`text-xs font-bold font-mono ${q.kategori === "AR" ? "text-purple-700" : "text-cyan-700"}`}>
                                        {q.noSurat}
                                    </code>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {LAYANAN_CONFIG[q.jenisLayanan]?.label.split("—")[1]?.trim() ?? q.jenisLayanan} · {formatDate(q.tanggal)}
                                    </p>
                                    {q.marketingNama && (
                                        <p className="text-xs text-slate-400">by {q.marketingNama}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs font-mono text-slate-600 hidden sm:block">{formatRupiah(q.total)}</span>
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[q.status]}`}>
                                        {STATUS_LABEL[q.status]}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export function CustomersPage() {
    const { user } = useAuthStore();

    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [loading, setLoading]       = useState(true);
    const [searchQ, setSearchQ]       = useState("");
    const [expandedName, setExpandedName] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<"date" | "revenue" | "name">("date");

    const debouncedSearch = useDebounce(searchQ, 350);
    const canSeeAll = user?.role !== "marketing";

    const load = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await getQuotations({
                companyId: user.companyId,
                byUid: canSeeAll ? undefined : user.uid,
            });
            setQuotations(data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [user]);

    // Derive customers from quotations
    const customerMap = new Map<string, DerivedCustomer>();
    quotations.forEach(q => {
        const key = q.kepadaNama.trim().toLowerCase();
        if (!customerMap.has(key)) {
            customerMap.set(key, {
                name: q.kepadaNama,
                quotations: [],
                totalApproved: 0,
                totalRevenue: 0,
                lastDate: q.tanggal,
                address: q.kepadaAlamatLines?.[0] ?? "",
                wa: q.kepadaWa ?? "",
            });
        }
        const c = customerMap.get(key)!;
        c.quotations.push(q);
        if (q.status === "deal" || q.status === "approved") { c.totalApproved++; c.totalRevenue += q.total; }
        if (q.tanggal > c.lastDate) c.lastDate = q.tanggal;
        if (!c.address && q.kepadaAlamatLines?.[0]) c.address = q.kepadaAlamatLines[0];
        if (!c.wa && q.kepadaWa) c.wa = q.kepadaWa;
    });

    let customers = Array.from(customerMap.values());

    if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        customers = customers.filter(c =>
            c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q)
        );
    }

    customers.sort((a, b) => {
        if (sortBy === "name")    return a.name.localeCompare(b.name);
        if (sortBy === "revenue") return b.totalRevenue - a.totalRevenue;
        return b.lastDate.getTime() - a.lastDate.getTime();
    });

    const totalCustomers = customerMap.size;
    const withApproved   = Array.from(customerMap.values()).filter(c => c.totalApproved > 0).length;
    const totalRevenue   = Array.from(customerMap.values()).reduce((s, c) => s + c.totalRevenue, 0);

    return (
        <div className="p-4 md:p-6 max-w-screen-lg mx-auto space-y-5">

            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Users size={20} className="text-blue-600" /> Pelanggan
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                    {canSeeAll ? "Semua klien dari quotation perusahaan" : "Klien dari quotation kamu"}
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                    <p className="text-2xl font-bold text-slate-800">{totalCustomers}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Total Klien</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                    <p className="text-2xl font-bold text-emerald-700">{withApproved}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Ada Deal</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <p className="text-sm font-bold text-blue-700 truncate">{formatRupiah(totalRevenue)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Total Revenue</p>
                </div>
            </div>

            {/* Search + Sort */}
            <div className="flex gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-0 bg-white border border-slate-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-100">
                    <Search size={14} className="text-slate-400 shrink-0" />
                    <input
                        className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder:text-slate-400 min-w-0"
                        placeholder="Cari nama atau alamat klien..."
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                    />
                    {searchQ && (
                        <button onClick={() => setSearchQ("")} className="text-slate-400 hover:text-slate-600 shrink-0">
                            <X size={13} />
                        </button>
                    )}
                </div>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-600 focus:outline-none shrink-0">
                    <option value="date">Terbaru</option>
                    <option value="revenue">Revenue</option>
                    <option value="name">Nama A-Z</option>
                </select>
                <button onClick={load} disabled={loading}
                    className="p-2 border border-slate-200 bg-white text-slate-500 rounded-xl hover:bg-slate-50 shrink-0">
                    <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                    <Loader2 size={24} className="animate-spin mr-2" /> Memuat data...
                </div>
            ) : customers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-center">
                    <Users size={36} className="mb-3 opacity-20" />
                    <p className="font-medium text-slate-500">
                        {debouncedSearch ? "Klien tidak ditemukan" : "Belum ada data klien"}
                    </p>
                    <p className="text-sm mt-1">
                        {debouncedSearch ? "Coba ubah kata kunci." : "Data muncul otomatis dari quotation."}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {customers.map(c => (
                        <CustomerCard
                            key={c.name}
                            customer={c}
                            expanded={expandedName === c.name}
                            onToggle={() => setExpandedName(prev => prev === c.name ? null : c.name)}
                        />
                    ))}
                    <p className="text-xs text-slate-400 text-center pt-1">
                        {customers.length} dari {totalCustomers} klien
                    </p>
                </div>
            )}
        </div>
    );
}