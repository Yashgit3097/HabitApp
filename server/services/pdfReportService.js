import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import PDFDocument from 'pdfkit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONTH_NAMES = [
  'જાન્યુઆરી', 'ફેબ્રુઆરી', 'માર્ચ', 'એપ્રિલ',
  'મે', 'જૂન', 'જુલાઈ', 'ઓગસ્ટ',
  'સપ્ટેમ્બર', 'ઓક્ટોબર', 'નવેમ્બર', 'ડિસેમ્બર'
];

const BROWSER_ARGS = [
  '--no-sandbox', '--disable-setuid-sandbox',
  '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas',
  '--disable-gpu', '--no-first-run', '--no-zygote',
  '--font-render-hinting=none', '--hide-scrollbars', '--disable-extensions'
];

// ─── 1. Font Path Resolver ────────────────────────────────────────────────────
// MUST be defined first — all other font functions depend on this
const findFontPath = (fontFileName) => {
  const candidates = [
    path.resolve(__dirname, '..', 'assets', 'fonts', fontFileName),
    path.resolve(__dirname, 'assets', 'fonts', fontFileName),
    path.resolve(process.cwd(), 'server', 'assets', 'fonts', fontFileName),
    path.resolve(process.cwd(), 'assets', 'fonts', fontFileName),
    path.resolve('server', 'assets', 'fonts', fontFileName),
    path.resolve('assets', 'fonts', fontFileName)
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
};

// ─── 2. Base64 Font Embedder ──────────────────────────────────────────────────
// Reads local TTF files and inlines them as @font-face data URIs
// so Chromium on Render never needs a network call to Google Fonts
const getEmbeddedFontsCSS = () => {
  try {
    const regPath = findFontPath('NotoSansGujarati-Regular.ttf');
    const boldPath = findFontPath('NotoSansGujarati-Bold.ttf');
    if (!regPath || !boldPath) {
      console.warn('[PDF] Gujarati fonts not found on disk, Gujarati text may not render');
      return '';
    }
    const regB64  = fs.readFileSync(regPath).toString('base64');
    const boldB64 = fs.readFileSync(boldPath).toString('base64');
    console.log('[PDF] Embedding Gujarati fonts as base64 (' + Math.round((regB64.length + boldB64.length) / 1024) + ' KB)');
    // unicode-range restricts NotoGuj to ONLY Gujarati/Devanagari blocks.
    // All other codepoints (Latin, emoji, etc.) fall through to system fonts.
    const gujaratiRange = 'U+0A80-0AFF, U+0900-097F, U+0020-007E, U+00A0-00FF';
    return `
      @font-face {
        font-family: 'NotoGuj';
        font-weight: 400;
        font-style: normal;
        src: url('data:font/truetype;base64,${regB64}') format('truetype');
        unicode-range: ${gujaratiRange};
        font-display: block;
      }
      @font-face {
        font-family: 'NotoGuj';
        font-weight: 700;
        font-style: normal;
        src: url('data:font/truetype;base64,${boldB64}') format('truetype');
        unicode-range: ${gujaratiRange};
        font-display: block;
      }
    `;
  } catch (err) {
    console.warn('[PDF] Font embed failed:', err.message);
    return '';
  }
};

// ─── 3. Chrome Discovery ──────────────────────────────────────────────────────
const findChromeInCache = (dir) => {
  try {
    if (!fs.existsSync(dir)) return null;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findChromeInCache(full);
        if (found) return found;
      } else if (
        (entry.name === 'chrome' || entry.name === 'chrome.exe' || entry.name === 'chromium') &&
        !full.endsWith('.deb') && !full.endsWith('.rpm')
      ) {
        return full;
      }
    }
  } catch (_) {}
  return null;
};

