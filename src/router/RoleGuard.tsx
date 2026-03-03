import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import type { UserRole } from "../types";

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRoles: UserRole[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
    const { user, loading } = useAuthStore();

    // Bug fix: wait for Firebase auth to resolve before redirecting.
    // Without this check, user=null during initial load causes an incorrect
    // redirect to /login even when the user is already authenticated.
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
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
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-blue-600" />
            </div>
        );
    }

    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
}
