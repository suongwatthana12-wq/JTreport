import "dotenv/config";
import express from "express";
import path from "path";
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

// SECURITY: no hardcoded fallback token — always set TELEGRAM_BOT_TOKEN as an environment
// variable (locally in .env, or in your host's dashboard e.g. Render). Never commit a real
// token into source code or .env.example — anyone with the token can control your bot.
const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
if (!DEFAULT_BOT_TOKEN) {
  console.error("⚠️  TELEGRAM_BOT_TOKEN is not set! Set it in your .env file (local) or host's environment variables (production). The Telegram bot will not work until this is set.");
}
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "@my_stock_db_2026";

// Server-side In-Memory Shared State
let serverStockData: Record<string, any> | null = null;
let serverLastUpdated: number = Date.now();
let lastTelegramUpdateId: number = 0;

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
  console.error = () => {};
  console.warn = () => {};
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

// Parse Telegram message formatted like 'scan:TRACKING_NO|PHONE_NO' or 'scan:TRACKING_NO|PHONE_NO|DAY'.
// Forgiving of manual typing: accepts '|', ',', or plain whitespace as the separator between
// tracking / phone / day, since people typing this by hand often forget the exact '|' character.
function parseScanCommand(text: string) {
  if (!text) return null;
  const trimmed = text.trim();
  const scanMatch = trimmed.match(/^scan:\s*(.+)$/i);
  if (!scanMatch) return null;
  const rest = scanMatch[1].trim();
  if (!rest) return null;

  const parts = rest.split(/[|,]+|\s+/).map((p) => p.trim()).filter(Boolean);
  const tracking = parts[0] || "";
  if (!tracking) return null;
  const phone = parts[1] || "";
  const dayStr = parts[2] && /^\d+$/.test(parts[2]) ? parts[2] : "";
  return { tracking, phone, dayStr };
}

// Process scan command and update shared state
async function processIncomingScanCommand(text: string, chatId?: string | number, token?: string, sendDirectReply: boolean = true) {
  const parsed = parseScanCommand(text);
  if (!parsed) return { success: false, error: "Invalid scan command format. Use 'scan:TRACKING_NO|PHONE_NO'" };

  const { tracking, phone, dayStr } = parsed;
  const stock = getServerStockData();

  // Calculate target day: explicit day from message OR current Phnom Penh day of month
  let targetDay = "1";
  if (dayStr && parseInt(dayStr) >= 1 && parseInt(dayStr) <= 31) {
    targetDay = String(parseInt(dayStr));
  } else {
    try {
      const phnomPenhDay = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Phnom_Penh",
        day: "numeric"
      }).format(new Date());
      targetDay = String(parseInt(phnomPenhDay, 10) || 1);
    } catch (e) {
      targetDay = String(new Date().getDate() || 1);
    }
  }

  if (!stock[targetDay]) {
    stock[targetDay] = emptyDay();
  }

  const dayData = stock[targetDay];
  if (!dayData.rows || !Array.isArray(dayData.rows)) {
    dayData.rows = Array.from({ length: 31 }, emptyRow);
  }

  // Find first empty row or append new row
  let targetRowIndex = dayData.rows.findIndex((r: any) => !r.tracking && !r.receiverPhone);
  if (targetRowIndex === -1) {
    dayData.rows.push(emptyRow());
    targetRowIndex = dayData.rows.length - 1;
  }

  // Populate row with scanned parcel data
  dayData.rows[targetRowIndex] = {
    ...dayData.rows[targetRowIndex],
    tracking,
    receiverPhone: phone,
    today: "1" // Default mark as today's delivered/scanned item
  };

  serverStockData = stock;
  serverLastUpdated = Date.now();

  console.log(`[Telegram Bot Scan] Updated day ${targetDay}, row ${targetRowIndex + 1}: tracking=${tracking}, phone=${phone}`);

  // Send confirmation reply to Telegram chat if requested and token/chatId exist
  if (sendDirectReply && token && chatId) {
    try {
      const replyText = `✅ បានស្កែន និងបន្ថែមទំនិញជោគជ័យ!\n----------------------------------\n📦 លេខបៀល (Tracking): ${tracking}\n📱 លេខទូរស័ព្ទ (Phone): ${phone || "N/A"}\n📅 បញ្ចូលក្នុងថ្ងៃទី (Day): ${targetDay}\n🚚 ស្ថានភាព: ថ្ងៃនេះ (Today = 1)\n----------------------------------\n#JT_SCAN_SUCCESS`;
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: replyText
        })
      });
    } catch (err) {
      console.error("Failed to send Telegram scan reply:", err);
    }
  }

  return {
    success: true,
    message: `បានស្កែនបន្ថែមទំនិញ ${tracking} ទៅក្នុងថ្ងៃទី ${targetDay} រួចរាល់!`,
    tracking,
    phone,
    targetDay,
    rowIndex: targetRowIndex,
    lastUpdated: serverLastUpdated
  };
}

