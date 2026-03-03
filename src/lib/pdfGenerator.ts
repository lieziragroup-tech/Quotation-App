/**
 * PDF Generator — PT Guci Emas Pratama
 * Menggunakan jsPDF untuk generate quotation PDF
 * Mereplikasi layout template Python (generate_quotation_v2.py)
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
    paragrafPembuka?: string;   // override otomatis jika diisi
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

const PAGE_W = 210;     // A4 mm
const PAGE_H = 297;
const ML = 20;          // margin left
const MR = 20;          // margin right
const MT = 15;          // margin top
const MB = 20;          // margin bottom
const USABLE_W = PAGE_W - ML - MR;
const KOP_H = 28;       // kop surat height
const FOOTER_H = 18;    // footer height

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
    private y: number;        // current Y cursor
    private pageNum = 1;
    private data: QuotationPDFData;
    private calc: ReturnType<typeof calcTotals>;

    constructor(data: QuotationPDFData) {
        this.data = data;
        this.doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
        this.y = MT + KOP_H + 4;

        this.calc = calcTotals({
            items: data.items,
            biayaTambahan: data.biayaTambahan,
            diskonPct: data.diskonPct,
            ppn: data.ppn,
            ppnDppFaktor: data.ppnDppFaktor,
        });
    }

    // ── Page management ──────────────────────────────────────────────────────

    private checkPage(needed: number) {
        if (this.y + needed > PAGE_H - MB - FOOTER_H) {
            this.addPage();
        }
    }

    private addPage() {
        this.drawFooter();
        this.doc.addPage();
        this.pageNum++;
        this.y = MT + KOP_H + 4;
        this.drawKop();
    }

    // ── Kop Surat ────────────────────────────────────────────────────────────

    private drawKop() {
        const d = this.doc;
        const topBar = MT;

        // Green top bar
        d.setFillColor(...hex(BRAND.green));
        d.rect(ML, topBar, USABLE_W, 3, "F");

        // Company name
        d.setFontSize(16);
        d.setFont("helvetica", "bold");
        d.setTextColor(...hex(BRAND.green));
        d.text(COMPANY.name, ML, topBar + 10);

        // Tagline
        d.setFontSize(7.5);
        d.setFont("helvetica", "normal");
        d.setTextColor(...hex(BRAND.gray));
        d.text("Jasa Anti Rayap & Pengendalian Hama Profesional  ·  Est. 1985", ML, topBar + 14);

        // Green line separator
        d.setDrawColor(...hex(BRAND.green));
        d.setLineWidth(0.5);
        d.line(ML, topBar + 16, ML + USABLE_W, topBar + 16);

        // Address lines
        d.setFontSize(7);
        d.setFont("helvetica", "normal");
        d.setTextColor(...hex(BRAND.gray));
        d.text(`Head Office : ${COMPANY.head}`, ML, topBar + 19.5);
        d.text(
            `Telp : ${COMPANY.telp}  |  WhatsApp : ${COMPANY.wa}  |  E-Mail : ${COMPANY.email}  |  ${COMPANY.web}`,
            ML, topBar + 22.5,
        );
        d.text(`Branch Office : ${COMPANY.branch}`, ML, topBar + 25.5);
    }

    // ── Footer ───────────────────────────────────────────────────────────────

    private drawFooter() {
        const d = this.doc;
        const fy = PAGE_H - MB - FOOTER_H + 2;

        // Separator line
        d.setDrawColor(...hex(BRAND.green));
        d.setLineWidth(0.4);
        d.line(ML, fy, ML + USABLE_W, fy);

        // Company name footer
        d.setFontSize(7);
        d.setFont("helvetica", "bold");
        d.setTextColor(...hex(BRAND.green));
        d.text(COMPANY.name, ML, fy + 4);

        // Address footer
        d.setFontSize(6.5);
        d.setFont("helvetica", "normal");
        d.setTextColor(...hex(BRAND.gray));
        d.text(`Head Office : ${COMPANY.head}`, ML, fy + 8);
        d.text(
            `Telp : ${COMPANY.telp}  |  WhatsApp : ${COMPANY.wa}  |  ${COMPANY.email}  |  ${COMPANY.web}`,
            ML, fy + 11,
        );
        d.text(`Branch Office : ${COMPANY.branch}`, ML, fy + 14);

        // Page number
        d.setFontSize(7);
        d.setTextColor(...hex(BRAND.grayLight));
        d.text(`Hal. ${this.pageNum}`, ML + USABLE_W, fy + 14, { align: "right" });
    }

    // ── Text helpers ──────────────────────────────────────────────────────────

    private write(
        text: string,
        x: number,
        size = 9,
        bold = false,
        color: string = BRAND.dark,
        align: "left" | "right" | "center" = "left",
    ) {
        this.doc.setFontSize(size);
        this.doc.setFont("helvetica", bold ? "bold" : "normal");
        this.doc.setTextColor(...hex(color));
        this.doc.text(text, x, this.y, { align });
    }

    private nl(gap = 5) { this.y += gap; }

    /**
     * Wrap text dalam lebar tertentu, return lines
     */
    private wrapText(text: string, maxW: number, size: number): string[] {
        this.doc.setFontSize(size);
        return this.doc.splitTextToSize(text, maxW) as string[];
    }

    private writeWrapped(
        text: string,
        x: number,
        maxW: number,
        size = 9,
        bold = false,
        color: string = BRAND.dark,
        align: "left" | "right" | "center" = "left",
        lineH = 5,
    ): number {
        const lines = this.wrapText(text, maxW, size);
        this.doc.setFontSize(size);
        this.doc.setFont("helvetica", bold ? "bold" : "normal");
        this.doc.setTextColor(...hex(color));
        lines.forEach((line, i) => {
            this.doc.text(line, x, this.y + i * lineH, { align });
        });
        return lines.length * lineH;
    }

    // ── Header Info ───────────────────────────────────────────────────────────

    private buildHeaderInfo() {
        const d = this.doc;
        const { data } = this;

        // Nomor surat (kiri) + Tanggal (kanan)
        this.checkPage(8);
        d.setFontSize(9);
        d.setFont("helvetica", "normal");
        d.setTextColor(...hex(BRAND.dark));
        d.text(`No: `, ML, this.y);
        d.setFont("helvetica", "bold");
        d.text(data.noSurat, ML + 7, this.y);

        d.setFont("helvetica", "normal");
        d.text(`Tangerang Selatan, ${fmtDateID(data.tanggal)}`, ML + USABLE_W, this.y, { align: "right" });
        this.nl(7);

        // Kepada Yth
        this.checkPage(20);
        this.write("Kepada Yth.", ML, 9, false, BRAND.dark);
        this.nl(5);
        this.write(data.kepadaNama, ML, 9, true, BRAND.dark);
        this.nl(5);

        for (const line of data.kepadaAlamatLines) {
            this.write(line, ML, 9, false, BRAND.dark);
            this.nl(5);
        }

        if (data.kepadaUp) {
            this.write(`Up : ${data.kepadaUp}`, ML, 9, false, BRAND.dark);
            this.nl(5);
        }
        this.nl(2);

        // Perihal
        this.checkPage(8);
        const perihal = data.perihal ?? LAYANAN_CONFIG[data.jenisLayanan]?.perihal ?? "Penawaran Harga";
        d.setFontSize(9);
        d.setFont("helvetica", "normal");
        d.setTextColor(...hex(BRAND.dark));
        d.text("Perihal: ", ML, this.y);
        d.setFont("helvetica", "bold");
        d.text(perihal, ML + 16, this.y);
        this.nl(7);

        // Pembuka
        this.checkPage(30);
        this.write("Dengan hormat,", ML, 9, false, BRAND.dark);
        this.nl(5);

        const alamat = data.kepadaAlamatLines.join(", ");
        const pembuka = data.paragrafPembuka ?? buildParagrafPembuka(data.jenisLayanan, data.kepadaNama, alamat);
        const h1 = this.writeWrapped(pembuka, ML, USABLE_W, 9, false, BRAND.dark, "left", 5);
        this.nl(h1 + 3);

        this.checkPage(10);
        const kalimatBerlaku = "Surat penawaran ini berlaku selama 30 (tiga puluh) hari sejak tanggal surat dibuat.";
        const h2 = this.writeWrapped(kalimatBerlaku, ML, USABLE_W, 9, false, BRAND.dark, "left", 5);
        this.nl(h2 + 3);

        this.checkPage(16);
        const kalimatPenutup = "Mohon proposal ini dipelajari dan kami dengan senang hati membantu apabila masih ada hal-hal yang kurang jelas. Demikian proposal penawaran ini kami sampaikan, atas perhatian dan kerjasama anda, kami ucapkan terima kasih.";
        const h3 = this.writeWrapped(kalimatPenutup, ML, USABLE_W, 9, false, BRAND.dark, "left", 5);
        this.nl(h3 + 5);

        this.write("Jabat Erat,", ML, 9, false, BRAND.dark);
        this.nl(5);
        this.write("PT Guci Emas Pratama", ML, 9, true, BRAND.dark);
        this.nl(6);
    }

    // ── Separator HR ─────────────────────────────────────────────────────────

    private buildSeparator() {
        this.checkPage(4);
        this.doc.setDrawColor(...hex(BRAND.border));
        this.doc.setLineWidth(0.3);
        this.doc.line(ML, this.y, ML + USABLE_W, this.y);
        this.nl(5);
    }

    // ── Biaya Section ─────────────────────────────────────────────────────────

    private buildBiayaSection() {
        const d = this.doc;
        const { data, calc } = this;

        // Section title
        this.checkPage(8);
        d.setFontSize(10);
        d.setFont("helvetica", "bold");
        d.setTextColor(...hex(BRAND.green));
        d.text("BIAYA PELAKSANAAN", ML, this.y);
        this.nl(6);

        this.checkPage(6);
        d.setFontSize(9);
        d.setFont("helvetica", "normal");
        d.setTextColor(...hex(BRAND.dark));
        d.text("Berdasarkan hasil survey, berikut penawaran harga yang kami ajukan:", ML, this.y);
        this.nl(5);

        // Column widths
        const colNo = 8;
        const colPek = USABLE_W * 0.42;
        const colVol = USABLE_W * 0.14;
        const colHs = USABLE_W * 0.20;
        const colJml = USABLE_W - colNo - colPek - colVol - colHs;

        // Table headers
        const headerH = 8;
        this.checkPage(headerH + 8);
        d.setFillColor(...hex(BRAND.tableHeader));
        d.rect(ML, this.y - 5, USABLE_W, headerH, "F");

        const hdrCols = [
            { text: "No", x: ML + colNo / 2, align: "center" as const },
            { text: "Pekerjaan", x: ML + colNo + 3, align: "left" as const },
            { text: "Volume Kerja", x: ML + colNo + colPek + colVol / 2, align: "center" as const },
            { text: "Harga Satuan", x: ML + colNo + colPek + colVol + colHs / 2, align: "center" as const },
            { text: "Jumlah", x: ML + colNo + colPek + colVol + colHs + colJml / 2, align: "center" as const },
        ];

        d.setFontSize(8.5);
        d.setFont("helvetica", "bold");
        d.setTextColor(255, 255, 255);
        hdrCols.forEach(c => d.text(c.text, c.x, this.y, { align: c.align }));
        this.nl(headerH - 1);

        // Item rows
        const allItems = [
            ...data.items.map(it => ({ ...it, isExtra: false })),
            ...(data.biayaTambahan ?? []).map(b => ({
                desc: b.label,
                qty: 1,
                unit: "ls",
                harga: b.amount,
                isExtra: true,
            })),
        ];

        allItems.forEach((item, idx) => {
            const rowH = 8;
            this.checkPage(rowH + 2);

            // Alternating background
            if (idx % 2 === 1) {
                d.setFillColor(...hex(BRAND.tableAlt));
                d.rect(ML, this.y - 5, USABLE_W, rowH, "F");
            }

            const sub = item.qty * item.harga;

            d.setFontSize(8.5);
            d.setFont("helvetica", "normal");
            d.setTextColor(...hex(BRAND.dark));

            // No
            d.text(item.isExtra ? "" : String(idx + 1), ML + colNo / 2, this.y, { align: "center" });
            // Pekerjaan (wrap if long)
            const descLines = this.wrapText(item.desc, colPek - 6, 8.5);
            d.text(descLines[0] ?? item.desc, ML + colNo + 3, this.y);
            // Volume
            d.text(`${item.qty.toLocaleString("id-ID")} ${item.unit}`, ML + colNo + colPek + colVol / 2, this.y, { align: "center" });
            // Harga satuan
            d.text(fmtIDR(item.harga), ML + colNo + colPek + colVol + colHs - 2, this.y, { align: "right" });
            // Jumlah
            d.setFont("helvetica", "bold");
            d.text(fmtIDR(sub), ML + USABLE_W - 2, this.y, { align: "right" });

            // Grid lines
            d.setDrawColor(...hex(BRAND.border));
            d.setLineWidth(0.3);
            // bottom line
            d.line(ML, this.y + 3, ML + USABLE_W, this.y + 3);

            this.nl(rowH);
        });

        // Outer border of table
        const tableEndY = this.y;
        const tableStartY = MT + KOP_H + 4 + (this.pageNum > 1 ? 0 : 0);
        // Just vertical column separators on last row
        d.setDrawColor(...hex(BRAND.border));
        d.setLineWidth(0.3);

        // Summary table
        this.nl(2);
        this.buildSummaryTable(colNo, colPek, colVol, colHs, colJml);
        void tableEndY;
        void tableStartY;

        // PPN note
        this.nl(2);
        this.checkPage(8);
        d.setFontSize(8);
        d.setFont("helvetica", "italic");
        d.setTextColor(...hex(BRAND.gray));
        const ppnNote = data.ppn
            ? "*Biaya tersebut di atas sudah termasuk PPN (sesuai peraturan yang berlaku)."
            : "*Biaya tersebut di atas belum termasuk PPN (sesuai ketentuan yang berlaku).";
        d.text(ppnNote, ML, this.y);
        this.nl(7);
    }

    private buildSummaryTable(colNo: number, colPek: number, colVol: number, colHs: number, colJml: number) {
        const d = this.doc;
        const { calc } = this;

        const colE = colNo + colPek + colVol;
        const xLabel = ML + colE + 3;
        const xValue = ML + USABLE_W - 2;

        const rows: { label: string; value: number; isTotal?: boolean }[] = [];
        rows.push({ label: "Jumlah", value: calc.subtotalGross });

        if (calc.diskonRp > 0) {
            const discLabel = calc.diskonPct ? `Diskon (${calc.diskonPct.toFixed(0)}%)` : "Diskon";
            rows.push({ label: discLabel, value: calc.diskonRp });
            rows.push({ label: "Total Biaya", value: calc.setelahDiskon });
        }
        if (calc.dpp) {
            rows.push({ label: "DPP Nilai Lain x 11/12", value: calc.dpp });
            rows.push({ label: "PPN 12%", value: calc.ppnRp });
        } else if (calc.ppnRp > 0) {
            rows.push({ label: "PPN 11%", value: calc.ppnRp });
        }
        rows.push({ label: "TOTAL", value: calc.total, isTotal: true });

        rows.forEach(row => {
            const rowH = row.isTotal ? 9 : 7;
            this.checkPage(rowH + 2);

            if (row.isTotal) {
                // Green background
                d.setFillColor(...hex(BRAND.totalBg));
                d.rect(ML + colE, this.y - 5, colHs + colJml, rowH, "F");
                d.setFontSize(9.5);
                d.setFont("helvetica", "bold");
                d.setTextColor(255, 255, 255);
            } else {
                d.setFontSize(8.5);
                d.setFont("helvetica", "normal");
                d.setTextColor(...hex(BRAND.dark));
            }

            d.text(row.label, xLabel, this.y);
            d.setFont("helvetica", row.isTotal ? "bold" : "normal");
            if (!row.isTotal) d.setTextColor(...hex(BRAND.dark));
            d.text(fmtIDR(row.value), xValue, this.y, { align: "right" });

            // Border
            d.setDrawColor(...hex(BRAND.border));
            d.setLineWidth(0.3);
            d.line(ML + colE, this.y + 3, ML + USABLE_W, this.y + 3);
            d.line(ML + colE, this.y - rowH + 2, ML + colE, this.y + 3);
            d.line(ML + colE + colHs, this.y - rowH + 2, ML + colE + colHs, this.y + 3);
            d.line(ML + USABLE_W, this.y - rowH + 2, ML + USABLE_W, this.y + 3);

            this.nl(rowH);
        });
    }

    // ── Pembayaran ───────────────────────────────────────────────────────────

    private buildPembayaran() {
        const d = this.doc;
        this.checkPage(25);

        d.setFontSize(10);
        d.setFont("helvetica", "bold");
        d.setTextColor(...hex(BRAND.green));
        d.text("PEMBAYARAN", ML, this.y);
        this.nl(6);

        d.setFontSize(9);
        d.setFont("helvetica", "normal");
        d.setTextColor(...hex(BRAND.dark));
        d.text("Pembayaran dilakukan 2 (dua) tahap, yaitu:", ML, this.y);
        this.nl(5);

        d.text("• Tahap I, sebesar 50 % dari nilai kontrak, dibayar saat penandatanganan surat kontrak.", ML + 4, this.y);
        this.nl(5);
        d.text("• Tahap II, sebesar 50 % dari nilai kontrak, dibayarkan setelah pekerjaan selesai.", ML + 4, this.y);
        this.nl(7);
    }

    // ── Garansi ──────────────────────────────────────────────────────────────

    private buildGaransi() {
        const { data } = this;
        if (!data.garansiTahun) return;

        const d = this.doc;
        const thn = data.garansiTahun;
        const jenis = data.jenisGaransi ?? "Anti Rayap";
        const isPra = data.jenisLayanan.includes("pra") || data.jenisLayanan.includes("pipanisasi");

        this.checkPage(30);

        d.setFontSize(10);
        d.setFont("helvetica", "bold");
        d.setTextColor(...hex(BRAND.green));
        d.text("GARANSI", ML, this.y);
        this.nl(6);

        const garansiTxt = isPra
            ? `Untuk pekerjaan ${jenis} ini, kami memberikan garansi bebas rayap yang dinyatakan ` +
            `dalam Sertifikat jaminan sesuai standard Dep.PU.SK. SNI 03-2404-2000, yaitu: ` +
            `Selama ${thn} (${angkaKeKata(thn)}) tahun untuk area tanah yang dianti rayap, ` +
            `terhitung selambat-lambatnya 1 tahun sejak pekerjaan dimulai.`
            : `Untuk pekerjaan ${jenis} ini, kami memberikan garansi bebas rayap yang dinyatakan ` +
            `dalam sertifikat jaminan sesuai standard Dep.PU.SK. SNI 03-2404-2000, yaitu: ` +
            `Selama ${thn} (${angkaKeKata(thn)}) tahun, terhitung sejak pekerjaan ` +
            `anti rayap selesai secara keseluruhan.`;

        d.setFontSize(9);
        d.setFont("helvetica", "normal");
        d.setTextColor(...hex(BRAND.dark));
        const h1 = this.writeWrapped(garansiTxt, ML, USABLE_W, 9, false, BRAND.dark, "left", 5);
        this.nl(h1 + 3);

        d.text("Garansi tidak termasuk penggantian barang/material yang dirusak oleh serangan rayap.", ML, this.y);
        this.nl(6);

        // Pengontrolan
        this.checkPage(30);
        d.setFontSize(10);
        d.setFont("helvetica", "bold");
        d.setTextColor(...hex(BRAND.green));
        d.text("PENGONTROLAN", ML, this.y);
        this.nl(6);

        const ctrlItems = [
            "Pengontrolan I dilakukan 1 bulan, setelah pekerjaan selesai.",
            "Pengontrolan II dilakukan 3 bulan, setelah pekerjaan selesai.",
            "Pengontrolan III dilakukan 6 bulan, setelah pekerjaan selesai.",
            "Pengontrolan IV dst dilakukan setelah pengontrolan ke III, dan 6 bulan sekali sampai garansi habis masa berlakunya.",
        ];

        d.setFontSize(9);
        d.setFont("helvetica", "normal");
        d.setTextColor(...hex(BRAND.dark));
        ctrlItems.forEach(txt => {
            this.checkPage(7);
            d.text(`• ${txt}`, ML + 4, this.y);
            this.nl(5);
        });
        this.nl(2);
    }

    // ── Penutup + TTD ─────────────────────────────────────────────────────────

    private buildPenutup() {
        const d = this.doc;
        const mkt = this.data.marketingNama ?? "Marketing";
        const wa = this.data.marketingWa;

        this.checkPage(50);

        d.setFontSize(10);
        d.setFont("helvetica", "bold");
        d.setTextColor(...hex(BRAND.green));
        d.text("PENUTUP", ML, this.y);
        this.nl(6);

        const penutupTxt = "Demikian proposal penawaran harga dan lampiran ini kami sampaikan. Apabila informasi " +
            "yang kami berikan belum memuaskan, kami siap memberikan presentasi di hadapan " +
            "Bapak/Ibu. Untuk selanjutnya dapat menghubungi kami :";
        d.setFontSize(9);
        d.setFont("helvetica", "normal");
        d.setTextColor(...hex(BRAND.dark));
        const hp = this.writeWrapped(penutupTxt, ML, USABLE_W, 9, false, BRAND.dark, "left", 5);
        this.nl(hp + 4);

        d.text(`• Kantor : ${COMPANY.telp}`, ML + 4, this.y);
        this.nl(5);
        if (wa) {
            d.text(`• ${mkt} : ${wa}`, ML + 4, this.y);
            this.nl(5);
        }
        this.nl(3);

        const kamiTxt = "Atas perhatian dan kerja sama yang diberikan kami ucapkan terima kasih.";
        d.text(kamiTxt, ML, this.y);
        this.nl(8);

        // Tanda tangan
        d.text("Hormat kami,", ML, this.y);
        this.nl(5);
        d.setFont("helvetica", "bold");
        d.text("PT Guci Emas Pratama", ML, this.y);
        this.nl(20);  // space for signature

        // Line above name
        d.setDrawColor(...hex(BRAND.dark));
        d.setLineWidth(0.5);
        d.line(ML, this.y, ML + 50, this.y);
        this.nl(4);

        d.setFont("helvetica", "bold");
        d.setTextColor(...hex(BRAND.dark));
        d.text(mkt, ML, this.y);
        this.nl(5);
    }

    // ── MAIN RENDER ──────────────────────────────────────────────────────────

    render(): Blob {
        this.drawKop();
        this.buildHeaderInfo();
        this.buildSeparator();
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? `${data.noSurat.replace(/\//g, "-")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
}
