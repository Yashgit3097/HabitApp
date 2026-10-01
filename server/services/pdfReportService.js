import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import PDFDocument from 'pdfkit';

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
  '--single-process',
  '--font-render-hinting=none',
  '--hide-scrollbars',
  '--disable-extensions'
];

/**
 * Intelligently Launch Chromium across Local OS, Render Containers, Docker, and Serverless
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

  // 2. Try @sparticuz/chromium for Linux containers (Render, Lambda, Railway, etc.)
  if (process.platform === 'linux') {
    try {
      console.log('🚀 [PDF Generator] Attempting @sparticuz/chromium for Linux environment...');
      const sparticuzPath = await chromium.executablePath();
      if (sparticuzPath) {
        return await puppeteerCore.launch({
          executablePath: sparticuzPath,
          headless: chromium.headless || true,
          args: [...(chromium.args || []), ...BROWSER_ARGS]
        });
      }
    } catch (sparticuzErr) {
      console.warn('⚠️ @sparticuz/chromium launch failed:', sparticuzErr.message);
    }
  }

  // 3. Try standard system binary paths on Windows, Mac, Linux
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
    '/opt/render/.cache/puppeteer/chrome/linux-133.0.6943.141/chrome-linux64/chrome',
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

  // 4. Try bundled Puppeteer executablePath
  try {
    const bundledPath = puppeteer.executablePath();
    if (bundledPath && fs.existsSync(bundledPath)) {
      console.log(`🚀 [PDF Generator] Launching Puppeteer bundled browser: ${bundledPath}`);
      return await puppeteer.launch({
        executablePath: bundledPath,
        headless: true,
        args: BROWSER_ARGS
      });
    }
  } catch (bundledErr) {
    console.warn('⚠️ Bundled puppeteer.executablePath() not found:', bundledErr.message);
  }

  // 5. Last-resort default launch
  try {
    console.log('🚀 [PDF Generator] Attempting default puppeteer.launch()...');
    return await puppeteer.launch({
      headless: true,
      args: BROWSER_ARGS
    });
  } catch (defaultErr) {
    console.warn('⚠️ Default puppeteer.launch() failed:', defaultErr.message);
  }

  return null;
};

/**
 * Optimize Cloudinary avatar URLs for fast, high-res circular embedding
 */
const optimizeAvatarUrl = (url, size = 120) => {
  if (!url || typeof url !== 'string') return '';

  if (
    url.includes('res.cloudinary.com') &&
    url.includes('/upload/')
  ) {
    return url.replace(
      '/upload/',
      `/upload/w_${size},h_${size},c_fill,g_face,q_auto,f_auto/`
    );
  }

  return url;
};

