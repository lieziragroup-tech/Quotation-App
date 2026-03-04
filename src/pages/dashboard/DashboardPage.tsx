import { useState, useEffect, useMemo } from "react";
import {
    collection, query, where, getDocs, orderBy, limit, Timestamp,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { formatRupiah, formatDate, ROLE_LABELS } from "../../lib/utils";
import {
    FileText, DollarSign, ClipboardList,
    Clock, CheckCircle2, PlayCircle, AlertCircle,
    CalendarDays, ChevronRight, Loader2, Users,
    BarChart3, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { AppUser } from "../../types";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface DashboardData {
    // Quotations
    totalQuotations: number;
    pendingQuotations: number;
    approvedQuotations: number;
    rejectedQuotations: number;
    revenueApproved: number;
    revenuePending: number;
    recentQuotations: RecentQuo[];
    quotationsByMonth: MonthStat[];
    myQuotations: number;        // khusus marketing: quotation miliknya

    // SPK
    totalSPK: number;
    spkAssigned: number;
    spkInProgress: number;
    spkDone: number;
    spkToday: SPKToday[];
    spkUpcoming: SPKToday[];

    // Team
    totalUsers: number;
    activeUsers: number;

    // Activity feed
    feed: FeedItem[];
}

interface RecentQuo {
    id: string;
    noSurat: string;
    kepadaNama: string;
    perihal: string;
    total: number;
    status: string;
    createdAt: Date;
    marketingNama: string;
}

interface SPKToday {
    id: string;
    quotationNoSurat: string;
    customerName: string;
    perihal: string;
    technicianName: string;
    scheduleDate: Date;
    status: string;
    lokasi: string;
}

interface MonthStat {
    label: string;   // "Jan", "Feb", ...
    count: number;
    revenue: number;
}

interface FeedItem {
    id: string;
    type: "quotation_created" | "quotation_approved" | "quotation_rejected" | "spk_created" | "spk_done";
    title: string;
    subtitle: string;
    time: Date;
    color: string;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
    draft:      "bg-slate-100 text-slate-600",
    pending:    "bg-amber-100 text-amber-700",
    approved:   "bg-emerald-100 text-emerald-700",
    rejected:   "bg-red-100 text-red-600",
    assigned:   "bg-blue-100 text-blue-700",
    in_progress:"bg-amber-100 text-amber-700",
    done:       "bg-emerald-100 text-emerald-700",
};

const STATUS_LABEL: Record<string, string> = {
    draft: "Draft", pending: "Pending", approved: "Approved", rejected: "Rejected",
    assigned: "Assigned", in_progress: "In Progress", done: "Selesai",
};

const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agt","Sep","Okt","Nov","Des"];

function timeAgo(date: Date): string {
    const diff = Date.now() - date.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "baru saja";
    if (m < 60) return `${m} menit lalu`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} jam lalu`;
    const d = Math.floor(h / 24);
    return `${d} hari lalu`;
}

function isToday(d: Date): boolean {
    const now = new Date();
    return d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
}

function isFuture(d: Date): boolean {
    return d > new Date() && !isToday(d);
}

// ─── DATA FETCHER ─────────────────────────────────────────────────────────────

async function fetchDashboardData(companyId: string, user: AppUser): Promise<DashboardData> {
    const isMarketing = user.role === "marketing";
    const isTeknisi   = user.role === "teknisi";
    const isAdmin     = user.role === "administrator";

    const now = new Date();
    const startOf6Months = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // Build quotation query
    const quoConstraints: Parameters<typeof query>[1][] = [
        where("companyId", "==", companyId),
    ];
    if (isMarketing) quoConstraints.push(where("marketingUid", "==", user.uid));

    const [quoSnap, spkSnap, userSnap] = await Promise.all([
        isTeknisi ? Promise.resolve(null) : getDocs(query(collection(db, "quotations"), ...quoConstraints)),
        getDocs(query(collection(db, "spk"), where("companyId", "==", companyId))),
        isAdmin ? getDocs(query(collection(db, "users"), where("companyId", "==", companyId))) : Promise.resolve(null),
    ]);

    // ── Quotations ────────────────────────────────────────────────────────────
    const quoDocs = quoSnap?.docs ?? [];

    const pendingQ  = quoDocs.filter(d => d.data().status === "pending");
    const approvedQ = quoDocs.filter(d => d.data().status === "approved");
    const rejectedQ = quoDocs.filter(d => d.data().status === "rejected");

    const revenueApproved = approvedQ.reduce((s, d) => s + ((d.data().total as number) ?? 0), 0);
    const revenuePending  = pendingQ.reduce((s, d)  => s + ((d.data().total as number) ?? 0), 0);

    // Recent quotations (last 5)
    const recentQuotations: RecentQuo[] = quoDocs
        .map(d => {
            const x = d.data();
            return {
                id: d.id,
                noSurat: x.noSurat as string,
                kepadaNama: x.kepadaNama as string,
                perihal: x.perihal as string,
                total: (x.total as number) ?? 0,
                status: x.status as string,
                createdAt: (x.createdAt as Timestamp).toDate(),
                marketingNama: x.marketingNama as string,
            };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5);

    // Monthly stats (last 6 months)
    const monthMap: Record<string, MonthStat> = {};
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        monthMap[key] = { label: MONTHS[d.getMonth()], count: 0, revenue: 0 };
    }
    quoDocs.forEach(d => {
        const x = d.data();
        const date = (x.createdAt as Timestamp).toDate();
        if (date < startOf6Months) return;
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        if (monthMap[key]) {
            monthMap[key].count++;
            if (x.status === "approved") monthMap[key].revenue += (x.total as number) ?? 0;
        }
    });
    const quotationsByMonth = Object.values(monthMap);

    // My quotations (marketing)
    const myQuotations = isMarketing
        ? quoDocs.filter(d => d.data().marketingUid === user.uid).length
        : 0;

    // ── SPK ───────────────────────────────────────────────────────────────────
    const spkDocs = spkSnap.docs;

    const spkData: SPKToday[] = spkDocs.map(d => {
        const x = d.data();
        return {
            id: d.id,
            quotationNoSurat: (x.quotationNoSurat as string) ?? "",
            customerName: x.customerName as string,
            perihal: (x.perihal as string) ?? "",
            technicianName: x.technicianName as string,
            scheduleDate: (x.scheduleDate as Timestamp).toDate(),
            status: x.status as string,
            lokasi: (x.lokasi as string) ?? "",
        };
    });

    const spkToday    = spkData.filter(s => isToday(s.scheduleDate) && s.status !== "done");
    const spkUpcoming = spkData
        .filter(s => isFuture(s.scheduleDate) && s.status !== "done")
        .sort((a, b) => a.scheduleDate.getTime() - b.scheduleDate.getTime())
        .slice(0, 5);

    // ── Users ─────────────────────────────────────────────────────────────────
    const userDocs  = userSnap?.docs ?? [];
    const totalUsers  = userDocs.length;
    const activeUsers = userDocs.filter(d => d.data().isActive).length;

    // ── Activity Feed ─────────────────────────────────────────────────────────
    const feed: FeedItem[] = [];

    quoDocs.slice(0, 20).forEach(d => {
        const x = d.data();
        const date = (x.createdAt as Timestamp).toDate();
        feed.push({
            id: `q-created-${d.id}`,
            type: "quotation_created",
            title: `Quotation dibuat — ${x.noSurat}`,
            subtitle: `${x.kepadaNama} · ${x.marketingNama}`,
            time: date,
            color: "bg-blue-100 text-blue-600",
        });
        if (x.status === "approved" && x.approvedAt) {
            feed.push({
                id: `q-approved-${d.id}`,
                type: "quotation_approved",
                title: `Quotation disetujui — ${x.noSurat}`,
                subtitle: formatRupiah(x.total as number),
                time: (x.approvedAt as Timestamp).toDate(),
                color: "bg-emerald-100 text-emerald-600",
            });
        }
        if (x.status === "rejected" && x.approvedAt) {
            feed.push({
                id: `q-rejected-${d.id}`,
                type: "quotation_rejected",
                title: `Quotation ditolak — ${x.noSurat}`,
                subtitle: x.rejectionReason as string ?? "",
                time: (x.approvedAt as Timestamp).toDate(),
                color: "bg-red-100 text-red-600",
            });
        }
    });

    spkDocs.slice(0, 10).forEach(d => {
        const x = d.data();
        feed.push({
            id: `spk-${d.id}`,
            type: "spk_created",
            title: `SPK dibuat — ${x.customerName}`,
            subtitle: `Teknisi: ${x.technicianName}`,
            time: (x.createdAt as Timestamp).toDate(),
            color: "bg-violet-100 text-violet-600",
        });
        if (x.status === "done" && x.actualEnd) {
            feed.push({
                id: `spk-done-${d.id}`,
                type: "spk_done",
                title: `SPK selesai — ${x.customerName}`,
                subtitle: `Teknisi: ${x.technicianName}`,
                time: (x.actualEnd as Timestamp).toDate(),
                color: "bg-emerald-100 text-emerald-600",
            });
        }
    });

    feed.sort((a, b) => b.time.getTime() - a.time.getTime());

    return {
        totalQuotations: quoDocs.length,
        pendingQuotations: pendingQ.length,
        approvedQuotations: approvedQ.length,
        rejectedQuotations: rejectedQ.length,
        revenueApproved,
        revenuePending,
        recentQuotations,
        quotationsByMonth,
        myQuotations,
        totalSPK: spkDocs.length,
        spkAssigned: spkDocs.filter(d => d.data().status === "assigned").length,
        spkInProgress: spkDocs.filter(d => d.data().status === "in_progress").length,
        spkDone: spkDocs.filter(d => d.data().status === "done").length,
        spkToday,
        spkUpcoming,
        totalUsers,
        activeUsers,
        feed: feed.slice(0, 12),
    };
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function StatCard({
    icon, label, value, sub, color, trend,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    sub?: string;
    color: string;
    trend?: "up" | "down" | "neutral";
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-0.5">{label}</p>
                <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
                {sub && (
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        {trend === "up" && <ArrowUpRight size={11} className="text-emerald-500" />}
                        {trend === "down" && <ArrowDownRight size={11} className="text-red-400" />}
                        {trend === "neutral" && <Minus size={11} className="text-slate-400" />}
                        {sub}
                    </p>
                )}
            </div>
        </div>
    );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
            {children}
        </h2>
    );
}

// ── Mini bar chart ────────────────────────────────────────────────────────────

function BarChart({ data }: { data: MonthStat[] }) {
    const maxCount = Math.max(...data.map(d => d.count), 1);
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <p className="text-sm font-bold text-slate-800">Quotation per Bulan</p>
                    <p className="text-xs text-slate-400 mt-0.5">6 bulan terakhir</p>
                </div>
                <BarChart3 size={16} className="text-slate-300" />
            </div>
            <div className="flex items-end gap-2 h-28">
                {data.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-500">{d.count > 0 ? d.count : ""}</span>
                        <div className="w-full rounded-t-md bg-blue-500 transition-all duration-500"
                            style={{ height: `${Math.max((d.count / maxCount) * 88, d.count > 0 ? 6 : 2)}px`, opacity: d.count > 0 ? 1 : 0.15 }}
                        />
                        <span className="text-[10px] text-slate-400">{d.label}</span>
                    </div>
                ))}
            </div>
            {/* Revenue line */}
            <div className="mt-4 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-2">Revenue (approved)</p>
                <div className="flex gap-2">
                    {data.map((d, i) => (
                        <div key={i} className="flex-1 text-center">
                            <p className="text-[9px] text-slate-500 font-medium truncate">
                                {d.revenue > 0 ? (d.revenue >= 1000000 ? `${(d.revenue/1000000).toFixed(0)}jt` : `${(d.revenue/1000).toFixed(0)}k`) : "—"}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── SPK Today card ────────────────────────────────────────────────────────────

function SPKCard({ spk, isToday }: { spk: SPKToday; isToday: boolean }) {
    const navigate = useNavigate();
    return (
        <div
            onClick={() => navigate("/spk")}
            className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-blue-300 hover:bg-blue-50/40 transition-all group"
        >
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                spk.status === "in_progress" ? "bg-amber-400" : "bg-blue-400"
            }`} />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate">{spk.customerName}</p>
                <p className="text-xs text-slate-500 truncate">{spk.perihal}</p>
                <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Users size={10} /> {spk.technicianName}
                    </span>
                    {spk.lokasi && (
                        <span className="text-xs text-slate-400 truncate max-w-[120px]">
                            📍 {spk.lokasi}
                        </span>
                    )}
                </div>
            </div>
            <div className="flex-shrink-0 text-right">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLOR[spk.status]}`}>
                    {spk.status === "in_progress" ? <PlayCircle size={9} /> : <Clock size={9} />}
                    {STATUS_LABEL[spk.status]}
                </span>
                {!isToday && (
                    <p className="text-xs text-slate-400 mt-1">
                        {formatDate(spk.scheduleDate)}
                    </p>
                )}
            </div>
            <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-400 flex-shrink-0 transition-colors" />
        </div>
    );
}

// ── Quotation row ─────────────────────────────────────────────────────────────

function QuoRow({ q }: { q: RecentQuo }) {
    const navigate = useNavigate();
    return (
        <div
            onClick={() => navigate("/quotations")}
            className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 px-1 rounded-lg transition-colors group"
        >
            <div className="min-w-0 flex-1">
                <p className="text-xs font-mono text-slate-400">{q.noSurat}</p>
                <p className="text-sm font-semibold text-slate-900 truncate">{q.kepadaNama}</p>
                <p className="text-xs text-slate-500 truncate">{q.perihal}</p>
            </div>
            <div className="flex-shrink-0 text-right">
                <p className="text-sm font-bold text-slate-800">{formatRupiah(q.total)}</p>
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold mt-0.5 ${STATUS_COLOR[q.status]}`}>
                    {STATUS_LABEL[q.status]}
                </span>
            </div>
            <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-400 flex-shrink-0 transition-colors" />
        </div>
    );
}

