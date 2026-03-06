import { useState, useEffect } from "react";
import { useAuthStore } from "../../store/authStore";
import { ROLE_LABELS } from "../../lib/utils";
import { getQuotations } from "../../services/quotationService";
import {
    FileText, Clock, CheckCircle2, XCircle,
    TrendingUp, Users, FileX2, BarChart3,
} from "lucide-react";
import { formatRupiah } from "../../lib/utils";
import type { Quotation } from "../../types";

// ─── STAT CARD ────────────────────────────────────────────────────────────────

interface StatCardProps {
    label: string;
    value: string | number;
    sub?: string;
    icon: React.ReactNode;
    color: string;
    bg: string;
}

function StatCard({ label, value, sub, icon, color, bg }: StatCardProps) {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
                <span style={{ color }}>{icon}</span>
            </div>
            <div>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
                <p className="text-sm font-medium text-slate-600">{label}</p>
                {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ─── RECENT QUOTATION ROW ─────────────────────────────────────────────────────

function RecentRow({ q }: { q: Quotation }) {
    const STATUS_COLOR: Record<string, string> = {
        draft: "text-slate-500 bg-slate-100",
        pending: "text-amber-700 bg-amber-100",
        approved: "text-green-700 bg-green-100",
        rejected: "text-red-700 bg-red-100",
    };
    const STATUS_LABEL: Record<string, string> = {
        draft: "Draft",
        pending: "Menunggu",
        approved: "Disetujui",
        rejected: "Ditolak",
    };
    return (
        <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
            <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${q.kategori === "AR" ? "bg-purple-500" : "bg-cyan-500"}`} />
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{q.kepadaNama}</p>
                    <code className="text-xs text-slate-400 font-mono">{q.noSurat}</code>
                </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-2">
                <span className="text-sm font-mono text-slate-600 hidden sm:block">{formatRupiah(q.total)}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[q.status]}`}>
                    {STATUS_LABEL[q.status]}
                </span>
            </div>
        </div>
    );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export function DashboardPage() {
    const { user } = useAuthStore();
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);

    const canSeeAll = user?.role !== "marketing";

    useEffect(() => {
        if (!user) return;
        const load = async () => {
            setLoading(true);
            try {
                const data = await getQuotations({
                    companyId: user.companyId,
                    byUid: canSeeAll ? undefined : user.uid,
                });
                setQuotations(data);
            } catch {
                // silent
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user]);

    // Stats
    const totalQuotations = quotations.length;
    const totalPending = quotations.filter(q => q.status === "pending").length;
    const totalApproved = quotations.filter(q => q.status === "approved").length;
    const totalRejected = quotations.filter(q => q.status === "rejected").length;
    const totalNilaiApproved = quotations
        .filter(q => q.status === "approved")
        .reduce((sum, q) => sum + q.total, 0);
    const totalAR = quotations.filter(q => q.kategori === "AR").length;
    const totalPCO = quotations.filter(q => q.kategori === "PCO").length;

    // Recent 5
    const recent = quotations.slice(0, 5);

    // Pending for admin approval
    const pendingList = quotations.filter(q => q.status === "pending").slice(0, 5);

    return (
        <div className="p-4 md:p-6 max-w-screen-xl mx-auto space-y-6">
            {/* Welcome */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">
                    Selamat datang, {user?.name?.split(" ")[0]} 👋
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                    Kamu masuk sebagai{" "}
                    <span className="font-semibold text-blue-600">
                        {user ? ROLE_LABELS[user.role] : ""}
                    </span>
                    {canSeeAll ? " — menampilkan semua data perusahaan" : " — menampilkan data kamu"}
                </p>
            </div>

            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 h-24 animate-pulse">
                            <div className="bg-slate-100 h-4 w-16 rounded mb-2" />
                            <div className="bg-slate-100 h-6 w-10 rounded" />
                        </div>
                    ))}
                </div>
            ) : (
                <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard
                            label="Total Quotation"
                            value={totalQuotations}
                            sub={`AR: ${totalAR} · PCO: ${totalPCO}`}
                            icon={<FileText size={20} />}
                            color="#2563eb"
                            bg="#eff6ff"
                        />
                        <StatCard
                            label="Menunggu Approval"
                            value={totalPending}
                            sub="Perlu ditinjau"
                            icon={<Clock size={20} />}
                            color="#d97706"
                            bg="#fffbeb"
                        />
                        <StatCard
                            label="Disetujui"
                            value={totalApproved}
                            sub={totalApproved > 0 ? formatRupiah(totalNilaiApproved) : "—"}
                            icon={<CheckCircle2 size={20} />}
                            color="#16a34a"
                            bg="#f0fdf4"
                        />
                        <StatCard
                            label="Ditolak"
                            value={totalRejected}
                            sub="Dikembalikan ke marketing"
                            icon={<XCircle size={20} />}
                            color="#dc2626"
                            bg="#fef2f2"
                        />
                    </div>

                    {/* Nilai & Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-1 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-5 text-white">
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingUp size={18} />
                                <span className="text-sm font-semibold opacity-90">Nilai Quotation Disetujui</span>
                            </div>
                            <p className="text-2xl font-bold">{formatRupiah(totalNilaiApproved)}</p>
                            <p className="text-xs opacity-70 mt-1">dari {totalApproved} quotation approved</p>
                            <div className="mt-4 flex gap-4 text-xs opacity-80">
                                <div>
                                    <p className="font-bold text-sm">{totalAR}</p>
                                    <p>Anti Rayap</p>
                                </div>
                                <div>
                                    <p className="font-bold text-sm">{totalPCO}</p>
                                    <p>Pest Control</p>
                                </div>
                            </div>
                        </div>

                        {/* Pending Approvals (untuk admin) */}
                        {canSeeAll && (
                            <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Clock size={16} className="text-amber-500" />
                                    <h3 className="text-sm font-bold text-slate-700">Menunggu Persetujuan</h3>
                                    {totalPending > 0 && (
                                        <span className="ml-auto text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                            {totalPending} pending
                                        </span>
                                    )}
                                </div>
                                {pendingList.length === 0 ? (
                                    <div className="text-center py-6 text-slate-400">
                                        <CheckCircle2 size={28} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Tidak ada quotation yang menunggu</p>
                                    </div>
                                ) : (
                                    <div>
                                        {pendingList.map(q => (
                                            <RecentRow key={q.id} q={q} />
                                        ))}
                                        {totalPending > 5 && (
                                            <p className="text-xs text-slate-400 mt-2 text-center">
                                                +{totalPending - 5} lainnya di halaman Quotation
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Recent for marketing */}
                        {!canSeeAll && (
                            <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <FileText size={16} className="text-blue-500" />
                                    <h3 className="text-sm font-bold text-slate-700">Quotation Terbaru Saya</h3>
                                </div>
                                {recent.length === 0 ? (
                                    <div className="text-center py-6 text-slate-400">
                                        <FileX2 size={28} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Belum ada quotation</p>
                                    </div>
                                ) : (
                                    recent.map(q => <RecentRow key={q.id} q={q} />)
                                )}
                            </div>
                        )}
                    </div>

                    {/* Recent Quotations Table (full) */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 size={16} className="text-slate-500" />
                            <h3 className="text-sm font-bold text-slate-700">
                                {canSeeAll ? "Quotation Terbaru" : "5 Quotation Terakhir Saya"}
                            </h3>
                        </div>
                        {recent.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-4">Belum ada data quotation.</p>
                        ) : (
                            recent.map(q => <RecentRow key={q.id} q={q} />)
                        )}
                    </div>
                </>
            )}

            {/* Quick Links */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Buat Quotation", href: "/quotations/new", icon: <FileText size={16} />, color: "bg-blue-600 text-white hover:bg-blue-700", show: ["administrator", "marketing"].includes(user?.role ?? "") },
                    { label: "Daftar Quotation", href: "/quotations", icon: <FileText size={16} />, color: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50", show: true },
                    { label: "Log Nomor Surat", href: "/nomor-surat-log", icon: <FileX2 size={16} />, color: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50", show: ["administrator", "admin_ops"].includes(user?.role ?? "") },
                    { label: "Tim", href: "/team", icon: <Users size={16} />, color: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50", show: user?.role === "administrator" },
                ].filter(l => l.show).map(link => (
                    <a key={link.href} href={link.href}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${link.color}`}>
                        {link.icon}
                        {link.label}
                    </a>
                ))}
            </div>
        </div>
    );
}