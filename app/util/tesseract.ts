// Lightweight browser helper for running Tesseract OCR on an image stored in localStorage.
// This implementation intentionally avoids passing functions into the worker
// options (they cannot be cloned into a worker) and instead invokes `onProgress`
// from the main thread at coarse lifecycle steps.
//
// OPTIMIZED for receipt scanning with preprocessing and tuned Tesseract params.

export type OCRProgress = (m: {
  status?: string;
  progress?: number;
  [k: string]: any;
}) => void;

export interface RecognizeOptions {
  localStorageKey?: string;
  /** string like 'eng', 'ind', 'eng+ind' or array ['eng','ind'] */
  lang?: string | string[];
  maxDimension?: number | null;
  onProgress?: OCRProgress;
  saveResultKey?: string | null; // if null/undefined -> do not save
  /**
   * Optional worker options forwarded into createWorker().
   * Default: { langPath: '/tessdata' } which maps to `public/tessdata` in Next.js.
   */
  workerOptions?: Record<string, any>;
  /**
   * Enable image preprocessing (grayscale, contrast, sharpening) for better OCR.
   * Default: true
   */
  preprocess?: boolean;
  /**
   * Enable automatic deskew (rotation correction) for tilted receipts.
   * Default: true
   */
  deskew?: boolean;
}

/**
 * Preprocess image for better OCR results on receipts.
 * Converts to grayscale, increases contrast, and applies adaptive threshold.
 */
function preprocessImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);

      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original
      ctx.drawImage(img, 0, 0);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Convert to grayscale and increase contrast
      for (let i = 0; i < data.length; i += 4) {
        // Grayscale using luminosity method
        const gray =
          data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

        // Increase contrast (factor 1.5)
        const contrast = 1.5;
        const factor =
          (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));
        let newGray = factor * (gray - 128) + 128;

        // Clamp values
        newGray = Math.max(0, Math.min(255, newGray));

        // Simple threshold for receipts (make text darker, background lighter)
        if (newGray < 140) {
          newGray = Math.max(0, newGray * 0.7); // Darken dark pixels (text)
        } else {
          newGray = Math.min(255, newGray * 1.2); // Lighten light pixels (background)
        }

        data[i] = newGray; // R
        data[i + 1] = newGray; // G
        data[i + 2] = newGray; // B
        // Alpha stays the same
      }

      ctx.putImageData(imageData, 0, 0);

      try {
        resolve(canvas.toDataURL("image/png", 1.0)); // PNG for lossless
      } catch (e) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Detect skew angle of the image using Hough transform approximation.
 * Returns angle in degrees (-45 to 45).
 */
function detectSkewAngle(imageData: ImageData): number {
  const { width, height, data } = imageData;

  // Simple edge detection and line angle estimation
  // We'll use a simplified approach: find horizontal text lines and measure their angle

  const edgePoints: { x: number; y: number }[] = [];

  // Detect edges (horizontal gradients)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const left = data[idx - 4];
      const right = data[idx + 4];
      const gradient = Math.abs(right - left);

      // Strong edge detected
      if (gradient > 50) {
        edgePoints.push({ x, y });
      }
    }
  }

  if (edgePoints.length < 100) return 0; // Not enough edges

  // Sample points and calculate dominant angle using linear regression
  const sampleSize = Math.min(1000, edgePoints.length);
  const step = Math.floor(edgePoints.length / sampleSize);

  // Group points by approximate y-coordinate (rows of text)
  const rowGroups: Map<number, { x: number; y: number }[]> = new Map();
  const rowTolerance = 5;

  for (let i = 0; i < edgePoints.length; i += step) {
    const p = edgePoints[i];
    const rowKey = Math.round(p.y / rowTolerance) * rowTolerance;
    if (!rowGroups.has(rowKey)) rowGroups.set(rowKey, []);
    rowGroups.get(rowKey)!.push(p);
  }

  // Calculate angles for rows with enough points
  const angles: number[] = [];

  rowGroups.forEach((points) => {
    if (points.length < 10) return;

    // Sort by x
    points.sort((a, b) => a.x - b.x);

    // Get first and last quartile averages
    const q1Count = Math.floor(points.length / 4);
    const q4Start = points.length - q1Count;

    let x1 = 0,
      y1 = 0,
      x2 = 0,
      y2 = 0;
    for (let i = 0; i < q1Count; i++) {
      x1 += points[i].x;
      y1 += points[i].y;
    }
    for (let i = q4Start; i < points.length; i++) {
      x2 += points[i].x;
      y2 += points[i].y;
    }
    x1 /= q1Count;
    y1 /= q1Count;
    x2 /= points.length - q4Start;
    y2 /= points.length - q4Start;

    const dx = x2 - x1;
    const dy = y2 - y1;
    if (Math.abs(dx) > 20) {
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      if (Math.abs(angle) < 45) {
        angles.push(angle);
      }
    }
  });

  if (angles.length === 0) return 0;

  // Return median angle
  angles.sort((a, b) => a - b);
  return angles[Math.floor(angles.length / 2)];
}