/**
 * Handle Telegram Photo Message: Download Photo -> Scan Barcode / QR -> Reply & Save
 */
async function processTelegramPhotoMessage(fileId: string, chatId: string | number, token: string) {
  try {
    // 1. Get file path from Telegram API
    const fileInfoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const fileInfo = await fileInfoRes.json();

    if (!fileInfo.ok || !fileInfo.result?.file_path) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "❌ មិនអាចទាញយករូបភាពពី Telegram បានទេ។ សូមព្យាយាមផ្ញើរូបភាពម្តងទៀត។"
        })
      });
      return;
    }

    const filePath = fileInfo.result.file_path;

    // 2. Download Image Buffer
    const imageRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
    const arrayBuffer = await imageRes.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // 3. Scan Barcode / QR Code (waybill number) AND OCR the receiver's phone number, in parallel
    const [scannedCode, receiverPhone] = await Promise.all([
      scanBarcodeFromBuffer(imageBuffer),
      extractReceiverPhoneFromImage(imageBuffer),
    ]);

    if (scannedCode) {
      // Barcode / QR Code found!
      console.log(`[Telegram Photo Scan Success] Tracking: ${scannedCode}, Receiver Phone: ${receiverPhone || "N/A"}`);

      // Save into Stock Database — only លេខបៀល (tracking) and លេខអ្នកទទួល (receiver phone)
      const scanMessage = receiverPhone ? `scan:${scannedCode}|${receiverPhone}` : `scan:${scannedCode}`;
      await processIncomingScanCommand(scanMessage, chatId, token, false);

      // Reply back to Telegram user as requested
      const replyText = `✅ ស្កែនជោគជ័យ!\n----------------------------------\n📦 លេខបៀល (Tracking): ${scannedCode}\n📱 លេខអ្នកទទួល (Receiver): ${receiverPhone || "⚠️ រកមិនឃើញ សូមបំពេញដោយដៃ"}\n----------------------------------\n📦 បានរក្សាទុកក្នុងប្រព័ន្ធ Web App ដោយស្វ័យប្រវត្តិ!\n#JT_PHOTO_SCAN_SUCCESS`;
      
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: replyText
        })
      });
    } else {
      // Failed to scan
      console.log(`[Telegram Photo Scan Failed] No QR/Barcode detected in image`);

      const failureText = "❌ រកមិនឃើញ QR/Barcode ទេ សូមផ្ញើរូបភាពច្បាស់ជាងនេះ។";

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: failureText
        })
      });
    }
  } catch (err: any) {
    console.error("Error processing Telegram photo message:", err);
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "❌ រកមិនឃើញ QR/Barcode ទេ សូមផ្ញើរូបភាពច្បាស់ជាងនេះ។"
        })
      });
    } catch (e) {}
  }
}

