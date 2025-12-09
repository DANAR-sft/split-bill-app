"use client";

import React, { useState } from "react";

export default function CalculatorOverlay({
  open,
  onClose,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  onApply?: (value: number) => void;
}) {
  const [expr, setExpr] = useState<string>("");
  const [result, setResult] = useState<number | null>(null);

  if (!open) return null;

  const append = (s: string) => setExpr((e) => e + s);

  const clearAll = () => {
    setExpr("");
    setResult(null);
  };

  const backspace = () => setExpr((e) => e.slice(0, -1));

  const evaluate = () => {
    try {
      // simple eval in client only
      // eslint-disable-next-line no-new-func
      const val = Function(`"use strict";return (${expr})`)();
      const num = Number(val || 0);
      if (Number.isFinite(num)) {
        const rounded = Math.round(num * 100) / 100;
        setResult(rounded);
        setExpr(String(rounded));
        return rounded;
      }
    } catch (e) {
      // ignore
    }
    setResult(null);
    return null;
  };

  const doCopy = async () => {
    const txt = result != null ? String(result) : expr;
    try {
      await navigator.clipboard.writeText(txt);
      // no toast system; simple alert
      alert(`Copied: ${txt}`);
    } catch (e) {
      console.warn(e);
      alert(`Could not copy`);
    }
  };

  const handleApply = () => {
    const val = result != null ? result : evaluate();
    if (val != null && onApply) onApply(val as number);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => onClose()} />

      <div className="relative w-[380px] bg-slate-800 text-slate-100 rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">Calculator</div>
          <button
            onClick={() => onClose()}
            className="text-slate-300 hover:text-white"
            aria-label="Close calculator"
          >
            ✕
          </button>
        </div>

        <div className="bg-slate-900 text-right p-3 rounded mb-3 text-2xl font-mono">
          <div className="text-sm text-slate-400 break-words">
            {expr || "0"}
          </div>
          <div className="mt-1">{result != null ? result : ""}</div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            "7",
            "8",
            "9",
            "/",
            "4",
            "5",
            "6",
            "*",
            "1",
            "2",
            "3",
            "-",
            ".",
            "0",
            "+",
            "=",
          ].map((b) => (
            <button
              key={b}
              onClick={() => {
                if (b === "=") {
                  evaluate();
                } else {
                  append(b);
                }
              }}
              className="py-2 rounded bg-slate-700 hover:bg-slate-600"
            >
              {b}
            </button>
          ))}

          <button
            onClick={clearAll}
            className="col-span-2 py-2 rounded bg-yellow-600 hover:bg-yellow-500"
          >
            C
          </button>
          <button
            onClick={backspace}
            className="py-2 rounded bg-slate-700 hover:bg-slate-600"
          >
            ⌫
          </button>
          <button
            onClick={doCopy}
            className="py-2 rounded bg-indigo-600 hover:bg-indigo-500"
          >
            Copy
          </button>

          <button
            onClick={handleApply}
            className="col-span-2 py-2 rounded bg-emerald-600 hover:bg-emerald-500"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
