import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeft, ArrowRight, Check, FileText,
    Plus, Trash2, Loader2, AlertCircle,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { generateNomorSurat, previewNomorSurat } from "../../services/nomorSuratService";
import { createQuotation } from "../../services/quotationService";
import { generateQuotationPDF } from "../../lib/pdfGenerator";
import { LAYANAN_CONFIG, calcTotals, fmtIDR, TIPE_LABELS } from "../../lib/quotationConfig";
import type { JenisLayanan, TipeKontrak, KategoriSurat, QuotationItem, BiayaTambahan } from "../../types";

// ─── STEP INDICATOR ──────────────────────────────────────────────────────────

const STEPS = [
    { label: "Jenis & Tipe" },
    { label: "Data Klien" },
    { label: "Tabel Harga" },
    { label: "Konfirmasi" },
];

function StepIndicator({ current }: { current: number }) {
    return (
        <div className="flex items-center gap-0 mb-8 mx-auto max-w-lg">
            {STEPS.map((s, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                    <div className="flex items-center w-full">
                        {/* Left connector */}
                        <div className={`flex-1 h-0.5 ${i === 0 ? "opacity-0" : i <= current ? "bg-blue-500" : "bg-slate-200"}`} />
                        {/* Circle */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                            ${i < current ? "bg-blue-600 text-white" : i === current ? "bg-blue-600 text-white ring-4 ring-blue-100" : "bg-slate-100 text-slate-400"}`}>
                            {i < current ? <Check size={14} /> : i + 1}
                        </div>
                        {/* Right connector */}
                        <div className={`flex-1 h-0.5 ${i === STEPS.length - 1 ? "opacity-0" : i < current ? "bg-blue-500" : "bg-slate-200"}`} />
                    </div>
                    <span className={`text-xs mt-1.5 font-medium ${i === current ? "text-blue-600" : i < current ? "text-slate-500" : "text-slate-300"}`}>
                        {s.label}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ─── FORM FIELD ──────────────────────────────────────────────────────────────

function Field({ label, required, error, children }: {
    label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
            {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
        </div>
    );
}

const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-slate-800";

// ─── STEP 1: Jenis & Tipe ────────────────────────────────────────────────────

function Step1({
    jenisLayanan, tipe, kepada, noPreview,
    onLayanan, onTipe, onKepada, errors,
}: {
    jenisLayanan: JenisLayanan;
    tipe: TipeKontrak;
    kepada: string;
    noPreview: string;
    onLayanan: (v: JenisLayanan) => void;
    onTipe: (v: TipeKontrak) => void;
    onKepada: (v: string) => void;
    errors: Record<string, string>;
}) {
    const kategori = LAYANAN_CONFIG[jenisLayanan]?.kategori ?? "PCO";
    const isAR = kategori === "AR";

    return (
        <div className="space-y-5">
            {/* Jenis Layanan */}
            <Field label="Jenis Layanan" required error={errors.jenisLayanan}>
                <div className="grid grid-cols-2 gap-2">
                    {Object.entries(LAYANAN_CONFIG).map(([val, cfg]) => {
                        const sel = jenisLayanan === val;
                        const ar = cfg.kategori === "AR";
                        return (
                            <button key={val} type="button" onClick={() => onLayanan(val as JenisLayanan)}
                                className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg text-left text-sm transition-all
                                    ${sel
                                        ? ar ? "border-purple-400 bg-purple-50 text-purple-700 font-semibold"
                                            : "border-cyan-400 bg-cyan-50 text-cyan-700 font-semibold"
                                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
                                <span>{ar ? "🛡️" : "🦟"}</span>
                                <span className="text-xs">{cfg.label}</span>
                            </button>
                        );
                    })}
                </div>
            </Field>

            {/* Tipe Surat */}
            <Field label="Tipe Surat" required>
                <div className="grid grid-cols-2 gap-3">
                    {(["U", "K"] as TipeKontrak[]).map(v => (
                        <button key={v} type="button" onClick={() => onTipe(v)}
                            className={`px-4 py-3 border rounded-xl text-left transition-all
                                ${tipe === v ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                            <div className={`text-sm font-bold ${tipe === v ? "text-blue-700" : "text-slate-700"}`}>
                                {TIPE_LABELS[v]}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                                {v === "U" ? "Penawaran biasa / satu kali" : "Kerjasama berkala / tahunan"}
                            </div>
                        </button>
                    ))}
                </div>
            </Field>

            {/* Kepada */}
            <Field label="Ditujukan Kepada" required error={errors.kepada}>
                <input className={inputCls} value={kepada}
                    onChange={e => onKepada(e.target.value)}
                    placeholder="Nama klien / perusahaan tujuan" />
            </Field>

            {/* Preview nomor */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Preview Nomor Surat</p>
                <div className="flex items-center gap-3 flex-wrap">
                    <code className={`text-base font-bold px-3 py-1.5 rounded-lg font-mono
                        ${isAR ? "bg-purple-100 text-purple-700" : "bg-cyan-100 text-cyan-700"}`}>
                        {noPreview || "GP-…"}
                    </code>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${isAR ? "bg-purple-100 text-purple-700" : "bg-cyan-100 text-cyan-700"}`}>
                        {isAR ? "🛡 Anti Rayap" : "🦟 Pest Control"}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${tipe === "K" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                        {TIPE_LABELS[tipe]}
                    </span>
                </div>
                <p className="text-xs text-slate-400 mt-2">Perihal: <em>{LAYANAN_CONFIG[jenisLayanan]?.perihal}</em></p>
            </div>
        </div>
    );
}

// ─── STEP 2: Data Klien ───────────────────────────────────────────────────────

function Step2({
    nama, alamatLines, up,
    onNama, onAlamat, onUp, errors,
}: {
    nama: string; alamatLines: string[]; up: string;
    onNama: (v: string) => void;
    onAlamat: (lines: string[]) => void;
    onUp: (v: string) => void;
    errors: Record<string, string>;
}) {
    const updateLine = (i: number, v: string) => {
        const lines = [...alamatLines];
        lines[i] = v;
        onAlamat(lines);
    };
    const addLine = () => onAlamat([...alamatLines, ""]);
    const removeLine = (i: number) => onAlamat(alamatLines.filter((_, idx) => idx !== i));

    return (
        <div className="space-y-5">
            <Field label="Nama Klien / Perusahaan" required error={errors.nama}>
                <input className={inputCls} value={nama}
                    onChange={e => onNama(e.target.value)}
                    placeholder="PT Contoh Indonesia / Bapak Ahmad..." />
            </Field>

            <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Alamat Klien
                    <span className="text-slate-300 font-normal ml-1">(bisa multiple baris)</span>
                </label>
                {alamatLines.map((line, i) => (
                    <div key={i} className="flex gap-2">
                        <input className={inputCls} value={line}
                            onChange={e => updateLine(i, e.target.value)}
                            placeholder={`Baris alamat ${i + 1}`} />
                        {i > 0 && (
                            <button type="button" onClick={() => removeLine(i)}
                                className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors border border-slate-200">
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                ))}
                <button type="button" onClick={addLine}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium mt-1">
                    <Plus size={12} /> Tambah baris alamat
                </button>
            </div>

            <Field label="U.p. / Contact Person" error={errors.up}>
                <input className={inputCls} value={up}
                    onChange={e => onUp(e.target.value)}
                    placeholder="Bpk. Ahmad Santoso (opsional)" />
            </Field>
        </div>
    );
}

// ─── STEP 3: Tabel Harga ──────────────────────────────────────────────────────

function Step3({
    items, biayaTambahan, diskonPct, ppn, ppnDppFaktor, garansiTahun, jenisGaransi,
    onItems, onBiaya, onDiskon, onPpn, onPpnDpp, onGaransi, onJenisGaransi,
    jenisLayanan,
}: {
    items: QuotationItem[];
    biayaTambahan: BiayaTambahan[];
    diskonPct: number;
    ppn: boolean;
    ppnDppFaktor: number;
    garansiTahun: number;
    jenisGaransi: string;
    onItems: (v: QuotationItem[]) => void;
    onBiaya: (v: BiayaTambahan[]) => void;
    onDiskon: (v: number) => void;
    onPpn: (v: boolean) => void;
    onPpnDpp: (v: number) => void;
    onGaransi: (v: number) => void;
    onJenisGaransi: (v: string) => void;
    jenisLayanan: JenisLayanan;
}) {
    const isAR = LAYANAN_CONFIG[jenisLayanan]?.isAR ?? false;
    const calc = calcTotals({ items, biayaTambahan, diskonPct, ppn, ppnDppFaktor: ppnDppFaktor || undefined });

    const updateItem = (i: number, key: keyof QuotationItem, val: string | number) =>
        onItems(items.map((it, idx) => idx === i ? { ...it, [key]: val } : it));
    const addItem = () => onItems([...items, { desc: "", qty: 1, unit: "m2", harga: 0 }]);
    const removeItem = (i: number) => onItems(items.filter((_, idx) => idx !== i));

    const updateBiaya = (i: number, key: keyof BiayaTambahan, val: string | number) =>
        onBiaya(biayaTambahan.map((b, idx) => idx === i ? { ...b, [key]: val } : b));
    const addBiaya = () => onBiaya([...biayaTambahan, { label: "", amount: 0 }]);
    const removeBiaya = (i: number) => onBiaya(biayaTambahan.filter((_, idx) => idx !== i));

    const UNITS = ["m2", "m1", "m3", "Kali", "Titik", "Lot", "ls", "Unit"];

    return (
        <div className="space-y-6">
            {/* Items table */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-700">Item Pekerjaan</h3>
                    <button type="button" onClick={addItem}
                        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold border border-blue-200 rounded-lg px-3 py-1.5 bg-blue-50 hover:bg-blue-100 transition-colors">
                        <Plus size={12} /> Tambah Item
                    </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-3 py-2.5 text-left font-semibold text-slate-500 w-6">No</th>
                                <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Deskripsi Pekerjaan</th>
                                <th className="px-3 py-2.5 text-left font-semibold text-slate-500 w-20">Qty</th>
                                <th className="px-3 py-2.5 text-left font-semibold text-slate-500 w-20">Satuan</th>
                                <th className="px-3 py-2.5 text-left font-semibold text-slate-500 w-32">Harga Satuan</th>
                                <th className="px-3 py-2.5 text-right font-semibold text-slate-500 w-32">Jumlah</th>
                                <th className="w-8" />
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, i) => (
                                <tr key={i} className="border-b border-slate-100 last:border-0">
                                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                                    <td className="px-2 py-1.5">
                                        <input className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300"
                                            value={item.desc} placeholder="Deskripsi pekerjaan..."
                                            onChange={e => updateItem(i, "desc", e.target.value)} />
                                    </td>
                                    <td className="px-2 py-1.5">
                                        <input type="number" min={0} step="0.01"
                                            className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300"
                                            value={item.qty}
                                            onChange={e => updateItem(i, "qty", parseFloat(e.target.value) || 0)} />
                                    </td>
                                    <td className="px-2 py-1.5">
                                        <select className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white"
                                            value={item.unit}
                                            onChange={e => updateItem(i, "unit", e.target.value)}>
                                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-2 py-1.5">
                                        <input type="number" min={0}
                                            className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300"
                                            value={item.harga}
                                            onChange={e => updateItem(i, "harga", parseInt(e.target.value) || 0)} />
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-slate-700 font-mono">
                                        {fmtIDR(item.qty * item.harga)}
                                    </td>
                                    <td className="px-2 py-1.5">
                                        <button type="button" onClick={() => removeItem(i)}
                                            className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                                            <Trash2 size={12} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {items.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-6 text-center text-slate-400 text-xs">
                                        Belum ada item. Klik "Tambah Item" untuk menambah.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Biaya tambahan */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-600">Biaya Tambahan <span className="text-slate-400 font-normal text-xs">(opsional)</span></h3>
                    <button type="button" onClick={addBiaya}
                        className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1">
                        <Plus size={11} /> Tambah
                    </button>
                </div>
                {biayaTambahan.map((b, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                        <input className={`${inputCls} flex-1`} value={b.label}
                            placeholder="Label biaya (e.g. Biaya Transportasi)"
                            onChange={e => updateBiaya(i, "label", e.target.value)} />
                        <input type="number" min={0} className="w-36 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300"
                            value={b.amount} placeholder="Nominal"
                            onChange={e => updateBiaya(i, "amount", parseInt(e.target.value) || 0)} />
                        <button type="button" onClick={() => removeBiaya(i)}
                            className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 border border-slate-200 transition-colors">
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Diskon, PPN, Garansi */}
            <div className="grid grid-cols-2 gap-4">
                <Field label="Diskon (%)">
                    <input type="number" min={0} max={100} step="0.01" className={inputCls}
                        value={diskonPct} onChange={e => onDiskon(parseFloat(e.target.value) || 0)} />
                </Field>

                <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">PPN</label>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={ppn} onChange={e => onPpn(e.target.checked)}
                                className="w-4 h-4 rounded accent-blue-600" />
                            <span className="text-sm text-slate-700">Kena PPN</span>
                        </label>
                        {ppn && (
                            <select value={ppnDppFaktor || 0} onChange={e => onPpnDpp(parseFloat(e.target.value))}
                                className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white">
                                <option value={0}>PPN 11% biasa</option>
                                <option value={11 / 12}>DPP Nilai Lain (11/12) + PPN 12%</option>
                            </select>
                        )}
                    </div>
                </div>

                {isAR && (
                    <Field label="Garansi (tahun)">
                        <input type="number" min={0} max={10} className={inputCls}
                            value={garansiTahun} onChange={e => onGaransi(parseInt(e.target.value) || 0)}
                            placeholder="0 = tidak ada garansi" />
                    </Field>
                )}

                {isAR && garansiTahun > 0 && (
                    <Field label="Jenis Garansi">
                        <input className={inputCls} value={jenisGaransi}
                            onChange={e => onJenisGaransi(e.target.value)}
                            placeholder="Anti Rayap / Anti Rayap Pra-Konstruksi" />
                    </Field>
                )}
            </div>

            {/* Total preview */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Ringkasan Harga</h3>
                {[
                    { label: "Subtotal", value: calc.subtotalGross, show: true },
                    { label: `Diskon (${diskonPct}%)`, value: -calc.diskonRp, show: calc.diskonRp > 0 },
                    { label: "Setelah Diskon", value: calc.setelahDiskon, show: calc.diskonRp > 0 },
                    { label: "PPN", value: calc.ppnRp, show: calc.ppnRp > 0 },
                ].filter(r => r.show).map(r => (
                    <div key={r.label} className="flex justify-between text-sm text-slate-600">
                        <span>{r.label}</span>
                        <span className="font-mono">{fmtIDR(Math.abs(r.value))}</span>
                    </div>
                ))}
                <div className="border-t border-slate-200 pt-2 flex justify-between font-bold">
                    <span className="text-slate-800">TOTAL</span>
                    <span className="text-green-700 text-base font-mono">{fmtIDR(calc.total)}</span>
                </div>
            </div>
        </div>
    );
}

// ─── STEP 4: Konfirmasi ───────────────────────────────────────────────────────

function Step4({
    noSurat, jenisLayanan, tipe, kepadaNama, kepadaAlamatLines, total, marketingNama, marketingWa,
}: {
    noSurat: string; jenisLayanan: JenisLayanan; tipe: TipeKontrak;
    kepadaNama: string; kepadaAlamatLines: string[];
    total: number; marketingNama: string; marketingWa?: string;
}) {
    const cfg = LAYANAN_CONFIG[jenisLayanan];
    const isAR = cfg?.isAR;

    return (
        <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-600 mb-1 uppercase tracking-wide">⚠ Konfirmasi</p>
                <p className="text-sm text-blue-700">Nomor surat dan PDF akan digenerate setelah konfirmasi. Nomor tidak bisa diubah setelah ini.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {[
                    { label: "Nomor Surat", value: noSurat, mono: true },
                    { label: "Jenis Layanan", value: cfg?.label, mono: false },
                    { label: "Tipe", value: TIPE_LABELS[tipe], mono: false },
                    { label: "Kepada", value: kepadaNama, mono: false },
                    { label: "Marketing", value: marketingNama, mono: false },
                    { label: "WA Marketing", value: marketingWa ?? "-", mono: true },
                    { label: "Total", value: fmtIDR(total), mono: true },
                    { label: "Kategori", value: isAR ? "Anti Rayap" : "Pest Control", mono: false },
                ].map(({ label, value, mono }) => (
                    <div key={label} className="bg-white border border-slate-100 rounded-lg p-3">
                        <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</div>
                        <div className={`text-sm font-bold text-slate-800 ${mono ? "font-mono" : ""}`}>{value}</div>
                    </div>
                ))}
            </div>

            {kepadaAlamatLines.filter(Boolean).length > 0 && (
                <div className="bg-white border border-slate-100 rounded-lg p-3">
                    <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Alamat</div>
                    {kepadaAlamatLines.filter(Boolean).map((l, i) => (
                        <div key={i} className="text-sm text-slate-700">{l}</div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── MAIN FORM PAGE ──────────────────────────────────────────────────────────

export function QuotationFormPage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const [step, setStep] = useState(0);

    // Step 1
    const [jenisLayanan, setJenisLayanan] = useState<JenisLayanan>("anti_rayap_injeksi");
    const [tipe, setTipe] = useState<TipeKontrak>("U");
    const [kepada, setKepada] = useState("");
    const [noPreview, setNoPreview] = useState("");

    // Step 2
    const [kepadaNama, setKepadaNama] = useState("");
    const [kepadaAlamat, setKepadaAlamat] = useState<string[]>([""]);
    const [kepadaUp, setKepadaUp] = useState("");

    // Step 3
    const [items, setItems] = useState<QuotationItem[]>([
        { desc: "", qty: 1, unit: "m2", harga: 0 },
    ]);
    const [biayaTambahan, setBiayaTambahan] = useState<BiayaTambahan[]>([]);
    const [diskonPct, setDiskonPct] = useState(0);
    const [ppn, setPpn] = useState(false);
    const [ppnDppFaktor, setPpnDppFaktor] = useState(0);
    const [garansiTahun, setGaransiTahun] = useState(0);
    const [jenisGaransi, setJenisGaransi] = useState("Anti Rayap");

    // Derived
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [saveErr, setSaveErr] = useState("");

    const kategori: KategoriSurat = LAYANAN_CONFIG[jenisLayanan]?.kategori ?? "PCO";

    // Preview nomor surat real-time (debounced)
    useEffect(() => {
        if (!user?.companyId) return;
        let cancelled = false;
        const timer = setTimeout(async () => {
            const no = await previewNomorSurat(kategori, tipe, user.companyId);
            if (!cancelled) setNoPreview(no);
        }, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [kategori, tipe, user?.companyId]);

    // Sync kepada → kepadaNama saat berpindah step
    useEffect(() => {
        if (kepadaNama === "" && kepada) setKepadaNama(kepada);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, kepada, kepadaNama]);

    const calc = calcTotals({ items, biayaTambahan, diskonPct, ppn, ppnDppFaktor: ppnDppFaktor || undefined });

    const validate = useCallback((): boolean => {
        const e: Record<string, string> = {};
        if (step === 0) {
            if (!kepada.trim()) e.kepada = "Nama klien wajib diisi.";
        }
        if (step === 1) {
            if (!kepadaNama.trim()) e.nama = "Nama klien wajib diisi.";
        }
        if (step === 2) {
            if (items.length === 0) e.items = "Minimal 1 item harga.";
            else if (items.some(it => !it.desc.trim())) e.items = "Deskripsi item tidak boleh kosong.";
            else if (items.some(it => it.qty <= 0)) e.items = "Qty harus lebih dari 0.";
            else if (items.some(it => it.harga <= 0)) e.items = "Harga satuan harus lebih dari 0.";
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    }, [step, kepada, kepadaNama, items]);

    const handleNext = () => {
        if (!validate()) return;
        if (step === 0 && !kepadaNama) setKepadaNama(kepada);
        setStep(s => s + 1);
    };
    const handleBack = () => setStep(s => s - 1);

    const handleSubmit = async () => {
        if (!user) return;
        setSaving(true);
        setSaveErr("");

        try {
            // 1. Generate nomor surat (simpan ke Firestore)
            const nomorEntry = await generateNomorSurat({
                kategori,
                tipe,
                jenisLayanan,
                kepada: kepadaNama || kepada,
                byUid: user.uid,
                byName: user.name,
                companyId: user.companyId,
            });

            const pdfData = {
                noSurat: nomorEntry.noSurat,
                tanggal: new Date(),
                kepadaNama: kepadaNama || kepada,
                kepadaAlamatLines: kepadaAlamat.filter(Boolean),
                kepadaUp: kepadaUp || undefined,
                jenisLayanan,
                items,
                biayaTambahan,
                diskonPct,
                ppn,
                ppnDppFaktor: ppnDppFaktor || undefined,
                garansiTahun: garansiTahun || undefined,
                jenisGaransi: jenisGaransi || undefined,
                marketingNama: user.name,
                marketingWa: user.wa,
            };

            // 2. Generate PDF blob (satu kali saja)
            const pdfBlob = generateQuotationPDF(pdfData);

            // 3. Download PDF langsung dari blob yang sudah ada (tidak di-generate ulang)
            const dlUrl = URL.createObjectURL(pdfBlob);
            const dlLink = document.createElement("a");
            dlLink.href = dlUrl;
            dlLink.download = `${nomorEntry.noSurat.replace(/\//g, "-")}.pdf`;
            dlLink.click();
            URL.revokeObjectURL(dlUrl);

            // 4. Simpan ke Firestore + upload PDF ke Storage
            await createQuotation({
                noSurat: nomorEntry.noSurat,
                kategori,
                tipeKontrak: tipe,
                jenisLayanan,
                perihal: LAYANAN_CONFIG[jenisLayanan]?.perihal ?? "",
                kepadaNama: kepadaNama || kepada,
                kepadaAlamatLines: kepadaAlamat.filter(Boolean),
                kepadaUp: kepadaUp || undefined,
                tanggal: new Date(),
                items,
                biayaTambahan,
                diskonPct,
                ppn,
                ppnDppFaktor: ppnDppFaktor || undefined,
                garansiTahun: garansiTahun || undefined,
                jenisGaransi: jenisGaransi || undefined,
                subtotal: calc.subtotal,
                diskonRp: calc.diskonRp,
                ppnRp: calc.ppnRp,
                total: calc.total,
                marketingUid: user.uid,
                marketingNama: user.name,
                marketingWa: user.wa,
                status: "pending",
                companyId: user.companyId,
            }, pdfBlob);

            navigate("/quotations");
        } catch (err) {
            setSaveErr(err instanceof Error ? err.message : "Terjadi kesalahan. Coba lagi.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate("/quotations")}
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                    <ArrowLeft size={16} />
                </button>
                <div>
                    <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <FileText size={18} className="text-blue-600" />
                        Buat Quotation Baru
                    </h1>
                    <p className="text-xs text-slate-400">PT Guci Emas Pratama — nomor surat otomatis</p>
                </div>
            </div>

            {/* Step indicator */}
            <StepIndicator current={step} />

            {/* Form card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                {step === 0 && (
                    <Step1
                        jenisLayanan={jenisLayanan} tipe={tipe} kepada={kepada} noPreview={noPreview}
                        onLayanan={setJenisLayanan} onTipe={setTipe} onKepada={setKepada}
                        errors={errors}
                    />
                )}
                {step === 1 && (
                    <Step2
                        nama={kepadaNama} alamatLines={kepadaAlamat} up={kepadaUp}
                        onNama={setKepadaNama} onAlamat={setKepadaAlamat} onUp={setKepadaUp}
                        errors={errors}
                    />
                )}
                {step === 2 && (
                    <Step3
                        items={items} biayaTambahan={biayaTambahan}
                        diskonPct={diskonPct} ppn={ppn} ppnDppFaktor={ppnDppFaktor}
                        garansiTahun={garansiTahun} jenisGaransi={jenisGaransi}
                        jenisLayanan={jenisLayanan}
                        onItems={setItems} onBiaya={setBiayaTambahan}
                        onDiskon={setDiskonPct} onPpn={setPpn} onPpnDpp={setPpnDppFaktor}
                        onGaransi={setGaransiTahun} onJenisGaransi={setJenisGaransi}
                    />
                )}
                {step === 3 && (
                    <Step4
                        noSurat={noPreview} jenisLayanan={jenisLayanan} tipe={tipe}
                        kepadaNama={kepadaNama || kepada}
                        kepadaAlamatLines={kepadaAlamat}
                        total={calc.total}
                        marketingNama={user?.name ?? ""}
                        marketingWa={user?.wa}
                    />
                )}

                {saveErr && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                        <AlertCircle size={14} /> {saveErr}
                    </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between mt-6 pt-4 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={handleBack}
                        disabled={step === 0}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-30 transition-colors">
                        <ArrowLeft size={14} /> Kembali
                    </button>

                    {step < STEPS.length - 1 ? (
                        <button type="button" onClick={handleNext}
                            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                            Lanjut <ArrowRight size={14} />
                        </button>
                    ) : (
                        <button type="button" onClick={handleSubmit} disabled={saving}
                            className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            {saving ? "Menyimpan..." : "Generate PDF & Simpan"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
