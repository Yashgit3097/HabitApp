import React, { useState } from 'react';
import { Trophy, TrendingUp, CheckCircle, Flame, Users, Award, Download, Calendar, Loader2, FileText } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import api from '../../api/client';
import { useUIStore } from '../../stores/uiStore';
import { getRecentMonthsList } from '../../utils/dateUtils';

export const GroupAnalyticsCard = ({ groupId, group, habits = [], members = [], todayLogs = [] }) => {
  const { showToast } = useUIStore();
  const recentMonths = getRecentMonthsList(12);
  const [selectedMonth, setSelectedMonth] = useState(() => recentMonths[0]?.value || '2026-09');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingTask, setIsDownloadingTask] = useState(false);

  const activeGroupId = (groupId || group?.id || group?._id)?.toString();

  const handleDownloadPDF = async () => {
    if (!activeGroupId) {
      showToast('Group ID is required to download report', 'error');
      return;
    }

    setIsDownloading(true);
    showToast(`Generating member PDF report for ${selectedMonth}...`, 'info');

    try {
      const response = await api.get(`/reports/group/${activeGroupId}/pdf?month=${selectedMonth}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const groupName = group?.name || 'Group';
      const safeGroupName = groupName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeGroupName}_Member_Report_${selectedMonth}.pdf`;

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      showToast(`Member Monthly Report for ${selectedMonth} downloaded! 📄`, 'success');
    } catch (err) {
      console.error('Download Group PDF Report Error:', err);
      let errorMsg = 'Failed to generate PDF report. Please try again.';

      if (err.response && err.response.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          if (json.message) errorMsg = json.message;
        } catch (_) {}
      } else if (err.response?.data?.message) {
        errorMsg = err.response.data.message;
      }

      showToast(errorMsg, 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadTaskPDF = async () => {
    if (!activeGroupId) {
      showToast('Group ID is required to download report', 'error');
      return;
    }

    setIsDownloadingTask(true);
    showToast(`Generating task-wise leaderboard PDF for ${selectedMonth}...`, 'info');

    try {
      const response = await api.get(`/reports/group/${activeGroupId}/task-pdf?month=${selectedMonth}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const groupName = group?.name || 'Group';
      const safeGroupName = groupName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeGroupName}_Task_Leaderboard_${selectedMonth}.pdf`;

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      showToast(`Task Leaderboard Report for ${selectedMonth} downloaded! 🏆`, 'success');
    } catch (err) {
      console.error('Download Task Leaderboard PDF Error:', err);
      let errorMsg = 'Failed to generate task leaderboard PDF. Please try again.';

      if (err.response && err.response.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          if (json.message) errorMsg = json.message;
        } catch (_) {}
      } else if (err.response?.data?.message) {
        errorMsg = err.response.data.message;
      }

      showToast(errorMsg, 'error');
    } finally {
      setIsDownloadingTask(false);
    }
  };

  const totalTasks = habits.length;
  const totalMembers = members.length;
  const totalPossibleChecks = totalTasks * totalMembers;

  const totalCompletedChecks = todayLogs.filter(
    (l) => l.isCompleted && habits.some((h) => (h.id || h._id) === l.habitId)
  ).length;

  const groupCompletionRate = totalPossibleChecks > 0
    ? Math.round((totalCompletedChecks / totalPossibleChecks) * 100)
    : 0;

  // Calculate member rankings
  const memberRankings = members.map((m) => {
    const memberDone = todayLogs.filter(
      (l) => l.userId === m.userId && l.isCompleted && habits.some((h) => (h.id || h._id) === l.habitId)
    ).length;
    const rate = totalTasks > 0 ? Math.round((memberDone / totalTasks) * 100) : 0;
    return {
      ...m,
      completedCount: memberDone,
      completionRate: rate
    };
  }).sort((a, b) => b.completedCount - a.completedCount);

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-emerald-100 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#047857]" />
          <h3 className="font-extrabold text-sm sm:text-base text-[#022c22]">
            Group Performance & Compliance
          </h3>
        </div>
        <span className="text-xs font-black text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full self-start sm:self-auto">
          {groupCompletionRate}% Today Overall
        </span>
      </div>

      {/* Monthly PDF Reports Bar (Month Selector + 2 Responsive Download Buttons) */}
      {activeGroupId && (
        <div className="p-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 rounded-xl border border-emerald-200/80 space-y-2.5 shadow-2xs">
          {/* Month Selector Row */}
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[#047857] shrink-0" />
            <span className="text-xs font-black text-emerald-950 shrink-0">Select Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2.5 py-1 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-[#022c22] focus:outline-none focus:ring-1 focus:ring-[#10b981] flex-1 max-w-[200px] cursor-pointer"
            >
              {recentMonths.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} {m.isCurrentMonth ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 2 Responsive Download Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-emerald-200/60">
            {/* Button 1: Member-wise PDF */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="w-full py-2 px-3 bg-[#047857] hover:bg-[#065f46] disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              title="Download full multi-page Member Performance PDF Book"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Downloading Member PDF...</span>
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Download Member Report PDF</span>
                </>
              )}
            </button>

            {/* Button 2: Task-wise Leaderboard PDF */}
            <button
              type="button"
              onClick={handleDownloadTaskPDF}
              disabled={isDownloadingTask}
              className="w-full py-2 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              title="Download Task-by-Task Leaderboard PDF Book (Dandvat, Mantra, Screen Time ranks)"
            >
              {isDownloadingTask ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Downloading Task PDF...</span>
                </>
              ) : (
                <>
                  <Trophy className="w-3.5 h-3.5 stroke-[2.5] fill-amber-200 text-amber-200" />
                  <span>Download Task Leaderboard PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Stats Quick Grid */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
        <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
          <p className="text-[10px] text-gray-500 font-bold uppercase">Tasks Done</p>
          <p className="text-base sm:text-lg font-black text-[#047857]">
            {totalCompletedChecks}/{totalPossibleChecks}
          </p>
        </div>
        <div className="p-2.5 bg-teal-50/60 rounded-xl border border-teal-100">
          <p className="text-[10px] text-gray-500 font-bold uppercase">Active Group</p>
          <p className="text-base sm:text-lg font-black text-teal-800">
            {totalMembers} Members
          </p>
        </div>
        <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-100">
          <p className="text-[10px] text-gray-500 font-bold uppercase">Compliance</p>
          <p className="text-base sm:text-lg font-black text-amber-700">
            {groupCompletionRate}%
          </p>
        </div>
      </div>

      {/* Member Leaderboard */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1">
          <Trophy className="w-3 h-3 text-amber-500" />
          Member Compliance Roster
        </p>

        <div className="space-y-1.5">
          {memberRankings.map((m, idx) => (
            <div
              key={m.userId}
              className="p-2 bg-gray-50/70 hover:bg-emerald-50/40 rounded-xl border border-gray-100 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 font-black text-xs text-gray-400 text-center">
                  #{idx + 1}
                </span>
                <Avatar src={m.avatar} name={m.name} size="xs" />
                <span className="text-xs font-bold text-[#022c22] truncate max-w-[120px]">
                  {m.name}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-20 sm:w-28 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#10b981] to-[#047857] rounded-full transition-all duration-300"
                    style={{ width: `${m.completionRate}%` }}
                  />
                </div>
                <span className="text-xs font-black text-emerald-900 w-9 text-right">
                  {m.completionRate}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
