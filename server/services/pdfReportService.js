import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import PDFDocument from 'pdfkit';
import { collections } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONTH_NAMES = [
  'જાન્યુઆરી',
  'ફેબ્રુઆરી',
  'માર્ચ',
  'એપ્રિલ',
  'મે',
  'જૂન',
  'જુલાઈ',
  'ઓગસ્ટ',
  'સપ્ટેમ્બર',
  'ઓક્ટોબર',
  'નવેમ્બર',
  'ડિસેમ્બર'
];

// Helper: check if a habit log represents a truly completed check-in
const isLogDone = (l) => {
  if (!l) return false;
  if (l.isCompleted === true || l.isCompleted === 1 || l.isCompleted === 'true') return true;
  if (typeof l.value === 'number') return l.value > 0;
  if (typeof l.value === 'string') {
    const trimmed = l.value.trim();
    if (!trimmed || trimmed === '0' || trimmed === '00:00' || trimmed.toLowerCase() === 'false') return false;
    const num = Number(trimmed);
    if (!isNaN(num)) return num > 0;
    return true;
  }
  return false;
};

// Helper: parse HH:MM AM/PM to minutes from midnight
const timeStringToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridian = match[3] ? match[3].toUpperCase() : null;

  if (meridian === 'PM' && hours < 12) hours += 12;
  if (meridian === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
};

// Helper: convert minutes from midnight to HH:MM AM/PM
const minutesToTimeString = (totalMinutes) => {
  if (totalMinutes === null || isNaN(totalMinutes)) return 'N/A';
  let hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = Math.round(totalMinutes % 60);
  const meridian = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${meridian}`;
};

/**
 * Common Chromium Launch Arguments for Cloud & Local Environments
 */
const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--no-first-run',
  '--no-zygote',
  '--font-render-hinting=none',
  '--hide-scrollbars',
  '--disable-extensions'
];

/**
 * Font Path Resolver - Defined FIRST to guarantee availability for embedding and PDFKit
 */
const findFontPath = (fontFileName) => {
  const possiblePaths = [
    path.resolve(__dirname, '..', 'assets', 'fonts', fontFileName),
    path.resolve(__dirname, 'assets', 'fonts', fontFileName),
    path.resolve(process.cwd(), 'server', 'assets', 'fonts', fontFileName),
    path.resolve(process.cwd(), 'assets', 'fonts', fontFileName),
    path.resolve('server', 'assets', 'fonts', fontFileName),
    path.resolve('assets', 'fonts', fontFileName)
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
};

let cachedFontsCSS = null;

/**
 * Embed local TTF fonts directly into HTML as base64
 * Cached in memory so disk reading occurs only once on startup (0ms overhead & no memory leak)
 */
const getEmbeddedFontsCSS = () => {
  if (cachedFontsCSS !== null) return cachedFontsCSS;
  try {
    const regPath = findFontPath('NotoSansGujarati-Regular.ttf');
    const boldPath = findFontPath('NotoSansGujarati-Bold.ttf');
    let css = '';
    if (regPath && fs.existsSync(regPath)) {
      const regBase64 = fs.readFileSync(regPath).toString('base64');
      css += `
        @font-face {
          font-family: 'Noto Sans Gujarati';
          font-weight: 400;
          font-style: normal;
          src: url('data:font/truetype;charset=utf-8;base64,${regBase64}') format('truetype');
        }
      `;
    }
    if (boldPath && fs.existsSync(boldPath)) {
      const boldBase64 = fs.readFileSync(boldPath).toString('base64');
      css += `
        @font-face {
          font-family: 'Noto Sans Gujarati';
          font-weight: 700;
          font-style: normal;
          src: url('data:font/truetype;charset=utf-8;base64,${boldBase64}') format('truetype');
        }
      `;
    }
    cachedFontsCSS = css;
    return css;
  } catch (err) {
    console.warn('⚠️ [PDF] Could not inline font base64:', err.message);
    return '';
  }
};

/**
 * Sequential execution lock for PDF generation to prevent multiple parallel Chromium spawns
 * from exceeding Render RAM limit (512MB).
 */
let pdfGenerationQueue = Promise.resolve();
const runWithPDFLock = (fn) => {
  const job = pdfGenerationQueue.then(fn, fn);
  pdfGenerationQueue = job.catch(() => {});
  return job;
};

/**
 * Recursively search for chrome binary in cache directories
 */
const findChromeInCache = (dir) => {
  try {
    if (!fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findChromeInCache(fullPath);
        if (found) return found;
      } else if (
        (entry.name === 'chrome' || entry.name === 'chrome.exe' || entry.name === 'chromium' || entry.name === 'chrome-headless-shell') &&
        !entry.name.endsWith('.deb') &&
        !entry.name.endsWith('.rpm')
      ) {
        if (process.platform === 'linux') {
          try { fs.chmodSync(fullPath, 0o755); } catch (_) {}
        }
        return fullPath;
      }
    }
  } catch (_) {}
  return null;
};

/**
 * Intelligently Launch Chromium across Local OS, Render Native, Docker, and Serverless
 */
const launchBrowser = async () => {
  // 1. Explicit environment variable path
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    try {
      console.log(`🚀 [PDF Generator] Launching via PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
      return await puppeteerCore.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        headless: true,
        args: BROWSER_ARGS
      });
    } catch (err) {
      console.warn('⚠️ PUPPETEER_EXECUTABLE_PATH launch failed:', err.message);
    }
  }

  // 2. Search Render / Linux / Local cache directories for downloaded Chrome
  const cacheDirs = [
    path.resolve(__dirname, '..', '.cache', 'puppeteer'),
    path.resolve(__dirname, '.cache', 'puppeteer'),
    path.resolve(process.cwd(), 'server', '.cache', 'puppeteer'),
    path.resolve(process.cwd(), '.cache', 'puppeteer'),
    '/opt/render/.cache/puppeteer',
    path.join(process.env.HOME || '/root', '.cache', 'puppeteer'),
    path.resolve('.cache', 'puppeteer'),
    path.resolve('..', '.cache', 'puppeteer'),
    path.resolve('node_modules', 'puppeteer', '.local-chromium')
  ];

  for (const cacheDir of cacheDirs) {
    const foundChrome = findChromeInCache(cacheDir);
    if (foundChrome && fs.existsSync(foundChrome)) {
      try {
        console.log(`🚀 [PDF Generator] Launching discovered cached Chrome: ${foundChrome}`);
        return await puppeteerCore.launch({
          executablePath: foundChrome,
          headless: true,
          args: BROWSER_ARGS
        });
      } catch (cacheErr) {
        console.warn(`⚠️ Cached Chrome ${foundChrome} launch failed:`, cacheErr.message);
      }
    }
  }

  // 3. Try @sparticuz/chromium for Linux environment (Render Native, Lambda, Railway)
  if (process.platform === 'linux') {
    try {
      console.log('🚀 [PDF Generator] Attempting @sparticuz/chromium for Linux environment...');
      chromium.setGraphicsMode = false;
      const sparticuzPath = await chromium.executablePath();
      if (sparticuzPath) {
        console.log(`🚀 [PDF Generator] Found @sparticuz/chromium at: ${sparticuzPath}`);
        return await puppeteerCore.launch({
          args: [
            ...chromium.args,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--font-render-hinting=none',
            '--disable-gpu'
          ],
          defaultViewport: chromium.defaultViewport,
          executablePath: sparticuzPath,
          headless: chromium.headless
        });
      }
    } catch (sparticuzErr) {
      console.warn('⚠️ @sparticuz/chromium launch failed:', sparticuzErr.message);
    }
  }

  // 4. Try bundled Puppeteer launch directly (will read puppeteer.config.cjs)
  try {
    console.log('🚀 [PDF Generator] Attempting direct puppeteer.launch()...');
    return await puppeteer.launch({
      headless: true,
      args: BROWSER_ARGS
    });
  } catch (defaultErr) {
    console.warn('⚠️ Default puppeteer.launch() failed:', defaultErr.message);
  }

  // 5. Try standard system binary paths on Windows, Mac, Linux
  const candidatePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        console.log(`🚀 [PDF Generator] Launching system Chromium/Chrome at: ${p}`);
        return await puppeteerCore.launch({
          executablePath: p,
          headless: true,
          args: BROWSER_ARGS
        });
      } catch (err) {
        console.warn(`⚠️ System path ${p} launch failed:`, err.message);
      }
    }
  }

  return null;
};

/**
 * Optimize Cloudinary avatar URLs for fast, high-res circular embedding
 */
const optimizeAvatarUrl = (url, size = 120) => {
  if (!url || typeof url !== 'string') return '';
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    return url.replace(
      '/upload/',
      `/upload/w_${size},h_${size},c_fill,g_face,q_auto,f_auto/`
    );
  }
  return url;
};

/**
 * Vector SVG Icons for Bulletproof Cross-Platform Emojis
 * Guarantees 100% crisp, colorful icons on Render Linux with zero missing emoji font issues
 */
const ICONS = {
  trophy: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" style="display:inline-block;vertical-align:-2px"><path d="M7 4h10v5a5 5 0 01-10 0V4z" fill="#f59e0b"/><path d="M5 6H3a2 2 0 00-2 2v1a4 4 0 004 4h2V9H5V6zm14 0h2a2 2 0 012 2v1a4 4 0 01-4 4h-2V9h2V6z" fill="#fbbf24"/><path d="M10 16h4v3h-4z" fill="#d97706"/><path d="M8 19h8v2H8z" fill="#b45309"/></svg>`,
  
  calendar: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" style="display:inline-block;vertical-align:-1.5px;margin-right:3px"><rect x="3" y="4" width="18" height="18" rx="3" fill="#0f766e" stroke="#99f6e4" stroke-width="1.2"/><rect x="3" y="4" width="18" height="5" rx="2" fill="#115e59"/><circle cx="7.5" cy="13" r="1.2" fill="#ccfbf1"/><circle cx="12" cy="13" r="1.2" fill="#ccfbf1"/><circle cx="16.5" cy="13" r="1.2" fill="#ccfbf1"/><circle cx="7.5" cy="17.5" r="1.2" fill="#ccfbf1"/><circle cx="12" cy="17.5" r="1.2" fill="#ccfbf1"/><circle cx="16.5" cy="17.5" r="1.2" fill="#ccfbf1"/></svg>`,
  
  target: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" style="display:inline-block;vertical-align:-1.5px;margin-right:3px"><circle cx="12" cy="12" r="9.5" fill="#ccfbf1" stroke="#0f766e" stroke-width="1.2"/><circle cx="12" cy="12" r="6" fill="#0f766e"/><circle cx="12" cy="12" r="2.5" fill="#ffffff"/></svg>`,
  
  clipboard: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" style="display:inline-block;vertical-align:middle"><rect x="4" y="5" width="16" height="16" rx="2" fill="#ccfbf1" stroke="#0f766e" stroke-width="1.5"/><path d="M9 3h6a1 1 0 011 1v2H8V4a1 1 0 011-1z" fill="#0f766e"/><path d="M8 11h8M8 15h5" stroke="#0f766e" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  
  star: `<svg viewBox="0 0 24 24" width="14" height="14" fill="#f59e0b" style="display:inline-block;vertical-align:-2px;margin:0 2px"><path d="M12 2l2.9 6.2 6.8.9-5 4.8 1.2 6.8-5.9-3.2-5.9 3.2 1.2-6.8-5-4.8 6.8-.9z"/></svg>`,
  
  prayingHands: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" style="display:inline-block;vertical-align:-2.5px;margin:0 2px"><path d="M11 2.5a1.5 1.5 0 0 1 2 0v10l-2 1.8-2-1.8V5a1.5 1.5 0 0 1 2-2.5z" fill="#f59e0b"/><path d="M7 6a1.5 1.5 0 0 1 2 0v8l-2 1.8-1.5-1.5V7.5A1.5 1.5 0 0 1 7 6z" fill="#fbbf24"/><path d="M17 6a1.5 1.5 0 0 0-2 0v8l2 1.8 1.5-1.5V7.5A1.5 1.5 0 0 0 17 6z" fill="#fbbf24"/><path d="M12 21.5c-3.5 0-5.5-2.2-5.5-4.5l5.5-2 5.5 2c0 2.3-2 4.5-5.5 4.5z" fill="#d97706"/></svg>`,
  
  sparkle: `<svg viewBox="0 0 24 24" width="14" height="14" fill="#0f766e" style="display:inline-block;vertical-align:-2px;margin:0 2px"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z"/></svg>`,
  
  shield: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" style="display:inline-block;vertical-align:-2px;margin:0 2px"><path d="M12 2L4 5v6.5C4 16.5 7.5 21 12 22c4.5-1 8-5.5 8-10.5V5l-8-3z" fill="#047857"/><path d="M12 4.2V19.8C15 18.8 17.8 15 17.8 11.5V6.3L12 4.2z" fill="#10b981"/><path d="M9 11l2 2 4-4" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  shieldGold: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" style="display:inline-block;vertical-align:middle"><path d="M12 2L4 5v6.5C4 16.5 7.5 21 12 22c4.5-1 8-5.5 8-10.5V5l-8-3z" fill="#b45309"/><path d="M12 4.2V19.8C15 18.8 17.8 15 17.8 11.5V6.3L12 4.2z" fill="#f59e0b"/><path d="M9 11l2 2 4-4" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  sparkleGold: `<svg viewBox="0 0 24 24" width="22" height="22" fill="#fbbf24" style="display:inline-block;vertical-align:middle"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z"/></svg>`,

  crown: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" style="display:inline-block;vertical-align:-2px;margin:0 2px"><path d="M3 18h18v2H3v-2zm1.5-3l2.5-8 5 4 5-4 2.5 8H4.5z" fill="#f59e0b"/></svg>`,

  fire: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" style="display:inline-block;vertical-align:-2px;margin:0 2px"><path d="M12 23c-4.97 0-9-4.03-9-9 0-3.87 2.33-7.23 6-8.48V8c0 1.66 1.34 3 3 3s3-1.34 3-3V5.52c3.67 1.25 6 4.61 6 8.48 0 4.97-4.03 9-9 9z" fill="#ef4444"/><path d="M12 19c-2.76 0-5-2.24-5-5 0-1.85 1.01-3.46 2.5-4.32V11c0 1.1.9 2 2 2s2-.9 2-2v-1.32c1.49.86 2.5 2.47 2.5 4.32 0 2.76-2.24 5-5 5z" fill="#fbbf24"/></svg>`,

  heart: `<svg viewBox="0 0 24 24" width="15" height="15" fill="#ef4444" style="display:inline-block;vertical-align:-2px;margin:0 2px"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,

  flower: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" style="display:inline-block;vertical-align:-2px;margin:0 2px"><circle cx="12" cy="12" r="3" fill="#f59e0b"/><path d="M12 4a3 3 0 0 0-3 3c0 2 3 4 3 4s3-2 3-4a3 3 0 0 0-3-3zm0 16a3 3 0 0 0 3-3c0-2-3-4-3-4s-3 2-3 4a3 3 0 0 0 3 3zm-8-8a3 3 0 0 0 3 3c2 0 4-3 4-3s-2-3-4-3a3 3 0 0 0-3 3zm16 0a3 3 0 0 0-3-3c-2 0-4 3-4 3s2 3 4 3a3 3 0 0 0 3-3z" fill="#ec4899"/></svg>`,

  book: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" style="display:inline-block;vertical-align:-2px;margin:0 2px"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z" fill="#3b82f6"/><path d="M6 2v17.5a2.5 2.5 0 0 0 2.5 2.5H20V2H6z" fill="#60a5fa"/><path d="M9 7h8M9 11h6" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/></svg>`,

  rosary: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" style="display:inline-block;vertical-align:-2px;margin:0 2px"><circle cx="12" cy="7" r="2.5" fill="#f59e0b"/><circle cx="6.5" cy="11" r="2" fill="#d97706"/><circle cx="17.5" cy="11" r="2" fill="#d97706"/><circle cx="8" cy="17" r="2" fill="#d97706"/><circle cx="16" cy="17" r="2" fill="#d97706"/><circle cx="12" cy="19" r="2.5" fill="#b45309"/><path d="M12 19v4m-2-2h4" stroke="#b45309" stroke-width="1.5" stroke-linecap="round"/></svg>`,

  check: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" style="display:inline-block;vertical-align:-2px;margin:0 2px"><circle cx="12" cy="12" r="10" fill="#10b981"/><path d="M8 12l3 3 5-5" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  goldMedal: `<span style="display:inline-flex;align-items:center;justify-content:center;gap:3px"><svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle"><circle cx="12" cy="12" r="10" fill="#f59e0b"/><circle cx="12" cy="12" r="7.5" fill="#fbbf24"/><path d="M12 5l1.5 3.5 3.8.4-2.8 2.6.7 3.8-3.2-1.8-3.2 1.8.7-3.8-2.8-2.6 3.8-.4z" fill="#b45309"/></svg> 1</span>`,
  
  silverMedal: `<span style="display:inline-flex;align-items:center;justify-content:center;gap:3px"><svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle"><circle cx="12" cy="12" r="10" fill="#64748b"/><circle cx="12" cy="12" r="7.5" fill="#94a3b8"/><path d="M12 5l1.5 3.5 3.8.4-2.8 2.6.7 3.8-3.2-1.8-3.2 1.8.7-3.8-2.8-2.6 3.8-.4z" fill="#334155"/></svg> 2</span>`,
  
  bronzeMedal: `<span style="display:inline-flex;align-items:center;justify-content:center;gap:3px"><svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align:middle"><circle cx="12" cy="12" r="10" fill="#b45309"/><circle cx="12" cy="12" r="7.5" fill="#d97706"/><path d="M12 5l1.5 3.5 3.8.4-2.8 2.6.7 3.8-3.2-1.8-3.2 1.8.7-3.8-2.8-2.6 3.8-.4z" fill="#78350f"/></svg> 3</span>`
};

