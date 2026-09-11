import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Users,
  Clock,
  Check,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { Avatar } from '../common/Avatar';

export const GroupMatrixBoard = ({
  habits = [],
  members = [],
  todayLogs = [],
  currentUserId,
  onSelectMember,
  selectedDate
}) => {
  const [expandedTask, setExpandedTask] = useState(null);

  if (habits.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center border border-emerald-100 shadow-xs">
        <Sparkles className="w-10 h-10 text-[#10b981] mx-auto mb-2.5" />
        <h4 className="text-base font-black text-[#022c22]">No Group Tasks Added Yet</h4>
        <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
          Add a shared task (e.g. "Savarni Katha", "Dandvat", "5:00 AM Wakeup") to start tracking group accountability!
        </p>
      </div>
    );
  }

  // Calculate each member's overall completed task count for today
  const membersWithStats = members.map((member) => {
    const memberId = (member.userId || member.id || member._id)?.toString();
    const completedTasksCount = habits.filter((h) => {
      const hId = (h.id || h._id).toString();
      const log = todayLogs.find(
        (l) => l.habitId?.toString() === hId && (l.userId?.toString() === memberId)
      );
      return !!log?.isCompleted || (typeof log?.value === 'number' && log.value > 0) || (typeof log?.value === 'string' && log.value.trim().length > 0);
    }).length;

    const total = habits.length;
    const isAllDone = total > 0 && completedTasksCount === total;
    const isPartial = completedTasksCount > 0 && completedTasksCount < total;
    const pendingCount = total - completedTasksCount;

    return {
      ...member,
      userId: memberId,
      completedTasksCount,
      totalTasks: total,
      isAllDone,
      isPartial,
      pendingCount
    };
  });

  const totalMembers = members.length || 1;

  return (
    <div className="space-y-4">
      {/* 1. MEMBERS ACCOUNTABILITY GRID (4 Per Row - Tap to inspect pending tasks) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-xs border border-emerald-100/90 space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
          <div>
            <h3 className="text-sm sm:text-base font-black text-[#022c22] flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#047857]" />
              <span>Group Members Status ({members.length})</span>
            </h3>
            <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
              Tap any member to see which tasks are done or currently pending.
            </p>
          </div>

          <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
            {membersWithStats.filter((m) => m.isAllDone).length}/{members.length} All Done
          </span>
        </div>

        {/* 4-per-row Avatar Grid */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3 pt-1">
          {membersWithStats.map((m) => {
            return (
              <motion.button
                type="button"
                key={m.userId}
                onClick={() => onSelectMember && onSelectMember(m)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center justify-center text-center group cursor-pointer p-2 rounded-2xl bg-gray-50/70 hover:bg-emerald-50 border border-gray-100 hover:border-emerald-200 transition-all shadow-2xs"
                title={`Click to view ${m.name}'s task status`}
              >
                {/* Avatar with Live Status Ring */}
                <div className="relative">
                  <Avatar
                    src={m.avatar}
                    name={m.name}
                    size="md"
                    status={m.isAllDone ? 'completed' : 'pending'}
                    className="transition-transform shadow-2xs"
                  />
                </div>

                {/* Name */}
                <span className="text-[11px] font-black text-[#022c22] mt-1.5 truncate w-full text-center leading-tight">
                  {m.name.split(' ')[0]}
                </span>

                {/* Status Badge */}
                <span
                  className={`text-[9px] font-black tracking-tight mt-1 px-1.5 py-0.2 rounded w-full truncate ${
                    m.isAllDone
                      ? 'text-emerald-800 bg-emerald-100 border border-emerald-200'
                      : m.isPartial
                      ? 'text-amber-800 bg-amber-50 border border-amber-200'
                      : 'text-rose-700 bg-rose-50 border border-rose-200'
                  }`}
                >
                  {m.isAllDone
                    ? '🎉 All Done'
                    : m.isPartial
                    ? `${m.completedTasksCount}/${m.totalTasks} Done`
                    : `⏳ ${m.totalTasks} Pending`}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* 2. GROUP TASKS LIST WITH PROGRESS & PER-TASK BREAKDOWN */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-500">
            Group Tasks Overview ({habits.length})
          </h3>
        </div>

        {habits.map((habit) => {
          const habitId = (habit.id || habit._id).toString();

          // Calculate members who completed vs pending for this habit
          const completedMembers = [];
          const pendingMembers = [];

          members.forEach((member) => {
            const memberId = (member.userId || member.id || member._id)?.toString();
            const log = todayLogs.find(
              (l) => l.habitId?.toString() === habitId && (l.userId?.toString() === memberId)
            );
            const isCompleted = !!log?.isCompleted || (typeof log?.value === 'number' && log.value > 0) || (typeof log?.value === 'string' && log.value.trim().length > 0);

            if (isCompleted) {
              completedMembers.push({ ...member, log });
            } else {
              pendingMembers.push({ ...member, log });
            }
          });

          const completedCount = completedMembers.length;
          const completionPercentage = Math.round((completedCount / totalMembers) * 100);
          const isExpanded = expandedTask === habitId;

          return (
            <div
              key={habitId}
              className="bg-white rounded-2xl p-4 shadow-xs border border-emerald-100/90 space-y-3 transition-all hover:border-emerald-300"
            >
              {/* Task Header */}
              <div className="flex items-center justify-between gap-3">
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

                <span
                  className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border shrink-0 ${
                    completedCount === totalMembers
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  {completedCount}/{totalMembers} Done ({completionPercentage}%)
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-emerald-100/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#10b981] rounded-full transition-all duration-300"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>

              {/* Task Footer / Quick Member Breakdown */}
              <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-xs">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-emerald-700 font-bold">
                    ✅ {completedCount} Done
                  </span>
                  <span>•</span>
                  <span className={pendingMembers.length > 0 ? 'text-rose-600 font-bold' : 'text-gray-400'}>
                    ⏳ {pendingMembers.length} Pending
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setExpandedTask(isExpanded ? null : habitId)}
                  className="inline-flex items-center gap-1 text-[11px] font-black text-[#047857] hover:underline cursor-pointer"
                >
                  <span>{isExpanded ? 'Hide Details' : 'Who is Pending?'}</span>
                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {/* Expanded Pending vs Completed Members breakdown */}
              {isExpanded && (
                <div className="pt-2 border-t border-gray-100 space-y-2.5 animate-in fade-in duration-150">
                  {/* Pending Members */}
                  {pendingMembers.length > 0 ? (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-rose-600 mb-1.5">
                        ⏳ Pending Members ({pendingMembers.length})
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {pendingMembers.map((m) => (
                          <button
                            key={m.userId}
                            type="button"
                            onClick={() => onSelectMember && onSelectMember(m)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[11px] font-bold text-rose-800 transition-colors cursor-pointer"
                          >
                            <Avatar src={m.avatar} name={m.name} size="xs" />
                            <span>{m.name.split(' ')[0]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold text-center">
                      🎉 All members have completed this task today!
                    </div>
                  )}

                  {/* Completed Members */}
                  {completedMembers.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 mb-1.5">
                        ✅ Completed Members ({completedMembers.length})
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {completedMembers.map((m) => (
                          <button
                            key={m.userId}
                            type="button"
                            onClick={() => onSelectMember && onSelectMember(m)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[11px] font-bold text-emerald-800 transition-colors cursor-pointer"
                          >
                            <Avatar src={m.avatar} name={m.name} size="xs" status="completed" />
                            <span>{m.name.split(' ')[0]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
