/**
 * Settings Service — menyimpan konfigurasi perusahaan di Firestore
 * Collection: companySettings/{companyId}
 */

import {
    doc, getDoc, setDoc, Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export interface CompanySettings {
    // Info perusahaan (untuk header PDF & tampilan)
    companyName: string;
    companyTagline?: string;
    headOffice: string;
    branchOffice?: string;
    telp: string;
    wa: string;
    email: string;
    website: string;
    // Nomor surat
    nomorPrefix: string;   // default "GP"
    // Tanda tangan default
    ttdNama?: string;
    ttdJabatan?: string;
    // Meta
    updatedAt?: Date;
    updatedBy?: string;
}

const COL = "companySettings";

const DEFAULTS: CompanySettings = {
    companyName:   "PT GUCI EMAS PRATAMA",
    companyTagline: "",
    headOffice:    "Jln. Ganda Sasmita No.1 Serua, Ciputat - Tangerang Selatan 15414",
    branchOffice:  "Pondok Trosobo Indah Blok I No.3, Sidoarjo - Jawa Timur. Telp : (031) 70235866",
    telp:          "(021) 74637054",
    wa:            "0817 0795 959",
    email:         "info@gucimaspratama.co.id",
    website:       "www.gucimaspratama.co.id",
    nomorPrefix:   "GP",
    ttdNama:       "",
    ttdJabatan:    "",
};

export async function getCompanySettings(companyId: string): Promise<CompanySettings> {
    const snap = await getDoc(doc(db, COL, companyId));
    if (!snap.exists()) return { ...DEFAULTS };
    const d = snap.data() as Record<string, unknown>;
    return {
        ...DEFAULTS,
        ...d,
        updatedAt: d.updatedAt ? (d.updatedAt as Timestamp).toDate() : undefined,
    };
}

export async function saveCompanySettings(
    companyId: string,
    settings: Omit<CompanySettings, "updatedAt">,
    updatedBy: string,
): Promise<void> {
    await setDoc(doc(db, COL, companyId), {
        ...settings,
        updatedAt: Timestamp.fromDate(new Date()),
        updatedBy,
    }, { merge: true });
}