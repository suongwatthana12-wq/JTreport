/**
 * Telegram Bot Barcode & QR Code Scanner Script (Node.js)
 * 
 * របៀបដំឡើង និង Run នៅលើ Server / Node.js ៖
 * 1. Install Dependencies:
 *    npm install node-telegram-bot-api @zxing/library jimp axios dotenv
 * 
 * 2. បង្កើតឯកសារ .env៖
 *    TELEGRAM_BOT_TOKEN=7960736598:AAG9VNlHrjS3gOy-QrRlS4FTQB2anDMBaak
 *    WEBAPP_API_URL=https://your-domain.com/api/stock
 * 
 * 3. ដំណើរការ Script:
 *    node telegram_bot_barcode.js
 */

const TelegramBot = require('node-telegram-bot-api');
const ZXingModule = require('@zxing/library');
const ZXing = ZXingModule.default || ZXingModule;
const { MultiFormatReader, RGBLuminanceSource, BinaryBitmap, HybridBinarizer, BarcodeFormat, DecodeHintType } = ZXing;
const { Jimp } = require('jimp');
const axios = require('axios');
require('dotenv').config();

// 1. កំណត់ Telegram Bot Token និង Web App API Endpoint
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7960736598:AAG9VNlHrjS3gOy-QrRlS4FTQB2anDMBaak';
const WEBAPP_API_URL = process.env.WEBAPP_API_URL || 'https://your-app-domain.com/api/telegram/scan';

// បង្កើត Bot Instance (Polling Mode)
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

console.log('🚀 Telegram Barcode & QR Code Bot ត្រូវបានដំណើរការរួចរាល់...');

/**
 * Function សម្រាប់ស្កែនអាន Barcode (Code 128) និង QR Code ពីរូបភាព (Buffer)
 */
async function scanBarcodeFromImageBuffer(imageBuffer) {
  try {
    const image = await Jimp.read(imageBuffer);
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    const length = width * height;
    const luminances = new Uint8ClampedArray(length);

    const data = image.bitmap.data;
    for (let i = 0; i < length; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      luminances[i] = (r * 30 + g * 59 + b * 11) / 100;
    }

    const luminanceSource = new RGBLuminanceSource(luminances, width, height);
    const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.CODE_39,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.ITF,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.CODABAR,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new MultiFormatReader();
    reader.setHints(hints);

    const result = reader.decode(binaryBitmap);
    return result.getText() || null;
  } catch (err) {
    // Retry with grayscale processing if standard decoding fails
    try {
      const image = await Jimp.read(imageBuffer);
      image.greyscale();
      const width = image.bitmap.width;
      const height = image.bitmap.height;
      const length = width * height;
      const luminances = new Uint8ClampedArray(length);
      const data = image.bitmap.data;
      for (let i = 0; i < length; i++) {
        luminances[i] = data[i * 4];
      }

      const luminanceSource = new RGBLuminanceSource(luminances, width, height);
      const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.CODE_39,
        BarcodeFormat.EAN_13,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new MultiFormatReader();
      reader.setHints(hints);

      const result = reader.decode(binaryBitmap);
      return result.getText() || null;
    } catch (e2) {
      return null;
    }
  }
}

/**
 * Function គំរូសម្រាប់បញ្ជូនទិន្នន័យ (API POST Request) ទៅកាន់ Database ឬ Web App
 */
async function sendScannedDataToDatabase(scannedData, chatId) {
  try {
    const payload = {
      message: `scan:${scannedData}`,
      chatId: chatId,
      scannedAt: new Date().toISOString()
    };

    console.log(`📡 កំពុងផ្ញើ POST Request ទៅ API: ${WEBAPP_API_URL}`, payload);

    const response = await axios.post(WEBAPP_API_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });

    console.log('✅ API Response Success:', response.data);
    return response.data;
  } catch (error) {
    console.error('⚠️ API POST Request Failed:', error.message);
    return null;
  }
}

/**
 * 2. ទទួលយករូបភាព (Photo) ដែល User ផ្ញើចូល Telegram ChatBot
 */
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;

  try {
    // បង្ហាញការងារកំពុងដំណើរការទៅកាន់ User
    await bot.sendMessage(chatId, '🔍 កំពុងទាញយក និងស្កែនអាន QR / Barcode ចេញពីរូបភាព...');

    // ជ្រើសរើសរូបភាពដែលមានទំហំច្បាស់ជាងគេ (រូបភាពចុងក្រោយគេក្នុង Array)
    const photoArray = msg.photo;
    const largestPhoto = photoArray[photoArray.length - 1];
    const fileId = largestPhoto.file_id;

    // ទាញយក Stream ឬ Buffer នៃរូបភាពតាមរយៈ Telegram API
    const fileStream = bot.getFileStream(fileId);
    const chunks = [];
    for await (const chunk of fileStream) {
      chunks.push(chunk);
    }
    const imageBuffer = Buffer.concat(chunks);

    // 3. ស្កែនរក QR Code / Barcode ក្នុងរូបភាព
    const scannedCode = await scanBarcodeFromImageBuffer(imageBuffer);

    if (scannedCode) {
      // 4. ប្រសិនបើស្កែនឃើញ ៖
      console.log(`✅ ស្កែនឃើញទិន្នន័យ: ${scannedCode}`);

      // ផ្ញើសារបកប្រាប់ User វិញ
      const successMessage = `✅ ស្កែនជោគជ័យ! លេខវ៉េវ៖ ${scannedCode}`;
      await bot.sendMessage(chatId, successMessage);

      // បញ្ជូនទិន្នន័យ (API POST Request) ទៅកាន់ Database / Web App
      await sendScannedDataToDatabase(scannedCode, chatId);

    } else {
      // 5. ប្រសិនបើស្កែនមិនឃើញ ឬរូបមិនច្បាស់ ៖
      const failMessage = `❌ រកមិនឃើញ QR/Barcode ទេ សូមផ្ញើរូបភាពច្បាស់ជាងនេះ។`;
      await bot.sendMessage(chatId, failMessage);
    }

  } catch (error) {
    console.error('❌ Error processing photo message:', error);
    await bot.sendMessage(chatId, '❌ រកមិនឃើញ QR/Barcode ទេ សូមផ្ញើរូបភាពច្បាស់ជាងនេះ។');
  }
});

// ឆ្លើយតបសារអក្សរធម្មតា /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `👋 សួស្តី! សូមផ្ញើរូបថតកញ្ចប់អីវ៉ាន់ ឬរូបភាព Barcode/QR Code មកកាន់ Bot នេះដើម្បីស្កែនស្វ័យប្រវត្តិ។`);
});
