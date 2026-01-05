"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/app/components/Logo/Logo";
import { parseReceiptWithAI, Receipt, ReceiptItem } from "@/app/util/geminiAI";
import TruncatedTextModal from "../components/TruncatedTextModal/TruncatedTextModal";

export default function ReceiptResult() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [ocrText, setOcrText] = useState<string>("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ReceiptItem | null>(null);
  const [editQuantityRaw, setEditQuantityRaw] = useState<string>("");
  const [editPriceRaw, setEditPriceRaw] = useState<string>("");
  const [addMode, setAddMode] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>("");
  const [newQuantityRaw, setNewQuantityRaw] = useState<string>("");
  const [newPriceRaw, setNewPriceRaw] = useState<string>("");
  const [taxMode, setTaxMode] = useState<"nominal" | "percent">("nominal");
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [discountMode, setDiscountMode] = useState<"nominal" | "percent">(
    "nominal"
  );
  const [discountValue, setDiscountValue] = useState<number>(0);
  // Pagination for mobile card list
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  // Modal for viewing full item name
  const [modalOpen, setModalOpen] = useState(false);
  const [modalText, setModalText] = useState("");

  useEffect(() => {
    let isCancelled = false;

    const savedOcr = localStorage.getItem("ocrResult");
    if (!savedOcr) {
      setError("Tidak ada hasil OCR. Silakan scan struk terlebih dahulu.");
      setLoading(false);
      return;
    }

    setOcrText(savedOcr);

    async function runProcessWithAI() {
      try {
        setLoading(true);
        setError("");
        const result = await parseReceiptWithAI(savedOcr!);
        if (!isCancelled) {
          setReceipt(result);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error("AI parsing failed:", err);
          setError("Gagal memproses struk: " + (err?.message ?? String(err)));
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    runProcessWithAI();

    return () => {
      isCancelled = true;
    };
  }, []);

  async function processWithAI(text: string) {
    try {
      setLoading(true);
      setError("");
      const result = await parseReceiptWithAI(text);
      setReceipt(result);
    } catch (err: any) {
      console.error("AI parsing failed:", err);
      setError("Gagal memproses struk: " + (err?.message ?? String(err)));
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: number, currency: string = "IDR") {
    const localeMap: Record<string, string> = {
      IDR: "id-ID",
      USD: "en-US",
      CNY: "zh-CN",
      MYR: "ms-MY",
      GBP: "en-GB",
    };

    const symbols: Record<string, string> = {
      IDR: "Rp",
      USD: "$",
      CNY: "¥",
      MYR: "RM",
      GBP: "£",
      EUR: "€",
    };

    const code = (currency || "IDR").toUpperCase();
    const locale = localeMap[code] || "en-US";
    const sym = symbols[code] || code;

    const isIdr = code === "IDR";
    const formattedNumber = new Intl.NumberFormat(locale, {
      minimumFractionDigits: isIdr ? 0 : 2,
      maximumFractionDigits: isIdr ? 0 : 2,
    }).format(amount);

    // No space between symbol and number for requested format (e.g. Rp1.000)
    return `${sym}${formattedNumber}`;
  }

  const parseRawNumber = (raw: string) => {
    if (!raw || raw.trim() === "") return 0;
    const normalized = raw.trim();
    const withLeadingZero = normalized.startsWith(".")
      ? `0${normalized}`
      : normalized;
    const n = Number(withLeadingZero.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  function startEdit(index: number) {
    if (receipt) {
      setEditingIndex(index);
      const it = { ...receipt.items[index] };
      setEditForm(it);
      setEditQuantityRaw(String(it.quantity || ""));
      setEditPriceRaw(String(it.price || ""));
    }
  }

  function cancelEdit() {
    setEditingIndex(null);
    setEditForm(null);
    setEditQuantityRaw("");
    setEditPriceRaw("");
  }

  function saveEdit() {
    if (receipt && editForm !== null && editingIndex !== null) {
      const newItems = [...receipt.items];

      const quantity = parseRawNumber(editQuantityRaw);
      const price = parseRawNumber(editPriceRaw);

      editForm.quantity = quantity;
      editForm.price = price;

      newItems[editingIndex] = editForm;

      // Recalculate totals using price directly
      const newSubtotal = newItems.reduce((sum, item) => sum + item.price, 0);
      const newTotal = newSubtotal + (receipt.tax || 0);

      setReceipt({
        ...receipt,
        items: newItems,
        subtotal: newSubtotal,
        total: newTotal,
      });
      setEditingIndex(null);
      setEditForm(null);
      setEditQuantityRaw("");
      setEditPriceRaw("");
    }
  }

  function startAdd() {
    setAddMode(true);
    setNewName("");
    setNewQuantityRaw("");
    setNewPriceRaw("");
  }

  function cancelAdd() {
    setAddMode(false);
    setNewName("");
    setNewQuantityRaw("");
    setNewPriceRaw("");
  }

  function addNewItem() {
    if (!receipt) return;

    const quantity = parseRawNumber(newQuantityRaw);
    const price = parseRawNumber(newPriceRaw);

    const newItem: ReceiptItem = {
      name: newName || "(Item baru)",
      quantity,
      price,
    } as ReceiptItem;

    const newItems = [...receipt.items, newItem];
    const newSubtotal = newItems.reduce((s, it) => s + it.price, 0);
    const newTotal = newSubtotal + (receipt.tax || 0);

    setReceipt({
      ...receipt,
      items: newItems,
      subtotal: newSubtotal,
      total: newTotal,
    });
    // reset add form
    cancelAdd();
  }

  function updateTax(newTax: number | null) {
    if (receipt) {
      const taxVal = Number.isFinite(newTax as number) ? (newTax as number) : 0;
      const discountVal = receipt.discount || 0;
      const subtotalAfterDiscount = receipt.subtotal - discountVal;
      const newTotal = subtotalAfterDiscount + (taxVal || 0);
      setReceipt({
        ...receipt,
        tax: taxVal,
        total: newTotal,
      });
    }
  }

  function updateTaxByPercent(percent: number) {
    if (receipt) {
      const pct = Number.isFinite(percent) ? percent : 0;
      setTaxPercent(pct);
      const discountVal = receipt.discount || 0;
      const subtotalAfterDiscount = receipt.subtotal - discountVal;
      const calculatedTax = Math.round((subtotalAfterDiscount * pct) / 100);
      const newTotal = subtotalAfterDiscount + calculatedTax;
      setReceipt({
        ...receipt,
        tax: calculatedTax,
        total: newTotal,
      });
    }
  }

  function handleTaxModeChange(mode: "nominal" | "percent") {
    setTaxMode(mode);
    if (mode === "percent" && receipt) {
      // Calculate current tax as percent
      const subtotalAfterDiscount = receipt.subtotal - (receipt.discount || 0);
      const currentPercent = receipt.tax
        ? Math.round((receipt.tax / subtotalAfterDiscount) * 100 * 10) / 10
        : 0;
      setTaxPercent(currentPercent);
    }
  }

  function handleDiscountModeChange(mode: "nominal" | "percent") {
    setDiscountMode(mode);
    if (mode === "percent" && receipt) {
      // Calculate current discount as percent
      const currentPercent = receipt.discount
        ? Math.round((receipt.discount / receipt.subtotal) * 100 * 10) / 10
        : 0;
      setDiscountValue(currentPercent);
    }
  }

  function updateDiscount(newDiscount: number) {
    if (receipt) {
      const discVal = Number.isFinite(newDiscount) ? newDiscount : 0;
      const subtotalAfterDiscount = receipt.subtotal - discVal;
      const taxVal = receipt.tax || 0;
      const newTotal = subtotalAfterDiscount + taxVal;
      setReceipt({
        ...receipt,
        discount: discVal,
        total: newTotal,
      });
    }
  }

  function updateDiscountByPercent(percent: number) {
    if (receipt) {
      const pct = Number.isFinite(percent) ? percent : 0;
      setDiscountValue(pct);
      const calculatedDiscount = Math.round((receipt.subtotal * pct) / 100);
      const subtotalAfterDiscount = receipt.subtotal - calculatedDiscount;
      const taxVal = receipt.tax || 0;
      const newTotal = subtotalAfterDiscount + taxVal;
      setReceipt({
        ...receipt,
        discount: calculatedDiscount,
        total: newTotal,
      });
    }
  }

  function deleteItem(index: number) {
    if (receipt) {
      const newItems = receipt.items.filter((_, i) => i !== index);
      const newSubtotal = newItems.reduce((sum, item) => sum + item.price, 0);
      const discountVal = receipt.discount || 0;
      const subtotalAfterDiscount = newSubtotal - discountVal;
      const newTotal = subtotalAfterDiscount + (receipt.tax || 0);

      setReceipt({
        ...receipt,
        items: newItems,
        subtotal: newSubtotal,
        total: newTotal,
      });
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer">
              <Logo />
              <div className="text-sm font-medium">SplitBill</div>
            </div>
          </Link>
        </div>

        <nav className="flex items-center gap-4">
          <Link
            href="/upload-receipt"
            className="inline-flex items-center gap-2 text-slate-300 hover:text-white px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 transition"
          >
            ← Kembali
          </Link>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-100 mb-8">
          Hasil Analisis Struk
        </h1>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-400">Memproses struk dengan AI...</p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-6 text-center">
            <p className="text-red-300 mb-4">{error}</p>
            <Link
              href="/upload-receipt"
              className="px-4 py-2 bg-slate-700 rounded text-white hover:bg-slate-600 transition"
            >
              Scan Struk Baru
            </Link>
          </div>
        )}

        {receipt && !loading && (
          <div className="space-y-6">
            {/* Items Table */}
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/50 flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-slate-100">
                  Daftar Item
                </h2>
                <div className="flex items-center gap-2">
                  {addMode ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
                      <input
                        type="text"
                        placeholder="Nama item"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="flex-1 min-w-0 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Jumlah"
                        value={newQuantityRaw}
                        onChange={(e) => setNewQuantityRaw(e.target.value)}
                        className="w-full sm:w-20 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white text-left focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Harga"
                        value={newPriceRaw}
                        onChange={(e) => setNewPriceRaw(e.target.value)}
                        className="w-full sm:w-28 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white text-left focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          onClick={addNewItem}
                          className="flex-1 sm:flex-none bg-emerald-600 px-4 py-2 rounded-lg text-sm font-medium text-white hover:bg-emerald-500 transition"
                        >
                          Tambah
                        </button>
                        <button
                          onClick={cancelAdd}
                          className="flex-1 sm:flex-none bg-slate-600 px-3 py-2 rounded-lg text-sm font-medium text-white hover:bg-slate-500 transition"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={startAdd}
                      className="bg-indigo-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-500 transition"
                    >
                      + Tambah Item
                    </button>
                  )}
                </div>
              </div>
              <div className="hidden md:block">
                <table className="w-full table-fixed">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-400 w-[8%]">
                        No
                      </th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-slate-400 w-[40%]">
                        Nama Barang
                      </th>
                      <th className="text-center px-6 py-3 text-sm font-medium text-slate-400 w-[15%]">
                        Jumlah
                      </th>
                      <th className="text-right px-6 py-3 text-sm font-medium text-slate-400 w-[22%]">
                        Harga
                      </th>
                      <th className="text-right px-6 py-3 text-sm font-medium text-slate-400 w-[15%]">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {receipt.items.map((item, index) => (
                      <tr
                        key={index}
                        className="hover:bg-slate-700/30 transition"
                      >
                        {editingIndex === index ? (
                          // Edit Mode
                          <>
                            <td className="px-6 py-4 text-sm text-slate-400">
                              {index + 1}
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={editForm?.name || ""}
                                onChange={(e) =>
                                  setEditForm((prev) =>
                                    prev
                                      ? { ...prev, name: e.target.value }
                                      : null
                                  )
                                }
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={editQuantityRaw}
                                onChange={(e) => {
                                  setEditQuantityRaw(e.target.value);
                                }}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={editPriceRaw}
                                onChange={(e) => {
                                  setEditPriceRaw(e.target.value);
                                }}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={saveEdit}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
                                >
                                  ✕
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          // View Mode
                          <>
                            <td className="px-6 py-4 text-sm text-slate-400">
                              {index + 1}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium">
                              <div className="truncate" title={item.name}>
                                {item.name}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-center">
                              {item.quantity}
                            </td>
                            <td className="px-6 py-4 text-sm text-right">
                              {formatCurrency(item.price, receipt.currency)}
                            </td>
                            <td className="px-6 py-4 text-sm text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => startEdit(index)}
                                  className="text-indigo-400 hover:text-indigo-300 text-xs"
                                  title="Edit"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => deleteItem(index)}
                                  className="text-red-400 hover:text-red-300 text-xs"
                                  title="Hapus"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List with Pagination */}
              <div className="md:hidden px-4 py-4 space-y-3">
                {(() => {
                  const totalPages = Math.ceil(
                    receipt.items.length / itemsPerPage
                  );
                  const startIndex = (currentPage - 1) * itemsPerPage;
                  const endIndex = startIndex + itemsPerPage;
                  const paginatedItems = receipt.items.slice(
                    startIndex,
                    endIndex
                  );

                  return (
                    <>
                      {paginatedItems.map((item, idx) => {
                        const index = startIndex + idx;
                        return (
                          <div
                            key={index}
                            className="bg-slate-800/80 rounded-xl p-4 shadow-lg border border-slate-700/50 hover:border-indigo-500/30 transition-all"
                          >
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded">
                                    #{index + 1}
                                  </span>
                                </div>
                                {editingIndex === index ? (
                                  <input
                                    type="text"
                                    value={editForm?.name || ""}
                                    onChange={(e) =>
                                      setEditForm((prev) =>
                                        prev
                                          ? { ...prev, name: e.target.value }
                                          : null
                                      )
                                    }
                                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                                  />
                                ) : (
                                  <h3
                                    className="font-semibold text-white line-clamp-2 mt-4"
                                    title={item.name}
                                  >
                                    {item.name}
                                  </h3>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                {editingIndex === index ? (
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={editPriceRaw}
                                    onChange={(e) =>
                                      setEditPriceRaw(e.target.value)
                                    }
                                    className="w-24 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white text-right"
                                  />
                                ) : (
                                  <div className="text-lg font-bold text-indigo-400">
                                    {formatCurrency(
                                      item.price,
                                      receipt.currency
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Card Body */}
                            <div className="mt-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {editingIndex === index ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400">
                                      Jumlah:
                                    </span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={editQuantityRaw}
                                      onChange={(e) =>
                                        setEditQuantityRaw(e.target.value)
                                      }
                                      className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white text-center"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400 bg-slate-700/30 px-2 py-1 rounded">
                                    Jmlh: {item.quantity}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Card Actions */}
                            <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                              <button
                                onClick={() => {
                                  setModalText(item.name || "");
                                  setModalOpen(true);
                                }}
                                className="text-xs text-slate-400 hover:text-indigo-400 inline-flex items-center gap-1.5 transition"
                                aria-label="Lihat detail"
                              >
                                <svg
                                  className="w-4 h-4"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                  aria-hidden
                                >
                                  <path
                                    d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <circle
                                    cx="12"
                                    cy="12"
                                    r="3"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                                Lihat Detail
                              </button>
                              <div className="flex items-center gap-2">
                                {editingIndex === index ? (
                                  <>
                                    <button
                                      onClick={saveEdit}
                                      className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded transition"
                                    >
                                      ✓ Simpan
                                    </button>
                                    <button
                                      onClick={cancelEdit}
                                      className="text-xs bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded transition"
                                    >
                                      ✕ Batal
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => startEdit(index)}
                                      className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-500/10 transition"
                                    >
                                      ✏️ Edit
                                    </button>
                                    <button
                                      onClick={() => deleteItem(index)}
                                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition"
                                    >
                                      🗑️ Hapus
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Pagination Controls */}
                      {receipt.items.length > itemsPerPage && (
                        <div className="flex items-center justify-center gap-2 pt-4">
                          <button
                            onClick={() =>
                              setCurrentPage((p) => Math.max(1, p - 1))
                            }
                            disabled={currentPage === 1}
                            className="px-3 py-1 rounded-lg bg-slate-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600 transition"
                          >
                            ←
                          </button>
                          <div className="flex items-center gap-1">
                            {Array.from(
                              { length: totalPages },
                              (_, i) => i + 1
                            ).map((page) => (
                              <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                                  currentPage === page
                                    ? "bg-indigo-600 text-white"
                                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                }`}
                              >
                                {page}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() =>
                              setCurrentPage((p) => Math.min(totalPages, p + 1))
                            }
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 rounded-lg bg-slate-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600 transition"
                          >
                            →
                          </button>
                        </div>
                      )}

                      {/* Items count info */}
                      {receipt.items.length > 0 && (
                        <div className="text-center text-xs text-slate-500 pt-2">
                          Menampilkan {startIndex + 1}-
                          {Math.min(endIndex, receipt.items.length)} dari{" "}
                          {receipt.items.length} item
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-6">
              <h2 className="text-lg font-semibold text-slate-100 mb-4">
                Ringkasan
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-3 border-b border-slate-700/50">
                  <span className="text-slate-400 font-medium">Subtotal</span>
                  <span className="font-semibold text-slate-100">
                    {formatCurrency(receipt.subtotal, receipt.currency)}
                  </span>
                </div>

                {/* Diskon Input */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-3 border-b border-slate-700/50 gap-3">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-red-400 font-medium">Diskon</span>
                    <div className="flex bg-slate-700 rounded-lg p-0.5">
                      <button
                        onClick={() => handleDiscountModeChange("nominal")}
                        className={`px-3 py-1.5 text-xs rounded-md font-medium transition ${
                          discountMode === "nominal"
                            ? "bg-red-600 text-white"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Nominal
                      </button>
                      <button
                        onClick={() => handleDiscountModeChange("percent")}
                        className={`px-3 py-1.5 text-xs rounded-md font-medium transition ${
                          discountMode === "percent"
                            ? "bg-red-600 text-white"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Persen
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
                    {discountMode === "nominal" ? (
                      <>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            receipt.discount === 0 ||
                            receipt.discount === null ||
                            receipt.discount === undefined
                              ? ""
                              : String(receipt.discount)
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            const cleaned = val.replace(/[^\d.,-]/g, "");
                            const parsed =
                              cleaned === "" ? 0 : parseRawNumber(cleaned);
                            updateDiscount(parsed);
                          }}
                          className="w-full sm:w-32 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-red-400 text-right focus:outline-none focus:ring-2 focus:ring-red-500"
                          placeholder="0"
                        />
                        <span className="text-xs text-slate-500 ml-2 sm:ml-0">
                          {receipt.currency}
                        </span>
                      </>
                    ) : (
                      <>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={
                            discountValue === 0 ? "" : String(discountValue)
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            const cleaned = val.replace(/[^\d.,-]/g, "");
                            const parsed =
                              cleaned === "" ? 0 : parseRawNumber(cleaned);
                            updateDiscountByPercent(parsed);
                          }}
                          className="w-12 sm:w-12 bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-sm text-red-400 text-right focus:outline-none focus:ring-2 focus:ring-red-500"
                          placeholder="0"
                        />
                        <span className="text-xs text-slate-500">%</span>
                        <span className="text-sm text-red-400 w-fit">
                          = -
                          {formatCurrency(
                            receipt.discount || 0,
                            receipt.currency
                          )}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Tax Input */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-3 border-b border-slate-700/50 gap-3">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-slate-400 font-medium">Pajak</span>
                    <div className="flex bg-slate-700 rounded-lg p-0.5">
                      <button
                        onClick={() => handleTaxModeChange("nominal")}
                        className={`px-3 py-1.5 text-xs rounded-md font-medium transition ${
                          taxMode === "nominal"
                            ? "bg-indigo-600 text-white"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Nominal
                      </button>
                      <button
                        onClick={() => handleTaxModeChange("percent")}
                        className={`px-3 py-1.5 text-xs rounded-md font-medium transition ${
                          taxMode === "percent"
                            ? "bg-indigo-600 text-white"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Persen
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
                    {taxMode === "nominal" ? (
                      <>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            receipt.tax === 0 || receipt.tax === null
                              ? ""
                              : String(receipt.tax)
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            const cleaned = val.replace(/[^\d.,-]/g, "");
                            const parsed =
                              cleaned === "" ? 0 : parseRawNumber(cleaned);
                            updateTax(parsed);
                          }}
                          className="w-full sm:w-32 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="0"
                        />
                        <span className="text-xs text-slate-500 ml-2 sm:ml-0">
                          {receipt.currency}
                        </span>
                      </>
                    ) : (
                      <>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={taxPercent === 0 ? "" : String(taxPercent)}
                          onChange={(e) => {
                            const val = e.target.value;
                            const cleaned = val.replace(/[^\d.,-]/g, "");
                            const parsed =
                              cleaned === "" ? 0 : parseRawNumber(cleaned);
                            updateTaxByPercent(parsed);
                          }}
                          className="w-12 sm:w-12 bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-sm text-white text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="0"
                        />
                        <span className="text-xs text-slate-500">%</span>
                        <span className="text-sm text-slate-300 w-fit">
                          = {formatCurrency(receipt.tax || 0, receipt.currency)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center py-4 text-lg">
                  <span className="font-semibold text-slate-100">Total</span>
                  <span className="font-bold text-xl text-indigo-400">
                    {formatCurrency(receipt.total, receipt.currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-4 pt-4">
              <button
                onClick={() => {
                  try {
                    localStorage.setItem(
                      "parsedReceipt",
                      JSON.stringify(receipt)
                    );
                  } catch (e) {
                    console.warn("localStorage set failed", e);
                  }
                  // navigate to split page
                  (window.location as any).href = "/split-by-item";
                }}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-600 rounded-lg text-white font-medium hover:bg-emerald-500 transition"
              >
                Split by Item
              </button>
              <Link
                href="/upload-receipt"
                className="flex items-center gap-2 px-5 py-3 bg-slate-700 rounded-lg text-white font-medium hover:bg-slate-600 transition"
              >
                Scan Struk Baru
              </Link>
            </div>
          </div>
        )}
      </main>
      <TruncatedTextModal
        open={modalOpen}
        text={modalText}
        title="Nama Item Lengkap"
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
