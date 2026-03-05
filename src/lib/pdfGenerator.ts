/**
 * PDF Generator — PT Guci Emas Pratama
 * Menggunakan jsPDF untuk generate quotation PDF
 * Mereplikasi layout template surat penawaran resmi
 */

import jsPDF from "jspdf";
import type { QuotationItem, BiayaTambahan, JenisLayanan } from "../types";
import {
    COMPANY, BRAND, LAYANAN_CONFIG,
    fmtIDR, fmtDateID, calcTotals, buildParagrafPembuka, angkaKeKata, isAntiRayap,
} from "./quotationConfig";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface QuotationPDFData {
    noSurat: string;
    tanggal: Date;
    kepadaNama: string;
    kepadaAlamatLines: string[];
    kepadaUp?: string;
    jenisLayanan: JenisLayanan;
    perihal?: string;
    paragrafPembuka?: string;
    items: QuotationItem[];
    biayaTambahan?: BiayaTambahan[];
    diskonPct?: number;
    ppn?: boolean;
    ppnDppFaktor?: number;
    garansiTahun?: number;
    jenisGaransi?: string;
    marketingNama?: string;
    marketingWa?: string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const PAGE_W  = 210;   // A4 mm
const PAGE_H  = 297;
const ML      = 20;    // margin left
const MR      = 20;    // margin right
const MT      = 14;    // margin top
const MB      = 18;    // margin bottom
const USABLE_W = PAGE_W - ML - MR;
const KOP_H   = 30;    // kop surat height (increased slightly)
const FOOTER_H = 20;   // footer height
const LINE_H  = 5;     // standard line height

// ─── HELPER: HEX → RGB ───────────────────────────────────────────────────────

function hex(h: string): [number, number, number] {
    const s = h.replace("#", "");
    return [
        parseInt(s.substring(0, 2), 16),
        parseInt(s.substring(2, 4), 16),
        parseInt(s.substring(4, 6), 16),
    ];
}

// ─── RENDERER CLASS ───────────────────────────────────────────────────────────

class QuotationRenderer {
    private doc: jsPDF;
    private y: number;
    private pageNum = 1;
    private data: QuotationPDFData;
    private calc: ReturnType<typeof calcTotals>;

    // Column widths for price table (computed once, reused)
    private readonly colNo  = 9;
    private readonly colPek: number;
    private readonly colVol: number;
    private readonly colHs: number;
    private readonly colJml: number;

    constructor(data: QuotationPDFData) {
        this.data = data;
        this.doc  = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
        this.y    = MT + KOP_H + 6;

        this.calc = calcTotals({
            items: data.items,
            biayaTambahan: data.biayaTambahan,
            diskonPct: data.diskonPct,
            ppn: data.ppn,
            ppnDppFaktor: data.ppnDppFaktor,
        });

        // Distribute remaining width: Pekerjaan 38%, Volume 16%, HargaSatuan 22%, Jumlah rest
        const remaining = USABLE_W - this.colNo;
        this.colPek = remaining * 0.38;
        this.colVol = remaining * 0.16;
        this.colHs  = remaining * 0.22;
        this.colJml = remaining - this.colPek - this.colVol - this.colHs;
    }

    // ─── Page management ─────────────────────────────────────────────────────

    private checkPage(needed: number) {
        if (this.y + needed > PAGE_H - MB - FOOTER_H) {
            this.newPage();
        }
    }

    private newPage() {
        this.drawFooter();
        this.doc.addPage();
        this.pageNum++;
        this.y = MT + KOP_H + 6;
        this.drawKop();
    }

    // ─── Kop Surat ───────────────────────────────────────────────────────────

    private drawKop() {
        const d = this.doc;
        const ty = MT;

        // Top green bar
        d.setFillColor(...hex(BRAND.green));
        d.rect(ML, ty, USABLE_W, 2.5, "F");

        // Company name
        d.setFontSize(15);
        d.setFont("helvetica", "bold");
        d.setTextColor(...hex(BRAND.green));
        d.text(COMPANY.name, ML, ty + 9);

        // Tagline
        d.setFontSize(7.5);
        d.setFont("helvetica", "normal");
        d.setTextColor(...hex(BRAND.gray));
        d.text("Jasa Anti Rayap & Pengendalian Hama Profesional  ·  Est. 1985", ML, ty + 13.5);

        // Separator line
        d.setDrawColor(...hex(BRAND.green));
        d.setLineWidth(0.4);
        d.line(ML, ty + 16, ML + USABLE_W, ty + 16);

        // Contact info
        d.setFontSize(6.8);
        d.setFont("helvetica", "normal");
        d.setTextColor(...hex(BRAND.gray));
        d.text(`Head Office : ${COMPANY.head}`, ML, ty + 19.5);
        d.text(
            `Telp : ${COMPANY.telp}  |  WhatsApp : ${COMPANY.wa}  |  E-Mail : ${COMPANY.email}  |  ${COMPANY.web}`,
            ML, ty + 23,
        );
        d.text(`Branch Office : ${COMPANY.branch}`, ML, ty + 26.5);
    }

    // ─── Footer ──────────────────────────────────────────────────────────────

    private drawFooter() {
        const d   = this.doc;
        const fy  = PAGE_H - MB - FOOTER_H + 2;

        d.setDrawColor(...hex(BRAND.green));
        d.setLineWidth(0.4);
        d.line(ML, fy, ML + USABLE_W, fy);

        d.setFontSize(7);
        d.setFont("helvetica", "bold");
        d.setTextColor(...hex(BRAND.green));
        d.text(COMPANY.name, ML, fy + 4.5);

        d.setFontSize(6.5);
        d.setFont("helvetica", "normal");
        d.setTextColor(...hex(BRAND.gray));
        d.text(`Head Office : ${COMPANY.head}`, ML, fy + 8.5);
        d.text(
            `Telp : ${COMPANY.telp}  |  WhatsApp : ${COMPANY.wa}  |  ${COMPANY.email}  |  ${COMPANY.web}`,
            ML, fy + 12,
        );
        d.text(`Branch Office : ${COMPANY.branch}`, ML, fy + 15.5);

        d.setFontSize(7.5);
        d.setFont("helvetica", "bold");
        d.setTextColor(...hex(BRAND.grayLight));
        d.text(`Hal. ${this.pageNum}`, ML + USABLE_W, fy + 15.5, { align: "right" });
    }

    // ─── Text helpers ─────────────────────────────────────────────────────────

    private set(
        size: number,
        bold: boolean,
        color: string,
    ) {
        this.doc.setFontSize(size);
        this.doc.setFont("helvetica", bold ? "bold" : "normal");
        this.doc.setTextColor(...hex(color));
    }

    private text(
        txt: string,
        x: number,
        opts?: { align?: "left" | "right" | "center"; dy?: number },
    ) {
        const yy = this.y + (opts?.dy ?? 0);
        this.doc.text(txt, x, yy, { align: opts?.align ?? "left" });
    }

    private nl(gap: number = LINE_H) { this.y += gap; }

    private wrap(txt: string, maxW: number, size: number): string[] {
        this.doc.setFontSize(size);
        return this.doc.splitTextToSize(txt, maxW) as string[];
    }

    /** Write wrapped text, advance y by total height, return total height used. */
    private writeWrapped(
        txt: string,
        x: number,
        maxW: number,
        size = 9,
        bold = false,
        color = BRAND.dark,
        lineH = LINE_H,
    ): number {
        this.set(size, bold, color);
        const lines = this.wrap(txt, maxW, size);
        lines.forEach((line, i) => {
            this.doc.text(line, x, this.y + i * lineH);
        });
        return lines.length * lineH;
    }

    // ─── Section heading helper ───────────────────────────────────────────────

    private sectionTitle(title: string) {
        this.checkPage(10);
        this.set(10, true, BRAND.green);
        this.text(title, ML);
        this.nl(6);
    }

    // ─── HR ──────────────────────────────────────────────────────────────────

    private hr(color = BRAND.border, lw = 0.3) {
        this.doc.setDrawColor(...hex(color));
        this.doc.setLineWidth(lw);
        this.doc.line(ML, this.y, ML + USABLE_W, this.y);
    }

    // ─── Header Info (Kepada, Perihal, Salam Pembuka) ─────────────────────────

    private buildHeaderInfo() {
        const d = this.doc;
        const { data } = this;

        // ── No. surat (kiri) + Tanggal (kanan) ──────────────────────────────
        this.checkPage(10);
        this.set(9, false, BRAND.dark);
        // "No:" label
        d.text("No:", ML, this.y);
        // nomor surat — bold, offset setelah label
        this.set(9, true, BRAND.dark);
        d.text(data.noSurat, ML + 8, this.y);
        // tanggal di kanan
        this.set(9, false, BRAND.dark);
        d.text(`Tangerang Selatan, ${fmtDateID(data.tanggal)}`, ML + USABLE_W, this.y, { align: "right" });
        this.nl(8);

        // ── Kepada ───────────────────────────────────────────────────────────
        this.checkPage(30);
        this.set(9, false, BRAND.dark);
        this.text("Kepada Yth.", ML);
        this.nl(LINE_H);

        this.set(9, true, BRAND.dark);
        this.text(data.kepadaNama, ML);
        this.nl(LINE_H);

        this.set(9, false, BRAND.dark);
        for (const line of data.kepadaAlamatLines.filter(Boolean)) {
            this.text(line, ML);
            this.nl(LINE_H);
        }

        if (data.kepadaUp) {
            this.text(`Up : ${data.kepadaUp}`, ML);
            this.nl(LINE_H);
        }
        this.nl(3);

        // ── Perihal ──────────────────────────────────────────────────────────
        this.checkPage(8);
        const perihal = data.perihal ?? LAYANAN_CONFIG[data.jenisLayanan]?.perihal ?? "Penawaran Harga";
        this.set(9, false, BRAND.dark);
        d.text("Perihal: ", ML, this.y);
        this.set(9, true, BRAND.dark);
        d.text(perihal, ML + 17, this.y);
        this.nl(9);

        // ── Salam + Paragraf Pembuka ──────────────────────────────────────────
        this.set(9, false, BRAND.dark);
        this.text("Dengan hormat,", ML);
        this.nl(LINE_H + 1);

        const alamat = data.kepadaAlamatLines.filter(Boolean).join(", ");
        const pembuka = data.paragrafPembuka ?? buildParagrafPembuka(data.jenisLayanan, data.kepadaNama, alamat);
        const h1 = this.writeWrapped(pembuka, ML, USABLE_W, 9, false, BRAND.dark);
        this.nl(h1 + 3);

        this.checkPage(8);
        const kalimatBerlaku = "Surat penawaran ini berlaku selama 30 (tiga puluh) hari sejak tanggal surat dibuat.";
        const h2 = this.writeWrapped(kalimatBerlaku, ML, USABLE_W, 9, false, BRAND.dark);
        this.nl(h2 + 3);

        this.checkPage(14);
        const kalimatPenutup = "Mohon proposal ini dipelajari dan kami dengan senang hati membantu apabila masih ada hal-hal yang kurang jelas. Demikian proposal penawaran ini kami sampaikan, atas perhatian dan kerjasama anda, kami ucapkan terima kasih.";
        const h3 = this.writeWrapped(kalimatPenutup, ML, USABLE_W, 9, false, BRAND.dark);
        this.nl(h3 + 6);

        this.set(9, false, BRAND.dark);
        this.text("Jabat Erat,", ML);
        this.nl(LINE_H);
        this.set(9, true, BRAND.dark);
        this.text("PT Guci Emas Pratama", ML);
        this.nl(7);
    }

    // ─── Biaya Section ────────────────────────────────────────────────────────

    private buildBiayaSection() {
        const d = this.doc;
        const { data, calc } = this;

        // ── Section title ────────────────────────────────────────────────────
        this.sectionTitle("BIAYA PELAKSANAAN");

        this.checkPage(6);
        this.set(9, false, BRAND.dark);
        this.text("Berdasarkan hasil survey, berikut penawaran harga yang kami ajukan:", ML);
        this.nl(LINE_H + 1);

        // ── Table header ─────────────────────────────────────────────────────
        const ROW_H  = 8;
        const HDR_H  = 9;
        const tblX   = ML;

        // Column X positions
        const xNo   = tblX;
        const xPek  = xNo + this.colNo;
        const xVol  = xPek + this.colPek;
        const xHs   = xVol + this.colVol;
        const xJml  = xHs + this.colHs;
        const xEnd  = xJml + this.colJml;

        this.checkPage(HDR_H + ROW_H);
        const hdrY = this.y;

        // Header background
        d.setFillColor(...hex(BRAND.tableHeader));
        d.rect(tblX, hdrY - 6, USABLE_W, HDR_H, "F");

        // Header text
        d.setFontSize(8.5);
        d.setFont("helvetica", "bold");
        d.setTextColor(255, 255, 255);
        d.text("No",           xNo + this.colNo / 2,        hdrY, { align: "center" });
        d.text("Pekerjaan",    xPek + 2,                    hdrY);
        d.text("Volume Kerja", xVol + this.colVol / 2,      hdrY, { align: "center" });
        d.text("Harga Satuan", xHs  + this.colHs / 2,       hdrY, { align: "center" });
        d.text("Jumlah",       xEnd - 2,                    hdrY, { align: "right" });
        this.nl(HDR_H - 1);

        // ── Item rows ────────────────────────────────────────────────────────
        const allRows: Array<{ no: string; desc: string; qty: number; unit: string; harga: number; extra: boolean }> = [
            ...data.items.map((it, i) => ({
                no:    String(i + 1),
                desc:  it.desc,
                qty:   it.qty,
                unit:  it.unit,
                harga: it.harga,
                extra: false,
            })),
            ...(data.biayaTambahan ?? []).map(b => ({
                no:    "",
                desc:  b.label,
                qty:   1,
                unit:  "ls",
                harga: b.amount,
                extra: true,
            })),
        ];

        allRows.forEach((row, idx) => {
            this.checkPage(ROW_H + 2);
            const rowStartY = this.y - 5;

            // Alternating background (non-header)
            if (idx % 2 === 1) {
                d.setFillColor(...hex(BRAND.tableAlt));
                d.rect(tblX, rowStartY, USABLE_W, ROW_H, "F");
            }

            // Row content
            d.setFontSize(8.5);
            d.setFont("helvetica", "normal");
            d.setTextColor(...hex(BRAND.dark));

            // No
            if (row.no) d.text(row.no, xNo + this.colNo / 2, this.y, { align: "center" });

            // Description — truncate if too long
            const descLines = this.wrap(row.desc, this.colPek - 4, 8.5);
            d.text(descLines[0] ?? "", xPek + 2, this.y);

            // Volume
            d.text(
                `${row.qty.toLocaleString("id-ID")} ${row.unit}`,
                xVol + this.colVol / 2, this.y, { align: "center" },
            );

            // Harga satuan — right aligned
            d.text(fmtIDR(row.harga), xHs + this.colHs - 2, this.y, { align: "right" });

            // Jumlah — bold, right aligned
            d.setFont("helvetica", "bold");
            d.text(fmtIDR(row.qty * row.harga), xEnd - 2, this.y, { align: "right" });

            // Row bottom border
            d.setDrawColor(...hex(BRAND.border));
            d.setLineWidth(0.25);
            d.line(tblX, this.y + 3, xEnd, this.y + 3);

            this.nl(ROW_H);
        });

        // ── Summary rows ─────────────────────────────────────────────────────
        this.nl(1);
        this.buildSummaryRows(xNo, xPek, xVol, xHs, xJml, xEnd);

        // ── PPN note ─────────────────────────────────────────────────────────
        this.nl(3);
        this.checkPage(8);
        this.set(8, false, BRAND.gray);
        const ppnNote = data.ppn
            ? "*Biaya tersebut di atas sudah termasuk PPN (sesuai peraturan yang berlaku)."
            : "*Biaya tersebut di atas belum termasuk PPN (sesuai ketentuan yang berlaku).";
        this.doc.setFont("helvetica", "italic");
        this.text(ppnNote, ML);
        this.nl(8);
    }

    // ─── Summary rows (Jumlah / Diskon / Total) ───────────────────────────────

    private buildSummaryRows(
        _xNo: number, _xPek: number, _xVol: number,
        xHs: number, _xJml: number, xEnd: number,
    ) {
        const d    = this.doc;
        const { calc } = this;

        // Summary starts from the "Harga Satuan" column onwards
        const summaryX  = xHs;
        const summaryW  = this.colHs + this.colJml;
        const xLabel    = summaryX + 3;

        interface SummaryRow { label: string; value: number; isTotal?: boolean; isDiskon?: boolean }
        const rows: SummaryRow[] = [];
        rows.push({ label: "Jumlah", value: calc.subtotalGross });

        if (calc.diskonRp > 0) {
            const discPct = calc.diskonPct ? ` (${Number(calc.diskonPct).toFixed(0)}%)` : "";
            rows.push({ label: `Diskon${discPct}`, value: calc.diskonRp, isDiskon: true });
            rows.push({ label: "Total Biaya", value: calc.setelahDiskon });
        }

        if (calc.dpp) {
            rows.push({ label: "DPP Nilai Lain (11/12)", value: calc.dpp });
            rows.push({ label: "PPN 12%", value: calc.ppnRp });
        } else if (calc.ppnRp > 0) {
            rows.push({ label: "PPN 11%", value: calc.ppnRp });
        }

        rows.push({ label: "TOTAL", value: calc.total, isTotal: true });

        rows.forEach(row => {
            const rowH = row.isTotal ? 9 : 7;
            this.checkPage(rowH + 2);
            const rowStartY = this.y - 5;

            if (row.isTotal) {
                // Dark green background for total row
                d.setFillColor(...hex(BRAND.totalBg));
                d.rect(summaryX, rowStartY, summaryW, rowH, "F");
                this.set(9.5, true, "#ffffff");
            } else {
                this.set(8.5, false, BRAND.dark);
            }

            // Label
            d.text(row.label, xLabel, this.y);

            // Value — right aligned
            const valStr = row.isDiskon ? `- ${fmtIDR(row.value)}` : fmtIDR(row.value);
            if (!row.isTotal) this.set(8.5, false, BRAND.dark);
            d.text(valStr, xEnd - 2, this.y, { align: "right" });

            // Borders (left, inner divider, right, bottom)
            d.setDrawColor(...hex(row.isTotal ? BRAND.totalBg : BRAND.border));
            d.setLineWidth(row.isTotal ? 0 : 0.25);
            d.line(summaryX, this.y + 3, xEnd, this.y + 3);    // bottom
            d.setLineWidth(0.3);
            d.setDrawColor(...hex(BRAND.border));
            d.line(summaryX, rowStartY, summaryX, this.y + 3);  // left
            d.line(xEnd,     rowStartY, xEnd,     this.y + 3);  // right
            // inner divider roughly where label ends
            d.line(xHs + this.colHs, rowStartY, xHs + this.colHs, this.y + 3);

            this.nl(rowH);
        });
    }

    // ─── Pembayaran ───────────────────────────────────────────────────────────

    private buildPembayaran() {
        const d = this.doc;
        this.checkPage(30);

        this.sectionTitle("PEMBAYARAN");

        this.set(9, false, BRAND.dark);
        this.text("Pembayaran dilakukan 2 (dua) tahap, yaitu:", ML);
        this.nl(LINE_H + 1);

        const tahap = [
            "Tahap I, sebesar 50 % dari nilai kontrak, dibayar saat penandatanganan surat kontrak.",
            "Tahap II, sebesar 50 % dari nilai kontrak, dibayarkan setelah pekerjaan selesai.",
        ];

        tahap.forEach(t => {
            this.checkPage(6);
            const h = this.writeWrapped(`• ${t}`, ML + 3, USABLE_W - 3, 9, false, BRAND.dark);
            this.nl(h + 2);
        });

        this.nl(3);
    }

    // ─── Garansi ─────────────────────────────────────────────────────────────

    private buildGaransi() {
        const { data } = this;
        if (!data.garansiTahun) return;

        const d   = this.doc;
        const thn = data.garansiTahun;
        const jenis = data.jenisGaransi ?? "Anti Rayap";
        const isPra = data.jenisLayanan.includes("pra") || data.jenisLayanan.includes("pipanisasi");

        this.checkPage(30);
        this.sectionTitle("GARANSI");

        const garansiTxt = isPra
            ? `Untuk pekerjaan ${jenis} ini, kami memberikan garansi bebas rayap yang dinyatakan ` +
              `dalam Sertifikat jaminan sesuai standard Dep.PU.SK. SNI 03-2404-2000, yaitu: ` +
              `Selama ${thn} (${angkaKeKata(thn)}) tahun untuk area tanah yang dianti rayap, ` +
              `terhitung selambat-lambatnya 1 tahun sejak pekerjaan dimulai.`
            : `Untuk pekerjaan ${jenis} ini, kami memberikan garansi bebas rayap yang dinyatakan ` +
              `dalam sertifikat jaminan sesuai standard Dep.PU.SK. SNI 03-2404-2000, yaitu: ` +
              `Selama ${thn} (${angkaKeKata(thn)}) tahun, terhitung sejak pekerjaan ` +
              `anti rayap selesai secara keseluruhan.`;

        const h1 = this.writeWrapped(garansiTxt, ML, USABLE_W, 9, false, BRAND.dark);
        this.nl(h1 + 3);

        this.checkPage(8);
        this.set(9, false, BRAND.dark);
        this.text("Garansi tidak termasuk penggantian barang/material yang dirusak oleh serangan rayap.", ML);
        this.nl(8);

        // ── Pengontrolan ─────────────────────────────────────────────────────
        this.checkPage(35);
        this.sectionTitle("PENGONTROLAN");

        const ctrlItems = [
            "Pengontrolan I dilakukan 1 bulan, setelah pekerjaan selesai.",
            "Pengontrolan II dilakukan 3 bulan, setelah pekerjaan selesai.",
            "Pengontrolan III dilakukan 6 bulan, setelah pekerjaan selesai.",
            "Pengontrolan IV dst dilakukan setelah pengontrolan ke III, dan 6 bulan sekali sampai garansi habis masa berlakunya.",
        ];

        this.set(9, false, BRAND.dark);
        ctrlItems.forEach(txt => {
            this.checkPage(7);
            const h = this.writeWrapped(`• ${txt}`, ML + 3, USABLE_W - 3, 9, false, BRAND.dark);
            this.nl(h + 2);
        });
        this.nl(4);
    }

    // ─── Penutup + TTD ────────────────────────────────────────────────────────

    private buildPenutup() {
        const d   = this.doc;
        const mkt = this.data.marketingNama ?? "Marketing";
        const wa  = this.data.marketingWa;

        this.checkPage(55);
        this.sectionTitle("PENUTUP");

        const penutupTxt =
            "Demikian proposal penawaran harga dan lampiran ini kami sampaikan. Apabila informasi " +
            "yang kami berikan belum memuaskan, kami siap memberikan presentasi di hadapan " +
            "Bapak/Ibu. Untuk selanjutnya dapat menghubungi kami :";

        const hp = this.writeWrapped(penutupTxt, ML, USABLE_W, 9, false, BRAND.dark);
        this.nl(hp + 5);

        this.set(9, false, BRAND.dark);
        this.text(`• Kantor : ${COMPANY.telp}`, ML + 3);
        this.nl(LINE_H + 1);

        if (wa) {
            this.text(`• ${mkt} : ${wa}`, ML + 3);
            this.nl(LINE_H + 1);
        }
        this.nl(4);

        this.set(9, false, BRAND.dark);
        this.text("Atas perhatian dan kerja sama yang diberikan kami ucapkan terima kasih.", ML);
        this.nl(10);

        // ── Tanda tangan ─────────────────────────────────────────────────────
        this.set(9, false, BRAND.dark);
        this.text("Hormat kami,", ML);
        this.nl(LINE_H);
        this.set(9, true, BRAND.dark);
        this.text("PT Guci Emas Pratama", ML);
        this.nl(22);  // ruang untuk tanda tangan

        // Garis di atas nama
        d.setDrawColor(...hex(BRAND.dark));
        d.setLineWidth(0.5);
        d.line(ML, this.y, ML + 48, this.y);
        this.nl(4);

        this.set(9, true, BRAND.dark);
        this.text(mkt, ML);
        this.nl(7);
    }

    // ─── MAIN RENDER ─────────────────────────────────────────────────────────

    render(): Blob {
        this.drawKop();
        this.buildHeaderInfo();

        // Divider sebelum tabel biaya
        this.checkPage(4);
        this.hr(BRAND.border, 0.3);
        this.nl(5);

        this.buildBiayaSection();
        this.buildPembayaran();

        if (this.data.jenisLayanan && isAntiRayap(this.data.jenisLayanan)) {
            this.buildGaransi();
        }

        this.buildPenutup();
        this.drawFooter();

        return this.doc.output("blob");
    }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Generate PDF quotation dan return sebagai Blob.
 * Blob ini bisa diupload ke Firebase Storage atau langsung didownload.
 */
export function generateQuotationPDF(data: QuotationPDFData): Blob {
    const renderer = new QuotationRenderer(data);
    return renderer.render();
}

/**
 * Shortcut: generate dan langsung download ke browser
 */
export function downloadQuotationPDF(data: QuotationPDFData, filename?: string): void {
    const blob = generateQuotationPDF(data);
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename ?? `${data.noSurat.replace(/\//g, "-")}.pdf`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
}