import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Shield,
  Trophy,
  Award,
  Crown,
  ChevronRight,
  TrendingUp,
  Calendar,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import api from '../../api/client';
import { Avatar } from '../common/Avatar';
import { ProfilePhotoModal } from '../common/ProfilePhotoModal';
import { MonthlyReportView } from './MonthlyReportView';
import { motion, AnimatePresence } from 'framer-motion';

export const GroupMonthlyReportView = ({ groups = [], selectedMonth }) => {
  const [selectedGroupId, setSelectedGroupId] = useState(() => (groups[0]?.id || groups[0]?._id || ''));
  const [activeMemberReport, setActiveMemberReport] = useState(null);
  const [photoModalData, setPhotoModalData] = useState(null);

  // Instant fallback to first group if selectedGroupId is empty
  const activeGroupId = (selectedGroupId || groups[0]?.id || groups[0]?._id || '').toString();

  // Sync selected group if groups change
  React.useEffect(() => {
    if (!selectedGroupId && groups.length > 0) {
      setSelectedGroupId((groups[0]?.id || groups[0]?._id || '').toString());
    }
  }, [groups, selectedGroupId]);

  const { data: groupSummaryResponse, isLoading } = useQuery({
    queryKey: ['groupMonthlySummary', activeGroupId, selectedMonth],
    queryFn: async () => {
      if (!activeGroupId) return null;
      const res = await api.get(`/reports/group/${activeGroupId}?month=${selectedMonth}`);
      return res.data?.data;
    },
    enabled: !!activeGroupId
  });

  // Query individual member detailed report when modal opens
  const { data: memberDetailedReport, isLoading: isMemberLoading } = useQuery({
    queryKey: ['monthlyReport', activeMemberReport?.userId, activeGroupId, selectedMonth],
    queryFn: async () => {
      if (!activeMemberReport?.userId || !activeGroupId) return null;
      const res = await api.get(
        `/reports/monthly?userId=${activeMemberReport.userId}&groupId=${activeGroupId}&month=${selectedMonth}`
      );
      return res.data?.data;
    },
    enabled: !!activeMemberReport?.userId
  });

  if (groups.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-emerald-200">
        <Users className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
        <h4 className="text-sm font-black text-[#022c22]">No Sankalp Groups Joined Yet</h4>
        <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
          Join or create a group in the Social tab to view group monthly compliance reports.
        </p>
      </div>
    );
  }

  const groupSummary = groupSummaryResponse;
  const memberReports = groupSummary?.memberReports || [];

  // Calculate Group Average Stats
  const avgCompletion = memberReports.length > 0
    ? Math.round(memberReports.reduce((sum, m) => sum + (m.completionRate || 0), 0) / memberReports.length)
    : 0;

  const avgDisciplineScore = memberReports.length > 0
    ? (memberReports.reduce((sum, m) => sum + (m.disciplineScore || 0), 0) / memberReports.length).toFixed(1)
    : 0;

  const topPerformer = memberReports[0];

  return (
    <div className="space-y-3">
      {/* Group Selector Dropdown */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-emerald-100/90 shadow-2xs">
        <label className="text-xs font-black text-emerald-950 flex items-center gap-1.5 shrink-0">
          <Users className="w-3.5 h-3.5 text-[#047857]" />
          <span>Select Group:</span>
        </label>
        <select
          value={activeGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          className="px-3 py-1.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs font-bold text-[#022c22] focus:outline-none focus:ring-1 focus:ring-[#10b981] flex-1 max-w-xs cursor-pointer"
        >
          {groups.map((g) => (
            <option key={g.id || g._id} value={g.id || g._id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="p-10 text-center bg-white rounded-3xl border border-gray-100">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs font-bold text-gray-500">Compiling Group Monthly Report...</p>
        </div>
      ) : groupSummary ? (
        <div className="space-y-3">
          {/* Group Header Card */}
          <div className="bg-gradient-to-r from-[#065f46] via-[#047857] to-[#065f46] rounded-2xl p-3.5 sm:p-4 text-white shadow-sm border border-emerald-400/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() =>
                    setPhotoModalData({
                      src: groupSummary.groupAvatar,
                      name: groupSummary.groupName,
                      subtitle: `${groupSummary.memberCount} Members • Sankalp Group`
                    })
                  }
                  className="relative rounded-full transition-transform duration-200 hover:scale-108 active:scale-95 cursor-pointer focus:outline-hidden shrink-0 group"
                  title="Tap to view group image"
                >
                  <img
                    src={groupSummary.groupAvatar}
                    alt={groupSummary.groupName}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover ring-2 ring-emerald-300 ring-offset-2 ring-offset-[#065f46] shadow-xs bg-white shrink-0"
                  />
                </button>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black truncate">{groupSummary.groupName}</h3>
                  <p className="text-[11px] text-emerald-200 font-semibold flex items-center gap-1.5 mt-0.5">
                    <span>{groupSummary.memberCount} Members</span>
                    <span>•</span>
                    <span>{groupSummary.totalGroupHabits} Group Tasks</span>
                  </p>
                </div>
              </div>

              {topPerformer && (
                <div
                  onClick={() =>
                    setPhotoModalData({
                      src: topPerformer.avatar,
                      name: topPerformer.name,
                      username: topPerformer.username,
                      role: topPerformer.role,
                      subtitle: `🏆 Top Performer • ${topPerformer.disciplineScore} Score`
                    })
                  }
                  className="bg-emerald-950/50 border border-emerald-400/30 rounded-xl px-3 py-1.5 flex items-center gap-2 self-start sm:self-auto cursor-pointer hover:bg-emerald-950/70 transition-all"
                  title="Tap to view performer details"
                >
                  <Avatar src={topPerformer.avatar} name={topPerformer.name} size="xs" className="ring-1 ring-amber-400 rounded-full" />
                  <div className="text-left min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
                      <Trophy className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                      <span>Top Performer</span>
                    </p>
                    <p className="text-[11px] font-black text-white truncate max-w-[110px]">{topPerformer.name}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Stat Pill Bar */}
            <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-emerald-400/20 text-center">
              <div className="bg-emerald-900/40 rounded-lg p-1.5">
                <p className="text-[9px] text-emerald-200 font-bold uppercase">Avg Rate</p>
                <p className="text-xs sm:text-sm font-black text-white">{avgCompletion}%</p>
              </div>
              <div className="bg-emerald-900/40 rounded-lg p-1.5">
                <p className="text-[9px] text-emerald-200 font-bold uppercase">Avg Score</p>
                <p className="text-xs sm:text-sm font-black text-amber-300">{avgDisciplineScore}</p>
              </div>
              <div className="bg-emerald-900/40 rounded-lg p-1.5">
                <p className="text-[9px] text-emerald-200 font-bold uppercase">Month</p>
                <p className="text-xs sm:text-sm font-black text-emerald-100">{groupSummary.month}</p>
              </div>
            </div>
          </div>

          {/* Members Roster / Leaderboard */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5 px-1">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span>Member Monthly Compliance Ranking ({memberReports.length})</span>
            </h4>

            {memberReports.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No member activity recorded.</p>
            ) : (
              <div className="grid grid-cols-1 gap-1.5">
                {memberReports.map((member, index) => {
                  const isTopRank = index === 0;

                  return (
                    <div
                      key={member.userId}
                      onClick={() => setActiveMemberReport(member)}
                      className={`p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                        isTopRank
                          ? 'bg-amber-50/40 border-amber-200 shadow-2xs hover:border-amber-300'
                          : 'bg-white border-gray-200/80 shadow-2xs hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Rank Badge */}
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                            index === 0
                              ? 'bg-amber-400 text-amber-950 shadow-2xs'
                              : index === 1
                              ? 'bg-gray-200 text-gray-700'
                              : index === 2
                              ? 'bg-amber-700 text-amber-100'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {index + 1}
                        </div>

                        {/* Tap-to-view Profile Avatar */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoModalData({
                              src: member.avatar,
                              name: member.name,
                              username: member.username,
                              role: member.role,
                              subtitle: `Rank #${index + 1} • ${member.disciplineScore} Discipline Score`
                            });
                          }}
                          className="relative rounded-full transition-transform duration-200 hover:scale-110 active:scale-95 cursor-pointer focus:outline-hidden shrink-0 group"
                          title={`Tap to view ${member.name}'s photo`}
                        >
                          <Avatar
                            src={member.avatar}
                            name={member.name}
                            size="sm"
                            className="shrink-0 ring-1 ring-emerald-200 rounded-full"
                          />
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold text-[#022c22] truncate">
                              {member.name}
                            </span>
                            {member.role === 'admin' && (
                              <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-amber-400 text-amber-950 flex items-center gap-0.5">
                                <Crown className="w-2 h-2 fill-current" />
                                Admin
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] text-gray-400 font-semibold truncate">@{member.username}</p>
                        </div>
                      </div>

                      {/* Right Stats & Tap to View */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-black text-amber-700 flex items-center gap-1">
                            <Shield className="w-3 h-3 text-amber-500 fill-amber-500/20" />
                            <span>{member.disciplineScore} Score</span>
                          </span>
                          <span className="text-[9px] font-bold text-gray-400">
                            {member.perfectDays} / {member.activeDays}d • {member.completionRate}% Done
                          </span>
                        </div>

                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Member Detailed Modal */}
      <AnimatePresence>
        {activeMemberReport && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-emerald-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-emerald-100 overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-3.5 bg-gradient-to-r from-[#065f46] via-[#047857] to-[#065f46] text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() =>
                      setPhotoModalData({
                        src: activeMemberReport.avatar,
                        name: activeMemberReport.name,
                        username: activeMemberReport.username,
                        role: activeMemberReport.role,
                        subtitle: `${activeMemberReport.name}'s Profile Picture`
                      })
                    }
                    className="relative rounded-full transition-transform duration-200 hover:scale-108 active:scale-95 cursor-pointer focus:outline-hidden shrink-0"
                    title="Tap to view profile picture"
                  >
                    <Avatar
                      src={activeMemberReport.avatar}
                      name={activeMemberReport.name}
                      size="sm"
                      className="ring-2 ring-emerald-300 ring-offset-1 ring-offset-[#065f46] rounded-full"
                    />
                  </button>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-xs sm:text-sm text-white truncate">{activeMemberReport.name}'s Monthly Breakdown</h3>
                    <p className="text-[10px] text-emerald-200">Group Tasks Performance</p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveMemberReport(null)}
                  className="px-3 py-1 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-all cursor-pointer shrink-0"
                >
                  Close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                {isMemberLoading ? (
                  <div className="p-10 text-center">
                    <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs font-bold text-gray-500">Loading member report...</p>
                  </div>
                ) : memberDetailedReport ? (
                  <MonthlyReportView
                    report={memberDetailedReport}
                    canEdit={false}
                    showRemarks={false}
                  />
                ) : (
                  <p className="text-xs text-gray-500 py-6 text-center">No detailed logs found.</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Profile Photo Lightbox Modal */}
      <ProfilePhotoModal
        isOpen={!!photoModalData}
        onClose={() => setPhotoModalData(null)}
        src={photoModalData?.src}
        name={photoModalData?.name}
        username={photoModalData?.username}
        role={photoModalData?.role}
        subtitle={photoModalData?.subtitle}
      />
    </div>
  );
};