/**
 * Build HTML Template for Professional Multi-Page PDF
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

  const totalPerfectDays = memberReports.reduce(
    (s, m) => s + (m.overallStats?.perfectDays || 0),
    0
  );

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

  <link
    rel="preconnect"
    href="https://fonts.googleapis.com"
  >

  <link
    rel="preconnect"
    href="https://fonts.gstatic.com"
    crossorigin
  >

  <link
    href="https://fonts.googleapis.com/css2?family=Noto+Sans+Gujarati:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap"
    rel="stylesheet"
  >

  <style>

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
 * Generates a full multi-page formatted document (Page 1 = Summary/Leaderboard, Pages 2..N = Member Details)
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

      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        bufferPages: true,
        info: {
          Title: `${group.name || 'Sankalp Group'} Monthly Report - ${monthStr}`,
          Author: 'Sankalp Habit Tracker'
        }
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // PAGE 1: COVER & LEADERBOARD
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');

      // Top Bar
      doc.fillColor('#0f766e').fontSize(11).text('|| Jay Swaminarayan ||', 36, 30);
      doc.fillColor('#64748b').fontSize(10).text(`${group.name || 'Sankalp Group'} • Monthly Report`, 200, 30, { align: 'right', width: 350 });
      doc.moveTo(36, 46).lineTo(559, 46).strokeColor('#0f766e').lineWidth(1.5).stroke();

      // Title Banner
      doc.moveDown(1);
      doc.fillColor('#134e4a').fontSize(20).text(group.name || 'Sankalp Group', { align: 'center' });
      doc.fillColor('#0f766e').fontSize(12).text(`Monthly Performance Report — ${monthName} ${yearStr}`, { align: 'center' });
      doc.moveDown(1);

      // Summary Cards
      const cardY = 120;
      doc.roundedRect(36, cardY, 160, 50, 6).fillAndStroke('#f0fdf4', '#a7f3d0');
      doc.fillColor('#166534').fontSize(9).text('TOTAL MEMBERS', 46, cardY + 10);
      doc.fillColor('#14532d').fontSize(16).text(`${totalMembers}`, 46, cardY + 24);

      doc.roundedRect(210, cardY, 160, 50, 6).fillAndStroke('#f0fdfa', '#99f6e4');
      doc.fillColor('#0f766e').fontSize(9).text('AVERAGE SUCCESS RATE', 220, cardY + 10);
      doc.fillColor('#134e4a').fontSize(16).text(`${avgCompletion}%`, 220, cardY + 24);

      doc.roundedRect(385, cardY, 174, 50, 6).fillAndStroke('#fefce8', '#fde047');
      doc.fillColor('#854d0e').fontSize(9).text('MONTH / YEAR', 395, cardY + 10);
      doc.fillColor('#713f12').fontSize(16).text(`${monthStr}`, 395, cardY + 24);

      // Leaderboard Table Header
      const tableTop = 190;
      doc.fillColor('#0f172a').fontSize(14).text('Monthly Leaderboard Rankings', 36, tableTop);
      doc.fillColor('#64748b').fontSize(9).text('Members ranked by Discipline Score and completion rate', 36, tableTop + 16);

      const headerY = tableTop + 35;
      doc.rect(36, headerY, 523, 24).fill('#0f766e');
      doc.fillColor('#ffffff').fontSize(10);
      doc.text('Rank', 46, headerY + 7);
      doc.text('Member Name', 110, headerY + 7);
      doc.text('Score (Days)', 360, headerY + 7, { align: 'center', width: 90 });
      doc.text('Success %', 470, headerY + 7, { align: 'center', width: 80 });

      let currentY = headerY + 24;
      memberReports.forEach((m, idx) => {
        const rowBg = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
        doc.rect(36, currentY, 523, 24).fill(rowBg);

        const rankBadge = idx === 0 ? '1 (Gold)' : idx === 1 ? '2 (Silver)' : idx === 2 ? '3 (Bronze)' : `${idx + 1}`;
        doc.fillColor('#1e293b').fontSize(9);
        doc.text(rankBadge, 46, currentY + 7);
        doc.text(m.userProfile?.name || 'Unknown', 110, currentY + 7);
        doc.text(`${m.overallStats?.disciplineScore || 0}d`, 360, currentY + 7, { align: 'center', width: 90 });
        doc.text(`${m.overallStats?.overallCompletionRate || 0}%`, 470, currentY + 7, { align: 'center', width: 80 });

        doc.moveTo(36, currentY + 24).lineTo(559, currentY + 24).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        currentY += 24;
      });

      // Bottom Footer for Cover
      doc.moveTo(36, 780).lineTo(559, 780).strokeColor('#0f766e').lineWidth(1).stroke();
      doc.fillColor('#64748b').fontSize(9).text('Jay Swaminarayan • Sankalp Habit Tracker', 36, 790);
      doc.text('Page 1', 500, 790, { align: 'right' });

      // PAGES 2..N: INDIVIDUAL MEMBER REPORTS
      memberReports.forEach((report, idx) => {
        doc.addPage();
        const memberName = report.userProfile?.name || 'Member';
        const memberUsername = report.userProfile?.username ? `@${report.userProfile.username}` : '';
        const activeDays = report.activeDaysInMonth || 30;
        const disciplineScore = report.overallStats?.disciplineScore || 0;
        const completionRate = report.overallStats?.overallCompletionRate || 0;
        const pageNum = idx + 2;

        // Top Header
        doc.fillColor('#0f766e').fontSize(11).text('|| Jay Swaminarayan ||', 36, 30);
        doc.fillColor('#64748b').fontSize(10).text(`${group.name || 'Sankalp Group'} • Page ${pageNum} of ${totalMembers + 1}`, 200, 30, { align: 'right', width: 350 });
        doc.moveTo(36, 46).lineTo(559, 46).strokeColor('#0f766e').lineWidth(1.5).stroke();

        // Member Header Card
        const mCardY = 60;
        doc.roundedRect(36, mCardY, 523, 75, 8).fillAndStroke('#f8fafc', '#cbd5e1');

        doc.fillColor('#0f172a').fontSize(16).text(memberName, 50, mCardY + 12);
        if (memberUsername) {
          doc.fillColor('#64748b').fontSize(10).text(memberUsername, 50, mCardY + 34);
        }
        doc.fillColor('#0f766e').fontSize(10).text(`Rank #${idx + 1}  •  Active Days: ${activeDays}d  •  Month: ${monthName} ${yearStr}`, 50, mCardY + 50);

        // Member KPI Pills
        doc.roundedRect(360, mCardY + 10, 85, 55, 6).fillAndStroke('#f0fdf4', '#86efac');
        doc.fillColor('#166534').fontSize(8).text('DISCIPLINE', 365, mCardY + 18, { align: 'center', width: 75 });
        doc.fillColor('#14532d').fontSize(14).text(`${disciplineScore}/${activeDays}`, 365, mCardY + 32, { align: 'center', width: 75 });

        doc.roundedRect(455, mCardY + 10, 85, 55, 6).fillAndStroke('#f0fdfa', '#5eead4');
        doc.fillColor('#115e59').fontSize(8).text('SUCCESS RATE', 460, mCardY + 18, { align: 'center', width: 75 });
        doc.fillColor('#134e4a').fontSize(14).text(`${completionRate}%`, 460, mCardY + 32, { align: 'center', width: 75 });

        // Habit Table
        const hTableY = 155;
        doc.fillColor('#0f172a').fontSize(13).text('Monthly Habit Compliance Breakdown', 36, hTableY);

        const hHeaderY = hTableY + 22;
        doc.rect(36, hHeaderY, 523, 22).fill('#0f766e');
        doc.fillColor('#ffffff').fontSize(9.5);
        doc.text('Habit / Rule Name', 46, hHeaderY + 6);
        doc.text('Progress / Active Days', 250, hHeaderY + 6);
        doc.text('Daily Average', 390, hHeaderY + 6);
        doc.text('Success %', 485, hHeaderY + 6);

        let hRowY = hHeaderY + 22;
        (report.habitSummaries || []).forEach((h, hIdx) => {
          const rowBg = hIdx % 2 === 1 ? '#f8fafc' : '#ffffff';
          doc.rect(36, hRowY, 523, 26).fill(rowBg);

          let progressStr = `${h.completedDaysCount} / ${activeDays} days`;
          let avgStr = '-';

          if (h.type === 'count') {
            progressStr = `${h.typeDetails?.totalCount || 0} ${h.targetUnit || ''} (${h.completedDaysCount}d)`;
            avgStr = `${h.typeDetails?.dailyAverage || 0} ${h.targetUnit || ''}/day`;
          } else if (h.type === 'time_target') {
            const hrs = h.typeDetails?.totalHours || 0;
            const mins = h.typeDetails?.totalMinutes || 0;
            progressStr = hrs >= 1 ? `${hrs} hrs (${h.completedDaysCount}d)` : `${mins} mins (${h.completedDaysCount}d)`;
            avgStr = `${h.typeDetails?.dailyAverageMinutes || 0} mins/day`;
          } else if (h.type === 'time_of_day') {
            avgStr = `Avg: ${h.typeDetails?.averageTime || 'N/A'}`;
          }

          doc.fillColor('#0f172a').fontSize(9).text(h.title, 46, hRowY + 7, { width: 195, lineBreak: false });
          doc.fillColor('#334155').fontSize(9).text(progressStr, 250, hRowY + 7);
          doc.fillColor('#475569').fontSize(9).text(avgStr, 390, hRowY + 7);
          doc.fillColor(h.completionPercentage >= 80 ? '#166534' : h.completionPercentage >= 50 ? '#854d0e' : '#991b1b')
            .fontSize(9.5)
            .text(`${h.completionPercentage || 0}%`, 485, hRowY + 7);

          doc.moveTo(36, hRowY + 26).lineTo(559, hRowY + 26).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
          hRowY += 26;
        });

        // Footer
        doc.moveTo(36, 780).lineTo(559, 780).strokeColor('#0f766e').lineWidth(1).stroke();
        doc.fillColor('#64748b').fontSize(9).text('Jay Swaminarayan • Sankalp Habit Tracker', 36, 790);
        doc.text(`Page ${pageNum} of ${totalMembers + 1}`, 450, 790, { align: 'right', width: 100 });
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Generate PDF using Chromium (Puppeteer)
 * with robust multi-tier launch and PDFKit fallback
 */
