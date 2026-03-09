/**
 * Tracking Service — status pembayaran & pengerjaan per quotation (deal)
 *
 * AR  (Anti Rayap)  → 2 termin: DP + Pelunasan
 * PCO (Pest Control) → pembayaran bulanan selama kontrak berlangsung
 *
 * Collection: orderTracking/{quotationId}  (1:1 dengan quotation)
 */

import {
    doc, getDoc, setDoc, updateDoc, collection,
    query, where, getDocs, Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export type StatusPembayaran = "belum_bayar" | "dp" | "lunas" | "nunggak";
export type StatusPengerjaan  = "pending" | "berlanjut" | "selesai" | "dibatalkan";

// ─── AR: termin DP + Pelunasan ─────────────────────────────────────────────

export interface TerminAR {
    nominalDP:        number;   // nominal DP (default 50% dari total)
    tanggalDP?:       Date;
    dibayarDP:        boolean;
    tanggalBayarDP?:  Date;

    nominalPelunasan: number;   // sisa setelah DP
    tanggalPelunasan?: Date;
    dibayarPelunasan: boolean;
    tanggalBayarPelunasan?: Date;

    catatanDP?:        string;
    catatanPelunasan?: string;
}

// ─── PCO: cicilan bulanan ───────────────────────────────────────────────────

export interface CicilanBulanan {
    bulan:        string;   // "2026-03"
    label:        string;   // "Mar 2026"
    nominal:      number;
    dibayar:      boolean;
    tanggalBayar?: Date;
    catatan?:     string;
}

// ─── Main interface ─────────────────────────────────────────────────────────

export interface OrderTracking {
    id: string;
    quotationId:   string;
    noSurat:       string;
    kepadaNama:    string;
    total:         number;
    kategori:      "AR" | "PCO";
    companyId:     string;
    marketingUid:  string;
    marketingNama: string;
    tanggalDeal?:  Date;

    // Status ringkasan (computed dari termin/cicilan, tapi disimpan untuk query)
    statusPembayaran: StatusPembayaran;
    nominalDibayar:   number;

    // Detail AR
    terminAR?: TerminAR;

    // Detail PCO
    cicilanBulanan?: CicilanBulanan[];
    durasiKontrak?:  number;   // jumlah bulan
    tanggalMulaiKontrak?: Date;

    // Status pengerjaan
    statusPengerjaan:  StatusPengerjaan;
    catatanPengerjaan?: string;
    tanggalMulai?:     Date;
    tanggalSelesai?:   Date;

    updatedAt: Date;
    createdAt: Date;
}

export interface UpsertTrackingData {
    quotationId:   string;
    noSurat:       string;
    kepadaNama:    string;
    total:         number;
    kategori:      "AR" | "PCO";
    companyId:     string;
    marketingUid:  string;
    marketingNama: string;
    tanggalDeal?:  Date;

    statusPembayaran: StatusPembayaran;
    nominalDibayar:   number;

    terminAR?: TerminAR;

    cicilanBulanan?: CicilanBulanan[];
    durasiKontrak?:  number;
    tanggalMulaiKontrak?: Date;

    statusPengerjaan:   StatusPengerjaan;
    catatanPengerjaan?: string;
    tanggalMulai?:      Date;
    tanggalSelesai?:    Date;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MONTHS_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agt","Sep","Okt","Nov","Des"];

export function monthKeyToLabel(key: string): string {
    const [y, m] = key.split("-");
    return `${MONTHS_ID[parseInt(m) - 1]} ${y}`;
}

/** Generate cicilan bulanan untuk PCO baru
 *  total = biaya per bulan (bukan total kontrak)
 *  total kontrak = total × durasi
 */
export function generateCicilanBulanan(
    nominalPerBulan: number,
    durasi: number,
    tanggalMulai: Date,
): CicilanBulanan[] {
    return Array.from({ length: durasi }, (_, i) => {
        const d = new Date(tanggalMulai.getFullYear(), tanggalMulai.getMonth() + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return {
            bulan:   key,
            label:   monthKeyToLabel(key),
            nominal: nominalPerBulan,   // tiap bulan tagihan sama
            dibayar: false,
        };
    });
}

/** Generate termin AR (50% DP, 50% pelunasan) */
export function generateTerminAR(total: number): TerminAR {
    const dp = Math.round(total * 0.5);
    return {
        nominalDP:        dp,
        dibayarDP:        false,
        nominalPelunasan: total - dp,
        dibayarPelunasan: false,
    };
}

/** Hitung statusPembayaran & nominalDibayar dari termin/cicilan */
export function computeStatusPembayaran(tracking: Partial<OrderTracking>): {
    statusPembayaran: StatusPembayaran;
    nominalDibayar: number;
} {
    if (tracking.kategori === "AR" && tracking.terminAR) {
        const t = tracking.terminAR;
        const dibayar = (t.dibayarDP ? t.nominalDP : 0) + (t.dibayarPelunasan ? t.nominalPelunasan : 0);
        let status: StatusPembayaran = "belum_bayar";
        if (t.dibayarDP && t.dibayarPelunasan) status = "lunas";
        else if (t.dibayarDP) status = "dp";
        return { statusPembayaran: status, nominalDibayar: dibayar };
    }
    if (tracking.kategori === "PCO" && tracking.cicilanBulanan) {
        const cicilan    = tracking.cicilanBulanan;
        const dibayar    = cicilan.filter(c => c.dibayar).reduce((s, c) => s + c.nominal, 0);
        const totalKontrak = cicilan.reduce((s, c) => s + c.nominal, 0);
        let status: StatusPembayaran = "belum_bayar";
        if (dibayar >= totalKontrak && totalKontrak > 0) status = "lunas";
        else if (dibayar > 0) status = "dp";
        return { statusPembayaran: status, nominalDibayar: dibayar };
    }
    return { statusPembayaran: tracking.statusPembayaran ?? "belum_bayar", nominalDibayar: tracking.nominalDibayar ?? 0 };
}

// ─── Firestore serialization ─────────────────────────────────────────────────

function terminARToFS(t: TerminAR): Record<string, unknown> {
    const r: Record<string, unknown> = {
        nominalDP:        t.nominalDP,
        dibayarDP:        t.dibayarDP,
        nominalPelunasan: t.nominalPelunasan,
        dibayarPelunasan: t.dibayarPelunasan,
    };
    if (t.tanggalDP)           r.tanggalDP           = Timestamp.fromDate(t.tanggalDP);
    if (t.tanggalBayarDP)      r.tanggalBayarDP      = Timestamp.fromDate(t.tanggalBayarDP);
    if (t.tanggalPelunasan)    r.tanggalPelunasan    = Timestamp.fromDate(t.tanggalPelunasan);
    if (t.tanggalBayarPelunasan) r.tanggalBayarPelunasan = Timestamp.fromDate(t.tanggalBayarPelunasan);
    if (t.catatanDP)           r.catatanDP           = t.catatanDP;
    if (t.catatanPelunasan)    r.catatanPelunasan    = t.catatanPelunasan;
    return r;
}

function terminARFromFS(d: Record<string, unknown>): TerminAR {
    return {
        nominalDP:            (d.nominalDP as number) ?? 0,
        dibayarDP:            (d.dibayarDP as boolean) ?? false,
        nominalPelunasan:     (d.nominalPelunasan as number) ?? 0,
        dibayarPelunasan:     (d.dibayarPelunasan as boolean) ?? false,
        tanggalDP:            d.tanggalDP    ? (d.tanggalDP as Timestamp).toDate()    : undefined,
        tanggalBayarDP:       d.tanggalBayarDP ? (d.tanggalBayarDP as Timestamp).toDate() : undefined,
        tanggalPelunasan:     d.tanggalPelunasan ? (d.tanggalPelunasan as Timestamp).toDate() : undefined,
        tanggalBayarPelunasan: d.tanggalBayarPelunasan ? (d.tanggalBayarPelunasan as Timestamp).toDate() : undefined,
        catatanDP:            d.catatanDP as string | undefined,
        catatanPelunasan:     d.catatanPelunasan as string | undefined,
    };
}

function cicilanToFS(cicilan: CicilanBulanan[]): Record<string, unknown>[] {
    return cicilan.map(c => ({
        bulan:       c.bulan,
        label:       c.label,
        nominal:     c.nominal,
        dibayar:     c.dibayar,
        tanggalBayar: c.tanggalBayar ? Timestamp.fromDate(c.tanggalBayar) : null,
        catatan:     c.catatan ?? null,
    }));
}

function cicilanFromFS(arr: Record<string, unknown>[]): CicilanBulanan[] {
    return arr.map(c => ({
        bulan:       c.bulan as string,
        label:       c.label as string,
        nominal:     (c.nominal as number) ?? 0,
        dibayar:     (c.dibayar as boolean) ?? false,
        tanggalBayar: c.tanggalBayar ? (c.tanggalBayar as Timestamp).toDate() : undefined,
        catatan:     c.catatan as string | undefined,
    }));
}

function toTracking(id: string, d: Record<string, unknown>): OrderTracking {
    return {
        id,
        quotationId:    d.quotationId  as string,
        noSurat:        d.noSurat      as string,
        kepadaNama:     d.kepadaNama   as string,
        total:          (d.total as number) ?? 0,
        kategori:       (d.kategori as "AR" | "PCO") ?? "AR",
        companyId:      d.companyId    as string,
        marketingUid:   d.marketingUid as string,
        marketingNama:  d.marketingNama as string,
        tanggalDeal:    d.tanggalDeal  ? (d.tanggalDeal as Timestamp).toDate() : undefined,
        statusPembayaran: (d.statusPembayaran as StatusPembayaran) ?? "belum_bayar",
        nominalDibayar:   (d.nominalDibayar as number) ?? 0,
        terminAR:         d.terminAR ? terminARFromFS(d.terminAR as Record<string, unknown>) : undefined,
        cicilanBulanan:   d.cicilanBulanan ? cicilanFromFS(d.cicilanBulanan as Record<string, unknown>[]) : undefined,
        durasiKontrak:    d.durasiKontrak as number | undefined,
        tanggalMulaiKontrak: d.tanggalMulaiKontrak ? (d.tanggalMulaiKontrak as Timestamp).toDate() : undefined,
        statusPengerjaan: (d.statusPengerjaan as StatusPengerjaan) ?? "pending",
        catatanPengerjaan: d.catatanPengerjaan as string | undefined,
        tanggalMulai:    d.tanggalMulai   ? (d.tanggalMulai as Timestamp).toDate()   : undefined,
        tanggalSelesai:  d.tanggalSelesai ? (d.tanggalSelesai as Timestamp).toDate() : undefined,
        updatedAt:       d.updatedAt ? (d.updatedAt as Timestamp).toDate() : new Date(),
        createdAt:       d.createdAt ? (d.createdAt as Timestamp).toDate() : new Date(),
    };
}

function toFirestore(data: UpsertTrackingData): Record<string, unknown> {
    const d: Record<string, unknown> = {
        quotationId:      data.quotationId,
        noSurat:          data.noSurat,
        kepadaNama:       data.kepadaNama,
        total:            data.total,
        kategori:         data.kategori,
        companyId:        data.companyId,
        marketingUid:     data.marketingUid,
        marketingNama:    data.marketingNama,
        statusPembayaran: data.statusPembayaran,
        nominalDibayar:   data.nominalDibayar,
        statusPengerjaan: data.statusPengerjaan,
        updatedAt:        Timestamp.fromDate(new Date()),
    };
    if (data.tanggalDeal)         d.tanggalDeal         = Timestamp.fromDate(data.tanggalDeal);
    if (data.terminAR)            d.terminAR            = terminARToFS(data.terminAR);
    if (data.cicilanBulanan)      d.cicilanBulanan      = cicilanToFS(data.cicilanBulanan);
    if (data.durasiKontrak)       d.durasiKontrak       = data.durasiKontrak;
    if (data.tanggalMulaiKontrak) d.tanggalMulaiKontrak = Timestamp.fromDate(data.tanggalMulaiKontrak);
    if (data.catatanPengerjaan)   d.catatanPengerjaan   = data.catatanPengerjaan;
    if (data.tanggalMulai)        d.tanggalMulai        = Timestamp.fromDate(data.tanggalMulai);
    if (data.tanggalSelesai)      d.tanggalSelesai      = Timestamp.fromDate(data.tanggalSelesai);
    return d;
}

// ─── Public API ──────────────────────────────────────────────────────────────

const COL = "orderTracking";

export async function getTracking(quotationId: string): Promise<OrderTracking | null> {
    const snap = await getDoc(doc(db, COL, quotationId));
    if (!snap.exists()) return null;
    return toTracking(snap.id, snap.data() as Record<string, unknown>);
}

export async function getTrackingByCompany(companyId: string): Promise<OrderTracking[]> {
    const snap = await getDocs(query(
        collection(db, COL),
        where("companyId", "==", companyId),
    ));
    return snap.docs
        .map(d => toTracking(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function upsertTracking(data: UpsertTrackingData): Promise<void> {
    const ref    = doc(db, COL, data.quotationId);
    const exists = (await getDoc(ref)).exists();
    const payload = toFirestore(data);
    if (!exists) {
        payload.createdAt = Timestamp.fromDate(new Date());
        await setDoc(ref, payload);
    } else {
        await updateDoc(ref, payload);
    }
}