const launchBrowser = async () => {
  // 1. Explicit env path (Dockerfile ENV or Render env var)
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    try {
      console.log('[PDF] Launching via PUPPETEER_EXECUTABLE_PATH');
      return await puppeteerCore.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, headless: true, args: BROWSER_ARGS });
    } catch (e) { console.warn('[PDF] env path failed:', e.message); }
  }

  // 2. @sparticuz/chromium — purpose-built for Linux/Render/Lambda/Railway
  if (process.platform === 'linux') {
    try {
      console.log('[PDF] Trying @sparticuz/chromium for Linux...');
      const sparticuzPath = await chromium.executablePath();
      if (sparticuzPath && fs.existsSync(sparticuzPath)) {
        console.log('[PDF] sparticuz path:', sparticuzPath);
        return await puppeteerCore.launch({
          executablePath: sparticuzPath,
          headless: true,
          args: [...(chromium.args || []), ...BROWSER_ARGS]
        });
      }
    } catch (e) { console.warn('[PDF] sparticuz failed:', e.message); }
  }

  // 3. Search Render cache dirs (postinstall chrome ends up here)
  for (const dir of [
    '/opt/render/.cache/puppeteer',
    path.join(process.env.HOME || '/root', '.cache', 'puppeteer'),
    path.resolve('.cache', 'puppeteer'),
    path.resolve('..', '.cache', 'puppeteer')
  ]) {
    const chrome = findChromeInCache(dir);
    if (chrome) {
      try {
        console.log('[PDF] Launching cached chrome:', chrome);
        return await puppeteerCore.launch({ executablePath: chrome, headless: true, args: BROWSER_ARGS });
      } catch (e) { console.warn('[PDF] cached chrome failed:', e.message); }
    }
  }

  // 4. Default puppeteer.launch (bundled chrome)
  try {
    console.log('[PDF] Trying default puppeteer.launch()...');
    return await puppeteer.launch({ headless: true, args: BROWSER_ARGS });
  } catch (e) { console.warn('[PDF] default puppeteer failed:', e.message); }

  // 5. System paths
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ]) {
    if (fs.existsSync(p)) {
      try {
        console.log('[PDF] Launching system browser:', p);
        return await puppeteerCore.launch({ executablePath: p, headless: true, args: BROWSER_ARGS });
      } catch (e) { console.warn('[PDF] system path failed:', p); }
    }
  }

  return null;
};

// ─── 4. Avatar URL ────────────────────────────────────────────────────────────
const optimizeAvatar = (url, size = 80) => {
  if (!url || typeof url !== 'string') return '';
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    return url.replace('/upload/', `/upload/w_${size},h_${size},c_fill,g_face,q_auto,f_auto/`);
  }
  return url;
};