/**
 * Format any user string / title for HTML reports by replacing emoji unicodes with high-res inline SVGs
 * Completely eliminates broken boxes for 🙏🏻, 🙏, 🏆, ✨, 🌟, 🛡️, etc.
 */
const formatHTMLTextWithSvgIcons = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    // 1. Praying hands with any skin tones, variation selectors, or ZWJ (🙏🏻, 🙏🏼, 🙏🏽, 🙏🏾, 🙏🏿, 🙏, 🙌, 🤝)
    .replace(/(?:(?:\u{1F64F}|\uD83D\uDE4F|\u{1F64C}|\uD83D\uDE4C|\u{1F91D}|\uD83E\uDD1D)(?:[\uFE00-\uFE0F\u200D]|\uD83C[\uDFFB-\uDFFF]|[\u{1F3FB}-\u{1F3FF}])?)/gu, ICONS.prayingHands)
    // 2. Trophies, crowns, medals
    .replace(/(?:\u{1F3C6}|\uD83C\uDFC6)/gu, ICONS.trophy)
    .replace(/(?:\u{1F451}|\uD83D\uDC51)/gu, ICONS.crown)
    .replace(/(?:\u{1F947}|\uD83E\uDD47)/gu, ICONS.goldMedal)
    .replace(/(?:\u{1F948}|\uD83E\uDD48)/gu, ICONS.silverMedal)
    .replace(/(?:\u{1F949}|\uD83E\uDD49)/gu, ICONS.bronzeMedal)
    // 3. Sparkles, stars, shields
    .replace(/(?:\u{2728}|\u2728|\u{1F31F}|\uD83C\uDF1F)/gu, ICONS.sparkle)
    .replace(/(?:\u{2B50}|\u2B50|\u{2605}|\u2605)/gu, ICONS.star)
    .replace(/(?:(?:\u{1F6E1}|\uD83D\uDEE1)(?:[\uFE00-\uFE0F])?)/gu, ICONS.shield)
    // 4. Fire, hearts
    .replace(/(?:\u{1F525}|\uD83D\uDD25)/gu, ICONS.fire)
    .replace(/(?:(?:\u{2764}|\u2764|\u{1F496}|\u{1F497}|\u{1F90D}|\u{1F90E}|\u{1F9E1}|\uD83D\uDC96|\uD83D\uDC97|\uD83E\uDD0D|\uD83E\uDD0E|\uD83E\uDDE1)(?:[\uFE00-\uFE0F])?)/gu, ICONS.heart)
    // 5. Target, books, beads, flowers, check
    .replace(/(?:\u{1F3AF}|\uD83C\uDFAF)/gu, ICONS.target)
    .replace(/(?:\u{1F4D6}|\u{1F4D5}|\u{1F4D8}|\u{1F4DA}|\uD83D\uDCD6|\uD83D\uDCD5|\uD83D\uDCD8|\uD83D\uDCDA)/gu, ICONS.book)
    .replace(/(?:\u{1F4FF}|\uD83D\uDCFF)/gu, ICONS.rosary)
    .replace(/(?:\u{1F338}|\u{1F33A}|\u{1F33C}|\u{1F337}|\u{1F33F}|\uD83C\uDF38|\uD83C\uDF3A|\uD83C\uDF3C|\uD83C\uDF37|\uD83C\uDF3F)/gu, ICONS.flower)
    .replace(/(?:\u{2705}|\u2705|(?:\u{2714}|\u2714)(?:[\uFE00-\uFE0F])?)/gu, ICONS.check)
    // 6. Strip ALL remaining astral emojis, surrogate pairs, skin tones, and variation selectors
    .replace(/(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u{1F000}-\u{1FAFF}]|[\u{1F300}-\u{1F6FF}]|[\u{2600}-\u{27BF}]|[\uFE00-\uFE0F\u200D\u200C]|[\u{1F3FB}-\u{1F3FF}])/gu, '')
    .trim();
};

/**
 * Clean text for PDFKit standard TTF fonts (strips all non-printable emojis to prevent font errors)
 */
const cleanTextForPDFKit = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u{1F000}-\u{1FAFF}]|[\u{1F300}-\u{1F6FF}]|[\u{2600}-\u{27BF}]|[\uFE00-\uFE0F\u200D\u200C]|[\u{1F3FB}-\u{1F3FF}])/gu, '')
    .trim();
};

/**
 * Build HTML Template for Professional Multi-Page PDF
 * Matches exact format from reference PDF
 */
