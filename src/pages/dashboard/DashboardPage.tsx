import { useAuthStore } from "../../store/authStore";
import { ROLE_LABELS } from "../../lib/utils";

export function DashboardPage() {
    const { user } = useAuthStore();

    return (
        <div className="p-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">
                    Selamat datang, {user?.name?.split(" ")[0]} 👋
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                    Kamu masuk sebagai{" "}
                    <span className="font-medium text-blue-600">
                        {user ? ROLE_LABELS[user.role] : ""}
                    </span>
                </p>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 max-w-md">
                <p className="text-blue-800 text-sm font-medium">
                    🚧 Dashboard sedang dalam pengembangan.
                </p>
                <p className="text-blue-600 text-sm mt-1">
                    Modul akan ditambahkan sprint per sprint.
                </p>
            </div>
        </div>
    );
}
