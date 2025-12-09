"use client";

import { useEffect } from "react";

interface IntroProps {
  onFinish?: () => void;
  once?: boolean; // kalau true, simpan di localStorage agar hanya muncul sekali
}

export default function Intro({ onFinish, once = true }: IntroProps) {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      once &&
      localStorage.getItem("introShown")
    ) {
      onFinish?.();
      return;
    }

    const total = 3500; // ms, sesuaikan jika ubah CSS
    const timer = setTimeout(() => {
      if (typeof window !== "undefined" && once)
        localStorage.setItem("introShown", "1");
      onFinish?.();
    }, total);

    return () => clearTimeout(timer);
  }, [onFinish, once]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-linear-to-b dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100">
      <div className="relative flex flex-col items-center gap-4">
        <div className="text-5xl md:text-7xl font-extrabold tracking-tight opacity-0 transform scale-90 animate-[intro-scale_1.2s_ease-in-out_forwards]">
          Split Bill
        </div>

        <div className="text-sm md:text-base opacity-0 animate-[fade-in_1s_ease-in_out_1.1s_forwards]">
          Scan receipt, split instantly
        </div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[60%] h-40 rounded-full bg-black/10 blur-xl opacity-0 transform translate-x-[-150%] animate-[sweep_1.1s_ease-in-out_0.55s_forwards]" />
        </div>
      </div>

      <div className="absolute inset-0 bg-black opacity-0 animate-[fade-out_0.5s_ease-in-out_3s_forwards]" />
    </div>
  );
}
