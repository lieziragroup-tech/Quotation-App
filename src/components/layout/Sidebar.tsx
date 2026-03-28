import { useState, useMemo } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import type { UserRole } from "../../types";
import { ROLE_LABELS, cn } from "../../lib/utils";
import {
    Send, ClipboardList, LayoutDashboard, FileText, Users,
    DollarSign, Settings, LogOut, ShieldCheck,
    TrendingUp, User, Hash, Menu, X, ChevronDown,
    ShoppingBag, BarChart3, Cog, UserCircle,
} from "lucide-react";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface NavItem {
    to: string;
    icon: React.ReactNode;
    label: string;
    roles: UserRole[];
}

interface NavGroupDef {
    type: "group";
    label: string;
    icon: React.ReactNode;
    items: NavItem[];
}

interface NavStandalone extends NavItem {
    type?: undefined;
}

type NavSection = NavGroupDef | NavStandalone;

// ─── NAV STRUCTURE ────────────────────────────────────────────────────────────

const NAV_SECTIONS: NavSection[] = [
    {
        to: "/dashboard",
        icon: <LayoutDashboard size={18} />,
        label: "Dashboard",
        roles: ["administrator", "admin_ops", "marketing", "teknisi"],
    },
    {
        type: "group",
        label: "Penjualan",
        icon: <ShoppingBag size={15} />,
        items: [
            { to: "/quotations",  icon: <FileText size={17} />,      label: "Quotation",        roles: ["administrator", "marketing", "admin_ops"] },
            { to: "/status-ph",   icon: <Send size={17} />,           label: "Status Penawaran", roles: ["administrator", "admin_ops"] },
            { to: "/tracking",    icon: <ClipboardList size={17} />,  label: "Tracking Order",   roles: ["administrator", "admin_ops"] },
        ],
    },
    {
        type: "group",
        label: "Klien",
        icon: <Users size={15} />,
        items: [
            { to: "/customers", icon: <Users size={17} />, label: "Pelanggan", roles: ["administrator", "admin_ops", "marketing"] },
        ],
    },
    {
        type: "group",
        label: "Laporan",
        icon: <BarChart3 size={15} />,
        items: [
            { to: "/cashflow",        icon: <DollarSign size={17} />,  label: "Cashflow",        roles: ["administrator"] },
            { to: "/performance",     icon: <TrendingUp size={17} />,  label: "Performa",        roles: ["administrator"] },
            { to: "/nomor-surat-log", icon: <Hash size={17} />,        label: "Log Nomor Surat", roles: ["administrator", "admin_ops"] },
        ],
    },
    {
        type: "group",
        label: "Manajemen",
        icon: <Cog size={15} />,
        items: [
            { to: "/team",     icon: <Users size={17} />,    label: "Tim",          roles: ["administrator"] },
            { to: "/settings", icon: <Settings size={17} />, label: "Pengaturan",   roles: ["administrator"] },
        ],
    },
    {
        type: "group",
        label: "Akun",
        icon: <UserCircle size={15} />,
        items: [
            { to: "/profile", icon: <User size={17} />, label: "Profil Saya", roles: ["administrator", "admin_ops", "marketing", "teknisi"] },
        ],
    },
];

