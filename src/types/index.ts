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
    wa?: string;
    jabatan?: string;
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

export type JenisLayanan =
    | "anti_rayap_injeksi"
    | "anti_rayap_pipanisasi"
    | "anti_rayap_baiting"
    | "anti_rayap_pra"
    | "anti_rayap_soil"
    | "anti_rayap_fumigasi"
    | "pest_spraying"
    | "pest_fogging"
    | "pest_rodent"
    | "pest_baiting"
    | "pest_umum";

export type TipeKontrak = "U" | "K";
export type KategoriSurat = "AR" | "PCO";

export interface QuotationItem {
    desc: string;
    qty: number;
    unit: string;
    harga: number;
}

export interface BiayaTambahan {
    label: string;
    amount: number;
}

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
    isManual?: boolean;
    keteranganManual?: string;
}

export interface Quotation {
    id: string;
    noSurat: string;
    kategori: KategoriSurat;
    tipeKontrak: TipeKontrak;
    jenisLayanan: JenisLayanan;
    perihal: string;
    kepadaNama: string;
    kepadaAlamatLines: string[];
    kepadaUp?: string;
    tanggal: Date;
    items: QuotationItem[];
    biayaTambahan: BiayaTambahan[];
    diskonPct: number;
    ppn: boolean;
    ppnDppFaktor?: number;
    garansiTahun?: number;
    jenisGaransi?: string;
    subtotal: number;
    diskonRp: number;
    ppnRp: number;
    total: number;
    marketingUid: string;
    marketingNama: string;
    marketingWa?: string;
    status: QuotationStatus;
    rejectionReason?: string;
    approvedBy?: string;
    approvedAt?: Date;
    pdfUrl?: string;
    pdfBase64?: string;
    signedPdfBase64?: string;
    signedAt?: Date;
    signedBy?: string;
    companyId: string;
    createdAt: Date;
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