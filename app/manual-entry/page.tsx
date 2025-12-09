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

  const taxNominal = useMemo(() => {
    if (taxMode === "nominal") return Math.round((taxValue || 0) * 100) / 100;
    // percent mode
    return Math.round(((subtotal * (taxValue || 0)) / 100) * 100) / 100;
  }, [taxMode, taxValue, subtotal]);

  const total = Math.round((subtotal + taxNominal) * 100) / 100;

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
    const receipt = {
      items: cleaned,
      subtotal:
        Math.round(cleaned.reduce((s, it) => s + it.price, 0) * 100) / 100,
      tax: Math.round(taxNominal * 100) / 100,
      total:
        Math.round(
          (Math.round(cleaned.reduce((s, it) => s + it.price, 0) * 100) / 100 +
            Math.round(taxNominal * 100) / 100) *
            100
        ) / 100,
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
    const receipt = {
      items: cleaned,
      subtotal:
        Math.round(cleaned.reduce((s, it) => s + it.price, 0) * 100) / 100,
      tax: Math.round(taxNominal * 100) / 100,
      total:
        Math.round(
          (Math.round(cleaned.reduce((s, it) => s + it.price, 0) * 100) / 100 +
            Math.round(taxNominal * 100) / 100) *
            100
        ) / 100,
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
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black text-slate-100">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="w-10 h-10 rounded-md bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white font-semibold shadow-md">
                SB
              </div>
              <div className="text-sm font-medium tracking-wide">SplitBill</div>
            </div>
          </Link>
        </div>
        <nav className="flex items-center gap-4">
          <Link
            href="/upload-receipt"
            className="inline-flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-white/20 transition"
          >
            ← Kembali
          </Link>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold mb-6">Masukan Data Manual</h1>

        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center mb-3">
            <label className="text-sm text-slate-300">Currency</label>
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
                className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
              >
                {commonCurrencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="OTHER">Other</option>
              </select>
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                placeholder="Kode (mis. IDR)"
                className="w-28 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 mt-10">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-slate-100">
                Daftar Item
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowAddRow((s) => !s);
                    setEditingIndex(null);
                  }}
                  className="px-3 py-2 bg-indigo-600 text-white rounded hover:scale-105 transform transition"
                >
                  + Tambah Item
                </button>
              </div>
            </div>

            {showAddRow && (
              <div className="flex flex-col sm:flex-row gap-2 mb-2">
                <input
                  placeholder="Nama item"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-3 px-3 py-2 rounded border bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  placeholder="Jumlah item"
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                  className="flex-1 sm:w-20 w-full px-3 py-2 rounded border bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  placeholder="Harga item"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="sm:w-36 w-full px-3 py-2 rounded border bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {editingIndex == null ? (
                  <button
                    onClick={addItem}
                    className="px-3 py-2 bg-indigo-600 rounded text-sm text-white hover:scale-105 transform transition"
                  >
                    Tambah
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      className="px-3 py-2 bg-emerald-600 rounded text-sm text-white hover:scale-105 transform transition"
                    >
                      Simpan
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-2 border rounded text-sm hover:scale-105 transform transition"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-700">
              <table className="w-full text-sm ">
                <thead className="text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="text-left px-4 py-2">No</th>
                    <th className="text-left px-4 py-2">Nama</th>
                    <th className="text-center px-4 py-2">Jumlah</th>
                    <th className="text-right px-4 py-2">Harga</th>
                    <th className="text-right px-4 py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {items.map((it, i) => (
                    <tr key={i} className="hover:bg-slate-700/20">
                      <td className="px-4 py-2">{i + 1}</td>
                      <td className="px-4 py-2">
                        <div className="line-clamp-2" title={it.name}>
                          {it.name}
                        </div>
                        <button
                          onClick={() => {
                            setModalText(it.name || "");
                            setModalOpen(true);
                          }}
                          className="text-xs text-slate-400 mt-1 inline-flex items-center gap-1 hover:text-blue-400"
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
                      <td className="px-4 py-2 text-center">{it.quantity}</td>
                      <td className="px-4 py-2 text-right">
                        {formatMoney(it.price)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() =>
                            setItems((s) => s.filter((_, idx) => idx !== i))
                          }
                          className="text-red-400 text-sm"
                        >
                          Hapus
                        </button>
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
                              className="text-xs text-slate-400 hover:text-blue-400 inline-flex items-center gap-1.5 transition"
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

            <div className="flex flex-row items-center sm:items-center gap-4 mt-3">
              <div className="flex gap-2 items-center w-full sm:w-auto">
                <label className="text-sm text-slate-300">Tax Mode:</label>
                <select
                  value={taxMode}
                  onChange={(e) => setTaxMode(e.target.value as any)}
                  className="bg-slate-700 py-0.5 rounded"
                >
                  <option value="nominal">Nominal</option>
                  <option value="percent">Percent</option>
                </select>
              </div>
              <div className="w-full sm:w-auto py-1.5">
                <div className="flex items-center gap-2 bg-slate-700 py-0.5 pr-1.5 rounded">
                  <input
                    type="number"
                    value={taxValue}
                    onChange={(e) => setTaxValue(Number(e.target.value) || 0)}
                    className="w-full sm:w-40 bg-transparent text-right outline-none"
                  />
                  <div className="text-xs text-slate-400 ml-2">
                    {taxMode === "nominal" ? getCurrencySymbol(currency) : "%"}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/40 rounded-md p-4 mt-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                <div>
                  <div className="text-sm text-slate-400">Subtotal</div>
                  <div className="font-medium mt-1">
                    {formatMoney(subtotal)}
                  </div>
                </div>

                <div className="mt-3 sm:mt-0">
                  <div className="text-sm text-slate-400">Pajak/Tax</div>
                  <div className="mt-1 text-sm text-slate-300">
                    {formatMoney(taxNominal)}
                  </div>
                </div>

                <div className="text-left mt-3 sm:mt-0">
                  <div className="text-sm text-slate-400">Total</div>
                  <div className="text-2xl font-bold text-indigo-300 mt-1">
                    {formatMoney(total)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-row gap-3 mt-6 w-auto text-sm sm:text-base">
              <button
                onClick={goToSplitByItem}
                className="px-4 py-2 bg-emerald-600 rounded text-white hover:scale-105 transform transition"
              >
                ➗ Split by Item
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem("parsedReceipt");
                  router.push("/upload-receipt");
                }}
                className="px-4 py-2 bg-slate-700 rounded text-white hover:scale-105 transform transition"
              >
                📷 Scan Struk Baru
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
