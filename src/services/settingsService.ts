/**
 * Settings Service — menyimpan konfigurasi perusahaan di Firestore
 * Collection: companySettings/{companyId}
 */

import {
    doc, getDoc, setDoc, Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export interface TemplateConfig {
    /** Warna utama (header bar, garis pembatas, nama perusahaan di footer) — default #1a5c38 */
    primaryColor: string;
    /** Logo perusahaan sebagai base64 data URL (jpeg/png) */
    logoBase64: string;
    /** Lebar logo di PDF dalam mm (default 40) */
    logoWidthMm: number;
    /** Tinggi logo di PDF dalam mm — dihitung otomatis dari aspect ratio saat upload */
    logoHeightMm: number;
    /** Posisi logo: kiri atau kanan header */
    logoPosition: "left" | "right";
    /** Tampilkan tagline di header PDF */
    showTagline: boolean;
    /** Tampilkan branch office di header & footer PDF */
    showBranch: boolean;
    /** Tampilkan nomor halaman di footer */
    showPageNumber: boolean;
    /** Teks kustom di baris tagline (kosongkan = gunakan nilai dari companyTagline) */
    customTaglineText: string;
}

export const TEMPLATE_DEFAULTS: TemplateConfig = {
    primaryColor:    "#1a5c38",
    logoBase64:      "",
    logoWidthMm:     40,
    logoHeightMm:    15,
    logoPosition:    "right",
    showTagline:     true,
    showBranch:      true,
    showPageNumber:  true,
    customTaglineText: "",
};

export interface CompanySettings {
    // Info perusahaan (untuk header PDF & tampilan)
    companyName:    string;
    companyTagline?: string;
    headOffice:     string;
    branchOffice?:  string;
    telp:           string;
    wa:             string;
    email:          string;
    website:        string;
    // Nomor surat
    nomorPrefix:    string;   // default "GP"
    // Tanda tangan default
    ttdNama?:       string;
    ttdJabatan?:    string;
    // Template kustom (header & footer PDF)
    template?:      TemplateConfig;
    // Meta
    updatedAt?:     Date;
    updatedBy?:     string;
}

const COL = "companySettings";

const DEFAULTS: CompanySettings = {
    companyName:    "PT GUCI EMAS PRATAMA",
    companyTagline: "",
    headOffice:     "Jln. Ganda Sasmita No.1 Serua, Ciputat - Tangerang Selatan 15414",
    branchOffice:   "Pondok Trosobo Indah Blok I No.3, Sidoarjo - Jawa Timur. Telp : (031) 70235866",
    telp:           "(021) 74637054",
    wa:             "0817 0795 959",
    email:          "info@gucimaspratama.co.id",
    website:        "www.gucimaspratama.co.id",
    nomorPrefix:    "GP",
    ttdNama:        "",
    ttdJabatan:     "",
    template:       { ...TEMPLATE_DEFAULTS },
};

export async function getCompanySettings(companyId: string): Promise<CompanySettings> {
    const snap = await getDoc(doc(db, COL, companyId));
    if (!snap.exists()) return { ...DEFAULTS, template: { ...TEMPLATE_DEFAULTS } };
    const d = snap.data() as Record<string, unknown>;
    return {
        ...DEFAULTS,
        ...d,
        template: {
            ...TEMPLATE_DEFAULTS,
            ...((d.template as Partial<TemplateConfig>) ?? {}),
        },
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