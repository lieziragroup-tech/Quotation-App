import { useState, useEffect, useMemo } from "react";
import {
    MapPin, RefreshCw, Loader2, Navigation, Target,
    AlertTriangle, Route, Zap,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { getQuotations } from "../../services/quotationService";
import { formatRupiah } from "../../lib/utils";
import type { Quotation } from "../../types";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface CustomerLocation {
    id: string;
    name: string;
    address: string;
    lat: number | null;
    lng: number | null;
    wa: string;
    totalRevenue: number;
    dealCount: number;
    hasActiveWarranty: boolean;
    lastService: Date | null;
    status: "deal" | "prospect";
    quotations: Quotation[];
}

// ─── ALGORITHMS ───────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function optimizeRoute(
    locs: CustomerLocation[],
    sLat: number,
    sLng: number,
): CustomerLocation[] {
    const valid = locs.filter((l) => l.lat && l.lng);
    const visited = new Set<string>();
    const route: CustomerLocation[] = [];
    let curLat = sLat;
    let curLng = sLng;
    while (visited.size < valid.length) {
        let best: CustomerLocation | null = null;
        let bestDist = Infinity;
        for (const loc of valid) {
            if (visited.has(loc.id)) continue;
            const d = haversineKm(curLat, curLng, loc.lat!, loc.lng!);
            if (d < bestDist) {
                bestDist = d;
                best = loc;
            }
        }
        if (!best) break;
        visited.add(best.id);
        route.push(best);
        curLat = best.lat!;
        curLng = best.lng!;
    }
    return route;
}

function scorePriority(c: CustomerLocation): number {
    let s = 0;
    if (c.hasActiveWarranty) s += 30;
    if (c.status === "deal") s += 20;
    if (c.totalRevenue > 5_000_000) s += 15;
    if (c.lastService) {
        const days = (Date.now() - c.lastService.getTime()) / 86_400_000;
        if (days > 90) s += 25;
        else if (days > 30) s += 10;
    } else {
        s += 20;
    }
    return s;
}

// ─── PRIORITY LIST ────────────────────────────────────────────────────────────

