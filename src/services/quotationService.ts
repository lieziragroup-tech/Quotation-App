/**
 * Quotation Service — Firestore CRUD
 *
 * STRATEGI PDF:
 * PDF disimpan sebagai base64 string di field `pdfBase64` dalam Firestore document.
 * PDF ~18KB → base64 ~24KB, jauh di bawah limit Firestore 1MB/doc.
 *
 * Keuntungan vs Firebase Storage:
 * - Tidak ada round-trip upload ke Storage (~1-2s hemat)
 * - PDF tersimpan bersamaan dengan data quotation (1 write = selesai)
 * - Download/view tetap bisa dari blob URL yang dibuat di client
 * - Tidak perlu Firebase Storage rules
 */

import {
    collection, query, where, orderBy, getDocs,
    doc, getDoc, Timestamp, writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type {
    Quotation, QuotationStatus, KategoriSurat, TipeKontrak,
} from "../types";

const COL = "quotations";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Blob → base64 string */
export async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/** base64 string → Blob (untuk view/download di client) */
export function base64ToBlob(base64: string, type = "application/pdf"): Blob {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return new Blob([bytes], { type });
}

// ─── SERIALIZER ───────────────────────────────────────────────────────────────

function toQuotation(id: string, data: Record<string, unknown>): Quotation {
    return {
        id,
        noSurat:            data.noSurat as string,
        kategori:           data.kategori as KategoriSurat,
        tipeKontrak:        data.tipeKontrak as TipeKontrak,
        jenisLayanan:       data.jenisLayanan as Quotation["jenisLayanan"],
        perihal:            data.perihal as string,
        kepadaNama:         data.kepadaNama as string,
        kepadaAlamatLines:  (data.kepadaAlamatLines as string[]) ?? [],
        kepadaUp:           data.kepadaUp as string | undefined,
        tanggal:            (data.tanggal as Timestamp).toDate(),
        items:              (data.items as Quotation["items"]) ?? [],
        biayaTambahan:      (data.biayaTambahan as Quotation["biayaTambahan"]) ?? [],
        diskonPct:          (data.diskonPct as number) ?? 0,
        ppn:                (data.ppn as boolean) ?? false,
        ppnDppFaktor:       data.ppnDppFaktor as number | undefined,
        garansiTahun:       data.garansiTahun as number | undefined,
        jenisGaransi:       data.jenisGaransi as string | undefined,
        subtotal:           (data.subtotal as number) ?? 0,
        diskonRp:           (data.diskonRp as number) ?? 0,
        ppnRp:              (data.ppnRp as number) ?? 0,
        total:              (data.total as number) ?? 0,
        marketingUid:       data.marketingUid as string,
        marketingNama:      data.marketingNama as string,
        marketingWa:        data.marketingWa as string | undefined,
        status:             data.status as QuotationStatus,
        rejectionReason:    data.rejectionReason as string | undefined,
        notesMarketing:     data.notesMarketing as string | undefined,
        approvedBy:         data.approvedBy as string | undefined,
        approvedAt:         data.approvedAt ? (data.approvedAt as Timestamp).toDate() : undefined,
        pdfUrl:             data.pdfUrl as string | undefined,    // legacy field (compat)
        pdfBase64:          data.pdfBase64 as string | undefined, // new field
        companyId:          data.companyId as string,
        createdAt:          (data.createdAt as Timestamp).toDate(),
    };
}

// ─── SAVE (batch: quotation + nomorSuratLog update) ──────────────────────────

/**
 * Simpan quotation + update nomorSuratLog dalam satu writeBatch.
 * PDF disimpan sebagai base64 — tidak perlu upload ke Storage.
 * Total: 1 Firestore round-trip saja.
 */
export async function saveQuotationBatch(
    data: Omit<Quotation, "id" | "createdAt">,
    nomorSuratLogId: string,
    pdfBlob: Blob,
): Promise<Quotation> {
    const now = new Date();

    // Convert blob ke base64 (CPU only, tidak perlu network)
    const pdfBase64 = await blobToBase64(pdfBlob);

    const batch  = writeBatch(db);

    // Firestore menolak field bernilai undefined — konversi semua ke null
    const raw: Record<string, unknown> = {
        ...data,
        pdfBase64,
        pdfUrl:     null,
        tanggal:    Timestamp.fromDate(data.tanggal),
        createdAt:  Timestamp.fromDate(now),
        approvedAt: data.approvedAt ? Timestamp.fromDate(data.approvedAt) : null,
    };
    const clean = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [k, v === undefined ? null : v])
    );
    const quoRef = doc(collection(db, COL));
    batch.set(quoRef, clean);

    // Update nomorSuratLog sekaligus
    const logRef = doc(db, "nomorSuratLog", nomorSuratLogId);
    batch.update(logRef, { status: "pending", quoId: quoRef.id });

    // Satu commit = satu round-trip
    await batch.commit();

    return { ...data, id: quoRef.id, pdfBase64, createdAt: now };
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export interface GetQuotationsFilters {
    companyId: string;
    byUid?:       string;
    kategori?:    KategoriSurat;
    tipeKontrak?: TipeKontrak;
    status?:      QuotationStatus;
}

export async function getQuotations(filters: GetQuotationsFilters): Promise<Quotation[]> {
    const constraints = [
        where("companyId", "==", filters.companyId),
        orderBy("createdAt", "desc"),
    ];
    if (filters.byUid) {
        constraints.splice(1, 0, where("marketingUid", "==", filters.byUid));
    }

    const q    = query(collection(db, COL), ...constraints);
    const snap = await getDocs(q);

    let results = snap.docs.map(d => toQuotation(d.id, d.data() as Record<string, unknown>));

    if (filters.kategori)    results = results.filter(r => r.kategori    === filters.kategori);
    if (filters.tipeKontrak) results = results.filter(r => r.tipeKontrak === filters.tipeKontrak);
    if (filters.status)      results = results.filter(r => r.status      === filters.status);

    return results;
}

export async function getQuotationById(id: string): Promise<Quotation | null> {
    const snap = await getDoc(doc(db, COL, id));
    if (!snap.exists()) return null;
    return toQuotation(snap.id, snap.data() as Record<string, unknown>);
}

// ─── UPDATE STATUS ────────────────────────────────────────────────────────────

export async function updateQuotationStatus(
    id: string,
    status: QuotationStatus,
    approvedBy?: string,
    rejectionReason?: string,
    notesMarketing?: string,
): Promise<void> {
    const updates: Record<string, unknown> = { status };

    if (status === "approved") {
        if (approvedBy) updates.approvedBy = approvedBy;
        updates.approvedAt    = Timestamp.fromDate(new Date());
        updates.rejectionReason = null;
        updates.notesMarketing  = null;
    }

    if (status === "rejected") {
        if (rejectionReason)  updates.rejectionReason = rejectionReason;
        if (notesMarketing)   updates.notesMarketing  = notesMarketing;
        updates.approvedAt = Timestamp.fromDate(new Date());
    }

    const { updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(db, COL, id), updates);
}

// ─── LEGACY COMPAT (kalau ada code lain yang masih pakai createQuotation) ─────

export { saveQuotationBatch as addQuotationDoc };