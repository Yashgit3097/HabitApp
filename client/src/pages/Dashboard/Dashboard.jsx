import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles,
  Plus,
  CheckCircle2,
  Flame,
  Calendar,
  Trophy,
  ArrowUpRight
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import api from '../../api/client';
import { DateNavigator } from '../../components/habits/DateNavigator';
import { HabitCard } from '../../components/habits/HabitCard';
import { CreateHabitModal } from '../../components/habits/CreateHabitModal';
import { HabitListSkeleton } from '../../components/common/SkeletonLoader';
import { getLocalDateString, formatDisplayDate } from '../../utils/dateUtils';

export const Dashboard = () => {
  const { user } = useAuthStore();
  const { openCreateHabit, openCreateGroup } = useUIStore();

  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString(new Date()));
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'completed'

  const { data: habitsResponse, isLoading } = useQuery({
    queryKey: ['habits', selectedDate],
    queryFn: async () => {
      const res = await api.get(`/habits?date=${selectedDate}`);
      return res.data;
    }
  });

  const habits = habitsResponse?.data || [];

  const totalHabits = habits.length;
  const completedHabits = habits.filter((h) => h.todayLog?.isCompleted).length;
  const completionPercentage = totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0;

  // Filter habits
  const filteredHabits = habits.filter((h) => {
    if (filter === 'completed') return h.todayLog?.isCompleted;
    if (filter === 'pending') return !h.todayLog?.isCompleted;
    return true;
  });

  const formattedDateTitle = formatDisplayDate(selectedDate, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Sleek, Compact Top Header Banner */}
      <div className="bg-gradient-to-r from-[#065f46] via-[#047857] to-[#065f46] rounded-2xl px-4 py-3.5 text-white shadow-md border border-[#6ee7b7]/20 flex items-center justify-between gap-3">
        {/* Left: Date Badge + Compact Namaste Greeting */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="px-2.5 py-1 rounded-xl bg-emerald-950/50 border border-emerald-400/30 text-emerald-200 text-[11px] font-bold shrink-0 flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-[#10b981]" />
            <span>{formattedDateTitle}</span>
          </div>
          <div className="truncate">
            <span className="text-xs sm:text-sm font-extrabold text-emerald-100 tracking-tight block truncate">
              Namaste, <span className="text-white font-black">{user?.name || 'Friend'}</span> 🙏
            </span>
          </div>
        </div>

        {/* Right: Clean, Compact Stats Badges */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Day Streak */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-950/40 border border-emerald-400/20 text-xs font-black">
            <Flame className="w-3.5 h-3.5 text-amber-400 fill-current" />
            <span className="text-white">{completedHabits > 0 ? '1' : '0'}</span>
            <span className="text-[10px] text-emerald-300 font-semibold hidden sm:inline">Streak</span>
          </div>

          {/* Completion Goal */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-950/40 border border-emerald-400/20 text-xs font-black">
            <Trophy className="w-3.5 h-3.5 text-[#34d399]" />
            <span className="text-white">{completionPercentage}%</span>
            <span className="text-[10px] text-emerald-300 font-semibold hidden sm:inline">Goal</span>
          </div>
        </div>
      </div>

      {/* Compact Date Navigator */}
      <DateNavigator selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      {/* Main Habits Section */}
      <div className="space-y-3">
        {/* Section Header & Filter Tabs */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#047857]" />
            <h3 className="font-extrabold text-sm sm:text-base text-[#022c22]">
              Today's Habits
            </h3>
            <span className="text-[11px] font-bold text-emerald-900 bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-200">
              {completedHabits}/{totalHabits}
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-xs text-xs font-bold">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-[#047857] text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${
                filter === 'pending'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${
                filter === 'completed'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Done
            </button>
          </div>
        </div>

        {/* Habit Card List */}
        {isLoading ? (
          <HabitListSkeleton count={3} />
        ) : filteredHabits.length > 0 ? (
          <div className="grid grid-cols-1 gap-2.5">
            {filteredHabits.map((habit) => (
              <HabitCard
                key={habit.id || habit._id}
                habit={habit}
                selectedDate={selectedDate}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-8 px-4 bg-white rounded-2xl border border-dashed border-emerald-200 shadow-xs">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 text-[#047857] flex items-center justify-center mb-2.5">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-[#022c22] text-sm">
              {filter !== 'all' ? `No ${filter} habits found` : 'No habits for this day'}
            </h4>
            <p className="text-xs text-gray-500 mt-0.5 max-w-xs mx-auto">
              Tap below to track a habit with timers, count goals, or simple check-offs.
            </p>
            <button
              onClick={openCreateHabit}
              className="mt-3 px-4 py-2 rounded-xl bg-[#047857] hover:bg-[#065f46] text-white text-xs font-bold transition-all shadow-sm cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              Create Habit
            </button>
          </div>
        )}
      </div>

      {/* Mount Create Habit Modal */}
      <CreateHabitModal />
    </div>
  );
};
