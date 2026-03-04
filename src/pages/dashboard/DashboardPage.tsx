import { useState, useEffect, useMemo } from "react";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { formatRupiah, ROLE_LABELS } from "../../lib/utils";
import {
    FileText, DollarSign, CheckCircle2, AlertCircle,
    ChevronRight, Loader2, Users, Clock,
    BarChart3, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { AppUser } from "../../types";

interface DashboardData {
    totalQuotations: number;
    pendingQuotations: number;
    approvedQuotations: number;
    rejectedQuotations: number;
    revenueApproved: number;
    revenuePending: number;
    recentQuotations: RecentQuo[];
    quotationsByMonth: MonthStat[];
    myQuotations: number;
    totalUsers: number;
    activeUsers: number;
    feed: FeedItem[];
}
interface RecentQuo {
    id: string; noSurat: string; kepadaNama: string; perihal: string;
    total: number; status: string; createdAt: Date; marketingNama: string;
}
interface MonthStat { label: string; count: number; revenue: number; }
interface FeedItem { id: string; type: string; title: string; subtitle: string; time: Date; color: string; icon: string; }

const STATUS_COLOR: Record<string, string> = {
    draft: "bg-slate-100 text-slate-600", pending: "bg-amber-100 text-amber-700",
    approved: "bg-emerald-100 text-emerald-700", rejected: "bg-red-100 text-red-600",
};
const STATUS_LABEL: Record<string, string> = {
    draft: "Draft", pending: "Pending", approved: "Approved", rejected: "Ditolak",
};
const MONTHS_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agt","Sep","Okt","Nov","Des"];

function timeAgo(date: Date): string {
    const diff = Date.now() - date.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "baru saja";
    if (m < 60) return `${m} mnt lalu`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} jam lalu`;
    return `${Math.floor(h / 24)} hari lalu`;
}

async function fetchDashboardData(companyId: string, user: AppUser): Promise<DashboardData> {
    const isMarketing = user.role === "marketing";
    const isAdmin = user.role === "administrator";
    const now = new Date();
    const start6Mo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const quoConstraints: Parameters<typeof query>[1][] = [where("companyId", "==", companyId)];
    if (isMarketing) quoConstraints.push(where("marketingUid", "==", user.uid));

    const [quoSnap, userSnap] = await Promise.all([
        getDocs(query(collection(db, "quotations"), ...quoConstraints)),
        isAdmin ? getDocs(query(collection(db, "users"), where("companyId", "==", companyId))) : Promise.resolve(null),
    ]);

    const quoDocs = quoSnap.docs;
    const pendingQ = quoDocs.filter(d => d.data().status === "pending");
    const approvedQ = quoDocs.filter(d => d.data().status === "approved");
    const rejectedQ = quoDocs.filter(d => d.data().status === "rejected");
    const revenueApproved = approvedQ.reduce((s, d) => s + ((d.data().total as number) ?? 0), 0);
    const revenuePending = pendingQ.reduce((s, d) => s + ((d.data().total as number) ?? 0), 0);

    const recentQuotations: RecentQuo[] = quoDocs
        .map(d => { const x = d.data(); return { id: d.id, noSurat: x.noSurat as string, kepadaNama: x.kepadaNama as string, perihal: x.perihal as string, total: (x.total as number) ?? 0, status: x.status as string, createdAt: (x.createdAt as Timestamp).toDate(), marketingNama: x.marketingNama as string }; })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5);

    const monthMap: Record<string, MonthStat> = {};
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthMap[`${d.getFullYear()}-${d.getMonth()}`] = { label: MONTHS_ID[d.getMonth()], count: 0, revenue: 0 };
    }
    quoDocs.forEach(d => {
        const x = d.data(); const date = (x.createdAt as Timestamp).toDate();
        if (date < start6Mo) return;
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        if (monthMap[key]) { monthMap[key].count++; if (x.status === "approved") monthMap[key].revenue += (x.total as number) ?? 0; }
    });

    const feed: FeedItem[] = [];
    quoDocs.slice(0, 15).forEach(d => {
        const x = d.data();
        feed.push({ id: `qc-${d.id}`, type: "quotation_created", title: `Quotation dibuat — ${x.noSurat}`, subtitle: `${x.kepadaNama} · ${x.marketingNama}`, time: (x.createdAt as Timestamp).toDate(), color: "bg-blue-100 text-blue-600", icon: "📄" });
        if (x.status === "approved" && x.approvedAt) feed.push({ id: `qa-${d.id}`, type: "quotation_approved", title: `Quotation disetujui — ${x.noSurat}`, subtitle: formatRupiah(x.total as number), time: (x.approvedAt as Timestamp).toDate(), color: "bg-emerald-100 text-emerald-600", icon: "✅" });
        if (x.status === "rejected" && x.approvedAt) feed.push({ id: `qr-${d.id}`, type: "quotation_rejected", title: `Quotation ditolak — ${x.noSurat}`, subtitle: (x.rejectionReason as string) ?? "", time: (x.approvedAt as Timestamp).toDate(), color: "bg-red-100 text-red-600", icon: "❌" });
    });
    feed.sort((a, b) => b.time.getTime() - a.time.getTime());

    const userDocs = userSnap?.docs ?? [];
    return {
        totalQuotations: quoDocs.length, pendingQuotations: pendingQ.length,
        approvedQuotations: approvedQ.length, rejectedQuotations: rejectedQ.length,
        revenueApproved, revenuePending, recentQuotations,
        quotationsByMonth: Object.values(monthMap),
        myQuotations: isMarketing ? quoDocs.length : 0,
        totalUsers: userDocs.length, activeUsers: userDocs.filter(d => d.data().isActive).length,
        feed: feed.slice(0, 12),
    };
}

function StatCard({ icon, label, value, sub, color, trend }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string; trend?: "up"|"down"|"neutral"; }) {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>{icon}</div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-0.5">{label}</p>
                <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
                {sub && <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    {trend === "up" && <ArrowUpRight size={11} className="text-emerald-500" />}
                    {trend === "down" && <ArrowDownRight size={11} className="text-red-400" />}
                    {trend === "neutral" && <Minus size={11} className="text-slate-400" />}
                    {sub}
                </p>}
            </div>
        </div>
    );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{children}</h2>;
}

function BarChart({ data }: { data: MonthStat[] }) {
    const maxCount = Math.max(...data.map(d => d.count), 1);
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div><p className="text-sm font-bold text-slate-800">Quotation per Bulan</p><p className="text-xs text-slate-400 mt-0.5">6 bulan terakhir</p></div>
                <BarChart3 size={16} className="text-slate-300" />
            </div>
            <div className="flex items-end gap-2 h-28">
                {data.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-500">{d.count > 0 ? d.count : ""}</span>
                        <div className="w-full rounded-t-md bg-blue-500 transition-all duration-500"
                            style={{ height: `${Math.max((d.count / maxCount) * 88, d.count > 0 ? 6 : 2)}px`, opacity: d.count > 0 ? 1 : 0.15 }} />
                        <span className="text-[10px] text-slate-400">{d.label}</span>
                    </div>
                ))}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-1.5">Revenue approved</p>
                <div className="flex gap-2">
                    {data.map((d, i) => (
                        <div key={i} className="flex-1 text-center">
                            <p className="text-[9px] text-slate-500 font-medium truncate">
                                {d.revenue > 0 ? (d.revenue >= 1_000_000 ? `${(d.revenue/1_000_000).toFixed(0)}jt` : `${(d.revenue/1_000).toFixed(0)}k`) : "—"}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function QuoRow({ q }: { q: RecentQuo }) {
    const navigate = useNavigate();
    return (
        <div onClick={() => navigate("/quotations")} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 px-1 rounded-lg transition-colors group">
            <div className="min-w-0 flex-1">
                <p className="text-xs font-mono text-slate-400">{q.noSurat}</p>
                <p className="text-sm font-semibold text-slate-900 truncate">{q.kepadaNama}</p>
                <p className="text-xs text-slate-500 truncate">{q.perihal}</p>
            </div>
            <div className="flex-shrink-0 text-right">
                <p className="text-sm font-bold text-slate-800">{formatRupiah(q.total)}</p>
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold mt-0.5 ${STATUS_COLOR[q.status]}`}>{STATUS_LABEL[q.status]}</span>
            </div>
            <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-400 flex-shrink-0 transition-colors" />
        </div>
    );
}