// Background Telegram Updates Poller to catch incoming 'scan:' messages and photos in real-time
async function pollTelegramUpdates() {
  try {
    const token = DEFAULT_BOT_TOKEN;
    if (!token) return;

    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${lastTelegramUpdateId + 1}&limit=20&allowed_updates=["message","channel_post"]`);
    const data = await res.json();

    if (!data.ok) {
      // Most common cause: a webhook is already registered for this bot (e.g. from the
      // deployed Netlify site), which blocks getUpdates with a 409 Conflict. Log it so it's
      // visible instead of the bot silently never receiving anything.
      console.error("[Telegram getUpdates failed]", data.error_code, data.description);
      return;
    }

    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        lastTelegramUpdateId = Math.max(lastTelegramUpdateId, update.update_id);
        const msg = update.message || update.channel_post;
        if (!msg) continue;

        const text = msg.text || msg.caption || "";
        const chatId = msg.chat?.id || DEFAULT_CHAT_ID;

        // Check if message contains photo
        if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
          const largestPhoto = msg.photo[msg.photo.length - 1];
          await processTelegramPhotoMessage(largestPhoto.file_id, chatId, token);
        } else if (text && /^scan:/i.test(text.trim())) {
          await processIncomingScanCommand(text, chatId, token);
        }
      }
    }
  } catch (err: any) {
    // Log instead of swallowing — a webhook conflict (409) or bad token is otherwise invisible
    console.error("[pollTelegramUpdates error]", err?.message || err);
  }
}

// Poll Telegram Bot updates every 3 seconds
setInterval(pollTelegramUpdates, 3000);

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

// API: Execute or simulate Telegram scan command directly via API
app.post("/api/telegram/scan", async (req, res) => {
  try {
    const text = req.body.message || req.body.text || "";
    const token = req.body.botToken || DEFAULT_BOT_TOKEN;
    const chatId = req.body.chatId || DEFAULT_CHAT_ID;

    if (!text) {
      return res.status(400).json({ success: false, error: "សូមវាយបញ្ចូលសារស្កែន (e.g. scan:TRACKING|PHONE)" });
    }

    const result = await processIncomingScanCommand(text, chatId, token);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to process scan command" });
  }
});

// API: Scan image buffer / Base64 image via POST request
app.post("/api/telegram/scan-image", async (req, res) => {
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
      await processIncomingScanCommand(receiverPhone ? `scan:${scannedText}|${receiverPhone}` : `scan:${scannedText}`);

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
});

// API: Telegram Webhook (In case webhook is set up on Telegram)
app.post("/api/telegram/webhook", async (req, res) => {
  try {
    const update = req.body;
    const msg = update?.message || update?.channel_post;
    if (msg) {
      const text = msg.text || msg.caption || "";
      const chatId = msg.chat?.id || DEFAULT_CHAT_ID;

      if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
        const largestPhoto = msg.photo[msg.photo.length - 1];
        await processTelegramPhotoMessage(largestPhoto.file_id, chatId, DEFAULT_BOT_TOKEN);
      } else if (text && /^scan:/i.test(text.trim())) {
        await processIncomingScanCommand(text, chatId, DEFAULT_BOT_TOKEN);
      }
    }
    return res.json({ ok: true });
  } catch (err: any) {
    return res.json({ ok: false, error: err.message });
  }
});

// API: Test Telegram Bot Connection
app.post("/api/telegram/test", async (req, res) => {
  try {
    const token = req.body.botToken || DEFAULT_BOT_TOKEN;
    const chatId = req.body.chatId || DEFAULT_CHAT_ID;

    // Call getMe
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData = await meRes.json();

    if (!meData.ok) {
      return res.status(400).json({ success: false, error: "Bot Token មិនត្រឹមត្រូវ ឬ មិនអាចភ្ជាប់ទៅ Telegram បានទេ", details: meData });
    }

    // Call getChat
    const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chatId)}`);
    const chatData = await chatRes.json();

    return res.json({
      success: true,
      bot: meData.result,
      chat: chatData.ok ? chatData.result : null,
      chatError: !chatData.ok ? chatData.description : null,
      message: "បានភ្ជាប់ទៅ Telegram Bot ដោយជោគជ័យ!"
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to connect to Telegram" });
  }
});

// API: Save Stock Data to Telegram
app.post("/api/telegram/save", async (req, res) => {
  try {
    const token = req.body.botToken || DEFAULT_BOT_TOKEN;
    const chatId = req.body.chatId || DEFAULT_CHAT_ID;
    const stockData = req.body.stockData;
    const note = req.body.note || "";

    if (!stockData) {
      return res.status(400).json({ success: false, error: "មិនមានទិន្នន័យសម្រាប់រក្សាទុក (No stock data provided)" });
    }

    serverStockData = stockData;
    serverLastUpdated = Date.now();

    const timestamp = new Date().toLocaleString("en-US", { timeZone: "Asia/Phnom_Penh" });
    const jsonString = JSON.stringify(stockData, null, 2);

    // Calculate summary statistics
    let totalArrived = 0;
    let totalToday = 0;
    let totalCOD = 0;
    let totalCC = 0;
    let recordedDaysCount = 0;

    Object.keys(stockData).forEach((d) => {
      const dayObj = stockData[d];
      if (!dayObj) return;
      if (dayObj.arrived) totalArrived += parseFloat(dayObj.arrived) || 0;
      let hasData = false;
      (dayObj.rows || []).forEach((r: any) => {
        if (r.today) totalToday += parseFloat(r.today) || 0;
        if (r.cod) totalCOD += parseFloat(r.cod) || 0;
        if (r.cc) totalCC += parseFloat(r.cc) || 0;
        if (r.tracking || r.receiverPhone) hasData = true;
      });
      if (hasData || dayObj.arrived) recordedDaysCount++;
    });

    const captionText = `📦 [ J&T DAILY STOCK BACKUP DATA ]
----------------------------------
📅 កាលបរិច្ឆេទរក្សាទុក: ${timestamp}
📊 ចំនួនថ្ងៃកត់ត្រា: ${recordedDaysCount} ថ្ងៃ
📦 ទំនិញមកដល់សរុប: ${totalArrived}
🚚 ប្រគល់ចេញថ្ងៃនេះសរុប: ${totalToday}
💵 សរុប COD: ${totalCOD.toLocaleString()} KHR
💳 សរុប CC Cash: ${totalCC.toLocaleString()} KHR
${note ? `📝 សំគាល់: ${note}\n` : ""}----------------------------------
#JT_STOCK_DATA_V1`;

    // 1. Send Text Summary Message (plain text, no parse_mode to prevent entity parsing errors)
    const msgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: captionText,
      }),
    });

    const msgResult = await msgRes.json();

    if (!msgResult.ok) {
      return res.status(400).json({
        success: false,
        error: `Telegram Error: ${msgResult.description || " មិនអាចផ្ញើសារទៅកាន់ Telegram បានទេ"}`,
        details: msgResult
      });
    }

    // 2. Send JSON file as Document using FormData
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("caption", `📄 ឯកសារទិន្នន័យស្តុក J&T (${timestamp}) #JT_STOCK_FILE`);
    
    const fileBlob = new Blob([jsonString], { type: "application/json" });
    formData.append("document", fileBlob, `jt_stock_backup_${Date.now()}.json`);

    const docRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: formData,
    });

    const docResult = await docRes.json();

    return res.json({
      success: true,
      message: "បានរក្សាទុកទិន្នន័យស្តុកទៅ Telegram ដោយជោគជ័យ!",
      textMessageId: msgResult.result?.message_id,
      documentMessageId: docResult.ok ? docResult.result?.message_id : null,
      timestamp,
    });
  } catch (err: any) {
    console.error("Save to Telegram error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to save stock data to Telegram" });
  }
});

