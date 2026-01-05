"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Logo from "@/app/components/Logo/Logo";
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-200">
      {/* Header - Clear visual hierarchy, consistent spacing */}
      <header className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <div className="text-base font-semibold tracking-tight text-slate-100">
            SplitBill
          </div>
        </div>

        <nav className="flex items-center gap-4">
          <Link href="/upload-receipt" className="btn-primary">
            <span>Mulai</span>
            <ChevronRight size={18} />
          </Link>
        </nav>
      </header>

      {/* Hero - Clear hierarchy: headline > subtext > CTA */}
      <main className="max-w-6xl mx-auto px-6 py-16 md:py-24 flex flex-col-reverse md:flex-row items-center gap-12 md:gap-16">
        {/* Content - Left aligned text (UI Design Tip #15) */}
        <section className="flex-1 text-left">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6 text-slate-50">
            Bagi tagihan
            <br />
            <span className="text-indigo-400">dengan mudah.</span>
          </h1>

          <p className="text-lg text-slate-400 max-w-lg mb-8 leading-relaxed">
            Scan struk, deteksi item otomatis, lalu bagi tagihan dengan cepat
            dan akurat. Tidak perlu hitung manual lagi.
          </p>

          <div className="flex flex-col sm:flex-row items-start gap-4">
            <Link href="/upload-receipt" className="btn-primary text-base">
              <span>Scan Struk Sekarang</span>
              <ChevronRight size={20} />
            </Link>

            <Link href="/manual-entry" className="btn-secondary text-base">
              <span>Input Manual</span>
            </Link>
          </div>

          {/* Feature list - Simple, no decorative colors */}
          <div className="mt-12 grid grid-cols-2 gap-4 max-w-md">
            {[
              { icon: "📷", text: "Scan otomatis" },
              { icon: "⚡", text: "Proses cepat" },
              { icon: "💰", text: "Hitung diskon" },
              { icon: "📤", text: "Share hasil" },
            ].map((feat, i) => (
              <div key={i} className="flex items-center gap-3 text-slate-300">
                <span className="text-lg">{feat.icon}</span>
                <span className="text-sm font-medium">{feat.text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Illustration card - Simplified, less decorative */}
        <aside className="w-full md:w-[400px] flex-shrink-0">
          <div
            ref={cardRef}
            onMouseMove={handleCardMove}
            onMouseLeave={handleCardLeave}
            className="card-elevated"
            style={cardStyle}
          >
            <div className="bg-slate-900/80 rounded-xl overflow-hidden border border-slate-700/50">
              <div className="p-6 flex items-center gap-5">
                <div className="w-16 h-20 bg-slate-800 rounded-lg flex items-center justify-center">
                  <Image
                    src="/receipt-illustration.svg"
                    alt="Receipt illustration"
                    width={100}
                    height={130}
                    className="object-contain opacity-80"
                  />
                </div>
                <div className="flex-1">
                  <div className="text-lg font-semibold text-slate-100 mb-1">
                    Scan & Split
                  </div>
                  <div className="text-sm text-slate-400 leading-relaxed">
                    Foto struk, sistem deteksi item & harga secara otomatis.
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                  Status
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  <span className="text-sm font-medium text-slate-300">
                    Ready
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-500 text-center">
            Optimal untuk mobile & desktop
          </p>
        </aside>
      </main>
    </div>
  );
}