const buildReportHTML = (group, monthStr, memberReports) => {
  const [yearStr, monthNumStr] = (monthStr || '').split('-');
  const monthNum = parseInt(monthNumStr, 10);
  const monthName = MONTH_NAMES[monthNum - 1] || monthStr;

  const totalMembers = memberReports.length;

  const cleanGroupName = formatHTMLTextWithSvgIcons(group.name || 'Sankalp Group');

  const avgCompletion =
    totalMembers > 0
      ? Math.round(
          memberReports.reduce(
            (s, m) =>
              s + (m.overallStats?.overallCompletionRate || 0),
            0
          ) / totalMembers
        )
      : 0;

  /**
   * Leaderboard Rows
   */
  const leaderboardRowsHTML = memberReports
    .map((m, idx) => {
      const rank = idx + 1;

      const medal =
        rank === 1
          ? ICONS.goldMedal
          : rank === 2
          ? ICONS.silverMedal
          : rank === 3
          ? ICONS.bronzeMedal
          : `${rank}`;

      const medalClass =
        rank === 1
          ? 'rank-gold'
          : rank === 2
          ? 'rank-silver'
          : rank === 3
          ? 'rank-bronze'
          : 'rank-normal';

      const comp =
        m.overallStats?.overallCompletionRate || 0;

      const compClass =
        comp >= 80
          ? 'completion-high'
          : comp >= 50
          ? 'completion-medium'
          : 'completion-low';

      const avatarUrl = optimizeAvatarUrl(
        m.userProfile?.avatar || '',
        60
      );

      const rawUserName = m.userProfile?.name || 'Unknown';
      const formattedUserName = formatHTMLTextWithSvgIcons(rawUserName);
      const initial = (cleanTextForPDFKit(rawUserName) || 'U')
        .charAt(0)
        .toUpperCase();

      const avatarHTML = avatarUrl
        ? `
          <div class="avatar-circle-sm">
            <img
              src="${avatarUrl}"
              class="avatar-img"
              onerror="this.outerHTML='<span class=\\'avatar-letter-sm\\'>${initial}</span>'"
            />
          </div>
        `
        : `
          <div class="avatar-circle-sm">
            <span class="avatar-letter-sm">${initial}</span>
          </div>
        `;

      return `
        <tr class="leaderboard-row ${
          idx % 2 === 1 ? 'row-alt' : ''
        }">

          <td class="leaderboard-rank ${medalClass}">
            ${medal}
          </td>

          <td class="leaderboard-name">
            <div class="member-name-wrap">
              ${avatarHTML}

              <div class="member-name-text">
                ${formattedUserName}
              </div>
            </div>
          </td>

          <td class="leaderboard-score">
            <span class="score-number">
              ${m.overallStats?.disciplineScore || 0}
            </span>
            <span class="score-label">
              દિવસ
            </span>
          </td>

          <td class="leaderboard-rate">
            <span class="completion-badge ${compClass}">
              ${comp}%
            </span>
          </td>

        </tr>
      `;
    })
    .join('');

  /**
   * Member Individual Pages
   */
  const memberPagesHTML = memberReports
    .map((report, idx) => {
      const rawMemberName = report.userProfile?.name || 'સભ્ય';
      const memberName = formatHTMLTextWithSvgIcons(rawMemberName);

      const memberUsername =
        report.userProfile?.username
          ? `@${report.userProfile.username}`
          : '';

      const activeDays =
        report.activeDaysInMonth || 30;

      const disciplineScore =
        report.overallStats?.disciplineScore || 0;

      const completionRate =
        report.overallStats?.overallCompletionRate || 0;

      const pageNum = idx + 2;

      const totalPages =
        memberReports.length + 1;

      const userRank = idx + 1;

      const avatarUrl = optimizeAvatarUrl(
        report.userProfile?.avatar || '',
        160
      );

      const initial = (cleanTextForPDFKit(rawMemberName) || 'U')
        .charAt(0)
        .toUpperCase();

      const memberAvatarHTML = avatarUrl
        ? `
          <div class="avatar-circle-lg">
            <img
              src="${avatarUrl}"
              class="avatar-img"
              onerror="this.outerHTML='<span class=\\'avatar-letter-lg\\'>${initial}</span>'"
            />
          </div>
        `
        : `
          <div class="avatar-circle-lg">
            <span class="avatar-letter-lg">
              ${initial}
            </span>
          </div>
        `;

      /**
       * Habit Rows
       */
      const habitRowsHTML = (
        report.habitSummaries || []
      )
        .map((h, hIdx) => {
          let detailStr = `
            <b>${h.completedDaysCount}</b>
            / ${activeDays} દિવસ
          `;

          let avgStr = '-';

          if (h.type === 'count') {
            const total =
              h.typeDetails?.totalCount || 0;

            detailStr = `
              <div class="habit-main-value">
                ${total.toLocaleString()}
                ${h.targetUnit || ''}
              </div>

              <div class="habit-sub-value">
                (${h.completedDaysCount}/${activeDays} દિવસ)
              </div>
            `;

            avgStr = `
              રોજ
              <b>
                ${h.typeDetails?.dailyAverage || 0}
              </b>
              ${h.targetUnit || ''}
            `;
          } else if (h.type === 'time_target') {
            const hrs =
              h.typeDetails?.totalHours || 0;

            const mins =
              h.typeDetails?.totalMinutes || 0;

            detailStr = `
              <div class="habit-main-value">
                ${
                  hrs >= 1
                    ? `${hrs} કલાક`
                    : `${mins} મિનિટ`
                }
              </div>

              <div class="habit-sub-value">
                (${h.completedDaysCount}/${activeDays} દિવસ)
              </div>
            `;

            avgStr = `
              રોજ
              <b>
                ${h.typeDetails?.dailyAverageMinutes || 0}
              </b>
              મિનિટ
            `;
          } else if (h.type === 'time_of_day') {
            avgStr = `
              સરેરાશ
              <b>
                ${h.typeDetails?.averageTime || 'N/A'}
              </b>
            `;
          } else if (h.type === 'timer') {
            const totalMins = h.typeDetails?.totalMinutes || Math.round((h.typeDetails?.totalSeconds || 0) / 60);
            const avgMins = Math.round((h.typeDetails?.dailyAverageSeconds || 0) / 60);
            detailStr = `
              <div class="habit-main-value">
                ${totalMins} મિનિટ
              </div>

              <div class="habit-sub-value">
                (${h.completedDaysCount}/${activeDays} દિવસ)
              </div>
            `;

            avgStr = `
              રોજ
              <b>
                ${avgMins}
              </b>
              મિનિટ
            `;
          } else if (
            h.type === 'yes_no' ||
            h.type === 'boolean'
          ) {
            detailStr = `
              <div class="habit-main-value">
                ${h.completedDaysCount}
              </div>

              <div class="habit-sub-value">
                / ${activeDays} દિવસ
              </div>
            `;

            avgStr = `
              <b>
                ${h.completionPercentage}%
              </b>
              હાજરી
            `;
          }

          const comp =
            h.completionPercentage || 0;

          const barColor =
            comp >= 80
              ? '#0f766e'
              : comp >= 50
              ? '#d97706'
              : '#dc2626';

          const badgeClass =
            comp >= 80
              ? 'completion-high'
              : comp >= 50
              ? 'completion-medium'
              : 'completion-low';

          return `
            <tr class="habit-row ${
              hIdx % 2 === 1 ? 'row-alt' : ''
            }">

              <td class="habit-title-cell">
                <div class="habit-title">
                  ${formatHTMLTextWithSvgIcons(h.title)}
                </div>
              </td>

              <td class="habit-progress-cell">
                ${detailStr}
              </td>

              <td class="habit-average-cell">
                ${avgStr}
              </td>

              <td class="habit-rate-cell">

                <div class="progress-wrapper">

                  <div class="progress-track">
                    <div
                      class="progress-fill"
                      style="
                        width: ${Math.min(
                          Math.max(comp, 0),
                          100
                        )}%;
                        background-color: ${barColor};
                      "
                    ></div>
                  </div>

                  <span class="completion-badge ${badgeClass}">
                    ${comp}%
                  </span>

                </div>

              </td>

            </tr>
          `;
        })
        .join('');

      return `
        <div class="page member-page">

          <div class="page-body">

            <!-- PAGE TOP BAR -->
            <div class="page-top-bar">

              <div class="top-brand">
                <span class="invocation">
                  ॥ જય સ્વામિનારાયણ ॥
                </span>

                <span class="top-divider">•</span>

                <span>
                  ${cleanGroupName}
                </span>
              </div>

              <div class="page-number">
                પેજ ${pageNum} / ${totalPages}
              </div>

            </div>

            <!-- MEMBER PROFILE -->
            <div class="member-profile-card">

              <div class="profile-left">

                ${memberAvatarHTML}

                <div class="profile-information">

                  <div class="profile-name-row">

                    <span class="member-name">
                      ${memberName}
                    </span>

                    <span class="rank-pill">
                      રેન્ક #${userRank}
                    </span>

                    ${
                      memberUsername
                        ? `
                          <span class="username-pill">
                            ${memberUsername}
                          </span>
                        `
                        : ''
                    }

                  </div>

                  <div class="profile-meta-row">

                    <span class="meta-pill">
                      <span class="meta-icon">●</span>
                      ${cleanGroupName}
                    </span>

                    <span class="meta-pill">
                      <span class="meta-icon">${ICONS.calendar}</span>
                      ${monthName} ${yearStr}
                    </span>

                    <span class="meta-pill meta-pill-teal">
                      <span class="meta-icon">${ICONS.target}</span>
                      ${activeDays} દિવસ સક્રિય
                    </span>

                  </div>

                </div>

              </div>

              <div class="profile-kpis">

                <div class="kpi-box kpi-green">

                  <div class="kpi-label">
                    DISCIPLINE SCORE
                  </div>

                  <div class="kpi-value">
                    ${disciplineScore}
                    <span>/${activeDays}</span>
                  </div>

                </div>

                <div class="kpi-box kpi-teal">

                  <div class="kpi-label">
                    સફળતા દર
                  </div>

                  <div class="kpi-value">
                    ${completionRate}%
                  </div>

                </div>

              </div>

            </div>

            <!-- HABIT SECTION -->
            <div class="habit-section">

              <div class="section-heading">

                <div class="section-heading-left">
                  <span class="section-icon">${ICONS.clipboard}</span>

                  <div>
                    <div class="section-title">
                      ગ્રુપ નિયમ પ્રગતિ વિગત
                    </div>

                    <div class="section-subtitle">
                      ${memberName} ની માસિક નિયમ પાલન પ્રગતિ
                    </div>
                  </div>
                </div>

                <div class="section-month">
                  ${monthName} ${yearStr}
                </div>

              </div>

              <div class="table-container">

                <table class="report-table">

                  <thead>

                    <tr class="table-head">

                      <th class="col-habit-title">
                        નિયમનું નામ
                      </th>

                      <th class="col-habit-progress">
                        કુલ પ્રગતિ / દિવસો
                      </th>

                      <th class="col-habit-avg">
                        રોજિંદી સરેરાશ
                      </th>

                      <th class="col-habit-rate">
                        સફળતા %
                      </th>

                    </tr>

                  </thead>

                  <tbody>
                    ${habitRowsHTML}
                  </tbody>

                </table>

              </div>

            </div>

            <!-- MEMBER INSIGHT -->
            <div class="member-insight">

              <div class="insight-icon">
                ${ICONS.sparkle}
              </div>

              <div class="insight-content">

                <div class="insight-title">
                  માસિક પ્રગતિ
                </div>

                <div class="insight-text">
                  આ મહિનામાં
                  <strong>${disciplineScore}</strong>
                  દિવસ સંપૂર્ણ નિયમ પાલન નોંધાયું છે.
                  કુલ સફળતા દર
                  <strong>${completionRate}%</strong>
                  રહ્યો છે.
                </div>

              </div>

            </div>

          </div>

          <!-- FOOTER -->
          <div class="page-bottom-bar">

            <div class="footer-quote">
              ${ICONS.star}
              <i>
                "નિયમ, ધર્મ અને સંકલ્પનું દ્રઢ પાલન એ જ ભક્તિની સાચી શોભા છે."
              </i>
            </div>

            <div class="footer-right">
              જય સ્વામિનારાયણ ${ICONS.prayingHands}
            </div>

          </div>

        </div>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>

<html lang="gu">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>
    ${group.name || 'Sankalp Group'}
    Monthly Report -
    ${monthName} ${yearStr}
  </title>

  <style>
    ${getEmbeddedFontsCSS()}

    /* =========================================================
       GLOBAL
       ========================================================= */

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html,
    body {
      width: 100%;
      min-height: 100%;
    }

    body {
      font-family:
        'Noto Sans Gujarati',
        'Plus Jakarta Sans',
        'Segoe UI Emoji',
        'Noto Color Emoji',
        'Apple Color Emoji',
        -apple-system,
        BlinkMacSystemFont,
        'Segoe UI',
        sans-serif;

      background: #e2e8f0;

      color: #0f172a;

      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;

      text-rendering: optimizeLegibility;
    }

    @page {
      size: A4 portrait;
      margin: 0;
    }

    /* =========================================================
       PAGE
       ========================================================= */

    .page {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;

      padding: 10mm 13mm 8mm 13mm;

      background: #ffffff;

      position: relative;

      page-break-after: always;
      page-break-inside: avoid;

      display: flex;
      flex-direction: column;

      justify-content: space-between;

      margin: 0 auto;

      overflow: hidden;
    }

    .page:last-child {
      page-break-after: avoid;
    }

    .page-body {
      width: 100%;
      flex: 1;

      min-height: 0;
    }

    /* =========================================================
       TOP BAR
       ========================================================= */

    .page-top-bar {
      width: 100%;

      display: flex;
      justify-content: space-between;
      align-items: center;

      padding: 0 2px 7px 2px;

      border-bottom: 1.8px solid #0f766e;

      margin-bottom: 10px;
    }

    .top-brand {
      display: flex;
      align-items: center;
      gap: 7px;

      font-size: 12px;
      font-weight: 800;

      color: #134e4a;
    }

    .invocation {
      color: #0f766e;
    }

    .top-divider {
      color: #94a3b8;
    }

    .page-number {
      font-family:
        'Noto Sans Gujarati',
        'Plus Jakarta Sans',
        sans-serif;

      font-size: 10.5px;
      font-weight: 800;

      color: #64748b;

      letter-spacing: 0.2px;
    }

    /* =========================================================
       COVER / SUMMARY
       ========================================================= */

    .center-heading-banner {
      text-align: center;

      padding: 0 0 7px 0;

      margin-bottom: 2px;
    }

    .divine-small {
      font-size: 11px;
      font-weight: 900;

      color: #b45309;

      letter-spacing: 1.8px;

      margin-bottom: 2px;
    }

    .divine-main {
      font-size: 22px;
      line-height: 1.2;

      font-weight: 900;

      color: #134e4a;
    }

    /* =========================================================
       HERO
       ========================================================= */

    .hero-banner-compact {
      width: 100%;

      background:
        linear-gradient(
          135deg,
          #0f766e 0%,
          #115e59 48%,
          #134e4a 100%
        );

      color: #ffffff;

      padding: 15px 19px;

      border-radius: 10px;

      display: flex;
      justify-content: space-between;
      align-items: center;

      box-shadow:
        0 5px 15px
        rgba(15, 118, 110, 0.16);

      position: relative;

      overflow: hidden;
    }

    .hero-banner-compact::after {
      content: '';

      position: absolute;

      width: 150px;
      height: 150px;

      border-radius: 50%;

      right: -65px;
      top: -90px;

      background: rgba(255, 255, 255, 0.07);
    }

    .hero-left {
      position: relative;
      z-index: 1;
    }

    .hero-title {
      font-size: 23px;
      line-height: 1.25;

      font-weight: 900;

      letter-spacing: -0.4px;
    }

    .hero-subtitle {
      font-size: 11.5px;

      color: #ccfbf1;

      font-weight: 600;

      margin-top: 3px;
    }

    .hero-date {
      position: relative;
      z-index: 1;

      background: rgba(4, 47, 46, 0.65);

      border: 1px solid
        rgba(153, 246, 228, 0.3);

      padding: 7px 13px;

      border-radius: 999px;

      font-size: 11.5px;
      font-weight: 900;

      color: #ccfbf1;
    }

    /* =========================================================
       SUMMARY CARDS
       ========================================================= */

    .summary-grid {
      display: grid;

      grid-template-columns:
        repeat(2, 1fr);

      gap: 10px;

      margin-top: 10px;
    }

    .stat-card-compact {
      min-height: 62px;

      background: #ffffff;

      border: 1px solid #cbd5e1;

      border-radius: 9px;

      padding: 9px 14px;

      text-align: center;

      box-shadow:
        0 2px 7px
        rgba(15, 23, 42, 0.04);
    }

    .stat-card-compact.green {
      background: #f0fdf4;
      border-color: #a7f3d0;
    }

    .stat-card-compact.teal {
      background: #f0fdfa;
      border-color: #99f6e4;
    }

    .stat-label {
      font-size: 9.5px;

      font-weight: 900;

      letter-spacing: 0.5px;

      color: #0f766e;
    }

    .stat-value {
      margin-top: 3px;

      font-size: 20px;

      line-height: 1.15;

      font-weight: 900;

      color: #134e4a;
    }

    /* =========================================================
       SECTION HEADING
       ========================================================= */

    .section-heading {
      display: flex;

      align-items: center;

      justify-content: space-between;

      margin-bottom: 7px;
    }

    .section-heading-left {
      display: flex;

      align-items: center;

      gap: 9px;
    }

    .section-icon {
      width: 29px;
      height: 29px;

      border-radius: 8px;

      display: flex;
      align-items: center;
      justify-content: center;

      background: #ccfbf1;

      border: 1px solid #99f6e4;

      font-size: 15px;
    }

    .section-title {
      font-size: 14px;

      font-weight: 900;

      color: #0f172a;

      line-height: 1.2;
    }

    .section-subtitle {
      margin-top: 2px;

      font-size: 9px;

      color: #64748b;

      font-weight: 600;
    }

    .section-month {
      font-size: 9.5px;

      font-weight: 800;

      color: #0f766e;

      background: #f0fdfa;

      border: 1px solid #99f6e4;

      border-radius: 999px;

      padding: 4px 9px;
    }

    /* =========================================================
       TABLE
       ========================================================= */

    .table-container {
      width: 100%;

      border: 1px solid #94a3b8;

      border-radius: 9px;

      overflow: hidden;

      background: #ffffff;

      box-shadow:
        0 2px 7px
        rgba(15, 23, 42, 0.04);
    }

    .report-table {
      width: 100%;

      border-collapse: collapse;

      table-layout: fixed;
    }

    .table-head {
      background:
        linear-gradient(
          135deg,
          #0f766e,
          #115e59
        );

      color: #ffffff;

      font-size: 10.5px;

      font-weight: 900;

      letter-spacing: 0.25px;
    }

    .table-head th {
      padding: 8px 9px;

      font-weight: 900;

      text-align: center;

      vertical-align: middle;

      border-right:
        1px solid
        rgba(255, 255, 255, 0.13);

      height: 35px;
    }

    .table-head th:last-child {
      border-right: none;
    }

    /* =========================================================
       LEADERBOARD
       ========================================================= */

    .leaderboard-section {
      margin-top: 11px;
    }

    .leaderboard-row td {
      height: 35px;

      padding: 4px 8px;

      border-bottom: 1px solid #e2e8f0;

      text-align: center;

      vertical-align: middle;
    }

    .leaderboard-row:last-child td {
      border-bottom: none;
    }

    .row-alt {
      background: #f8fafc;
    }

    .col-rank {
      width: 14%;
    }

    .col-name {
      width: 48%;
    }

    .col-score {
      width: 22%;
    }

    .col-rate {
      width: 16%;
    }

    .leaderboard-rank {
      font-family:
        'Noto Sans Gujarati',
        'Plus Jakarta Sans',
        sans-serif;

      font-size: 11px;

      font-weight: 900;
    }

    .rank-gold {
      color: #b45309;
      font-size: 12px;
    }

    .rank-silver {
      color: #475569;
      font-size: 12px;
    }

    .rank-bronze {
      color: #92400e;
      font-size: 12px;
    }

    .rank-normal {
      color: #334155;
    }

    .member-name-wrap {
      display: flex;

      align-items: center;

      justify-content: center;

      gap: 8px;
    }

    .member-name-text {
      font-size: 10.5px;

      font-weight: 800;

      color: #0f172a;

      line-height: 1.25;

      text-align: left;
    }

    .leaderboard-score {
      font-family:
        'Noto Sans Gujarati',
        'Plus Jakarta Sans',
        sans-serif;
    }

    .score-number {
      font-size: 11px;

      font-weight: 900;

      color: #134e4a;
    }

    .score-label {
      font-size: 8.5px;

      color: #64748b;

      font-weight: 700;
    }

    /* =========================================================
       COMPLETION BADGES
       ========================================================= */

    .completion-badge {
      display: inline-flex;

      align-items: center;
      justify-content: center;

      min-width: 49px;

      padding: 3px 8px;

      border-radius: 999px;

      font-family:
        'Noto Sans Gujarati',
        'Plus Jakarta Sans',
        sans-serif;

      font-size: 9.5px;

      font-weight: 900;

      border: 1px solid;
    }

    .completion-high {
      color: #065f46;

      background: #d1fae5;

      border-color: #86efac;
    }

    .completion-medium {
      color: #92400e;

      background: #fef3c7;

      border-color: #fcd34d;
    }

    .completion-low {
      color: #991b1b;

      background: #fee2e2;

      border-color: #fca5a5;
    }

    /* =========================================================
       AVATARS
       ========================================================= */

    .avatar-circle-sm {
      width: 27px;
      height: 27px;

      min-width: 27px;

      border-radius: 50%;

      overflow: hidden;

      border: 1.8px solid #0f766e;

      display: inline-flex;

      align-items: center;
      justify-content: center;

      background:
        linear-gradient(
          135deg,
          #0f766e,
          #115e59
        );

      flex-shrink: 0;
    }

    .avatar-circle-lg {
      width: 66px;
      height: 66px;

      min-width: 66px;

      border-radius: 50%;

      overflow: hidden;

      border: 2.5px solid #0f766e;

      display: flex;

      align-items: center;
      justify-content: center;

      background:
        linear-gradient(
          135deg,
          #0f766e,
          #115e59
        );

      flex-shrink: 0;

      box-shadow:
        0 4px 10px
        rgba(15, 118, 110, 0.18);
    }

    .avatar-img {
      width: 100%;
      height: 100%;

      object-fit: cover;

      display: block;
    }

    .avatar-letter-sm {
      color: #ffffff;

      font-weight: 900;

      font-size: 10px;
    }

    .avatar-letter-lg {
      color: #ffffff;

      font-weight: 900;

      font-size: 24px;
    }

    /* =========================================================
       MEMBER PROFILE
       ========================================================= */

    .member-profile-card {
      width: 100%;

      background:
        linear-gradient(
          135deg,
          #f8fafc 0%,
          #ffffff 100%
        );

      border: 1px solid #cbd5e1;

      padding: 13px 15px;

      border-radius: 11px;

      display: flex;

      justify-content: space-between;

      align-items: center;

      gap: 15px;

      box-shadow:
        0 3px 10px
        rgba(15, 23, 42, 0.045);
    }

    .profile-left {
      display: flex;

      align-items: center;

      gap: 13px;

      min-width: 0;

      flex: 1;
    }

    .profile-information {
      min-width: 0;
    }

    .profile-name-row {
      display: flex;

      align-items: center;

      flex-wrap: wrap;

      gap: 6px;
    }

    .member-name {
      font-size: 19px;

      line-height: 1.25;

      font-weight: 900;

      color: #020617;
    }

    .rank-pill,
    .username-pill {
      display: inline-flex;

      align-items: center;

      border-radius: 999px;

      padding: 3px 8px;

      font-size: 8.5px;

      font-weight: 900;
    }

    .rank-pill {
      background: #134e4a;

      color: #ccfbf1;

      border: 1px solid #0f766e;
    }

    .username-pill {
      background: #f1f5f9;

      color: #475569;

      border: 1px solid #cbd5e1;
    }

    .profile-meta-row {
      display: flex;

      align-items: center;

      flex-wrap: wrap;

      gap: 5px;

      margin-top: 7px;
    }

    .meta-pill {
      display: inline-flex;

      align-items: center;

      gap: 4px;

      padding: 3px 7px;

      border-radius: 5px;

      background: #f8fafc;

      border: 1px solid #dbe3ec;

      color: #334155;

      font-size: 8.5px;

      font-weight: 800;
    }

    .meta-pill-teal {
      color: #115e59;

      background: #f0fdfa;

      border-color: #99f6e4;
    }

    .meta-icon {
      font-size: 8px;
    }

    /* =========================================================
       KPI
       ========================================================= */

    .profile-kpis {
      display: flex;

      align-items: stretch;

      gap: 7px;

      flex-shrink: 0;
    }

    .kpi-box {
      min-width: 94px;

      padding: 8px 11px;

      border-radius: 8px;

      text-align: center;

      border: 1.5px solid;
    }

    .kpi-green {
      background: #f0fdf4;

      border-color: #86efac;
    }

    .kpi-teal {
      background: #f0fdfa;

      border-color: #5eead4;
    }

    .kpi-label {
      font-family:
        'Noto Sans Gujarati',
        'Plus Jakarta Sans',
        sans-serif;

      font-size: 7.5px;

      letter-spacing: 0.4px;

      font-weight: 900;

      color: #166534;
    }

    .kpi-teal .kpi-label {
      color: #115e59;
    }

    .kpi-value {
      margin-top: 3px;

      font-family:
        'Noto Sans Gujarati',
        'Plus Jakarta Sans',
        sans-serif;

      font-size: 17px;

      line-height: 1;

      font-weight: 900;

      color: #14532d;
    }

    .kpi-teal .kpi-value {
      color: #134e4a;
    }

    .kpi-value span {
      font-size: 9px;

      font-weight: 800;

      opacity: 0.7;
    }

    /* =========================================================
       HABIT SECTION
       ========================================================= */

    .habit-section {
      margin-top: 13px;
    }

    .habit-row td {
      height: 45px;

      padding: 6px 9px;

      border-bottom: 1px solid #e2e8f0;

      text-align: center;

      vertical-align: middle;
    }

    .habit-row:last-child td {
      border-bottom: none;
    }

    .col-habit-title {
      width: 33%;
    }

    .col-habit-progress {
      width: 29%;
    }

    .col-habit-avg {
      width: 18%;
    }

    .col-habit-rate {
      width: 20%;
    }

    .habit-title {
      font-size: 10.5px;

      line-height: 1.35;

      font-weight: 900;

      color: #0f172a;
    }

    .habit-main-value {
      font-size: 10.5px;

      line-height: 1.2;

      font-weight: 900;

      color: #134e4a;
    }

    .habit-sub-value {
      margin-top: 2px;

      font-size: 8px;

      color: #64748b;

      font-weight: 600;
    }

    .habit-average-cell {
      font-size: 9px;

      line-height: 1.35;

      color: #475569;

      font-weight: 700;
    }

    .habit-average-cell b {
      color: #0f172a;

      font-weight: 900;
    }

    .progress-wrapper {
      display: flex;

      align-items: center;

      justify-content: center;

      gap: 7px;
    }

    .progress-track {
      width: 67px;
      height: 7px;

      background: #e2e8f0;

      border-radius: 999px;

      overflow: hidden;

      display: inline-block;
    }

    .progress-fill {
      height: 100%;

      border-radius: 999px;
    }

    /* =========================================================
       MEMBER INSIGHT
       ========================================================= */

    .member-insight {
      margin-top: 11px;

      display: flex;

      align-items: center;

      gap: 9px;

      padding: 8px 11px;

      background:
        linear-gradient(
          135deg,
          #f0fdfa,
          #f8fafc
        );

      border: 1px solid #99f6e4;

      border-radius: 8px;
    }

    .insight-icon {
      width: 26px;
      height: 26px;

      min-width: 26px;

      display: flex;

      align-items: center;
      justify-content: center;

      border-radius: 7px;

      background: #ccfbf1;

      color: #0f766e;

      font-size: 13px;
    }

    .insight-title {
      font-size: 8px;

      font-weight: 900;

      color: #0f766e;

      letter-spacing: 0.4px;

      text-transform: uppercase;
    }

    .insight-text {
      margin-top: 2px;

      font-size: 8.5px;

      line-height: 1.4;

      color: #475569;

      font-weight: 600;
    }

    .insight-text strong {
      color: #134e4a;

      font-weight: 900;
    }

    /* =========================================================
       FOOTER
       ========================================================= */

    .page-bottom-bar {
      width: 100%;

      display: flex;

      justify-content: space-between;

      align-items: center;

      gap: 15px;

      padding-top: 7px;

      border-top: 1px solid #cbd5e1;

      margin-top: 7px;
    }

    .footer-quote {
      font-size: 8.5px;

      color: #475569;

      font-weight: 700;

      line-height: 1.3;
    }

    .footer-right {
      white-space: nowrap;

      font-size: 8.5px;

      color: #0f766e;

      font-weight: 900;
    }

    .cover-footer-left {
      font-size: 8.5px;

      color: #64748b;

      font-weight: 800;
    }

    .cover-footer-right {
      font-family:
        'Noto Sans Gujarati',
        'Plus Jakarta Sans',
        sans-serif;

      font-size: 8.5px;

      color: #0f766e;

      font-weight: 900;
    }

    /* =========================================================
       COVER PAGE SPECIAL SPACING
       ========================================================= */

    .cover-page .page-body {
      display: flex;

      flex-direction: column;
    }

    .cover-page .leaderboard-section {
      flex: 1;

      min-height: 0;
    }

    /* =========================================================
       PRINT
       ========================================================= */

    @media print {

      html,
      body {
        background: #ffffff;
      }

      .page {
        margin: 0;

        box-shadow: none;

        page-break-after: always;
      }

      .page:last-child {
        page-break-after: avoid;
      }
    }

  </style>

</head>

<body>

  <!-- =========================================================
       PAGE 1: GROUP SUMMARY & LEADERBOARD
       ========================================================= -->

  <div class="page cover-page">

    <div class="page-body">

      <!-- DIVINE HEADER -->

      <div class="center-heading-banner">

        <div class="divine-small">
          ॥ શ્રી સ્વામિનારાયણો વિજયતે ॥
        </div>

        <div class="divine-main">
          ॥ જય સ્વામિનારાયણ ॥
        </div>

      </div>

      <!-- TOP BAR -->

      <div class="page-top-bar">

        <div class="top-brand">

          <span>
            ${cleanGroupName}
          </span>

          <span class="top-divider">
            •
          </span>

          <span>
            માસિક પ્રગતિ અહેવાલ
          </span>

        </div>

        <div class="page-number">
          પેજ ૧ / ${memberReports.length + 1}
        </div>

      </div>

      <!-- HERO -->

      <div class="hero-banner-compact">

        <div class="hero-left">

          <div class="hero-title">
            ${cleanGroupName.includes('<svg') ? cleanGroupName : `${cleanGroupName} ${ICONS.prayingHands}`}
          </div>

          <div class="hero-subtitle">
            માસિક પ્રગતિ અહેવાલ અને લીડરબોર્ડ
          </div>

        </div>

        <div class="hero-date">
          ${ICONS.calendar} ${monthName} ${yearStr}
        </div>

      </div>

      <!-- SUMMARY -->

      <div class="summary-grid">

        <div class="stat-card-compact green">

          <div class="stat-label">
            કુલ સભ્યો
          </div>

          <div class="stat-value">
            ${totalMembers} સભ્યો
          </div>

        </div>

        <div class="stat-card-compact teal">

          <div class="stat-label">
            સરેરાશ સફળતા દર
          </div>

          <div class="stat-value">
            ${avgCompletion}%
          </div>

        </div>

      </div>

      <!-- LEADERBOARD -->

      <div class="leaderboard-section">

        <div class="section-heading">

          <div class="section-heading-left">

            <div class="section-icon">
              ${ICONS.trophy}
            </div>

            <div>

              <div class="section-title">
                માસિક લીડરબોર્ડ રેન્કિંગ
              </div>

              <div class="section-subtitle">
                ગ્રુપ સભ્યોની માસિક નિયમ પાલન પ્રગતિ
              </div>

            </div>

          </div>

          <div class="section-month">
            ${monthName} ${yearStr}
          </div>

        </div>

        <div class="table-container">

          <table class="report-table">

            <thead>

              <tr class="table-head">

                <th class="col-rank">
                  ક્રમ
                </th>

                <th class="col-name">
                  સભ્યનું નામ
                </th>

                <th class="col-score">
                  સ્કોર
                </th>

                <th class="col-rate">
                  સફળતા %
                </th>

              </tr>

            </thead>

            <tbody>

              ${leaderboardRowsHTML}

            </tbody>

          </table>

        </div>

      </div>

    </div>

    <!-- FOOTER -->

    <div class="page-bottom-bar">

      <div class="cover-footer-left">
        જય સ્વામિનારાયણ • સંકલ્પ હેબિટ ટ્રેકર
      </div>

      <div class="cover-footer-right">
        https://habitsankalp.netlify.app
      </div>

    </div>

  </div>

  <!-- =========================================================
       PAGES 2..N: INDIVIDUAL MEMBER PAGES
       ========================================================= -->

  ${memberPagesHTML}

</body>

</html>
`;
};

/**
 * Comprehensive Fallback PDF Generator using PDFKit
 */
const generatePDFKitReport = (group, monthStr, memberReports) => {
  return new Promise((resolve, reject) => {
    try {
      const [yearStr, monthNumStr] = (monthStr || '').split('-');
      const monthNum = parseInt(monthNumStr, 10);
      const monthName = MONTH_NAMES[monthNum - 1] || monthStr;

      const totalMembers = memberReports.length;
      const avgCompletion =
        totalMembers > 0
          ? Math.round(
              memberReports.reduce((s, m) => s + (m.overallStats?.overallCompletionRate || 0), 0) / totalMembers
            )
          : 0;

      const cleanGroupName = cleanTextForPDFKit(group.name || 'Sankalp Group');

      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        bufferPages: true,
        info: {
          Title: `${cleanGroupName} Monthly Report - ${monthStr}`,
          Author: 'Sankalp Habit Tracker'
        }
      });

      const fontRegPath = findFontPath('NotoSansGujarati-Regular.ttf');
      const fontBoldPath = findFontPath('NotoSansGujarati-Bold.ttf');

      let hasGujaratiFont = false;
      if (fontRegPath && fontBoldPath) {
        doc.registerFont('Gujarati', fontRegPath);
        doc.registerFont('Gujarati-Bold', fontBoldPath);
        hasGujaratiFont = true;
      }

      const fontRegular = hasGujaratiFont ? 'Gujarati' : 'Helvetica';
      const fontBold = hasGujaratiFont ? 'Gujarati-Bold' : 'Helvetica-Bold';

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const W = doc.page.width;
      const H = doc.page.height;

      // PAGE 1: COVER & LEADERBOARD
      doc.rect(0, 0, W, H).fill('#ffffff');

      // Top Bar
      doc.font(fontBold).fillColor('#0f766e').fontSize(11).text('॥ જય સ્વામિનારાયણ ॥', 36, 30);
      doc.font(fontRegular).fillColor('#64748b').fontSize(10).text(`${cleanGroupName} • માસિક અહેવાલ`, 200, 30, { align: 'right', width: 350 });
      doc.moveTo(36, 46).lineTo(559, 46).strokeColor('#0f766e').lineWidth(1.5).stroke();

      // Divine Title
      doc.font(fontBold).fillColor('#b45309').fontSize(11).text('॥ શ્રી સ્વામિનારાયણો વિજયતે ॥', 36, 56, { align: 'center', width: 523 });
      doc.font(fontBold).fillColor('#0f766e').fontSize(18).text('॥ જય સ્વામિનારાયણ ॥', 36, 70, { align: 'center', width: 523 });

      // Hero Banner
      doc.roundedRect(36, 95, 523, 62, 8).fill('#0f766e');
      doc.font(fontBold).fillColor('#ffffff').fontSize(16).text(cleanGroupName, 50, 107);
      doc.font(fontRegular).fillColor('#ccfbf1').fontSize(10).text('માસિક પ્રગતિ અહેવાલ અને લીડરબોર્ડ', 50, 131);
      doc.roundedRect(420, 110, 125, 26, 13).fill('#064e3b');
      doc.font(fontBold).fillColor('#ccfbf1').fontSize(10).text(`${monthName} ${yearStr}`, 420, 117, { align: 'center', width: 125 });

      // Summary Cards
      doc.roundedRect(36, 166, 256, 52, 6).fillAndStroke('#f0fdf4', '#a7f3d0');
      doc.font(fontBold).fillColor('#166534').fontSize(9).text('કુલ સભ્યો', 46, 175);
      doc.font(fontBold).fillColor('#14532d').fontSize(16).text(`${totalMembers} સભ્યો`, 46, 192);

      doc.roundedRect(303, 166, 256, 52, 6).fillAndStroke('#f0fdfa', '#99f6e4');
      doc.font(fontBold).fillColor('#0f766e').fontSize(9).text('સરેરાશ સફળતા દર', 313, 175);
      doc.font(fontBold).fillColor('#134e4a').fontSize(16).text(`${avgCompletion}%`, 313, 192);

      // Leaderboard Header
      doc.font(fontBold).fillColor('#0f172a').fontSize(13).text('માસિક લીડરબોર્ડ રેન્કિંગ', 36, 228);
      doc.font(fontRegular).fillColor('#64748b').fontSize(9).text('ગ્રુપ સભ્યોની માસિક નિયમ પાલન પ્રગતિ', 36, 243);

      // Table Header
      let tableY = 260;
      doc.roundedRect(36, tableY, 523, 24, 4).fill('#0f766e');
      doc.font(fontBold).fillColor('#ffffff').fontSize(9.5);
      doc.text('ક્રમ', 42, tableY + 7, { width: 45, align: 'center' });
      doc.text('સભ્યનું નામ', 95, tableY + 7, { width: 235, align: 'left' });
      doc.text('સ્કોર', 340, tableY + 7, { width: 100, align: 'center' });
      doc.text('સફળતા %', 450, tableY + 7, { width: 95, align: 'center' });

      tableY += 24;
      const rowH = 26;
      memberReports.forEach((m, idx) => {
        const rank = idx + 1;
        const isAlt = idx % 2 === 1;
        const bg = isAlt ? '#f8fafc' : '#ffffff';
        doc.rect(36, tableY, 523, rowH).fill(bg);
        doc.moveTo(36, tableY + rowH).lineTo(559, tableY + rowH).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

        const rankColor = rank === 1 ? '#b45309' : rank === 2 ? '#475569' : rank === 3 ? '#92400e' : '#334155';
        doc.font(fontBold).fillColor(rankColor).fontSize(10).text(`${rank}`, 42, tableY + 7, { width: 45, align: 'center' });

        const rawName = cleanTextForPDFKit(m.userProfile?.name || 'Unknown');
        doc.font(fontBold).fillColor('#0f172a').fontSize(9.5).text(rawName, 95, tableY + 7, { width: 235, align: 'left' });

        const score = m.overallStats?.disciplineScore || 0;
        doc.font(fontBold).fillColor('#134e4a').fontSize(9.5).text(`${score} દિવસ`, 340, tableY + 7, { width: 100, align: 'center' });

        const rate = m.overallStats?.overallCompletionRate || 0;
        const badgeBg = rate >= 80 ? '#d1fae5' : rate >= 50 ? '#fef3c7' : '#fee2e2';
        const badgeBorder = rate >= 80 ? '#86efac' : rate >= 50 ? '#fcd34d' : '#fca5a5';
        const badgeColor = rate >= 80 ? '#065f46' : rate >= 50 ? '#92400e' : '#991b1b';

        doc.roundedRect(470, tableY + 4, 55, 17, 8).fillAndStroke(badgeBg, badgeBorder);
        doc.font(fontBold).fillColor(badgeColor).fontSize(9).text(`${rate}%`, 470, tableY + 7, { width: 55, align: 'center' });

        tableY += rowH;
      });

      // Cover Page Footer
      doc.moveTo(36, H - 35).lineTo(559, H - 35).strokeColor('#cbd5e1').lineWidth(0.7).stroke();
      doc.font(fontRegular).fillColor('#64748b').fontSize(8.5).text('જય સ્વામિનારાયણ • સંકલ્પ હેબિટ ટ્રેકર', 36, H - 26);
      doc.font(fontBold).fillColor('#0f766e').fontSize(8.5).text('https://habitsankalp.netlify.app', 200, H - 26, { align: 'right', width: 359 });

      // PAGES 2..N: MEMBER DETAILS
      memberReports.forEach((report, idx) => {
        doc.addPage();
        doc.rect(0, 0, W, H).fill('#ffffff');

        const pageNum = idx + 2;
        const totalPages = memberReports.length + 1;
        const mName = cleanTextForPDFKit(report.userProfile?.name || 'સભ્ય');
        const mUser = report.userProfile?.username ? `@${report.userProfile.username}` : '';
        const activeDays = report.activeDaysInMonth || 30;
        const dScore = report.overallStats?.disciplineScore || 0;
        const cRate = report.overallStats?.overallCompletionRate || 0;

        // Top Bar
        doc.font(fontBold).fillColor('#0f766e').fontSize(11).text('॥ જય સ્વામિનારાયણ ॥', 36, 30);
        doc.font(fontRegular).fillColor('#64748b').fontSize(10).text(`${cleanGroupName} • પેજ ${pageNum} / ${totalPages}`, 200, 30, { align: 'right', width: 350 });
        doc.moveTo(36, 46).lineTo(559, 46).strokeColor('#0f766e').lineWidth(1.5).stroke();

        // Profile Card
        doc.roundedRect(36, 56, 523, 76, 8).fillAndStroke('#f8fafc', '#cbd5e1');
        doc.font(fontBold).fillColor('#020617').fontSize(15).text(mName, 52, 68);
        doc.font(fontBold).fillColor('#0f766e').fontSize(9).text(`રેન્ક #${idx + 1}  ${mUser}`, 52, 89);
        doc.font(fontRegular).fillColor('#475569').fontSize(8.5).text(`${cleanGroupName} • ${monthName} ${yearStr} • ${activeDays} દિવસ સક્રિય`, 52, 105);

        // Member KPIs
        doc.roundedRect(360, 65, 88, 55, 6).fillAndStroke('#f0fdf4', '#86efac');
        doc.font(fontBold).fillColor('#166534').fontSize(7.5).text('DISCIPLINE SCORE', 360, 72, { align: 'center', width: 88 });
        doc.font(fontBold).fillColor('#14532d').fontSize(15).text(`${dScore}`, 360, 86, { align: 'center', width: 88 });
        doc.font(fontRegular).fillColor('#166534').fontSize(7.5).text(`/${activeDays} દિવસ`, 360, 105, { align: 'center', width: 88 });

        doc.roundedRect(458, 65, 88, 55, 6).fillAndStroke('#f0fdfa', '#5eead4');
        doc.font(fontBold).fillColor('#115e59').fontSize(7.5).text('સફળતા દર', 458, 72, { align: 'center', width: 88 });
        doc.font(fontBold).fillColor('#134e4a').fontSize(15).text(`${cRate}%`, 458, 86, { align: 'center', width: 88 });

        // Habit Section Heading
        doc.font(fontBold).fillColor('#0f172a').fontSize(12).text('ગ્રુપ નિયમ પ્રગતિ વિગત', 36, 145);
        doc.font(fontRegular).fillColor('#64748b').fontSize(8.5).text(`${mName} ની માસિક નિયમ પાલન પ્રગતિ - ${monthName} ${yearStr}`, 36, 160);

        // Habit Table Header
        let hY = 178;
        doc.roundedRect(36, hY, 523, 24, 4).fill('#0f766e');
        doc.font(fontBold).fillColor('#ffffff').fontSize(9);
        doc.text('નિયમનું નામ', 46, hY + 7, { width: 170, align: 'left' });
        doc.text('કુલ પ્રગતિ / દિવસો', 220, hY + 7, { width: 140, align: 'center' });
        doc.text('રોજિંદી સરેરાશ', 365, hY + 7, { width: 100, align: 'center' });
        doc.text('સફળતા %', 470, hY + 7, { width: 80, align: 'center' });

        hY += 24;
        const hRowH = 32;
        (report.habitSummaries || []).forEach((h, hIdx) => {
          const isAlt = hIdx % 2 === 1;
          doc.rect(36, hY, 523, hRowH).fill(isAlt ? '#f8fafc' : '#ffffff');
          doc.moveTo(36, hY + hRowH).lineTo(559, hY + hRowH).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

          const hTitle = cleanTextForPDFKit(h.title || '');
          doc.font(fontBold).fillColor('#0f172a').fontSize(9).text(hTitle, 46, hY + 10, { width: 170, align: 'left' });

          let progStr = `${h.completedDaysCount} / ${activeDays} દિવસ`;
          let avgStr = `${h.completionPercentage || 0}% હાજરી`;

          if (h.type === 'count') {
            const tot = h.typeDetails?.totalCount || 0;
            progStr = `${tot.toLocaleString()} ${h.targetUnit || ''}`;
            avgStr = `રોજ ${h.typeDetails?.dailyAverage || 0} ${h.targetUnit || ''}`;
          } else if (h.type === 'time_target') {
            const hrs = h.typeDetails?.totalHours || 0;
            const mins = h.typeDetails?.totalMinutes || 0;
            progStr = hrs >= 1 ? `${hrs} કલાક` : `${mins} મિનિટ`;
            avgStr = `રોજ ${h.typeDetails?.dailyAverageMinutes || 0} મિ.`;
          } else if (h.type === 'timer') {
            const totalMins = h.typeDetails?.totalMinutes || Math.round((h.typeDetails?.totalSeconds || 0) / 60);
            progStr = `${totalMins} મિનિટ`;
            avgStr = `રોજ ${Math.round((h.typeDetails?.dailyAverageSeconds || 0) / 60)} મિ.`;
          } else if (h.type === 'time_of_day') {
            progStr = `${h.completedDaysCount} / ${activeDays} દિવસ`;
            avgStr = `સરેરાશ ${h.typeDetails?.averageTime || 'N/A'}`;
          }

          doc.font(fontBold).fillColor('#134e4a').fontSize(8.5).text(progStr, 220, hY + 10, { width: 140, align: 'center' });
          doc.font(fontRegular).fillColor('#475569').fontSize(8.5).text(avgStr, 365, hY + 10, { width: 100, align: 'center' });

          const comp = h.completionPercentage || 0;
          const bBg = comp >= 80 ? '#d1fae5' : comp >= 50 ? '#fef3c7' : '#fee2e2';
          const bBorder = comp >= 80 ? '#86efac' : comp >= 50 ? '#fcd34d' : '#fca5a5';
          const bCol = comp >= 80 ? '#065f46' : comp >= 50 ? '#92400e' : '#991b1b';

          doc.roundedRect(485, hY + 7, 50, 18, 9).fillAndStroke(bBg, bBorder);
          doc.font(fontBold).fillColor(bCol).fontSize(8.5).text(`${comp}%`, 485, hY + 11, { width: 50, align: 'center' });

          hY += hRowH;
        });

        // Summary box
        doc.roundedRect(36, H - 90, 523, 45, 6).fillAndStroke('#f0fdfa', '#99f6e4');
        doc.font(fontBold).fillColor('#0f766e').fontSize(9).text('✦ માસિક પ્રગતિ', 48, H - 82);
        doc.font(fontRegular).fillColor('#334155').fontSize(8.5).text(
          `આ મહિનામાં ${dScore} દિવસ સંપૂર્ણ નિયમ પાલન નોંધાયું છે. કુલ સફળતા દર ${cRate}% રહ્યો છે.`,
          48,
          H - 67
        );

        // Page Footer
        doc.moveTo(36, H - 35).lineTo(559, H - 35).strokeColor('#cbd5e1').lineWidth(0.7).stroke();
        doc.font(fontRegular).fillColor('#475569').fontSize(8).text(
          '"નિયમ, ધર્મ અને સંકલ્પનું દ્રઢ પાલન એ જ ભક્તિની સાચી શોભા છે."',
          36,
          H - 26
        );
        doc.font(fontBold).fillColor('#0f766e').fontSize(8.5).text('જય સ્વામિનારાયણ', 200, H - 26, { align: 'right', width: 359 });
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Main export: Generate complete Group Monthly Report PDF
 * Uses Chromium for pixel-perfect HTML rendering with base64 embedded fonts and avatars.
 * Falls back to enhanced PDFKit only if Chromium cannot be launched.
 */
export const generateGroupMonthlyReportPDF = async (group, monthStr, memberReports) => {
  return runWithPDFLock(async () => {
    let browser = null;
    let page = null;

    try {
      browser = await launchBrowser();
      if (browser) {
        console.log('🚀 [PDF] Rendering HTML in Chromium with embedded fonts & avatars...');
        page = await browser.newPage();

        const html = buildReportHTML(group, monthStr, memberReports);

        await page.setContent(html, {
          waitUntil: 'domcontentloaded',
          timeout: 20000
        });

        // Wait for embedded fonts to be ready
        if (page.evaluate) {
          await page.evaluate(async () => {
            if (document.fonts?.ready) {
              await document.fonts.ready;
            }
          });
        }

        // Wait at most 3 seconds for avatar images (never hangs or times out)
        await Promise.race([
          page.evaluate(async () => {
            const imgs = Array.from(document.images);
            await Promise.all(
              imgs.map((img) =>
                img.complete
                  ? Promise.resolve()
                  : new Promise((r) => {
                      img.addEventListener('load', r, { once: true });
                      img.addEventListener('error', r, { once: true });
                    })
              )
            );
          }),
          new Promise((r) => setTimeout(r, 3000))
        ]);

        const pdfBuf = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
          preferCSSPageSize: true
        });

        console.log(`✅ [PDF] Chromium PDF ready: ${(pdfBuf.length / 1024).toFixed(1)} KB`);
        return Buffer.from(pdfBuf);
      }
    } catch (err) {
      console.error('❌ [PDF] Chromium failed, falling back to PDFKit:', err.message);
    } finally {
      if (page) {
        try { await page.close(); } catch (_) {}
      }
      if (browser) {
        try { await browser.close(); } catch (_) {}
      }
    }

    console.log('⚠️ [PDF] Falling back to enhanced PDFKit generator...');
    const fallbackBuf = await generatePDFKitReport(group, monthStr, memberReports);
    console.log(`✅ [PDF] PDFKit fallback ready: ${(fallbackBuf.length / 1024).toFixed(1)} KB`);
    return fallbackBuf;
  });
};

/**
 * Dynamically Compile Rich Monthly Report Data for all Group Members
 */
export const compileGroupMonthlyReports = async (group, targetMonthStr) => {
  const [yearStr, monthNumStr] = (targetMonthStr || '').split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthNumStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();

  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const maxDayToCount = isCurrentMonth ? now.getDate() : daysInMonth;

  const groupId = (group.id || group._id).toString();
  const allHabits = await collections.habits.find({ isArchived: false });
  const groupHabits = allHabits.filter((h) => (h.groupId || '').toString() === groupId);
  const groupHabitIds = groupHabits.map((h) => (h.id || h._id).toString());

  const allLogs = await collections.habitLogs.find();
  const allUsers = await collections.users.find();
  const members = group.members || [];

  const memberReports = [];

  for (const member of members) {
    const memberUserId = (member.userId || '').toString();
    const freshUser = allUsers.find((u) => (u.id || u._id)?.toString() === memberUserId);

    const activeDaysInMonth = Math.max(1, maxDayToCount);

    // Filter member logs strictly for this group's habits in target month
    const memberLogs = allLogs.filter((l) => {
      if ((l.userId || '').toString() !== memberUserId || !l.date || !l.date.startsWith(targetMonthStr)) {
        return false;
      }
      const logDay = parseInt(l.date.split('-')[2], 10);
      return logDay >= 1 && logDay <= maxDayToCount && groupHabitIds.includes((l.habitId || '').toString());
    });

    // Build per-habit breakdown
    const habitSummaries = groupHabits.map((habit) => {
      const habitId = (habit.id || habit._id).toString();
      const habitLogs = memberLogs.filter((l) => (l.habitId || '').toString() === habitId);

      const completedLogs = habitLogs.filter(isLogDone);
      const completedDaysCount = new Set(completedLogs.map((l) => l.date)).size;
      const completionPercentage = Math.min(100, Math.round((completedDaysCount / activeDaysInMonth) * 100));

      let typeDetails = {};
      if (habit.type === 'count') {
        const totalCount = completedLogs.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
        typeDetails = {
          targetPerDay: habit.targetValue || 1,
          unit: habit.targetUnit || 'units',
          totalCount,
          dailyAverage: Math.round((totalCount / activeDaysInMonth) * 10) / 10
        };
      } else if (habit.type === 'time_target') {
        const totalMinutes = completedLogs.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
        typeDetails = {
          targetMinutesPerDay: habit.targetValue || 30,
          totalMinutes,
          totalHours: Number((totalMinutes / 60).toFixed(1)),
          dailyAverageMinutes: Math.round(totalMinutes / activeDaysInMonth)
        };
      } else if (habit.type === 'timer') {
        const totalSeconds = completedLogs.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
        typeDetails = {
          totalSeconds,
          totalMinutes: Math.round(totalSeconds / 60),
          dailyAverageSeconds: Math.round(totalSeconds / activeDaysInMonth)
        };
      } else if (habit.type === 'time_of_day') {
        const timesLogged = completedLogs
          .map((l) => (typeof l.value === 'string' && l.value.trim() ? l.value.trim() : habit.targetValue))
          .filter(Boolean);

        let totalMinutesSum = 0;
        let validMinutesCount = 0;
        timesLogged.forEach((t) => {
          const mins = timeStringToMinutes(t);
          if (mins !== null) {
            totalMinutesSum += mins;
            validMinutesCount++;
          }
        });

        const avgMinutes = validMinutesCount > 0 ? Math.round(totalMinutesSum / validMinutesCount) : null;
        const averageTime = minutesToTimeString(avgMinutes);

        typeDetails = {
          targetTime: habit.targetValue || '05:00 AM',
          completedDays: completedDaysCount,
          totalDays: activeDaysInMonth,
          averageTime: averageTime !== 'N/A' ? averageTime : (completedLogs[0]?.value || habit.targetValue || 'N/A')
        };
      } else if (habit.type === 'yes_no') {
        const yesCount = habitLogs.filter(
          (l) => l.isCompleted || l.value === 1 || l.value === '1' || l.value === true
        ).length;
        typeDetails = {
          yesDays: yesCount,
          noDays: Math.max(0, activeDaysInMonth - yesCount),
          totalDays: activeDaysInMonth,
          yesPercentage: Math.min(100, Math.round((yesCount / activeDaysInMonth) * 100))
        };
      } else {
        typeDetails = {
          completedDays: completedDaysCount,
          totalDays: activeDaysInMonth,
          percentage: completionPercentage
        };
      }

      return {
        habitId,
        title: habit.title,
        type: habit.type,
        targetUnit: habit.targetUnit || '',
        targetValue: habit.targetValue || '',
        completedDaysCount,
        activeDaysInMonth,
        completionPercentage,
        typeDetails
      };
    });

    // Compute Discipline Score (days with 100% group habits completed)
    const logsByDate = {};
    memberLogs.forEach((l) => {
      if (isLogDone(l) && l.date) {
        if (!logsByDate[l.date]) logsByDate[l.date] = new Set();
        logsByDate[l.date].add((l.habitId || '').toString());
      }
    });

    let perfectDays = 0;
    if (groupHabitIds.length > 0) {
      for (const dateStr in logsByDate) {
        if (logsByDate[dateStr].size >= groupHabitIds.length) {
          perfectDays += 1;
        }
      }
    }

    const overallCompletionRate =
      habitSummaries.length > 0
        ? Math.round(habitSummaries.reduce((sum, h) => sum + h.completionPercentage, 0) / habitSummaries.length)
        : 0;

    // Check if finalized/saved report exists in monthly_reports collection
    const allMonthlyReports = await collections.monthlyReports.find();
    const savedMemberReport = allMonthlyReports.find(
      (r) => (r.groupId || '').toString() === groupId && (r.userId || '').toString() === memberUserId && r.month === targetMonthStr
    );

    let activeDays = isCurrentMonth ? activeDaysInMonth : (savedMemberReport?.activeDaysInMonth || activeDaysInMonth);
    let disciplineScore = Math.min(activeDays, perfectDays);
    let overallRate = overallCompletionRate;
    let finalHabitSummaries = habitSummaries;

    if (!isCurrentMonth && memberLogs.length === 0 && savedMemberReport && savedMemberReport.habitSummaries?.length > 0) {
      disciplineScore = Math.min(activeDays, savedMemberReport.overallStats?.disciplineScore ?? savedMemberReport.overallStats?.perfectDays ?? 0);
      overallRate = savedMemberReport.overallStats?.overallCompletionRate ?? 0;
      activeDays = savedMemberReport.activeDaysInMonth || activeDaysInMonth;
      finalHabitSummaries = savedMemberReport.habitSummaries;
    }

    memberReports.push({
      userId: memberUserId,
      userProfile: {
        id: memberUserId,
        name: freshUser?.name || member.name || 'સભ્ય',
        username: freshUser?.username || member.username || '',
        avatar: freshUser?.avatar || member.avatar || ''
      },
      groupId,
      month: targetMonthStr,
      activeDaysInMonth: activeDays,
      overallStats: {
        totalHabits: groupHabits.length,
        perfectDays: disciplineScore,
        disciplineScore,
        overallCompletionRate: overallRate
      },
      habitSummaries: finalHabitSummaries
    });
  }

  // Sort by disciplineScore descending, then completion rate
  memberReports.sort(
    (a, b) =>
      b.overallStats.disciplineScore - a.overallStats.disciplineScore ||
      b.overallStats.overallCompletionRate - a.overallStats.overallCompletionRate
  );

  return memberReports;
};

/**
 * Detect if a habit is a reduction / negative habit (e.g. mobile time waste / screen time)
 * For these habits, LOWER value / duration means BETTER discipline (0 mins is top rank #1)!
 */
export const isReductionHabit = (habit) => {
  const title = (habit?.title || '').toLowerCase();
  const desc = (habit?.description || '').toLowerCase();
  return (
    title.includes('મોબાઈલ') ||
    title.includes('મોબાઇલ') ||
    title.includes('બગાડ') ||
    title.includes('mobile') ||
    title.includes('screen') ||
    title.includes('bagad') ||
    title.includes('waste') ||
    title.includes('વ્યર્થ') ||
    title.includes('phone') ||
    desc.includes('બગાડ') ||
    desc.includes('waste')
  );
};

/**
 * Dynamically Compile Task-Wise Leaderboard Data for every group habit
 * Sorts highest total value first for Count/Time (Mantra, Dandvat, Katha)
 * EXCEPTIONAL CASE: Sorts lowest time first for Mobile Screen Time / Waste (Less time = #1 Rank)
 */
export const compileGroupTaskLeaderboards = async (group, targetMonthStr) => {
  const [yearStr, monthNumStr] = (targetMonthStr || '').split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthNumStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();

  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const maxDayToCount = isCurrentMonth ? now.getDate() : daysInMonth;

  const groupId = (group.id || group._id).toString();
  const allHabits = await collections.habits.find({ isArchived: false });
  const groupHabits = allHabits.filter((h) => (h.groupId || '').toString() === groupId);

  const allLogs = await collections.habitLogs.find();
  const allUsers = await collections.users.find();
  const members = group.members || [];

  const taskLeaderboards = [];

  for (const habit of groupHabits) {
    const habitId = (habit.id || habit._id).toString();
    const isReduction = isReductionHabit(habit);
    const memberRankings = [];

    for (const member of members) {
      const memberUserId = (member.userId || '').toString();
      const freshUser = allUsers.find((u) => (u.id || u._id)?.toString() === memberUserId);

      const activeDaysInMonth = Math.max(1, maxDayToCount);

      // Filter logs for this specific member and habit in target month
      const memberLogs = allLogs.filter((l) => {
        if ((l.userId || '').toString() !== memberUserId || !l.date || !l.date.startsWith(targetMonthStr)) {
          return false;
        }
        const logDay = parseInt(l.date.split('-')[2], 10);
        return logDay >= 1 && logDay <= maxDayToCount && (l.habitId || '').toString() === habitId;
      });

      const completedLogs = memberLogs.filter(isLogDone);
      const completedDaysCount = new Set(completedLogs.map((l) => l.date)).size;
      const completionPercentage = Math.min(100, Math.round((completedDaysCount / activeDaysInMonth) * 100));

      let totalMetricValue = 0;
      let displayValue = '';
      let displayAverage = '';
      let avgMinutes = null;

      if (habit.type === 'count') {
        const totalCount = completedLogs.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
        totalMetricValue = totalCount;
        const dailyAvg = Math.round((totalCount / activeDaysInMonth) * 10) / 10;
        displayValue = `${totalCount.toLocaleString()} ${habit.targetUnit || ''}`.trim();
        displayAverage = `રોજ ${dailyAvg} ${habit.targetUnit || ''}`.trim();
      } else if (habit.type === 'time_target') {
        const totalMinutes = completedLogs.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
        totalMetricValue = totalMinutes;
        const hrs = (totalMinutes / 60).toFixed(1);
        const dailyAvgMinutes = Math.round(totalMinutes / activeDaysInMonth);
        displayValue = Number(hrs) >= 1 ? `${hrs} કલાક (${totalMinutes} મિ.)` : `${totalMinutes} મિનિટ`;
        displayAverage = `રોજ ${dailyAvgMinutes} મિનિટ`;
      } else if (habit.type === 'timer') {
        const totalSeconds = completedLogs.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
        const totalMinutes = Math.round(totalSeconds / 60);
        totalMetricValue = totalMinutes;
        const dailyAvgMins = Math.round(totalMinutes / activeDaysInMonth);
        displayValue = `${totalMinutes} મિનિટ`;
        displayAverage = `રોજ ${dailyAvgMins} મિનિટ`;
      } else if (habit.type === 'time_of_day') {
        const timesLogged = completedLogs
          .map((l) => (typeof l.value === 'string' && l.value.trim() ? l.value.trim() : habit.targetValue))
          .filter(Boolean);

        let totalMinutesSum = 0;
        let validCount = 0;
        timesLogged.forEach((t) => {
          const mins = timeStringToMinutes(t);
          if (mins !== null) {
            totalMinutesSum += mins;
            validCount++;
          }
        });
        avgMinutes = validCount > 0 ? Math.round(totalMinutesSum / validCount) : 9999;
        const averageTime = minutesToTimeString(validCount > 0 ? avgMinutes : null);
        totalMetricValue = completedDaysCount;
        displayValue = `${completedDaysCount} / ${activeDaysInMonth} દિવસ`;
        displayAverage = `સરેરાશ ${averageTime}`;
      } else if (habit.type === 'yes_no') {
        const yesCount = memberLogs.filter(
          (l) => l.isCompleted || l.value === 1 || l.value === '1' || l.value === true
        ).length;
        totalMetricValue = yesCount;
        displayValue = `${yesCount} / ${activeDaysInMonth} દિવસ`;
        displayAverage = `${Math.min(100, Math.round((yesCount / activeDaysInMonth) * 100))}% હાજરી`;
      } else {
        // boolean
        totalMetricValue = completedDaysCount;
        displayValue = `${completedDaysCount} / ${activeDaysInMonth} દિવસ`;
        displayAverage = `${completionPercentage}% હાજરી`;
      }

      if (isReduction) {
        if (totalMetricValue === 0) {
          displayValue = `૦ મિનિટ (સંપૂર્ણ સંયમ 🌟)`;
        }
      }

      memberRankings.push({
        userId: memberUserId,
        name: freshUser?.name || member.name || 'સભ્ય',
        username: freshUser?.username || member.username || '',
        avatar: freshUser?.avatar || member.avatar || '',
        role: member.role || 'member',
        completedDaysCount,
        activeDaysInMonth,
        completionPercentage,
        totalMetricValue,
        displayValue,
        displayAverage,
        avgMinutes
      });
    }

    // Sort rankings:
    // EXCEPTIONAL CASE: For reduction habits (like Mobile screen time waste), LOWER time is #1 Rank!
    if (isReduction) {
      memberRankings.sort((a, b) => {
        if (a.totalMetricValue !== b.totalMetricValue) {
          return a.totalMetricValue - b.totalMetricValue; // Ascending: less waste = top rank!
        }
        return b.completedDaysCount - a.completedDaysCount;
      });
    } else if (habit.type === 'count' || habit.type === 'time_target' || habit.type === 'timer') {
      // Highest total value is #1 Rank (Mantra Jap, Dandvat, Katha, etc.)
      memberRankings.sort((a, b) => {
        if (b.totalMetricValue !== a.totalMetricValue) {
          return b.totalMetricValue - a.totalMetricValue; // Descending
        }
        return b.completedDaysCount - a.completedDaysCount || b.completionPercentage - a.completionPercentage;
      });
    } else if (habit.type === 'time_of_day') {
      // Most days present, then earlier wake-up/activity time
      memberRankings.sort((a, b) => {
        if (b.completedDaysCount !== a.completedDaysCount) {
          return b.completedDaysCount - a.completedDaysCount;
        }
        return (a.avgMinutes || 9999) - (b.avgMinutes || 9999);
      });
    } else {
      // Most completed days, then completion rate
      memberRankings.sort((a, b) => {
        if (b.completedDaysCount !== a.completedDaysCount) {
          return b.completedDaysCount - a.completedDaysCount;
        }
        return b.completionPercentage - a.completionPercentage;
      });
    }

    taskLeaderboards.push({
      habitId,
      title: habit.title,
      description: habit.description || '',
      type: habit.type,
      targetValue: habit.targetValue || '',
      targetUnit: habit.targetUnit || '',
      isReduction,
      totalMembers: memberRankings.length,
      topPerformer: memberRankings[0] || null,
      rankings: memberRankings
    });
  }

  return taskLeaderboards;
};

/**
 * Build Multi-Page HTML Template for Task-Wise Leaderboard Report
 * 1 Page Dedicated for each Group Task with Champion Card and Full Ranking Table
 */
export const buildTaskLeaderboardHTML = (group, monthStr, taskLeaderboards) => {
  const [yearStr, monthNumStr] = (monthStr || '').split('-');
  const monthNum = parseInt(monthNumStr, 10);
  const monthName = MONTH_NAMES[monthNum - 1] || monthStr;

  const totalTasks = taskLeaderboards.length;
  const cleanGroupName = formatHTMLTextWithSvgIcons(group.name || 'Sankalp Group');

  const taskPagesHTML = taskLeaderboards.map((task, pageIdx) => {
    const pageNum = pageIdx + 1;
    const topPerformer = task.topPerformer;
    const isReduction = task.isReduction;

    const rawTaskTitle = task.title || 'નિયમ';
    const cleanTaskTitle = formatHTMLTextWithSvgIcons(rawTaskTitle);

    // Top Performer Avatar
    const topAvatarUrl = optimizeAvatarUrl(topPerformer?.avatar || '', 120);
    const topInitial = (cleanTextForPDFKit(topPerformer?.name || 'U') || 'U').charAt(0).toUpperCase();
    const topAvatarHTML = topAvatarUrl
      ? `<div class="avatar-circle-top"><img src="${topAvatarUrl}" class="avatar-img" onerror="this.outerHTML='<span class=\\'avatar-letter-top\\'>${topInitial}</span>'" /></div>`
      : `<div class="avatar-circle-top"><span class="avatar-letter-top">${topInitial}</span></div>`;

    // Leaderboard Rows
    const tableRowsHTML = task.rankings.map((m, idx) => {
      const rank = idx + 1;
      const medal = rank === 1 ? ICONS.goldMedal : rank === 2 ? ICONS.silverMedal : rank === 3 ? ICONS.bronzeMedal : `${rank}`;
      const medalClass = rank === 1 ? 'rank-gold' : rank === 2 ? 'rank-silver' : rank === 3 ? 'rank-bronze' : 'rank-normal';

      const avatarUrl = optimizeAvatarUrl(m.avatar || '', 60);
      const initial = (cleanTextForPDFKit(m.name || 'U') || 'U').charAt(0).toUpperCase();
      const avatarHTML = avatarUrl
        ? `<div class="avatar-circle-sm"><img src="${avatarUrl}" class="avatar-img" onerror="this.outerHTML='<span class=\\'avatar-letter-sm\\'>${initial}</span>'" /></div>`
        : `<div class="avatar-circle-sm"><span class="avatar-letter-sm">${initial}</span></div>`;

      const comp = m.completionPercentage || 0;
      const compClass = comp >= 80 ? 'completion-high' : comp >= 50 ? 'completion-medium' : 'completion-low';

      return `
        <tr class="leaderboard-row ${idx % 2 === 1 ? 'row-alt' : ''}">
          <td class="leaderboard-rank ${medalClass}">
            ${medal}
          </td>
          <td class="leaderboard-name">
            <div class="member-name-wrap">
              ${avatarHTML}
              <div class="member-name-text">
                <b>${formatHTMLTextWithSvgIcons(m.name)}</b>
                ${m.username ? `<span style="font-size:8.5px;color:#64748b;display:block">@${m.username}</span>` : ''}
              </div>
            </div>
          </td>
          <td class="leaderboard-metric">
            <span class="metric-highlight">${formatHTMLTextWithSvgIcons(m.displayValue || '-')}</span>
          </td>
          <td class="leaderboard-avg">
            <span class="avg-text">${formatHTMLTextWithSvgIcons(m.displayAverage || '-')}</span>
          </td>
          <td class="leaderboard-rate">
            <span class="completion-badge ${compClass}">
              ${comp}%
            </span>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="page task-page">
        <div class="page-body">
          <!-- TOP BAR -->
          <div class="page-top-bar">
            <div class="top-brand">
              <span class="invocation">॥ જય સ્વામિનારાયણ ॥</span>
              <span class="top-divider">•</span>
              <span>${cleanGroupName}</span>
            </div>
            <div class="page-number">
              નિયમ ${pageNum} / ${totalTasks} (પેજ ${pageNum})
            </div>
          </div>

          <!-- TASK HEADER BANNER -->
          <div class="task-header-card ${isReduction ? 'reduction-card' : ''}">
            <div class="task-header-left">
              <div class="task-icon-box">
                ${isReduction ? ICONS.shieldGold : ICONS.sparkleGold}
              </div>
              <div>
                <div class="task-title-row">
                  <h2 class="task-title">${cleanTaskTitle}</h2>
                  ${isReduction ? `<span class="reduction-badge">${ICONS.star} ઓછો સમય = પ્રથમ સ્થાન (સંયમ નિયમ)</span>` : '<span class="task-type-badge">માસિક નિયમ લીડરબોર્ડ</span>'}
                </div>
                <div class="task-meta">
                  <span>${task.totalMembers} સભ્યો સહભાગી</span>
                  <span>•</span>
                  <span>${task.type === 'count' ? `લક્ષ્ય: ${task.targetValue} ${task.targetUnit}` : task.type === 'time_target' ? `લક્ષ્ય: ${task.targetValue} મિનિટ/દિવસ` : 'નિયમ પાલન'}</span>
                  <span>•</span>
                  <span>${monthName} ${yearStr}</span>
                </div>
              </div>
            </div>
            <div class="task-month-pill">
              ${ICONS.calendar} ${monthName} ${yearStr}
            </div>
          </div>

          <!-- TOP CHAMPION CARD -->
          ${topPerformer ? `
            <div class="champion-card">
              <div class="champion-left">
                ${topAvatarHTML}
                <div class="champion-info">
                  <div class="champion-label">
                    ${ICONS.trophy} <span>પ્રથમ ક્રમાંક • ટોપ પરફોર્મર</span>
                  </div>
                  <div class="champion-name">
                    ${formatHTMLTextWithSvgIcons(topPerformer.name)}
                  </div>
                  <div class="champion-sub">
                    ${topPerformer.username ? `@${topPerformer.username} • ` : ''} ${topPerformer.completedDaysCount} દિવસ સક્રિય
                  </div>
                </div>
              </div>
              <div class="champion-score">
                <div class="champion-score-label">${isReduction ? 'સૌથી ઓછો બગાડ' : 'કુલ સ્કોર'}</div>
                <div class="champion-score-value">${formatHTMLTextWithSvgIcons(topPerformer.displayValue)}</div>
                <div class="champion-score-sub">${formatHTMLTextWithSvgIcons(topPerformer.displayAverage)}</div>
              </div>
            </div>
          ` : ''}

          <!-- LEADERBOARD TABLE -->
          <div class="table-container" style="margin-top: 10px;">
            <table class="report-table">
              <thead>
                <tr class="table-head">
                  <th style="width: 12%;">ક્રમ</th>
                  <th style="width: 38%;">સભ્યનું નામ</th>
                  <th style="width: 25%;">${isReduction ? 'સમય બગાડ' : 'કુલ પ્રગતિ'}</th>
                  <th style="width: 15%;">રોજિંદી સરેરાશ</th>
                  <th style="width: 10%;">હાજરી %</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHTML}
              </tbody>
            </table>
          </div>

          <!-- INSIGHT / TAKEAWAY -->
          <div class="member-insight" style="margin-top: 10px;">
            <div class="insight-icon">${ICONS.sparkle}</div>
            <div class="insight-content">
              <div class="insight-title">${cleanTaskTitle} - માસિક પ્રેરણા</div>
              <div class="insight-text">
                ${isReduction
                  ? `આ નિયમમાં સૌથી ઓછો સમય આપનાર સભ્ય <strong>${formatHTMLTextWithSvgIcons(topPerformer?.name || 'પ્રથમ ક્રમાંક')}</strong> છે. મોબાઈલના વ્યર્થ વપરાશ પર સંયમ રાખી સત્સંગ અને ભક્તિમાં સમય વાપરવો એ જ સાચો વિવેક છે.`
                  : `આ નિયમમાં સૌથી વધુ પુરુષાર્થ કરી <strong>${formatHTMLTextWithSvgIcons(topPerformer?.name || 'ટોપ પરફોર્મર')}</strong> એ <strong>${formatHTMLTextWithSvgIcons(topPerformer?.displayValue || '')}</strong> સાથે પ્રથમ સ્થાન પ્રાપ્ત કર્યું છે.`
                }
              </div>
            </div>
          </div>
        </div>

        <!-- FOOTER -->
        <div class="page-bottom-bar">
          <div class="footer-quote">
            ${ICONS.star}
            <i>"નિયમ, ધર્મ અને સંકલ્પનું દ્રઢ પાલન એ જ ભક્તિની સાચી શોભા છે."</i>
          </div>
          <div class="footer-right">
            જય સ્વામિનારાયણ ${ICONS.prayingHands}
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="gu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${group.name || 'Sankalp Group'} Task Leaderboard - ${monthName} ${yearStr}</title>
  <style>
    ${getEmbeddedFontsCSS()}

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; min-height: 100%; }
    body {
      font-family: 'Noto Sans Gujarati', 'Plus Jakarta Sans', sans-serif;
      background: #e2e8f0;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      text-rendering: optimizeLegibility;
    }
    @page { size: A4 portrait; margin: 0; }

    .page {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      padding: 9mm 12mm 7mm 12mm;
      background: #ffffff;
      position: relative;
      page-break-after: always;
      page-break-inside: avoid;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      margin: 0 auto;
      overflow: hidden;
    }
    .page:last-child { page-break-after: avoid; }
    .page-body { width: 100%; flex: 1; min-height: 0; }

    .page-top-bar {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 2px 6px 2px;
      border-bottom: 1.8px solid #0f766e;
      margin-bottom: 8px;
    }
    .top-brand { display: flex; align-items: center; gap: 7px; font-size: 11.5px; font-weight: 800; color: #134e4a; }
    .invocation { color: #0f766e; }
    .top-divider { color: #94a3b8; }
    .page-number { font-size: 10.5px; font-weight: 800; color: #64748b; }

    /* TASK HEADER CARD */
    .task-header-card {
      background: linear-gradient(135deg, #065f46 0%, #047857 50%, #065f46 100%);
      border-radius: 10px;
      padding: 10px 14px;
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 9px;
      border: 1px solid rgba(110, 231, 183, 0.3);
      box-shadow: 0 3px 8px rgba(6, 95, 70, 0.15);
    }
    .reduction-card {
      background: linear-gradient(135deg, #854d0e 0%, #a16207 50%, #713f12 100%);
      border-color: rgba(253, 224, 71, 0.4);
    }
    .task-header-left { display: flex; align-items: center; gap: 11px; }
    .task-icon-box { background: rgba(255, 255, 255, 0.15); border-radius: 10px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.25); }
    .task-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .task-title { font-size: 16px; font-weight: 900; color: #ffffff; line-height: 1.2; }
    .task-type-badge { font-size: 8.5px; font-weight: 800; background: rgba(255, 255, 255, 0.2); padding: 2px 7px; border-radius: 999px; }
    .reduction-badge { font-size: 8.5px; font-weight: 900; background: #fef08a; color: #713f12; padding: 2px 8px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px; }
    .task-meta { font-size: 9px; color: #ccfbf1; font-weight: 700; margin-top: 3px; display: flex; gap: 6px; }
    .task-month-pill { font-size: 10px; font-weight: 800; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.2); padding: 4px 10px; border-radius: 999px; color: #f0fdf4; white-space: nowrap; }

    /* CHAMPION CARD */
    .champion-card {
      background: linear-gradient(135deg, #fefce8 0%, #fffbeb 100%);
      border: 1.5px solid #fde047;
      border-radius: 10px;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 9px;
      box-shadow: 0 2px 6px rgba(234, 179, 8, 0.1);
    }
    .champion-left { display: flex; align-items: center; gap: 11px; }
    .avatar-circle-top {
      width: 48px; height: 48px; min-width: 48px; border-radius: 50%; overflow: hidden;
      border: 2px solid #eab308; display: flex; align-items: center; justify-content: center;
      background: #f59e0b; flex-shrink: 0; box-shadow: 0 2px 6px rgba(234, 179, 8, 0.3);
    }
    .avatar-letter-top { color: #ffffff; font-weight: 900; font-size: 18px; }
    .champion-label { font-size: 9px; font-weight: 900; text-transform: uppercase; color: #b45309; display: flex; align-items: center; gap: 4px; }
    .champion-name { font-size: 15px; font-weight: 900; color: #78350f; line-height: 1.25; margin-top: 1px; }
    .champion-sub { font-size: 8.5px; font-weight: 700; color: #92400e; margin-top: 1px; }
    .champion-score { text-align: right; }
    .champion-score-label { font-size: 8px; font-weight: 800; text-transform: uppercase; color: #92400e; }
    .champion-score-value { font-size: 16px; font-weight: 900; color: #b45309; }
    .champion-score-sub { font-size: 8.5px; font-weight: 700; color: #78350f; }

    /* TABLE */
    .table-container { width: 100%; border: 1px solid #cbd5e1; border-radius: 9px; overflow: hidden; background: #ffffff; }
    .report-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .table-head { background: linear-gradient(135deg, #0f766e, #115e59); color: #ffffff; font-size: 10px; font-weight: 900; }
    .table-head th { padding: 7px 8px; text-align: center; vertical-align: middle; border-right: 1px solid rgba(255, 255, 255, 0.15); height: 30px; }
    .table-head th:last-child { border-right: none; }
    .leaderboard-row td { height: 32px; padding: 4px 7px; border-bottom: 1px solid #f1f5f9; text-align: center; vertical-align: middle; }
    .leaderboard-row:last-child td { border-bottom: none; }
    .row-alt { background: #f8fafc; }
    .leaderboard-rank { font-size: 10.5px; font-weight: 900; }
    .rank-gold { color: #b45309; font-size: 11.5px; }
    .rank-silver { color: #475569; font-size: 11.5px; }
    .rank-bronze { color: #92400e; font-size: 11.5px; }
    .rank-normal { color: #334155; }
    .member-name-wrap { display: flex; align-items: center; gap: 7px; text-align: left; }
    .member-name-text { font-size: 10px; font-weight: 800; color: #0f172a; line-height: 1.2; }
    .metric-highlight { font-size: 10.5px; font-weight: 900; color: #0f766e; }
    .avg-text { font-size: 9px; font-weight: 700; color: #475569; }

    /* BADGES & AVATARS */
    .completion-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 42px; padding: 2px 6px; border-radius: 999px; font-size: 9px; font-weight: 900; border: 1px solid; }
    .completion-high { color: #065f46; background: #d1fae5; border-color: #86efac; }
    .completion-medium { color: #92400e; background: #fef3c7; border-color: #fcd34d; }
    .completion-low { color: #991b1b; background: #fee2e2; border-color: #fca5a5; }

    .avatar-circle-sm { width: 24px; height: 24px; min-width: 24px; border-radius: 50%; overflow: hidden; border: 1.5px solid #0f766e; display: inline-flex; align-items: center; justify-content: center; background: #0f766e; flex-shrink: 0; }
    .avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .avatar-letter-sm { color: #ffffff; font-weight: 900; font-size: 9.5px; }

    /* INSIGHT */
    .member-insight { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 7px 11px; display: flex; align-items: flex-start; gap: 9px; }
    .insight-icon { margin-top: 1px; }
    .insight-title { font-size: 10px; font-weight: 900; color: #0f766e; }
    .insight-text { font-size: 8.5px; color: #334155; font-weight: 600; line-height: 1.35; margin-top: 2px; }
    .insight-text strong { color: #115e59; font-weight: 900; }

    /* FOOTER */
    .page-bottom-bar { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 15px; padding-top: 6px; border-top: 1px solid #cbd5e1; margin-top: 6px; }
    .footer-quote { font-size: 8px; color: #475569; font-weight: 700; }
    .footer-right { font-size: 8px; color: #0f766e; font-weight: 900; white-space: nowrap; }

    @media print { html, body { background: #ffffff; } .page { margin: 0; box-shadow: none; } }
  </style>
</head>
<body>
  ${taskPagesHTML}
</body>
</html>
  `;
};

/**
 * Fallback Task-Wise PDF Generator using PDFKit
 */
export const generatePDFKitTaskLeaderboardReport = (group, monthStr, taskLeaderboards) => {
  return new Promise((resolve, reject) => {
    try {
      const [yearStr, monthNumStr] = (monthStr || '').split('-');
      const monthNum = parseInt(monthNumStr, 10);
      const monthName = MONTH_NAMES[monthNum - 1] || monthStr;

      const cleanGroupName = cleanTextForPDFKit(group.name || 'Sankalp Group');

      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        bufferPages: true,
        info: {
          Title: `${cleanGroupName} Task Leaderboard - ${monthStr}`,
          Author: 'Sankalp Habit Tracker'
        }
      });

      const fontRegPath = findFontPath('NotoSansGujarati-Regular.ttf');
      const fontBoldPath = findFontPath('NotoSansGujarati-Bold.ttf');

      let hasGujaratiFont = false;
      if (fontRegPath && fontBoldPath) {
        doc.registerFont('Gujarati', fontRegPath);
        doc.registerFont('Gujarati-Bold', fontBoldPath);
        hasGujaratiFont = true;
      }

      const fontRegular = hasGujaratiFont ? 'Gujarati' : 'Helvetica';
      const fontBold = hasGujaratiFont ? 'Gujarati-Bold' : 'Helvetica-Bold';

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const W = doc.page.width;
      const H = doc.page.height;

      taskLeaderboards.forEach((task, pageIdx) => {
        if (pageIdx > 0) doc.addPage();
        doc.rect(0, 0, W, H).fill('#ffffff');

        const pageNum = pageIdx + 1;
        const totalTasks = taskLeaderboards.length;
        const taskTitle = cleanTextForPDFKit(task.title || 'નિયમ');
        const top = task.topPerformer;

        // Top Bar
        doc.font(fontBold).fillColor('#0f766e').fontSize(11).text('॥ જય સ્વામિનારાયણ ॥', 36, 30);
        doc.font(fontRegular).fillColor('#64748b').fontSize(10).text(`${cleanGroupName} • નિયમ ${pageNum}/${totalTasks}`, 200, 30, { align: 'right', width: 350 });
        doc.moveTo(36, 46).lineTo(559, 46).strokeColor('#0f766e').lineWidth(1.5).stroke();

        // Task Header
        const headerBg = task.isReduction ? '#854d0e' : '#0f766e';
        doc.roundedRect(36, 56, 523, 50, 8).fill(headerBg);
        doc.font(fontBold).fillColor('#ffffff').fontSize(15).text(taskTitle, 50, 68);
        doc.font(fontRegular).fillColor('#ccfbf1').fontSize(8.5).text(
          `${task.isReduction ? 'ઓછો સમય = પ્રથમ સ્થાન • ' : ''}${task.totalMembers} સભ્યો • ${monthName} ${yearStr}`,
          50,
          90
        );

        // Champion Card
        let startY = 115;
        if (top) {
          doc.roundedRect(36, startY, 523, 50, 6).fillAndStroke('#fefce8', '#fde047');
          doc.font(fontBold).fillColor('#b45309').fontSize(8.5).text('પ્રથમ ક્રમાંક • ટોપ પરફોર્મર', 50, startY + 8);
          doc.font(fontBold).fillColor('#78350f').fontSize(13).text(cleanTextForPDFKit(top.name), 50, startY + 22);
          doc.font(fontBold).fillColor('#b45309').fontSize(14).text(cleanTextForPDFKit(top.displayValue), 340, startY + 12, { align: 'right', width: 205 });
          doc.font(fontRegular).fillColor('#92400e').fontSize(8.5).text(cleanTextForPDFKit(top.displayAverage), 340, startY + 30, { align: 'right', width: 205 });
          startY += 58;
        }

        // Table Header
        let tY = startY;
        doc.roundedRect(36, tY, 523, 22, 4).fill('#0f766e');
        doc.font(fontBold).fillColor('#ffffff').fontSize(9);
        doc.text('ક્રમ', 42, tY + 6, { width: 35, align: 'center' });
        doc.text('સભ્યનું નામ', 85, tY + 6, { width: 190, align: 'left' });
        doc.text(task.isReduction ? 'સમય બગાડ' : 'કુલ પ્રગતિ', 280, tY + 6, { width: 130, align: 'center' });
        doc.text('સરેરાશ', 415, tY + 6, { width: 75, align: 'center' });
        doc.text('હાજરી %', 495, tY + 6, { width: 60, align: 'center' });

        tY += 22;
        const rowH = 26;
        task.rankings.forEach((m, idx) => {
          const rank = idx + 1;
          const bg = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
          doc.rect(36, tY, 523, rowH).fill(bg);
          doc.moveTo(36, tY + rowH).lineTo(559, tY + rowH).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

          const rankColor = rank === 1 ? '#b45309' : rank === 2 ? '#475569' : rank === 3 ? '#92400e' : '#334155';
          doc.font(fontBold).fillColor(rankColor).fontSize(9.5).text(`${rank}`, 42, tY + 7, { width: 35, align: 'center' });

          const rawName = cleanTextForPDFKit(m.name || 'Unknown');
          doc.font(fontBold).fillColor('#0f172a').fontSize(9).text(rawName, 85, tY + 7, { width: 190, align: 'left' });

          doc.font(fontBold).fillColor('#0f766e').fontSize(8.5).text(cleanTextForPDFKit(m.displayValue || '-'), 280, tY + 7, { width: 130, align: 'center' });
          doc.font(fontRegular).fillColor('#475569').fontSize(8).text(cleanTextForPDFKit(m.displayAverage || '-'), 415, tY + 7, { width: 75, align: 'center' });

          const comp = m.completionPercentage || 0;
          doc.font(fontBold).fillColor(comp >= 80 ? '#065f46' : comp >= 50 ? '#92400e' : '#991b1b').fontSize(8.5).text(`${comp}%`, 495, tY + 7, { width: 60, align: 'center' });

          tY += rowH;
        });

        // Page Footer
        doc.moveTo(36, H - 32).lineTo(559, H - 32).strokeColor('#cbd5e1').lineWidth(0.7).stroke();
        doc.font(fontRegular).fillColor('#475569').fontSize(8).text('"નિયમ, ધર્મ અને સંકલ્પનું દ્રઢ પાલન એ જ ભક્તિની સાચી શોભા છે."', 36, H - 24);
        doc.font(fontBold).fillColor('#0f766e').fontSize(8.5).text('જય સ્વામિનારાયણ', 200, H - 24, { align: 'right', width: 359 });
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Main export: Generate Task-Wise Leaderboard PDF Book
 */
export const generateGroupTaskLeaderboardPDF = async (group, monthStr, taskLeaderboards) => {
  return runWithPDFLock(async () => {
    let browser = null;
    let page = null;

    try {
      browser = await launchBrowser();
      if (browser) {
        console.log('🚀 [PDF] Rendering Task Leaderboard HTML in Chromium...');
        page = await browser.newPage();

        const html = buildTaskLeaderboardHTML(group, monthStr, taskLeaderboards);

        await page.setContent(html, {
          waitUntil: 'domcontentloaded',
          timeout: 20000
        });

        if (page.evaluate) {
          await page.evaluate(async () => {
            if (document.fonts?.ready) await document.fonts.ready;
          });
        }

        await Promise.race([
          page.evaluate(async () => {
            const imgs = Array.from(document.images);
            await Promise.all(
              imgs.map((img) =>
                img.complete
                  ? Promise.resolve()
                  : new Promise((r) => {
                      img.addEventListener('load', r, { once: true });
                      img.addEventListener('error', r, { once: true });
                    })
              )
            );
          }),
          new Promise((r) => setTimeout(r, 3000))
        ]);

        const pdfBuf = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
          preferCSSPageSize: true
        });

        console.log(`✅ [PDF] Task Leaderboard Chromium PDF ready: ${(pdfBuf.length / 1024).toFixed(1)} KB`);
        return Buffer.from(pdfBuf);
      }
    } catch (err) {
      console.error('❌ [PDF] Task Leaderboard Chromium failed, falling back to PDFKit:', err.message);
    } finally {
      if (page) {
        try { await page.close(); } catch (_) {}
      }
      if (browser) {
        try { await browser.close(); } catch (_) {}
      }
    }

    console.log('⚠️ [PDF] Falling back to PDFKit Task Leaderboard generator...');
    const fallbackBuf = await generatePDFKitTaskLeaderboardReport(group, monthStr, taskLeaderboards);
    console.log(`✅ [PDF] Task Leaderboard PDFKit fallback ready: ${(fallbackBuf.length / 1024).toFixed(1)} KB`);
    return fallbackBuf;
  });
};