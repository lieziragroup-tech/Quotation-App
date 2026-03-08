import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import type { UserRole } from "../../types";
import { ROLE_LABELS, cn } from "../../lib/utils";
import {
    Send, ClipboardList, LayoutDashboard, FileText, Users,
    DollarSign, Settings, LogOut, ShieldCheck,
    TrendingUp, User, Hash, Menu, X,
} from "lucide-react";

// Separator sebagai penanda grup
interface NavGroup { type: "group"; label: string }
interface NavItem  { type?: undefined; to: string; icon: React.ReactNode; label: string; roles: UserRole[] }
type NavEntry = NavItem | NavGroup;

const NAV_ITEMS: NavEntry[] = [
    // ── Utama ─────────────────────────────────────────────────────────────────
    { to: "/dashboard",       icon: <LayoutDashboard size={18} />, label: "Dashboard",        roles: ["administrator", "admin_ops", "marketing", "teknisi"] },

    // ── Penjualan ─────────────────────────────────────────────────────────────
    { type: "group", label: "Penjualan" },
    { to: "/quotations",      icon: <FileText size={18} />,        label: "Quotation",        roles: ["administrator", "marketing", "admin_ops"] },
    { to: "/status-ph",       icon: <Send size={18} />,            label: "Status Penawaran", roles: ["administrator", "admin_ops"] },
    { to: "/tracking",        icon: <ClipboardList size={18} />,   label: "Tracking Order",   roles: ["administrator", "admin_ops", "marketing"] },

    // ── Klien ─────────────────────────────────────────────────────────────────
    { type: "group", label: "Klien" },
    { to: "/customers",       icon: <Users size={18} />,           label: "Pelanggan",        roles: ["administrator", "admin_ops", "marketing"] },

    // ── Laporan ───────────────────────────────────────────────────────────────
    { type: "group", label: "Laporan" },
    { to: "/cashflow",        icon: <DollarSign size={18} />,      label: "Cashflow",         roles: ["administrator"] },
    { to: "/performance",     icon: <TrendingUp size={18} />,      label: "Performa",         roles: ["administrator"] },
    { to: "/nomor-surat-log", icon: <Hash size={18} />,            label: "Log Nomor Surat",  roles: ["administrator", "admin_ops"] },

    // ── Manajemen ─────────────────────────────────────────────────────────────
    { type: "group", label: "Manajemen" },
    { to: "/team",            icon: <Users size={18} />,           label: "Tim",              roles: ["administrator"] },
    { to: "/settings",        icon: <Settings size={18} />,        label: "Pengaturan",       roles: ["administrator"] },

    // ── Akun ──────────────────────────────────────────────────────────────────
    { type: "group", label: "Akun" },
    { to: "/profile",         icon: <User size={18} />,            label: "Profil Saya",      roles: ["administrator", "admin_ops", "marketing", "teknisi"] },
];

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
    const { user, setUser } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await signOut(auth);
        setUser(null);
        navigate("/login");
    };

    const visibleItems = NAV_ITEMS.filter(item =>
        item.type === "group" || (user && (item as NavItem).roles.includes(user.role))
    );

    return (
        <div className="flex flex-col h-full">
            <div className="px-5 py-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                        <ShieldCheck size={16} className="text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-900 leading-tight">ERP Pest Control</p>
                        <p className="text-xs text-slate-400">Sistem Manajemen</p>
                    </div>
                </div>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                {visibleItems.map((item, idx) => (
                    item.type === "group" ? (
                        <div key={`group-${idx}`} className="px-2 pt-4 pb-1 first:pt-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.label}</p>
                        </div>
                    ) : (
                    <NavLink key={(item as NavItem).to} to={(item as NavItem).to} onClick={onNavClick}
                        className={({ isActive }) => cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                            isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        )}>
                        {(item as NavItem).icon}
                        {(item as NavItem).label}
                    </NavLink>
                    )
                ))}
            </nav>
            <div className="px-3 py-4 border-t border-slate-100">
                <div className="px-3 py-2 mb-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
                    <p className="text-xs text-slate-400">{user ? ROLE_LABELS[user.role] : ""}</p>
                </div>
                <button onClick={handleLogout}
                    className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                    <LogOut size={18} /> Keluar
                </button>
            </div>
        </div>
    );
}

function MobileTopbar({ onOpen }: { onOpen: () => void }) {
    const location = useLocation();
    const { user } = useAuthStore();
    const pageTitle = NAV_ITEMS.find(i => i.type !== "group" && location.pathname.startsWith((i as NavItem).to))?.label ?? "ERP Pest Control";

    return (
        <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
            <button onClick={onOpen} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
                <Menu size={20} />
            </button>
            <p className="flex-1 text-sm font-bold text-slate-900">{pageTitle}</p>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user?.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
        </div>
    );
}

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
            {mobileOpen && (
                <div className="md:hidden fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
                    onClick={() => setMobileOpen(false)} />
            )}

            {/* Mobile drawer */}
            <div className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-white shadow-2xl transform transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                            <ShieldCheck size={14} className="text-white" />
                        </div>
                        <p className="text-sm font-bold text-slate-900">ERP Pest Control</p>
                    </div>
                    <button onClick={() => setMobileOpen(false)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <div className="h-full pb-20 overflow-y-auto">
                    <SidebarContent onNavClick={() => setMobileOpen(false)} />
                </div>
            </div>
        </>
    );
}