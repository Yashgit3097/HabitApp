import React from 'react';
import { Trophy, TrendingUp, CheckCircle, Flame, Users, Award } from 'lucide-react';
import { Avatar } from '../common/Avatar';

export const GroupAnalyticsCard = ({ habits = [], members = [], todayLogs = [] }) => {
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#047857]" />
          <h3 className="font-extrabold text-sm sm:text-base text-[#022c22]">
            Group Performance & Compliance
          </h3>
        </div>
        <span className="text-xs font-black text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full">
          {groupCompletionRate}% Overall
        </span>
      </div>

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
