"""
Telegram Bot Barcode & QR Code Scanner Script (Python)
------------------------------------------------------
លោកអ្នកអាចយក Script នេះទៅ Run លើ Linux Server (VPS, Ubuntu, DigitalOcean) ឬ Heroku / Cloud Host ផ្សេងៗបាន។

📦 របៀបដំឡើង (Installation):
1. ដំឡើង System Dependencies (សម្រាប់ pyzbar អាន Barcode / Code 128)៖
   sudo apt-get update && sudo apt-get install -y libzbar0

2. ដំឡើង Python Packages ៖
   pip install pyTelegramBotAPI pyzbar Pillow requests opencv-python-headless

3. បង្កើតឯកសារ .env ឬ Set Environment Variables ៖
   export TELEGRAM_BOT_TOKEN="7960736598:AAG9VNlHrjS3gOy-QrRlS4FTQB2anDMBaak"
   export WEBAPP_API_URL="https://your-app-domain.com/api/telegram/scan"

4. ដំណើរការ Script (Run Bot) ៖
   python telegram_bot_barcode.py
"""

import os
import io
import logging
import requests
import telebot
from PIL import Image
from pyzbar.pyzbar import decode as decode_barcodes
import cv2
import numpy as np

# កំណត់ Logging សម្រាប់តាមដានព័ត៌មាន
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# 1. កំណត់ Telegram Bot Token និង Web App API URL
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "7960736598:AAG9VNlHrjS3gOy-QrRlS4FTQB2anDMBaak")
WEBAPP_API_URL = os.getenv("WEBAPP_API_URL", "https://your-app-domain.com/api/telegram/scan")

bot = telebot.TeleBot(TELEGRAM_BOT_TOKEN)

logging.info("🚀 Python Telegram Barcode & QR Code Bot ត្រូវបានចាប់ផ្តើម...")


def scan_barcode_or_qr(image_bytes: bytes) -> str | None:
    """
    អាន Barcode (Code 128, Code 39, EAN, etc.) និង QR Code ចេញពីរូបភាព
    ប្រើប្រាស់ pyzbar រួមជាមួយ OpenCV fallback សម្រាប់ការអានកាន់តែច្បាស់
    """
    try:
        # បំប្លែងរូបភាពទៅជា PIL Image
        pil_image = Image.open(io.BytesIO(image_bytes))

        # 1. ស្កែនជាដំបូងជាមួយ pyzbar
        decoded_objects = decode_barcodes(pil_image)
        if decoded_objects:
            scanned_text = decoded_objects[0].data.decode("utf-8").strip()
            if scanned_text:
                return scanned_text

        # 2. ប្រសិនបើស្កែនមិនទាន់ឃើញ បំប្លែងទៅជា OpenCV Image (Grayscale + Thresholding) ដើម្បីបង្កើនភាពច្បាស់
        nparr = np.frombuffer(image_bytes, np.uint8)
        cv_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if cv_img is not None:
            gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)

            # Try decoding grayscale
            decoded_gray = decode_barcodes(gray)
            if decoded_gray:
                scanned_text = decoded_gray[0].data.decode("utf-8").strip()
                if scanned_text:
                    return scanned_text

            # OpenCV QR Code Detector Fallback
            qr_detector = cv2.QRCodeDetector()
            val, pts, _ = qr_detector.detectAndDecode(gray)
            if val and val.strip():
                return val.strip()

    except Exception as e:
        logging.error(f"Error decoding image: {e}")

    return None


def send_scanned_data_to_api(scanned_data: str, chat_id: int) -> bool:
    """
    Function គំរូសម្រាប់បញ្ជូនទិន្នន័យ (API POST Request) ទៅកាន់ Database ឬ Web App លើ Netlify
    """
    try:
        payload = {
            "tracking": scanned_data,
            "message": f"scan:{scanned_data}",
            "chatId": chat_id,
            "source": "telegram_python_bot"
        }

        logging.info(f"📡 កំពុងផ្ញើ POST Request ទៅ API: {WEBAPP_API_URL}")
        
        response = requests.post(
            WEBAPP_API_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )

        if response.status_code in [200, 201]:
            logging.info(f"✅ API POST Success: {response.text}")
            return True
        else:
            logging.warning(f"⚠️ API Response Status: {response.status_code}")
            return False

    except Exception as e:
        logging.error(f"❌ API POST Request Failed: {e}")
        return False


@bot.message_handler(commands=['start', 'help'])
def send_welcome(message):
    welcome_text = (
        "👋 សួស្តី! ខ្ញុំជា Telegram Bot សម្រាប់ស្កែនអាន Barcode និង QR Code លើកញ្ចប់អីវ៉ាន់។\n\n"
        "📷 សូមផ្ញើរូបថតកញ្ចប់អីវ៉ាន់ ឬរូប Barcode/QR Code មកកាន់ខ្ញុំដើម្បីស្កែនដោយស្វ័យប្រវត្តិ!"
    )
    bot.reply_to(message, welcome_text)


@bot.message_handler(content_types=['photo'])
def handle_photo(message):
    """
    ទទួលយករូបភាពពី User -> ទាញយករូប -> ស្កែន -> ផ្ញើសារបកប្រាប់ User -> បញ្ជូនទៅ API
    """
    chat_id = message.chat.id

    try:
        bot.send_message(chat_id, "🔍 កំពុងទាញយក និងស្កែនអាន QR / Barcode ចេញពីរូបភាព...")

        # ជ្រើសរើសរូបភាពដែលមានទំហំច្បាស់ជាងគេ (រូបភាពចុងក្រោយក្នុង Array)
        file_info = bot.get_file(message.photo[-1].file_id)
        downloaded_bytes = bot.download_file(file_info.file_path)

        # ស្កែនអានទិន្នន័យ Barcode / QR Code
        scanned_data = scan_barcode_or_qr(downloaded_bytes)

        if scanned_data:
            logging.info(f"✅ ស្កែនឃើញទិន្នន័យ: {scanned_data}")

            # 1. ផ្ញើសារបកប្រាប់ User ថាស្កែនជោគជ័យ
            success_msg = f"✅ ស្កែនជោគជ័យ! លេខវ៉េវ៖ {scanned_data}"
            bot.reply_to(message, success_msg)

            # 2. បញ្ជូនទិន្នន័យ (API POST Request) ទៅកាន់ Database / Web App លើ Netlify
            send_scanned_data_to_api(scanned_data, chat_id)

        else:
            # 3. ប្រសិនបើស្កែនមិនឃើញ ឬរូបមិនច្បាស់
            logging.warning("❌ រកមិនឃើញ QR/Barcode ទេ")
            fail_msg = "❌ រកមិនឃើញ QR/Barcode ទេ សូមផ្ញើរូបភាពច្បាស់ជាងនេះ។"
            bot.reply_to(message, fail_msg)

    except Exception as e:
        logging.error(f"Error handling photo: {e}")
        fail_msg = "❌ រកមិនឃើញ QR/Barcode ទេ សូមផ្ញើរូបភាពច្បាស់ជាងនេះ human error."
        bot.reply_to(message, fail_msg)


if __name__ == "__main__":
    # ដំណើរការ Bot ក្នុង Polling Mode
    bot.infinity_polling()
