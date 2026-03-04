/**
 * Quotation Service — Firestore CRUD
 */

import {
    collection, query, where, orderBy, getDocs,
    addDoc, updateDoc, doc, getDoc, Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import type {
    Quotation, QuotationStatus, KategoriSurat, TipeKontrak,
} from "../types";

const COL = "quotations";

// ─── SERIALIZER ───────────────────────────────────────────────────────────────

function toQuotation(id: string, data: Record<string, unknown>): Quotation {
    return {
        id,
        noSurat: data.noSurat as string,
        kategori: data.kategori as KategoriSurat,
        tipeKontrak: data.tipeKontrak as TipeKontrak,
        jenisLayanan: data.jenisLayanan as Quotation["jenisLayanan"],
        perihal: data.perihal as string,
        kepadaNama: data.kepadaNama as string,
        kepadaAlamatLines: (data.kepadaAlamatLines as string[]) ?? [],
        kepadaUp: data.kepadaUp as string | undefined,
        tanggal: (data.tanggal as Timestamp).toDate(),
        items: (data.items as Quotation["items"]) ?? [],
        biayaTambahan: (data.biayaTambahan as Quotation["biayaTambahan"]) ?? [],
        diskonPct: (data.diskonPct as number) ?? 0,
        ppn: (data.ppn as boolean) ?? false,
        ppnDppFaktor: data.ppnDppFaktor as number | undefined,
        garansiTahun: data.garansiTahun as number | undefined,
        jenisGaransi: data.jenisGaransi as string | undefined,
        subtotal: (data.subtotal as number) ?? 0,
        diskonRp: (data.diskonRp as number) ?? 0,
        ppnRp: (data.ppnRp as number) ?? 0,
        total: (data.total as number) ?? 0,
        marketingUid: data.marketingUid as string,
        marketingNama: data.marketingNama as string,
        marketingWa: data.marketingWa as string | undefined,
        status: data.status as QuotationStatus,
        rejectionReason: data.rejectionReason as string | undefined,
        approvedBy: data.approvedBy as string | undefined,
        approvedAt: data.approvedAt
            ? (data.approvedAt as Timestamp).toDate()
            : undefined,
        pdfUrl: data.pdfUrl as string | undefined,
        companyId: data.companyId as string,
        createdAt: (data.createdAt as Timestamp).toDate(),
    };
}

// ─── UPLOAD PDF ───────────────────────────────────────────────────────────────

export async function uploadQuotationPDF(
    pdfBlob: Blob,
    noSurat: string,
    companyId: string,
): Promise<string> {
    const safeName = noSurat.replace(/\//g, "-");
    const path = `quotations/${companyId}/${safeName}.pdf`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, pdfBlob, { contentType: "application/pdf" });
    return getDownloadURL(storageRef);
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createQuotation(
    data: Omit<Quotation, "id" | "createdAt">,
    pdfBlob: Blob,
): Promise<Quotation> {
    const pdfUrl = await uploadQuotationPDF(pdfBlob, data.noSurat, data.companyId);

    const now = new Date();
    const docData = {
        ...data,
        pdfUrl,
        tanggal: Timestamp.fromDate(data.tanggal),
        createdAt: Timestamp.fromDate(now),
        approvedAt: data.approvedAt ? Timestamp.fromDate(data.approvedAt) : null,
    };

    const docRef = await addDoc(collection(db, COL), docData);
    return { ...data, id: docRef.id, pdfUrl, createdAt: now };
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export interface GetQuotationsFilters {
    companyId: string;
    byUid?: string;
    kategori?: KategoriSurat;
    tipeKontrak?: TipeKontrak;
    status?: QuotationStatus;
}

export async function getQuotations(filters: GetQuotationsFilters): Promise<Quotation[]> {
    const constraints = [
        where("companyId", "==", filters.companyId),
        orderBy("createdAt", "desc"),
    ];

    if (filters.byUid) {
        constraints.splice(1, 0, where("marketingUid", "==", filters.byUid));
    }

    const q = query(collection(db, COL), ...constraints);
    const snap = await getDocs(q);

    let results = snap.docs.map((d) =>
        toQuotation(d.id, d.data() as Record<string, unknown>)
    );

    if (filters.kategori) results = results.filter((r) => r.kategori === filters.kategori);
    if (filters.tipeKontrak) results = results.filter((r) => r.tipeKontrak === filters.tipeKontrak);
    if (filters.status) results = results.filter((r) => r.status === filters.status);

    return results;
}

/**
 * Ambil quotation berdasarkan ID.
 * PERBAIKAN: Sertakan companyId di parameter untuk validasi ownership di sisi klien.
 * Firestore rules sudah restrict ke user yang login, tapi double-check di client
 * mencegah edge-case bug jika rules berubah.
 */
export async function getQuotationById(
    id: string,
    companyId?: string,
): Promise<Quotation | null> {
    const snap = await getDoc(doc(db, COL, id));
    if (!snap.exists()) return null;

    const quotation = toQuotation(snap.id, snap.data() as Record<string, unknown>);

    // Validasi ownership jika companyId disediakan
    if (companyId && quotation.companyId !== companyId) {
        console.warn("[getQuotationById] companyId mismatch — akses ditolak di client.");
        return null;
    }

    return quotation;
}

// ─── UPDATE STATUS ────────────────────────────────────────────────────────────

export async function updateQuotationStatus(
    id: string,
    status: QuotationStatus,
    approvedBy?: string,
    rejectionReason?: string,
): Promise<void> {
    const updates: Record<string, unknown> = { status };
    if (approvedBy) updates.approvedBy = approvedBy;
    if (rejectionReason) updates.rejectionReason = rejectionReason;
    if (status === "approved" || status === "rejected") {
        updates.approvedAt = Timestamp.fromDate(new Date());
    }
    await updateDoc(doc(db, COL, id), updates);
}