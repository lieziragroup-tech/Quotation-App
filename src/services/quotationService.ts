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
        notesMarketing: data.notesMarketing as string | undefined,
        approvedBy: data.approvedBy as string | undefined,
        approvedAt: data.approvedAt ? (data.approvedAt as Timestamp).toDate() : undefined,
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
    // 1. Upload PDF ke Storage
    const pdfUrl = await uploadQuotationPDF(pdfBlob, data.noSurat, data.companyId);

    // 2. Simpan ke Firestore dengan status "pending"
    const now = new Date();
    const docData = {
        ...data,
        status: "pending" as QuotationStatus, // selalu pending saat dibuat
        pdfUrl,
        tanggal: Timestamp.fromDate(data.tanggal),
        createdAt: Timestamp.fromDate(now),
        approvedAt: data.approvedAt ? Timestamp.fromDate(data.approvedAt) : null,
    };

    const docRef = await addDoc(collection(db, COL), docData);
    return { ...data, id: docRef.id, pdfUrl, createdAt: now, status: "pending" };
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export interface GetQuotationsFilters {
    companyId: string;
    byUid?: string;       // filter per marketing (undefined = semua)
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

    let results = snap.docs.map(d => toQuotation(d.id, d.data() as Record<string, unknown>));

    // Client-side filters
    if (filters.kategori) results = results.filter(r => r.kategori === filters.kategori);
    if (filters.tipeKontrak) results = results.filter(r => r.tipeKontrak === filters.tipeKontrak);
    if (filters.status) results = results.filter(r => r.status === filters.status);

    return results;
}

export async function getQuotationById(id: string): Promise<Quotation | null> {
    const snap = await getDoc(doc(db, COL, id));
    if (!snap.exists()) return null;
    return toQuotation(snap.id, snap.data() as Record<string, unknown>);
}

// ─── UPDATE STATUS ────────────────────────────────────────────────────────────

/**
 * Update status quotation.
 * - approved: set approvedBy + approvedAt
 * - rejected: set rejectionReason + notesMarketing (catatan ke marketing)
 */
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
        updates.approvedAt = Timestamp.fromDate(new Date());
        // Clear any previous rejection data
        updates.rejectionReason = null;
        updates.notesMarketing = null;
    }

    if (status === "rejected") {
        if (rejectionReason) updates.rejectionReason = rejectionReason;
        if (notesMarketing) updates.notesMarketing = notesMarketing;
        updates.approvedAt = Timestamp.fromDate(new Date()); // timestamp penolakan
    }

    await updateDoc(doc(db, COL, id), updates);
}