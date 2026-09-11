import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Plus,
  KeyRound,
  Shield,
  ArrowRight,
  Sparkles,
  Share2,
  Crown
} from 'lucide-react';
import api from '../../api/client';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { Avatar } from '../../components/common/Avatar';
import { CreateGroupModal } from '../../components/social/CreateGroupModal';
import { JoinGroupModal } from '../../components/social/JoinGroupModal';
import { GroupListSkeleton } from '../../components/common/SkeletonLoader';

export const SocialView = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { openCreateGroup } = useUIStore();
  const [isJoinCodeModalOpen, setIsJoinCodeModalOpen] = useState(false);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['userGroups'],
    queryFn: async () => {
      const res = await api.get('/groups');
      return res.data?.data || [];
    }
  });

  const currentUserId = user?.id || user?._id;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#022c22] tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-[#047857]" />
            Sankalp Groups
          </h2>
          <p className="text-xs text-gray-500 font-semibold">
            Track daily discipline and shared habits together with friends.
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsJoinCodeModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#047857]" />
            <span className="hidden sm:inline">Join Code</span>
          </button>

          <button
            onClick={openCreateGroup}
            className="px-3.5 py-1.5 rounded-xl bg-[#047857] hover:bg-[#065f46] text-white text-xs font-bold shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Group</span>
          </button>
        </div>
      </div>

      {/* Groups List */}
      {isLoading ? (
        <GroupListSkeleton count={3} />
      ) : groups.length > 0 ? (
        <div className="grid grid-cols-1 gap-2.5">
          {groups.map((group) => {
            const isAdmin = group.adminId === currentUserId;
            const groupId = group.id || group._id;

            return (
              <div
                key={groupId}
                onClick={() => navigate(`/social/group/${groupId}`)}
                className="p-3.5 bg-white rounded-2xl border border-gray-200/80 hover:border-emerald-300 shadow-xs hover:shadow-sm transition-all flex items-center justify-between gap-3 group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar src={group.avatar} name={group.name} size="md" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-extrabold text-sm sm:text-base text-[#022c22] group-hover:text-[#047857] transition-colors truncate">
                        {group.name}
                      </h3>
                      {isAdmin && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                          <Crown className="w-2.5 h-2.5 fill-current" />
                          Admin
                        </span>
                      )}
                    </div>
                    {group.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5 max-w-sm">
                        {group.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400 font-bold">
                      <span>{group.members?.length || 1} Members</span>
                      <span>•</span>
                      <span className="font-mono text-emerald-800 bg-emerald-50 px-1 py-0.2 rounded">
                        {group.joinCode}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 group-hover:bg-[#047857] group-hover:text-white text-[#047857] flex items-center justify-center transition-all">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-emerald-100 text-center py-10">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-50 text-[#047857] flex items-center justify-center mb-3">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-base font-black text-[#022c22]">No Active Groups Yet</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-5">
            Create a group like <strong className="text-emerald-900">"Sankalp Group"</strong>, invite friends with shareable links, and track live accountability together.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button
              onClick={openCreateGroup}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#047857] hover:bg-[#065f46] text-white text-xs font-bold shadow-sm transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Create Group
            </button>
            <button
              onClick={() => setIsJoinCodeModalOpen(true)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#047857] text-xs font-bold border border-emerald-200 transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Join with Code
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateGroupModal />
      <JoinGroupModal
        isOpen={isJoinCodeModalOpen}
        onClose={() => setIsJoinCodeModalOpen(false)}
      />
    </div>
  );
};
