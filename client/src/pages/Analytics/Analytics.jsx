import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  TrendingUp,
  Award,
  Flame,
  CheckCircle,
  Clock,
  Sparkles,
  Calendar,
  Users,
  Target
} from 'lucide-react';
import api from '../../api/client';
import { useAuthStore } from '../../stores/authStore';

export const Analytics = () => {
  const { user } = useAuthStore();

  const { data: habitsResponse } = useQuery({
    queryKey: ['habits', 'analytics'],
    queryFn: async () => {
      const res = await api.get('/habits');
      return res.data;
    }
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['userGroups'],
    queryFn: async () => {
      const res = await api.get('/groups');
      return res.data?.data || [];
    }
  });

  const habits = habitsResponse?.data || [];
  const totalHabits = habits.length;
  const completedToday = habits.filter((h) => h.todayLog?.isCompleted).length;
  const completionRate = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-[#022c22] tracking-tight flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#047857]" />
          Discipline & Habit Insights
        </h2>
        <p className="text-xs text-gray-500 font-semibold">
          Your personal habit consistency and social accountability metrics.
        </p>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-white border border-emerald-100/80 shadow-2xs flex flex-col items-center text-center">
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-1.5">
            <Flame className="w-4 h-4 fill-current" />
          </div>
          <span className="text-xl font-black text-[#022c22]">{completedToday > 0 ? '1' : '0'}</span>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
            Day Streak
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-emerald-100/80 shadow-2xs flex flex-col items-center text-center">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#047857] flex items-center justify-center mb-1.5">
            <CheckCircle className="w-4 h-4" />
          </div>
          <span className="text-xl font-black text-[#022c22]">{completedToday}/{totalHabits}</span>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
            Today Done
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-emerald-100/80 shadow-2xs flex flex-col items-center text-center">
          <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mb-1.5">
            <TrendingUp className="w-4 h-4" />
          </div>
          <span className="text-xl font-black text-[#022c22]">{completionRate}%</span>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
            Success Rate
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-emerald-100/80 shadow-2xs flex flex-col items-center text-center">
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-1.5">
            <Users className="w-4 h-4" />
          </div>
          <span className="text-xl font-black text-[#022c22]">{groups.length}</span>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
            Sankalp Groups
          </span>
        </div>
      </div>

      {/* Habit Breakdown */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-emerald-100 space-y-3">
        <h3 className="font-extrabold text-sm sm:text-base text-[#022c22] flex items-center gap-2">
          <Target className="w-4 h-4 text-[#047857]" />
          Active Habit Roster ({totalHabits})
        </h3>

        {habits.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">No active habits yet.</p>
        ) : (
          <div className="space-y-2">
            {habits.map((h) => {
              const isDone = h.todayLog?.isCompleted;
              return (
                <div
                  key={h.id || h._id}
                  className="p-3 rounded-xl bg-gray-50/70 border border-gray-100 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isDone ? 'bg-[#10b981]' : 'bg-rose-400'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold text-[#022c22]">{h.title}</p>
                      <p className="text-[10px] text-gray-400 capitalize">
                        {h.frequency} • {h.type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                      isDone
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {isDone ? 'Completed Today' : 'Pending Today'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
