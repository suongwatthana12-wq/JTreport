import React, { useState, useEffect, useMemo, useRef, useCallback, KeyboardEvent } from "react";
import {
  Search,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  PackageSearch,
  ClipboardList,
  Plus,
  Trash2,
  BarChart2,
  Table,
  Coins,
  RotateCcw,
  Download,
  Calendar,
  Send,
  CloudDownload,
  CloudUpload,
  Settings,
  Bot,
  Loader2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  FileUp
} from "lucide-react";

const DAY_COUNT = 31;
const DEFAULT_ROWS = 31;
const STORAGE_KEY = "jt-daily-report-v1";
const TELEGRAM_TOKEN_KEY = "jt-telegram-token";
const TELEGRAM_CHAT_KEY = "jt-telegram-chatid";

const DEFAULT_BOT_TOKEN = "";
const DEFAULT_CHAT_ID = "@my_stock_db_2026";

const COLUMNS = [
  { key: "ret", label: "ត្រឡប់", type: "number", widthClass: "w-[55px] min-w-[55px]" },
  { key: "reloc", label: "ប្តូរទីតាំង", type: "number", widthClass: "w-[68px] min-w-[68px]" },
  { key: "sent", label: "ផ្ញើចេញ", type: "number", widthClass: "w-[55px] min-w-[55px]" },
  { key: "prevday", label: "ថ្ងៃមុន", type: "number", widthClass: "w-[55px] min-w-[55px]" },
  { key: "today", label: "ថ្ងៃនេះ", type: "number", widthClass: "w-[55px] min-w-[55px]" },
  { key: "tracking", label: "លេខបៀល", type: "text", mono: true, widthClass: "w-[145px] min-w-[145px]" },
  { key: "receiverPhone", label: "លេខអ្នកទទួល", type: "text", mono: true, widthClass: "w-[145px] min-w-[145px]" },
  { key: "senderPhone", label: "លេខអ្នកផ្ញើ", type: "text", mono: true, widthClass: "w-[135px] min-w-[135px]" },
  { key: "cc", label: "CC-Cash", type: "number", widthClass: "w-[85px] min-w-[85px]" },
  { key: "cod", label: "COD KHR", type: "number", widthClass: "w-[105px] min-w-[105px]" },
  { key: "issue", label: "បញ្ហារ", type: "text", widthClass: "w-[140px] min-w-[140px]" },
  { key: "other", label: "ផ្សេងៗ", type: "text", widthClass: "w-[115px] min-w-[115px]" },
];

const NUMBER_KEYS = ["ret", "reloc", "sent", "prevday", "today", "cc", "cod"];

const TOGGLE_KEYS = ["ret", "reloc", "sent", "prevday", "today"];

const ISSUE_OPTIONS = [
  "យកទុកឲ្យ",
  "បានទទួលហើយ",
  "មិនលើក",
  "បដិសេធ",
  "ប្តូរទីតាំង",
  "លេខមិនត្រឹមត្រូវ",
  "ត្រឡប់សាខាដើម",
];

export interface ReportRow {
  ret: string;
  reloc: string;
  sent: string;
  prevday: string;
  today: string;
  tracking: string;
  receiverPhone: string;
  senderPhone: string;
  cc: string;
  cod: string;
  issue: string;
  other: string;
}

export interface DayData {
  arrived: string;
  prevMonthLeftover: string;
  rows: ReportRow[];
}

export type MonthData = Record<string, DayData>;

function emptyRow(): ReportRow {
  return {
    ret: "",
    reloc: "",
    sent: "",
    prevday: "",
    today: "",
    tracking: "",
    receiverPhone: "",
    senderPhone: "",
    cc: "",
    cod: "",
    issue: "",
    other: "",
  };
}

function emptyDay(): DayData {
  return {
    arrived: "",
    prevMonthLeftover: "",
    rows: Array.from({ length: DEFAULT_ROWS }, emptyRow),
  };
}

function emptyState(): MonthData {
  const s: MonthData = {};
  for (let d = 1; d <= DAY_COUNT; d++) s[d] = emptyDay();
  return s;
}

// Initial Seed Data
const SEED_DATA: Partial<Record<string, { arrived: string; prevMonthLeftover: string; rows: Partial<ReportRow>[] }>> = {
  "1": {
    "arrived": "16",
    "prevMonthLeftover": "10",
    "rows": [
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "5677714", "receiverPhone": "966997172", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "2040883", "receiverPhone": "972820154", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "1791863", "receiverPhone": "92851515", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "1197981", "receiverPhone": "976123498", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "2594686", "receiverPhone": "11366292", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "1289053", "receiverPhone": "964033468", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "1747917", "receiverPhone": "12931854", "senderPhone": "", "cc": "", "cod": "40000", "issue": "", "other": "cod" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "3031890", "receiverPhone": "714900758", "senderPhone": "", "cc": "", "cod": "", "issue": "អត់លើក", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "2712095", "receiverPhone": "889170068", "senderPhone": "", "cc": "", "cod": "35000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "8948112", "receiverPhone": "962806318", "senderPhone": "", "cc": "", "cod": "", "issue": "អត់លើក", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "2527141", "receiverPhone": "10249154", "senderPhone": "", "cc": "5500", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "832033", "receiverPhone": "15445391", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "303327", "receiverPhone": "87308795", "senderPhone": "", "cc": "", "cod": "", "issue": "អត់លើក", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "9713741", "receiverPhone": "963909688", "senderPhone": "", "cc": "", "cod": "60000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "2622307", "receiverPhone": "77551143", "senderPhone": "", "cc": "", "cod": "60000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "1", "today": "", "tracking": "501345", "receiverPhone": "", "senderPhone": "", "cc": "", "cod": "40000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "1", "today": "", "tracking": "6966767", "receiverPhone": "", "senderPhone": "", "cc": "", "cod": "82000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "1", "today": "", "tracking": "2089852", "receiverPhone": "", "senderPhone": "", "cc": "", "cod": "32000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "2675679", "receiverPhone": "15284477", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "1", "today": "", "tracking": "2851497", "receiverPhone": "", "senderPhone": "", "cc": "6000", "cod": "", "issue": "", "other": "" }
    ]
  },
  "2": {
    "arrived": "27",
    "prevMonthLeftover": "",
    "rows": [
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "4266047", "receiverPhone": "93938674", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "4536686", "receiverPhone": "93938674", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "1919018", "receiverPhone": "10630021", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "1626253", "receiverPhone": "69704333", "senderPhone": "", "cc": "8200", "cod": "", "issue": "", "other": "2026-03-07 00:00:00" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "2834271", "receiverPhone": "98423222", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "9475132", "receiverPhone": "85356776", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "1464000", "receiverPhone": "69232317", "senderPhone": "", "cc": "", "cod": "", "issue": "អត់លើក", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "8536859", "receiverPhone": "61702173", "senderPhone": "", "cc": "5500", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "1731505", "receiverPhone": "70214526", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "9092363", "receiverPhone": "93711754", "senderPhone": "", "cc": "", "cod": "", "issue": "យកទុកឲ្យ", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "2960907", "receiverPhone": "86389198", "senderPhone": "", "cc": "8200", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "2325083", "receiverPhone": "87220071", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "2026-03-07 00:00:00" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "5496698", "receiverPhone": "966509681", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "2720330", "receiverPhone": "99697058", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "6926276", "receiverPhone": "966130809", "senderPhone": "", "cc": "", "cod": "38000", "issue": "", "other": "cod" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "9773401", "receiverPhone": "969975479", "senderPhone": "", "cc": "", "cod": "60000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "8324796", "receiverPhone": "319020337", "senderPhone": "", "cc": "", "cod": "", "issue": "អត់លើក", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "9395298", "receiverPhone": "98423222", "senderPhone": "", "cc": "", "cod": "200000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "3707371", "receiverPhone": "98808057", "senderPhone": "", "cc": "", "cod": "112000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "3832223", "receiverPhone": "965476343", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "2341565", "receiverPhone": "93868313", "senderPhone": "", "cc": "", "cod": "32800", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "3412305", "receiverPhone": "60943151", "senderPhone": "", "cc": "", "cod": "25000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "3144817", "receiverPhone": "99282688", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "2478575", "receiverPhone": "95252610", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "1", "sent": "", "prevday": "", "today": "", "tracking": "6514717", "receiverPhone": "712963962", "senderPhone": "", "cc": "", "cod": "", "issue": "ប្តូអាសយដ្ឋាន", "other": "ស្តៅ" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "3786151", "receiverPhone": "10925984", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "2698304", "receiverPhone": "886137186", "senderPhone": "", "cc": "", "cod": "42000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "1", "today": "", "tracking": "8948112", "receiverPhone": "", "senderPhone": "", "cc": "", "cod": "39000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "1", "today": "", "tracking": "2675679", "receiverPhone": "", "senderPhone": "", "cc": "", "cod": "52000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "1", "today": "", "tracking": "832033", "receiverPhone": "", "senderPhone": "", "cc": "", "cod": "40000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "1", "prevday": "", "today": "", "tracking": "8120674", "receiverPhone": "95756263", "senderPhone": "86373233", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "1", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "1250683", "receiverPhone": "", "senderPhone": "", "cc": "", "cod": "", "issue": "ត្រឡប់ទៅសាខាដើម", "other": "" },
      { "ret": "1", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "845767", "receiverPhone": "", "senderPhone": "", "cc": "", "cod": "", "issue": "ត្រឡប់ទៅសាខាដើម", "other": "" },
      { "ret": "1", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "303327", "receiverPhone": "", "senderPhone": "", "cc": "", "cod": "", "issue": "ត្រឡប់ទៅសាខាដើម", "other": "" },
      { "ret": "1", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "1555938", "receiverPhone": "", "senderPhone": "", "cc": "", "cod": "", "issue": "ត្រឡប់ទៅសាខាដើម", "other": "" },
      { "ret": "1", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "2406478", "receiverPhone": "", "senderPhone": "", "cc": "", "cod": "", "issue": "ត្រឡប់ទៅសាខាដើម", "other": "" }
    ]
  },
  "3": {
    "arrived": "17",
    "prevMonthLeftover": "",
    "rows": [
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "3952994", "receiverPhone": "963555937", "senderPhone": "", "cc": "", "cod": "", "issue": "យកទុកឲ្យ", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "3616136", "receiverPhone": "963680880", "senderPhone": "", "cc": "", "cod": "", "issue": "យកទុកឲ្យ", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "3632036", "receiverPhone": "85574657", "senderPhone": "", "cc": "6000", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "978146", "receiverPhone": "963525508", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "3558709", "receiverPhone": "969057927", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "8002767", "receiverPhone": "96686877", "senderPhone": "", "cc": "", "cod": "", "issue": "លេខគ្មានក្នុងប្រព័ន្ធ", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "305316", "receiverPhone": "78660834", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "9265415", "receiverPhone": "61776750", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "2382676", "receiverPhone": "963680880", "senderPhone": "", "cc": "", "cod": "យកទុកឲ្យ", "issue": "យកទុកឲ្យ", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "3051818", "receiverPhone": "90545494", "senderPhone": "", "cc": "", "cod": "32000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "4845809", "receiverPhone": "78667271", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "3412207", "receiverPhone": "78991237", "senderPhone": "", "cc": "", "cod": "80000", "issue": "", "other": "cod" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "1401117", "receiverPhone": "98644057", "senderPhone": "", "cc": "", "cod": "", "issue": "បដិសេដ", "other": "បានទទួលម្តងហើយ" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "8161907", "receiverPhone": "768349051", "senderPhone": "", "cc": "", "cod": "40000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "3445893", "receiverPhone": "12265765", "senderPhone": "", "cc": "", "cod": "", "issue": "បដិសេដ", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "7452287", "receiverPhone": "95929906", "senderPhone": "", "cc": "", "cod": "48000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "3361788", "receiverPhone": "979269201", "senderPhone": "", "cc": "", "cod": "28000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "1", "today": "", "tracking": "1464000", "receiverPhone": "", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "1", "today": "", "tracking": "8324796", "receiverPhone": "", "senderPhone": "", "cc": "", "cod": "80000", "issue": "", "other": "" },
      { "ret": "1", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "9890367", "receiverPhone": "", "senderPhone": "", "cc": "", "cod": "", "issue": "ត្រឡប់ទៅសាខាដើម", "other": "" }
    ]
  },
  "4": {
    "arrived": "12",
    "prevMonthLeftover": "",
    "rows": [
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "4240689", "receiverPhone": "16984556", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "2026-05-07 00:00:00" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "4702616", "receiverPhone": "12732117", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "3732165", "receiverPhone": "85356776", "senderPhone": "", "cc": "5500", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "1", "sent": "", "prevday": "", "today": "", "tracking": "9294287", "receiverPhone": "60381997", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "2588618", "receiverPhone": "965557675", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "1274301", "receiverPhone": "17444459", "senderPhone": "", "cc": "", "cod": "82000", "issue": "", "other": "cod" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "1669395", "receiverPhone": "92851515", "senderPhone": "", "cc": "", "cod": "40000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "4179782", "receiverPhone": "16676717", "senderPhone": "", "cc": "", "cod": "32000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "9042855", "receiverPhone": "87308626", "senderPhone": "", "cc": "", "cod": "70000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "2741965", "receiverPhone": "717222381", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "2242530", "receiverPhone": "888764182", "senderPhone": "", "cc": "", "cod": "40000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "2892471", "receiverPhone": "717504293", "senderPhone": "", "cc": "", "cod": "140000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "1", "today": "", "tracking": "8002767", "receiverPhone": "", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "1", "today": "", "tracking": "2478575", "receiverPhone": "", "senderPhone": "", "cc": "", "cod": "48000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "1", "today": "", "tracking": "3832223", "receiverPhone": "", "senderPhone": "", "cc": "", "cod": "28000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "1", "prevday": "", "today": "", "tracking": "4790031", "receiverPhone": "92990911", "senderPhone": "93368701", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "1", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "356931", "receiverPhone": "", "senderPhone": "", "cc": "", "cod": "", "issue": "ត្រឡប់ទៅសាខាដើម", "other": "" },
      { "ret": "", "reloc": "", "sent": "1", "prevday": "", "today": "", "tracking": "4954342", "receiverPhone": "976140733", "senderPhone": "967457700", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "1", "prevday": "", "today": "", "tracking": "3938456", "receiverPhone": "886686126", "senderPhone": "86373233", "cc": "", "cod": "", "issue": "", "other": "" }
    ]
  },
  "5": {
    "arrived": "21",
    "prevMonthLeftover": "",
    "rows": [
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "5223668", "receiverPhone": "92959541", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "2851315", "receiverPhone": "966161443", "senderPhone": "", "cc": "5500", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "122354", "receiverPhone": "81797907", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "4724456", "receiverPhone": "319020337", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "5103471", "receiverPhone": "16616178", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "2026-06-07 00:00:00" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "4343885", "receiverPhone": "972561504", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "3899901", "receiverPhone": "886971713", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "488925", "receiverPhone": "972072241", "senderPhone": "", "cc": "", "cod": "", "issue": "ប្តូអាសយដ្ឋាន", "other": "តាប៉ុន" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "3581615", "receiverPhone": "98535310", "senderPhone": "", "cc": "", "cod": "", "issue": "យកទុកឲ្យ", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "4007974", "receiverPhone": "968820937", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "26686385", "receiverPhone": "965476343", "senderPhone": "", "cc": "", "cod": "", "issue": "យកទុកឲ្យ", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "124310", "receiverPhone": "969000017", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "1185393", "receiverPhone": "77539453", "senderPhone": "", "cc": "", "cod": "", "issue": "អត់លើក", "other": "cod" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "1", "tracking": "5190165", "receiverPhone": "15996144", "senderPhone": "", "cc": "", "cod": "56000", "issue": "", "other": "" },
      { "ret": "", "reloc": "", "sent": "", "prevday": "", "today": "", "tracking": "9697087", "receiverPhone": "10925984", "senderPhone": "", "cc": "", "cod": "", "issue": "", "other": "" }
    ]
  }
};

