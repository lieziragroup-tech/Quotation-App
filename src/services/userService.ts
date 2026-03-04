/**
 * User Service — Firestore user management per company
 */

import {
    collection, query, where, getDocs, doc, updateDoc, getCountFromServer,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { AppUser } from "../types";

const COL = "users";
const MAX_USERS_PER_COMPANY = 7; // 1 administrator + 6 lainnya

// ─── READ ─────────────────────────────────────────────────────────────────────

/**
 * Ambil semua user milik sebuah company.
 * PERBAIKAN: Sertakan field `uid` dari document ID agar konsisten dengan AppUser type.
 */
export async function getUsersByCompany(companyId: string): Promise<AppUser[]> {
    const q = query(collection(db, COL), where("companyId", "==", companyId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
        uid: d.id,          // pastikan uid selalu ada
        ...(d.data() as Omit<AppUser, "uid">),
    }));
}

/**
 * Hitung jumlah user aktif di sebuah company.
 * Digunakan untuk enforce limit 7 user/company.
 */
export async function countActiveUsers(companyId: string): Promise<number> {
    const q = query(
        collection(db, COL),
        where("companyId", "==", companyId),
        where("isActive", "==", true),
    );
    const snap = await getCountFromServer(q);
    return snap.data().count;
}

/**
 * Cek apakah masih ada slot untuk user baru.
 */
export async function hasUserSlot(companyId: string): Promise<boolean> {
    const count = await countActiveUsers(companyId);
    return count < MAX_USERS_PER_COMPANY;
}

export { MAX_USERS_PER_COMPANY };

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function setUserActive(uid: string, isActive: boolean): Promise<void> {
    await updateDoc(doc(db, COL, uid), { isActive });
}