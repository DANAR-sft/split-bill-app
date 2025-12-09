"use client";

import { useEffect, useRef, useState } from "react";

interface CameraCaptureProps {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
  maxDimension?: number;
}

export default function CameraCapture({
  onCapture,
  onClose,
  maxDimension = 1280,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [imageCapture, setImageCapture] = useState<ImageCapture | null>(null);
  const [error, setError] = useState<string>("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    "environment"
  );
  const [capabilities, setCapabilities] =
    useState<MediaTrackCapabilities | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: maxDimension },
          height: { ideal: maxDimension },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // ensure playback starts and sizes correctly
        // play() may fail if not allowed by browser autoplay policies, ignore errors
        try {
          // attempt to play after metadata loads
          videoRef.current.onloadedmetadata = () => {
            // set objectFit style to cover so the video fills the container
            try {
              videoRef.current!.style.objectFit = "cover";
            } catch {}
            videoRef.current!.play().catch(() => {});
          };
          // also try immediate play as a best-effort
          videoRef.current.play().catch(() => {});
        } catch (err) {
          // ignore play errors
        }
      }

      const track = mediaStream.getVideoTracks()[0];

      // Initialize ImageCapture API
      const imgCapture = new ImageCapture(track);
      setImageCapture(imgCapture);

      // Get camera capabilities
      const caps = track.getCapabilities();
      setCapabilities(caps);

      setStream(mediaStream);
      setError("");
    } catch (err) {
      setError(
        "Tidak dapat mengakses kamera. Pastikan izin kamera diaktifkan."
      );
      console.error("Error accessing camera:", err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setImageCapture(null);
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const capturePhoto = async () => {
    if (!imageCapture) {
      console.error("ImageCapture not initialized");
      return;
    }

    try {
      // Use takePhoto() for better quality (if supported)
      // Fallback to grabFrame() if takePhoto() is not available
      let blob: Blob;

      try {
        blob = await imageCapture.takePhoto();
      } catch (err) {
        console.warn(
          "takePhoto() not supported, attempting grabFrame() or fallback to video canvas",
          err
        );

        // TypeScript's ImageCapture definition may not include grabFrame in some lib versions,
        // so cast to any and check for the method at runtime.
        const grab = (imageCapture as any).grabFrame;
        if (typeof grab === "function") {
          const imageBitmap = await grab.call(imageCapture);
          blob = await bitmapToBlob(imageBitmap);
        } else {
          // Fallback: capture current frame from the video element to a blob
          const video = videoRef.current;
          if (!video) {
            throw new Error("No video element available for fallback capture");
          }
          const canvas = document.createElement("canvas");
          const vidW = video.videoWidth || maxDimension;
          const vidH = video.videoHeight || maxDimension;
          canvas.width = vidW;
          canvas.height = vidH;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            throw new Error(
              "Canvas 2D context unavailable for fallback capture"
            );
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          blob = await new Promise<Blob>((resolve) =>
            canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", 0.95)
          );
        }
      }

      // Convert blob to data URL and resize if needed
      const dataUrl = await resizeImage(blob, maxDimension);

      // Save to localStorage and trigger callback
      onCapture(dataUrl);
      stopCamera();
    } catch (err) {
      console.error("Error capturing photo:", err);
      setError("Gagal mengambil foto. Silakan coba lagi.");
    }
  };

  const bitmapToBlob = (imageBitmap: ImageBitmap): Promise<Blob> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(imageBitmap, 0, 0);
      }
      canvas.toBlob(
        (blob) => {
          resolve(blob as Blob);
        },
        "image/jpeg",
        0.95
      );
    });
  };

  const resizeImage = (blob: Blob, maxDim: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        URL.revokeObjectURL(url);

        let width = img.width;
        let height = img.height;

        // Resize if needed
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = (height * maxDim) / width;
            width = maxDim;
          } else {
            width = (width * maxDim) / height;
            height = maxDim;
          }
        }

        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
            resolve(dataUrl);
          }
        }
      };

      img.src = url;
    });
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 p-4 flex justify-between items-center">
        <h2 className="text-white text-lg font-semibold">Ambil Foto Receipt</h2>
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="text-white text-2xl hover:text-gray-300 px-2"
          type="button"
        >
          ✕
        </button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
        {error ? (
          <div className="text-white text-center p-4">
            <p className="mb-4">{error}</p>
            <button
              onClick={startCamera}
              className="rounded bg-white px-4 py-2 text-black hover:bg-gray-200 border border-white transition"
              type="button"
            >
              Coba Lagi
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              // fill available area and crop if needed to avoid small centered video
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Guide Overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Dark overlay di luar guide frame */}
              <div className="absolute inset-0 flex items-center justify-center">
                {/* Guide frame - portrait receipt shape */}
                <div
                  className="relative"
                  style={{ width: "85%", height: "75%" }}
                >
                  {/* Semi-transparent overlay di luar frame */}
                  <div className="absolute inset-0 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />

                  {/* Border guide - dashed */}
                  <div className="absolute inset-0 border-2 border-dashed border-white/70 rounded-lg" />

                  {/* Corner brackets */}
                  {/* Top-left */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
                  {/* Top-right */}
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
                  {/* Bottom-left */}
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
                  {/* Bottom-right */}
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />

                  {/* Center crosshair */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="w-6 h-0.5 bg-white/50" />
                    <div className="w-0.5 h-6 bg-white/50 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              {/* Helper text */}
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <span className="bg-black/60 text-white text-sm px-4 py-2 rounded-full">
                  📄 Posisikan struk di dalam bingkai
                </span>
              </div>
            </div>

            {/* Switch Camera Button (if multiple cameras available) */}
            {capabilities?.facingMode && capabilities.facingMode.length > 1 && (
              <button
                onClick={switchCamera}
                className="absolute top-4 right-4 bg-black bg-opacity-50 text-white rounded-full p-3 hover:bg-opacity-70 transition"
                type="button"
                title="Switch Camera"
              >
                🔄
              </button>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-900 p-6 flex justify-center items-center gap-4">
        {/* Cancel Button */}
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="rounded bg-white px-6 py-2 text-black hover:bg-gray-200 border border-white transition"
          type="button"
        >
          Batal
        </button>

        {/* Capture Button */}
        <button
          onClick={capturePhoto}
          disabled={!!error || !imageCapture}
          className="w-16 h-16 rounded-full bg-white border-4 border-gray-400 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
          type="button"
          title="Take Photo"
        />

        {/* Info Text */}
        <div className="w-20 text-white text-xs text-center">
          {imageCapture ? "Siap" : "Loading..."}
        </div>
      </div>
    </div>
  );
}
