import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Share2,
  Plus,
  Shield,
  Trash2,
  LogOut,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Sparkles,
  UserX,
  Crown,
  Activity,
  BarChart3
} from 'lucide-react';
import api from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { Avatar } from '../../components/common/Avatar';
import { GroupMatrixBoard } from '../../components/social/GroupMatrixBoard';
import { GroupAnalyticsCard } from '../../components/social/GroupAnalyticsCard';
import { DateNavigator } from '../../components/habits/DateNavigator';
import { MemberReportModal } from '../../components/social/MemberReportModal';
import { ShareInviteModal } from '../../components/social/ShareInviteModal';
import { CreateHabitModal } from '../../components/habits/CreateHabitModal';
import { GroupMatrixSkeleton } from '../../components/common/SkeletonLoader';
import { joinGroupRoom, leaveGroupRoom, getSocket } from '../../api/socket';

export const GroupDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { openCreateHabit } = useUIStore();

  const [activeTab, setActiveTab] = useState('matrix'); // 'matrix' | 'analytics' | 'members'
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedMemberForReport, setSelectedMemberForReport] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Fetch group details
  const { data: groupData, isLoading } = useQuery({
    queryKey: ['groupDetails', id, selectedDate],
    queryFn: async () => {
      const res = await api.get(`/groups/${id}?date=${selectedDate}`);
      return res.data?.data;
    }
  });

  // Socket room join & live updates
  useEffect(() => {
    joinGroupRoom(id);

    const socket = getSocket();
    const handleGroupUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['groupDetails'] });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
    };

    socket.on('group_habit_updated', handleGroupUpdate);
    socket.on('member_joined', handleGroupUpdate);
    socket.on('member_removed', handleGroupUpdate);

    return () => {
      leaveGroupRoom(id);
      socket.off('group_habit_updated', handleGroupUpdate);
      socket.off('member_joined', handleGroupUpdate);
      socket.off('member_removed', handleGroupUpdate);
    };
  }, [id, queryClient]);

  // Remove member / leave group mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId) => {
      await api.delete(`/groups/${id}/members/${memberId}`);
    },
    onSuccess: (data, memberId) => {
      queryClient.invalidateQueries({ queryKey: ['groupDetails'] });
      queryClient.invalidateQueries({ queryKey: ['userGroups'] });
      if (memberId === (user?.id || user?._id)) {
        navigate('/social');
      }
    }
  });

  if (isLoading) {
    return <GroupMatrixSkeleton />;
  }

  const group = groupData?.group;
  const habits = groupData?.habits || [];
  const todayLogs = groupData?.todayLogs || [];
  const members = group?.members || [];

  if (!group) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-sm max-w-md mx-auto">
        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="font-bold text-gray-800 text-base">Group Not Found</h3>
        <p className="text-xs text-gray-500 mt-1 mb-4">
          This group may have been removed or you are not a member.
        </p>
        <button
          onClick={() => navigate('/social')}
          className="px-4 py-2 rounded-xl bg-[#047857] text-white text-xs font-bold hover:bg-[#065f46] transition-colors cursor-pointer"
        >
          Back to Groups
        </button>
      </div>
    );
  }

  const currentUserId = user?.id || user?._id;
  const isAdmin = group.adminId === currentUserId;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Back Button & Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/social')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-100 text-xs font-bold transition-all shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Groups</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#047857] hover:bg-[#065f46] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Invite Link</span>
          </button>
        </div>
      </div>

      {/* Group Header Card */}
      <div className="bg-gradient-to-r from-[#065f46] via-[#047857] to-[#065f46] rounded-2xl p-4 sm:p-5 text-white shadow-md border border-[#6ee7b7]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Avatar src={group.avatar} name={group.name} size="lg" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black tracking-tight">{group.name}</h2>
              {isAdmin && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-400/90 text-amber-950">
                  <Crown className="w-3 h-3 fill-current" />
                  Admin
                </span>
              )}
            </div>
            {group.description && (
              <p className="text-xs text-emerald-100/90 font-medium mt-0.5 max-w-md">
                {group.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-emerald-200/90 font-bold">
              <span>{members.length} Members</span>
              <span>•</span>
              <span className="font-mono bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-400/30">
                Code: {group.joinCode}
              </span>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={openCreateHabit}
              className="px-3.5 py-2 rounded-xl bg-[#10b981] hover:bg-[#059669] text-[#022c22] text-xs font-black transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add Group Task</span>
            </button>
          </div>
        )}
      </div>

      {/* Date Navigator - inspect responses for any date, defaults to today */}
      <DateNavigator selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      {/* Segmented View Tabs (Matrix Board / Analytics / Members) */}
      <div className="flex items-center justify-between gap-1 bg-white p-1 rounded-2xl border border-gray-200 shadow-2xs">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'matrix'
              ? 'bg-[#047857] text-white shadow-xs'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Live Matrix</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-[#047857] text-white shadow-xs'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Reports & Stats</span>
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'members'
              ? 'bg-[#047857] text-white shadow-xs'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Members ({members.length})</span>
        </button>
      </div>

      {/* Tab 1: Live Social Matrix Board (Green = Done, Red = Pending) */}
      {activeTab === 'matrix' && (
        <div className="space-y-3">
          <GroupMatrixBoard
            habits={habits}
            members={members}
            todayLogs={todayLogs}
            currentUserId={currentUserId}
            onSelectMember={setSelectedMemberForReport}
            selectedDate={selectedDate}
          />
        </div>
      )}

      {/* Tab 2: Group Reports & Analytics */}
      {activeTab === 'analytics' && (
        <GroupAnalyticsCard
          habits={habits}
          members={members}
          todayLogs={todayLogs}
        />
      )}

      {/* Tab 3: Member Directory & Admin Powers */}
      {activeTab === 'members' && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-emerald-100">
          <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
            <h3 className="font-extrabold text-sm sm:text-base text-[#022c22]">
              Group Members Directory
            </h3>
            {isAdmin && (
              <span className="text-[10px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                Admin Controls Active
              </span>
            )}
          </div>

          <div className="divide-y divide-gray-100">
            {members.map((m) => {
              const isMemberAdmin = m.role === 'admin' || m.userId === group.adminId;
              const isSelf = m.userId === currentUserId;

              return (
                <div
                  key={m.userId}
                  className="py-2.5 flex items-center justify-between gap-3 first:pt-0 last:pb-0"
                >
                  <div
                    onClick={() => setSelectedMemberForReport(m)}
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer group flex-1"
                    title={`Click to view ${m.name}'s daily report`}
                  >
                    <Avatar src={m.avatar} name={m.name} size="sm" className="group-hover:ring-2 group-hover:ring-emerald-400 transition-all" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-[#022c22] group-hover:text-[#047857] transition-colors truncate">
                          {m.name}
                        </p>
                        {isSelf && (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                            You
                          </span>
                        )}
                        {isMemberAdmin && (
                          <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <Crown className="w-2.5 h-2.5 fill-current" />
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 truncate">@{m.username}</p>
                    </div>
                  </div>

                  {/* Admin Kick Member / Self Leave button */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedMemberForReport(m)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      Report
                    </button>

                    {isAdmin && !isSelf && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to remove ${m.name} from the group?`)) {
                            removeMemberMutation.mutate(m.userId);
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        title="Remove inactive member"
                      >
                        <UserX className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    )}

                    {!isAdmin && isSelf && (
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to leave this group?')) {
                            removeMemberMutation.mutate(m.userId);
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>Leave Group</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Share Invite Modal */}
      <ShareInviteModal
        group={group}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* Detailed Member Response Report Modal */}
      <MemberReportModal
        member={selectedMemberForReport}
        habits={habits}
        todayLogs={todayLogs}
        selectedDate={selectedDate}
        isOpen={!!selectedMemberForReport}
        onClose={() => setSelectedMemberForReport(null)}
      />

      <CreateHabitModal />
    </div>
  );
};
