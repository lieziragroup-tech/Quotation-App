import { NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import type { UserRole } from "../../types";
import { ROLE_LABELS, cn } from "../../lib/utils";
import {
    LayoutDashboard, FileText, Users,
    DollarSign, Settings, LogOut, ShieldCheck,
    TrendingUp, User,
} from "lucide-react";

interface NavItem {
    to: string;
    icon: React.ReactNode;
    label: string;
    roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
    {
        to: "/dashboard",
        icon: <LayoutDashboard size={18} />,
        label: "Dashboard",
        roles: ["administrator", "admin_ops", "marketing", "teknisi"],
    },
    {
        to: "/quotations",
        icon: <FileText size={18} />,
        label: "Quotation",
        roles: ["administrator", "marketing", "admin_ops"],
    },
    {
        to: "/team",
        icon: <Users size={18} />,
        label: "Tim",
        roles: ["administrator"],
    },
    {
        to: "/customers",
        icon: <Users size={18} />,
        label: "Pelanggan",
        roles: ["administrator", "admin_ops", "marketing"],
    },
    {
        to: "/cashflow",
        icon: <DollarSign size={18} />,
        label: "Cashflow",
        roles: ["administrator"],
    },
    {
        to: "/performance",
        icon: <TrendingUp size={18} />,
        label: "Performa",
        roles: ["administrator"],
    },
    {
        to: "/settings",
        icon: <Settings size={18} />,
        label: "Pengaturan",
        roles: ["administrator"],
    },
    {
        to: "/profile",
        icon: <User size={18} />,
        label: "Profil Saya",
        roles: ["administrator", "admin_ops", "marketing", "teknisi"],
    },
];

export function Sidebar() {
    const { user, setUser } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await signOut(auth);
        setUser(null);
        navigate("/login");
    };

    const visibleItems = NAV_ITEMS.filter(
        (item) => user && item.roles.includes(user.role)
    );

    return (
        <aside className="w-60 min-h-screen bg-white border-r border-slate-200 flex flex-col sticky top-0">
            {/* Brand */}
            <div className="px-5 py-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                        <ShieldCheck size={16} className="text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-900 leading-tight">ERP Pest Control</p>
                        <p className="text-xs text-slate-400">Sistem Manajemen</p>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-0.5">
                {visibleItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-blue-50 text-blue-700"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            )
                        }
                    >
                        {item.icon}
                        {item.label}
                    </NavLink>
                ))}
            </nav>

            {/* User info + logout */}
            <div className="px-3 py-4 border-t border-slate-100">
                <div className="px-3 py-2 mb-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
                    <p className="text-xs text-slate-400">
                        {user ? ROLE_LABELS[user.role] : ""}
                    </p>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                    <LogOut size={18} />
                    Keluar
                </button>
            </div>
        </aside>
    );
}