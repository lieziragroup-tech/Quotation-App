import { NavLink, useNavigate } from "react-router-dom";
import { Outlet, Navigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useAuthStore } from "../../store/authStore";
import { Building2, LogOut, ShieldCheck } from "lucide-react";

export function SuperAdminLayout() {
    const { user, setUser, loading } = useAuthStore();
    const navigate = useNavigate();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) return <Navigate to="/login" replace />;
    if (user.role !== "super_admin") return <Navigate to="/dashboard" replace />;

    const handleLogout = async () => {
        await signOut(auth);
        setUser(null);
        navigate("/login");
    };

    return (
        <div className="flex min-h-screen bg-slate-950">
            {/* Sidebar */}
            <aside className="w-56 min-h-screen bg-slate-900 border-r border-slate-800 flex flex-col sticky top-0">
                {/* Brand */}
                <div className="px-5 py-5 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                            <ShieldCheck size={16} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white leading-tight">Super Admin</p>
                            <p className="text-xs text-slate-400">ERP Pest Control</p>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-3 py-4 space-y-0.5">
                    <NavLink
                        to="/super-admin/companies"
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                                ? "bg-indigo-600 text-white"
                                : "text-slate-400 hover:bg-slate-800 hover:text-white"
                            }`
                        }
                    >
                        <Building2 size={17} />
                        Perusahaan
                    </NavLink>
                </nav>

                {/* User info + logout */}
                <div className="px-3 py-4 border-t border-slate-800">
                    <div className="px-3 py-2 mb-1">
                        <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                        <p className="text-xs text-slate-400">Super Admin</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-red-400 hover:bg-red-900/30 transition-colors"
                    >
                        <LogOut size={17} />
                        Keluar
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 overflow-auto bg-slate-50">
                <Outlet />
            </main>
        </div>
    );
}