export const generateGroupMonthlyReportPDF = async (
  group,
  monthStr,
  memberReports
) => {
  let browser = null;

  try {
    browser = await launchBrowser();
  } catch (launchErr) {
    console.warn('⚠️ [PDF Generator] Browser launch error:', launchErr.message);
  }

  if (browser) {
    try {
      console.log('🚀 [PDF Generator] Rendering rich HTML report in Chromium...');
      const page = await browser.newPage();

      const htmlContent = buildReportHTML(
        group,
        monthStr,
        memberReports
      );

      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Small pause to allow webfonts & styles to settle
      await new Promise((r) => setTimeout(r, 600));

      // Wait for all images to settle
      await page.evaluate(async () => {
        const images = Array.from(document.images);
        await Promise.all(
          images.map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            });
          })
        );
      });

      // Wait for fonts
      await page.evaluate(async () => {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
      });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0px',
          right: '0px',
          bottom: '0px',
          left: '0px'
        },
        preferCSSPageSize: true
      });

      await browser.close();

      console.log(
        `✅ [PDF Generator] Created professional Chromium PDF (${pdfBuffer.length} bytes / ${(pdfBuffer.length / 1024).toFixed(2)} KB).`
      );

      return Buffer.from(pdfBuffer);
    } catch (browserErr) {
      console.error(
        '❌ Chromium PDF generation error, falling back to PDFKit:',
        browserErr.message
      );
      if (browser) {
        try {
          await browser.close();
        } catch (_) {}
      }
    }
  }

  // Fallback to comprehensive multi-page PDFKit generator
  console.log('📄 [PDF Generator] Falling back to comprehensive PDFKit multi-page report generator...');
  const fallbackBuffer = await generatePDFKitReport(group, monthStr, memberReports);
  console.log(`✅ [PDF Generator] Created comprehensive PDFKit fallback PDF (${fallbackBuffer.length} bytes / ${(fallbackBuffer.length / 1024).toFixed(2)} KB).`);
  return fallbackBuffer;
};
