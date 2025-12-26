"use client";

import React, { useEffect, useMemo, useState } from "react";
import CalculatorOverlay from "./CalculatorOverlay";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TruncatedTextModal from "../components/TruncatedTextModal/TruncatedTextModal";

type ReceiptItem = {
  name: string;
  quantity: number;
  price: number;
};

type Receipt = {
  items: ReceiptItem[];
  subtotal: number;
  discount?: number | null;
  tax?: number | null;
  total: number;
  currency?: string;
};

export default function SplitByItemPage() {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [people, setPeople] = useState<string[]>(["Person 1"]);
  // assignments: itemIndex -> Set of person indices
  const [assignments, setAssignments] = useState<Record<number, number[]>>({});
  const [finalized, setFinalized] = useState<boolean>(false);
  const [splitMode, setSplitMode] = useState<"byItem" | "percentage">("byItem");
  const [percentages, setPercentages] = useState<number[]>([100]);
  const [taxSplitMode, setTaxSplitMode] = useState<"equal" | "assigned">(
    "equal"
  );
  const [taxPayer, setTaxPayer] = useState<number>(0);
  const [showCalculator, setShowCalculator] = useState(false);
  const [activePercentageIndex, setActivePercentageIndex] = useState<
    number | null
  >(null);

  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalText, setModalText] = useState("");
  // Pagination for mobile card list
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  // Pagination for people list (show 5 per page)
  const [peoplePage, setPeoplePage] = useState(1);
  const peoplePerPage = 5;
  // Pagination for summary (per-person) cards
  const [summaryPage, setSummaryPage] = useState(1);
  const summaryPerPage = 5;

  const normalizePercentages = (n: number) => {
    if (n <= 0) return [] as number[];
    const base = Number((100 / n).toFixed(2));
    const arr = Array(n).fill(base);
    // fix rounding to make sum exactly 100
    const sum = arr.reduce((s, v) => s + v, 0);
    const diff = Math.round((100 - sum) * 100) / 100;
    arr[arr.length - 1] = Math.round((arr[arr.length - 1] + diff) * 100) / 100;
    return arr;
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem("parsedReceipt");
      if (raw) {
        const parsed = JSON.parse(raw) as Receipt;
        setReceipt(parsed);
        // default assignments: assign each item to person 0
        const map: Record<number, number[]> = {};
        parsed.items.forEach((_, idx) => {
          map[idx] = [0];
        });
        setAssignments(map);
        // initialize percentages equal if using percentage mode later
        setPercentages(normalizePercentages(people.length));
      }
    } catch (e) {
      console.warn("failed to load parsedReceipt", e);
    }
  }, []);

  const addPerson = () => {
    setPeople((p) => {
      const next = [...p, `Person ${p.length + 1}`];
      setPercentages(normalizePercentages(next.length));
      return next;
    });
  };

  const removePerson = (index: number) => {
    setPeople((p) => {
      const next = p.filter((_, i) => i !== index);
      setPercentages(normalizePercentages(next.length));
      return next;
    });
    // remove assignments and shift indices
    setAssignments((prev) => {
      const next: Record<number, number[]> = {};
      for (const k of Object.keys(prev)) {
        const idx = Number(k);
        const assigned = prev[idx]
          .filter((i) => i !== index)
          .map((i) => (i > index ? i - 1 : i));
        next[idx] = assigned.length ? assigned : [];
      }
      return next;
    });
  };

  const toggleAssignment = (itemIndex: number, personIndex: number) => {
    setAssignments((prev) => {
      const arr = new Set(prev[itemIndex] || []);
      if (arr.has(personIndex)) arr.delete(personIndex);
      else arr.add(personIndex);
      return { ...prev, [itemIndex]: Array.from(arr) };
    });
  };

  const perPersonSubtotal = useMemo(() => {
    const res: number[] = people.map(() => 0);
    if (!receipt) return res;
    if (splitMode === "percentage") {
      // split subtotal according to percentages (of receipt.subtotal)
      const subtotal = receipt.subtotal || 0;
      percentages.forEach((pct, i) => {
        const val = Math.round((pct / 100) * subtotal * 100) / 100;
        if (i >= 0 && i < res.length) res[i] = val;
      });
      return res;
    }

    // default: byItem mode, split item price among assigned people
    receipt.items.forEach((it, idx) => {
      const assigned =
        assignments[idx] && assignments[idx].length ? assignments[idx] : [];
      if (assigned.length === 0) return; // unassigned -> skip
      const share = it.price / assigned.length;
      assigned.forEach((p) => {
        if (p >= 0 && p < res.length) res[p] += share;
      });
    });
    return res;
  }, [people, receipt, assignments, splitMode, percentages]);

  const totalAssigned = useMemo(() => {
    if (!receipt) return 0;
    return perPersonSubtotal.reduce((s, v) => s + v, 0);
  }, [perPersonSubtotal, receipt]);

  // Calculate per-person discount share
  const perPersonDiscount = useMemo(() => {
    if (!receipt) return people.map(() => 0);
    const discount = receipt.discount || 0;
    if (discount === 0 || people.length === 0) return people.map(() => 0);

    // Discount distributed proportionally based on each person's subtotal share
    const totalSubtotal = perPersonSubtotal.reduce((s, v) => s + v, 0);
    if (totalSubtotal === 0) {
      // If no subtotal, split equally
      const perPerson = Math.round((discount / people.length) * 100) / 100;
      return people.map(() => perPerson);
    }

    return perPersonSubtotal.map((sub) => {
      const share = (sub / totalSubtotal) * discount;
      return Math.round(share * 100) / 100;
    });
  }, [people, receipt, perPersonSubtotal]);

  const perPersonTax = useMemo(() => {
    if (!receipt) return people.map(() => 0);
    const tax = receipt.tax || 0;
    if (tax === 0 || people.length === 0) return people.map(() => 0);
    if (taxSplitMode === "equal") {
      const perPerson = Math.round((tax / people.length) * 100) / 100;
      return people.map(() => perPerson);
    }

    // assigned: whole tax to one person (taxPayer)
    const taxRounded = Math.round(tax * 100) / 100;
    return people.map((_, i) => (i === taxPayer ? taxRounded : 0));
  }, [people, receipt, taxSplitMode, taxPayer]);

  // Ensure taxPayer index is valid when people list changes or taxSplitMode changes
  React.useEffect(() => {
    if (taxPayer >= people.length) {
      setTaxPayer(Math.max(0, people.length - 1));
    }
    if (taxSplitMode === "assigned" && people.length > 0 && taxPayer < 0) {
      setTaxPayer(0);
    }
  }, [people, taxSplitMode, taxPayer]);

  // Keep summary page within bounds when people count changes
  React.useEffect(() => {
    const total = Math.max(1, Math.ceil(people.length / summaryPerPage));
    setSummaryPage((p) => Math.min(p, total));
  }, [people]);

  // Keep people page within bounds when people count changes
  React.useEffect(() => {
    const total = Math.max(1, Math.ceil(people.length / peoplePerPage));
    setPeoplePage((p) => Math.min(p, total));
  }, [people]);

  const perPersonTotal = useMemo(() => {
    return perPersonSubtotal.map(
      (p, i) =>
        Math.round(
          (p - (perPersonDiscount[i] || 0) + (perPersonTax[i] || 0)) * 100
        ) / 100
    );
  }, [perPersonSubtotal, perPersonDiscount, perPersonTax]);

  const handleApplyCalc = async (value: number) => {
    const valRounded = Math.round(value * 100) / 100;
    if (splitMode === "percentage" && activePercentageIndex != null) {
      setPercentages((prev) => {
        const next = [...prev];
        // clamp 0..100
        next[activePercentageIndex!] = Math.max(0, Math.min(100, valRounded));
        return next;
      });
    } else {
      try {
        await navigator.clipboard.writeText(String(valRounded));
        alert(`Copied ${valRounded} to clipboard`);
      } catch (e) {
        console.warn(e);
      }
    }
    setShowCalculator(false);
  };

  const formatCurrency = (amount: number) => {
    // Use explicit symbol mapping and format IDR without decimals and without space
    const code = (receipt?.currency || "IDR").toUpperCase();
    const symMap: Record<string, string> = {
      IDR: "Rp",
      USD: "$",
      CNY: "¥",
      MYR: "RM",
      GBP: "£",
      EUR: "€",
    };
    const sym = symMap[code] || code;

    const isIdr = code === "IDR";
    try {
      const formattedNumber = new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: isIdr ? 0 : 2,
        maximumFractionDigits: isIdr ? 0 : 2,
      }).format(amount);
      return `${sym}${formattedNumber}`;
    } catch (e) {
      const formatted = isIdr ? String(Math.round(amount)) : amount.toFixed(2);
      return `${sym}${formatted}`;
    }
  };

  const handleBack = () => {
    if (typeof window === "undefined") return router.push("/receipt-result");
    try {
      const ref = document.referrer || "";
      const origin = window.location.origin;
      if (ref.startsWith(origin)) {
        const path = ref.substring(origin.length);
        if (path.startsWith("/manual-entry")) {
          router.push("/manual-entry");
          return;
        }
        if (path.startsWith("/upload-receipt")) {
          router.push("/upload-receipt");
          return;
        }
        if (path.startsWith("/receipt-result")) {
          router.push("/receipt-result");
          return;
        }
      }
    } catch (e) {
      console.warn("back ref check failed", e);
    }
    // fallback to browser history
    router.back();
  };

  const unassignedIndices = useMemo(() => {
    if (!receipt) return [] as number[];
    const list: number[] = [];
    receipt.items.forEach((_, idx) => {
      const assigned = assignments[idx];
      if (!assigned || assigned.length === 0) list.push(idx);
    });
    return list;
  }, [receipt, assignments]);

  if (!receipt)
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
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
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-slate-300 hover:text-white px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 transition"
            >
              ← Kembali
            </button>
          </nav>
        </header>
        <div className="max-w-4xl mx-auto px-6 py-8">
          <h2 className="text-2xl font-bold text-slate-100 mb-8">
            Split by Item
          </h2>
          <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-6 text-center">
            <p className="text-red-300 mb-4">
              Tidak ada data struk. Kembali ke halaman hasil.
            </p>

            <Link
              href="/receipt-result"
              className="px-5 py-3 bg-slate-700 rounded-lg text-white font-medium hover:bg-slate-600 transition"
            >
              Kembali ke Hasil
            </Link>
          </div>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-3 cursor-pointer bg-transparent border-0 p-0"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-semibold">
              SB
            </div>
            <div className="text-sm font-medium">SplitBill</div>
          </button>
        </div>
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-slate-300 hover:text-white px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 transition"
        >
          ← Kembali
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Split by Item</h1>

        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-6">
          <div className="flex flex-row justify-between mb-6">
            <h3 className="font-semibold text-slate-100">Daftar Orang</h3>
            <button
              onClick={addPerson}
              className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-sm font-medium text-white transition h-fit w-fit"
            >
              + Tambah
            </button>
          </div>
          <div className="flex flex-wrap justify-center sm:justify-start gap-2 sm:gap-2">
            {(() => {
              const totalPages = Math.max(
                1,
                Math.ceil(people.length / peoplePerPage)
              );
              const startIndex = (peoplePage - 1) * peoplePerPage;
              const endIndex = startIndex + peoplePerPage;
              const paginated = people.slice(startIndex, endIndex);

              return (
                <>
                  {paginated.map((name, i) => {
                    const idx = startIndex + i;
                    return (
                      <div
                        key={idx}
                        className="flex flex-row sm:flex-row w-full sm:w-fit items-start gap-2 bg-slate-700 px-3 py-2 rounded-lg"
                      >
                        <input
                          className="bg-transparent w-full sm:w-28 text-sm px-1 border-b border-slate-500 focus:border-indigo-400 outline-none"
                          value={name}
                          onChange={(e) =>
                            setPeople((p) =>
                              p.map((x, ii) =>
                                ii === idx ? e.target.value : x
                              )
                            )
                          }
                        />
                        {splitMode === "percentage" ? (
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={percentages[idx] ?? 0}
                            onChange={(e) => {
                              const v = Number(e.target.value) || 0;
                              setPercentages((prev) => {
                                const next = [...prev];
                                next[idx] = v;
                                return next;
                              });
                            }}
                            onFocus={() => setActivePercentageIndex(idx)}
                            onBlur={() =>
                              setActivePercentageIndex((cur) =>
                                cur === idx ? null : cur
                              )
                            }
                            className="w-14 bg-slate-800 border border-slate-600 rounded text-sm text-white text-right"
                            title="Percent share"
                          />
                        ) : null}
                        {people.length > 1 && (
                          <button
                            onClick={() => removePerson(idx)}
                            className="self-end sm:self-center sm:relative text-xs text-red-400 hover:text-red-300"
                          >
                            X
                          </button>
                        )}
                        <input
                          className="hidden bg-transparent w-28 text-sm px-1 border-b border-slate-500 focus:border-indigo-400 outline-none"
                          value={name}
                          onChange={(e) =>
                            setPeople((p) =>
                              p.map((x, ii) =>
                                ii === idx ? e.target.value : x
                              )
                            )
                          }
                        />
                      </div>
                    );
                  })}

                  {people.length > peoplePerPage && (
                    <div className="flex items-center gap-2 justify-center w-full pt-2 mt-8">
                      <button
                        onClick={() => setPeoplePage((p) => Math.max(1, p - 1))}
                        disabled={peoplePage === 1}
                        className="px-2 py-1 rounded-lg bg-slate-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600 transition"
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
                            onClick={() => setPeoplePage(page)}
                            className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                              peoplePage === page
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
                          setPeoplePage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={peoplePage === totalPages}
                        className="px-2 py-1 rounded-lg bg-slate-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600 transition"
                      >
                        →
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* If percentage mode, show sum and validation */}
        {splitMode === "percentage" && (
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-sm text-slate-300 mt-2">
              Total persen:{" "}
              {percentages.reduce((s, v) => s + (v || 0), 0).toFixed(2)}%
              {Math.abs(percentages.reduce((s, v) => s + (v || 0), 0) - 100) >
              0.001 ? (
                <span className="text-yellow-300 ml-3">
                  (Jumlah harus 100%)
                </span>
              ) : (
                <span className="text-emerald-300 ml-3">(OK)</span>
              )}
            </div>
          </div>
        )}

        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-800 border-b border-slate-700">
            <div className="text-sm text-slate-300">
              Assign items to people (multiple allowed for shared items)
            </div>
          </div>
          <div className="hidden md:block">
            <table className="w-full text-sm table-fixed">
              <thead className="bg-slate-800/50">
                <tr className="text-slate-400">
                  <th className="text-left px-4 py-3 font-medium w-[40%]">
                    Nama
                  </th>
                  <th className="text-center px-4 py-3 font-medium w-[10%]">
                    Jumlah
                  </th>
                  <th className="text-right px-4 py-3 font-medium w-[20%]">
                    Harga
                  </th>
                  {splitMode === "byItem" && (
                    <th className="text-left px-4 py-3 font-medium w-[30%]">
                      Assign
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {receipt.items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-700/30 transition">
                    <td className="px-4 py-3 align-middle font-medium">
                      <div className="truncate" title={it.name}>
                        {it.name}
                      </div>
                      <button
                        onClick={() => {
                          setModalText(it.name || "");
                          setModalOpen(true);
                        }}
                        className="text-xs text-slate-400 mt-2 inline-flex items-center gap-1.5 hover:text-indigo-400 transition"
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
                    <td className="px-4 py-3 align-middle text-center text-slate-300">
                      {it.quantity}
                    </td>
                    <td className="px-4 py-3 align-middle text-right text-slate-300">
                      {formatCurrency(it.price)}
                    </td>
                    {splitMode === "byItem" && (
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-wrap gap-1">
                          {people.map((p, i) => (
                            <label
                              key={i}
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition text-xs ${
                                (assignments[idx] || []).includes(i)
                                  ? "bg-indigo-600 text-white"
                                  : "bg-slate-600 text-slate-300 hover:bg-slate-500"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={(assignments[idx] || []).includes(i)}
                                onChange={() => toggleAssignment(idx, i)}
                                className="sr-only"
                              />
                              <span>{p}</span>
                            </label>
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List with Pagination */}
          <div className="md:hidden px-4 py-4 space-y-3">
            {(() => {
              const totalPages = Math.ceil(receipt.items.length / itemsPerPage);
              const startIndex = (currentPage - 1) * itemsPerPage;
              const endIndex = startIndex + itemsPerPage;
              const paginatedItems = receipt.items.slice(startIndex, endIndex);

              return (
                <>
                  {paginatedItems.map((it, i) => {
                    const idx = startIndex + i;
                    return (
                      <div
                        key={idx}
                        className="bg-slate-800/80 rounded-xl p-4 shadow-lg border border-slate-700/50 hover:border-indigo-500/30 transition-all"
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded">
                                #{idx + 1}
                              </span>
                              <span className="text-xs text-slate-400 bg-slate-700/30 px-2 py-0.5 rounded">
                                Jmlh: {it.quantity}
                              </span>
                            </div>
                            <h3
                              className="font-semibold text-white line-clamp-2 mt-4"
                              title={it.name}
                            >
                              {it.name}
                            </h3>
                            <button
                              onClick={() => {
                                setModalText(it.name || "");
                                setModalOpen(true);
                              }}
                              className="text-xs text-slate-400 hover:text-indigo-400 mt-2 inline-flex items-center gap-1.5 transition"
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
                              Lihat Detail
                            </button>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-lg font-bold text-indigo-400">
                              {formatCurrency(it.price)}
                            </div>
                          </div>
                        </div>

                        {/* Card Body - Assignment (hidden in Percentage mode) */}
                        {splitMode === "byItem" && (
                          <div className="mt-1 pt-3 border-t border-slate-700/50">
                            <div className="text-xs text-slate-400 mb-2">
                              Assign ke:
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {people.map((p, personIdx) => (
                                <label
                                  key={personIdx}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition text-xs font-medium ${
                                    (assignments[idx] || []).includes(personIdx)
                                      ? "bg-indigo-600 text-white shadow-md"
                                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={(assignments[idx] || []).includes(
                                      personIdx
                                    )}
                                    onChange={() =>
                                      toggleAssignment(idx, personIdx)
                                    }
                                    className="sr-only"
                                  />
                                  <span>{p}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
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

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 sm:justify-between">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="text-sm text-slate-300">Mode Split:</div>
            <div className="w-full sm:w-auto">
              <select
                value={splitMode}
                onChange={(e) => setSplitMode(e.target.value as any)}
                className="min-w-0 w-full sm:w-auto bg-slate-700 text-slate-100 px-2 py-1 rounded"
              >
                <option value="byItem">By Item (Tetapkan per item)</option>
                <option value="percentage">
                  By Percentage (Dibagi dari 100%)
                </option>
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <div className="text-sm text-slate-300">Tax Split:</div>
              <select
                value={taxSplitMode}
                onChange={(e) => setTaxSplitMode(e.target.value as any)}
                className="min-w-0 w-26 sm:w-auto bg-slate-700 text-slate-100 px-2 py-1 rounded"
              >
                <option value="equal">Equal</option>
                <option value="assigned">Assign to Person</option>
              </select>
              {taxSplitMode === "assigned" && (
                <select
                  value={taxPayer}
                  onChange={(e) => setTaxPayer(Number(e.target.value))}
                  className="min-w-0 w-40 sm:w-auto bg-slate-700 text-slate-100 px-2 py-1 rounded"
                >
                  {people.map((p, i) => (
                    <option key={i} value={i}>
                      {p}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="w-fit sm:w-auto mt-4 sm:mt-0">
              <button
                onClick={() => setShowCalculator(true)}
                className="w-fit sm:w-auto mt-0 sm:ml-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm whitespace-nowrap"
              >
                Calculator
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
          <h3 className="font-semibold text-lg mb-4">Ringkasan Per Orang</h3>
          {(() => {
            const totalPages = Math.ceil(people.length / summaryPerPage) || 1;
            const startIndex = (summaryPage - 1) * summaryPerPage;
            const endIndex = startIndex + summaryPerPage;
            const paginated = people.slice(startIndex, endIndex);

            return (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginated.map((p, idx) => {
                    const i = startIndex + idx;
                    return (
                      <div
                        key={i}
                        className="bg-slate-700/50 rounded-lg p-4 border border-slate-600"
                      >
                        <div className="text-sm text-slate-300 font-medium">
                          {p}
                        </div>
                        <div className="text-xl font-bold mt-2 text-indigo-400">
                          {formatCurrency(perPersonTotal[i] || 0)}
                        </div>
                        <div className="text-xs text-slate-400 mt-2 space-y-1">
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span>
                              {formatCurrency(perPersonSubtotal[i] || 0)}
                            </span>
                          </div>
                          {(perPersonDiscount[i] || 0) > 0 && (
                            <div className="flex justify-between text-red-400">
                              <span>Diskon:</span>
                              <span>
                                -{formatCurrency(perPersonDiscount[i] || 0)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span>Tax share:</span>
                            <span>{formatCurrency(perPersonTax[i] || 0)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Controls for summary */}
                {people.length > summaryPerPage && (
                  <div className="flex flex-col items-center gap-3 pt-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() =>
                          setSummaryPage((p) => Math.max(1, p - 1))
                        }
                        disabled={summaryPage === 1}
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
                            onClick={() => setSummaryPage(page)}
                            className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                              summaryPage === page
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
                          setSummaryPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={summaryPage === totalPages}
                        className="px-3 py-1 rounded-lg bg-slate-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600 transition"
                      >
                        →
                      </button>
                    </div>

                    <div className="text-center text-xs text-slate-500">
                      Menampilkan {startIndex + 1}-
                      {Math.min(endIndex, people.length)} dari {people.length}{" "}
                      orang
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          <div className="mt-6 space-y-4">
            {splitMode === "byItem" && unassignedIndices.length > 0 && (
              <div className="bg-yellow-600/20 text-yellow-300 border border-yellow-500/30 rounded-lg p-4 text-sm">
                <div className="font-medium">
                  ⚠️ Beberapa item belum di-assign:
                </div>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  {unassignedIndices.map((i) => (
                    <li key={i}>{receipt.items[i].name || `Item ${i + 1}`}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-row gap-3">
              <button
                onClick={() => {
                  if (splitMode === "byItem" && unassignedIndices.length > 0) {
                    alert("Semua item harus di-assign sebelum finalisasi.");
                    return;
                  }
                  if (splitMode === "percentage") {
                    const sum = percentages.reduce((s, v) => s + (v || 0), 0);
                    if (Math.abs(sum - 100) > 0.001) {
                      alert("Total persen harus 100% sebelum finalisasi.");
                      return;
                    }
                  }
                  try {
                    const out = {
                      people,
                      perPersonSubtotal,
                      perPersonDiscount,
                      perPersonTax,
                      perPersonTotal,
                      // include assignments and items so share page can present item->person mapping
                      assignments,
                      items: receipt?.items ?? [],
                      discount: receipt?.discount ?? 0,
                    };
                    localStorage.setItem("lastSplit", JSON.stringify(out));
                    setFinalized(true);
                    alert("Split finalized and saved!");
                    // navigate to share page
                    try {
                      router.push("/share-split-bill");
                    } catch (e) {
                      // fallback: set location if router push fails
                      try {
                        (window.location as any).href = "/share-split-bill";
                      } catch (err) {
                        console.warn("redirect to share page failed", err);
                      }
                    }
                  } catch (e) {
                    console.warn(e);
                  }
                }}
                disabled={
                  (splitMode === "byItem" && unassignedIndices.length > 0) ||
                  (splitMode === "percentage" &&
                    Math.abs(
                      percentages.reduce((s, v) => s + (v || 0), 0) - 100
                    ) > 0.001)
                }
                className={`px-6 py-2 rounded-lg text-white font-medium transition ${
                  (splitMode === "byItem" && unassignedIndices.length > 0) ||
                  (splitMode === "percentage" &&
                    Math.abs(
                      percentages.reduce((s, v) => s + (v || 0), 0) - 100
                    ) > 0.001)
                    ? "bg-slate-600 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                ✓ Selesaikan Split
              </button>

              <button
                onClick={() => {
                  const map: Record<number, number[]> = {};
                  receipt.items.forEach((_, idx) => (map[idx] = [0]));
                  setAssignments(map);
                  setFinalized(false);
                }}
                className="px-6 py-2 text-xs border border-slate-600 rounded-lg text-slate-100 hover:bg-slate-700 transition"
              >
                ↻ Reset
              </button>
            </div>
          </div>
        </div>
      </main>
      <CalculatorOverlay
        open={showCalculator}
        onClose={() => setShowCalculator(false)}
        onApply={handleApplyCalc}
      />
      <TruncatedTextModal
        open={modalOpen}
        text={modalText}
        title="Nama Item Lengkap"
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
