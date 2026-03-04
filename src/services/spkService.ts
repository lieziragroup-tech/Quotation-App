/**
 * SPK Service — Firestore CRUD
 * Collection: `spk`
 */

import {
    collection, query, where, orderBy, getDocs,
    addDoc, updateDoc, doc, getDoc, Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { SPK } from "../types";

const COL = "spk";

// ─── SERIALIZER ───────────────────────────────────────────────────────────────

function toSPK(id: string, data: Record<string, unknown>): SPK {
    return {
        id,
        quotationId: data.quotationId as string,
        quotationNoSurat: data.quotationNoSurat as string,
        customerId: (data.customerId as string) ?? "",
        customerName: data.customerName as string,
        technicianId: data.technicianId as string,
        technicianName: data.technicianName as string,
        scheduleDate: (data.scheduleDate as Timestamp).toDate(),
        actualStart: data.actualStart ? (data.actualStart as Timestamp).toDate() : undefined,
        actualEnd: data.actualEnd ? (data.actualEnd as Timestamp).toDate() : undefined,
        durationMin: data.durationMin as number | undefined,
        status: data.status as SPK["status"],
        serviceType: data.serviceType as SPK["serviceType"],
        perihal: data.perihal as string,
        lokasi: (data.lokasi as string) ?? "",
        notes: (data.notes as string) ?? "",
        companyId: data.companyId as string,
        createdAt: (data.createdAt as Timestamp).toDate(),
        createdBy: data.createdBy as string,
        createdByName: data.createdByName as string,
    };
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

export interface CreateSPKParams {
    quotationId: string;
    quotationNoSurat: string;
    customerName: string;
    technicianId: string;
    technicianName: string;
    scheduleDate: Date;
    serviceType: SPK["serviceType"];
    perihal: string;
    lokasi: string;
    notes: string;
    companyId: string;
    createdBy: string;
    createdByName: string;
}

export async function createSPK(params: CreateSPKParams): Promise<SPK> {
    const now = new Date();
    const data = {
        ...params,
        status: "assigned" as const,
        scheduleDate: Timestamp.fromDate(params.scheduleDate),
        createdAt: Timestamp.fromDate(now),
    };
    const ref = await addDoc(collection(db, COL), data);
    return toSPK(ref.id, { ...data, scheduleDate: Timestamp.fromDate(params.scheduleDate), createdAt: Timestamp.fromDate(now) });
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export interface GetSPKFilters {
    companyId: string;
    status?: SPK["status"];
    technicianId?: string;
}

export async function getSPKList(filters: GetSPKFilters): Promise<SPK[]> {
    const q = query(
        collection(db, COL),
        where("companyId", "==", filters.companyId),
        orderBy("scheduleDate", "desc"),
    );
    const snap = await getDocs(q);
    let results = snap.docs.map(d => toSPK(d.id, d.data() as Record<string, unknown>));

    if (filters.status) results = results.filter(r => r.status === filters.status);
    if (filters.technicianId) results = results.filter(r => r.technicianId === filters.technicianId);

    return results;
}

export async function getSPKById(id: string): Promise<SPK | null> {
    const snap = await getDoc(doc(db, COL, id));
    if (!snap.exists()) return null;
    return toSPK(snap.id, snap.data() as Record<string, unknown>);
}

// ─── UPDATE STATUS ────────────────────────────────────────────────────────────

export async function updateSPKStatus(
    id: string,
    status: SPK["status"],
): Promise<void> {
    const updates: Record<string, unknown> = { status };
    if (status === "in_progress") updates.actualStart = Timestamp.fromDate(new Date());
    if (status === "done") updates.actualEnd = Timestamp.fromDate(new Date());
    await updateDoc(doc(db, COL, id), updates);
}

// ─── UPDATE ASSIGN ────────────────────────────────────────────────────────────

export async function reassignSPK(
    id: string,
    technicianId: string,
    technicianName: string,
    scheduleDate: Date,
): Promise<void> {
    await updateDoc(doc(db, COL, id), {
        technicianId,
        technicianName,
        scheduleDate: Timestamp.fromDate(scheduleDate),
        status: "assigned",
    });
}