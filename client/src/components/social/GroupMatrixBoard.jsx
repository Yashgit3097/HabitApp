import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Avatar } from '../common/Avatar';

export const GroupMatrixBoard = ({
  habits = [],
  members = [],
  todayLogs = [],
  currentUserId,
  onSelectMember,
  selectedDate
}) => {
  // Track expanded tasks (default shows first 12 members, expanded shows all)
  const [expandedTasks, setExpandedTasks] = useState({});

  const toggleExpand = (habitId) => {
    setExpandedTasks((prev) => ({
      ...prev,
      [habitId]: !prev[habitId]
    }));
  };

  if (habits.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center border border-emerald-100 shadow-xs">
        <Sparkles className="w-10 h-10 text-[#10b981] mx-auto mb-2.5" />
        <h4 className="text-base font-black text-[#022c22]">No Group Tasks Added Yet</h4>
        <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
          Add a shared task (e.g. "Savarni Katha", "Dandvat", "5:00 AM Wakeup") to view the live Green/Red member progress board!
        </p>
      </div>
    );
  }

  const formatMemberResponseValue = (habit, log) => {
    if (!log) return null;
    const isDone = !!log.isCompleted;
    const val = log.value;

    if (habit.type === 'count') {
      return `${val || 0} ${habit.targetUnit || 'reps'}`;
    }
    if (habit.type === 'time_target') {
      const numVal = Number(val) || 0;
      const hrs = Math.floor(numVal / 60);
      const mins = numVal % 60;
      if (hrs > 0 && mins > 0) return `${hrs}:${mins.toString().padStart(2, '0')}h`;
      if (hrs > 0) return `${hrs}:00h`;
      return `${numVal}m`;
    }
    if (habit.type === 'timer') {
      const numVal = Number(val) || 0;
      const mins = Math.floor(numVal / 60);
      return `${mins}m`;
    }
    if (habit.type === 'time_of_day') {
      return isDone
        ? typeof val === 'string' && val ? val : habit.targetValue || 'Done'
        : 'Pending';
    }
    if (habit.type === 'yes_no') {
      return isDone ? 'Yes' : 'No';
    }
    return isDone ? 'Done' : 'Pending';
  };

  return (
    <div className="space-y-3.5">
      {/* Habit Cards with Avatar Accountability Board */}
      {habits.map((habit) => {
        const habitId = (habit.id || habit._id).toString();

        // Calculate member completion statuses
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

        const isExpanded = !!expandedTasks[habitId];
        const visibleMembers = isExpanded ? memberStatuses : memberStatuses.slice(0, 12);
        const hasMore = memberStatuses.length > 12;

        return (
          <div
            key={habitId}
            className="bg-white rounded-3xl p-4 sm:p-5 shadow-xs border border-emerald-100/90 space-y-3.5 transition-all hover:border-emerald-300"
          >
            {/* Task Row Header */}
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  style={{ backgroundColor: `${habit.color || '#10b981'}15`, color: habit.color || '#10b981' }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-100 shadow-2xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm sm:text-base font-black text-[#022c22] truncate">
                    {habit.title}
                  </h4>
                  <p className="text-[10px] text-gray-500 font-semibold capitalize truncate">
                    {habit.frequency} • {habit.type === 'time_of_day' ? 'Specific Time' : habit.type.replace('_', ' ')}
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

            {/* Member Avatars Accountability Board (Green = Done, Red = Remaining) */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Live Accountability Matrix
                </p>
                <span className="text-[10px] font-bold text-emerald-700">
                  {completedCount} of {totalMembers} Completed
                </span>
              </div>

              {/* Responsive Grid with 4 items per row */}
              <div className="grid grid-cols-4 sm:grid-cols-4 gap-2.5 sm:gap-3.5 pt-1">
                {visibleMembers.map((m) => {
                  const responseValueText = formatMemberResponseValue(habit, m.log);

                  return (
                    <motion.button
                      type="button"
                      key={m.userId}
                      onClick={() => onSelectMember && onSelectMember(m)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex flex-col items-center justify-center text-center group cursor-pointer p-2 rounded-2xl bg-gray-50/60 hover:bg-emerald-50/90 border border-gray-100 hover:border-emerald-200 transition-all shadow-2xs"
                      title={`Click to view ${m.name}'s daily report`}
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
                      <span className="text-[11px] font-black text-[#022c22] mt-1.5 truncate w-full text-center leading-tight">
                        {m.name.split(' ')[0]}
                      </span>

                      {/* Status Tag or Specific Value */}
                      <span
                        className={`text-[9px] font-black tracking-tight mt-1 px-1.5 py-0.2 rounded w-full truncate ${
                          m.isCompleted
                            ? 'text-emerald-800 bg-emerald-100 border border-emerald-200'
                            : 'text-rose-700 bg-rose-50 border border-rose-200'
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

              {/* See More / Show Less toggle if more than 12 members */}
              {hasMore && (
                <div className="mt-3 text-center pt-1 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => toggleExpand(habitId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#047857] text-xs font-black transition-colors cursor-pointer border border-emerald-200"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        <span>Show Less</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        <span>See More (+{memberStatuses.length - 12} members)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
