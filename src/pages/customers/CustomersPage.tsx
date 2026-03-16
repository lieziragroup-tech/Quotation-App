import { useState, useEffect, useMemo } from "react";
import {
    Users, Search, X, RefreshCw, Loader2,
    FileText, TrendingUp, ChevronDown, ChevronUp, CheckCircle2,
    MessageCircle, Shield, Clock, AlertTriangle, CalendarCheck,
    MapPin, ClipboardCheck,
} from "lucide-react";
import { collection, query, where, getDocs, doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { getQuotations } from "../../services/quotationService";
import { formatRupiah, formatDate } from "../../lib/utils";
import { LAYANAN_CONFIG } from "../../lib/quotationConfig";
import type { Quotation } from "../../types";

interface ControlChecklist {
    id: string;
    tanggal: Date;
    teknisi: string;
    catatan: string;
    hasilKontrol: "baik" | "perlu_tindak_lanjut" | "darurat";
}

interface WarrantyInfo {
    quotationId: string;
    noSurat: string;
    garansiTahun: number;
    jenisGaransi?: string;
    dealAt: Date;
    expiredAt: Date;
    isActive: boolean;
    daysRemaining: number;
}

interface DerivedCustomer {
    id: string;
    name: string;
    quotations: Quotation[];
    totalDeal: number;
    totalRevenue: number;
    lastDate: Date;
    address: string;
    wa: string;
    warranties: WarrantyInfo[];
    activeWarranty: WarrantyInfo | null;
    checklists: ControlChecklist[];
}

function useDebounce<T>(value: T, delay = 350): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

const STATUS_COLOR: Record<string, string> = {
    draft:          "bg-slate-100 text-slate-500",
    pending:        "bg-amber-100 text-amber-700",
    approved:       "bg-blue-100 text-blue-700",
    rejected:       "bg-red-100 text-red-600",
    sent_to_client: "bg-yellow-100 text-yellow-700",
    deal:           "bg-emerald-100 text-emerald-700",
    cancelled:      "bg-slate-100 text-slate-400",
};
const STATUS_LABEL: Record<string, string> = {
    draft: "Draft", pending: "Menunggu", approved: "Disetujui",
    rejected: "Ditolak", sent_to_client: "Dikirim", deal: "Deal", cancelled: "Batal",
};

function WarrantyBadge({ warranty }: { warranty: WarrantyInfo | null }) {
    if (!warranty) return null;
    const isExpiring = warranty.daysRemaining <= 90;
    const color = !warranty.isActive
        ? "bg-slate-100 border-slate-200 text-slate-400"
        : isExpiring
        ? "bg-amber-50 border-amber-200 text-amber-700"
        : "bg-emerald-50 border-emerald-200 text-emerald-700";
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${color}`}>
            {warranty.isActive ? <Shield size={10} /> : <Clock size={10} />}
            {warranty.isActive ? `Garansi aktif · ${warranty.daysRemaining}h lagi` : "Garansi habis"}
        </span>
    );
}

function ChecklistModal({ customer, onClose, onSaved }: {
    customer: DerivedCustomer;
    onClose: () => void;
    onSaved: (c: ControlChecklist) => void;
}) {
    const { user } = useAuthStore();
    const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
    const [catatan, setCatatan] = useState("");
    const [hasil,   setHasil]   = useState<ControlChecklist["hasilKontrol"]>("baik");
    const [saving,  setSaving]  = useState(false);

    const opts = [
        { val: "baik" as const,                label: "✓ Baik",               cls: "bg-emerald-50 border-emerald-300 text-emerald-700" },
        { val: "perlu_tindak_lanjut" as const, label: "⚠ Perlu Tindak Lanjut", cls: "bg-amber-50 border-amber-300 text-amber-700" },
        { val: "darurat" as const,             label: "🚨 Darurat",            cls: "bg-red-50 border-red-300 text-red-700" },
    ];

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            const id = `${customer.id}_${Date.now()}`;
            const entry: ControlChecklist = { id, tanggal: new Date(tanggal), teknisi: user.name, catatan, hasilKontrol: hasil };
            await setDoc(doc(db, "customerChecklists", id), {
                customerId: customer.id, customerName: customer.name, companyId: user.companyId,
                tanggal: Timestamp.fromDate(entry.tanggal), teknisi: entry.teknisi,
                catatan: entry.catatan, hasilKontrol: entry.hasilKontrol,
                createdAt: Timestamp.fromDate(new Date()),
            });
            onSaved(entry);
            onClose();
        } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                    <ClipboardCheck size={18} className="text-blue-600" />
                    <h3 className="font-bold text-slate-900">Tambah Kontrol Berkala</h3>
                    <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600"><X size={16} /></button>
                </div>
                <p className="text-xs text-slate-500">Pelanggan: <strong>{customer.name}</strong></p>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Tanggal Kontrol</label>
                        <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Hasil Kontrol</label>
                        <div className="grid grid-cols-3 gap-2">
                            {opts.map(o => (
                                <button key={o.val} type="button" onClick={() => setHasil(o.val)}
                                    className={`px-2 py-2 text-xs font-semibold border rounded-xl transition-all ${hasil === o.val ? o.cls + " ring-2 ring-offset-1" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                                    {o.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Catatan</label>
                        <textarea rows={3} value={catatan} onChange={e => setCatatan(e.target.value)}
                            placeholder="Kondisi lapangan, temuan, tindakan..."
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
                    </div>
                </div>
                <div className="flex gap-2 pt-1">
                    <button onClick={onClose} className="flex-1 py-2.5 text-sm rounded-xl bg-slate-100 text-slate-600 font-medium hover:bg-slate-200">Batal</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 py-2.5 text-sm rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <CalendarCheck size={14} />}
                        Simpan
                    </button>
                </div>
            </div>
        </div>
    );
}

function CustomerCard({ customer, expanded, onToggle, onAddChecklist }: {
    customer: DerivedCustomer;
    expanded: boolean;
    onToggle: () => void;
    onAddChecklist: () => void;
}) {
    const lastChecklist = [...customer.checklists].sort((a, b) => b.tanggal.getTime() - a.tanggal.getTime())[0];
    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <button onClick={onToggle} className="w-full px-5 py-4 flex items-start gap-4 text-left hover:bg-slate-50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                    {customer.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-sm font-bold text-slate-900">{customer.name}</p>
                        <WarrantyBadge warranty={customer.activeWarranty} />
                    </div>
                    {customer.address && (
                        <p className="text-xs text-slate-400 truncate flex items-center gap-1"><MapPin size={10} /> {customer.address}</p>
                    )}
                    {customer.wa && (
                        <a href={`https://wa.me/${customer.wa.replace(/^0/, "62").replace(/\D/g, "")}`}
                            target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-green-600 hover:text-green-700 font-medium">
                            <MessageCircle size={10} /> {customer.wa}
                        </a>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-xs text-slate-500 flex items-center gap-1"><FileText size={11} /> {customer.quotations.length} quotation</span>
                        {customer.totalDeal > 0 && (
                            <span className="text-xs text-emerald-600 flex items-center gap-1 font-semibold"><CheckCircle2 size={11} /> {customer.totalDeal} deal</span>
                        )}
                        {customer.totalRevenue > 0 && (
                            <span className="text-xs font-semibold text-blue-600 flex items-center gap-1"><TrendingUp size={11} /> {formatRupiah(customer.totalRevenue)}</span>
                        )}
                        {lastChecklist && (
                            <span className={`text-xs flex items-center gap-1 ${lastChecklist.hasilKontrol === "baik" ? "text-emerald-600" : lastChecklist.hasilKontrol === "darurat" ? "text-red-600" : "text-amber-600"}`}>
                                <ClipboardCheck size={11} /> Kontrol: {formatDate(lastChecklist.tanggal)}
                            </span>
                        )}
                    </div>
                </div>
                <div className="shrink-0 text-slate-400 mt-1">{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
            </button>

            {expanded && (
                <div className="border-t border-slate-100">
                    {customer.warranties.length > 0 && (
                        <div className="px-5 py-3 bg-purple-50 border-b border-purple-100">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-purple-500 mb-2 flex items-center gap-1"><Shield size={10} /> Status Garansi</p>
                            <div className="space-y-2">
                                {customer.warranties.map(w => (
                                    <div key={w.quotationId} className={`flex items-center justify-between p-2.5 rounded-xl text-xs border ${w.isActive ? "bg-white border-purple-200" : "bg-slate-50 border-slate-200 opacity-60"}`}>
                                        <div>
                                            <code className="font-mono font-bold text-purple-700">{w.noSurat}</code>
                                            <p className="text-slate-500 mt-0.5">{w.jenisGaransi ?? "Anti Rayap"} · {w.garansiTahun} tahun</p>
                                            <p className="text-slate-400">{formatDate(w.dealAt)} — {formatDate(w.expiredAt)}</p>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            {w.isActive ? <span className="text-emerald-600 font-bold">{w.daysRemaining}h lagi</span> : <span className="text-slate-400">Kadaluarsa</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="px-5 py-3 border-b border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1"><ClipboardCheck size={10} /> Riwayat Kontrol Berkala</p>
                            <button onClick={e => { e.stopPropagation(); onAddChecklist(); }}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200">
                                + Tambah Kontrol
                            </button>
                        </div>
                        {customer.checklists.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-1">Belum ada riwayat kontrol.</p>
                        ) : (
                            <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                {[...customer.checklists].sort((a, b) => b.tanggal.getTime() - a.tanggal.getTime()).map(c => (
                                    <div key={c.id} className={`flex items-start gap-2.5 p-2 rounded-xl text-xs border ${c.hasilKontrol === "baik" ? "bg-emerald-50 border-emerald-100" : c.hasilKontrol === "darurat" ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"}`}>
                                        <div className="shrink-0 mt-0.5">
                                            {c.hasilKontrol === "baik" ? <CheckCircle2 size={13} className="text-emerald-600" /> : c.hasilKontrol === "darurat" ? <AlertTriangle size={13} className="text-red-600" /> : <Clock size={13} className="text-amber-600" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-slate-700">{formatDate(c.tanggal)}</span>
                                                <span className="text-slate-400 text-[10px]">{c.teknisi}</span>
                                            </div>
                                            {c.catatan && <p className="text-slate-500 mt-0.5 truncate">{c.catatan}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <p className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50">Riwayat Quotation</p>
                    <div className="divide-y divide-slate-50">
                        {[...customer.quotations].sort((a, b) => b.tanggal.getTime() - a.tanggal.getTime()).map(q => (
                            <div key={q.id} className="px-5 py-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <code className={`text-xs font-bold font-mono ${q.kategori === "AR" ? "text-purple-700" : "text-cyan-700"}`}>{q.noSurat}</code>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {LAYANAN_CONFIG[q.jenisLayanan]?.label.split("—")[1]?.trim() ?? q.jenisLayanan}
                                        {" · "}{formatDate(q.tanggal)}
                                        {q.garansiTahun ? ` · Garansi ${q.garansiTahun}thn` : ""}
                                    </p>
                                    {q.marketingNama && <p className="text-xs text-slate-400">by {q.marketingNama}</p>}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs font-mono text-slate-600 hidden sm:block">{formatRupiah(q.total)}</span>
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[q.status] ?? "bg-slate-100 text-slate-500"}`}>
                                        {STATUS_LABEL[q.status] ?? q.status}
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

export function CustomersPage() {
    const { user } = useAuthStore();
    const [quotations,       setQuotations]       = useState<Quotation[]>([]);
    const [checklists,       setChecklists]       = useState<(ControlChecklist & { customerId: string })[]>([]);
    const [loading,          setLoading]          = useState(true);
    const [searchQ,          setSearchQ]          = useState("");
    const [expandedId,       setExpandedId]       = useState<string | null>(null);
    const [sortBy,           setSortBy]           = useState<"date" | "revenue" | "name">("date");
    const [checklistTarget,  setChecklistTarget]  = useState<DerivedCustomer | null>(null);

    const debouncedSearch = useDebounce(searchQ, 350);
    const canSeeAll = user?.role !== "marketing";

    const load = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [quotesData, checkSnap] = await Promise.all([
                getQuotations({ companyId: user.companyId, byUid: canSeeAll ? undefined : user.uid }),
                getDocs(query(collection(db, "customerChecklists"), where("companyId", "==", user.companyId))),
            ]);
            setQuotations(quotesData);
            setChecklists(checkSnap.docs.map(d => {
                const x = d.data();
                return { id: d.id, customerId: x.customerId as string, tanggal: (x.tanggal as Timestamp).toDate(), teknisi: x.teknisi as string, catatan: x.catatan as string, hasilKontrol: x.hasilKontrol as ControlChecklist["hasilKontrol"] };
            }));
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [user]);

    const customerMap = useMemo(() => {
        const map = new Map<string, DerivedCustomer>();
        const now = new Date();
        quotations.forEach(q => {
            const key = q.kepadaNama.trim().toLowerCase().replace(/\s+/g, "_");
            if (!map.has(key)) {
                map.set(key, { id: key, name: q.kepadaNama, quotations: [], totalDeal: 0, totalRevenue: 0, lastDate: q.tanggal, address: q.kepadaAlamatLines?.[0] ?? "", wa: q.kepadaWa ?? "", warranties: [], activeWarranty: null, checklists: [] });
            }
            const c = map.get(key)!;
            c.quotations.push(q);
            if (q.status === "deal") {
                c.totalDeal++;
                c.totalRevenue += q.total;
                if (q.garansiTahun && q.garansiTahun > 0 && q.dealAt) {
                    const expiredAt = new Date(q.dealAt);
                    expiredAt.setFullYear(expiredAt.getFullYear() + q.garansiTahun);
                    const daysRemaining = Math.ceil((expiredAt.getTime() - now.getTime()) / 86400000);
                    const w: WarrantyInfo = { quotationId: q.id, noSurat: q.noSurat, garansiTahun: q.garansiTahun, jenisGaransi: q.jenisGaransi, dealAt: q.dealAt, expiredAt, isActive: daysRemaining > 0, daysRemaining: Math.max(0, daysRemaining) };
                    c.warranties.push(w);
                    if (w.isActive && (!c.activeWarranty || w.expiredAt > c.activeWarranty.expiredAt)) c.activeWarranty = w;
                }
            }
            if (q.tanggal > c.lastDate) c.lastDate = q.tanggal;
            if (!c.address && q.kepadaAlamatLines?.[0]) c.address = q.kepadaAlamatLines[0];
            if (!c.wa && q.kepadaWa) c.wa = q.kepadaWa;
        });
        checklists.forEach(cl => { const c = map.get(cl.customerId); if (c) c.checklists.push(cl); });
        return map;
    }, [quotations, checklists]);

    let customers = Array.from(customerMap.values());
    if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        customers = customers.filter(c => c.name.toLowerCase().includes(s) || c.address.toLowerCase().includes(s));
    }
    customers.sort((a, b) => sortBy === "name" ? a.name.localeCompare(b.name) : sortBy === "revenue" ? b.totalRevenue - a.totalRevenue : b.lastDate.getTime() - a.lastDate.getTime());

    const totalCustomers     = customerMap.size;
    const withDeal           = Array.from(customerMap.values()).filter(c => c.totalDeal > 0).length;
    const totalRevenue       = Array.from(customerMap.values()).reduce((s, c) => s + c.totalRevenue, 0);
    const activeWarranties   = Array.from(customerMap.values()).filter(c => c.activeWarranty?.isActive).length;
    const expiringWarranties = Array.from(customerMap.values()).filter(c => c.activeWarranty?.isActive && c.activeWarranty.daysRemaining <= 90).length;

    return (
        <div className="p-4 md:p-6 max-w-screen-lg mx-auto space-y-5">
            <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Users size={20} className="text-blue-600" /> Pelanggan</h1>
                <p className="text-sm text-slate-500 mt-0.5">{canSeeAll ? "Semua klien dari quotation perusahaan" : "Klien dari quotation kamu"}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                    <p className="text-2xl font-bold text-slate-800">{totalCustomers}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Total Klien</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                    <p className="text-2xl font-bold text-emerald-700">{withDeal}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Ada Deal</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <p className="text-sm font-bold text-blue-700 truncate">{formatRupiah(totalRevenue)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Total Revenue</p>
                </div>
                <div className={`border rounded-xl p-3 ${expiringWarranties > 0 ? "bg-amber-50 border-amber-100" : "bg-purple-50 border-purple-100"}`}>
                    <p className={`text-2xl font-bold ${expiringWarranties > 0 ? "text-amber-700" : "text-purple-700"}`}>{activeWarranties}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Garansi Aktif{expiringWarranties > 0 ? ` · ${expiringWarranties} segera habis` : ""}</p>
                </div>
            </div>
            {expiringWarranties > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-amber-800">Garansi akan segera habis</p>
                        <p className="text-xs text-amber-700 mt-0.5">{expiringWarranties} pelanggan memiliki garansi yang akan habis dalam 90 hari.</p>
                    </div>
                </div>
            )}
            <div className="flex gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-0 bg-white border border-slate-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-100">
                    <Search size={14} className="text-slate-400 shrink-0" />
                    <input className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder:text-slate-400 min-w-0" placeholder="Cari nama atau alamat klien..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
                    {searchQ && <button onClick={() => setSearchQ("")} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={13} /></button>}
                </div>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-600 focus:outline-none shrink-0">
                    <option value="date">Terbaru</option>
                    <option value="revenue">Revenue</option>
                    <option value="name">Nama A-Z</option>
                </select>
                <button onClick={load} disabled={loading} className="p-2 border border-slate-200 bg-white text-slate-500 rounded-xl hover:bg-slate-50 shrink-0">
                    <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                </button>
            </div>
            {loading ? (
                <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 size={24} className="animate-spin mr-2" /> Memuat data...</div>
            ) : customers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-center">
                    <Users size={36} className="mb-3 opacity-20" />
                    <p className="font-medium text-slate-500">{debouncedSearch ? "Klien tidak ditemukan" : "Belum ada data klien"}</p>
                    <p className="text-sm mt-1">{debouncedSearch ? "Coba ubah kata kunci." : "Data muncul otomatis dari quotation."}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {customers.map(c => (
                        <CustomerCard key={c.id} customer={c} expanded={expandedId === c.id}
                            onToggle={() => setExpandedId(prev => prev === c.id ? null : c.id)}
                            onAddChecklist={() => setChecklistTarget(c)} />
                    ))}
                    <p className="text-xs text-slate-400 text-center pt-1">{customers.length} dari {totalCustomers} klien</p>
                </div>
            )}
            {checklistTarget && (
                <ChecklistModal customer={checklistTarget} onClose={() => setChecklistTarget(null)}
                    onSaved={entry => { setChecklists(prev => [...prev, { ...entry, customerId: checklistTarget.id }]); setChecklistTarget(null); }} />
            )}
        </div>
    );
}