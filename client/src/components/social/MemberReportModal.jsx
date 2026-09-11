import React from 'react';
import { motion } from 'framer-motion';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
  Timer,
  Hash,
  Crown,
  Trophy,
  Flame,
  Check,
  Sparkles
} from 'lucide-react';
import { Avatar } from '../common/Avatar';

export const MemberReportModal = ({ member, habits = [], todayLogs = [], selectedDate, isOpen, onClose }) => {
  if (!isOpen || !member) return null;

  const formattedDate = new Date(selectedDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const memberLogs = habits.map((habit) => {
    const habitId = (habit.id || habit._id).toString();
    const log = todayLogs.find(
      (l) => l.habitId?.toString() === habitId && l.userId?.toString() === member.userId?.toString()
    );
    return {
      habit,
      isCompleted: !!log?.isCompleted,
      value: log?.value || 0,
      notes: log?.notes || '',
      loggedAt: log?.loggedAt
    };
  });

  const completedCount = memberLogs.filter((m) => m.isCompleted).length;
  const totalTasks = habits.length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const formatTime = (mins) => {
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (hrs > 0) {
      return `${hrs}:${remainingMins.toString().padStart(2, '0')} hrs`;
    }
    return `${mins} mins`;
  };

  const formatStopwatch = (totalSecs) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-emerald-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-emerald-100 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header Banner */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#065f46] via-[#047857] to-[#065f46] text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <Avatar
              src={member.avatar}
              name={member.name}
              size="md"
              status={completedCount === totalTasks && totalTasks > 0 ? 'completed' : 'pending'}
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-base text-white">{member.name}</h3>
                {member.role === 'admin' && (
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-400 text-amber-950 flex items-center gap-0.5">
                    <Crown className="w-2.5 h-2.5 fill-current" />
                    Admin
                  </span>
                )}
              </div>
              <p className="text-[11px] text-emerald-200 font-medium">@{member.username}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-emerald-700/80 text-emerald-200 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date & Overall Progress Summary */}
        <div className="p-4 bg-emerald-50/70 border-b border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
            <Calendar className="w-3.5 h-3.5 text-[#047857]" />
            <span>{formattedDate}</span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${
                completedCount === totalTasks && totalTasks > 0
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {completedCount}/{totalTasks} Completed ({completionPercentage}%)
            </span>
          </div>
        </div>

        {/* Detailed Response List for Each Task */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Detailed Daily Task Responses
          </p>

          {memberLogs.length === 0 ? (
            <p className="text-xs text-gray-500 py-6 text-center">No tasks assigned in this group.</p>
          ) : (
            memberLogs.map(({ habit, isCompleted, value, notes }) => (
              <div
                key={habit.id || habit._id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  isCompleted
                    ? 'bg-emerald-50/60 border-emerald-200 shadow-2xs'
                    : 'bg-gray-50/70 border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-3 h-3 rounded-full shrink-0 ${
                        isCompleted ? 'bg-[#10b981] ring-2 ring-emerald-300' : 'bg-rose-400'
                      }`}
                    />
                    <div>
                      <h4 className="text-sm font-extrabold text-[#022c22]">{habit.title}</h4>
                      <p className="text-[10px] text-gray-500 font-semibold capitalize">
                        Type: {habit.type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {isCompleted ? 'Completed' : 'Pending'}
                  </span>
                </div>

                {/* Specific Response Values (e.g. Dandvat 50, Time 2:00, Yes/No) */}
                <div className="mt-2.5 pt-2 border-t border-gray-100/80 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-gray-500 font-semibold">Response Value:</span>

                  {habit.type === 'boolean' && (
                    <span className="font-extrabold text-[#022c22] flex items-center gap-1">
                      {isCompleted ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#10b981] stroke-[3]" />
                          Yes, Completed
                        </>
                      ) : (
                        'Not Done Yet'
                      )}
                    </span>
                  )}

                  {habit.type === 'count' && (
                    <span className="font-extrabold text-[#022c22]">
                      <span className="text-emerald-800 font-black">{value || 0}</span> /{' '}
                      {habit.targetValue} {habit.targetUnit || 'reps'}
                    </span>
                  )}

                  {habit.type === 'time_target' && (
                    <span className="font-extrabold text-[#022c22]">
                      <span className="text-emerald-800 font-black">{formatTime(value || 0)}</span> /{' '}
                      {formatTime(habit.targetValue || 60)}
                    </span>
                  )}

                  {habit.type === 'timer' && (
                    <span className="font-mono font-black text-emerald-950 bg-emerald-100 px-2 py-0.5 rounded">
                      ⏱️ {formatStopwatch(value || 0)}
                    </span>
                  )}

                  {habit.type === 'yes_no' && (
                    <span className="font-extrabold text-[#022c22]">
                      {isCompleted ? '✅ Yes, Done' : '❌ No, Not yet'}
                    </span>
                  )}

                  {habit.type === 'time_of_day' && (
                    <span className="font-extrabold text-[#022c22]">
                      {isCompleted
                        ? `⏰ Checked in: ${value || habit.targetValue || 'Done'}`
                        : `Pending (Target: ${habit.targetValue || '05:00 AM'})`}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#047857] hover:bg-[#065f46] text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Close Report
          </button>
        </div>
      </motion.div>
    </div>
  );
};