function parseVal(val: string | number | boolean | undefined): number {
  if (!val) return 0;
  if (val === "1" || val === 1 || val === "✓" || val === "true" || val === true) return 1;
  const num = parseFloat(String(val).replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
}

// Auto zero-pad a tracking number typed against a known prefix template:
//  - "J" + batch code (0135–0141) + up to 7 sequence digits → sequence digits are
//    right-aligned and padded with leading zeros to 7 digits (e.g. "J013723349" → "J01370023349").
//  - "TBKHJ" + up to 9 sequence digits → padded to 9 digits the same way.
// If the user typed ONLY digits (no letter prefix) and a "sticky" lastPrefix is supplied (the
// prefix last used in another row), it's prepended first — so after picking a prefix once, later
// rows only need the trailing digits.
// Values that don't match any known template are returned unchanged.
function formatTrackingNumber(raw: string, lastPrefix?: string): string {
  let val = raw.trim().toUpperCase();
  if (!val) return "";

  if (lastPrefix && /^\d{1,9}$/.test(val)) {
    val = lastPrefix + val;
  }

  const jMatch = val.match(/^J(\d{4})(\d{0,10})$/);
  if (jMatch) {
    const prefixCode = jMatch[1];
    const seq = jMatch[2];

    if (!seq) {
      return `J${prefixCode}`;
    }

    if (seq.length >= 7) {
      return `J${prefixCode}${seq}`;
    }

    return `J${prefixCode}${seq.padStart(7, "0")}`;
  }

  const tbkhjMatch = val.match(/^TBKHJ(\d{0,12})$/);
  if (tbkhjMatch) {
    const seq = tbkhjMatch[1];
    if (!seq) return "TBKHJ";
    if (seq.length >= 9) return `TBKHJ${seq}`;
    return `TBKHJ${seq.padStart(9, "0")}`;
  }

  return raw;
}

// Extract just the prefix portion (e.g. "J0137" or "TBKHJ") from an already-formatted tracking
// number, used to remember the "sticky" prefix for the next row.
function extractTrackingPrefix(formatted: string): string {
  const match = formatted.trim().toUpperCase().match(/^(J\d{4}|TBKHJ)/);
  return match ? match[1] : "";
}

// Adjust tracking prefix by incrementing or decrementing the head batch number (e.g. J0138 -> J0139 or J0137)
function adjustTrackingPrefix(currentVal: string, direction: "up" | "down", lastPrefix?: string): string {
  const val = currentVal.trim().toUpperCase();

  if (!val) {
    const base = (lastPrefix && /^J\d{3,4}$/.test(lastPrefix)) ? lastPrefix : "J0138";
    const letter = base.match(/^[A-Z]+/)?.[0] || "J";
    const numStr = base.match(/\d+/)?.[0] || "0138";
    const num = parseInt(numStr, 10);
    const newNum = direction === "up" ? num + 1 : Math.max(0, num - 1);
    const newNumStr = String(newNum).padStart(numStr.length, "0");
    return `${letter}${newNumStr}`;
  }

  const match = val.match(/^([A-Z]+)(\d{3,4})(.*)$/);
  if (match) {
    const letter = match[1];
    const numStr = match[2];
    const rest = match[3];
    const num = parseInt(numStr, 10);
    const newNum = direction === "up" ? num + 1 : Math.max(0, num - 1);
    const newNumStr = String(newNum).padStart(numStr.length, "0");
    return `${letter}${newNumStr}${rest}`;
  }

  if (/^\d+$/.test(val)) {
    const base = (lastPrefix && /^J\d{3,4}$/.test(lastPrefix)) ? lastPrefix : "J0138";
    const letter = base.match(/^[A-Z]+/)?.[0] || "J";
    const numStr = base.match(/\d+/)?.[0] || "0138";
    const num = parseInt(numStr, 10);
    const newNum = direction === "up" ? num + 1 : Math.max(0, num - 1);
    const newNumStr = String(newNum).padStart(numStr.length, "0");
    return `${letter}${newNumStr}${val}`;
  }

  return currentVal;
}

function mergeWithDefaults(savedData: MonthData | null): MonthData {
  const full = emptyState();
  if (!savedData) return full;
  for (let d = 1; d <= DAY_COUNT; d++) {
    const key = String(d);
    if (savedData[key]) {
      full[d].arrived = savedData[key].arrived || "";
      full[d].prevMonthLeftover = savedData[key].prevMonthLeftover || "";
      const rows = savedData[key].rows || [];
      const updatedRows = rows.map((r) => ({ ...emptyRow(), ...r }));
      while (updatedRows.length < DEFAULT_ROWS) {
        updatedRows.push(emptyRow());
      }
      full[d].rows = updatedRows;
    }
  }
  return full;
}

export default function DailyReportApp() {
  const [data, setData] = useState<MonthData>(() => {
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) return mergeWithDefaults(JSON.parse(local));
    } catch (e) {
      console.error("Error loading localStorage data", e);
    }
    return mergeWithDefaults(SEED_DATA as MonthData);
  });

  // Telegram States
  const [botToken, setBotToken] = useState<string>(() => {
    return localStorage.getItem(TELEGRAM_TOKEN_KEY) || DEFAULT_BOT_TOKEN;
  });
  const [chatId, setChatId] = useState<string>(() => {
    return localStorage.getItem(TELEGRAM_CHAT_KEY) || DEFAULT_CHAT_ID;
  });

  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [isSavingToTelegram, setIsSavingToTelegram] = useState(false);
  const [isSyncingFromTelegram, setIsSyncingFromTelegram] = useState(false);
  const [isTestingBot, setIsTestingBot] = useState(false);
  const [saveNote, setSaveNote] = useState("");
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Telegram Scan Command States
  const [scanInput, setScanInput] = useState("scan:5677714|0966997172");
  const [isExecutingScan, setIsExecutingScan] = useState(false);
  const lastServerUpdateRef = useRef<number>(0);
  const lastScannedVersionRef = useRef<number>(0);

  // List of all scanned tracking items fetched from /api/scanned-items
  const [scannedItems, setScannedItems] = useState<Array<{
    day: number;
    rowIndex: number;
    tracking: string;
    receiverPhone: string;
    senderPhone: string;
    today: string;
    prevday: string;
    ret: string;
    reloc: string;
    sent: string;
    cod: string;
    cc: string;
    issue: string;
  }>>([]);

  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const [activeDay, setActiveDay] = useState(() => {
    const today = new Date().getDate();
    return Math.min(Math.max(today, 1), DAY_COUNT);
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});

  const showToast = useCallback((text: string, type: "success" | "error" | "info" = "info") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const syncDataToServer = useCallback((updatedData: MonthData) => {
    fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockData: updatedData })
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.lastUpdated) {
          lastServerUpdateRef.current = res.lastUpdated;
        }
      })
      .catch(() => {});
  }, []);

  // Sync state with server and poll for Telegram Bot Scan command updates
  useEffect(() => {
    // Initial sync from server
    fetch("/api/stock")
      .then((res) => res.json())
      .then((result) => {
        if (result.success && result.stockData) {
          if (result.lastUpdated > 0) {
            setData(mergeWithDefaults(result.stockData));
            lastServerUpdateRef.current = result.lastUpdated;
          } else {
            syncDataToServer(data);
          }
        }
      })
      .catch(() => {});

    // Polling server every 2.5s to automatically reflect Telegram Bot scan updates
    const interval = setInterval(() => {
      fetch("/api/stock")
        .then((res) => res.json())
        .then((result) => {
          if (result.success && result.lastUpdated && result.lastUpdated > lastServerUpdateRef.current) {
            lastServerUpdateRef.current = result.lastUpdated;
            const merged = mergeWithDefaults(result.stockData);
            setData(merged);
            showToast("⚡ ទទួលបានទិន្នន័យស្កែនថ្មីពី Telegram Bot! (New row scanned via Telegram Bot)", "success");
          }
        })
        .catch(() => {});
    }, 2500);

    return () => clearInterval(interval);
  }, [showToast, syncDataToServer]);

  // Dedicated polling loop for /api/scanned-items every 2s
  // Runs independently from the /api/stock poll above so Telegram scan updates
  // appear immediately in the scannedItems list without triggering a full data merge.
  useEffect(() => {
    const fetchScannedItems = () => {
      fetch("/api/scanned-items")
        .then((res) => res.json())
        .then((result) => {
          if (result.success && typeof result.version === "number" && result.version > lastScannedVersionRef.current) {
            lastScannedVersionRef.current = result.version;
            setScannedItems(result.items || []);
          }
        })
        .catch(() => {});
    };

    // Fetch immediately on mount
    fetchScannedItems();

    const scannedInterval = setInterval(fetchScannedItems, 2000);
    return () => clearInterval(scannedInterval);
  }, []);

  // Auto-save data to LocalStorage and push to server
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save to localStorage", e);
    }
    syncDataToServer(data);
  }, [data, syncDataToServer]);

  // Persist Telegram Bot Token & Chat ID
  useEffect(() => {
    localStorage.setItem(TELEGRAM_TOKEN_KEY, botToken);
    localStorage.setItem(TELEGRAM_CHAT_KEY, chatId);
  }, [botToken, chatId]);

  // Execute or test Scan Command (e.g. scan:TRACKING_NO|PHONE_NO)
  const handleExecuteScanCommand = async () => {
    if (!scanInput.trim()) {
      showToast("សូមវាយបញ្ចូលសារស្កែន! (e.g. scan:TRACKING_NO|PHONE_NO)", "error");
      return;
    }
    setIsExecutingScan(true);
    try {
      const res = await fetch("/api/telegram/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: scanInput,
          botToken,
          chatId
        })
      });
      const result = await res.json();
      if (result.success) {
        showToast(result.message || "ស្កែនបានជោគជ័យ!", "success");
        if (result.targetDay) {
          setActiveDay(parseInt(result.targetDay));
        }
        if (result.rowIndex !== undefined) {
          setHighlightedRow(result.rowIndex);
        }
        setScanInput("");
      } else {
        showToast(`ស្កែនបរាជ័យ: ${result.error}`, "error");
      }
    } catch (err: any) {
      showToast(`កំហុសបណ្តាញ: ${err.message}`, "error");
    } finally {
      setIsExecutingScan(false);
    }
  };

  // Save Stock Data to Telegram Bot API
  const handleSaveToTelegram = async () => {
    setIsSavingToTelegram(true);
    try {
      const res = await fetch("/api/telegram/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken,
          chatId,
          stockData: data,
          note: saveNote,
        }),
      });

      const result = await res.json();
      if (result.success) {
        showToast(`បានផ្ញើ និងរក្សាទុកទិន្នន័យស្តុកទៅកាន់ Telegram (${chatId}) រួចរាល់!`, "success");
        setLastSyncTime(result.timestamp || new Date().toLocaleString());
        setSaveNote("");
      } else {
        showToast(`បរាជ័យក្នុងការរក្សាទុកទៅ Telegram: ${result.error}`, "error");
      }
    } catch (err: any) {
      showToast(`កំហុសបណ្តាញ: ${err.message}`, "error");
    } finally {
      setIsSavingToTelegram(false);
    }
  };

  // Sync / Restore Stock Data from Telegram Bot API
  const handleSyncFromTelegram = async () => {
    setIsSyncingFromTelegram(true);
    try {
      const res = await fetch("/api/telegram/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken,
          chatId,
        }),
      });

      const result = await res.json();
      if (result.success && result.stockData) {
        const merged = mergeWithDefaults(result.stockData);
        setData(merged);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        setLastSyncTime(result.dateSaved || new Date().toLocaleString());
        showToast(`បានទាញយកទិន្នន័យស្តុកចុងក្រោយពី Telegram (${result.dateSaved}) ដោយជោគជ័យ!`, "success");
      } else {
        showToast(`មិនអាចទាញយកទិន្នន័យពី Telegram ទេ: ${result.error}`, "error");
      }
    } catch (err: any) {
      showToast(`កំហុសបណ្តាញ: ${err.message}`, "error");
    } finally {
      setIsSyncingFromTelegram(false);
    }
  };

  // Test Telegram Bot Connection
  const handleTestBot = async () => {
    setIsTestingBot(true);
    try {
      const res = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken, chatId }),
      });
      const result = await res.json();
      if (result.success) {
        const botName = result.bot?.first_name || result.bot?.username || "Bot";
        showToast(`ភ្ជាប់បានជោគជ័យ! Bot: @${result.bot?.username || botName}`, "success");
      } else {
        showToast(`ការតភ្ជាប់បរាជ័យ: ${result.error}`, "error");
      }
    } catch (err: any) {
      showToast(`កំហុសបណ្តាញ: ${err.message}`, "error");
    } finally {
      setIsTestingBot(false);
    }
  };

  // Current day data helper
  const currentDayData = useMemo(() => data[activeDay] || emptyDay(), [data, activeDay]);

  // Count how many times each receiver phone number appears within the ACTIVE day only —
  // used to show a "×N" badge so duplicate numbers on the same day stand out immediately.
  // Rows already confirmed via the "ថ្ងៃនេះ" (today) or "ថ្ងៃមុន" (previous day) checkbox are
  // treated as legitimate separate packages (not accidental duplicate entries) and excluded
  // from the count — ticking either box on a row clears the ×N badge for that phone number.
  const currentDayPhoneCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    currentDayData.rows.forEach((r) => {
      const phone = r.receiverPhone.trim();
      if (!phone) return;
      const isConfirmed = parseVal(r.today) === 1 || parseVal(r.prevday) === 1;
      if (isConfirmed) return;
      counts[phone] = (counts[phone] || 0) + 1;
    });
    return counts;
  }, [currentDayData]);

  // Phone numbers ever entered across ALL days — powers the native browser autocomplete
  // dropdown so previously-typed values can be selected again. (Tracking numbers deliberately
  // do NOT reuse past full values here — only the prefix quick-picks below — per request.)
  const allPhoneNumbers = useMemo(() => {
    const set = new Set<string>();
    Object.values(data).forEach((day: DayData) => day.rows.forEach((r) => { if (r.receiverPhone.trim()) set.add(r.receiverPhone.trim()); }));
    return Array.from(set);
  }, [data]);

  // Quick-pick tracking number prefixes (J&T batch codes J0135–J0141, plus the TBKHJ template)
  // so the user can select a head/prefix fast, then just type the trailing sequence digits.
  const TRACKING_PREFIX_SUGGESTIONS = ["J0135", "J0136", "J0137", "J0138", "J0139", "J0140", "J0141", "TBKHJ"];

  // "Sticky" prefix: once a row's tracking number is formatted against a known prefix, that
  // prefix is remembered here so the NEXT row only needs the trailing digits typed in.
  const [lastTrackingPrefix, setLastTrackingPrefix] = useState<string>("");

  // Sequentially calculate remaining stock across Day 1 to Day 31:
  // Day 1 remaining = arrived + prevMonthLeftover - (today + prevday + ret + reloc)
  // Day N remaining = arrived + Day(N-1) remaining - (today + prevday + ret + reloc)
  const allDayRemainings = useMemo(() => {
    const remainings: number[] = new Array(32).fill(0);
    let prevDayLeft = 0;

    for (let d = 1; d <= DAY_COUNT; d++) {
      const dayObj = data[d];
      if (!dayObj) {
        remainings[d] = prevDayLeft;
        continue;
      }
      const arrived = parseVal(dayObj.arrived);
      const startLeftover = d === 1 ? parseVal(dayObj.prevMonthLeftover) : prevDayLeft;

      let todayCount = 0;
      let prevdayCount = 0;
      let retCount = 0;
      let relocCount = 0;

      (dayObj.rows || []).forEach((r) => {
        if (parseVal(r.today)) todayCount += parseVal(r.today);
        if (parseVal(r.prevday)) prevdayCount += parseVal(r.prevday);
        if (parseVal(r.ret)) retCount += parseVal(r.ret);
        if (parseVal(r.reloc)) relocCount += parseVal(r.reloc);
      });

      const dayRemaining = (arrived - todayCount - relocCount) + (startLeftover - prevdayCount);
      remainings[d] = dayRemaining;
      prevDayLeft = dayRemaining;
    }
    return remainings;
  }, [data]);

  // Calculate stats for active day
  const activeDayStats = useMemo(() => {
    const arrived = parseVal(currentDayData.arrived);
    const prevLeftover = activeDay === 1 ? parseVal(currentDayData.prevMonthLeftover) : (allDayRemainings[activeDay - 1] ?? 0);

    let todayCount = 0;
    let prevdayCount = 0;
    let retCount = 0;
    let relocCount = 0;
    let sentCount = 0;
    let codTotal = 0;
    let ccTotal = 0;

    (currentDayData.rows || []).forEach((r) => {
      if (parseVal(r.today)) todayCount += parseVal(r.today);
      if (parseVal(r.prevday)) prevdayCount += parseVal(r.prevday);
      if (parseVal(r.ret)) retCount += parseVal(r.ret);
      if (parseVal(r.reloc)) relocCount += parseVal(r.reloc);
      if (parseVal(r.sent)) sentCount += parseVal(r.sent);

      codTotal += parseVal(r.cod);
      ccTotal += parseVal(r.cc);
    });

    const totalOut = todayCount + prevdayCount + retCount + relocCount + sentCount;
    const pendingDistribution = arrived - todayCount - relocCount;
    const todayLeftover = prevLeftover - prevdayCount;
    const remaining = pendingDistribution + todayLeftover;
    const dividend = (todayCount * 900) + (prevdayCount * 800) + (sentCount * 1000);

    return {
      arrived,
      prevLeftover,
      todayCount,
      prevdayCount,
      retCount,
      relocCount,
      sentCount,
      totalOut,
      pendingDistribution,
      todayLeftover,
      remaining,
      codTotal,
      ccTotal,
      dividend,
    };
  }, [currentDayData, activeDay, allDayRemainings]);

  // Monthly totals across all days
  const monthlyStats = useMemo(() => {
    let totalArrived = 0;
    let totalPrevLeftover = 0;
    let totalToday = 0;
    let totalPrevDay = 0;
    let totalRet = 0;
    let totalReloc = 0;
    let totalSent = 0;
    let totalCOD = 0;
    let totalCC = 0;
    let totalParcelsLogged = 0;

    const dailyList: Array<{
      day: number;
      arrived: number;
      prevLeftover: number;
      today: number;
      prevday: number;
      ret: number;
      reloc: number;
      sent: number;
      totalOut: number;
      remaining: number;
      cod: number;
      cc: number;
      dividend: number;
    }> = [];

    for (let d = 1; d <= DAY_COUNT; d++) {
      const dayObj = data[d] || emptyDay();
      const arr = parseVal(dayObj.arrived);
      const prevL = parseVal(dayObj.prevMonthLeftover);
      totalArrived += arr;
      totalPrevLeftover += prevL;

      let dToday = 0;
      let dPrevDay = 0;
      let dRet = 0;
      let dReloc = 0;
      let dSent = 0;
      let dCOD = 0;
      let dCC = 0;

      (dayObj.rows || []).forEach((r) => {
        if (r.tracking || r.receiverPhone) totalParcelsLogged += 1;
        const tVal = parseVal(r.today);
        const pVal = parseVal(r.prevday);
        const rVal = parseVal(r.ret);
        const lVal = parseVal(r.reloc);
        const sVal = parseVal(r.sent);
        const cVal = parseVal(r.cod);
        const ccVal = parseVal(r.cc);

        dToday += tVal;
        dPrevDay += pVal;
        dRet += rVal;
        dReloc += lVal;
        dSent += sVal;
        dCOD += cVal;
        dCC += ccVal;
      });

      totalToday += dToday;
      totalPrevDay += dPrevDay;
      totalRet += dRet;
      totalReloc += dReloc;
      totalSent += dSent;
      totalCOD += dCOD;
      totalCC += dCC;

      const dTotalOut = dToday + dPrevDay + dRet + dReloc + dSent;
      const dRem = arr + prevL - (dToday + dPrevDay + dRet + dReloc);
      const dDiv = (dToday * 900) + (dPrevDay * 800) + (dSent * 1000);

      dailyList.push({
        day: d,
        arrived: arr,
        prevLeftover: prevL,
        today: dToday,
        prevday: dPrevDay,
        ret: dRet,
        reloc: dReloc,
        sent: dSent,
        totalOut: dTotalOut,
        remaining: dRem,
        cod: dCOD,
        cc: dCC,
        dividend: dDiv,
      });
    }

    const totalOut = totalToday + totalPrevDay + totalRet + totalReloc + totalSent;
    const totalDividend = (totalToday * 900) + (totalPrevDay * 800) + (totalSent * 1000);

    return {
      totalArrived,
      totalPrevLeftover,
      totalToday,
      totalPrevDay,
      totalRet,
      totalReloc,
      totalSent,
      totalOut,
      totalCOD,
      totalCC,
      totalParcelsLogged,
      totalDividend,
      dailyList,
    };
  }, [data]);

  // Calculate packages remaining in stock on their LAST day (day 3 in stock, arrivalDay = activeDay - 2)
  const lastDayStockPackages = useMemo(() => {
    const result: Array<{
      day: number;
      rowIndex: number;
      tracking: string;
      receiverPhone: string;
      senderPhone: string;
      issue: string;
      cod: string;
      cc: string;
      daysInStock: number;
    }> = [];

    const arrivalDay = activeDay - 2;
    if (arrivalDay >= 1) {
      const dayData = data[arrivalDay];
      if (dayData && dayData.rows) {
        dayData.rows.forEach((r, idx) => {
          const hasInfo = Boolean(r.tracking || r.receiverPhone);
          const isCheckedSelf = parseVal(r.today) > 0 || parseVal(r.prevday) > 0 || parseVal(r.ret) > 0 || parseVal(r.reloc) > 0 || parseVal(r.sent) > 0;

          // Check if this parcel was marked delivered/dispatched on any day from arrivalDay to activeDay
          const trackingClean = r.tracking.trim().toLowerCase();
          const phoneClean = r.receiverPhone.trim().toLowerCase();

          let isCheckedElsewhere = false;
          if (trackingClean || phoneClean) {
            for (let d = arrivalDay; d <= activeDay; d++) {
              const checkDayData = data[d];
              if (checkDayData && checkDayData.rows) {
                for (const checkRow of checkDayData.rows) {
                  const checkTracking = checkRow.tracking.trim().toLowerCase();
                  const checkPhone = checkRow.receiverPhone.trim().toLowerCase();
                  const isChecked = parseVal(checkRow.today) > 0 || parseVal(checkRow.prevday) > 0 || parseVal(checkRow.ret) > 0 || parseVal(checkRow.reloc) > 0 || parseVal(checkRow.sent) > 0;

                  if (isChecked) {
                    if (trackingClean && checkTracking === trackingClean) {
                      isCheckedElsewhere = true;
                      break;
                    }
                    if (phoneClean && checkPhone === phoneClean) {
                      isCheckedElsewhere = true;
                      break;
                    }
                  }
                }
              }
              if (isCheckedElsewhere) break;
            }
          }

          if (hasInfo && !isCheckedSelf && !isCheckedElsewhere) {
            result.push({
              day: arrivalDay,
              rowIndex: idx,
              tracking: r.tracking,
              receiverPhone: r.receiverPhone,
              senderPhone: r.senderPhone,
              issue: r.issue,
              cod: r.cod,
              cc: r.cc,
              daysInStock: 3,
            });
          }
        });
      }
    }

    return result;
  }, [data, activeDay]);

  // Handle cell edit
  const handleCellChange = useCallback((day: number, rowIndex: number, fieldKey: keyof ReportRow, value: string) => {
    setData((prev) => {
      const dayData = prev[day] || emptyDay();
      const updatedRows = [...dayData.rows];
      updatedRows[rowIndex] = { ...updatedRows[rowIndex], [fieldKey]: value };
      return { ...prev, [day]: { ...dayData, rows: updatedRows } };
    });
  }, []);

  // Add a row to current day
  const addRow = useCallback(() => {
    setData((prev) => {
      const dayData = prev[activeDay] || emptyDay();
      return { ...prev, [activeDay]: { ...dayData, rows: [...dayData.rows, emptyRow()] } };
    });
  }, [activeDay]);

  // Enter key navigation across table cells
  const handleEnterNavigation = useCallback(
    (e: KeyboardEvent, rowIndex: number, colKey: string) => {
      if (e.key !== "Enter") return;
      e.preventDefault();

      let nextRow = rowIndex;
      let nextCol = colKey;

      if (colKey === "tracking") {
        const raw = (currentDayData.rows[rowIndex]?.tracking || "").trim();
        if (raw) {
          const formatted = formatTrackingNumber(raw, lastTrackingPrefix);
          if (formatted !== raw) {
            handleCellChange(activeDay, rowIndex, "tracking", formatted);
          }
          const prefix = extractTrackingPrefix(formatted);
          if (prefix) setLastTrackingPrefix(prefix);
        }
        nextCol = "receiverPhone";
      } else if (colKey === "receiverPhone") {
        nextRow = rowIndex + 1;
        nextCol = "tracking";
      } else {
        const colIndex = COLUMNS.findIndex((c) => c.key === colKey);
        if (colIndex >= 0 && colIndex < COLUMNS.length - 1) {
          nextCol = COLUMNS[colIndex + 1].key;
        } else {
          nextRow = rowIndex + 1;
          nextCol = "tracking";
        }
      }

      const totalRows = currentDayData.rows?.length || DEFAULT_ROWS;
      if (nextRow >= totalRows) {
        addRow();
      }

      setTimeout(() => {
        const key = `${activeDay}-${nextRow}-${nextCol}`;
        const targetEl = inputRefs.current[key];
        if (targetEl) {
          targetEl.focus();
          if ("select" in targetEl && typeof (targetEl as any).select === "function") {
            (targetEl as any).select();
          }
        }
      }, 60);
    },
    [activeDay, currentDayData, lastTrackingPrefix, handleCellChange, addRow]
  );

  // Handle header values edit (arrived / prevMonthLeftover)
  const handleHeaderChange = useCallback((day: number, fieldKey: "arrived" | "prevMonthLeftover", value: string) => {
    setData((prev) => {
      const dayData = prev[day] || emptyDay();
      return { ...prev, [day]: { ...dayData, [fieldKey]: value } };
    });
  }, []);

  // Delete a specific row
  const deleteRow = useCallback((rowIndex: number) => {
    setData((prev) => {
      const dayData = prev[activeDay] || emptyDay();
      const updatedRows = dayData.rows.filter((_, idx) => idx !== rowIndex);
      while (updatedRows.length < DEFAULT_ROWS) {
        updatedRows.push(emptyRow());
      }
      return { ...prev, [activeDay]: { ...dayData, rows: updatedRows } };
    });
  }, [activeDay]);

  // Clear active day data only
  const handleClearActiveDay = () => {
    setData((prev) => ({
      ...prev,
      [activeDay]: emptyDay(),
    }));
    setIsClearModalOpen(false);
    showToast(`បានសម្អាតទិន្នន័យថ្ងៃទី ${activeDay} រួចរាល់!`, "success");
  };

  // Clear all data completely across 31 days
  const handleClearAllData = () => {
    const emptyMonth: MonthData = {};
    for (let d = 1; d <= DAY_COUNT; d++) {
      emptyMonth[d] = emptyDay();
    }
    setData(emptyMonth);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyMonth));
    setIsClearModalOpen(false);
    showToast("បានសម្អាតទិន្នន័យទាំងអស់រួចរាល់!", "success");
  };

  // Reset to default seed data
  const handleResetSeedData = () => {
    const seeded = mergeWithDefaults(SEED_DATA as MonthData);
    setData(seeded);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    setIsClearModalOpen(false);
    showToast("បានកំណត់ឡើងវិញទៅគំរូដើម!", "info");
  };

  // Search filter across all days
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    const results: Array<{ day: number; rowIndex: number; row: ReportRow }> = [];

    for (let d = 1; d <= DAY_COUNT; d++) {
      const dayObj = data[d];
      if (!dayObj || !dayObj.rows) continue;
      dayObj.rows.forEach((r, idx) => {
        const matchesTracking = r.tracking && String(r.tracking).toLowerCase().includes(query);
        const matchesRec = r.receiverPhone && String(r.receiverPhone).toLowerCase().includes(query);
        const matchesSen = r.senderPhone && String(r.senderPhone).toLowerCase().includes(query);
        const matchesIssue = r.issue && String(r.issue).toLowerCase().includes(query);
        const matchesOther = r.other && String(r.other).toLowerCase().includes(query);

        if (matchesTracking || matchesRec || matchesSen || matchesIssue || matchesOther) {
          results.push({ day: d, rowIndex: idx, row: r });
        }
      });
    }
    return results;
  }, [data, searchQuery]);

  // Jump to specific search result
  const handleJumpToRow = (day: number, rowIndex: number) => {
    setActiveDay(day);
    setShowOverview(false);
    setIsSearchOpen(false);
    setHighlightedRow(rowIndex);
    setTimeout(() => {
      const refKey = `${day}-${rowIndex}`;
      if (rowRefs.current[refKey]) {
        rowRefs.current[refKey]?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 200);
  };

  // Copy active day summary text
  const copySummary = () => {
    const text = `📋 របាយការណ៍ប្រចាំថ្ងៃ - ថ្ងៃទី ${activeDay}
----------------------------------
ទំនិញមកដល់: ${activeDayStats.arrived}
សល់ម្សិលមិញ: ${activeDayStats.prevLeftover}
ប្រគល់ថ្ងៃនេះ (Today): ${activeDayStats.todayCount}
ប្រគល់ថ្ងៃមុន (PrevDay): ${activeDayStats.prevdayCount}
ត្រឡប់ (Return): ${activeDayStats.retCount}
ប្តូរទីតាំង (Relocate): ${activeDayStats.relocCount}
ផ្ញើចេញ (Sent): ${activeDayStats.sentCount}
----------------------------------
ចាំចែកចាយ: ${activeDayStats.pendingDistribution}
សល់ថ្ងៃនេះ: ${activeDayStats.todayLeftover}
សរុបប្រគល់ចេញ: ${activeDayStats.totalOut}
សល់សរុប: ${activeDayStats.remaining}
----------------------------------
សរុប COD: ${activeDayStats.codTotal.toLocaleString()} KHR
សរុប CC Cash: ${activeDayStats.ccTotal.toLocaleString()} KHR`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };



  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (parsed && typeof parsed === "object") {
          const merged = mergeWithDefaults(parsed);
          setData(merged);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          syncDataToServer(merged);
          showToast("បាននាំចូលទិន្នន័យពី JSON ដោយជោគជ័យ!", "success");
        } else {
          showToast("ឯកសារ JSON មិនត្រឹមត្រូវទេ", "error");
        }
      } catch (err: any) {
        showToast(`កំហុសក្នុងការអាន JSON: ${err.message}`, "error");
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = "";
  };


  // Import data FROM an Excel (.xlsx/.xls) file — expects the same column layout produced by
  // exportXLSX: ថ្ងៃទី, #, ត្រឡប់, បូរទីកាំង, ផ្ញើចេញ, ថ្ងៃមុន, ថ្ងៃនេះ, លេខបៀល, លេខអ្នកទទួល,
  // លេខអ្នកផ្ញើ, CC-Cash, COD KHR, បញ្ហា, កំណត់ចំណាំ. Rows are merged into the first empty slot
  // of the matching day (existing data is never silently overwritten).
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportFile = async (file: File) => {
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const aoa: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      if (!aoa.length || aoa.length < 2) {
        showToast("ឯកសារ Excel នេះគ្មានទិន្នន័យ", "error");
        return;
      }

      // Skip the header row (row 0); data starts at row 1.
      const importRows = aoa.slice(1).filter((row) => row && row[0] !== "" && row[0] != null);
      if (importRows.length === 0) {
        showToast("រកមិនឃើញជួរដេកទិន្នន័យត្រឹមត្រូវក្នុងឯកសារនេះទេ", "error");
        return;
      }

      const confirmed = window.confirm(
        `រកឃើញ ${importRows.length} ជួរដេកក្នុងឯកសារ Excel។ ទិន្នន័យទាំងនេះនឹងត្រូវបញ្ចូលទៅក្នុងជួរទទេនៃថ្ងៃដែលត្រូវគ្នា (ទិន្នន័យមានស្រាប់មិនត្រូវបានលុបទេ)។ បន្តទេ?`
      );
      if (!confirmed) return;

      setData((prev) => {
        const next: MonthData = { ...prev };
        let importedCount = 0;

        for (const row of importRows) {
          const day = parseInt(String(row[0]).trim(), 10);
          if (!day || day < 1 || day > DAY_COUNT) continue;

          const newRow: ReportRow = {
            ret: String(row[2] ?? ""),
            reloc: String(row[3] ?? ""),
            sent: String(row[4] ?? ""),
            prevday: String(row[5] ?? ""),
            today: String(row[6] ?? ""),
            tracking: String(row[7] ?? ""),
            receiverPhone: String(row[8] ?? ""),
            senderPhone: String(row[9] ?? ""),
            cc: String(row[10] ?? ""),
            cod: String(row[11] ?? ""),
            issue: String(row[12] ?? ""),
            other: String(row[13] ?? ""),
          };

          const dayObj = next[day] ? { ...next[day], rows: [...next[day].rows] } : emptyDay();
          const emptyIdx = dayObj.rows.findIndex((r) => !r.tracking && !r.receiverPhone && !r.today && !r.prevday);
          if (emptyIdx !== -1) {
            dayObj.rows[emptyIdx] = newRow;
          } else {
            dayObj.rows.push(newRow);
          }
          next[day] = dayObj;
          importedCount++;
        }

        showToast(`បាននាំចូល ${importedCount} ជួរដេកដោយជោគជ័យ!`, "success");
        syncDataToServer(next);
        return next;
      });
    } catch (err: any) {
      console.error("Import failed:", err);
      showToast("បរាជ័យក្នុងការអានឯកសារ Excel — សូមប្រាកដថាឯកសារត្រឹមត្រូវ", "error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      {/* Autocomplete suggestion lists — wired to the tracking/receiverPhone inputs via list=... */}
      <datalist id="tracking-suggestions">
        {TRACKING_PREFIX_SUGGESTIONS.map((p) => (
          <option key={`prefix-${p}`} value={p} />
        ))}
      </datalist>
      <datalist id="phone-suggestions">
        {allPhoneNumbers.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      {/* Toast Notification Floating Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 max-w-md animate-bounce">
          <div
            className={`p-4 rounded-xl border shadow-xl flex items-center space-x-3 text-sm font-medium ${
              toastMessage.type === "success"
                ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                : toastMessage.type === "error"
                ? "bg-red-50 border-red-300 text-red-900"
                : "bg-blue-50 border-blue-300 text-blue-900"
            }`}
          >
            {toastMessage.type === "success" ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : toastMessage.type === "error" ? (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            ) : (
              <Bot className="w-5 h-5 text-blue-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
            <button onClick={() => setToastMessage(null)} className="ml-auto text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Header Navbar */}
      <header className="bg-white border-b border-slate-200 px-3 sm:px-6 lg:px-8 py-3 sticky top-0 z-20 shadow-sm w-full">
        <div className="w-full max-w-none flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 sm:p-2.5 bg-gradient-to-br from-red-600 to-red-700 rounded-xl text-white font-black text-lg sm:text-xl tracking-wider shadow-md shadow-red-200">
              J&T
            </div>
            <div>
              <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                J&T Daily Delivery Report
                <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full hidden xs:inline-block">
                  Branch Tracking
                </span>
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500">របាយការណ៍ប្រចាំថ្ងៃសាខា - គ្រប់គ្រងការប្រគល់ទំនិញ & COD</p>
            </div>
          </div>

          {/* Action Tools Header Bar */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 flex-wrap gap-y-2">
            {/* Save to Telegram Quick Button */}
            <button
              onClick={handleSaveToTelegram}
              disabled={isSavingToTelegram}
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl transition shadow-sm"
              title="រក្សាទុកទិន្នន័យស្តុកទៅ Telegram"
            >
              {isSavingToTelegram ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
              <span>{isSavingToTelegram ? "Save..." : "រក្សាទុក (Save)"}</span>
            </button>



            {/* Import JSON */}
            <input
              ref={jsonFileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportJSON}
            />
            <button
              onClick={() => jsonFileInputRef.current?.click()}
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition shadow-sm"
              title="បញ្ចូលឯកសារ JSON"
            >
              <FileUp className="w-4 h-4" />
              <span>នាំចូល JSON</span>
            </button>

            {/* Sync from Telegram Quick Button */}
            <button
              onClick={handleSyncFromTelegram}
              disabled={isSyncingFromTelegram}
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl transition shadow-sm"
              title="ទាញយកទិន្នន័យស្តុកពី Telegram"
            >
              {isSyncingFromTelegram ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
              <span>{isSyncingFromTelegram ? "Sync..." : "ទាញយក (Sync)"}</span>
            </button>

            {/* Telegram Bot Settings Modal Toggle */}
            <button
              onClick={() => setIsTelegramModalOpen(true)}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs sm:text-sm font-medium rounded-xl transition"
            >
              <Bot className="w-4 h-4 text-sky-600" />
              <span className="hidden md:inline">Telegram Bot</span>
            </button>

            {/* Search */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center space-x-2 px-2.5 sm:px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs sm:text-sm font-medium rounded-xl transition"
            >
              <Search className="w-4 h-4 text-red-600" />
              <span className="hidden sm:inline">ស្វែងរកបៀល / ទូរស័ព្ទ</span>
            </button>

            {/* Monthly Overview Toggle */}
            <button
              onClick={() => setShowOverview(!showOverview)}
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-xl transition border ${
                showOverview
                  ? "bg-red-600 border-red-600 text-white shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span>{showOverview ? "មើលតារាងថ្ងៃ" : "សរុបប្រចាំខែ"}</span>
            </button>

            {/* Clear Data / Reset */}
            <button
              onClick={() => setIsClearModalOpen(true)}
              title="សម្អាត / កំណត់ទិន្នន័យឡើងវិញ (Clear Data)"
              className="p-2 bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-600 hover:text-red-600 rounded-xl transition flex items-center space-x-1"
            >
              <RotateCcw className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-none p-2 sm:p-4 lg:p-6 space-y-2">
        {/* Days Navigation Bar */}
        <div className="bg-white px-2 py-1.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-1 w-full" style={{ marginTop: "0px", marginBottom: "2px" }}>
          <button
            onClick={() => setActiveDay((d) => Math.max(1, d - 1))}
            disabled={activeDay === 1}
            className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 disabled:opacity-30 text-slate-700 transition shrink-0"
            title="ថ្ងៃមុន (Previous Day)"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <div className="flex-1 grid grid-cols-[repeat(31,minmax(0,1fr))] gap-0.5 items-center justify-items-stretch">
            {Array.from({ length: DAY_COUNT }, (_, i) => i + 1).map((day) => (
              <button
                key={day}
                onClick={() => {
                  setActiveDay(day);
                  setShowOverview(false);
                }}
                title={`ថ្ងៃទី ${day}`}
                className={`py-1 px-0 text-[10px] sm:text-xs font-bold rounded-md transition text-center w-full truncate ${
                  activeDay === day && !showOverview
                    ? "bg-red-600 text-white shadow-sm font-black"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80"
                }`}
              >
                {day}
              </button>
            ))}
          </div>

          <button
            onClick={() => setActiveDay((d) => Math.min(DAY_COUNT, d + 1))}
            disabled={activeDay === DAY_COUNT}
            className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 disabled:opacity-30 text-slate-700 transition shrink-0"
            title="ថ្ងៃបន្ទាប់ (Next Day)"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Overview Tab OR Daily Sheet Tab */}
        {showOverview ? (
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center space-x-2.5">
                <BarChart2 className="w-6 h-6 text-red-600" />
                <span>សរុបប្រចាំខែ (Monthly Overview)</span>
              </h2>
              <span className="text-xs text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 font-medium">
                31 Days Total
              </span>
            </div>

            {/* Top Financial Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Card 1: Total Dividend */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50/70 p-3.5 sm:p-4 rounded-xl border border-amber-200/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-600" />
                    <span>ប្រាក់ភាគលាភសរុបប្រចាំខែ</span>
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-100/90 text-amber-800 rounded-md border border-amber-200">
                    Dividend
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <p className="text-xl sm:text-2xl font-black text-amber-700">
                    {monthlyStats.totalDividend.toLocaleString()} <span className="text-xs font-bold text-amber-800">KHR</span>
                  </p>
                  <div className="text-[10px] text-amber-800/80 font-medium">
                    900៛ / 800៛ / 1000៛
                  </div>
                </div>
              </div>

              {/* Card 2: COD & CC Cash */}
              <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>💵 COD & CC Cash សរុប</span>
                  <span className="text-[10px] text-slate-500 font-medium">តាមប្រភេទ</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-medium block">COD ត្រូវប្រមូល</span>
                    <span className="font-bold text-amber-600 text-xs sm:text-sm">
                      {monthlyStats.totalCOD.toLocaleString()} <span className="text-[10px]">៛</span>
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-medium block">CC Cash</span>
                    <span className="font-bold text-emerald-600 text-xs sm:text-sm">
                      {monthlyStats.totalCC.toLocaleString()} <span className="text-[10px]">៛</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Total Money Collected (CC + COD) */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-3.5 sm:p-4 rounded-xl border border-indigo-200/90 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    💰 <span>ទឹកប្រាក់សរុប (CC Cash + COD)</span>
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md border border-indigo-200">
                    Total Income
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <p className="text-xl sm:text-2xl font-black text-indigo-700">
                    {(monthlyStats.totalCOD + monthlyStats.totalCC).toLocaleString()}{" "}
                    <span className="text-xs font-bold text-indigo-800">KHR</span>
                  </p>
                  <span className="text-[10px] text-indigo-700 font-medium">
                    (COD + CC)
                  </span>
                </div>
              </div>
            </div>

            {/* Parcel Count Metrics (Compact 8-Column Grid) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mt-3">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-xs text-center">
                <span className="text-[10px] text-slate-500 font-medium block">ទំនិញមកដល់</span>
                <span className="font-extrabold text-blue-600 text-base">{monthlyStats.totalArrived}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-xs text-center">
                <span className="text-[10px] text-slate-500 font-medium block">ត្រឡប់ (Return)</span>
                <span className="font-extrabold text-red-600 text-base">{monthlyStats.totalRet}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-xs text-center">
                <span className="text-[10px] text-slate-500 font-medium block">ប្តូរទីតាំង</span>
                <span className="font-extrabold text-amber-600 text-base">{monthlyStats.totalReloc}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-xs text-center">
                <span className="text-[10px] text-slate-500 font-medium block">ផ្ញើចេញ (1,000៛)</span>
                <span className="font-extrabold text-purple-600 text-base">{monthlyStats.totalSent}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-xs text-center">
                <span className="text-[10px] text-slate-500 font-medium block">ថ្ងៃមុន (800៛)</span>
                <span className="font-extrabold text-cyan-600 text-base">{monthlyStats.totalPrevDay}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-xs text-center">
                <span className="text-[10px] text-slate-500 font-medium block">ថ្ងៃនេះ (900៛)</span>
                <span className="font-extrabold text-emerald-600 text-base">{monthlyStats.totalToday}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-xs text-center">
                <span className="text-[10px] text-slate-500 font-medium block">សរុបប្រគល់</span>
                <span className="font-extrabold text-teal-600 text-base">{monthlyStats.totalOut}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-xs text-center">
                <span className="text-[10px] text-slate-500 font-medium block">ចំនួនបៀលកត់ត្រា</span>
                <span className="font-extrabold text-indigo-600 text-base">{monthlyStats.totalParcelsLogged}</span>
              </div>
            </div>

            {/* Daily Breakdown & Dividend Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mt-6">
              <div className="p-3.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <Table className="w-4 h-4 text-amber-600" />
                  <span>តារាងសរុបប្រចាំថ្ងៃ និង ប្រាក់ភាគលាភ (Daily Breakdown & Dividend Table)</span>
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  *ចុចលើថ្ងៃទីដើម្បីលោតទៅកែប្រែទិន្នន័យ
                </span>
              </div>

              <div className="overflow-x-auto max-h-[520px] scrollbar-thin scrollbar-thumb-slate-300">
                <table className="w-full text-xs text-center border-collapse">
                  <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2.5 border-r border-slate-200">ថ្ងៃទី</th>
                      <th className="p-2.5 border-r border-slate-200 text-blue-700">មកដល់</th>
                      <th className="p-2.5 border-r border-slate-200 text-emerald-700">ថ្ងៃនេះ (900៛)</th>
                      <th className="p-2.5 border-r border-slate-200 text-cyan-700">ថ្ងៃមុន (800៛)</th>
                      <th className="p-2.5 border-r border-slate-200 text-purple-700">ផ្ញើចេញ (1,000៛)</th>
                      <th className="p-2.5 border-r border-slate-200 text-red-700">ត្រឡប់</th>
                      <th className="p-2.5 border-r border-slate-200 text-amber-700">ប្តូរទីតាំង</th>
                      <th className="p-2.5 border-r border-slate-200 text-teal-700">សរុបប្រគល់</th>
                      <th className="p-2.5 border-r border-slate-200 text-amber-800">COD (KHR)</th>
                      <th className="p-2.5 border-r border-slate-200 text-emerald-800">CC (KHR)</th>
                      <th className="p-2.5 text-amber-900 bg-amber-100/80 font-black min-w-[130px]">
                        ប្រាក់ភាគលាភ (Dividend)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {monthlyStats.dailyList.map((item) => {
                      const hasData = item.arrived > 0 || item.today > 0 || item.prevday > 0 || item.sent > 0 || item.ret > 0 || item.reloc > 0 || item.cod > 0 || item.cc > 0;
                      return (
                        <tr
                          key={item.day}
                          onClick={() => {
                            setActiveDay(item.day);
                            setShowOverview(false);
                          }}
                          className={`hover:bg-slate-50 cursor-pointer transition ${
                            activeDay === item.day ? "bg-red-50 font-bold text-slate-900" : hasData ? "text-slate-800" : "text-slate-400 opacity-60"
                          }`}
                        >
                          <td className="p-2 border-r border-slate-200 font-sans font-bold">
                            <span className="px-2 py-0.5 bg-slate-100 text-blue-700 rounded-md border border-slate-200">
                              ថ្ងៃទី {item.day}
                            </span>
                          </td>
                          <td className="p-2 border-r border-slate-200 text-blue-700">{item.arrived || "-"}</td>
                          <td className="p-2 border-r border-slate-200 text-emerald-700">{item.today || "-"}</td>
                          <td className="p-2 border-r border-slate-200 text-cyan-700">{item.prevday || "-"}</td>
                          <td className="p-2 border-r border-slate-200 text-purple-700">{item.sent || "-"}</td>
                          <td className="p-2 border-r border-slate-200 text-red-700">{item.ret || "-"}</td>
                          <td className="p-2 border-r border-slate-200 text-amber-700">{item.reloc || "-"}</td>
                          <td className="p-2 border-r border-slate-200 text-teal-700 font-bold">{item.totalOut || "-"}</td>
                          <td className="p-2 border-r border-slate-200 text-amber-800">{item.cod ? item.cod.toLocaleString() : "-"}</td>
                          <td className="p-2 border-r border-slate-200 text-emerald-800">{item.cc ? item.cc.toLocaleString() : "-"}</td>
                          <td className="p-2 text-right text-amber-900 font-black bg-amber-50 pr-3">
                            {item.dividend > 0 ? `${item.dividend.toLocaleString()} ៛` : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-mono font-bold text-slate-900 sticky bottom-0 z-10">
                    <tr>
                      <td className="p-2.5 border-r border-slate-200 font-sans">សរុបខែ:</td>
                      <td className="p-2.5 border-r border-slate-200 text-blue-700">{monthlyStats.totalArrived}</td>
                      <td className="p-2.5 border-r border-slate-200 text-emerald-700">{monthlyStats.totalToday}</td>
                      <td className="p-2.5 border-r border-slate-200 text-cyan-700">{monthlyStats.totalPrevDay}</td>
                      <td className="p-2.5 border-r border-slate-200 text-purple-700">{monthlyStats.totalSent}</td>
                      <td className="p-2.5 border-r border-slate-200 text-red-700">{monthlyStats.totalRet}</td>
                      <td className="p-2.5 border-r border-slate-200 text-amber-700">{monthlyStats.totalReloc}</td>
                      <td className="p-2.5 border-r border-slate-200 text-teal-700">{monthlyStats.totalOut}</td>
                      <td className="p-2.5 border-r border-slate-200 text-amber-800">{monthlyStats.totalCOD.toLocaleString()}</td>
                      <td className="p-2.5 border-r border-slate-200 text-emerald-800">{monthlyStats.totalCC.toLocaleString()}</td>
                      <td className="p-2.5 text-right text-amber-900 text-sm font-black bg-amber-100/90 border-l border-amber-300 pr-3">
                        {monthlyStats.totalDividend.toLocaleString()} ៛
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Active Day Header Dashboard */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-4 shadow-sm" style={{ marginBottom: "4px", marginTop: "0px", paddingBottom: "6px", paddingTop: "7px" }}>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3" style={{ paddingBottom: "6px", paddingTop: "0px", marginBottom: "3px" }}>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center bg-red-50 border border-red-200 text-red-600 font-bold px-3 py-1.5 rounded-xl text-sm gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>ថ្ងៃទី {activeDay}</span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">របាយការណ៍ប្រចាំថ្ងៃ</h2>
                </div>

                <div className="flex items-center space-x-4 flex-wrap gap-y-2">
                  <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <label className="text-xs text-slate-600 font-medium">ទំនិញមកដល់:</label>
                    <input
                      type="number"
                      value={currentDayData.arrived || ""}
                      onChange={(e) => handleHeaderChange(activeDay, "arrived", e.target.value)}
                      placeholder="0"
                      className="w-20 px-2 py-0.5 bg-white border border-slate-300 rounded-lg text-sm text-center font-bold text-blue-600 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  {activeDay === 1 ? (
                    <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                      <label className="text-xs text-slate-600 font-medium">នៅសល់ខែចាស់:</label>
                      <input
                        type="number"
                        value={currentDayData.prevMonthLeftover || ""}
                        onChange={(e) => handleHeaderChange(activeDay, "prevMonthLeftover", e.target.value)}
                        placeholder="0"
                        className="w-20 px-2 py-0.5 bg-white border border-slate-300 rounded-lg text-sm text-center font-bold text-amber-600 focus:outline-none focus:border-red-500"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                      <label className="text-xs text-slate-600 font-medium">សល់ម្សិលមិញ:</label>
                      <span className="w-20 px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-center font-bold text-violet-700 select-none">
                        {allDayRemainings[activeDay - 1] ?? 0}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Metric Quick Summary Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-11 gap-2 text-center text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-slate-500 font-medium block mb-0.5">ត្រឡប់</span>
                  <span className="font-bold text-red-600 text-base">{activeDayStats.retCount}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-slate-500 font-medium block mb-0.5">ប្តូរទីតាំង</span>
                  <span className="font-bold text-amber-600 text-base">{activeDayStats.relocCount}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-slate-500 font-medium block mb-0.5">ផ្ញើចេញ</span>
                  <span className="font-bold text-purple-600 text-base">{activeDayStats.sentCount}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-slate-500 font-medium block mb-0.5">ថ្ងៃមុន</span>
                  <span className="font-bold text-cyan-600 text-base">{activeDayStats.prevdayCount}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-slate-500 font-medium block mb-0.5">ថ្ងៃនេះ</span>
                  <span className="font-bold text-emerald-600 text-base">{activeDayStats.todayCount}</span>
                </div>
                <div className="bg-sky-50 p-2.5 rounded-xl border border-sky-300 shadow-sm">
                  <span className="text-sky-800 block mb-0.5 font-bold">ចាំចែកចាយ</span>
                  <span className="font-black text-sky-700 text-xs sm:text-sm">{activeDayStats.pendingDistribution}</span>
                </div>
                <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-300 shadow-sm">
                  <span className="text-amber-800 block mb-0.5 font-bold">សល់ថ្ងៃនេះ</span>
                  <span className="font-black text-amber-700 text-xs sm:text-sm">{activeDayStats.todayLeftover}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-slate-500 font-medium block mb-0.5">សល់សរុប</span>
                  <span className={`font-bold text-base ${activeDayStats.remaining < 0 ? "text-red-600" : "text-slate-800"}`}>
                    {activeDayStats.remaining}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-slate-500 font-medium block mb-0.5">CC Cash</span>
                  <span className="font-bold text-teal-700 text-xs sm:text-sm">{activeDayStats.ccTotal.toLocaleString()}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-slate-500 font-medium block mb-0.5">COD KHR</span>
                  <span className="font-bold text-amber-700 text-xs sm:text-sm">{activeDayStats.codTotal.toLocaleString()}</span>
                </div>
                <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-200 shadow-sm">
                  <span className="text-indigo-900 font-bold block mb-0.5">សរុប CC+COD</span>
                  <span className="font-extrabold text-indigo-700 text-xs sm:text-sm">
                    {(activeDayStats.codTotal + activeDayStats.ccTotal).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Compact Last-Day Stock Remaining Packages Horizontal Bar */}
            {lastDayStockPackages.length > 0 && (
              <div className="bg-amber-50/80 p-2 rounded-xl border border-amber-200 shadow-sm">
                <div className="flex items-center gap-2 overflow-x-auto py-0.5 px-0.5 scrollbar-thin scrollbar-thumb-amber-200">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 border border-amber-300 rounded-lg shrink-0 text-amber-900 font-bold text-xs">
                    <PackageSearch className="w-3.5 h-3.5 text-amber-700" />
                    <span>ថ្ងៃចុងក្រោយ ({lastDayStockPackages.length})</span>
                  </div>
                  {lastDayStockPackages.map((pkg) => (
                    <div
                      key={`${pkg.day}-${pkg.rowIndex}`}
                      onClick={() => handleJumpToRow(pkg.day, pkg.rowIndex)}
                      className="inline-flex items-center gap-2 bg-white hover:bg-amber-100/60 border border-slate-200 hover:border-amber-400 px-2.5 py-1 rounded-lg transition cursor-pointer shrink-0 text-xs group shadow-sm"
                      title={`ចុចដើម្បីលោតទៅជួរទិន្នន័យ (ចូលថ្ងៃទី ${pkg.day})`}
                    >
                      <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                        ថ្ងៃ {pkg.day}
                      </span>
                      {pkg.tracking && (
                        <span className="font-mono font-bold text-amber-800 text-xs">
                          {pkg.tracking}
                        </span>
                      )}
                      {pkg.receiverPhone && (
                        <span className="font-mono text-cyan-800 font-semibold text-xs">
                          {pkg.receiverPhone}
                        </span>
                      )}
                      {pkg.issue && (
                        <span className="text-[10px] text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 truncate max-w-[90px] font-medium">
                          {pkg.issue}
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                        ត្រឡប់លើកទី1
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interactive Main Data Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="overflow-x-auto max-h-[620px] scrollbar-thin scrollbar-thumb-slate-300">
                <table className="w-full text-xs text-left text-slate-800 border-collapse">
                  <thead className="bg-slate-100/95 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="p-2 w-10 text-center border-r border-slate-200">#</th>
                      {COLUMNS.map((col) => (
                        <th key={col.key} className={`p-2 border-r border-slate-200 text-center whitespace-nowrap ${col.widthClass || "min-w-[95px]"}`}>
                          {col.label}
                        </th>
                      ))}
                      <th className="p-2 w-10 text-center">លុប</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(currentDayData.rows || []).map((row, idx) => {
                      const isHighlighted = highlightedRow === idx;
                      const refKey = `${activeDay}-${idx}`;

                      return (
                        <tr
                          key={idx}
                          ref={(el) => (rowRefs.current[refKey] = el)}
                          className={`hover:bg-amber-50/50 transition ${
                            isHighlighted ? "bg-red-50 border-2 border-red-500" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                          }`}
                        >
                          <td className="p-1.5 text-center text-slate-400 font-mono border-r border-slate-200">{idx + 1}</td>
                          {COLUMNS.map((col) => {
                            const val = row[col.key as keyof ReportRow] || "";

                            if (TOGGLE_KEYS.includes(col.key)) {
                              const isChecked = parseVal(val) === 1;
                              return (
                                <td key={col.key} className={`p-1 border-r border-slate-200 text-center ${col.widthClass || "min-w-[55px]"}`}>
                                  <button
                                    type="button"
                                    onClick={() => handleCellChange(activeDay, idx, col.key as keyof ReportRow, isChecked ? "" : "1")}
                                    className="w-full h-7 flex items-center justify-center hover:bg-slate-100 rounded transition-all focus:outline-none"
                                    title={`${col.label}: ${isChecked ? "មាន (1)" : "គ្មាន (0)"}`}
                                  >
                                    {isChecked ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                                    ) : (
                                      <span className="text-xs text-slate-300">-</span>
                                    )}
                                  </button>
                                </td>
                              );
                            }

                            if (col.key === "issue") {
                              const isCustomOption = val && !ISSUE_OPTIONS.includes(val);
                              return (
                                <td key={col.key} className={`p-1 border-r border-slate-200 ${col.widthClass || "min-w-[95px]"}`}>
                                  <div className="relative flex items-center group/issue">
                                    <select
                                      ref={(el) => (inputRefs.current[`${activeDay}-${idx}-issue`] = el)}
                                      value={val}
                                      onChange={(e) => handleCellChange(activeDay, idx, "issue", e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          handleEnterNavigation(e, idx, "issue");
                                        }
                                      }}
                                      className={`w-full bg-transparent px-1.5 py-1 pr-5 rounded-lg border border-transparent hover:border-slate-300 focus:border-red-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer appearance-none text-xs transition-colors ${
                                        val ? "font-bold text-amber-800" : "text-slate-400"
                                      }`}
                                    >
                                      <option value="" className="bg-white text-slate-400"></option>
                                      {ISSUE_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt} className="bg-white text-slate-800 font-medium">
                                          {opt}
                                        </option>
                                      ))}
                                      {isCustomOption && (
                                        <option value={val} className="bg-white text-amber-800">
                                          {val}
                                        </option>
                                      )}
                                    </select>
                                    <ChevronDown className="w-3.5 h-3.5 text-amber-700 pointer-events-none absolute right-1 opacity-0 group-hover/issue:opacity-100 group-focus-within/issue:opacity-100 transition-opacity" />
                                  </div>
                                </td>
                              );
                            }

                            const isTracking = col.key === "tracking";
                            const isReceiverPhone = col.key === "receiverPhone";

                            if (isTracking) {
                              return (
                                <td key={col.key} className={`p-1 border-r border-slate-200 ${col.widthClass || "min-w-[145px]"}`}>
                                  <input
                                    ref={(el) => (inputRefs.current[`${activeDay}-${idx}-tracking`] = el)}
                                    type="text"
                                    value={val}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      const trimmed = raw.trim().toUpperCase();
                                      if (/^\d+$/.test(trimmed)) {
                                        if (trimmed.length >= 7) {
                                          const formatted = formatTrackingNumber(trimmed, lastTrackingPrefix);
                                          handleCellChange(activeDay, idx, "tracking", formatted);
                                          const prefix = extractTrackingPrefix(formatted);
                                          if (prefix) setLastTrackingPrefix(prefix);
                                        } else {
                                          handleCellChange(activeDay, idx, "tracking", raw);
                                        }
                                      } else {
                                        handleCellChange(activeDay, idx, "tracking", raw);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "ArrowUp") {
                                        e.preventDefault();
                                        const updated = adjustTrackingPrefix(val, "up", lastTrackingPrefix);
                                        handleCellChange(activeDay, idx, "tracking", updated);
                                        const prefix = extractTrackingPrefix(updated);
                                        if (prefix) setLastTrackingPrefix(prefix);
                                      } else if (e.key === "ArrowDown") {
                                        e.preventDefault();
                                        const updated = adjustTrackingPrefix(val, "down", lastTrackingPrefix);
                                        handleCellChange(activeDay, idx, "tracking", updated);
                                        const prefix = extractTrackingPrefix(updated);
                                        if (prefix) setLastTrackingPrefix(prefix);
                                      } else if (e.key === "Enter") {
                                        handleEnterNavigation(e, idx, "tracking");
                                      }
                                    }}
                                    onBlur={(e) => {
                                      const formatted = formatTrackingNumber(e.target.value, lastTrackingPrefix);
                                      if (formatted !== e.target.value) {
                                        handleCellChange(activeDay, idx, "tracking", formatted);
                                      }
                                      const prefix = extractTrackingPrefix(formatted);
                                      if (prefix) setLastTrackingPrefix(prefix);
                                    }}
                                    list="tracking-suggestions"
                                    placeholder=""
                                    className="w-full bg-transparent px-1.5 py-1 rounded-lg text-slate-800 focus:bg-white focus:ring-1 focus:ring-red-500 font-mono font-bold text-xs sm:text-sm text-amber-800 tracking-wide text-left border border-transparent hover:border-slate-300 focus:border-red-500 transition-colors overflow-hidden no-scrollbar"
                                  />
                                </td>
                              );
                            }

                            const rowConfirmed = parseVal(row.today) === 1 || parseVal(row.prevday) === 1;
                            const phoneDupCount = isReceiverPhone && val && !rowConfirmed ? (currentDayPhoneCounts[val.trim()] || 0) : 0;

                            return (
                              <td key={col.key} className={`p-1 border-r border-slate-200 ${col.widthClass || "min-w-[95px]"}`}>
                                <div className="relative">
                                  <input
                                    ref={(el) => (inputRefs.current[`${activeDay}-${idx}-${col.key}`] = el)}
                                    type={col.type === "number" ? "number" : "text"}
                                    value={val}
                                    onChange={(e) => handleCellChange(activeDay, idx, col.key as keyof ReportRow, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        handleEnterNavigation(e, idx, col.key);
                                      }
                                    }}
                                    onBlur={(e) => {
                                      if (isTracking) {
                                        const formatted = formatTrackingNumber(e.target.value, lastTrackingPrefix);
                                        if (formatted !== e.target.value) {
                                          handleCellChange(activeDay, idx, "tracking", formatted);
                                        }
                                        const prefix = extractTrackingPrefix(formatted);
                                        if (prefix) setLastTrackingPrefix(prefix);
                                      }
                                    }}
                                    list={isTracking ? "tracking-suggestions" : isReceiverPhone ? "phone-suggestions" : undefined}
                                    className={`w-full bg-transparent px-1.5 py-1 rounded-lg text-slate-800 focus:bg-white focus:ring-1 focus:ring-red-500 border border-transparent hover:border-slate-300 focus:border-red-500 transition-colors overflow-hidden no-scrollbar ${
                                      isTracking
                                        ? "font-mono font-bold text-xs sm:text-sm text-amber-800 tracking-wide"
                                        : isReceiverPhone
                                        ? `font-mono font-bold text-xs sm:text-sm tracking-wide ${phoneDupCount > 1 ? "text-red-600 pr-6" : "text-cyan-800"}`
                                        : col.mono
                                        ? "font-mono text-xs sm:text-sm"
                                        : "text-xs sm:text-sm"
                                    } ${NUMBER_KEYS.includes(col.key) ? "text-center" : "text-left"}`}
                                  />
                                  {phoneDupCount > 1 && (
                                    <span
                                      title={`លេខទូរស័ព្ទនេះលេចឡើង ${phoneDupCount} ដងក្នុងថ្ងៃនេះ`}
                                      className="absolute right-0.5 top-1/2 -translate-y-1/2 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none pointer-events-none"
                                    >
                                      ×{phoneDupCount}
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          <td className="p-1 text-center">
                            <button
                              onClick={() => deleteRow(idx)}
                              title="លុបជួរដេកនេះ"
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Controls */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <button
                  onClick={addRow}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition border border-slate-300 shadow-sm"
                >
                  <Plus className="w-4 h-4 text-red-600" />
                  <span>បន្ថែមជួរដេក (Add Row)</span>
                </button>

                <span className="text-xs text-slate-500 font-medium">
                  សរុបជួរដេកទាំងអស់: <strong className="text-slate-800 font-mono">{currentDayData.rows?.length || 0}</strong>
                </span>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Global Tracking / Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-16 px-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2 flex-1 mr-4">
                <Search className="w-5 h-5 text-red-600" />
                <input
                  type="text"
                  autoFocus
                  placeholder="វាយបញ្ចូលលេខបៀល លេខទូរស័ព្ទ ឬបញ្ហា..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-slate-900 focus:outline-none text-sm placeholder-slate-400 font-medium"
                />
              </div>
              <button onClick={() => setIsSearchOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-100">
              {searchQuery.trim() === "" ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  <PackageSearch className="w-8 h-8 mx-auto mb-2 opacity-50 text-red-500" />
                  <span>សូមវាយបញ្ចូលពាក្យគន្លឹះដើម្បីស្វែងរកក្នុងខែទាំងមូល</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">មិនមានទិន្នន័យដែលត្រូវគ្នានឹង "{searchQuery}" ទេ</div>
              ) : (
                searchResults.map(({ day, rowIndex, row }, i) => (
                  <div
                    key={i}
                    onClick={() => handleJumpToRow(day, rowIndex)}
                    className="py-3 px-2 hover:bg-slate-50 cursor-pointer rounded-xl transition flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="px-2 py-0.5 bg-red-600 text-white font-semibold text-xs rounded-md">ថ្ងៃទី {day}</span>
                        <span className="font-mono font-bold text-slate-900 text-sm">{row.tracking || "គ្មានលេខបៀល"}</span>
                      </div>
                      <div className="text-xs text-slate-500 flex space-x-3">
                        <span>អ្នកទទួល: {row.receiverPhone || "N/A"}</span>
                        {row.issue && <span className="text-amber-700 font-medium">បញ្ហា: {row.issue}</span>}
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      {row.cod && <div className="text-amber-700 font-bold">COD: {row.cod} ៛</div>}
                      {row.cc && <div className="text-teal-700 font-bold">CC: {row.cc} ៛</div>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Telegram Bot Config & Sync Settings Modal */}
      {isTelegramModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center space-x-2.5">
                <Bot className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">ការកំណត់ Telegram Bot Database</h3>
              </div>
              <button onClick={() => setIsTelegramModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs sm:text-sm overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-300">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-700 font-semibold block">Telegram Bot Token:</label>
                <input
                  type="text"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-700 font-semibold block">Chat ID / Channel Handle:</label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="@my_stock_db_2026"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-700 font-semibold block">កំណត់ចំណាំពេល រក្សាទុក (Optional Note):</label>
                <input
                  type="text"
                  value={saveNote}
                  onChange={(e) => setSaveNote(e.target.value)}
                  placeholder="ឧទាហរណ៍: បញ្ចប់ការងារចុងខែ..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              {/* Actions Grid */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <button
                  onClick={handleTestBot}
                  disabled={isTestingBot}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold rounded-xl border border-slate-300 text-xs flex items-center justify-center space-x-1"
                >
                  {isTestingBot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />}
                  <span>តេស្តភ្ជាប់</span>
                </button>

                <button
                  onClick={handleSaveToTelegram}
                  disabled={isSavingToTelegram}
                  className="px-3 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center justify-center space-x-1 shadow-sm"
                >
                  {isSavingToTelegram ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
                  <span>Save ទៅ Telegram</span>
                </button>

                <button
                  onClick={handleSyncFromTelegram}
                  disabled={isSyncingFromTelegram}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center justify-center space-x-1 shadow-sm"
                >
                  {isSyncingFromTelegram ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudDownload className="w-3.5 h-3.5" />}
                  <span>Sync ពី Telegram</span>
                </button>
              </div>

              {/* Telegram Bot Command Handler Section */}
              <div className="bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-bold text-emerald-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Telegram Scan Command Handler</span>
                  </div>
                  <span className="text-[10px] text-amber-800 font-mono bg-white px-2 py-0.5 rounded border border-amber-200 font-bold">
                    scan:TRACKING|PHONE
                  </span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">
                  អ្នកអាចផ្ញើសារតាម Telegram ទៅកាន់ Bot ជាមួយនឹងទម្រង់ <code className="text-amber-800 bg-white px-1.5 py-0.5 rounded font-mono font-bold border border-amber-200">scan:TRACKING_NO|PHONE_NO</code> (ឧទាហរណ៍៖ <span className="font-mono text-cyan-800 font-bold">scan:5677714|0966997172</span>)។ Bot នឹងបន្ថែមទិន្នន័យនេះទៅក្នុង Web App ដោយស្វ័យប្រវត្តិ!
                </p>

                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="scan:5677714|0966997172"
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={handleExecuteScanCommand}
                    disabled={isExecutingScan}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center space-x-1 shrink-0 shadow-sm"
                  >
                    {isExecutingScan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>តេស្តស្កែន (Scan)</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-800">💡 របៀបដំណើការ Telegram Database ៖</p>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li>ផ្ញើសារទម្រង់ <strong className="text-amber-800 font-mono">scan:TRACKING_NO|PHONE_NO</strong> ទៅកាន់ Bot សម្រាប់ការស្កែនបញ្ចូលភ្លាមៗ។</li>
                  <li>ចុច <strong>Save ទៅ Telegram</strong> ដើម្បីផ្ញើរបាយការណ៍សង្ខេប និងឯកសារ JSON ទៅកាន់ Channel/Chat {chatId}។</li>
                  <li>ចុច <strong>Sync ពី Telegram</strong> ដើម្បីទាញយកទិន្នន័យស្តុកចុងក្រោយគេមកលើប្រព័ន្ធវិញភ្លាមៗ។</li>
                </ul>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setIsTelegramModalOpen(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs"
              >
                បិទ (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Data Confirmation Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2 text-red-600 font-bold text-base sm:text-lg">
                <Trash2 className="w-5 h-5" />
                <span>សម្អាតទិន្នន័យ (Clear Data)</span>
              </div>
              <button
                onClick={() => setIsClearModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-600">
              សូមជ្រើសរើសជម្រើសសម្អាតទិន្នន័យដែលអ្នកចង់អនុវត្ត៖
            </p>

            <div className="space-y-2.5">
              {/* Option 1: Clear current active day */}
              <button
                onClick={handleClearActiveDay}
                className="w-full flex items-center justify-between p-3 bg-amber-50/60 hover:bg-amber-100/80 border border-amber-200 rounded-xl transition text-left group"
              >
                <div>
                  <div className="text-xs font-bold text-amber-800">សម្អាតតែថ្ងៃទី {activeDay} (Clear Day {activeDay})</div>
                  <div className="text-[11px] text-slate-500">លុបតែទិន្នន័យបៀល និងស្ថិតិថ្ងៃទី {activeDay} ប៉ុណ្ណោះ</div>
                </div>
                <Trash2 className="w-4 h-4 text-amber-700 opacity-60 group-hover:opacity-100" />
              </button>

              {/* Option 2: Clear all month data */}
              <button
                onClick={handleClearAllData}
                className="w-full flex items-center justify-between p-3 bg-red-50/60 hover:bg-red-100/80 border border-red-200 rounded-xl transition text-left group"
              >
                <div>
                  <div className="text-xs font-bold text-red-700">លុបទិន្នន័យទាំងអស់ (Clear All Month Data)</div>
                  <div className="text-[11px] text-slate-500">លុបទិន្នន័យទាំង ៣១ ថ្ងៃចេញពីប្រព័ន្ធទាំងស្រុង</div>
                </div>
                <Trash2 className="w-4 h-4 text-red-600 opacity-60 group-hover:opacity-100" />
              </button>

              {/* Option 3: Reset to template seed data */}
              <button
                onClick={handleResetSeedData}
                className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition text-left group"
              >
                <div>
                  <div className="text-xs font-bold text-blue-700">កំណត់ឡើងវិញទៅគំរូដើម (Reset to Default Seed)</div>
                  <div className="text-[11px] text-slate-500">ផ្ទុកទិន្នន័យគំរូដើមឡើងវិញ</div>
                </div>
                <RotateCcw className="w-4 h-4 text-blue-600 opacity-60 group-hover:opacity-100" />
              </button>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setIsClearModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                បោះបង់ (Cancel)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
