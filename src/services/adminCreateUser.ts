import {
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
// PERBAIKAN: Hapus dbSecondary — Firestore tidak punya auth context per-instance.
// Selalu pakai `db` (primary) untuk semua operasi Firestore.
import { authSecondary, db, auth } from "../lib/firebase";
import type { UserRole } from "../types";

export interface CreateUserParams {
    email: string;
    password: string;
    name: string;
    role: Extract<UserRole, "administrator" | "marketing" | "admin_ops" | "teknisi">;
    companyId: string;
    jabatan?: string;
    wa?: string;
}

/**
 * Membuat user baru oleh admin/super_admin tanpa mengganggu sesi login mereka.
 * Proses:
 * 1. Buat akun di Firebase Auth via secondary app instance
 * 2. Tulis dokumen user ke Firestore (pakai primary db — rules cek auth.uid super_admin/admin)
 * 3. Logout secondary app agar tidak ada sesi tersisa
 *
 * CATATAN KEAMANAN: Firestore rules harus mengizinkan super_admin atau administrator
 * menulis ke /users/{userId}. Rules saat ini sudah mengizinkan ini.
 */
export async function createUserByAdmin(params: CreateUserParams): Promise<string> {
    const credential = await createUserWithEmailAndPassword(
        authSecondary,
        params.email,
        params.password,
    );
    const uid = credential.user.uid;

    let firestoreOk = false;
    try {
        await setDoc(doc(db, "users", uid), {
            uid,
            email: params.email,
            name: params.name,
            role: params.role,
            companyId: params.companyId,
            isActive: true,
            jabatan: params.jabatan ?? "",
            wa: params.wa ?? "",
        });
        firestoreOk = true;
    } catch (firestoreErr) {
        // Rollback: hapus akun Auth yang sudah dibuat
        try {
            await credential.user.delete();
        } catch (_e) {
            void _e;
        }
        try {
            await signOut(authSecondary);
        } catch (_e) {
            void _e;
        }
        throw firestoreErr;
    }

    if (firestoreOk) {
        try {
            await signOut(authSecondary);
        } catch (_e) {
            void _e;
        }
    }

    return uid;
}


export async function sendActivationEmail(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
}