// API: Sync/Fetch Latest Stock Data from Telegram Bot
app.post("/api/telegram/sync", async (req, res) => {
  try {
    const token = req.body.botToken || DEFAULT_BOT_TOKEN;
    const chatId = req.body.chatId || DEFAULT_CHAT_ID;

    // Fetch updates from Telegram Bot
    const updatesRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100&allowed_updates=["message","channel_post"]`);
    const updatesData = await updatesRes.json();

    if (!updatesData.ok) {
      return res.status(400).json({
        success: false,
        error: `Telegram Error: ${updatesData.description || "មិនអាចទាញយកទិន្នន័យពី Telegram ទេ"}`,
      });
    }

    const updates = updatesData.result || [];
    let foundDoc: any = null;
    let foundMessageDate: number | null = null;

    // Search backwards for the latest message with document ending in .json or caption #JT_STOCK_FILE / #JT_STOCK_DATA_V1
    for (let i = updates.length - 1; i >= 0; i--) {
      const msg = updates[i].message || updates[i].channel_post;
      if (!msg) continue;

      if (msg.document && (msg.document.file_name?.includes("jt_stock_backup") || msg.document.mime_type === "application/json" || (msg.caption && msg.caption.includes("#JT_STOCK_FILE")))) {
        foundDoc = msg.document;
        foundMessageDate = msg.date;
        break;
      }
    }

    if (!foundDoc) {
      return res.status(404).json({
        success: false,
        error: "រកមិនឃើញឯកសារទិន្នន័យស្តុកចុងក្រោយ (#JT_STOCK_FILE) នៅក្នុង Telegram Updates ទេ។ សូមចុច 'រក្សាទុក (Save)' ជាមុនសិន។",
      });
    }

    // Get file path from Telegram
    const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${foundDoc.file_id}`);
    const fileData = await fileRes.json();

    if (!fileData.ok || !fileData.result?.file_path) {
      return res.status(400).json({ success: false, error: "មិនអាចយកទីតាំងឯកសារពី Telegram ទេ" });
    }

    // Download content from Telegram CDN
    const downloadRes = await fetch(`https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`);
    const stockJsonText = await downloadRes.text();
    const parsedStockData = JSON.parse(stockJsonText);

    serverStockData = parsedStockData;
    serverLastUpdated = Date.now();

    const savedDateStr = foundMessageDate ? new Date(foundMessageDate * 1000).toLocaleString("en-US", { timeZone: "Asia/Phnom_Penh" }) : "N/A";

    return res.json({
      success: true,
      message: "បានទាញយកទិន្នន័យស្តុក (Sync) ពី Telegram ដោយជោគជ័យ!",
      stockData: parsedStockData,
      dateSaved: savedDateStr,
      fileName: foundDoc.file_name,
    });
  } catch (err: any) {
    console.error("Sync from Telegram error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to sync stock data from Telegram" });
  }
});

async function startServer() {
  // If a webhook is registered for this bot (e.g. previously set for the Netlify deployment),
  // getUpdates() will fail with a silent-looking 409 Conflict and the bot will never respond.
  // Clear it so long-polling always works, whichever environment this instance runs in.
  if (DEFAULT_BOT_TOKEN) {
    try {
      const delRes = await fetch(`https://api.telegram.org/bot${DEFAULT_BOT_TOKEN}/deleteWebhook?drop_pending_updates=false`);
      const delData = await delRes.json();
      console.log("[Telegram] deleteWebhook:", delData.ok ? "ok" : delData.description);
    } catch (err: any) {
      console.error("[Telegram] deleteWebhook failed:", err.message);
    }
  }

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

