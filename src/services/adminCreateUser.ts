/**
 * Admin Create User Service
 * Menggunakan secondary Firebase Auth instance agar super_admin tidak logout
 * saat membuat akun Administrator baru.
 */

import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { authSecondary, dbSecondary } from "../lib/firebase";
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
 * Buat akun Firebase Auth + Firestore user doc menggunakan secondary app.
 * Super admin yang sedang login tidak akan terpengaruh.
 * Return: uid dari user baru.
 */
export async function createUserByAdmin(params: CreateUserParams): Promise<string> {
    // 1. Buat akun di secondary auth instance
    const credential = await createUserWithEmailAndPassword(
        authSecondary,
        params.email,
        params.password,
    );
    const uid = credential.user.uid;

    // 2. Tulis Firestore user doc DULU (masih ter-auth sebagai user baru via secondary)
    //    Sehingga request.auth.uid == userId → rules terpenuhi
    await setDoc(doc(dbSecondary, "users", uid), {
        uid,
        email: params.email,
        name: params.name,
        role: params.role,
        companyId: params.companyId,
        isActive: true,
        jabatan: params.jabatan ?? "",
        wa: params.wa ?? "",
    });

    // 3. Baru sign out dari secondary instance (tidak menyentuh primary/super_admin)
    await signOut(authSecondary);

    return uid;
}
