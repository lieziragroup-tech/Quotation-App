/**
 * Nomor Surat Service
 * Menggunakan Firestore collection `nomorSuratLog`
 * Format: GP-{kategori}/{tipe}/YYYY/MM/XXXX
 */

import {
    collection, query, where, orderBy, getDocs,
    addDoc, updateDoc, doc, Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { buildNomorSurat, TIPE_LABELS } from "../lib/quotationConfig";
import type { NomorSuratLog, KategoriSurat, TipeKontrak, JenisLayanan, QuotationStatus } from "../types";

const COL = "nomorSuratLog";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function toLog(id: string, data: Record<string, unknown>): NomorSuratLog {
    return {
        id,
        noSurat: data.noSurat as string,
        kategori: data.kategori as KategoriSurat,
        tipe: data.tipe as TipeKontrak,
        tipeLabel: data.tipeLabel as string,
        jenisLayanan: data.jenisLayanan as JenisLayanan,
        kepada: data.kepada as string,
        byUid: data.byUid as string,
        byName: data.byName as string,
        dibuat: (data.dibuat as Timestamp).toDate(),
        status: data.status as QuotationStatus,
        quoId: (data.quoId as string | null) ?? null,
        companyId: data.companyId as string,
        isManual: (data.isManual as boolean | undefined) ?? false,
        keteranganManual: (data.keteranganManual as string | undefined) ?? "",
    };
}

// ─── GENERATE NOMOR SURAT ─────────────────────────────────────────────────────

export interface GenerateNomorParams {
    kategori: KategoriSurat;
    tipe: TipeKontrak;
    jenisLayanan: JenisLayanan;
    kepada: string;
    byUid: string;
    byName: string;
    companyId: string;
    dryRun?: boolean;  // true = preview saja, tidak disimpan
}

/**
 * Generate nomor surat baru.
 * Urutan reset tiap bulan per kombinasi kategori + tipe.
 * dryRun = true → hanya return preview tanpa simpan ke Firestore.
 */
export async function generateNomorSurat(params: GenerateNomorParams): Promise<NomorSuratLog> {
    const { kategori, tipe, jenisLayanan, kepada, byUid, byName, companyId, dryRun = false } = params;

    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `GP-${kategori}/${tipe}/${yyyy}/${mm}/`;

    // Cari semua nomor bulan ini dengan prefix yang sama (per companyId)
    const q = query(
        collection(db, COL),
        where("companyId", "==", companyId),
        where("kategori", "==", kategori),
        where("tipe", "==", tipe),
    );
    const snap = await getDocs(q);

    // Filter yang bulan ini
    const existing = snap.docs
        .map(d => d.data().noSurat as string)
        .filter(ns => ns.startsWith(prefix));

    const seqs = existing.map(ns => parseInt(ns.split("/").pop() ?? "0") || 0);
    const nextSeq = seqs.length > 0 ? Math.max(...seqs) + 1 : 1;

    const noSurat = buildNomorSurat(kategori, tipe, yyyy, mm, nextSeq);

    const entry: Omit<NomorSuratLog, "id"> = {
        noSurat,
        kategori,
        tipe,
        tipeLabel: TIPE_LABELS[tipe] ?? tipe,
        jenisLayanan,
        kepada,
        byUid,
        byName,
        dibuat: now,
        status: "draft",
        quoId: null,
        companyId,
    };

    if (!dryRun) {
        const ref = await addDoc(collection(db, COL), {
            ...entry,
            dibuat: Timestamp.fromDate(now),
        });
        return { ...entry, id: ref.id };
    }

    return { ...entry, id: "preview" };
}

// ─── PREVIEW NOMOR (dry-run) ──────────────────────────────────────────────────

/**
 * Preview nomor surat tanpa menyimpan ke Firestore.
 * Digunakan di step 1 form untuk tampilkan nomor real-time.
 */
export async function previewNomorSurat(
    kategori: KategoriSurat,
    tipe: TipeKontrak,
    companyId: string,
): Promise<string> {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `GP-${kategori}/${tipe}/${yyyy}/${mm}/`;

    const q = query(
        collection(db, COL),
        where("companyId", "==", companyId),
        where("kategori", "==", kategori),
        where("tipe", "==", tipe),
    );
    const snap = await getDocs(q);

    const existing = snap.docs
        .map(d => d.data().noSurat as string)
        .filter(ns => ns.startsWith(prefix));

    const seqs = existing.map(ns => parseInt(ns.split("/").pop() ?? "0") || 0);
    const nextSeq = seqs.length > 0 ? Math.max(...seqs) + 1 : 1;

    return buildNomorSurat(kategori, tipe, yyyy, mm, nextSeq);
}

// ─── QUERY LOG ────────────────────────────────────────────────────────────────

export interface GetLogFilters {
    byUid?: string;      // filter per marketing
    kategori?: KategoriSurat;
    tipe?: TipeKontrak;
    status?: QuotationStatus;
    companyId: string;
}

export async function getNomorSuratLog(filters: GetLogFilters): Promise<NomorSuratLog[]> {
    let q = query(
        collection(db, COL),
        where("companyId", "==", filters.companyId),
        orderBy("dibuat", "desc"),
    );

    // Firestore tidak support multiple inequality filters; filter di client
    const snap = await getDocs(q);
    let entries = snap.docs.map(d => toLog(d.id, d.data()));

    if (filters.byUid) entries = entries.filter(e => e.byUid === filters.byUid);
    if (filters.kategori) entries = entries.filter(e => e.kategori === filters.kategori);
    if (filters.tipe) entries = entries.filter(e => e.tipe === filters.tipe);
    if (filters.status) entries = entries.filter(e => e.status === filters.status);

    return entries;
}

// ─── UPDATE STATUS ────────────────────────────────────────────────────────────

export async function updateNomorSuratStatus(
    logId: string,
    status: QuotationStatus,
    quoId?: string,
): Promise<void> {
    const ref = doc(db, COL, logId);
    await updateDoc(ref, {
        status,
        ...(quoId ? { quoId } : {}),
    });
}

// ─── TAMBAH MANUAL ────────────────────────────────────────────────────────────

export interface AddManualNomorParams {
    noSurat: string;
    kategori: KategoriSurat;
    tipe: TipeKontrak;
    jenisLayanan: JenisLayanan;
    kepada: string;
    byUid: string;
    byName: string;
    companyId: string;
    keteranganManual?: string;
    dibuat?: Date;
}

/**
 * Tambah nomor surat secara manual (bukan generate otomatis).
 * Digunakan untuk tracking surat fisik / luar sistem.
 */
export async function addManualNomorSurat(params: AddManualNomorParams): Promise<NomorSuratLog> {
    const now = params.dibuat ?? new Date();
    const entry: Omit<NomorSuratLog, "id"> = {
        noSurat: params.noSurat,
        kategori: params.kategori,
        tipe: params.tipe,
        tipeLabel: TIPE_LABELS[params.tipe] ?? params.tipe,
        jenisLayanan: params.jenisLayanan,
        kepada: params.kepada,
        byUid: params.byUid,
        byName: params.byName,
        dibuat: now,
        status: "draft",
        quoId: null,
        companyId: params.companyId,
        isManual: true,
        keteranganManual: params.keteranganManual ?? "",
    };

    const ref = await addDoc(collection(db, COL), {
        ...entry,
        dibuat: Timestamp.fromDate(now),
    });

    return { ...entry, id: ref.id };
}
