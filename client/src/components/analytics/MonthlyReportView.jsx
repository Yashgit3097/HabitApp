import React, { useState } from 'react';
import {
  Shield,
  Trophy,
  CheckCircle2,
  Calendar,
  Clock,
  Timer,
  Hash,
  HelpCircle,
  Sparkles,
  Edit3,
  TrendingUp,
  Award,
  BookOpen,
  Dumbbell,
  Heart,
  Droplet,
  Brain,
  Coffee,
  Moon,
  Sun,
  Target,
  Smile,
  Music,
  Footprints,
  Utensils,
  Zap,
  MessageSquare,
  Check,
  Flame,
  Pencil
} from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { ProfilePhotoModal } from '../common/ProfilePhotoModal';
import { EditReportModal } from './EditReportModal';
import { EditHabitModal } from '../habits/EditHabitModal';

const ICON_MAP = {
  CheckCircle2,
  Flame,
  Sparkles,
  BookOpen,
  Dumbbell,
  Heart,
  Droplet,
  Brain,
  Clock,
  Coffee,
  Moon,
  Sun,
  Target,
  Trophy,
  Smile,
  Music,
  Shield,
  Footprints,
  Utensils,
  Zap
};

export const MonthlyReportView = ({ report, canEdit = false, showRemarks = true }) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  if (!report) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-emerald-200">
        <p className="text-xs text-gray-500 font-semibold">No report data found for this month.</p>
      </div>
    );
  }

  const {
    userProfile = {},
    month,
    year,
    monthNumber,
    activeDaysInMonth,
    daysInMonth,
    effectiveStartDay,
    isFirstMonth,
    overallStats = {},
    habitSummaries = [],
    adminRemarks
  } = report;

  // Month formatted title
  const monthDate = new Date(year, monthNumber - 1, 1);
  const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-3">
      {/* Profile & Month Header Card */}
      <div className="bg-gradient-to-r from-[#065f46] via-[#047857] to-[#065f46] rounded-2xl p-3.5 sm:p-4 text-white shadow-sm border border-emerald-400/20">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsPhotoModalOpen(true)}
              className="relative rounded-full transition-transform duration-200 hover:scale-108 active:scale-95 cursor-pointer focus:outline-hidden shrink-0 group"
              title="Tap to view profile picture"
            >
              <Avatar
                src={userProfile.avatar}
                name={userProfile.name}
                size="md"
                className="ring-2 ring-emerald-300 ring-offset-2 ring-offset-[#065f46] rounded-full shadow-xs shrink-0"
              />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-white truncate">{userProfile.name}</h3>
                {isFirstMonth && (
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-amber-400 text-amber-950">
                    🌟 1st Month (Day {effectiveStartDay}+)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-emerald-200/90 font-semibold truncate">
                @{userProfile.username || 'user'} • {monthLabel} ({activeDaysInMonth} out of {daysInMonth} days active)
              </p>
            </div>
          </div>

          {canEdit && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-2.5 py-1 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold transition-all border border-white/20 flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Edit3 className="w-3 h-3" />
              <span>Remarks</span>
            </button>
          )}
        </div>
      </div>

      {/* Profile Photo Lightbox Modal */}
      <ProfilePhotoModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        src={userProfile.avatar}
        name={userProfile.name}
        username={userProfile.username}
        subtitle={`${monthLabel} Report • ${activeDaysInMonth}/${daysInMonth} Days Active`}
      />

      {/* 4 Compact Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Discipline Score */}
        <div className="p-2.5 rounded-xl bg-white border border-emerald-100 shadow-2xs flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Shield className="w-3.5 h-3.5 fill-amber-500/20" />
          </div>
          <div className="min-w-0">
            <span className="text-base font-black text-[#022c22] block leading-tight">{overallStats.disciplineScore || 0}</span>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight truncate block">Discipline Score</span>
          </div>
        </div>

        {/* Perfect Days */}
        <div className="p-2.5 rounded-xl bg-white border border-emerald-100 shadow-2xs flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#047857] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs sm:text-sm font-black text-[#022c22] block leading-tight">
              {overallStats.perfectDays || 0} <span className="text-[10px] text-gray-400 font-bold">/ {activeDaysInMonth}d</span>
            </span>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight truncate block">100% Days</span>
          </div>
        </div>

        {/* Success Rate */}
        <div className="p-2.5 rounded-xl bg-white border border-emerald-100 shadow-2xs flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-base font-black text-[#022c22] block leading-tight">{overallStats.overallCompletionRate || 0}%</span>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight truncate block">Success Rate</span>
          </div>
        </div>

        {/* Tracked Habits */}
        <div className="p-2.5 rounded-xl bg-white border border-emerald-100 shadow-2xs flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Target className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-base font-black text-[#022c22] block leading-tight">{overallStats.totalHabits || 0}</span>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight truncate block">Total Tasks</span>
          </div>
        </div>
      </div>

      {/* Admin Remarks Card (Only when showRemarks is true and remarks exist) */}
      {showRemarks && adminRemarks && (
        <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 shadow-2xs flex items-start gap-2.5">
          <MessageSquare className="w-4 h-4 text-[#047857] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-emerald-950">Coach Remarks</h4>
            <p className="text-xs text-[#022c22] font-semibold mt-0.5 leading-relaxed">{adminRemarks}</p>
          </div>
        </div>
      )}

      {/* Habit Breakdown List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-[#047857]" />
            <span>Habits Performance Breakdown ({habitSummaries.length})</span>
          </h4>
        </div>

        {habitSummaries.length === 0 ? (
          <div className="p-5 text-center bg-white rounded-2xl border border-gray-100 text-xs text-gray-400">
            No habits recorded for this period.
          </div>
        ) : (
          <div className="space-y-2">
            {habitSummaries.map((h) => {
              const IconComp = ICON_MAP[h.icon] || Sparkles;
              const details = h.typeDetails || {};
              const targetDays = h.activeDaysInMonth || activeDaysInMonth;

              return (
                <div
                  key={h.habitId}
                  className="p-3 bg-white rounded-2xl border border-gray-200/80 shadow-2xs space-y-2 hover:border-emerald-200 transition-colors"
                >
                  {/* Top Row: Habit Title & Progress Badge */}
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        style={{ backgroundColor: `${h.color || '#10b981'}15`, color: h.color || '#10b981' }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      >
                        <IconComp className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs sm:text-sm font-extrabold text-[#022c22] truncate">{h.title}</h5>
                        <p className="text-[10px] text-gray-400 font-semibold capitalize truncate">
                          {h.frequency} • {h.type === 'time_of_day' ? 'Specific Time' : h.type.replace('_', ' ')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => setEditingHabit({ id: h.habitId, _id: h.habitId, ...h })}
                          className="p-1 rounded-md text-gray-400 hover:text-[#047857] hover:bg-emerald-50 transition-colors cursor-pointer"
                          title="Edit Habit Settings"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}

                      <span className="text-[11px] font-black text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                        {h.completedDaysCount} out of {targetDays} days ({h.completionPercentage}%)
                      </span>
                    </div>
                  </div>

                  {/* Slim Progress Bar */}
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#10b981] to-[#047857] rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, h.completionPercentage)}%` }}
                    />
                  </div>

                  {/* Compact Metrics Row */}
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 flex-wrap pt-0.5">
                    {/* Boolean */}
                    {h.type === 'boolean' && (
                      <span className="text-emerald-900 bg-emerald-50/70 px-2 py-0.5 rounded-md">
                        Done: {details.completedDays || 0} / {targetDays} days • {details.percentage || 0}% rate
                      </span>
                    )}

                    {/* Yes/No */}
                    {h.type === 'yes_no' && (
                      <>
                        <span className="text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md">
                          Yes: {details.yesDays || 0} / {targetDays} days ({details.yesPercentage || 0}%)
                        </span>
                        <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                          Missed: {details.noDays || 0} days
                        </span>
                      </>
                    )}

                    {/* Time of Day */}
                    {h.type === 'time_of_day' && (
                      <>
                        <span className="text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md">
                          Logged: {details.completedDays || h.completedDaysCount || 0} / {targetDays} days
                        </span>
                        <span className="text-gray-700 bg-gray-50 px-2 py-0.5 rounded-md">
                          Avg: {details.averageTime || 'N/A'} (Most frequent: {details.mostFrequentTime || 'N/A'})
                        </span>
                      </>
                    )}

                    {/* Numeric Count */}
                    {h.type === 'count' && (
                      <>
                        <span className="text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md">
                          Total: {details.totalCount || 0} {details.unit || 'units'}
                        </span>
                        <span className="text-gray-700 bg-gray-50 px-2 py-0.5 rounded-md">
                          Daily Avg: {details.dailyAverage || 0} {details.unit || 'units'}/day
                        </span>
                      </>
                    )}

                    {/* Time Target / Duration */}
                    {h.type === 'time_target' && (
                      <>
                        <span className="text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md">
                          Total: {details.totalHours || 0} hrs ({details.totalMinutes || 0} mins)
                        </span>
                        <span className="text-gray-700 bg-gray-50 px-2 py-0.5 rounded-md">
                          Daily Avg: {details.dailyAverageMinutes || 0} mins/day
                        </span>
                      </>
                    )}

                    {/* Stopwatch / Timer */}
                    {h.type === 'timer' && (
                      <>
                        <span className="text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md font-mono">
                          Total: {details.totalMinutes || 0} mins
                        </span>
                        <span className="text-gray-700 bg-gray-50 px-2 py-0.5 rounded-md">
                          Daily Avg: {Math.round((details.dailyAverageSeconds || 0) / 60)} mins/day
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Remarks Modal */}
      <EditReportModal
        report={report}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />

      {/* Edit Habit Modal */}
      {editingHabit && (
        <EditHabitModal
          habit={editingHabit}
          isOpen={!!editingHabit}
          onClose={() => setEditingHabit(null)}
        />
      )}
    </div>
  );
};