/**
 * Deskew (rotate) image to correct tilt.
 * Detects skew angle automatically and rotates to straighten text.
 */
function deskewImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Get grayscale image data for skew detection
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const grayData = new ImageData(canvas.width, canvas.height);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const gray =
          imageData.data[i] * 0.299 +
          imageData.data[i + 1] * 0.587 +
          imageData.data[i + 2] * 0.114;
        grayData.data[i] = gray;
        grayData.data[i + 1] = gray;
        grayData.data[i + 2] = gray;
        grayData.data[i + 3] = 255;
      }

      const angle = detectSkewAngle(grayData);

      // Only correct if angle is significant (> 0.5 degrees) but not too extreme
      if (Math.abs(angle) < 0.5 || Math.abs(angle) > 30) {
        return resolve(dataUrl);
      }

      // Rotate image to correct skew
      const radians = -angle * (Math.PI / 180);

      // Calculate new canvas size to fit rotated image
      const cos = Math.abs(Math.cos(radians));
      const sin = Math.abs(Math.sin(radians));
      const newWidth = Math.ceil(img.width * cos + img.height * sin);
      const newHeight = Math.ceil(img.width * sin + img.height * cos);

      canvas.width = newWidth;
      canvas.height = newHeight;

      // Fill with white background
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, newWidth, newHeight);

      // Translate to center, rotate, then draw
      ctx.translate(newWidth / 2, newHeight / 2);
      ctx.rotate(radians);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      try {
        resolve(canvas.toDataURL("image/png", 1.0));
      } catch (e) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function resizeDataUrlIfNeeded(
  dataUrl: string,
  maxDim?: number | null
): Promise<string> {
  if (!maxDim) return Promise.resolve(dataUrl);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { width: w, height: h } = img;
      const max = Math.max(w, h);
      if (max <= (maxDim as number)) return resolve(dataUrl);

      const scale = (maxDim as number) / max;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);

      // Use better image smoothing for resize
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        resolve(canvas.toDataURL("image/png", 1.0)); // PNG for better quality
      } catch (e) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image for resizing"));
    img.src = dataUrl;
  });
}

/**
 * Read DataURL from localStorage and run OCR in a browser worker.
 * Returns the raw result object from tesseract.js.
 */
