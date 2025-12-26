"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import CameraCapture from "@/app/components/Camera/CameraCapture";
import { recognizeReceiptFromLocalStorage } from "@/app/util/tesseract";

export default function Receipt() {
  const router = useRouter();
  const [image, setImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string>("");
  const [showCamera, setShowCamera] = useState(false);

  const LOCAL_KEY = "receiptImageDataUrl";

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_KEY);
    if (saved) setPreviewImage(saved);

    return () => {};
  }, []);

  // Theme feature removed; UI uses default (light) styles.

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // OCR / processing state
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  // key to force remount of the inner progress bar so the CSS transition restarts
  const [progressKey, setProgressKey] = useState<number>(0);
  const [statusText, setStatusText] = useState("idle");
  const [ocrText, setOcrText] = useState("");
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [ocrValid, setOcrValid] = useState<boolean | null>(null);

  function HandleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const file = fileList[0];

    if (!(file instanceof Blob)) {
      console.warn("Selected item is not a File/Blob:", file);
      if (e.currentTarget) e.currentTarget.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setImage(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setPreviewImage(dataUrl);
      // reset progress-bar animation for new input
      setProgressKey(Date.now());
      try {
        localStorage.setItem(LOCAL_KEY, dataUrl);
      } catch (err) {
        console.warn("localStorage set error", err);
      }
      // start OCR from saved localStorage image
      runOCRFromLocalStorage();
      if (e.currentTarget) e.currentTarget.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.onerror = () => {
      console.error("FileReader error:", reader.error);
      if (e.currentTarget) e.currentTarget.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    try {
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("readAsDataURL failed:", err);
      if (e.currentTarget) e.currentTarget.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeImage() {
    setImage(null);
    setPreviewImage("");
    try {
      localStorage.removeItem(LOCAL_KEY);
    } catch (err) {
      console.warn("localStorage remove error", err);
    }
  }

  function handleCapture(dataUrl: string) {
    setPreviewImage(dataUrl);
    // reset progress-bar animation for new input
    setProgressKey(Date.now());
    try {
      localStorage.setItem(LOCAL_KEY, dataUrl);
    } catch (err) {
      console.warn("localStorage set error", err);
    }
    setShowCamera(false);
    setImage(null);
    // run OCR on captured image
    runOCRFromLocalStorage();
  }

  async function runOCRFromLocalStorage() {
    try {
      // mark start of a new OCR run and ensure the progress bar animation resets
      setProgressKey(Date.now());
      setProcessing(true);
      setProgress(0);
      setStatusText("Preparing OCR...");
      setOcrText("");

      const result = await recognizeReceiptFromLocalStorage({
        // localStorageKey defaults to "receiptImageDataUrl"
        lang: ["eng", "ind"],
        maxDimension: 1400,
        onProgress: (m) => {
          if (m.status) setStatusText(String(m.status));
          if (typeof m.progress === "number") {
            // Avoid jumping to 100% before finalization; reserve 100 for completion step
            const p = Math.round(Math.min(1, m.progress) * 100);
            setProgress(p >= 100 ? 70 : p);
          }
        },
        saveResultKey: null, // DO NOT save OCR result to localStorage
      });

      const text = result?.data?.text ?? "";
      setOcrText(text);

      // estimate confidence from word-level confidences if available
      let conf: number | null = null;
      try {
        const words = result?.data?.words;
        if (Array.isArray(words) && words.length > 0) {
          const sum = words.reduce(
            (s: number, w: any) => s + (Number(w.confidence) || 0),
            0
          );
          conf = Math.round(sum / words.length);
        } else if (typeof result?.data?.confidence === "number") {
          conf = Math.round(result.data.confidence as number);
        }
      } catch (e) {
        conf = null;
      }
      setOcrConfidence(conf);

      // Heuristic to decide whether OCR output is usable
      try {
        const trimmed = String(text || "").trim();
        const lineCount = trimmed
          ? trimmed.split(/\r?\n+/).filter(Boolean).length
          : 0;
        const hasNumber = /\d{1,3}[.,]?\d{0,2}|\d{2,}/.test(trimmed);
        let valid = true;
        if (!trimmed || trimmed.length < 20) valid = false;
        if (lineCount < 2) valid = false;
        if (!hasNumber) valid = false;
        if (conf !== null && conf < 50) valid = false;
        setOcrValid(valid);
        if (!valid) {
          setStatusText("Failed");
        } else {
          setStatusText("Done");
        }
      } catch (e) {
        setOcrValid(null);
        setStatusText("Done");
      }
      // Mark progress complete now that OCR + heuristics finished
      setProgress(100);
    } catch (err: any) {
      console.error("OCR failed:", err);
      setStatusText("OCR error: " + (err?.message ?? String(err)));
      setOcrText("");
    } finally {
      // keep processing true briefly so user sees completion
      setTimeout(() => setProcessing(false), 600);
    }
  }

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
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <section className="md:col-span-2 flex flex-col gap-6">
            <div className="text-2xl font-bold text-slate-100">
              Upload Struk
            </div>
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-6 min-h-[420px] flex items-center justify-center">
              <div className="w-full flex flex-col items-center gap-4">
                <div className="w-full max-w-2xl">
                  <div className="h-[420px] w-full rounded-lg overflow-hidden bg-slate-900/60 border border-slate-700/50 flex items-center justify-center">
                    {previewImage ? (
                      <div className="relative w-full h-full">
                        <img
                          src={previewImage}
                          alt="Preview"
                          className="w-full h-full object-contain"
                        />
                        <button
                          onClick={removeImage}
                          className="absolute top-3 right-3 bg-slate-800 text-slate-300 rounded-full w-8 h-8 flex items-center justify-center shadow-lg hover:bg-slate-700 transition"
                        >
                          ✕
                        </button>
                      </div>
                    ) : showCamera ? (
                      <div className="w-full h-full">
                        <CameraCapture
                          onCapture={handleCapture}
                          onClose={() => setShowCamera(false)}
                          maxDimension={1280}
                        />
                      </div>
                    ) : (
                      <div className="text-center text-slate-500 px-6">
                        Preview Image
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-full">
                  <div className="flex flex-col sm:flex-row gap-3 w-full">
                    {!showCamera ? (
                      <button
                        onClick={() => setShowCamera(true)}
                        className={`w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg px-5 py-3 bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition ${
                          processing ? "opacity-60 pointer-events-none" : ""
                        }`}
                        disabled={processing}
                      >
                        <span>📸</span>
                        <span>Ambil Foto</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowCamera(false)}
                        className={`w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg px-5 py-3 bg-slate-700 text-white font-medium hover:bg-slate-600 transition ${
                          processing ? "opacity-60 pointer-events-none" : ""
                        }`}
                        disabled={processing}
                      >
                        <span>✕</span>
                        <span>Stop Kamera</span>
                      </button>
                    )}

                    <label htmlFor="file-input" className="w-full sm:w-auto">
                      <span
                        className={`flex items-center justify-center gap-2 w-full sm:w-auto rounded-lg px-5 py-3 bg-indigo-600 text-white font-medium cursor-pointer hover:bg-indigo-500 transition ${
                          processing ? "opacity-60 pointer-events-none" : ""
                        }`}
                      >
                        <span>🖼️</span>
                        <span>Gallery</span>
                      </span>
                    </label>
                  </div>

                  <input
                    id="file-input"
                    ref={fileInputRef}
                    type="file"
                    name="file"
                    onChange={HandleImage}
                    className="hidden"
                    accept="image/*"
                  />
                </div>
              </div>
            </div>
          </section>

          <aside className="md:col-span-1 md:pt-15">
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5">
              <h3 className="font-semibold text-slate-100 mb-3">Tips</h3>
              <ul className="text-sm text-slate-300 list-disc pl-5 space-y-2 leading-relaxed">
                <li>Pastikan struk rata dan pencahayaan cukup.</li>
                <li>Potong area yang tidak perlu agar hasil lebih akurat.</li>
                <li>Posisikan kamera tegak lurus dengan struk.</li>
              </ul>
            </div>

            <div className="mt-6 rounded-xl border border-slate-700/50 bg-slate-800/60 p-5">
              <div className="text-sm font-medium text-slate-400 mb-2">
                Processing
              </div>
              <div className="w-full bg-slate-900/60 h-2 rounded-full mt-2 overflow-hidden">
                {/** If OCR is in late stage (>=70% but not complete) show the bar at 70% with a pulse animation to indicate finalizing work. */}
                {(() => {
                  const atSeventy =
                    processing && progress >= 70 && progress < 100;
                  const displayedProgress = atSeventy ? 70 : progress;
                  return (
                    <div
                      // key changes when a new input/OCR run starts so the element remounts
                      key={progressKey}
                      className={`h-2 rounded-full ${
                        atSeventy
                          ? "bg-indigo-500 animate-pulse"
                          : "bg-indigo-600 transition-all"
                      }`}
                      style={{ width: `${displayedProgress}%` }}
                    />
                  );
                })()}
              </div>
              <div className="mt-3 text-sm text-slate-300">
                {processing ? (
                  <>
                    <div className="font-medium">
                      {progress >= 70 && progress < 100
                        ? "Memproses..."
                        : statusText}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Progress: {progress}%
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-slate-500">Ready</div>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-700/50 bg-slate-800/60 p-5">
              <div className="text-sm font-medium text-slate-400 mb-2">
                Process & Result
              </div>
              <div className="mt-3 text-sm text-slate-300">
                {processing ? (
                  <div className="flex flex-col items-start">
                    <div className="text-sm text-slate-400 mt-2 leading-relaxed">
                      Sedang menjalankan scan, tunggu sampai selesai untuk
                      melihat hasil AI.
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 leading-relaxed">
                    Scan siap. Klik tombol untuk melihat hasil yang sudah
                    dirapikan oleh AI.
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  if (!ocrText || ocrValid !== true) {
                    setStatusText(
                      "OCR belum valid. Silakan ulangi scan sesuai tips sebelum melanjutkan."
                    );
                    return;
                  }
                  try {
                    localStorage.setItem("ocrResult", ocrText);
                  } catch (e) {
                    console.warn("localStorage set failed", e);
                  }
                  router.push("/receipt-result");
                }}
                disabled={processing || !ocrText || ocrValid !== true}
                className={`mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-medium transition ${
                  processing || !ocrText || ocrValid !== true
                    ? "opacity-60 pointer-events-none bg-slate-600 text-slate-400"
                    : "bg-indigo-600 text-white hover:bg-indigo-500"
                }`}
              >
                <span>✨</span>
                <span>Lihat Hasil dengan AI</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              {ocrValid === false && (
                <div className="mt-4 p-4 rounded-lg bg-amber-900/30 border border-amber-700/50 text-amber-200 text-sm">
                  <div className="font-medium mb-2">
                    Scan tidak menghasilkan hasil yang dapat diproses.
                  </div>
                  <div className="text-amber-300/80 mb-3 leading-relaxed">
                    Silakan ulangi scan sesuai tips (pencahayaan, posisi, potong
                    area) atau masukan manual.
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        // Clear preview and stored image so camera is shown
                        try {
                          localStorage.removeItem(LOCAL_KEY);
                        } catch (e) {
                          /* ignore */
                        }
                        setPreviewImage("");
                        setOcrText("");
                        setOcrValid(null);
                        setOcrConfidence(null);
                        setShowCamera(true);
                      }}
                      className="px-4 py-2 rounded-lg font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition"
                    >
                      Ambil Ulang Foto
                    </button>
                    <Link href="/manual-entry">
                      <button className="px-4 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition">
                        Masukkan Manual
                      </button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
