import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Sparkles, Trophy, Users, Clock, Eye } from 'lucide-react';
import { Avatar } from '../common/Avatar';

export const GroupMatrixBoard = ({
  habits = [],
  members = [],
  todayLogs = [],
  currentUserId,
  onSelectMember,
  selectedDate
}) => {
  if (habits.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 text-center border border-emerald-100 shadow-xs">
        <Sparkles className="w-8 h-8 text-[#10b981] mx-auto mb-2" />
        <h4 className="text-sm font-bold text-[#022c22]">No Group Tasks Added Yet</h4>
        <p className="text-xs text-gray-500 mt-0.5 max-w-sm mx-auto">
          Add a shared task (e.g. "Savarni Katha", "Dandvat") to view the live Green/Red member progress board!
        </p>
      </div>
    );
  }

  const formatMemberResponseValue = (habit, log) => {
    if (!log) return null;
    const isDone = !!log.isCompleted;
    const val = log.value || 0;

    if (habit.type === 'count') {
      return `${val} ${habit.targetUnit || 'reps'}`;
    }
    if (habit.type === 'time_target') {
      const hrs = Math.floor(val / 60);
      const mins = val % 60;
      if (hrs > 0 && mins > 0) return `${hrs}:${mins.toString().padStart(2, '0')}h`;
      if (hrs > 0) return `${hrs}:00h`;
      return `${val}m`;
    }
    if (habit.type === 'timer') {
      const mins = Math.floor(val / 60);
      return `${mins}m`;
    }
    if (habit.type === 'yes_no') {
      return isDone ? 'Yes' : 'No';
    }
    return isDone ? 'Yes' : 'No';
  };

  return (
    <div className="space-y-3">
      {/* Tap Hint Banner */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-emerald-100/50 rounded-xl border border-emerald-200/60 text-[11px] text-emerald-900 font-semibold">
        <span className="flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-[#047857]" />
          <span>Tap any member's avatar to view their detailed daily response report</span>
        </span>
        <span className="text-[10px] bg-[#047857] text-white px-2 py-0.5 rounded-full font-bold">
          Live Synced ⚡
        </span>
      </div>

      {habits.map((habit) => {
        const habitId = (habit.id || habit._id).toString();

        // Calculate completions for this habit
        const memberStatuses = members.map((member) => {
          const log = todayLogs.find(
            (l) => l.habitId?.toString() === habitId && l.userId?.toString() === (member.userId || member.userId?.toString())
          );
          const isCompleted = !!log?.isCompleted;
          return {
            ...member,
            isCompleted,
            logValue: log?.value || 0,
            log
          };
        });

        const completedCount = memberStatuses.filter((m) => m.isCompleted).length;
        const totalMembers = members.length || 1;
        const completionPercentage = Math.round((completedCount / totalMembers) * 100);

        return (
          <div
            key={habitId}
            className="bg-white rounded-2xl p-4 shadow-xs border border-emerald-100/90 space-y-3 transition-all hover:border-emerald-300"
          >
            {/* Task Row Header */}
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div
                  style={{ backgroundColor: `${habit.color || '#10b981'}15`, color: habit.color || '#10b981' }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-100 shadow-2xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-[#022c22]">
                    {habit.title}
                  </h4>
                  <p className="text-[10px] text-gray-500 font-semibold capitalize">
                    {habit.frequency} • {habit.type.replace('_', ' ')}
                    {habit.targetValue ? ` (Target: ${habit.targetValue} ${habit.targetUnit || ''})` : ''}
                  </p>
                </div>
              </div>

              {/* Completion Ratio Pill */}
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
                    completedCount === totalMembers
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  {completedCount}/{totalMembers} Done ({completionPercentage}%)
                </span>
              </div>
            </div>

            {/* Member Avatars Row with Names (Green = Done, Red = Remaining) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Live Accountability Matrix
                </p>
                <span className="text-[10px] font-bold text-emerald-700">
                  {completedCount} Completed
                </span>
              </div>

              <div className="flex items-center gap-4 sm:gap-5 overflow-x-auto pb-2 pt-1 px-1 scrollbar-none">
                {memberStatuses.map((m) => {
                  const isSelf = m.userId === currentUserId;
                  const responseValueText = formatMemberResponseValue(habit, m.log);

                  return (
                    <motion.button
                      type="button"
                      key={m.userId}
                      onClick={() => onSelectMember && onSelectMember(m)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex flex-col items-center justify-center shrink-0 min-w-[64px] text-center group cursor-pointer p-1 rounded-xl hover:bg-emerald-50/50 transition-colors"
                      title={`Click to view ${m.name}'s daily response report`}
                    >
                      {/* Avatar with Live Green / Red Status Ring */}
                      <div className="relative">
                        <Avatar
                          src={m.avatar}
                          name={m.name}
                          size="md"
                          status={m.isCompleted ? 'completed' : 'pending'}
                          className="transition-transform shadow-2xs"
                        />
                      </div>

                      {/* Name below avatar */}
                      <span className="text-[11px] font-extrabold text-[#022c22] mt-1.5 truncate max-w-[70px] leading-tight">
                        {m.name.split(' ')[0]}
                      </span>

                      {/* Status Tag or Specific Value */}
                      <span
                        className={`text-[9px] font-black tracking-tight mt-0.5 px-1.5 py-0.2 rounded truncate max-w-[72px] ${
                          m.isCompleted
                            ? 'text-emerald-800 bg-emerald-100'
                            : 'text-rose-700 bg-rose-50'
                        }`}
                      >
                        {m.isCompleted
                          ? responseValueText || 'Completed'
                          : 'Pending'}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
