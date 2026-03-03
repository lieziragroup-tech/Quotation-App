import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { Loader2 } from "lucide-react";
import type { UserRole } from "../types";

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRoles: UserRole[];
}

/**
 * FIX: RoleGuard sekarang cek `loading` sebelum redirect.
 * Sebelumnya: langsung redirect ke /login saat user=null,
 * padahal onAuthStateChanged belum selesai (loading masih true).
 * Akibat: user yang sudah login selalu di-redirect ke /login saat refresh.
 */
export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
    const { user, loading } = useAuthStore();

    // Tunggu auth state selesai dulu
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-blue-600" />
            </div>
        );
    }

    if (!user) return <Navigate to="/login" replace />;

    if (!allowedRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" replace />;
    }

    return <>{children}</>;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuthStore();

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-blue-600" />
            </div>
        );
    }

    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
}
