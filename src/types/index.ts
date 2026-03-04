export type UserRole =
    | "super_admin"
    | "administrator"
    | "admin_ops"
    | "marketing"
    | "teknisi";

export interface AppUser {
    uid: string;
    email: string;
    name: string;
    role: UserRole;
    companyId: string;
    avatar?: string;
    isActive: boolean;
    wa?: string;       // Nomor WhatsApp — muncul di PDF quotation
    jabatan?: string;  // Jabatan / title — muncul di profil
}

export interface Company {
    id: string;
    name: string;
    isActive: boolean;
    plan: "free" | "pro";
    expiredAt?: Date;
}

export interface Customer {
    id: string;
    name: string;
    phone: string;
    company?: string;
    address?: string;
    email?: string;
    pic?: string;
    source: "manual_quick" | "import";
    createdBy: string;
    lastServiceDate?: Date;
    totalProjects: number;
    companyId: string;
    createdAt: Date;
}

export type QuotationStatus = "draft" | "pending" | "approved" | "rejected";
export type ServiceType = "pest_control" | "anti_rayap";
export type ServiceMethod =
    | "spraying"
    | "fogging"
    | "baiting_tikus"
    | "injeksi"
    | "pipanisasi"
    | "baiting_system";

// ─── QUOTATION MODULE TYPES ───────────────────────────────────────────────────

/** Kode jenis layanan (key dari LAYANAN_CONFIG) */
export type JenisLayanan =
    | "anti_rayap_injeksi"
    | "anti_rayap_pipanisasi"
    | "anti_rayap_baiting"
    | "anti_rayap_pra"
    | "anti_rayap_soil"
    | "pest_spraying"
    | "pest_fogging"
    | "pest_rodent"
    | "pest_baiting"
    | "pest_fumigasi"
    | "pest_umum";

/** U = Umum (ad-hoc), K = Kontrak (berkala/tahunan) */
export type TipeKontrak = "U" | "K";

/** AR = Anti Rayap, PCO = Pest Control */
export type KategoriSurat = "AR" | "PCO";

/** Satu baris item di tabel harga */
export interface QuotationItem {
    desc: string;
    qty: number;
    unit: string;   // m2, m1, Kali, Titik, Lot, dll.
    harga: number;  // harga per unit (IDR)
}

/** Biaya tambahan di luar tabel utama */
export interface BiayaTambahan {
    label: string;
    amount: number;
}

/** Log nomor surat di Firestore collection `nomorSuratLog` */
export interface NomorSuratLog {
    id: string;
    noSurat: string;
    kategori: KategoriSurat;
    tipe: TipeKontrak;
    tipeLabel: string;
    jenisLayanan: JenisLayanan;
    kepada: string;
    byUid: string;
    byName: string;
    dibuat: Date;
    status: QuotationStatus;
    quoId: string | null;
    companyId: string;
}

export interface Quotation {
    id: string;
    // Nomor surat otomatis
    noSurat: string;                    // e.g. GP-AR/U/2026/03/0001
    kategori: KategoriSurat;            // "AR" | "PCO"
    tipeKontrak: TipeKontrak;           // "U" | "K"
    jenisLayanan: JenisLayanan;
    perihal: string;                    // otomatis dari layanan
    // Klien
    kepadaNama: string;
    kepadaAlamatLines: string[];        // array baris alamat
    kepadaUp?: string;                  // u.p. / contact person
    // Tanggal
    tanggal: Date;
    // Harga
    items: QuotationItem[];
    biayaTambahan: BiayaTambahan[];
    diskonPct: number;                  // 0 jika tidak ada
    ppn: boolean;
    ppnDppFaktor?: number;              // e.g. 11/12 untuk DPP nilai lain
    garansiTahun?: number;              // 0 / null jika tidak ada garansi
    jenisGaransi?: string;              // label garansi
    // Kalkulasi (computed & disimpan)
    subtotal: number;
    diskonRp: number;
    ppnRp: number;
    total: number;
    // Marketing
    marketingUid: string;
    marketingNama: string;
    marketingWa?: string;
    // Status
    status: QuotationStatus;
    rejectionReason?: string;
    approvedBy?: string;
    approvedAt?: Date;
    // PDF
    pdfUrl?: string;
    // Meta
    companyId: string;
    createdAt: Date;
    // Legacy fields (keep for backward compat)
    customerId?: string;
    notesMarketing?: string;
}

export interface TariffRow {
    service: ServiceType;
    method: ServiceMethod;
    label: string;
    basis: "m2" | "m_linear" | "titik";
    hppRate: number;
    sellRate: number;
}

export interface PricingConfig {
    tariffTable: TariffRow[];
    bbmZones: { zona_a: number; zona_b: number; zona_c: number };
    warrantyMultiplier: { y1: number; y2: number; y3: number };
    marginGuard: { blockBelow: number; warnBelow: number; premiumAbove: number };
}

export interface SPK {
    id: string;
    quotationId: string;
    quotationNoSurat: string;
    customerId: string;
    customerName: string;
    technicianId: string;
    technicianName: string;
    scheduleDate: Date;
    actualStart?: Date;
    actualEnd?: Date;
    durationMin?: number;
    status: "assigned" | "in_progress" | "done";
    gpsStart?: { lat: number; lng: number };
    gpsEnd?: { lat: number; lng: number };
    serviceType: ServiceType;
    perihal: string;
    lokasi: string;
    notes: string;
    companyId: string;
    createdAt: Date;
    createdBy: string;
    createdByName: string;
}

export interface Report {
    id: string;
    spkId: string;
    technicianId: string;
    technicianName: string;
    customerId: string;
    customerName: string;
    serviceType: ServiceType;
    formData: Record<string, unknown>;
    photos: string[];
    submittedAt: Date;
    durationMin: number;
    pdfUrl: string;
    shareToken: string;
    sentToClient: boolean;
    sentAt?: Date;
    companyId: string;
}