// ─── SIDEBAR CONTENT ──────────────────────────────────────────────────────────

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
    const { user, setUser } = useAuthStore();
    const navigate  = useNavigate();
    const location  = useLocation();

    // Find which group contains the active route
    const activeGroupLabel = useMemo(() => {
        for (const section of NAV_SECTIONS) {
            if (section.type === "group") {
                if (section.items.some(item => location.pathname.startsWith(item.to))) {
                    return section.label;
                }
            }
        }
        return null;
    }, [location.pathname]);

    // Start with all groups open; user can close individually
    const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
        return new Set(NAV_SECTIONS.filter(s => s.type === "group").map(s => (s as NavGroupDef).label));
    });

    const toggleGroup = (label: string) => {
        setOpenGroups(prev => {
            const next = new Set(prev);
            if (next.has(label)) next.delete(label);
            else next.add(label);
            return next;
        });
    };

    const handleLogout = async () => {
        await signOut(auth);
        setUser(null);
        navigate("/login");
    };

    return (
        <div className="flex flex-col h-full">

            {/* ── Brand ──────────────────────────────────────────────────────── */}
            <div className="px-5 py-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-sm shadow-blue-200">
                        <ShieldCheck size={16} className="text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-900 leading-tight">ERP Pest Control</p>
                        <p className="text-xs text-slate-400">Sistem Manajemen</p>
                    </div>
                </div>
            </div>

            {/* ── Nav ────────────────────────────────────────────────────────── */}
            <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
                {NAV_SECTIONS.map((section, idx) => {

                    // ── Standalone item (Dashboard) ────────────────────────────
                    if (section.type !== "group") {
                        const item = section as NavStandalone;
                        if (!user || !item.roles.includes(user.role)) return null;
                        return (
                            <NavLink key={item.to} to={item.to} onClick={onNavClick}
                                className={({ isActive }) => cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                                    isActive
                                        ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98]"
                                )}>
                                {item.icon}
                                {item.label}
                            </NavLink>
                        );
                    }

                    // ── Group ──────────────────────────────────────────────────
                    const group = section as NavGroupDef;
                    const visibleItems = group.items.filter(
                        item => user && item.roles.includes(user.role)
                    );
                    if (visibleItems.length === 0) return null;

                    const isOpen       = openGroups.has(group.label);
                    const hasActive    = visibleItems.some(i => location.pathname.startsWith(i.to));

                    return (
                        <div key={`group-${idx}`} className="mt-1 first:mt-0">
                            {/* Group header button */}
                            <button
                                onClick={() => toggleGroup(group.label)}
                                className={cn(
                                    "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-150",
                                    hasActive && !isOpen
                                        ? "text-blue-600 bg-blue-50"
                                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                )}>
                                <span className="flex items-center gap-2">
                                    <span className={cn("transition-colors", hasActive && !isOpen ? "text-blue-500" : "text-slate-400")}>
                                        {group.icon}
                                    </span>
                                    {group.label}
                                </span>
                                <ChevronDown size={13} className={cn(
                                    "transition-transform duration-200 shrink-0",
                                    isOpen ? "rotate-180" : ""
                                )} />
                            </button>

                            {/* Group items — animated expand */}
                            <div className={cn(
                                "overflow-hidden transition-all duration-200",
                                isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                            )}>
                                <div className="ml-3 mt-0.5 pl-2.5 border-l-2 border-slate-100 space-y-0.5 pb-1">
                                    {visibleItems.map(item => (
                                        <NavLink key={item.to} to={item.to} onClick={onNavClick}
                                            className={({ isActive }) => cn(
                                                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                                                isActive
                                                    ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                                                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98]"
                                            )}>
                                            {item.icon}
                                            {item.label}
                                        </NavLink>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* ── User + Logout ───────────────────────────────────────────────── */}
            <div className="px-3 py-4 border-t border-slate-100 space-y-1">
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {user?.name?.charAt(0).toUpperCase() ?? "U"}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate leading-tight">{user?.name}</p>
                        <p className="text-xs text-slate-400 truncate">{user ? ROLE_LABELS[user.role] : ""}</p>
                    </div>
                </div>
                <button onClick={handleLogout}
                    className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors active:scale-[0.98]">
                    <LogOut size={17} /> Keluar
                </button>
            </div>
        </div>
    );
}

// ─── MOBILE TOPBAR ────────────────────────────────────────────────────────────

function MobileTopbar({ onOpen }: { onOpen: () => void }) {
    const location = useLocation();
    const { user }  = useAuthStore();

    const pageTitle = useMemo(() => {
        for (const section of NAV_SECTIONS) {
            if (section.type !== "group") {
                if (location.pathname.startsWith((section as NavStandalone).to)) return (section as NavStandalone).label;
            } else {
                const found = (section as NavGroupDef).items.find(i => location.pathname.startsWith(i.to));
                if (found) return found.label;
            }
        }
        return "ERP Pest Control";
    }, [location.pathname]);

    return (
        <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm px-4 flex items-center gap-3 h-14">
            <button onClick={onOpen}
                className="p-2 -ml-1 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors active:scale-95 flex items-center justify-center"
                style={{ minWidth: 40, minHeight: 40 }}>
                <Menu size={20} />
            </button>
            <p className="flex-1 text-sm font-bold text-slate-900 truncate">{pageTitle}</p>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user?.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
        </div>
    );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────

export function Sidebar() {
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <>
            {/* Desktop sidebar */}
            <aside className="hidden md:flex w-60 min-h-screen bg-white border-r border-slate-200 flex-col sticky top-0">
                <SidebarContent />
            </aside>

            {/* Mobile topbar */}
            <MobileTopbar onOpen={() => setMobileOpen(true)} />

            {/* Mobile backdrop */}
            <div
                className={`md:hidden fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
                onClick={() => setMobileOpen(false)}
            />

            {/* Mobile drawer */}
            <div className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <div className="flex items-center justify-between px-5 border-b border-slate-100 h-14">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm shadow-blue-200">
                            <ShieldCheck size={14} className="text-white" />
                        </div>
                        <p className="text-sm font-bold text-slate-900">ERP Pest Control</p>
                    </div>
                    <button onClick={() => setMobileOpen(false)}
                        className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors active:scale-95">
                        <X size={18} />
                    </button>
                </div>
                <div className="h-full overflow-y-auto" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 56px)" }}>
                    <SidebarContent onNavClick={() => setMobileOpen(false)} />
                </div>
            </div>
        </>
    );
}