// ─── 5. HTML Builder ──────────────────────────────────────────────────────────
const buildReportHTML = (group, monthStr, memberReports) => {
  const [yearStr, monthNumStr] = (monthStr || '').split('-');
  const monthNum = parseInt(monthNumStr, 10);
  const monthName = MONTH_NAMES[monthNum - 1] || monthStr;
  const totalMembers = memberReports.length;
  const avgCompletion = totalMembers > 0
    ? Math.round(memberReports.reduce((s, m) => s + (m.overallStats?.overallCompletionRate || 0), 0) / totalMembers)
    : 0;

  // Embed fonts once per HTML document (base64)
  const fontsCSS = getEmbeddedFontsCSS();

  // ── Leaderboard rows
  const lbRows = memberReports.map((m, i) => {
    const rank = i + 1;
    // Use text medals — guaranteed to render with any font
    const medalText = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
    const medalClass = rank <= 3 ? ['rank-gold', 'rank-silver', 'rank-bronze'][rank - 1] : 'rank-normal';
    const comp = m.overallStats?.overallCompletionRate || 0;
    const compClass = comp >= 80 ? 'high' : comp >= 50 ? 'mid' : 'low';
    const avatarUrl = optimizeAvatar(m.userProfile?.avatar || '', 44);
    const initial = (m.userProfile?.name || 'U').charAt(0).toUpperCase();
    const avatarHTML = avatarUrl
      ? `<div class="av-sm"><img src="${avatarUrl}" onerror="this.style.display='none';this.nextSibling.style.display='flex'"><span class="av-init" style="display:none">${initial}</span></div>`
      : `<div class="av-sm"><span class="av-init">${initial}</span></div>`;
    return `
      <tr class="${i % 2 ? 'row-alt' : ''}">
        <td class="td-rank ${medalClass}"><span class="emoji-cell">${medalText}</span></td>
        <td class="td-name"><div class="name-row">${avatarHTML}<span>${m.userProfile?.name || 'Unknown'}</span></div></td>
        <td class="td-score">${m.overallStats?.disciplineScore || 0}</td>
        <td class="td-pct"><span class="badge badge-${compClass}">${comp}%</span></td>
      </tr>`;
  }).join('');

  // ── Member pages
  const memberPages = memberReports.map((report, i) => {
    const name = report.userProfile?.name || 'સભ્ય';
    const username = report.userProfile?.username ? `@${report.userProfile.username}` : '';
    const activeDays = report.activeDaysInMonth || 30;
    const score = report.overallStats?.disciplineScore || 0;
    const rate = report.overallStats?.overallCompletionRate || 0;
    const pageNum = i + 2;
    const totalPages = memberReports.length + 1;
    const avatarUrl = optimizeAvatar(report.userProfile?.avatar || '', 112);
    const initial = name.charAt(0).toUpperCase();
    const avatarHTML = avatarUrl
      ? `<div class="av-lg"><img src="${avatarUrl}" onerror="this.style.display='none';this.nextSibling.style.display='flex'"><span class="av-init-lg" style="display:none">${initial}</span></div>`
      : `<div class="av-lg"><span class="av-init-lg">${initial}</span></div>`;

    const habitRows = (report.habitSummaries || []).map((h, hi) => {
      const comp = h.completionPercentage || 0;
      const barColor = comp >= 80 ? '#0f766e' : comp >= 50 ? '#d97706' : '#dc2626';
      const compClass = comp >= 80 ? 'high' : comp >= 50 ? 'mid' : 'low';

      let prog = `<b>${h.completedDaysCount}</b>/${activeDays} દિ.`;
      let avg = '-';
      if (h.type === 'count') {
        const total = h.typeDetails?.totalCount || 0;
        prog = `${total.toLocaleString()} ${h.targetUnit || ''}<br><small>(${h.completedDaysCount}/${activeDays}d)</small>`;
        avg = `${h.typeDetails?.dailyAverage || 0} ${h.targetUnit || ''}/d`;
      } else if (h.type === 'time_target') {
        const hrs = h.typeDetails?.totalHours || 0;
        const mins = h.typeDetails?.totalMinutes || 0;
        prog = `${hrs >= 1 ? hrs + ' ક.' : mins + ' મ.'}<br><small>(${h.completedDaysCount}/${activeDays}d)</small>`;
        avg = `${h.typeDetails?.dailyAverageMinutes || 0} મ./d`;
      } else if (h.type === 'time_of_day') {
        avg = `${h.typeDetails?.averageTime || 'N/A'}`;
      } else if (h.type === 'yes_no' || h.type === 'boolean') {
        prog = `<b>${h.completedDaysCount}</b>/${activeDays}`;
        avg = `${comp}% હા.`;
      }

      return `
        <tr class="${hi % 2 ? 'row-alt' : ''}">
          <td class="td-htitle">${h.title}</td>
          <td class="td-hprog">${prog}</td>
          <td class="td-havg">${avg}</td>
          <td class="td-hrate">
            <div class="pb-wrap">
              <div class="pb-track"><div class="pb-fill" style="width:${Math.min(Math.max(comp,0),100)}%;background:${barColor}"></div></div>
              <span class="badge badge-${compClass}">${comp}%</span>
            </div>
          </td>
        </tr>`;
    }).join('');

    return `
      <div class="page member-page">
        <div class="page-body">
          <div class="topbar">
            <div class="topbrand"><span class="topinvoc">॥ જય સ્વામિનારાયણ ॥</span> &bull; ${group.name || 'Sankalp Group'}</div>
            <div class="toppage">પ. ${pageNum}/${totalPages}</div>
          </div>

          <div class="mcard">
            <div class="mcard-left">
              ${avatarHTML}
              <div class="mcard-info">
                <div class="mcard-nameline">
                  <span class="mcard-name">${name}</span>
                  <span class="pill-rank">ક્રમ #${i + 1}</span>
                  ${username ? `<span class="pill-user">${username}</span>` : ''}
                </div>
                <div class="mcard-meta">
                  <span class="tag">${group.name || 'Sankalp'}</span>
                  <span class="tag"><span class="emoji-cell">&#128197;</span> ${monthName} ${yearStr}</span>
                  <span class="tag tag-teal"><span class="emoji-cell">&#127919;</span> ${activeDays} દિ. સક્રિય</span>
                </div>
              </div>
            </div>
            <div class="mcard-kpis">
              <div class="kpi kpi-green">
                <div class="kpi-lbl">DISCIPLINE</div>
                <div class="kpi-val">${score}<span>/${activeDays}</span></div>
              </div>
              <div class="kpi kpi-teal">
                <div class="kpi-lbl">સફળ. દર</div>
                <div class="kpi-val">${rate}%</div>
              </div>
            </div>
          </div>

          <div class="habit-sec">
            <div class="sec-hdr">
              <div class="sec-hdr-l">
                <span>&#128203;</span>
                <div>
                  <div class="sec-title">ગ્રુપ નિયમ પ્રગ.</div>
                  <div class="sec-sub">${name} — ${monthName} ${yearStr}</div>
                </div>
              </div>
              <div class="sec-month">${monthName} ${yearStr}</div>
            </div>
            <div class="tbl-box">
              <table class="htbl">
                <thead>
                  <tr><th>નિયમ</th><th>કુ.પ./દિ.</th><th>સ.સ.</th><th>%</th></tr>
                </thead>
                <tbody>${habitRows}</tbody>
              </table>
            </div>
          </div>

          <div class="insight">
            <div class="ins-ico">&#10022;</div>
            <div>
              <div class="ins-t">MONTHLY INSIGHT</div>
              <div class="ins-d">${score} દિ. સંપૂ. નિ. &bull; સ.દ. ${rate}%</div>
            </div>
          </div>
        </div>
        <div class="footer">
          <div><span class="emoji-cell">&#127775;</span> <i>&#8220;નિ., ધ. અને સ.નું પ. એ ભ.ની સ. શો.&#8221;</i></div>
          <div>જ. સ્. <span class="emoji-cell">&#128591;</span></div>
        </div>
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="gu">
<head>
<meta charset="UTF-8">
<title>${group.name || 'Sankalp'} Report ${monthStr}</title>
<style>
${fontsCSS}

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;background:#e2e8f0}
body{
  /* NotoGuj covers Gujarati/Devanagari only (unicode-range above).
     Emoji + Latin fall through to system emoji/sans fonts. */
  font-family:'NotoGuj','Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji','Noto Sans Gujarati',sans-serif;
  color:#0f172a;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}

@page{size:A4 portrait;margin:0}

/* No overflow:hidden — it clips bottom rows. Pages are exactly 297mm tall via min-height. */
.page{width:210mm;min-height:297mm;height:297mm;background:#fff;margin:0 auto 10px;display:flex;flex-direction:column;page-break-after:always}
.page:last-child{page-break-after:avoid}
.page-body{flex:1;padding:12px 18px 6px;display:flex;flex-direction:column;gap:6px;overflow:hidden}

/* TOP BAR */
.topbar{display:flex;justify-content:space-between;align-items:center;padding-bottom:7px;border-bottom:1.5px solid #0f766e}
.topbrand{font-size:9px;font-weight:700;color:#0f766e;display:flex;align-items:center;gap:5px}
.topinvoc{font-size:10px;font-weight:900}
.toppage{font-size:8px;color:#64748b;font-weight:800}

/* COVER DIVINE */
.divine{text-align:center;padding:6px 0 4px}
.divine-s{font-size:9px;color:#0f766e;font-weight:700}
.divine-m{font-size:16px;font-weight:900;color:#134e4a;margin-top:2px}

/* HERO */
.hero{display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#134e4a,#0f766e);border-radius:10px;padding:14px 18px}
.hero-title{font-size:17px;font-weight:900;color:#fff}
.hero-sub{font-size:9px;color:rgba(255,255,255,.85);margin-top:3px}
.hero-date{font-size:10px;font-weight:800;color:#ccfbf1;background:rgba(255,255,255,.15);padding:6px 10px;border-radius:6px}

/* STAT CARDS */
.statgrid{display:flex;gap:8px}
.statcard{flex:1;border-radius:8px;padding:10px 12px;border:1.5px solid}
.statcard-g{background:#f0fdf4;border-color:#a7f3d0}
.statcard-t{background:#f0fdfa;border-color:#99f6e4}
.stat-lbl{font-size:7.5px;font-weight:900;color:#166534;letter-spacing:.4px;text-transform:uppercase}
.statcard-t .stat-lbl{color:#0f766e}
.stat-val{font-size:15px;font-weight:900;color:#14532d;margin-top:3px}
.statcard-t .stat-val{color:#134e4a}

/* TABLE */
.tbl-box{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
table{width:100%;border-collapse:collapse;font-size:8.5px}
thead tr{background:#0f766e;color:#fff}
thead th{padding:7px 8px;font-weight:900;text-align:left;font-size:8.5px}

/* LEADERBOARD — compact rows so 14 members fit on one page */
td{padding:3px 6px;border-bottom:1px solid #e2e8f0;vertical-align:middle;line-height:1.3}
tr:last-child td{border-bottom:none}
.row-alt{background:#f8fafc}
.td-rank{font-size:9px;font-weight:900;width:52px;white-space:nowrap}
.rank-gold{color:#92400e}
.rank-silver{color:#475569}
.rank-bronze{color:#b45309}
.rank-normal{color:#334155}
.td-name{width:46%}
.td-score{text-align:center;font-size:10px;font-weight:900;color:#134e4a;width:16%}
.td-pct{text-align:center;width:13%}
/* Emoji cell — uses system emoji font via fallback chain */
.emoji-cell{font-family:'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif;font-size:13px}

/* NAME ROW */
.name-row{display:flex;align-items:center;gap:5px}

/* AVATAR */
.av-sm{width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#0f766e,#134e4a);flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden}
.av-sm img{width:100%;height:100%;object-fit:cover;border-radius:50%}
.av-init{font-size:10px;font-weight:900;color:#fff}
.av-lg{width:58px;height:58px;border-radius:50%;background:linear-gradient(135deg,#0f766e,#134e4a);flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden}
.av-lg img{width:100%;height:100%;object-fit:cover;border-radius:50%}
.av-init-lg{font-size:22px;font-weight:900;color:#fff}

/* BADGE */
.badge{display:inline-block;padding:2px 7px;border-radius:999px;font-size:8px;font-weight:900}
.badge-high{background:#dcfce7;color:#166534}
.badge-mid{background:#fef9c3;color:#854d0e}
.badge-low{background:#fee2e2;color:#991b1b}

/* MEMBER CARD */
.mcard{display:flex;justify-content:space-between;align-items:flex-start;background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px;box-shadow:0 1px 4px rgba(15,23,42,.045)}
.mcard-left{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
.mcard-info{min-width:0}
.mcard-nameline{display:flex;align-items:center;flex-wrap:wrap;gap:5px}
.mcard-name{font-size:15px;font-weight:900;color:#020617}
.pill-rank{display:inline-flex;align-items:center;background:#134e4a;color:#ccfbf1;border:1px solid #0f766e;border-radius:999px;padding:2px 7px;font-size:8px;font-weight:900}
.pill-user{display:inline-flex;align-items:center;background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;border-radius:999px;padding:2px 7px;font-size:8px;font-weight:800}
.mcard-meta{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
.tag{display:inline-flex;align-items:center;padding:2px 6px;border-radius:5px;background:#f8fafc;border:1px solid #dbe3ec;color:#334155;font-size:8px;font-weight:800}
.tag-teal{color:#115e59;background:#f0fdfa;border-color:#99f6e4}
.mcard-kpis{display:flex;gap:6px;flex-shrink:0}
.kpi{min-width:80px;padding:7px 10px;border-radius:8px;text-align:center;border:1.5px solid}
.kpi-green{background:#f0fdf4;border-color:#86efac}
.kpi-teal{background:#f0fdfa;border-color:#5eead4}
.kpi-lbl{font-size:6.5px;font-weight:900;color:#166534;letter-spacing:.3px;text-transform:uppercase}
.kpi-teal .kpi-lbl{color:#115e59}
.kpi-val{margin-top:3px;font-size:15px;font-weight:900;color:#14532d;line-height:1}
.kpi-teal .kpi-val{color:#134e4a}
.kpi-val span{font-size:8px;font-weight:800;opacity:.7}

/* HABIT SECTION */
.habit-sec{flex:1}
.sec-hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5px}
.sec-hdr-l{display:flex;align-items:flex-start;gap:6px}
.sec-title{font-size:10px;font-weight:900;color:#0f172a}
.sec-sub{font-size:7.5px;color:#64748b;font-weight:600;margin-top:1px}
.sec-month{font-size:8px;font-weight:800;color:#0f766e;background:#f0fdfa;border:1px solid #99f6e4;padding:3px 7px;border-radius:5px}
.td-htitle{width:31%;font-weight:900;color:#0f172a}
.td-hprog{width:29%;color:#134e4a;font-weight:700}
.td-havg{width:22%;color:#475569;font-weight:700}
.td-hrate{width:18%}
.htbl thead th{background:#0f766e;color:#fff}

/* PROGRESS BAR */
.pb-wrap{display:flex;align-items:center;gap:5px}
.pb-track{width:50px;height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden}
.pb-fill{height:100%;border-radius:999px}

/* INSIGHT */
.insight{display:flex;align-items:center;gap:8px;padding:7px 10px;background:linear-gradient(135deg,#f0fdfa,#f8fafc);border:1px solid #99f6e4;border-radius:8px}
.ins-ico{width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:#ccfbf1;color:#0f766e;border-radius:6px;font-size:12px;flex-shrink:0}
.ins-t{font-size:7px;font-weight:900;color:#0f766e;text-transform:uppercase;letter-spacing:.3px}
.ins-d{font-size:8px;color:#475569;font-weight:600;margin-top:2px}

/* FOOTER */
.footer{display:flex;justify-content:space-between;align-items:center;padding:6px 18px 8px;border-top:1px solid #cbd5e1;background:#f8fafc;font-size:8px;color:#475569;font-weight:700}
.footer>div:last-child{color:#0f766e;font-weight:900;white-space:nowrap}

/* LEADERBOARD SECTION FLEX — flex:1 lets it fill remaining page height */
.lb-sec{flex:1;display:flex;flex-direction:column;min-height:0}
.lb-sec .tbl-box{flex:1;overflow:hidden}

@media print{
  body{background:#fff}
  .page{margin:0;box-shadow:none;page-break-after:always}
  .page:last-child{page-break-after:avoid}
}
</style>
</head>
<body>

<!-- PAGE 1: COVER -->
<div class="page">
  <div class="page-body">
    <div class="divine">
      <div class="divine-s">॥ શ્રી સ્વામિનારાયણો વિજયતે ॥</div>
      <div class="divine-m">॥ જય સ્વામિનારાયણ ॥</div>
    </div>

    <div class="topbar" style="margin-top:4px">
      <div class="topbrand">${group.name || 'Sankalp Group'} &bull; માસ. અહ.</div>
      <div class="toppage">પ. ૧/${memberReports.length + 1}</div>
    </div>

    <div class="hero">
      <div>
        <div class="hero-title">${group.name || 'Sankalp Group'}</div>
        <div class="hero-sub">માસ. પ્ર. અહ. &amp; લીડ.</div>
      </div>
      <div class="hero-date">&#128197; ${monthName} ${yearStr}</div>
    </div>

    <div class="statgrid">
      <div class="statcard statcard-g">
        <div class="stat-lbl">કુ. સ.</div>
        <div class="stat-val">${totalMembers} સ.</div>
      </div>
      <div class="statcard statcard-t">
        <div class="stat-lbl">સ. સ. દ.</div>
        <div class="stat-val">${avgCompletion}%</div>
      </div>
    </div>

    <div class="lb-sec">
      <div class="sec-hdr">
        <div class="sec-hdr-l">
          <span class="emoji-cell">&#127942;</span>
          <div>
            <div class="sec-title">&#128293; માસ. લીડ. ક્ર.</div>
            <div class="sec-sub">ગ.સ. ની નિ. • પ. • પ્ર.</div>
          </div>
        </div>
        <div class="sec-month">${monthName} ${yearStr}</div>
      </div>
      <div class="tbl-box">
        <table>
          <thead><tr><th>ક્ર.</th><th>સ. નામ</th><th style="text-align:center">સ્.(દ.)</th><th style="text-align:center">સ.%</th></tr></thead>
          <tbody>${lbRows}</tbody>
        </table>
      </div>
    </div>
  </div>
  <div class="footer">
    <div>જ. સ્. &bull; habitsankalp.netlify.app</div>
    <div><span class="emoji-cell">&#128591;</span></div>
  </div>
</div>

<!-- PAGES 2..N: MEMBERS -->
${memberPages}

</body>
</html>`;
};

// ─── 6. PDFKit Fallback ───────────────────────────────────────────────────────
const generatePDFKitReport = (group, monthStr, memberReports) => {
  return new Promise((resolve, reject) => {
    try {
      const [yearStr, monthNumStr] = (monthStr || '').split('-');
      const monthNum = parseInt(monthNumStr, 10);
      const monthName = MONTH_NAMES[monthNum - 1] || monthStr;
      const totalMembers = memberReports.length;
      const avgComp = totalMembers > 0
        ? Math.round(memberReports.reduce((s, m) => s + (m.overallStats?.overallCompletionRate || 0), 0) / totalMembers)
        : 0;

      const cleanName = (group.name || 'Sankalp Group')
        .replace(/[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        .trim();

      const doc = new PDFDocument({
        size: 'A4', margin: 36, bufferPages: true,
        info: { Title: `${cleanName} Report ${monthStr}`, Author: 'Sankalp Habit Tracker' }
      });

      const regPath  = findFontPath('NotoSansGujarati-Regular.ttf');
      const boldPath = findFontPath('NotoSansGujarati-Bold.ttf');
      let hasFont = false;
      if (regPath && boldPath) {
        doc.registerFont('Guj', regPath);
        doc.registerFont('GujB', boldPath);
        hasFont = true;
        console.log('[PDF Fallback] Gujarati fonts loaded from disk');
      } else {
        console.warn('[PDF Fallback] Gujarati fonts NOT found — text may render as boxes on Render');
      }
      const fR = hasFont ? 'Guj' : 'Helvetica';
      const fB = hasFont ? 'GujB' : 'Helvetica-Bold';

      const buf = [];
      doc.on('data', c => buf.push(c));
      doc.on('end', () => resolve(Buffer.concat(buf)));
      doc.on('error', reject);

      const W = doc.page.width, H = doc.page.height;

      // PAGE 1
      doc.rect(0, 0, W, H).fill('#ffffff');
      doc.font(fB).fillColor('#0f766e').fontSize(11).text('॥ જય સ્વામિ. ॥', 36, 30);
      doc.font(fR).fillColor('#64748b').fontSize(9).text(`${cleanName} - માસ. અહ.`, 220, 30, { align: 'right', width: 330 });
      doc.moveTo(36, 46).lineTo(559, 46).strokeColor('#0f766e').lineWidth(1.5).stroke();

      doc.font(fB).fillColor('#134e4a').fontSize(17).text(cleanName, 36, 58, { align: 'center' });
      doc.font(fR).fillColor('#0f766e').fontSize(10).text(`${monthName} ${yearStr} — માસ. પ્ર. અહ.`, { align: 'center' });

      // Stat cards
      doc.roundedRect(36, 115, 155, 46, 5).fillAndStroke('#f0fdf4', '#a7f3d0');
      doc.font(fB).fillColor('#166534').fontSize(7.5).text('કુ.સ.', 46, 124);
      doc.font(fB).fillColor('#14532d').fontSize(14).text(`${totalMembers} સ.`, 46, 135);

      doc.roundedRect(205, 115, 155, 46, 5).fillAndStroke('#f0fdfa', '#99f6e4');
      doc.font(fB).fillColor('#0f766e').fontSize(7.5).text('સ.સ.દ.', 215, 124);
      doc.font(fB).fillColor('#134e4a').fontSize(14).text(`${avgComp}%`, 215, 135);

      doc.roundedRect(374, 115, 185, 46, 5).fillAndStroke('#fefce8', '#fde047');
      doc.font(fB).fillColor('#854d0e').fontSize(7.5).text('મ./વ.', 384, 124);
      doc.font(fB).fillColor('#713f12').fontSize(14).text(`${monthName} ${yearStr}`, 384, 135);

      // Leaderboard
      doc.font(fB).fillColor('#0f172a').fontSize(12).text('માસ. ક્ર.', 36, 178);
      const hY = 196;
      doc.rect(36, hY, 523, 22).fill('#0f766e');
      doc.font(fB).fillColor('#ffffff').fontSize(9).text('ક્ર.', 46, hY + 6);
      doc.text('સ. નામ', 100, hY + 6);
      doc.text('સ્.(દ.)', 360, hY + 6, { align: 'center', width: 90 });
      doc.text('સ.%', 465, hY + 6, { align: 'center', width: 80 });

      let cy = hY + 22;
      memberReports.forEach((m, i) => {
        doc.rect(36, cy, 523, 22).fill(i % 2 ? '#f8fafc' : '#ffffff');
        const rk = i === 0 ? '1 (' + 'ગો.)' : i === 1 ? '2 (સ.)' : i === 2 ? '3 (બ.)' : `${i + 1}`;
        doc.font(fB).fillColor('#1e293b').fontSize(8.5).text(rk, 46, cy + 6);
        doc.font(fR).text(m.userProfile?.name || 'Unknown', 100, cy + 6);
        doc.font(fB).text(`${m.overallStats?.disciplineScore || 0}d`, 360, cy + 6, { align: 'center', width: 90 });
        doc.text(`${m.overallStats?.overallCompletionRate || 0}%`, 465, cy + 6, { align: 'center', width: 80 });
        doc.moveTo(36, cy + 22).lineTo(559, cy + 22).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        cy += 22;
      });

      doc.moveTo(36, H - 28).lineTo(559, H - 28).strokeColor('#0f766e').lineWidth(1).stroke();
      doc.font(fR).fillColor('#64748b').fontSize(8).text('જ.સ્. • habitsankalp.netlify.app', 36, H - 18);

      // Member pages
      memberReports.forEach((report, i) => {
        doc.addPage();
        doc.rect(0, 0, W, H).fill('#ffffff');
        const name    = report.userProfile?.name || 'સ.';
        const uname   = report.userProfile?.username ? `@${report.userProfile.username}` : '';
        const aDays   = report.activeDaysInMonth || 30;
        const sc      = report.overallStats?.disciplineScore || 0;
        const rt      = report.overallStats?.overallCompletionRate || 0;
        const pg      = i + 2;

        doc.font(fB).fillColor('#0f766e').fontSize(10).text('॥ જ.સ્. ॥', 36, 30);
        doc.font(fR).fillColor('#64748b').fontSize(8.5).text(`${cleanName} • પ.${pg}/${totalMembers+1}`, 220, 30, { align: 'right', width: 330 });
        doc.moveTo(36, 44).lineTo(559, 44).strokeColor('#0f766e').lineWidth(1.5).stroke();

        const mY = 52;
        doc.roundedRect(36, mY, 523, 68, 7).fillAndStroke('#f8fafc', '#cbd5e1');
        doc.font(fB).fillColor('#020617').fontSize(14).text(name, 50, mY + 10);
        if (uname) doc.font(fR).fillColor('#64748b').fontSize(9).text(uname, 50, mY + 28);
        doc.font(fR).fillColor('#0f766e').fontSize(8.5).text(`ક્.#${i+1}  •  ${aDays} દ.  •  ${monthName} ${yearStr}`, 50, mY + 44);

        doc.roundedRect(350, mY + 8, 88, 50, 5).fillAndStroke('#f0fdf4', '#86efac');
        doc.font(fB).fillColor('#166534').fontSize(7).text('DISCIPLINE', 350, mY + 15, { align: 'center', width: 88 });
        doc.font(fB).fillColor('#14532d').fontSize(12).text(`${sc}/${aDays}`, 350, mY + 28, { align: 'center', width: 88 });

        doc.roundedRect(448, mY + 8, 88, 50, 5).fillAndStroke('#f0fdfa', '#5eead4');
        doc.font(fB).fillColor('#115e59').fontSize(7).text('સ.દ.', 448, mY + 15, { align: 'center', width: 88 });
        doc.font(fB).fillColor('#134e4a').fontSize(12).text(`${rt}%`, 448, mY + 28, { align: 'center', width: 88 });

        // Habit table
        const htY = 136;
        doc.font(fB).fillColor('#0f172a').fontSize(11).text('ગ્રુ. નિ. પ્ર.', 36, htY);
        const hhY = htY + 17;
        doc.rect(36, hhY, 523, 21).fill('#0f766e');
        doc.font(fB).fillColor('#ffffff').fontSize(8.5);
        doc.text('નિ.', 46, hhY + 5);
        doc.text('કુ.પ./દ.', 240, hhY + 5);
        doc.text('સ.સ.', 380, hhY + 5);
        doc.text('સ.%', 485, hhY + 5);

        let hry = hhY + 21;
        (report.habitSummaries || []).forEach((h, hi) => {
          doc.rect(36, hry, 523, 24).fill(hi % 2 ? '#f8fafc' : '#ffffff');
          let pg2 = `${h.completedDaysCount}/${aDays} d`;
          let av = '-';
          if (h.type === 'count') {
            pg2 = `${h.typeDetails?.totalCount || 0} ${h.targetUnit || ''} (${h.completedDaysCount}d)`;
            av = `${h.typeDetails?.dailyAverage || 0}/d`;
          } else if (h.type === 'time_target') {
            const hrs2 = h.typeDetails?.totalHours || 0;
            const min2 = h.typeDetails?.totalMinutes || 0;
            pg2 = (hrs2 >= 1 ? `${hrs2}h` : `${min2}m`) + ` (${h.completedDaysCount}d)`;
            av = `${h.typeDetails?.dailyAverageMinutes || 0}m/d`;
          } else if (h.type === 'time_of_day') {
            av = h.typeDetails?.averageTime || 'N/A';
          }
          doc.font(fR).fillColor('#0f172a').fontSize(8.5).text(h.title, 46, hry + 6, { width: 188, lineBreak: false });
          doc.fillColor('#334155').text(pg2, 240, hry + 6);
          doc.fillColor('#475569').text(av, 380, hry + 6);
          const pct = h.completionPercentage || 0;
          doc.font(fB).fillColor(pct >= 80 ? '#166534' : pct >= 50 ? '#854d0e' : '#991b1b').fontSize(9).text(`${pct}%`, 485, hry + 6);
          doc.moveTo(36, hry + 24).lineTo(559, hry + 24).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
          hry += 24;
        });

        doc.moveTo(36, H - 28).lineTo(559, H - 28).strokeColor('#0f766e').lineWidth(1).stroke();
        doc.font(fR).fillColor('#64748b').fontSize(8).text('જ.સ্. • habitsankalp.netlify.app', 36, H - 18);
        doc.font(fB).text(`પ.${pg}/${totalMembers+1}`, 450, H - 18, { align: 'right', width: 100 });
      });

      doc.end();
    } catch (err) { reject(err); }
  });
};

// ─── 7. Main Export ───────────────────────────────────────────────────────────
export const generateGroupMonthlyReportPDF = async (group, monthStr, memberReports) => {
  let browser = null;

  try { browser = await launchBrowser(); }
  catch (e) { console.warn('[PDF] Browser launch error:', e.message); }

  if (browser) {
    try {
      console.log('[PDF] Rendering HTML in Chromium...');
      const page = await browser.newPage();

      const html = buildReportHTML(group, monthStr, memberReports);

      // Block external HTTP font/stylesheet requests — fonts are all inlined
      await page.setRequestInterception(true);
      page.on('request', req => {
        const type = req.resourceType();
        if ((type === 'font' || type === 'stylesheet') && req.url().startsWith('http')) {
          req.abort();
        } else {
          req.continue();
        }
      });

      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for embedded @font-face fonts to be ready
      await page.evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready;
      });

      // Wait for avatar images to load/fail
      await page.evaluate(async () => {
        const imgs = Array.from(document.images);
        await Promise.all(imgs.map(img => img.complete
          ? Promise.resolve()
          : new Promise(r => {
              img.addEventListener('load', r, { once: true });
              img.addEventListener('error', r, { once: true });
            })
        ));
      });

      const pdfBuf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
        preferCSSPageSize: true
      });

      await browser.close();
      console.log(`[PDF] Chromium PDF ready: ${(pdfBuf.length / 1024).toFixed(1)} KB`);
      return Buffer.from(pdfBuf);
    } catch (err) {
      console.error('[PDF] Chromium failed, falling back to PDFKit:', err.message);
      try { await browser.close(); } catch (_) {}
    }
  }

  console.log('[PDF] Falling back to PDFKit...');
  const fallbackBuf = await generatePDFKitReport(group, monthStr, memberReports);
  console.log(`[PDF] PDFKit fallback ready: ${(fallbackBuf.length / 1024).toFixed(1)} KB`);
  return fallbackBuf;
};