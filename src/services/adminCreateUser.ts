/**
 * Admin Create User Service
 *
 * ROOT CAUSE BUGS (dua sekaligus):
 *
 * BUG 1 — Firestore write via dbSecondary:
 * `getFirestore(secondaryApp)` di Firebase JS SDK v9+ selalu return instance
 * SAMA dengan `db` (dedupe by project ID). Bukan masalah besar sendiri,
 * tapi menyebabkan kebingungan dan asumsi yang salah di kode lain.
 *
 * BUG 2 — onAuthStateChanged terpicu saat secondary sign in:
 * Karena secondary app pakai project yang sama, Firebase SDK membagikan
 * auth state listener. Ketika createUserByAdmin() memanggil
 * createUserWithEmailAndPassword(authSecondary, ...), listener di useAuth.ts
 * ikut terpicu dengan UID user baru. useAuth lalu cek Firestore,
 * dan karena Firestore write via `finally` mungkin belum selesai saat
 * listener jalan (race condition), doc tidak ditemukan → signOut dipanggil
 * → super_admin ter-logout.
 *
 * SOLUSI:
 * 1. Tulis Firestore doc SEBELUM createUserWithEmailAndPassword (tidak mungkin,
 *    butuh UID dulu), jadi:
 * 2. Pastikan Firestore write SELESAI SEBELUM secondary sign out dipanggil
 *    (tidak pakai finally untuk signOut — pakai urutan eksplisit)
 * 3. useAuth.ts diupdate untuk mengabaikan events dari secondary auth
 * 4. Rollback auth user jika Firestore gagal (hindari ghost account)
 */

import {
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
} from "firebase/auth";
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
 *
 * Urutan yang BENAR:
 * 1. createUserWithEmailAndPassword via secondary
 * 2. setDoc Firestore (primary db) — TUNTAS sebelum lanjut
 * 3. signOut secondary — HANYA setelah Firestore selesai
 * 4. Jika step 2 gagal: rollback (delete auth user), lalu signOut, lalu throw
 */
export async function createUserByAdmin(params: CreateUserParams): Promise<string> {
    // Step 1: Buat Auth user via secondary instance
    const credential = await createUserWithEmailAndPassword(
        authSecondary,
        params.email,
        params.password,
    );
    const uid = credential.user.uid;

    // Step 2: Tulis Firestore doc — HARUS selesai dulu sebelum signOut
    // Gunakan primary db (db === dbSecondary di JS SDK v9+, tidak ada bedanya,
    // tapi kita pakai `db` untuk kejelasan)
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
        // Rollback: hapus auth user agar tidak jadi ghost account
        // (muncul di Firebase Auth tapi tidak ada di Firestore)
        try {
            await credential.user.delete();
        } catch {
            // ignore rollback error — user akan jadi ghost, tapi sudah best effort
        }
        // Sign out secondary dulu baru throw
        try { await signOut(authSecondary); } catch { /* ignore */ }
        throw firestoreErr;
    }

    // Step 3: Sign out secondary HANYA setelah Firestore confirmed berhasil
    if (firestoreOk) {
        try {
            await signOut(authSecondary);
        } catch {
            // Sign out secondary gagal tidak kritikal — tidak perlu throw
            // Super admin masih aman, secondary akan expire sendiri
        }
    }

    return uid;
}

/**
 * Kirim link aktivasi (Firebase Password Reset) ke email user.
 * User klik link → bisa set password sendiri tanpa super_admin share password manual.
 * Tidak butuh autentikasi khusus untuk memanggil ini.
 */
export async function sendActivationEmail(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
}