// ── Activity feed ─────────────────────────────────────────────────────────────

const FEED_ICON: Record<string, React.ReactNode> = {
    quotation_created:  <FileText size={12} />,
    quotation_approved: <CheckCircle2 size={12} />,
    quotation_rejected: <AlertCircle size={12} />,
    spk_created:        <ClipboardList size={12} />,
    spk_done:           <CheckCircle2 size={12} />,
};

function FeedRow({ item }: { item: FeedItem }) {
    return (
        <div className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${item.color}`}>
                {FEED_ICON[item.type]}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 leading-snug">{item.title}</p>
                {item.subtitle && <p className="text-xs text-slate-500 truncate mt-0.5">{item.subtitle}</p>}
            </div>
            <span className="text-xs text-slate-400 flex-shrink-0 whitespace-nowrap mt-0.5">{timeAgo(item.time)}</span>
        </div>
    );
}

// ─── ROLE-BASED LAYOUTS ───────────────────────────────────────────────────────

function AdminDashboard({ data, loading }: { data: DashboardData | null; loading: boolean }) {
    if (loading || !data) return <DashboardSkeleton />;
    return (
        <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<FileText size={20} />} label="Total Quotation" value={data.totalQuotations}
                    sub={`${data.pendingQuotations} pending approval`} color="bg-blue-100 text-blue-600" trend="neutral" />
                <StatCard icon={<DollarSign size={20} />} label="Revenue Approved" value={formatRupiah(data.revenueApproved)}
                    sub={`+${formatRupiah(data.revenuePending)} pending`} color="bg-emerald-100 text-emerald-600" trend="up" />
                <StatCard icon={<CheckCircle2 size={20} />} label="Approved" value={data.approvedQuotations}
                    sub="quotation disetujui" color="bg-violet-100 text-violet-600" trend="up" />
                <StatCard icon={<Users size={20} />} label="Anggota Tim" value={data.activeUsers}
                    sub={`dari ${data.totalUsers} terdaftar`} color="bg-amber-100 text-amber-600" trend="neutral" />
            </div>

            {/* Charts + pending quotations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2">
                    <BarChart data={data.quotationsByMonth} />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <SectionTitle>Ringkasan Status</SectionTitle>
                    <div className="space-y-3 mt-2">
                        {[
                            { label: "Draft",    count: data.totalQuotations - data.pendingQuotations - data.approvedQuotations - data.rejectedQuotations, color: "bg-slate-300" },
                            { label: "Pending",  count: data.pendingQuotations,   color: "bg-amber-400" },
                            { label: "Approved", count: data.approvedQuotations,  color: "bg-emerald-500" },
                            { label: "Rejected", count: data.rejectedQuotations,  color: "bg-red-400" },
                        ].map(s => (
                            <div key={s.label} className="flex items-center gap-3">
                                <span className="text-sm text-slate-600 w-16">{s.label}</span>
                                <div className="flex-1 bg-slate-100 rounded-full h-2">
                                    <div className={`h-2 rounded-full ${s.color} transition-all`}
                                        style={{ width: `${data.totalQuotations > 0 ? (s.count / data.totalQuotations) * 100 : 0}%` }} />
                                </div>
                                <span className="text-sm font-bold text-slate-700 w-6 text-right">{s.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent quotations + activity feed */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <SectionTitle>Quotation Terbaru</SectionTitle>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${data.pendingQuotations > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                            {data.pendingQuotations} pending
                        </span>
                    </div>
                    {data.recentQuotations.length === 0 ? (
                        <p className="text-sm text-slate-400 py-4 text-center">Belum ada quotation.</p>
                    ) : (
                        data.recentQuotations.map(q => <QuoRow key={q.id} q={q} />)
                    )}
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <SectionTitle>Aktivitas Terbaru</SectionTitle>
                    {data.feed.length === 0
                        ? <p className="text-sm text-slate-400 py-4 text-center">Belum ada aktivitas.</p>
                        : data.feed.map(item => <FeedRow key={item.id} item={item} />)
                    }
                </div>
            </div>
        </div>
    );
}

function AdminOpsDashboard({ data, loading }: { data: DashboardData | null; loading: boolean }) {
    if (loading || !data) return <DashboardSkeleton />;
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<FileText size={20} />} label="Total Quotation" value={data.totalQuotations}
                    sub={`${data.pendingQuotations} pending`} color="bg-blue-100 text-blue-600" trend="neutral" />
                <StatCard icon={<DollarSign size={20} />} label="Revenue Approved" value={formatRupiah(data.revenueApproved)}
                    sub="dari quotation disetujui" color="bg-emerald-100 text-emerald-600" trend="up" />
                <StatCard icon={<CheckCircle2 size={20} />} label="Approved" value={data.approvedQuotations}
                    sub="quotation disetujui" color="bg-violet-100 text-violet-600" trend="up" />
                <StatCard icon={<AlertCircle size={20} />} label="Pending Approval" value={data.pendingQuotations}
                    sub="menunggu keputusan" color="bg-amber-100 text-amber-600" trend="neutral" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2">
                    <BarChart data={data.quotationsByMonth} />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <SectionTitle>Ringkasan Status</SectionTitle>
                    <div className="space-y-3 mt-2">
                        {[
                            { label: "Draft",    count: data.totalQuotations - data.pendingQuotations - data.approvedQuotations - data.rejectedQuotations, color: "bg-slate-300" },
                            { label: "Pending",  count: data.pendingQuotations,  color: "bg-amber-400" },
                            { label: "Approved", count: data.approvedQuotations, color: "bg-emerald-500" },
                            { label: "Rejected", count: data.rejectedQuotations, color: "bg-red-400" },
                        ].map(s => (
                            <div key={s.label} className="flex items-center gap-3">
                                <span className="text-sm text-slate-600 w-16">{s.label}</span>
                                <div className="flex-1 bg-slate-100 rounded-full h-2">
                                    <div className={`h-2 rounded-full ${s.color} transition-all`}
                                        style={{ width: `${data.totalQuotations > 0 ? (s.count / data.totalQuotations) * 100 : 0}%` }} />
                                </div>
                                <span className="text-sm font-bold text-slate-700 w-6 text-right">{s.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <SectionTitle>Quotation Pending Approval</SectionTitle>
                    {data.recentQuotations.filter(q => q.status === "pending").length === 0 ? (
                        <p className="text-sm text-slate-400 py-4 text-center">Tidak ada quotation pending.</p>
                    ) : (
                        data.recentQuotations.filter(q => q.status === "pending").map(q => <QuoRow key={q.id} q={q} />)
                    )}
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <SectionTitle>Aktivitas Terbaru</SectionTitle>
                    {data.feed.map(item => <FeedRow key={item.id} item={item} />)}
                </div>
            </div>
        </div>
    );
}

function MarketingDashboard({ data, loading, user }: { data: DashboardData | null; loading: boolean; user: AppUser }) {
    if (loading || !data) return <DashboardSkeleton />;
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<FileText size={20} />} label="Quotation Saya" value={data.myQuotations}
                    sub="total yang kamu buat" color="bg-blue-100 text-blue-600" trend="neutral" />
                <StatCard icon={<Clock size={20} />} label="Pending Review" value={data.recentQuotations.filter(q => q.status === "pending" && q.marketingNama === user.name).length}
                    sub="menunggu approval" color="bg-amber-100 text-amber-600" trend="neutral" />
                <StatCard icon={<CheckCircle2 size={20} />} label="Disetujui" value={data.recentQuotations.filter(q => q.status === "approved" && q.marketingNama === user.name).length}
                    sub="quotation approved" color="bg-emerald-100 text-emerald-600" trend="up" />
                <StatCard icon={<DollarSign size={20} />} label="Revenue Saya" value={formatRupiah(data.revenueApproved)}
                    sub="dari quotation approved" color="bg-violet-100 text-violet-600" trend="up" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2">
                    <BarChart data={data.quotationsByMonth} />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <SectionTitle>Status Quotation</SectionTitle>
                    <div className="space-y-3 mt-2">
                        {[
                            { label: "Draft",    count: data.recentQuotations.filter(q=>q.status==="draft").length,    color: "bg-slate-200" },
                            { label: "Pending",  count: data.pendingQuotations,   color: "bg-amber-400" },
                            { label: "Approved", count: data.approvedQuotations,  color: "bg-emerald-500" },
                            { label: "Rejected", count: data.rejectedQuotations,  color: "bg-red-400" },
                        ].map(s => (
                            <div key={s.label} className="flex items-center gap-3">
                                <span className="text-sm text-slate-600 w-16">{s.label}</span>
                                <div className="flex-1 bg-slate-100 rounded-full h-2">
                                    <div className={`h-2 rounded-full ${s.color} transition-all`}
                                        style={{ width: `${data.totalQuotations > 0 ? (s.count/data.totalQuotations)*100 : 0}%` }} />
                                </div>
                                <span className="text-sm font-bold text-slate-700 w-6 text-right">{s.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <SectionTitle>Quotation Terbaru</SectionTitle>
                {data.recentQuotations.length === 0
                    ? <p className="text-sm text-slate-400 py-4 text-center">Belum ada quotation.</p>
                    : data.recentQuotations.map(q => <QuoRow key={q.id} q={q} />)
                }
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <SectionTitle>Aktivitas Terbaru</SectionTitle>
                {data.feed.filter(f => f.type.startsWith("quotation")).map(item => <FeedRow key={item.id} item={item} />)}
            </div>
        </div>
    );
}

function TeknisiDashboard({ data, loading }: { data: DashboardData | null; loading: boolean }) {
    if (loading || !data) return <DashboardSkeleton />;
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <StatCard icon={<ClipboardList size={20} />} label="SPK Hari Ini" value={data.spkToday.length}
                    sub="pekerjaan terjadwal" color="bg-blue-100 text-blue-600" trend="neutral" />
                <StatCard icon={<PlayCircle size={20} />} label="In Progress" value={data.spkInProgress}
                    sub="sedang dikerjakan" color="bg-amber-100 text-amber-600" trend="neutral" />
            </div>

            <div>
                <SectionTitle>SPK Hari Ini</SectionTitle>
                {data.spkToday.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 shadow-sm">
                        <CalendarDays size={36} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium">Tidak ada SPK hari ini</p>
                        <p className="text-xs mt-1">Nikmati hari kamu! 🎉</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {data.spkToday.map(s => <SPKCard key={s.id} spk={s} isToday />)}
                    </div>
                )}
            </div>

            <div>
                <SectionTitle>SPK Mendatang</SectionTitle>
                {data.spkUpcoming.length === 0 ? (
                    <p className="text-sm text-slate-400 py-2">Tidak ada SPK mendatang.</p>
                ) : (
                    <div className="space-y-2">
                        {data.spkUpcoming.map(s => <SPKCard key={s.id} spk={s} isToday={false} />)}
                    </div>
                )}
            </div>
        </div>
    );
}

function DashboardSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-24 bg-slate-100 rounded-2xl" />
                ))}
            </div>
            <div className="grid grid-cols-3 gap-5">
                <div className="col-span-2 h-52 bg-slate-100 rounded-2xl" />
                <div className="h-52 bg-slate-100 rounded-2xl" />
            </div>
            <div className="grid grid-cols-2 gap-5">
                <div className="h-48 bg-slate-100 rounded-2xl" />
                <div className="h-48 bg-slate-100 rounded-2xl" />
            </div>
        </div>
    );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export function DashboardPage() {
    const { user } = useAuthStore();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    const greeting = useMemo(() => {
        const h = new Date().getHours();
        if (h < 11) return "Selamat pagi";
        if (h < 15) return "Selamat siang";
        if (h < 18) return "Selamat sore";
        return "Selamat malam";
    }, []);

    useEffect(() => {
        if (!user?.companyId && user?.role !== "super_admin") return;
        const companyId = user.companyId ?? "";
        fetchDashboardData(companyId, user)
            .then(setData)
            .finally(() => setLoading(false));
    }, [user]);

    return (
        <div className="p-6 max-w-screen-xl mx-auto">
            {/* ── Header ── */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">
                    {greeting}, {user?.name?.split(" ")[0]} 👋
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                    Kamu masuk sebagai{" "}
                    <span className="font-semibold text-blue-600">
                        {user ? ROLE_LABELS[user.role] : ""}
                    </span>
                    {" · "}{new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </p>
            </div>

            {/* ── Role-based content ── */}
            {user?.role === "administrator" && <AdminDashboard data={data} loading={loading} />}
            {user?.role === "admin_ops"     && <AdminOpsDashboard data={data} loading={loading} />}
            {user?.role === "marketing"     && <MarketingDashboard data={data} loading={loading} user={user} />}
            {user?.role === "teknisi"       && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 max-w-md">
                    <p className="text-blue-800 text-sm font-medium">👋 Halo {user.name?.split(" ")[0]}!</p>
                    <p className="text-blue-600 text-sm mt-1">Gunakan menu Profil Saya untuk mengelola akun kamu.</p>
                </div>
            )}
        </div>
    );
}