export async function recognizeReceiptFromLocalStorage(
  opts: RecognizeOptions = {}
) {
  const {
    localStorageKey = "receiptImageDataUrl",
    lang = "eng",
    maxDimension = 2000, // Increased for better detail capture
    onProgress,
    saveResultKey = undefined,
    preprocess = true, // Enable preprocessing by default
    deskew = true, // Enable deskew by default
  } = opts;

  onProgress?.({ status: "start", progress: 0 });

  if (typeof window === "undefined")
    throw new Error("Must be run in the browser");

  const dataUrl = window.localStorage.getItem(localStorageKey);
  if (!dataUrl)
    throw new Error(`no image found in localStorage key: ${localStorageKey}`);

  // Step 1: Resize if needed
  onProgress?.({ status: "resizing", progress: 5 });
  let imageToSend = await resizeDataUrlIfNeeded(dataUrl, maxDimension);
  onProgress?.({ status: "resized", progress: 15 });

  // Step 2: Deskew (rotation correction) for tilted images
  if (deskew) {
    onProgress?.({ status: "deskewing", progress: 18 });
    imageToSend = await deskewImage(imageToSend);
    onProgress?.({ status: "deskewed", progress: 22 });
  }

  // Step 3: Preprocess for better OCR (grayscale, contrast, threshold)
  if (preprocess) {
    onProgress?.({ status: "preprocessing", progress: 25 });
    imageToSend = await preprocessImage(imageToSend);
    onProgress?.({ status: "preprocessed", progress: 32 });
  }

  onProgress?.({ status: "creating-worker", progress: 38 });
  // dynamic import and loose typing to avoid tsc issues across tesseract.js versions
  const t = await import("tesseract.js");
  const createWorker =
    (t as any).createWorker ??
    (t as any).default?.createWorker ??
    (t as any).createWorker;

  // normalize lang: accept string | string[] | 'eng+ind' -> produce joined string for createWorker
  let langString = "eng";
  if (Array.isArray(lang)) {
    langString =
      lang
        .map((s) => String(s).trim())
        .filter(Boolean)
        .join("+") || "eng";
  } else if (typeof lang === "string") {
    langString = lang.trim() || "eng";
  } else {
    langString = String(lang) || "eng";
  }

  // normalize workerOptions and provide a safe default langPath -> /tessdata
  const normalizedWorkerOptions = Object.assign(
    { langPath: "/tessdata" },
    (opts as any).workerOptions || {}
  );

  // Verify requested language traineddata files actually exist under langPath
  // If a requested language file is missing in production, fallback to available ones.
  // This avoids failing deployments where only a subset of traineddata files were uploaded.
  async function ensureLangFilesExist(requested: string) {
    if (typeof window === "undefined") return requested;
    const langPath = normalizedWorkerOptions.langPath || "/tessdata";
    const langs = String(requested)
      .split("+")
      .map((s) => s.trim())
      .filter(Boolean);

    const available: string[] = [];
    for (const l of langs) {
      try {
        // Try HEAD first; some hosts may not support HEAD so fall back to GET on failure
        let ok = false;
        try {
          const res = await fetch(`${langPath}/${l}.traineddata`, {
            method: "HEAD",
          });
          ok = res.ok;
        } catch (e) {
          const res = await fetch(`${langPath}/${l}.traineddata`);
          ok = res.ok;
        }
        if (ok) available.push(l);
      } catch (e) {
        // ignore missing/blocked files
      }
    }

    if (available.length > 0) return available.join("+");

    // If none of the requested languages exist, try common fallbacks
    const fallbacks = ["ind", "eng"];
    for (const f of fallbacks) {
      try {
        const res = await fetch(`${langPath}/${f}.traineddata`, {
          method: "HEAD",
        });
        if (res.ok) return f;
      } catch (e) {
        // ignore
      }
    }

    // If nothing found, return original requested string and let tesseract.js handle the error
    return requested;
  }

  // Tesseract.js v5/v6: pass language directly to createWorker, no separate loadLanguage/initialize calls
  // createWorker must not receive functions (DataCloneError). We forward only plain options.
  // Ensure language files exist and adjust langString if some traineddata files are missing
  try {
    langString = await ensureLangFilesExist(langString);
    if (!langString || String(langString).trim() === "") langString = "eng";
  } catch (e) {
    // ignore and proceed with original langString
  }

  const worker: any = await (createWorker as any)(
    langString,
    1, // OEM 1 = LSTM only (best for receipts)
    normalizedWorkerOptions
  );

  try {
    // Set optimized parameters for receipt scanning
    onProgress?.({ status: "configuring", progress: 45 });
    if (typeof worker.setParameters === "function") {
      await worker.setParameters({
        // PSM 6 = Assume a single uniform block of text (good for receipts)
        // PSM 4 = Assume a single column of text of variable sizes
        tessedit_pageseg_mode: "6",
        // Preserve interword spaces
        preserve_interword_spaces: "1",
        // Character whitelist for receipts (numbers, letters, common symbols)
        // Removed to allow all characters - better for Indonesian text
        // tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,:-/$%&*()[] \n",
      });
    }

    onProgress?.({ status: "recognizing", progress: 50 });
    const result = await worker.recognize(imageToSend);

    onProgress?.({ status: "done", progress: 100 });

    if (saveResultKey) {
      try {
        window.localStorage.setItem(saveResultKey, JSON.stringify(result));
      } catch (e) {
        console.warn("Failed to save OCR result:", e);
      }
    }

    return result;
  } finally {
    try {
      if (typeof worker.terminate === "function") await worker.terminate();
    } catch (e) {
      // ignore termination errors
    }
  }
}

export default recognizeReceiptFromLocalStorage;
