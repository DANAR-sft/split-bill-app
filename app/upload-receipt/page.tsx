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
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <section className="md:col-span-2 flex flex-col gap-6">
            <div className="text-3xl font-bold">Upload Struk</div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 min-h-[420px] flex items-center justify-center">
              <div className="w-full flex flex-col items-center gap-4">
                <div className="w-full max-w-2xl">
                  <div className="h-[420px] w-full rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                    {previewImage ? (
                      <div className="relative w-full h-full">
                        <img
                          src={previewImage}
                          alt="Preview"
                          className="w-full h-full object-contain"
                        />
                        <button
                          onClick={removeImage}
                          className="absolute top-3 right-3 bg-white dark:bg-slate-700 rounded-full px-3 py-1 shadow z-10"
                        >
                          x
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
                      <div className="text-center text-slate-500 dark:text-slate-400 px-6">
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
                        className={`w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg px-4 py-3 bg-gradient-to-r from-indigo-600 to-pink-500 text-white shadow-md hover:bg-indigo-700 cursor-pointer hover:bg-gradient-to-r hover:from-indigo-500 hover:to-pink-400 hover:text-white ${
                          processing ? "opacity-60 pointer-events-none" : ""
                        }`}
                        disabled={processing}
                      >
                        <span className="text-lg">📸</span>
                        <span className="font-medium">Ambil Foto</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowCamera(false)}
                        className={`w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg px-4 py-3 bg-gradient-to-r from-indigo-600 to-pink-500 text-white shadow-md hover:bg-indigo-700 cursor-pointer hover:bg-gradient-to-r hover:from-indigo-500 hover:to-pink-400 hover:text-white ${
                          processing ? "opacity-60 pointer-events-none" : ""
                        }`}
                        disabled={processing}
                      >
                        <span className="text-lg">✕</span>
                        <span className="font-medium">Stop Kamera</span>
                      </button>
                    )}

                    <label htmlFor="file-input" className="w-full sm:w-auto">
                      <span
                        className={`flex items-center justify-center gap-2 w-full sm:w-auto rounded-lg px-4 py-3 bg-gradient-to-r from-indigo-600 to-pink-500 text-white shadow-md cursor-pointer hover:bg-gradient-to-r hover:from-indigo-500 hover:to-pink-400 hover:text-white  ${
                          processing ? "opacity-60 pointer-events-none" : ""
                        }`}
                      >
                        <span className="text-lg">🖼️</span>
                        <span className="font-medium">Gallery</span>
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
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <h3 className="font-semibold mb-2">Tips</h3>
              <ul className="text-sm text-slate-600 dark:text-slate-300 list-disc pl-5 space-y-2">
                <li>Pastikan struk rata dan pencahayaan cukup.</li>
                <li>Potong area yang tidak perlu agar hasil lebih akurat.</li>
                <li>Posisikan kamera tegak lurus dengan struk.</li>
              </ul>
            </div>

            <div className="mt-6 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Processing
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded mt-2 overflow-hidden">
                {/** If OCR is in late stage (>=70% but not complete) show the bar at 70% with a pulse animation to indicate finalizing work. */}
                {(() => {
                  const atSeventy =
                    processing && progress >= 70 && progress < 100;
                  const displayedProgress = atSeventy ? 70 : progress;
                  return (
                    <div
                      // key changes when a new input/OCR run starts so the element remounts
                      key={progressKey}
                      className={`h-2 ${
                        atSeventy
                          ? "bg-gradient-to-r from-indigo-600 to-pink-500 animate-pulse"
                          : "bg-indigo-600 dark:bg-pink-500 transition-all"
                      }`}
                      style={{ width: `${displayedProgress}%` }}
                    />
                  );
                })()}
              </div>
              <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                {processing ? (
                  <>
                    <div className="font-medium">
                      {progress >= 70 && progress < 100
                        ? "Memproses..."
                        : statusText}
                    </div>
                    <div className="text-xs mt-1">Progress: {progress}%</div>
                  </>
                ) : (
                  <div className="text-sm text-slate-500">Ready</div>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Process & Result
              </div>
              <div className="mt-3 text-sm text-slate-700 dark:text-slate-200">
                {processing ? (
                  <div className="flex flex-col items-start">
                    <div className="text-xs text-slate-400 mt-2">
                      Sedang menjalankan scan, tunggu sampai selesai untuk
                      melihat hasil AI.
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">
                    scan siap. Klik tombol untuk melihat hasil yang sudah
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
                className={`mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg shadow-md transition ${
                  processing || !ocrText || ocrValid !== true
                    ? "opacity-60 pointer-events-none bg-slate-400"
                    : "bg-gradient-to-r from-indigo-600 to-pink-500 text-white cursor-pointerhover:bg-gradient-to-r hover:from-indigo-500 hover:to-pink-400 hover:text-white "
                }`}
              >
                <span>✨</span>
                <span className="font-medium">Lihat Hasil dengan AI</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              {ocrValid === false && (
                <div className="mt-3 text-sm text-yellow-600">
                  <div>Scan tidak menghasilkan hasil yang dapat diproses.</div>
                  <div>
                    Silakan ulangi scan sesuai tips (pencahayaan, posisi, potong
                    area) atau masukan manual.
                  </div>
                  <div className="mt-2 flex gap-2">
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
                      className="px-3 py-2 border border-emerald-600 rounded-md text-white bg-emerald-600 hover:bg-emerald-500 hover:text-white"
                    >
                      Ambil Ulang Foto
                    </button>
                    <Link href="/manual-entry">
                      <button className="px-3 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-500">
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
