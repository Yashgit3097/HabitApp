import fs from 'fs';
import path from 'path';
import { generateGroupMonthlyReportPDF } from '../services/pdfReportService.js';

const mockGroup = {
  id: 'test-group-1',
  name: 'શ્રી સ્વામિનારાયણ સત્સંગ ગ્રુપ',
  avatar: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=160&auto=format&fit=crop&q=80'
};

const mockMemberReports = [
  {
    userId: 'u1',
    userProfile: {
      name: 'હાર્દિક પટેલ',
      username: 'hardik_p',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&auto=format&fit=crop&q=80'
    },
    activeDaysInMonth: 30,
    overallStats: {
      totalHabits: 4,
      perfectDays: 28,
      disciplineScore: 28,
      overallCompletionRate: 95
    },
    habitSummaries: [
      {
        title: 'નિત્ય પૂજા',
        type: 'boolean',
        completedDaysCount: 30,
        completionPercentage: 100,
        typeDetails: { completedDays: 30, totalDays: 30, percentage: 100 }
      },
      {
        title: 'માળા (જપ)',
        type: 'count',
        targetUnit: 'માળા',
        completedDaysCount: 29,
        completionPercentage: 97,
        typeDetails: { totalCount: 145, dailyAverage: 4.8 }
      },
      {
        title: 'વચનામૃત વાચન',
        type: 'time_target',
        completedDaysCount: 28,
        completionPercentage: 93,
        typeDetails: { totalHours: 14.5, totalMinutes: 870, dailyAverageMinutes: 29 }
      },
      {
        title: 'સભા હાજરી',
        type: 'yes_no',
        completedDaysCount: 4,
        completionPercentage: 100,
        typeDetails: { yesDays: 4, noDays: 0, totalDays: 4, yesPercentage: 100 }
      }
    ]
  },
  {
    userId: 'u2',
    userProfile: {
      name: 'યશ ગોંડલિયા',
      username: 'yash_g',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=160&auto=format&fit=crop&q=80'
    },
    activeDaysInMonth: 30,
    overallStats: {
      totalHabits: 4,
      perfectDays: 26,
      disciplineScore: 26,
      overallCompletionRate: 90
    },
    habitSummaries: [
      {
        title: 'નિત્ય પૂજા',
        type: 'boolean',
        completedDaysCount: 28,
        completionPercentage: 93,
        typeDetails: { completedDays: 28, totalDays: 30, percentage: 93 }
      },
      {
        title: 'માળા (જપ)',
        type: 'count',
        targetUnit: 'માળા',
        completedDaysCount: 27,
        completionPercentage: 90,
        typeDetails: { totalCount: 135, dailyAverage: 4.5 }
      }
    ]
  }
];

async function run() {
  console.log('Testing PDF Generation...');
  try {
    const startTime = Date.now();
    const pdfBuffer = await generateGroupMonthlyReportPDF(mockGroup, '2026-09', mockMemberReports);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n========================================`);
    console.log(`🎉 PDF Generation Result:`);
    console.log(`- Buffer size: ${pdfBuffer.length} bytes (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);
    console.log(`- Time taken: ${duration} seconds`);
    console.log(`========================================\n`);

    const outputPath = path.resolve('scripts', 'test_output_report.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);
    console.log(`💾 Saved test PDF file to: ${outputPath}`);

    if (pdfBuffer.length < 5000) {
      console.error('❌ WARNING: PDF buffer is suspiciously small (< 5KB)!');
    } else {
      console.log('✅ SUCCESS: PDF generated properly with rich layout and data!');
    }
  } catch (err) {
    console.error('❌ Error generating PDF:', err);
  }
}

run();
