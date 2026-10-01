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

/**
 * Embed local TTF fonts directly into HTML as base64
 * Ensures 0ms font load and 100% offline rendering on Render with zero external network lag
 */
const getEmbeddedFontsCSS = () => {
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
    return css;
  } catch (err) {
    console.warn('⚠️ [PDF] Could not inline font base64:', err.message);
    return '';
  }
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
 * Build HTML Template for Professional Multi-Page PDF
 * Matches exact format from reference PDF
 */
const buildReportHTML = (group, monthStr, memberReports) => {
  const [yearStr, monthNumStr] = (monthStr || '').split('-');
  const monthNum = parseInt(monthNumStr, 10);
  const monthName = MONTH_NAMES[monthNum - 1] || monthStr;

  const totalMembers = memberReports.length;

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
          ? '🥇 1'
          : rank === 2
          ? '🥈 2'
          : rank === 3
          ? '🥉 3'
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

      const initial = (
        m.userProfile?.name || 'U'
      )
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
                ${m.userProfile?.name || 'Unknown'}
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
      const memberName =
        report.userProfile?.name || 'સભ્ય';

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

      const initial = memberName
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
                  ${h.title}
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
                  ${group.name || 'Sankalp Group'}
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
                      ${group.name || 'Sankalp Group'}
                    </span>

                    <span class="meta-pill">
                      <span class="meta-icon">📅</span>
                      ${monthName} ${yearStr}
                    </span>

                    <span class="meta-pill meta-pill-teal">
                      <span class="meta-icon">🎯</span>
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
                  <span class="section-icon">📋</span>

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
                ✦
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
              🌟
              <i>
                "નિયમ, ધર્મ અને સંકલ્પનું દ્રઢ પાલન એ જ ભક્તિની સાચી શોભા છે."
              </i>
            </div>

            <div class="footer-right">
              જય સ્વામિનારાયણ 🙏🏻
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
            ${group.name || 'Sankalp Group'}
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
            ${group.name || 'Sankalp Group 🙏🏻'}
          </div>

          <div class="hero-subtitle">
            માસિક પ્રગતિ અહેવાલ અને લીડરબોર્ડ
          </div>

        </div>

        <div class="hero-date">
          📅 ${monthName} ${yearStr}
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
              🏆
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

      const cleanGroupName = (group.name || 'Sankalp Group')
        .replace(/[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        .trim();

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

        const rawName = (m.userProfile?.name || 'Unknown').replace(/[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
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
        const mName = (report.userProfile?.name || 'સભ્ય').replace(/[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
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

          const hTitle = (h.title || '').replace(/[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
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
  let browser = null;

  try {
    browser = await launchBrowser();
  } catch (e) {
    console.warn('⚠️ [PDF] Browser launch error:', e.message);
  }

  if (browser) {
    try {
      console.log('🚀 [PDF] Rendering HTML in Chromium with embedded fonts & avatars...');
      const page = await browser.newPage();

      const html = buildReportHTML(group, monthStr, memberReports);

      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      // Wait for embedded fonts to be ready
      await page.evaluate(async () => {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
      });

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

      await browser.close();
      console.log(`✅ [PDF] Chromium PDF ready: ${(pdfBuf.length / 1024).toFixed(1)} KB`);
      return Buffer.from(pdfBuf);
    } catch (err) {
      console.error('❌ [PDF] Chromium failed, falling back to PDFKit:', err.message);
      try {
        await browser.close();
      } catch (_) {}
    }
  }

  console.log('⚠️ [PDF] Falling back to enhanced PDFKit generator...');
  const fallbackBuf = await generatePDFKitReport(group, monthStr, memberReports);
  console.log(`✅ [PDF] PDFKit fallback ready: ${(fallbackBuf.length / 1024).toFixed(1)} KB`);
  return fallbackBuf;
};