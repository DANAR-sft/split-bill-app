"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";

export default function Home() {
  // Card tilt micro-interaction
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({});

  // Card tilt handlers
  function handleCardMove(e: React.MouseEvent) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left; // x position within element
    const y = e.clientY - rect.top; // y position within element
    const px = (x / rect.width) * 2 - 1; // -1 .. 1
    const py = (y / rect.height) * 2 - 1; // -1 .. 1

    const rotateY = px * 8; // max 8deg
    const rotateX = -py * 6; // max 6deg
    const translateY = -py * 6; // subtle translate

    setCardStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(${translateY}px) scale(1.01)`,
      transition: "transform 120ms linear",
    });
  }

  function handleCardLeave() {
    setCardStyle({
      transform:
        "perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px) scale(1)",
      transition: "transform 420ms cubic-bezier(.2,.9,.2,1)",
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black text-slate-100">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white font-semibold shadow-md">
            SB
          </div>
          <div className="text-sm font-medium tracking-wide">SplitBill</div>
        </div>

        <nav className="flex items-center gap-4">
          <Link
            href="/upload-receipt"
            className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg shadow-sm transform transition hover:-translate-y-0.5 hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
          >
            <span className="hidden sm:inline">Get Started</span>
            <span className="sm:hidden">Start</span>
            <ChevronRight size={16} />
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 py-12 flex flex-col-reverse md:flex-row items-center gap-10">
        {/* Content */}
        <section className="flex-1">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-4">
            Minimal. Cepat. Rapi.
          </h1>

          <p className="text-slate-600 dark:text-slate-300 max-w-lg mb-6">
            Scan struk, deteksi item otomatis, lalu bagi tagihan dengan mudah.
            Desain yang bersih dan micro-interaction membuat pengalaman terasa
            responsif dan menyenangkan.
          </p>

          <div className="flex items-center gap-4">
            <Link
              href="/upload-receipt"
              className="relative inline-flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-pink-500 text-white px-5 py-3 rounded-lg shadow-lg hover:bg-gradient-to-r hover:from-indigo-500 hover:to-pink-400 hover:text-white overflow-hidden"
            >
              <span className="z-10">Ambil Foto Struk</span>
              <ChevronRight size={18} className="z-10" />
              <span className="absolute left-[-30%] top-0 h-full w-36 bg-white/12 blur-xl animate-shimmer" />
            </Link>
          </div>

          {/* Feature chips */}
          <div className="mt-8 flex flex-wrap gap-3">
            {[
              { t: "✅ Auto-detect", d: 0 },
              { t: "✅ Minimal", d: 80 },
              { t: "✅ Cepat", d: 160 },
              { t: "✅ Rapi", d: 240 },
            ].map((chip, i) => (
              <div
                key={i}
                className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-100 dark:border-slate-800 rounded-full px-3 py-2 text-sm shadow-sm transform transition hover:scale-105"
                style={{
                  animation: `chip-enter 420ms cubic-bezier(.2,.9,.2,1) both`,
                  animationDelay: `${chip.d}ms`,
                }}
                role="status"
                aria-label={chip.t}
              >
                {chip.t}
              </div>
            ))}
          </div>
        </section>

        {/* Illustration card */}
        <aside className="w-full md:w-[420px] flex-shrink-0">
          <div
            ref={cardRef}
            onMouseMove={handleCardMove}
            onMouseLeave={handleCardLeave}
            className="relative rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-b from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-slate-100 dark:border-slate-800 p-6 md:p-8 transform transition"
            style={cardStyle}
          >
            <div className="absolute inset-0 pointer-events-none animate-subtle-move">
              <div className="absolute -left-10 -top-10 w-40 h-40 bg-gradient-to-tr from-indigo-100 to-transparent rounded-full opacity-60 blur-3xl dark:opacity-20" />
              <div className="absolute -right-8 bottom-0 w-36 h-36 bg-gradient-to-tr from-pink-100 to-transparent rounded-full opacity-60 blur-2xl dark:opacity-20" />
            </div>

            <div className="relative bg-white dark:bg-slate-900 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800">
              <div className="p-6 flex items-center gap-4">
                <div className="w-20 h-28 bg-slate-100 dark:bg-slate-800 rounded-md flex items-center justify-center text-slate-400">
                  <Image
                    src="/receipt-illustration.svg"
                    alt="Receipt"
                    width={120}
                    height={160}
                    className="object-contain"
                  />
                </div>
                <div className="flex-1">
                  <div className="text-lg font-semibold">Scan & Split</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Ambil foto, sistem mendeteksi item & harga.
                  </div>
                </div>
              </div>

              <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-transparent flex items-center justify-between">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Preview
                </div>
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Ready
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Built for clarity — works great on mobile.
          </div>
        </aside>
      </main>
    </div>
  );
}
