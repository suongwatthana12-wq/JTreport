import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import * as ZXingModule from "@zxing/library";
import { Jimp } from "jimp";

const ZXing = (ZXingModule as any).default || ZXingModule;
const { MultiFormatReader, RGBLuminanceSource, BinaryBitmap, HybridBinarizer, BarcodeFormat, DecodeHintType } = ZXing;

const app = express();
const PORT = 3000;

// Safety net: never let an unexpected error (OCR, network, etc.) silently kill the whole server.
process.on("unhandledRejection", (reason: any) => {
  console.error("[unhandledRejection]", reason?.message || reason);
});
process.on("uncaughtException", (err: any) => {
  console.error("[uncaughtException]", err?.message || err);
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Server-side In-Memory Shared State
let serverStockData: Record<string, any> | null = null;
let serverLastUpdated: number = Date.now();

function emptyRow() {
  return {
    ret: "", reloc: "", sent: "", prevday: "", today: "",
    tracking: "", receiverPhone: "", senderPhone: "",
    cc: "", cod: "", issue: "", other: ""
  };
}

function emptyDay() {
  return {
    arrived: "",
    prevMonthLeftover: "",
    rows: Array.from({ length: 31 }, emptyRow),
  };
}

function initEmptyState() {
  const s: Record<string, any> = {};
  for (let d = 1; d <= 31; d++) s[d] = emptyDay();
  return s;
}

function getServerStockData() {
  if (!serverStockData) {
    serverStockData = initEmptyState();
  }
  return serverStockData;
}

/**
 * Reject decode results that are clearly NOT a waybill/tracking number — e.g. many J&T labels
 * also print a small QR code that just links to the "J&T Cambodia" app store page. That QR is
 * easy to decode (jsQR finds it reliably) but its content is a URL, not the tracking number,
 * which instead lives in the 1D barcode (Code128/etc.) printed elsewhere on the label.
 */
function looksLikeTrackingCode(text: string | null): boolean {
  if (!text) return false;
  const t = text.trim();
  if (!t) return false;
  // Reject URLs / links / domains (app-store or marketing QR codes)
  if (/^https?:\/\//i.test(t) || /www\./i.test(t) || /\.(com|kh|org|net|app)\b/i.test(t)) return false;
  // Reject anything with spaces (tracking numbers are a single unbroken token)
  if (/\s/.test(t)) return false;
  // Tracking numbers are short alphanumeric tokens (letters/digits/dashes), typically 6-20 chars
  if (!/^[A-Za-z0-9-]{6,20}$/.test(t)) return false;
  return true;
}

/**
 * Try jsQR (a QR-code-only, well-tested pure-JS scanner) on raw RGBA pixel data.
 * Loaded via dynamic import so a missing/broken package can never crash the whole server —
 * it just means this extra attempt is skipped and we fall back to @zxing/library below.
 */
async function tryJsQr(rgbaData: Uint8ClampedArray, width: number, height: number): Promise<string | null> {
  try {
    const jsQRModule: any = await import("jsqr");
    const jsQR = jsQRModule.default || jsQRModule;
    const result = jsQR(rgbaData, width, height, { inversionAttempts: "attemptBoth" });
    return result?.data || null;
  } catch (err: any) {
    return null;
  }
}

async function tryZxingDecode(luminances: Uint8ClampedArray, width: number, height: number): Promise<string | null> {
  // @zxing/library internally logs a lot of expected, harmless exceptions (it tries many
  // barcode formats/scanlines before giving up) via console.error/warn. Silence it here so
  // the terminal stays readable — we still return null/found normally either way.
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = () => { };
  console.warn = () => { };
  try {
    const luminanceSource = new RGBLuminanceSource(luminances, width, height);
    const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.ITF,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.CODABAR,
      BarcodeFormat.QR_CODE,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new MultiFormatReader();
    reader.setHints(hints);

    const result = reader.decode(binaryBitmap);
    return result.getText() || null;
  } catch (err) {
    return null;
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
}

/**
 * Scan Barcode / QR Code from an Image Buffer using @zxing/library + jsQR & Jimp.
 * Handles real phone-camera photos (large resolution, uneven lighting) by:
 *  1. Downscaling huge images (phone cameras can be 3000-4000px wide — this both speeds up
 *     decoding a lot and, counter-intuitively, often improves accuracy by reducing sensor noise).
 *  2. Trying @zxing/library FIRST — it handles 1D formats (Code128/EAN/etc.), which is where the
 *     actual tracking number lives on most courier labels.
 *  3. Falling back to jsQR (fast, robust, QR-only) — but only accepted if the result actually
 *     looks like a tracking number. Some labels print a SECOND, unrelated QR code that just links
 *     to an app-store page ("APP J&T Cambodia") — that must never be mistaken for the tracking #.
 *  4. If both fail, boosting contrast and retrying — helps with glare/low-contrast labels.
 *  5. Every candidate is validated with looksLikeTrackingCode() before being accepted; invalid
 *     matches (URLs, etc.) are discarded and scanning continues instead of stopping early.
 */
async function scanBarcodeFromBuffer(buffer: Buffer): Promise<string | null> {
  try {
    let image: any = await Jimp.read(buffer);

    // Downscale only truly huge camera photos (phones can be 3000-4000px+). Keep the cap higher
    // than before (2200 vs 1800) — 1D barcodes have thin bars that lose too much detail if
    // downscaled aggressively, which was likely causing real-world scans to fail.
    const MAX_DIM = 2200;
    if (image.bitmap.width > MAX_DIM || image.bitmap.height > MAX_DIM) {
      const ratio = image.bitmap.width / image.bitmap.height;
      const targetW = ratio >= 1 ? MAX_DIM : Math.round(MAX_DIM * ratio);
      const targetH = ratio >= 1 ? Math.round(MAX_DIM / ratio) : MAX_DIM;
      image = image.resize({ w: targetW, h: targetH });
    }

    const buildLuminances = (img: any) => {
      const width = img.bitmap.width;
      const height = img.bitmap.height;
      const length = width * height;
      const luminances = new Uint8ClampedArray(length);
      const data = img.bitmap.data;
      for (let i = 0; i < length; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        luminances[i] = (r * 30 + g * 59 + b * 11) / 100;
      }
      return { luminances, width, height, rgba: data };
    };

    // Track the best-looking-but-invalid candidate too, purely for debug logging.
    let lastRejected: string | null = null;

    // 1D barcodes (Code128/etc.) are orientation-sensitive — a photo taken with the phone
    // held sideways relative to the label can make the bars vertical instead of horizontal,
    // which zxing can fail to read even with TRY_HARDER. Try a few rotations too.
    const tryStageWithRotations = async (img: any, rotations: number[]): Promise<string | null> => {
      for (const angle of rotations) {
        try {
          const rotated = angle === 0 ? img : img.clone().rotate(angle);
          const { luminances, width, height, rgba } = buildLuminances(rotated);

          const zxingResult = await tryZxingDecode(luminances, width, height);
          if (looksLikeTrackingCode(zxingResult)) return zxingResult;
          if (zxingResult) lastRejected = zxingResult;

          // jsQR is rotation-invariant on its own (QR finder patterns work at any angle), so only
          // run it once per image variant (angle 0) to avoid redundant work.
          if (angle === 0) {
            const qrResult = await tryJsQr(rgba as any, width, height);
            if (looksLikeTrackingCode(qrResult)) return qrResult;
            if (qrResult) lastRejected = qrResult;
          }
        } catch (err: any) {
          console.error(`scanBarcodeFromBuffer: rotation ${angle} attempt failed:`, err.message);
        }
      }
      return null;
    };

    const ROTATIONS = [0, 90, 180, 270];

    // --- Attempt 1: plain image, all rotations ---
    let found = await tryStageWithRotations(image, ROTATIONS);
    if (found) return found;

    // --- Attempt 2: boosted contrast + normalized (helps glare/low-contrast labels) ---
    const boosted = image.clone().contrast(0.35).normalize();
    found = await tryStageWithRotations(boosted, ROTATIONS);
    if (found) return found;

    // --- Attempt 3: greyscale, all rotations ---
    const grey = image.clone().greyscale();
    found = await tryStageWithRotations(grey, ROTATIONS);
    if (found) return found;

    if (lastRejected) {
      console.log(`[scanBarcodeFromBuffer] Found a code but it doesn't look like a tracking number, ignoring: ${lastRejected}`);
    }
    return null;
  } catch (err: any) {
    console.error("scanBarcodeFromBuffer failed:", err.message);
    return null;
  }
}

/**
 * OCR Worker (Tesseract) — lazily initialized singleton, reused across scans for performance.
 * IMPORTANT: tesseract.js is loaded via dynamic import (not a top-level import) so that if the
 * package is missing, fails to install, or can't reach the network to fetch trained data, the
 * REST of the server (barcode/QR scanning, Telegram bot, web app) keeps working normally instead
 * of crashing on startup. OCR is treated as a "best effort" feature only.
 */
let ocrWorkerPromise: Promise<any> | null = null;
let ocrDisabled = false;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

async function getOcrWorker(): Promise<any | null> {
  if (ocrDisabled) return null;
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const tesseractModule: any = await import("tesseract.js");
      const createWorker = tesseractModule.createWorker || tesseractModule.default?.createWorker;
      // English-only: digits (phone numbers) are Latin/Arabic numerals and are read far more
      // accurately this way than with a combined khm+eng model (tested — khm+eng introduced
      // digit misreads that eng-only did not). It's also faster and needs no extra network
      // download of Khmer trained data, which is more reliable in restricted environments.
      return await withTimeout(createWorker("eng"), 20000, "OCR init (eng)");
    })();
  }
  try {
    return await ocrWorkerPromise;
  } catch (err: any) {
    console.error("OCR worker unavailable — disabling OCR, tracking-only scan will still work:", err.message);
    ocrDisabled = true;
    ocrWorkerPromise = null;
    return null;
  }
}

// Cambodian mobile numbers: start with 0, followed by 8-9 digits (9-10 digits total)
const PHONE_REGEX = /\b0\d{8,9}\b/g;

// Keyword fragments that mark the "sender" line, used only to de-prioritize matches on that
// line. Khmer script OCRs as garbage under English-only recognition, so this is best-effort.
const SENDER_LINE_KEYWORDS = ["sender", "N&G", "ផ្ញើ"];

/**
 * Extract the receiver's phone number printed on a shipping label photo (not encoded in the
 * QR/Barcode itself — only the tracking number is). Strategy:
 *  1. OCR the whole image (English-only — digits read reliably even next to Khmer glyphs).
 *  2. Collect every phone-shaped number, in reading order (top-to-bottom).
 *  3. On this label layout the receiver's info is printed before the sender's, so return the
 *     first match that isn't on an obvious "sender" line.
 * Returns null (never throws) if OCR is unavailable or nothing is found — the caller should
 * still proceed with just the tracking number in that case.
 */
async function extractReceiverPhoneFromImage(buffer: Buffer): Promise<string | null> {
  try {
    const worker = await getOcrWorker();
    if (!worker) return null;

    const { data } = await withTimeout<any>(worker.recognize(buffer), 20000, "OCR recognize");
    const text = data.text || "";
    const lines = text.split("\n");

    const senderPhones = new Set<string>();
    for (const line of lines) {
      if (SENDER_LINE_KEYWORDS.some((k) => line.toLowerCase().includes(k.toLowerCase()))) {
        const match = line.match(PHONE_REGEX);
        if (match) match.forEach((m) => senderPhones.add(m));
      }
    }

    const allMatches = text.match(PHONE_REGEX) || [];
    const candidate = allMatches.find((m) => !senderPhones.has(m));
    return candidate || allMatches[0] || null;
  } catch (err: any) {
    console.error("OCR receiver-phone extraction failed (continuing without it):", err.message);
    return null;
  }
}

// Helper function to insert scanned parcel info into stock database directly
function addScannedParcelToStock(tracking: string, phone: string = "") {
  if (!tracking) return;
  const stock = getServerStockData();

  let targetDay = "1";
  try {
    const phnomPenhDay = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Phnom_Penh",
      day: "numeric"
    }).format(new Date());
    targetDay = String(parseInt(phnomPenhDay, 10) || 1);
  } catch (e) {
    targetDay = String(new Date().getDate() || 1);
  }

  if (!stock[targetDay]) {
    stock[targetDay] = emptyDay();
  }

  const dayData = stock[targetDay];
  if (!dayData.rows || !Array.isArray(dayData.rows)) {
    dayData.rows = Array.from({ length: 31 }, emptyRow);
  }

  let targetRowIndex = dayData.rows.findIndex((r: any) => !r.tracking && !r.receiverPhone);
  if (targetRowIndex === -1) {
    dayData.rows.push(emptyRow());
    targetRowIndex = dayData.rows.length - 1;
  }

  dayData.rows[targetRowIndex] = {
    ...dayData.rows[targetRowIndex],
    tracking,
    receiverPhone: phone,
    today: "1"
  };

  serverStockData = stock;
  serverLastUpdated = Date.now();
}

