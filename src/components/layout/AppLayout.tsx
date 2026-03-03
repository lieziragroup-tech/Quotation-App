import { Outlet, Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { Sidebar } from "./Sidebar";
import { Loader2 } from "lucide-react";

export function AppLayout() {
    const { user, loading } = useAuthStore();

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size={32} className="animate-spin text-blue-600 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Memuat aplikasi...</p>
                </div>
            </div>
        );
    }

    if (!user) return <Navigate to="/login" replace />;
    if (user.role === "super_admin") return <Navigate to="/super-admin/companies" replace />;

    return (
        <div className="flex min-h-screen bg-slate-50">
            <Sidebar />
            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>
        </div>
    );
}
