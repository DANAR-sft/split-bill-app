"use client";

import React, { useMemo, useState } from "react";
import TruncatedTextModal from "../components/TruncatedTextModal/TruncatedTextModal";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Item = {
  name: string;
  quantity: number;
  price: number;
};

export default function ManualEntryPage() {
  const router = useRouter();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showAddRow, setShowAddRow] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState<string>("");
  const [newPrice, setNewPrice] = useState<string>("");
  const [taxMode, setTaxMode] = useState<"nominal" | "percent">("nominal");
  const [taxValue, setTaxValue] = useState<number>(0);
  const [discountMode, setDiscountMode] = useState<"nominal" | "percent">(
    "nominal"
  );
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [currency, setCurrency] = useState<string>("IDR");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalText, setModalText] = useState("");
  // Pagination for mobile card list
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + (it.price || 0), 0),
    [items]
  );

  const discountNominal = useMemo(() => {
    if (discountMode === "nominal")
      return Math.round((discountValue || 0) * 100) / 100;
    // percent mode - diskon dihitung dari subtotal
    return Math.round(((subtotal * (discountValue || 0)) / 100) * 100) / 100;
  }, [discountMode, discountValue, subtotal]);

  const subtotalAfterDiscount =
    Math.round((subtotal - discountNominal) * 100) / 100;

  const taxNominal = useMemo(() => {
    if (taxMode === "nominal") return Math.round((taxValue || 0) * 100) / 100;
    // percent mode - pajak dihitung setelah diskon
    return (
      Math.round(((subtotalAfterDiscount * (taxValue || 0)) / 100) * 100) / 100
    );
  }, [taxMode, taxValue, subtotalAfterDiscount]);

  const total = Math.round((subtotalAfterDiscount + taxNominal) * 100) / 100;

  const formatMoney = (value: number) => {
    // Prefer explicit symbol mapping so we don't get localized prefixes like "US$".
    const code = (currency || "IDR").toUpperCase();
    const symbols: Record<string, string> = {
      IDR: "Rp",
      USD: "$",
      CNY: "¥",
      MYR: "RM",
      GBP: "£",
      EUR: "€",
    };
    const sym = symbols[code] || code;
    try {
      const isIdr = code === "IDR";
      const formattedNumber = new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: isIdr ? 0 : 2,
        maximumFractionDigits: isIdr ? 0 : 2,
      }).format(value);
      return `${sym}${formattedNumber}`;
    } catch (e) {
      const formatted =
        code === "IDR" ? String(Math.round(value)) : value.toFixed(2);
      return `${sym}${formatted}`;
    }
  };

  const getCurrencySymbol = (code?: string) => {
    const symbols: Record<string, string> = {
      IDR: "Rp",
      USD: "$",
      CNY: "¥",
      MYR: "RM",
      GBP: "£",
      EUR: "€",
    };
    if (!code) return "";
    const c = code.toUpperCase();
    return symbols[c] || c;
  };

  const commonCurrencies = ["IDR", "USD", "CNY", "MYR", "GBP"];

  const addItem = () => {
    const q = Number(newQty) || 1;
    const p = Number(newPrice) || 0;
    if (!newName.trim()) {
      alert("Nama item tidak boleh kosong");
      return;
    }
    setItems((s) => [
      ...s,
      { name: newName.trim(), quantity: q, price: Math.round(p * 100) / 100 },
    ]);
    setNewName("");
    setNewQty("");
    setNewPrice("");
  };

  const startEdit = (index: number) => {
    const it = items[index];
    setNewName(it.name);
    setNewQty(String(it.quantity || 1));
    setNewPrice(String(it.price || 0));
    setEditingIndex(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setShowAddRow(true);
  };

  const saveEdit = () => {
    if (editingIndex == null) return;
    const q = Number(newQty) || 1;
    const p = Number(newPrice) || 0;
    setItems((prev) => {
      const next = [...prev];
      next[editingIndex] = {
        name: newName.trim(),
        quantity: q,
        price: Math.round(p * 100) / 100,
      };
      return next;
    });
    setEditingIndex(null);
    setShowAddRow(false);
    setNewName("");
    setNewQty("");
    setNewPrice("");
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setShowAddRow(false);
    setNewName("");
    setNewQty("");
    setNewPrice("");
  };

  const goToSplitByItem = () => {
    const cleaned = items
      .filter((it) => it.name.trim() !== "")
      .map((it) => ({ ...it, price: Math.round(it.price * 100) / 100 }));
    const rawSubtotal =
      Math.round(cleaned.reduce((s, it) => s + it.price, 0) * 100) / 100;
    const calcDiscount =
      discountMode === "nominal"
        ? Math.round((discountValue || 0) * 100) / 100
        : Math.round(((rawSubtotal * (discountValue || 0)) / 100) * 100) / 100;
    const subAfterDisc = Math.round((rawSubtotal - calcDiscount) * 100) / 100;
    const calcTax =
      taxMode === "nominal"
        ? Math.round((taxValue || 0) * 100) / 100
        : Math.round(((subAfterDisc * (taxValue || 0)) / 100) * 100) / 100;
    const receipt = {
      items: cleaned,
      subtotal: rawSubtotal,
      discount: calcDiscount,
      tax: calcTax,
      total: Math.round((subAfterDisc + calcTax) * 100) / 100,
      currency,
    };
    try {
      localStorage.setItem("parsedReceipt", JSON.stringify(receipt));
      router.push("/split-by-item");
    } catch (e) {
      console.warn(e);
      alert("Gagal menyimpan");
    }
  };

  const saveReceipt = () => {
    const cleaned = items
      .filter((it) => it.name.trim() !== "")
      .map((it) => ({ ...it, price: Math.round(it.price * 100) / 100 }));
    if (cleaned.length === 0) {
      alert("Masukkan minimal satu item sebelum menyimpan.");
      return;
    }
    const rawSubtotal2 =
      Math.round(cleaned.reduce((s, it) => s + it.price, 0) * 100) / 100;
    const calcDiscount2 =
      discountMode === "nominal"
        ? Math.round((discountValue || 0) * 100) / 100
        : Math.round(((rawSubtotal2 * (discountValue || 0)) / 100) * 100) / 100;
    const subAfterDisc2 =
      Math.round((rawSubtotal2 - calcDiscount2) * 100) / 100;
    const calcTax2 =
      taxMode === "nominal"
        ? Math.round((taxValue || 0) * 100) / 100
        : Math.round(((subAfterDisc2 * (taxValue || 0)) / 100) * 100) / 100;
    const receipt = {
      items: cleaned,
      subtotal: rawSubtotal2,
      discount: calcDiscount2,
      tax: calcTax2,
      total: Math.round((subAfterDisc2 + calcTax2) * 100) / 100,
      currency,
    };
    try {
      localStorage.setItem("parsedReceipt", JSON.stringify(receipt));
      router.push("/receipt-result");
    } catch (e) {
      console.warn(e);
      alert("Gagal menyimpan data ke localStorage.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-semibold">
                SB
              </div>
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
        <h1 className="text-2xl font-bold text-slate-100 mb-6">
          Masukan Data Manual
        </h1>

        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-4">
            <label className="text-sm font-medium text-slate-300">
              Mata Uang
            </label>
            <div className="flex items-center gap-2">
              <select
                value={commonCurrencies.includes(currency) ? currency : "OTHER"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "OTHER") {
                    setCurrency("");
                  } else {
                    setCurrency(v);
                  }
                }}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {commonCurrencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="OTHER">Lainnya</option>
              </select>
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                placeholder="Kode (mis. IDR)"
                className="w-28 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-100">
                Daftar Item
              </h2>
              <button
                onClick={() => {
                  setShowAddRow((s) => !s);
                  setEditingIndex(null);
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500 transition"
              >
                + Tambah Item
              </button>
            </div>

            {showAddRow && (
              <div className="flex flex-col sm:flex-row gap-3 mb-3 p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
                <input
                  placeholder="Nama item"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-3 px-3 py-2 rounded-lg border border-slate-600 bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  placeholder="Jumlah"
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                  className="flex-1 sm:w-20 w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  placeholder="Harga"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="sm:w-36 w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {editingIndex == null ? (
                  <button
                    onClick={addItem}
                    className="px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-500 transition"
                  >
                    Tambah
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      className="px-4 py-2 bg-emerald-600 rounded-lg text-sm font-medium text-white hover:bg-emerald-500 transition"
                    >
                      Simpan
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 border border-slate-600 rounded-lg text-sm font-medium hover:bg-slate-700 transition"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="hidden md:block rounded-xl border border-slate-700/50">
              <table className="w-full text-sm table-fixed">
                <thead className="text-slate-400 bg-slate-800/50 border-b border-slate-700/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium w-[60px]">
                      No
                    </th>
                    <th className="text-left px-4 py-3 font-medium">Nama</th>
                    <th className="text-center px-4 py-3 font-medium w-[80px]">
                      Jumlah
                    </th>
                    <th className="text-right px-4 py-3 font-medium w-[120px]">
                      Harga
                    </th>
                    <th className="text-right px-4 py-3 font-medium w-[100px]">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {items.map((it, i) => (
                    <tr key={i} className="hover:bg-slate-700/20 transition">
                      <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="truncate" title={it.name}>
                          {it.name}
                        </div>
                        <button
                          onClick={() => {
                            setModalText(it.name || "");
                            setModalOpen(true);
                          }}
                          className="text-xs text-slate-500 mt-2 inline-flex items-center gap-1.5 hover:text-indigo-400 transition"
                          aria-label="Lihat detail"
                        >
                          <svg
                            className="w-3 h-3"
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
                          Lihat
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">{it.quantity}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatMoney(it.price)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => startEdit(i)}
                            className="text-indigo-400 hover:text-indigo-300 text-sm transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() =>
                              setItems((s) => s.filter((_, idx) => idx !== i))
                            }
                            className="text-red-400 hover:text-red-300 text-sm transition"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List with Pagination */}
            <div className="md:hidden space-y-3">
              {(() => {
                const totalPages = Math.ceil(items.length / itemsPerPage);
                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const paginatedItems = items.slice(startIndex, endIndex);

                return (
                  <>
                    {paginatedItems.map((it, idx) => {
                      const i = startIndex + idx;
                      return (
                        <div
                          key={i}
                          className="bg-slate-800/80 rounded-xl p-4 shadow-lg border border-slate-700/50 hover:border-indigo-500/30 transition-all"
                        >
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded">
                                  #{i + 1}
                                </span>
                              </div>
                              <h3
                                className="font-semibold text-white line-clamp-2 mt-4"
                                title={it.name}
                              >
                                {it.name}
                              </h3>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-lg font-bold text-indigo-400">
                                {formatMoney(it.price)}
                              </div>
                            </div>
                          </div>

                          {/* Card Body */}
                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400 bg-slate-700/30 px-2 py-1 rounded">
                                Jumlah: {it.quantity}
                              </span>
                            </div>
                          </div>

                          {/* Card Actions */}
                          <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                            <button
                              onClick={() => {
                                setModalText(it.name || "");
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
                              <button
                                onClick={() => startEdit(i)}
                                className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-500/10 transition"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() =>
                                  setItems((s) =>
                                    s.filter((_, idx) => idx !== i)
                                  )
                                }
                                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition"
                              >
                                🗑️ Hapus
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Pagination Controls */}
                    {items.length > itemsPerPage && (
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
                    {items.length > 0 && (
                      <div className="text-center text-xs text-slate-500 pt-2">
                        Menampilkan {startIndex + 1}-
                        {Math.min(endIndex, items.length)} dari {items.length}{" "}
                        item
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <TruncatedTextModal
              open={modalOpen}
              text={modalText}
              title="Detail Item"
              onClose={() => setModalOpen(false)}
            />

            {/* Diskon Input */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-6 p-4 bg-slate-800/40 rounded-lg border border-slate-700/50">
              <div className="flex gap-3 items-center w-full sm:w-auto">
                <label className="text-sm font-medium text-slate-300">
                  Diskon:
                </label>
                <select
                  value={discountMode}
                  onChange={(e) => setDiscountMode(e.target.value as any)}
                  className="bg-slate-700 border border-slate-600 py-2 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="nominal">Nominal</option>
                  <option value="percent">Persen</option>
                </select>
              </div>
              <div className="w-full sm:w-auto">
                <div className="flex items-center gap-2 bg-slate-700 border border-slate-600 py-2 px-3 rounded-lg">
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) =>
                      setDiscountValue(Number(e.target.value) || 0)
                    }
                    className="w-full sm:w-40 bg-transparent text-right outline-none"
                    placeholder="0"
                    min={0}
                  />
                  <div className="text-sm text-slate-400">
                    {discountMode === "nominal"
                      ? getCurrencySymbol(currency)
                      : "%"}
                  </div>
                </div>
              </div>
            </div>

            {/* Tax Input */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-3 p-4 bg-slate-800/40 rounded-lg border border-slate-700/50">
              <div className="flex gap-3 items-center w-full sm:w-auto">
                <label className="text-sm font-medium text-slate-300">
                  Pajak:
                </label>
                <select
                  value={taxMode}
                  onChange={(e) => setTaxMode(e.target.value as any)}
                  className="bg-slate-700 border border-slate-600 py-2 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="nominal">Nominal</option>
                  <option value="percent">Persen</option>
                </select>
              </div>
              <div className="w-full sm:w-auto">
                <div className="flex items-center gap-2 bg-slate-700 border border-slate-600 py-2 px-3 rounded-lg">
                  <input
                    type="number"
                    value={taxValue}
                    onChange={(e) => setTaxValue(Number(e.target.value) || 0)}
                    className="w-full sm:w-40 bg-transparent text-right outline-none"
                    placeholder="0"
                    min={0}
                  />
                  <div className="text-sm text-slate-400">
                    {taxMode === "nominal" ? getCurrencySymbol(currency) : "%"}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/60 rounded-xl p-5 mt-6 border border-slate-700/50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div>
                  <div className="text-sm font-medium text-slate-400 mb-1">
                    Subtotal
                  </div>
                  <div className="font-semibold text-slate-100">
                    {formatMoney(subtotal)}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-slate-400 mb-1">
                    Diskon
                  </div>
                  <div className="font-semibold text-red-400">
                    {discountNominal > 0
                      ? `-${formatMoney(discountNominal)}`
                      : formatMoney(0)}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-slate-400 mb-1">
                    Pajak
                  </div>
                  <div className="font-semibold text-slate-100">
                    {formatMoney(taxNominal)}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-slate-400 mb-1">
                    Total
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-indigo-400">
                    {formatMoney(total)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-row gap-3 mt-8">
              <button
                onClick={goToSplitByItem}
                className="px-5 py-3 bg-emerald-600 rounded-lg text-white font-medium hover:bg-emerald-500 transition"
              >
                Split by Item
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem("parsedReceipt");
                  router.push("/upload-receipt");
                }}
                className="px-5 py-3 bg-slate-700 rounded-lg text-white font-medium hover:bg-slate-600 transition"
              >
                Scan Struk Baru
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
