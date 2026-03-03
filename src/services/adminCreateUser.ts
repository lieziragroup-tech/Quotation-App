/**
 * Admin Create User Service
 *
 * ROOT CAUSE FIX:
 * Masalah asli: `dbSecondary = getFirestore(secondaryApp)` di Firebase JS SDK v9+
 * selalu return instance SAMA dengan `db` (Firebase dedupe by project ID).
 * Akibatnya, saat secondary auth sign out, context auth untuk Firestore juga ikut
 * berubah, dan doc /users/{uid} tidak berhasil ditulis karena race condition.
 *
 * SOLUSI:
 * - Auth: tetap pakai `authSecondary` agar super_admin tidak logout
 * - Firestore: pakai `db` (primary) dan tulis SEBELUM sign out secondary
 * - Tambah rollback: jika Firestore gagal, hapus Auth user (hindari ghost account)
 */

import { createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
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
 * Buat akun Firebase Auth + Firestore user doc.
 * Auth via secondary instance (super_admin tidak logout).
 * Firestore via primary db dengan rollback jika gagal.
 */
export async function createUserByAdmin(params: CreateUserParams): Promise<string> {
    // 1. Buat Auth user via secondary (super_admin tetap login)
    const credential = await createUserWithEmailAndPassword(
        authSecondary,
        params.email,
        params.password,
    );
    const uid = credential.user.uid;

    try {
        // 2. Tulis Firestore doc via PRIMARY db
        //    (dbSecondary === db di JS SDK v9+, tidak ada perbedaan)
        //    Firestore rules harus allow: super_admin bisa write /users/{uid}
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
    } catch (firestoreErr) {
        // ROLLBACK: hapus auth user agar tidak jadi ghost account
        // (muncul di Firebase Auth tapi tidak ada di Firestore)
        try {
            await credential.user.delete();
        } catch (_) {
            // ignore rollback error
        }
        throw firestoreErr;
    } finally {
        // 3. Sign out secondary SETELAH Firestore selesai
        await signOut(authSecondary);
    }

    return uid;
}

/**
 * Kirim link aktivasi (password reset) ke email administrator baru.
 * Admin bisa klik link ini untuk set password sendiri.
 * Tidak memerlukan autentikasi khusus.
 */
export async function sendActivationEmail(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
}
