/**
 * Company Service — Firestore CRUD
 * Digunakan oleh super_admin untuk mengelola perusahaan
 */

import {
    collection, doc, getDocs, getDoc,
    addDoc, updateDoc, Timestamp, query, orderBy,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Company } from "../types";

const COL = "companies";

// ─── SERIALIZER ───────────────────────────────────────────────────────────────

function toCompany(id: string, data: Record<string, unknown>): Company {
    return {
        id,
        name: data.name as string,
        isActive: (data.isActive as boolean) ?? true,
        plan: (data.plan as Company["plan"]) ?? "free",
        expiredAt: data.expiredAt
            ? (data.expiredAt as Timestamp).toDate()
            : undefined,
    };
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getCompanies(): Promise<Company[]> {
    const q = query(collection(db, COL), orderBy("name"));
    const snap = await getDocs(q);
    return snap.docs.map(d => toCompany(d.id, d.data() as Record<string, unknown>));
}

export async function getCompanyById(id: string): Promise<Company | null> {
    const snap = await getDoc(doc(db, COL, id));
    if (!snap.exists()) return null;
    return toCompany(snap.id, snap.data() as Record<string, unknown>);
}

/**
 * Cek apakah company aktif.
 * Digunakan di LoginPage untuk memblokir login jika company nonaktif.
 */
export async function isCompanyActive(companyId: string): Promise<boolean> {
    const company = await getCompanyById(companyId);
    if (!company) return false;
    return company.isActive;
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

export interface CreateCompanyData {
    name: string;
    plan: Company["plan"];
    expiredAt?: Date;
}

export async function createCompany(data: CreateCompanyData): Promise<Company> {
    const docData: Record<string, unknown> = {
        name: data.name,
        isActive: true,
        plan: data.plan,
    };
    if (data.expiredAt) {
        docData.expiredAt = Timestamp.fromDate(data.expiredAt);
    }
    const ref = await addDoc(collection(db, COL), docData);
    return {
        id: ref.id,
        name: data.name,
        isActive: true,
        plan: data.plan,
        expiredAt: data.expiredAt,
    };
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function setCompanyActive(id: string, isActive: boolean): Promise<void> {
    await updateDoc(doc(db, COL, id), { isActive });
}

export async function updateCompanyPlan(
    id: string,
    plan: Company["plan"],
    expiredAt?: Date,
): Promise<void> {
    const updates: Record<string, unknown> = { plan };
    if (expiredAt) {
        updates.expiredAt = Timestamp.fromDate(expiredAt);
    }
    await updateDoc(doc(db, COL, id), updates);
}
