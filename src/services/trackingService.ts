/**
 * Tracking Service — status pembayaran & pengerjaan per quotation (deal)
 * Collection: orderTracking/{quotationId}  (1:1 dengan quotation)
 */

import {
    doc, getDoc, setDoc, updateDoc, collection,
    query, where, getDocs, Timestamp, orderBy,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export type StatusPembayaran = "belum_bayar" | "dp" | "lunas" | "nunggak";
export type StatusPengerjaan  = "pending" | "berlanjut" | "selesai" | "dibatalkan";

export interface OrderTracking {
    id: string;               // = quotationId
    quotationId: string;
    noSurat: string;
    kepadaNama: string;
    total: number;
    companyId: string;
    marketingUid: string;
    marketingNama: string;
    tanggalDeal?: Date;
    // Pembayaran
    statusPembayaran: StatusPembayaran;
    nominalDibayar: number;   // akumulasi yg sudah masuk
    catatanPembayaran?: string;
    // Pengerjaan
    statusPengerjaan: StatusPengerjaan;
    catatanPengerjaan?: string;
    tanggalMulai?: Date;
    tanggalSelesai?: Date;
    // Meta
    updatedAt: Date;
    createdAt: Date;
}

export interface UpsertTrackingData {
    quotationId: string;
    noSurat: string;
    kepadaNama: string;
    total: number;
    companyId: string;
    marketingUid: string;
    marketingNama: string;
    tanggalDeal?: Date;
    statusPembayaran: StatusPembayaran;
    nominalDibayar: number;
    catatanPembayaran?: string;
    statusPengerjaan: StatusPengerjaan;
    catatanPengerjaan?: string;
    tanggalMulai?: Date;
    tanggalSelesai?: Date;
}

const COL = "orderTracking";

function toTracking(id: string, d: Record<string, unknown>): OrderTracking {
    return {
        id,
        quotationId:        d.quotationId as string,
        noSurat:            d.noSurat as string,
        kepadaNama:         d.kepadaNama as string,
        total:              (d.total as number) ?? 0,
        companyId:          d.companyId as string,
        marketingUid:       d.marketingUid as string,
        marketingNama:      d.marketingNama as string,
        tanggalDeal:        d.tanggalDeal ? (d.tanggalDeal as Timestamp).toDate() : undefined,
        statusPembayaran:   (d.statusPembayaran as StatusPembayaran) ?? "belum_bayar",
        nominalDibayar:     (d.nominalDibayar as number) ?? 0,
        catatanPembayaran:  d.catatanPembayaran as string | undefined,
        statusPengerjaan:   (d.statusPengerjaan as StatusPengerjaan) ?? "pending",
        catatanPengerjaan:  d.catatanPengerjaan as string | undefined,
        tanggalMulai:       d.tanggalMulai  ? (d.tanggalMulai as Timestamp).toDate()  : undefined,
        tanggalSelesai:     d.tanggalSelesai ? (d.tanggalSelesai as Timestamp).toDate() : undefined,
        updatedAt:          d.updatedAt ? (d.updatedAt as Timestamp).toDate() : new Date(),
        createdAt:          d.createdAt ? (d.createdAt as Timestamp).toDate() : new Date(),
    };
}

function toFirestore(data: UpsertTrackingData) {
    const d: Record<string, unknown> = {
        quotationId:       data.quotationId,
        noSurat:           data.noSurat,
        kepadaNama:        data.kepadaNama,
        total:             data.total,
        companyId:         data.companyId,
        marketingUid:      data.marketingUid,
        marketingNama:     data.marketingNama,
        statusPembayaran:  data.statusPembayaran,
        nominalDibayar:    data.nominalDibayar,
        statusPengerjaan:  data.statusPengerjaan,
        updatedAt:         Timestamp.fromDate(new Date()),
    };
    if (data.tanggalDeal)       d.tanggalDeal       = Timestamp.fromDate(data.tanggalDeal);
    if (data.catatanPembayaran) d.catatanPembayaran = data.catatanPembayaran;
    if (data.catatanPengerjaan) d.catatanPengerjaan = data.catatanPengerjaan;
    if (data.tanggalMulai)      d.tanggalMulai      = Timestamp.fromDate(data.tanggalMulai);
    if (data.tanggalSelesai)    d.tanggalSelesai    = Timestamp.fromDate(data.tanggalSelesai);
    return d;
}

export async function getTracking(quotationId: string): Promise<OrderTracking | null> {
    const snap = await getDoc(doc(db, COL, quotationId));
    if (!snap.exists()) return null;
    return toTracking(snap.id, snap.data() as Record<string, unknown>);
}

export async function getTrackingByCompany(companyId: string): Promise<OrderTracking[]> {
    const snap = await getDocs(query(
        collection(db, COL),
        where("companyId", "==", companyId),
        orderBy("updatedAt", "desc"),
    ));
    return snap.docs.map(d => toTracking(d.id, d.data() as Record<string, unknown>));
}

export async function upsertTracking(data: UpsertTrackingData): Promise<void> {
    const ref = doc(db, COL, data.quotationId);
    const exists = (await getDoc(ref)).exists();
    const payload = toFirestore(data);
    if (!exists) {
        payload.createdAt = Timestamp.fromDate(new Date());
        await setDoc(ref, payload);
    } else {
        await updateDoc(ref, payload);
    }
}