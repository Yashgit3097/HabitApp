import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Calendar,
  Users,
  Sparkles,
  Shield,
  Layers,
  ChevronDown
} from 'lucide-react';
import api from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { AnalyticsSkeleton } from '../../components/common/SkeletonLoader';
import { MonthlyReportView } from '../../components/analytics/MonthlyReportView';
import { GroupMonthlyReportView } from '../../components/analytics/GroupMonthlyReportView';
import { getRecentMonthsList } from '../../utils/dateUtils';

export const Analytics = () => {
  const { user } = useAuthStore();
  const recentMonths = getRecentMonthsList(12);

  const [activeTab, setActiveTab] = useState('personal'); // 'personal' | 'groups'
  const [selectedMonth, setSelectedMonth] = useState(() => recentMonths[0]?.value || '2026-09');

  // Fetch personal monthly report
  const { data: personalReportResponse, isLoading: isPersonalReportLoading } = useQuery({
    queryKey: ['monthlyReport', user?.id || user?._id, selectedMonth],
    queryFn: async () => {
      const res = await api.get(`/reports/monthly?month=${selectedMonth}`);
      return res.data?.data;
    }
  });

  // Fetch user groups
  const { data: groups = [], isLoading: isGroupsLoading } = useQuery({
    queryKey: ['userGroups'],
    queryFn: async () => {
      const res = await api.get('/groups');
      return res.data?.data || [];
    }
  });

  const isInitialLoading = isPersonalReportLoading && isGroupsLoading;

  if (isInitialLoading) {
    return <AnalyticsSkeleton />;
  }

  const personalReport = personalReportResponse;

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-10">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-emerald-100/90 shadow-2xs">
        <div>
          <h2 className="text-lg font-black text-[#022c22] tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#047857]" />
            Monthly Discipline Insights
          </h2>
          <p className="text-xs text-gray-500 font-semibold">
            Overall monthly compliance reports and group performance archives.
          </p>
        </div>

        {/* Month Selector Dropdown */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none pl-8 pr-8 py-2 bg-emerald-50/80 hover:bg-emerald-100/80 border border-emerald-200 text-xs font-black text-emerald-950 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#10b981] transition-all cursor-pointer shadow-2xs"
            >
              {recentMonths.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} {m.isCurrentMonth ? '(Current)' : ''}
                </option>
              ))}
            </select>
            <Calendar className="w-3.5 h-3.5 text-[#047857] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <ChevronDown className="w-3.5 h-3.5 text-[#047857] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs: Personal vs Groups */}
      <div className="grid grid-cols-2 gap-2 bg-gray-100/70 p-1.5 rounded-2xl border border-gray-200/80">
        <button
          onClick={() => setActiveTab('personal')}
          className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'personal'
              ? 'bg-white text-[#047857] shadow-xs ring-1 ring-emerald-100'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Personal Monthly Report</span>
        </button>

        <button
          onClick={() => setActiveTab('groups')}
          className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'groups'
              ? 'bg-white text-[#047857] shadow-xs ring-1 ring-emerald-100'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Group Sankalp Reports ({groups.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'personal' ? (
        isPersonalReportLoading ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-gray-100">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs font-bold text-gray-500">Calculating personal monthly metrics...</p>
          </div>
        ) : (
          <MonthlyReportView report={personalReport} canEdit={true} />
        )
      ) : (
        <GroupMonthlyReportView groups={groups} selectedMonth={selectedMonth} />
      )}
    </div>
  );
};
