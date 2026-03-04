import { createBrowserRouter, Navigate } from "react-router-dom";
import { RoleGuard } from "./RoleGuard";
import { AppLayout } from "../components/layout/AppLayout";
import { SuperAdminLayout } from "../components/layout/SuperAdminLayout";

// Auth
import { LoginPage } from "../pages/auth/LoginPage";
import { UnauthorizedPage } from "../pages/auth/UnauthorizedPage";
import { SignupPage } from "../pages/auth/SignupPage";

// Pages — regular
import { DashboardPage } from "../pages/dashboard/DashboardPage";
import { QuotationPage } from "../pages/quotation/QuotationPage";
import { QuotationFormPage } from "../pages/quotation/QuotationFormPage";
import { TeamPage } from "../pages/team/TeamPage";
import { ProfilePage } from "../pages/profile/ProfilePage";
import { ComingSoonPage } from "../pages/ComingSoonPage";
import { SPKPage } from "../pages/spk/SPKPage";

// Pages — super_admin
import { CompaniesPage } from "../pages/super-admin/CompaniesPage";
import { CompanyUsersPage } from "../pages/super-admin/CompanyUsersPage";

export const router = createBrowserRouter([
    {
        path: "/login",
        element: <LoginPage />,
    },
    {
        path: "/unauthorized",
        element: <UnauthorizedPage />,
    },
    {
        path: "/signup",
        element: <SignupPage />,
    },

    // ── Super Admin routes ─────────────────────────────────────────────────────
    {
        path: "/super-admin",
        element: <SuperAdminLayout />,
        children: [
            {
                index: true,
                element: <Navigate to="/super-admin/companies" replace />,
            },
            {
                path: "companies",
                element: (
                    <RoleGuard allowedRoles={["super_admin"]}>
                        <CompaniesPage />
                    </RoleGuard>
                ),
            },
            {
                path: "companies/:companyId/users",
                element: (
                    <RoleGuard allowedRoles={["super_admin"]}>
                        <CompanyUsersPage />
                    </RoleGuard>
                ),
            },
        ],
    },

    // ── Regular app routes ─────────────────────────────────────────────────────
    {
        path: "/",
        element: <AppLayout />,
        children: [
            {
                index: true,
                element: <Navigate to="/dashboard" replace />,
            },
            {
                path: "dashboard",
                element: (
                    <RoleGuard allowedRoles={["administrator", "admin_ops", "marketing", "teknisi"]}>
                        <DashboardPage />
                    </RoleGuard>
                ),
            },
            {
                path: "quotations",
                element: (
                    <RoleGuard allowedRoles={["administrator", "admin_ops", "marketing"]}>
                        <QuotationPage />
                    </RoleGuard>
                ),
            },
            {
                path: "quotations/new",
                element: (
                    <RoleGuard allowedRoles={["administrator", "marketing"]}>
                        <QuotationFormPage />
                    </RoleGuard>
                ),
            },
            {
                path: "team",
                element: (
                    <RoleGuard allowedRoles={["administrator"]}>
                        <TeamPage />
                    </RoleGuard>
                ),
            },
            {
                path: "profile",
                element: (
                    <RoleGuard allowedRoles={["administrator", "admin_ops", "marketing", "teknisi"]}>
                        <ProfilePage />
                    </RoleGuard>
                ),
            },

            // ── Coming Soon — fitur dalam pengembangan ──────────────────────
            {
                path: "customers",
                element: (
                    <RoleGuard allowedRoles={["administrator", "admin_ops", "marketing"]}>
                        <ComingSoonPage />
                    </RoleGuard>
                ),
            },
            {
                path: "spk",
                element: (
                    <RoleGuard allowedRoles={["administrator", "admin_ops", "marketing"]}>
                        <SPKPage />
                    </RoleGuard>
                ),
            },
            {
                path: "reports",
                element: (
                    <RoleGuard allowedRoles={["administrator", "admin_ops", "teknisi"]}>
                        <ComingSoonPage />
                    </RoleGuard>
                ),
            },
            {
                path: "cashflow",
                element: (
                    <RoleGuard allowedRoles={["administrator"]}>
                        <ComingSoonPage />
                    </RoleGuard>
                ),
            },
            {
                path: "performance",
                element: (
                    <RoleGuard allowedRoles={["administrator"]}>
                        <ComingSoonPage />
                    </RoleGuard>
                ),
            },
            {
                path: "settings",
                element: (
                    <RoleGuard allowedRoles={["administrator"]}>
                        <ComingSoonPage />
                    </RoleGuard>
                ),
            },
        ],
    },
]);