function PriorityList({ customers }: { customers: CustomerLocation[] }) {
    const list = useMemo(
        () =>
            [...customers]
                .map((c) => ({ ...c, score: scorePriority(c) }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 10),
        [customers],
    );

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
                <Target size={16} className="text-amber-500" />
                <p className="text-sm font-bold text-slate-800">
                    Rekomendasi Prioritas Kunjungan
                </p>
            </div>
            <p className="text-xs text-slate-400">
                Algoritma: garansi aktif (+30), deal (+20), revenue tinggi (+15),
                lama tidak dikunjungi (+25)
            </p>
            <div className="space-y-2">
                {list.map((c, i) => (
                    <div
                        key={c.id}
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100"
                    >
                        <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                i === 0
                                    ? "bg-amber-500 text-white"
                                    : i <= 2
                                    ? "bg-slate-400 text-white"
                                    : "bg-slate-200 text-slate-600"
                            }`}
                        >
                            {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">
                                {c.name}
                            </p>
                            <div className="flex gap-1.5 flex-wrap mt-0.5">
                                {c.hasActiveWarranty && (
                                    <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 rounded">
                                        🛡 Garansi
                                    </span>
                                )}
                                {c.totalRevenue > 0 && (
                                    <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 rounded">
                                        {formatRupiah(c.totalRevenue)}
                                    </span>
                                )}
                                {c.lastService ? (
                                    <span className="text-[10px] text-slate-400">
                                        {Math.floor(
                                            (Date.now() - c.lastService.getTime()) / 86_400_000,
                                        )}
                                        h lalu
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 rounded">
                                        Belum pernah dikunjungi
                                    </span>
                                )}
                            </div>
                        </div>
                        <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                c.score >= 50
                                    ? "bg-red-100 text-red-700"
                                    : c.score >= 30
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-emerald-100 text-emerald-700"
                            }`}
                        >
                            {c.score >= 50 ? "Segera" : c.score >= 30 ? "Penting" : "Normal"}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── ROUTE OPTIMIZER ─────────────────────────────────────────────────────────

function RouteOptimizer({ customers }: { customers: CustomerLocation[] }) {
    const [startLat, setStartLat] = useState("-6.2088");
    const [startLng, setStartLng] = useState("106.8456");
    const [route, setRoute] = useState<CustomerLocation[]>([]);
    const [filter, setFilter] = useState<"all" | "warranty" | "deal">("all");

    const filtered = customers.filter((c) =>
        filter === "warranty"
            ? c.hasActiveWarranty
            : filter === "deal"
            ? c.status === "deal"
            : true,
    );

    const handleOpt = () =>
        setRoute(
            optimizeRoute(filtered, parseFloat(startLat), parseFloat(startLng)),
        );

    const totalDist = useMemo(() => {
        let d = 0;
        for (let i = 1; i < route.length; i++) {
            if (route[i - 1].lat && route[i].lat) {
                d += haversineKm(
                    route[i - 1].lat!,
                    route[i - 1].lng!,
                    route[i].lat!,
                    route[i].lng!,
                );
            }
        }
        return d;
    }, [route]);

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
                <Route size={16} className="text-blue-600" />
                <p className="text-sm font-bold text-slate-800">Optimasi Rute Kunjungan</p>
            </div>
            <p className="text-xs text-slate-400">
                Algoritma Nearest Neighbor — meminimalkan jarak total antar pelanggan
            </p>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                        Latitude Titik Awal
                    </label>
                    <input
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                        value={startLat}
                        onChange={(e) => setStartLat(e.target.value)}
                        placeholder="-6.2088"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                        Longitude Titik Awal
                    </label>
                    <input
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                        value={startLng}
                        onChange={(e) => setStartLng(e.target.value)}
                        placeholder="106.8456"
                    />
                </div>
            </div>
            <div className="flex gap-2">
                {(["all", "warranty", "deal"] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                            filter === f
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                    >
                        {f === "all" ? "Semua" : f === "warranty" ? "🛡 Bergaransi" : "✓ Deal"}
                    </button>
                ))}
            </div>
            <button
                onClick={handleOpt}
                className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2"
            >
                <Zap size={14} /> Hitung Rute Optimal (
                {filtered.filter((c) => c.lat && c.lng).length} lokasi dengan koordinat)
            </button>

            {route.length > 0 && (
                <div>
                    <div className="flex justify-between mb-2">
                        <p className="text-xs font-bold text-slate-600">Urutan Kunjungan Optimal</p>
                        <span className="text-xs text-slate-400">~{totalDist.toFixed(1)} km total</span>
                    </div>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                        {route.map((c, i) => (
                            <div
                                key={c.id}
                                className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100"
                            >
                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-slate-800 truncate">
                                        {c.name}
                                    </p>
                                    <p className="text-[10px] text-slate-400 truncate">
                                        {c.address || "—"}
                                    </p>
                                </div>
                                {c.hasActiveWarranty && (
                                    <span className="text-[10px] text-purple-500 shrink-0">🛡</span>
                                )}
                            </div>
                        ))}
                    </div>
                    <a
                        href={`https://www.google.com/maps/dir/${startLat},${startLng}/${route
                            .filter((c) => c.lat && c.lng)
                            .map((c) => `${c.lat},${c.lng}`)
                            .join("/")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 w-full py-2 text-xs font-semibold text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 flex items-center justify-center gap-2"
                    >
                        <Navigation size={12} /> Buka Rute di Google Maps
                    </a>
                </div>
            )}
        </div>
    );
}

// ─── MAIN PAGE — named export required by router ──────────────────────────────

export function AreaPage() {
    const { user } = useAuthStore();
    const [customers, setCustomers] = useState<CustomerLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"priority" | "route" | "map">("priority");

    const load = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const quotes = await getQuotations({ companyId: user.companyId });
            const now = new Date();
            const map = new Map<string, CustomerLocation>();

            quotes.forEach((q) => {
                const key = q.kepadaNama
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, "_");
                if (!map.has(key)) {
                    map.set(key, {
                        id: key,
                        name: q.kepadaNama,
                        address: q.kepadaAlamatLines?.[0] ?? "",
                        lat: null,
                        lng: null,
                        wa: q.kepadaWa ?? "",
                        totalRevenue: 0,
                        dealCount: 0,
                        hasActiveWarranty: false,
                        lastService: null,
                        status: "prospect",
                        quotations: [],
                    });
                }
                const c = map.get(key)!;
                c.quotations.push(q);

                if (q.status === "deal") {
                    c.status = "deal";
                    c.dealCount++;
                    c.totalRevenue += q.total;
                    if (q.dealAt && (!c.lastService || q.dealAt > c.lastService)) {
                        c.lastService = q.dealAt;
                    }
                    if (q.garansiTahun && q.garansiTahun > 0 && q.dealAt) {
                        const exp = new Date(q.dealAt);
                        exp.setFullYear(exp.getFullYear() + q.garansiTahun);
                        if (exp > now) c.hasActiveWarranty = true;
                    }
                }
            });

            setCustomers(Array.from(map.values()));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [user]);

    const stats = useMemo(
        () => ({
            total: customers.length,
            deal: customers.filter((c) => c.status === "deal").length,
            warranty: customers.filter((c) => c.hasActiveWarranty).length,
            withCoords: customers.filter((c) => c.lat && c.lng).length,
        }),
        [customers],
    );

    return (
        <div className="p-4 md:p-6 max-w-screen-xl mx-auto space-y-5 pb-8">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <MapPin size={20} className="text-blue-600" /> Area &amp; Manajemen Lokasi
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Peta pelanggan, optimasi rute, dan rekomendasi prioritas kunjungan
                    </p>
                </div>
                <button
                    onClick={load}
                    className="p-2 border border-slate-200 bg-white rounded-xl text-slate-400 hover:bg-slate-50"
                >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total Pelanggan", val: stats.total, cls: "bg-white border-slate-200 text-slate-800" },
                    { label: "Sudah Deal",       val: stats.deal,    cls: "bg-emerald-50 border-emerald-100 text-emerald-700" },
                    { label: "Garansi Aktif",    val: stats.warranty, cls: "bg-purple-50 border-purple-100 text-purple-700" },
                    { label: "Ada Koordinat",    val: stats.withCoords, cls: "bg-blue-50 border-blue-100 text-blue-700" },
                ].map((s) => (
                    <div key={s.label} className={`border rounded-xl p-3 ${s.cls}`}>
                        <p className="text-2xl font-bold">{s.val}</p>
                        <p className="text-xs text-slate-500">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* No-coords notice */}
            {stats.withCoords === 0 && !loading && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-amber-800">Koordinat GPS belum tersedia</p>
                        <p className="text-xs text-amber-700 mt-0.5">
                            Fitur peta &amp; rute membutuhkan koordinat pelanggan. Optimasi
                            prioritas tetap tersedia berdasarkan data yang ada.
                        </p>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200">
                {(
                    [
                        ["priority", "Prioritas Kunjungan"],
                        ["route",    "Optimasi Rute"],
                        ["map",      "Peta"],
                    ] as const
                ).map(([id, label]) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 transition-colors ${
                            activeTab === id
                                ? "border-blue-600 text-blue-600 bg-blue-50"
                                : "border-transparent text-slate-500 hover:text-slate-700"
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                    <Loader2 size={20} className="animate-spin mr-2" /> Memuat data...
                </div>
            ) : (
                <>
                    {activeTab === "priority" && <PriorityList customers={customers} />}
                    {activeTab === "route"    && <RouteOptimizer customers={customers} />}
                    {activeTab === "map"      && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-5">
                            <p className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <MapPin size={15} className="text-blue-500" />
                                Daftar Lokasi Pelanggan
                            </p>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {customers.map((c) => (
                                    <div
                                        key={c.id}
                                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100"
                                    >
                                        <MapPin
                                            size={14}
                                            className={c.lat ? "text-blue-500" : "text-slate-300"}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-slate-800 truncate">
                                                {c.name}
                                            </p>
                                            <p className="text-[10px] text-slate-400 truncate">
                                                {c.address || "Alamat belum diisi"}
                                            </p>
                                        </div>
                                        <div className="flex gap-1 shrink-0">
                                            {c.status === "deal" && (
                                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 rounded">
                                                    Deal
                                                </span>
                                            )}
                                            {c.hasActiveWarranty && (
                                                <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 rounded">
                                                    🛡
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                    customers
                                        .filter((c) => c.address)
                                        .map((c) => c.address)
                                        .join("|"),
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 w-full py-2.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 flex items-center justify-center gap-2"
                            >
                                <Navigation size={12} /> Lihat Semua di Google Maps
                            </a>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}