function FeedRow({ item }: { item: FeedItem }) {
    return (
        <div className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-sm ${item.color}`}>{item.icon}</div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 leading-snug">{item.title}</p>
                {item.subtitle && <p className="text-xs text-slate-500 truncate mt-0.5">{item.subtitle}</p>}
            </div>
            <span className="text-xs text-slate-400 flex-shrink-0 whitespace-nowrap mt-0.5">{timeAgo(item.time)}</span>
        </div>
    );
}

function StatusBreakdown({ data }: { data: DashboardData }) {
    const draft = data.totalQuotations - data.pendingQuotations - data.approvedQuotations - data.rejectedQuotations;
    const items = [
        { label: "Draft", count: draft, color: "bg-slate-300" },
        { label: "Pending", count: data.pendingQuotations, color: "bg-amber-400" },
        { label: "Approved", count: data.approvedQuotations, color: "bg-emerald-500" },
        { label: "Rejected", count: data.rejectedQuotations, color: "bg-red-400" },
    ];
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <SectionTitle>Status Quotation</SectionTitle>
            <div className="space-y-3">
                {items.map(s => (
                    <div key={s.label} className="flex items-center gap-3">
                        <span className="text-sm text-slate-600 w-16">{s.label}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                            <div className={`h-2 rounded-full ${s.color} transition-all duration-700`}
                                style={{ width: `${data.totalQuotations > 0 ? (s.count / data.totalQuotations) * 100 : 0}%` }} />
                        </div>
                        <span className="text-sm font-bold text-slate-700 w-5 text-right">{s.count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function DashboardSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-2xl" />)}</div>
            <div className="grid grid-cols-3 gap-5"><div className="col-span-2 h-52 bg-slate-100 rounded-2xl" /><div className="h-52 bg-slate-100 rounded-2xl" /></div>
            <div className="grid grid-cols-2 gap-5"><div className="h-48 bg-slate-100 rounded-2xl" /><div className="h-48 bg-slate-100 rounded-2xl" /></div>
        </div>
    );
}

function AdminDashboard({ data }: { data: DashboardData }) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<FileText size={20} />} label="Total Quotation" value={data.totalQuotations} sub={`${data.pendingQuotations} pending approval`} color="bg-blue-100 text-blue-600" trend="neutral" />
                <StatCard icon={<DollarSign size={20} />} label="Revenue Approved" value={formatRupiah(data.revenueApproved)} sub={`+${formatRupiah(data.revenuePending)} pending`} color="bg-emerald-100 text-emerald-600" trend="up" />
                <StatCard icon={<CheckCircle2 size={20} />} label="Approved" value={data.approvedQuotations} sub="quotation disetujui" color="bg-violet-100 text-violet-600" trend="up" />
                <StatCard icon={<Users size={20} />} label="Anggota Tim" value={data.activeUsers} sub={`dari ${data.totalUsers} terdaftar`} color="bg-amber-100 text-amber-600" trend="neutral" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2"><BarChart data={data.quotationsByMonth} /></div>
                <StatusBreakdown data={data} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <SectionTitle>Quotation Terbaru</SectionTitle>
                        {data.pendingQuotations > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{data.pendingQuotations} pending</span>}
                    </div>
                    {data.recentQuotations.length === 0 ? <p className="text-sm text-slate-400 py-4 text-center">Belum ada quotation.</p> : data.recentQuotations.map(q => <QuoRow key={q.id} q={q} />)}
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <SectionTitle>Aktivitas Terbaru</SectionTitle>
                    {data.feed.length === 0 ? <p className="text-sm text-slate-400 py-4 text-center">Belum ada aktivitas.</p> : data.feed.map(item => <FeedRow key={item.id} item={item} />)}
                </div>
            </div>
        </div>
    );
}

function AdminOpsDashboard({ data }: { data: DashboardData }) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<FileText size={20} />} label="Total Quotation" value={data.totalQuotations} sub={`${data.pendingQuotations} pending`} color="bg-blue-100 text-blue-600" trend="neutral" />
                <StatCard icon={<DollarSign size={20} />} label="Revenue Approved" value={formatRupiah(data.revenueApproved)} sub="dari quotation disetujui" color="bg-emerald-100 text-emerald-600" trend="up" />
                <StatCard icon={<CheckCircle2 size={20} />} label="Approved" value={data.approvedQuotations} sub="quotation disetujui" color="bg-violet-100 text-violet-600" trend="up" />
                <StatCard icon={<AlertCircle size={20} />} label="Pending Approval" value={data.pendingQuotations} sub="menunggu keputusan" color="bg-amber-100 text-amber-600" trend="neutral" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2"><BarChart data={data.quotationsByMonth} /></div>
                <StatusBreakdown data={data} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <SectionTitle>Quotation Pending Approval</SectionTitle>
                    {data.recentQuotations.filter(q => q.status === "pending").length === 0 ? <p className="text-sm text-slate-400 py-4 text-center">Tidak ada quotation pending.</p> : data.recentQuotations.filter(q => q.status === "pending").map(q => <QuoRow key={q.id} q={q} />)}
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <SectionTitle>Aktivitas Terbaru</SectionTitle>
                    {data.feed.map(item => <FeedRow key={item.id} item={item} />)}
                </div>
            </div>
        </div>
    );
}

function MarketingDashboard({ data }: { data: DashboardData }) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<FileText size={20} />} label="Quotation Saya" value={data.myQuotations} sub="total yang kamu buat" color="bg-blue-100 text-blue-600" trend="neutral" />
                <StatCard icon={<Clock size={20} />} label="Pending Review" value={data.pendingQuotations} sub="menunggu approval" color="bg-amber-100 text-amber-600" trend="neutral" />
                <StatCard icon={<CheckCircle2 size={20} />} label="Disetujui" value={data.approvedQuotations} sub="quotation approved" color="bg-emerald-100 text-emerald-600" trend="up" />
                <StatCard icon={<DollarSign size={20} />} label="Revenue Saya" value={formatRupiah(data.revenueApproved)} sub="dari quotation approved" color="bg-violet-100 text-violet-600" trend="up" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2"><BarChart data={data.quotationsByMonth} /></div>
                <StatusBreakdown data={data} />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <SectionTitle>Quotation Terbaru</SectionTitle>
                {data.recentQuotations.length === 0 ? <p className="text-sm text-slate-400 py-4 text-center">Belum ada quotation.</p> : data.recentQuotations.map(q => <QuoRow key={q.id} q={q} />)}
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <SectionTitle>Aktivitas Terbaru</SectionTitle>
                {data.feed.filter(f => f.type.startsWith("quotation")).map(item => <FeedRow key={item.id} item={item} />)}
            </div>
        </div>
    );
}

export function DashboardPage() {
    const { user } = useAuthStore();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const greeting = useMemo(() => {
        const h = new Date().getHours();
        if (h < 11) return "Selamat pagi";
        if (h < 15) return "Selamat siang";
        if (h < 18) return "Selamat sore";
        return "Selamat malam";
    }, []);

    useEffect(() => {
        if (!user?.companyId) {
            setLoading(false);
            return;
        }
        setError(null);
        fetchDashboardData(user.companyId, user)
            .then(setData)
            .catch((err) => {
                console.error("[Dashboard] fetch error:", err);
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.includes("permission-denied")) {
                    setError("Akses ditolak Firestore. Pastikan Firestore Rules sudah di-deploy.");
                } else {
                    setError(`Gagal memuat dashboard: ${msg}`);
                }
            })
            .finally(() => setLoading(false));
    }, [user]);

    return (
        <div className="p-6 max-w-screen-xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">{greeting}, {user?.name?.split(" ")[0]} 👋</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                    Kamu masuk sebagai <span className="font-semibold text-blue-600">{user ? ROLE_LABELS[user.role] : ""}</span>
                    {" · "}{new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </p>
            </div>

            {loading && <DashboardSkeleton />}

            {!loading && error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3">
                    <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-red-700">Gagal memuat data</p>
                        <p className="text-xs text-red-600 mt-1">{error}</p>
                        <button
                            onClick={() => { setLoading(true); setError(null); fetchDashboardData(user!.companyId, user!).then(setData).catch(e => setError(e.message)).finally(() => setLoading(false)); }}
                            className="mt-2 text-xs font-semibold text-red-700 underline hover:no-underline"
                        >
                            Coba lagi
                        </button>
                    </div>
                </div>
            )}

            {!loading && !error && !data && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800 space-y-1">
                    <p className="font-semibold">⚠️ Data tidak termuat — debug info:</p>
                    <p>UID: <code className="font-mono text-xs bg-amber-100 px-1">{user?.uid ?? "—"}</code></p>
                    <p>Company ID: <code className="font-mono text-xs bg-amber-100 px-1">{user?.companyId ?? "KOSONG ← ini masalahnya"}</code></p>
                    <p>Role: <code className="font-mono text-xs bg-amber-100 px-1">{user?.role ?? "—"}</code></p>
                    <p className="text-xs text-amber-600 mt-2">Buka F12 → Console untuk error detail.</p>
                </div>
            )}
            {!loading && !error && data && user?.role === "administrator" && <AdminDashboard data={data} />}
            {!loading && !error && data && user?.role === "admin_ops"     && <AdminOpsDashboard data={data} />}
            {!loading && !error && data && user?.role === "marketing"     && <MarketingDashboard data={data} />}
            {!loading && !error && data && user?.role === "teknisi"       && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 max-w-md">
                    <p className="text-blue-800 text-sm font-medium">👋 Halo {user.name?.split(" ")[0]}!</p>
                    <p className="text-blue-600 text-sm mt-1">Gunakan menu Profil Saya untuk mengelola akun kamu.</p>
                </div>
            )}
        </div>
    );
}