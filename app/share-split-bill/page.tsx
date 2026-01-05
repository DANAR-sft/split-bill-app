"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Logo from "@/app/components/Logo/Logo";
import { useRouter } from "next/navigation";
import TruncatedTextModal from "../components/TruncatedTextModal/TruncatedTextModal";

type LastSplit = {
  people: string[];
  perPersonSubtotal: number[];
  perPersonDiscount?: number[];
  perPersonTax: number[];
  perPersonTotal: number[];
  assignments?: Record<number, number[]>;
  items?: any[];
  discount?: number;
};

export default function ShareSplitPage() {
  const [data, setData] = useState<LastSplit | null>(null);
  const [currency, setCurrency] = useState<string>("IDR");
  const [receipt, setReceipt] = useState<any | null>(null);
  // preview and share options
  const [previewText, setPreviewText] = useState<string>("");
  const [separator, setSeparator] = useState<"newline" | "pipe">("newline");
  const [compact, setCompact] = useState<boolean>(false);
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalText, setModalText] = useState("");
  // Pagination for per-person summary
  const [summaryPage, setSummaryPage] = useState(1);
  const summaryPerPage = 2;
  // Preview textarea expand/collapse state
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  // (share menu removed) share buttons will be individual icon links
  // Preview textarea auto-resize ref
  const previewRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustPreviewHeight = () => {
    const el = previewRef.current;
    if (!el || !isPreviewExpanded) return;
    el.style.height = "auto";
    // add 2px buffer to avoid clipping
    el.style.height = `${el.scrollHeight + 2}px`;
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem("lastSplit");
      if (raw) {
        const parsed = JSON.parse(raw) as LastSplit;
        setData(parsed);
      }
      // try to read currency and items from parsedReceipt if present
      const parsedReceipt = localStorage.getItem("parsedReceipt");
      if (parsedReceipt) {
        try {
          const pr = JSON.parse(parsedReceipt) as any;
          if (pr?.currency) setCurrency(pr.currency);
          setReceipt(pr);
        } catch (_) {}
      }
    } catch (e) {
      console.warn("failed to load lastSplit", e);
    }
  }, []);

  const getItems = (d: LastSplit | null) => {
    if (d && d.items && Array.isArray(d.items)) return d.items;
    return receipt?.items ?? [];
  };

  useEffect(() => {
    // regenerate preview when data/receipt/options change
    const text = buildShareText ? buildShareText(separator, compact) : "";
    setPreviewText(text);
  }, [data, receipt, separator, compact]);

  // adjust textarea height whenever previewText updates or expanded state changes
  useEffect(() => {
    adjustPreviewHeight();
  }, [previewText, isPreviewExpanded]);

  // Clamp summary page when people count changes
  useEffect(() => {
    const total = Math.max(
      1,
      Math.ceil((data?.people?.length || 0) / summaryPerPage)
    );
    setSummaryPage((p) => Math.min(p, total));
  }, [data]);

  const formatCurrency = (amount: number) => {
    // Use explicit symbol mapping and separate number formatting so we don't get
    // localized prefixes like "US$". This matches behavior in manual-entry and
    // split-by-item pages.
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
      }).format(amount);
      return `${sym}${formattedNumber}`;
    } catch (e) {
      const formatted =
        code === "IDR" ? String(Math.round(amount)) : amount.toFixed(2);
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

  const buildShareText = (
    sep: "newline" | "pipe" = "newline",
    compactMode = false
  ) => {
    if (!data) return "";
    const items = getItems(data);
    const lines: string[] = [];
    const nl = sep === "newline" ? "\n" : " | ";

    if (compactMode) {
      // compact one-line per person
      data.people.forEach((p, i) => {
        const total = formatCurrency(data.perPersonTotal[i] || 0);
        lines.push(`${p}: ${total}`);
      });
      if (items && items.length) {
        const itemLines = items.map(
          (it: any) =>
            `${it.name ?? "(item)"}x${it.quantity ?? 1}:${formatCurrency(
              it.price ?? 0
            )}`
        );
        lines.push("Items: " + itemLines.join(", "));
      }
      return lines.join(nl);
    }

    lines.push("Ringkasan Split Bill:");
    lines.push("");
    data.people.forEach((p, i) => {
      lines.push(`${p}: ${formatCurrency(data.perPersonTotal[i] || 0)}`);
      lines.push(
        `  Subtotal: ${formatCurrency(data.perPersonSubtotal[i] || 0)}`
      );
      if (data.perPersonDiscount && (data.perPersonDiscount[i] || 0) > 0) {
        lines.push(
          `  Diskon: -${formatCurrency(data.perPersonDiscount[i] || 0)}`
        );
      }
      lines.push(`  Tax: ${formatCurrency(data.perPersonTax[i] || 0)}`);
      // include assigned items if available
      if (data.assignments && items && items.length) {
        const assignedNames: string[] = [];
        items.forEach((it: any, idx: number) => {
          const assigned = data.assignments?.[idx] ?? [];
          if (assigned.includes(i))
            assignedNames.push(it.name ?? `(Item ${idx + 1})`);
        });
        if (assignedNames.length) {
          lines.push(`  Items: ${assignedNames.join(", ")}`);
        }
      }
    });

    if (items && items.length) {
      lines.push("");
      lines.push("Ringkasan:");
      items.forEach((it: any) => {
        const q = it.quantity ?? 1;
        const name = it.name ?? "(item)";
        const price = it.price ?? 0;
        lines.push(`- ${name} x${q} — ${formatCurrency(price)}`);
      });
    }

    return lines.join("\n");
  };

  const copySummary = async () => {
    if (!data) return;
    const text = previewText || buildShareText(separator, compact);
    try {
      await navigator.clipboard.writeText(text);
      alert("Ringkasan tersalin ke clipboard");
    } catch (e) {
      console.warn(e);
      alert("Gagal menyalin ringkasan");
    }
  };

  // Share text for a single person
  const sharePerson = async (index: number) => {
    if (!data) return;
    const name = data.people[index] ?? `Person ${index + 1}`;
    const lines: string[] = [];
    lines.push(`${name}: ${formatCurrency(data.perPersonTotal[index] || 0)}`);
    lines.push(
      `Subtotal: ${formatCurrency(data.perPersonSubtotal[index] || 0)}`
    );
    lines.push(`Tax: ${formatCurrency(data.perPersonTax[index] || 0)}`);

    // include assigned items if available
    if (data.assignments && (data.items ?? receipt?.items)?.length) {
      const itemsList = (data.items ?? receipt?.items) || [];
      const assignedNames: string[] = [];
      itemsList.forEach((it: any, idx: number) => {
        const assigned = data.assignments?.[idx] ?? [];
        if (assigned.includes(index))
          assignedNames.push(it.name ?? `(Item ${idx + 1})`);
      });
      if (assignedNames.length) {
        lines.push("Items:");
        assignedNames.forEach((n) => lines.push(`- ${n}`));
      }
    }

    const text = lines.join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: `Share ${name}`, text });
      } else {
        await navigator.clipboard.writeText(text);
        alert("Teks per-person disalin ke clipboard");
      }
    } catch (e) {
      console.warn("sharePerson failed", e);
      try {
        await navigator.clipboard.writeText(text);
        alert("Teks per-person disalin ke clipboard");
      } catch (_) {}
    }
  };

  // regeneratePreview: build share text from current options and set as preview
  const regeneratePreview = () => {
    try {
      const text = buildShareText(separator, compact);
      // eslint-disable-next-line no-console
      console.debug("Regenerate preview ->", { separator, compact, text });
      setPreviewText(text);
    } catch (e) {
      console.warn("regeneratePreview failed", e);
    }
  };

  const createWhatsAppHref = (text: string) => {
    try {
      const params = new URLSearchParams();
      const pageUrl = typeof window !== "undefined" ? window.location.href : "";
      if (pageUrl) params.set("url", pageUrl);
      params.set("text", text);
      return `https://wa.me/?text=${params.toString()}`;
    } catch (e) {
      return `https://wa.me/?text=${encodeURIComponent(text)}`;
    }
  };

  const createTelegramHref = (text: string) => {
    try {
      const params = new URLSearchParams();
      const pageUrl = typeof window !== "undefined" ? window.location.href : "";
      if (pageUrl) params.set("url", pageUrl);
      params.set("text", text);
      return `https://t.me/share/url?${params.toString()}`;
    } catch (e) {
      return `https://t.me/share/url?text=${encodeURIComponent(text)}`;
    }
  };

  const shareData = async () => {
    if (!data) return;
    const text = previewText || buildShareText(separator, compact);
    if (navigator.share) {
      try {
        await navigator.share({ title: "Split Bill", text });
      } catch (e) {
        console.warn("share failed", e);
        copySummary();
      }
    } else {
      // fallback to copying summary
      copySummary();
    }
  };

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
            href="/split-by-item"
            className="inline-flex items-center gap-2 text-slate-300 hover:text-white px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 transition"
          >
            ← Kembali
          </Link>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-100 mb-6">Share Split</h1>

        {!data ? (
          <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-6 text-center">
            <p className="text-slate-300 leading-relaxed">
              Tidak ada data split. Kembali ke halaman split untuk membuat
              split.
            </p>
            <div className="mt-4 flex gap-3 items-center justify-center">
              <Link
                href="/split-by-item"
                className="px-5 py-3 bg-indigo-600 rounded-lg text-white font-medium hover:bg-indigo-500 transition"
              >
                Ke Split
              </Link>
              <Link
                href="/receipt-result"
                className="px-5 py-3 bg-slate-700 rounded-lg text-white font-medium hover:bg-slate-600 transition"
              >
                Ke Hasil Struk
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={copySummary}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-medium transition"
              >
                Copy Ringkasan
              </button>
              <button
                onClick={shareData}
                className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-lg text-white font-medium transition"
              >
                Share
              </button>
              {/* Icon buttons for WhatsApp and Telegram (preserve functionality) */}
              <a
                href={createWhatsAppHref(
                  previewText || buildShareText(separator, compact)
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white transition"
                aria-label="Share via WhatsApp"
              >
                <img
                  src="/logo-wa-hitam.png"
                  alt="WhatsApp"
                  className="w-10 h-10 object-contain"
                />
              </a>

              <a
                href={createTelegramHref(
                  previewText || buildShareText(separator, compact)
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-400 text-white transition"
                aria-label="Share via Telegram"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="w-5 h-5"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M21.5 3.5L2.5 10.3c-.9.3-.9 1.6.1 1.9l4.4 1.4 1.8 5.4c.3.9 1.6.9 1.9.1l2.7-4.9 4.2 3.1c.8.6 1.9.1 2.1-.8l1.9-12.4c.2-1.1-1-1.9-1.9-1.6zM7.6 12.8l-.9-2.6 11.1-4.3-7.2 6.9-2.9-.0z" />
                </svg>
              </a>
            </div>

            <div className="flex items-center gap-4 mt-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-300">
                  Separator:
                </label>
                <select
                  value={separator}
                  onChange={(e) => setSeparator(e.target.value as any)}
                  className="bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="newline">New line</option>
                  <option value="pipe">Compact</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <input
                  type="checkbox"
                  checked={compact}
                  onChange={(e) => setCompact(e.target.checked)}
                  className="rounded"
                />
                Compact message
              </label>

              <button
                type="button"
                onClick={regeneratePreview}
                aria-label="Regenerate preview text"
                title="Regenerate preview"
                className="hidden sm:inline-flex px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-medium items-center justify-center cursor-pointer transition"
              >
                Regenerate Preview
              </button>
            </div>
            <button
              type="button"
              onClick={regeneratePreview}
              aria-label="Regenerate preview text"
              title="Regenerate preview"
              className="inline-flex w-fit sm:hidden px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-medium items-center justify-center cursor-pointer transition mt-3"
            >
              Regenerate Preview
            </button>

            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">
                  Preview / Edit message:
                </label>
                <button
                  type="button"
                  onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition"
                  title={isPreviewExpanded ? "Collapse" : "Expand"}
                  aria-label={
                    isPreviewExpanded ? "Collapse preview" : "Expand preview"
                  }
                >
                  {isPreviewExpanded ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-5 h-5"
                    >
                      <polyline points="4 14 10 14 10 20" />
                      <polyline points="20 10 14 10 14 4" />
                      <line x1="14" y1="10" x2="21" y2="3" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-5 h-5"
                    >
                      <polyline points="15 3 21 3 21 9" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  )}
                </button>
              </div>
              <textarea
                ref={previewRef}
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                rows={isPreviewExpanded ? undefined : 6}
                className={`w-full mt-0 bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isPreviewExpanded
                    ? "resize-none h-auto overflow-hidden"
                    : "resize-y overflow-auto"
                }`}
                style={
                  isPreviewExpanded && previewRef.current
                    ? { height: `${previewRef.current.scrollHeight + 2}px` }
                    : undefined
                }
              />
            </div>

            {(() => {
              const peopleList = data?.people ?? [];
              const totalPages =
                Math.ceil(peopleList.length / summaryPerPage) || 1;
              const startIndex = (summaryPage - 1) * summaryPerPage;
              const endIndex = startIndex + summaryPerPage;
              const paginated = peopleList.slice(startIndex, endIndex);

              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                    {paginated.map((p, idx) => {
                      const i = startIndex + idx;
                      return (
                        <div
                          key={i}
                          className="relative bg-slate-800/60 rounded-xl p-5 border border-slate-700/50"
                        >
                          <button
                            onClick={() => sharePerson(i)}
                            title={`Share ${p}`}
                            aria-label={`Share ${p}`}
                            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white transition"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              aria-hidden
                            >
                              <path
                                d="M7 17L17 7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M7 7h10v10"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                          <div className="text-sm font-medium text-slate-300">
                            {p}
                          </div>
                          <div className="text-xl font-bold mt-2 text-indigo-400">
                            {formatCurrency(data?.perPersonTotal[i] || 0)}
                          </div>
                          <div className="text-sm text-slate-400 mt-3 space-y-2">
                            <div className="flex justify-between">
                              <span>Subtotal:</span>
                              <span className="text-slate-300">
                                {formatCurrency(
                                  data?.perPersonSubtotal[i] || 0
                                )}
                              </span>
                            </div>
                            {data?.perPersonDiscount &&
                              (data?.perPersonDiscount[i] || 0) > 0 && (
                                <div className="flex justify-between text-red-400">
                                  <span>Diskon:</span>
                                  <span>
                                    -
                                    {formatCurrency(
                                      data?.perPersonDiscount[i] || 0
                                    )}
                                  </span>
                                </div>
                              )}
                            <div className="flex justify-between">
                              <span>Pajak:</span>
                              <span className="text-slate-300">
                                {formatCurrency(data?.perPersonTax[i] || 0)}
                              </span>
                            </div>
                            {data?.assignments &&
                              (data.items ?? receipt?.items)?.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-700/50">
                                  <div className="text-slate-300 text-sm font-medium">
                                    Item yang ditanggung:
                                  </div>
                                  <ul className="list-disc pl-5 text-sm text-slate-400 mt-2 space-y-1">
                                    {(() => {
                                      const itemsList =
                                        (data.items ?? receipt?.items) || [];
                                      const assigned: any[] = [];
                                      itemsList.forEach(
                                        (it: any, idx2: number) => {
                                          const assignedArr =
                                            data.assignments?.[idx2] ?? [];
                                          if (assignedArr.includes(i))
                                            assigned.push(
                                              it.name ?? `(Item ${idx2 + 1})`
                                            );
                                        }
                                      );
                                      return assigned.length ? (
                                        assigned.map((n, ii) => (
                                          <li key={ii}>
                                            <div className="flex items-center justify-between">
                                              <div
                                                className="line-clamp-2 max-w-[14rem]"
                                                title={n}
                                              >
                                                {n}
                                              </div>
                                              <button
                                                onClick={() => {
                                                  setModalText(n);
                                                  setModalOpen(true);
                                                }}
                                                className="text-xs text-slate-400 ml-2 inline-flex items-center gap-1.5 hover:text-indigo-400 transition"
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
                                            </div>
                                          </li>
                                        ))
                                      ) : (
                                        <li className="text-slate-500">
                                          (none)
                                        </li>
                                      );
                                    })()}
                                  </ul>
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination controls when > summaryPerPage */}
                  {peopleList.length > summaryPerPage && (
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
                        {Math.min(endIndex, peopleList.length)} dari{" "}
                        {peopleList.length} orang
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {receipt?.items && receipt.items.length > 0 && (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                <h3 className="font-semibold mb-3">Ringkasan</h3>
                <div>
                  <table className="w-full text-sm table-fixed">
                    <thead className="text-slate-400 border-b border-slate-700">
                      <tr>
                        <th className="text-left px-3 py-2 w-[45%]">Nama</th>
                        <th className="text-center px-3 py-2 w-[20%]">
                          Jumlah
                        </th>
                        <th className="text-right px-3 py-2 w-[35%]">Harga</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {receipt.items.map((it: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-700/20">
                          <td className="px-3 py-2">
                            <div
                              className="truncate"
                              title={it.name || `(Item ${idx + 1})`}
                            >
                              {it.name || `(Item ${idx + 1})`}
                            </div>
                            <button
                              onClick={() => {
                                setModalText(it.name || `(Item ${idx + 1})`);
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
                          <td className="px-3 py-2 text-center">
                            {it.quantity ?? 1}
                          </td>
                          <td className="px-3 py-2 text-right w-35">
                            {formatCurrency(it.price ?? 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
