import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Sparkles,
  Maximize2,
  Camera,
  Edit
} from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { UpdateAvatarModal } from '../common/UpdateAvatarModal';
import { useAuthStore } from '../../stores/authStore';
import { formatDisplayDate, isToday, isYesterday } from '../../utils/dateUtils';

export const MemberReportModal = ({
  member,
  habits = [],
  todayLogs = [],
  selectedDate,
  isOpen,
  onClose,
  groupId = null,
  isAdmin = false
}) => {
  const { user } = useAuthStore();
  const [showProfilePhotoModal, setShowProfilePhotoModal] = useState(false);
  const [showUpdateAvatarModal, setShowUpdateAvatarModal] = useState(false);

  const currentUserId = (user?.id || user?._id)?.toString();
  const isMemberAdmin = isAdmin || member?.role === 'admin' || member?.userId?.toString() === currentUserId;

  if (!isOpen || !member) return null;

  const formattedDate = formatDisplayDate(selectedDate, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const isSelectedToday = isToday(selectedDate);
  const isSelectedYesterday = isYesterday(selectedDate);

  let cleanAvatarSrc = member.avatar;
  if (cleanAvatarSrc && typeof cleanAvatarSrc === 'string') {
    cleanAvatarSrc = cleanAvatarSrc.trim().replace('http://', 'https://');
  }
  const defaultDicebear = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(member.name || member.username || 'user')}`;

  const memberLogs = habits.map((habit) => {
    const habitId = (habit.id || habit._id).toString();
    const log = todayLogs.find(
      (l) => l.habitId?.toString() === habitId && l.userId?.toString() === member.userId?.toString()
    );
    return {
      habit,
      isCompleted: !!log?.isCompleted || (typeof log?.value === 'number' && log.value > 0) || (typeof log?.value === 'string' && log.value.trim().length > 0),
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
            <button
              type="button"
              onClick={() => setShowProfilePhotoModal(true)}
              className="relative group cursor-pointer rounded-full transition-transform duration-200 hover:scale-108 active:scale-95 focus:outline-hidden"
              title={`View ${member.name}'s profile picture`}
            >
              <Avatar
                src={member.avatar}
                name={member.name}
                size="md"
                status={completedCount === totalTasks && totalTasks > 0 ? 'completed' : 'pending'}
                className="group-hover:ring-2 group-hover:ring-white/90 transition-all shadow-md"
              />
              <span className="absolute inset-0 rounded-full bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                <Maximize2 className="w-3.5 h-3.5 drop-shadow-md" />
              </span>
            </button>
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
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 flex-wrap">
            <Calendar className="w-3.5 h-3.5 text-[#047857]" />
            <span>{formattedDate}</span>
            {isSelectedToday && (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 border border-emerald-300">
                Today
              </span>
            )}
            {isSelectedYesterday && (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                Yesterday
              </span>
            )}
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
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {memberLogs.length === 0 ? (
            <p className="text-xs text-gray-500 py-6 text-center">No tasks assigned in this group.</p>
          ) : (
            <>
              {/* 1. Pending Tasks Section */}
              {memberLogs.filter((m) => !m.isCompleted).length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                      <span>Pending Tasks ({memberLogs.filter((m) => !m.isCompleted).length})</span>
                    </p>
                  </div>

                  {memberLogs
                    .filter((m) => !m.isCompleted)
                    .map(({ habit, isCompleted, value, notes }) => (
                      <div
                        key={habit.id || habit._id}
                        className="p-3.5 rounded-2xl border border-rose-200 bg-rose-50/50 shadow-2xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="w-3 h-3 rounded-full shrink-0 bg-rose-400 ring-2 ring-rose-200" />
                            <div>
                              <h4 className="text-sm font-extrabold text-[#022c22]">{habit.title}</h4>
                              <p className="text-[10px] text-gray-500 font-semibold capitalize">
                                {habit.frequency} • {habit.type === 'time_of_day' ? 'Specific Time' : habit.type.replace('_', ' ')}
                                {habit.targetValue ? ` (Target: ${habit.targetValue} ${habit.targetUnit || ''})` : ''}
                              </p>
                            </div>
                          </div>

                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                            Pending
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* 2. Completed Tasks Section */}
              {memberLogs.filter((m) => m.isCompleted).length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Completed Tasks ({memberLogs.filter((m) => m.isCompleted).length})</span>
                    </p>
                  </div>

                  {memberLogs
                    .filter((m) => m.isCompleted)
                    .map(({ habit, isCompleted, value, notes }) => (
                      <div
                        key={habit.id || habit._id}
                        className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 shadow-2xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="w-3 h-3 rounded-full shrink-0 bg-[#10b981] ring-2 ring-emerald-300" />
                            <div>
                              <h4 className="text-sm font-extrabold text-[#022c22]">{habit.title}</h4>
                              <p className="text-[10px] text-emerald-800/80 font-semibold capitalize">
                                {habit.frequency} • {habit.type === 'time_of_day' ? 'Specific Time' : habit.type.replace('_', ' ')}
                              </p>
                            </div>
                          </div>

                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0 flex items-center gap-1">
                            <Check className="w-3 h-3 stroke-[3]" />
                            Completed
                          </span>
                        </div>

                        {/* Specific Response Values */}
                        <div className="pt-2 border-t border-emerald-100 flex items-center justify-between text-xs">
                          <span className="text-[11px] text-gray-500 font-semibold">Response:</span>

                          {habit.type === 'boolean' && (
                            <span className="font-extrabold text-emerald-900 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5 text-[#10b981] stroke-[3]" />
                              Yes, Completed
                            </span>
                          )}

                          {habit.type === 'count' && (
                            <span className="font-extrabold text-[#022c22]">
                              <strong className="text-emerald-800 font-black">{value || 0}</strong> /{' '}
                              {habit.targetValue} {habit.targetUnit || 'reps'}
                            </span>
                          )}

                          {habit.type === 'time_target' && (
                            <span className="font-extrabold text-[#022c22]">
                              <strong className="text-emerald-800 font-black">{formatTime(value || 0)}</strong> /{' '}
                              {formatTime(habit.targetValue || 60)}
                            </span>
                          )}

                          {habit.type === 'timer' && (
                            <span className="font-mono font-black text-emerald-950 bg-emerald-100 px-2 py-0.5 rounded">
                              ⏱️ {formatStopwatch(value || 0)}
                            </span>
                          )}

                          {habit.type === 'yes_no' && (
                            <span className="font-extrabold text-emerald-900">
                              ✅ Yes, Done
                            </span>
                          )}

                          {habit.type === 'time_of_day' && (
                            <span className="font-extrabold text-emerald-900">
                              ⏰ Checked in: {value || habit.targetValue || 'Done'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </>
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

      {/* Expanded Profile Photo Lightbox Modal */}
      <AnimatePresence>
        {showProfilePhotoModal && (
          <div
            onClick={() => setShowProfilePhotoModal(false)}
            className="fixed inset-0 z-60 bg-emerald-950/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 15 }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl border border-emerald-100 flex flex-col items-center text-center relative overflow-hidden cursor-default"
            >
              <button
                onClick={() => setShowProfilePhotoModal(false)}
                className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Glowing Large Profile Avatar */}
              <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden p-1.5 bg-gradient-to-tr from-[#10b981] via-[#047857] to-[#022c22] shadow-xl my-2 ring-4 ring-emerald-50">
                <img
                  src={cleanAvatarSrc || defaultDicebear}
                  alt={member.name}
                  className="w-full h-full object-cover rounded-full bg-white shadow-inner"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = defaultDicebear;
                  }}
                />
              </div>

              <h3 className="text-base font-black text-[#022c22] mt-2">{member.name}</h3>
              <p className="text-xs text-emerald-700 font-semibold">@{member.username}</p>

              {member.role === 'admin' && (
                <span className="mt-2 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                  <Crown className="w-3 h-3 fill-current" />
                  Group Admin
                </span>
              )}

              {/* Admin Change Photo Button */}
              {isMemberAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setShowProfilePhotoModal(false);
                    setShowUpdateAvatarModal(true);
                  }}
                  className="mt-4 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#047857] to-[#10b981] hover:from-[#065f46] hover:to-[#059669] text-white text-xs font-black shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-transform hover:scale-102"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Update Profile Photo</span>
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Update Avatar Modal for Admin / Self */}
      <UpdateAvatarModal
        targetUser={member}
        groupId={groupId}
        isOpen={showUpdateAvatarModal}
        onClose={() => setShowUpdateAvatarModal(false)}
      />
    </div>
  );
};