// API: Get Shared Stock Data
app.get("/api/stock", (_req, res) => {
  return res.json({
    success: true,
    stockData: getServerStockData(),
    lastUpdated: serverLastUpdated
  });
});

// API: Update Shared Stock Data from Web App
app.post("/api/stock", (req, res) => {
  if (req.body.stockData) {
    serverStockData = req.body.stockData;
    serverLastUpdated = Date.now();
  }
  return res.json({
    success: true,
    lastUpdated: serverLastUpdated
  });
});

// API: Scan an image (Barcode/QR + OCR phone) and insert directly into the stock database.
const handleScanImage = async (req: express.Request, res: express.Response) => {
  try {
    const { imageBase64, webhookApiUrl } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, message: "❌ រកមិនឃើញ QR/Barcode ទេ សូមផ្ញើរូបភាពច្បាស់ជាងនេះ。" });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(cleanBase64, "base64");

    const [scannedText, receiverPhone] = await Promise.all([
      scanBarcodeFromBuffer(imageBuffer),
      extractReceiverPhoneFromImage(imageBuffer),
    ]);

    if (scannedText) {
      // Call API POST request to database / Web App if webhook defined
      if (webhookApiUrl) {
        try {
          await fetch(webhookApiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tracking: scannedText, receiverPhone: receiverPhone || "", scannedAt: new Date().toISOString() })
          });
        } catch (e) {
          console.error("Webhook POST failed:", e);
        }
      }

      // Also insert into internal stock database — លេខបៀល (tracking) + លេខអ្នកទទួល (receiver phone)
      addScannedParcelToStock(scannedText, receiverPhone || "");

      return res.json({
        success: true,
        scannedData: scannedText,
        receiverPhone: receiverPhone || null,
        message: `✅ ស្កែនជោគជ័យ! លេខបៀល៖ ${scannedText}${receiverPhone ? ` | លេខអ្នកទទួល៖ ${receiverPhone}` : ""}`
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "❌ រកមិនឃើញ QR/Barcode ទេ សូមផ្ញើរូបភាពច្បាស់ជាងនេះ。"
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: "❌ រកមិនឃើញ QR/Barcode ទេ សូមផ្ញើរូបភាពច្បាស់ជាងនេះ。"
    });
  }
};

app.post("/api/scan-image", handleScanImage);

async function startServer() {
  // Vite middleware for dev or production static serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

