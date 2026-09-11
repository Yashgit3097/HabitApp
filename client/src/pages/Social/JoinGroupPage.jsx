import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Sparkles, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { Avatar } from '../../components/common/Avatar';
import { JoinGroupSkeleton } from '../../components/common/SkeletonLoader';

export const JoinGroupPage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuthStore();
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch group info by code
  const { data: group, isLoading } = useQuery({
    queryKey: ['groupByCode', code],
    queryFn: async () => {
      const res = await api.get(`/groups/code/${code}`);
      return res.data?.data;
    },
    enabled: !!code
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/groups/join', { code });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['userGroups'] });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      const groupId = data.data?.id || data.data?._id;
      if (groupId) {
        navigate(`/social/group/${groupId}`);
      } else {
        navigate('/social');
      }
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.message || 'Failed to join group');
    }
  });

  if (isLoading) {
    return <JoinGroupSkeleton />;
  }

  if (!group) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white rounded-3xl p-8 text-center shadow-lg border border-gray-100">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-[#022c22]">Invalid Invitation Link</h2>
        <p className="text-xs text-gray-500 mt-1 mb-6">
          The join code <span className="font-mono font-bold text-[#047857]">{code}</span> is invalid or has expired.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 rounded-xl bg-[#047857] text-white text-xs font-bold hover:bg-[#065f46] transition-colors cursor-pointer"
        >
          Go to Home
        </button>
      </div>
    );
  }

  const isAlreadyMember = group.members?.some(
    (m) => m.userId === (user?.id || user?._id)
  );

  return (
    <div className="max-w-md mx-auto my-8 sm:my-12">
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-emerald-100 text-center space-y-5">
        {/* Brand Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#047857] text-xs font-bold border border-emerald-200">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Group Invitation</span>
        </div>

        {/* Group Avatar & Info */}
        <div className="flex flex-col items-center">
          <Avatar src={group.avatar} name={group.name} size="xl" />
          <h2 className="text-2xl font-black text-[#022c22] mt-3 tracking-tight">
            {group.name}
          </h2>
          {group.description && (
            <p className="text-xs text-gray-500 mt-1 max-w-xs">{group.description}</p>
          )}
          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/60 px-2.5 py-0.5 rounded-full mt-2">
            {group.members?.length || 1} Members Active
          </span>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold">
            {errorMsg}
          </div>
        )}

        {/* Action Button */}
        {isAuthenticated ? (
          isAlreadyMember ? (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                You are already a member of this group!
              </div>
              <button
                onClick={() => navigate(`/social/group/${group.id || group._id}`)}
                className="w-full py-3 px-4 bg-[#047857] hover:bg-[#065f46] text-white font-bold text-sm rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Open Group</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => joinMutation.mutate()}
              disabled={joinMutation.isPending}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#047857] to-[#10b981] hover:from-[#065f46] hover:to-[#059669] text-white font-bold text-sm rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {joinMutation.isPending ? (
                'Joining Group...'
              ) : (
                <>
                  <span>Join {group.name}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => navigate(`/login?redirect=/join/${code}`)}
              className="w-full py-3.5 px-4 bg-[#047857] hover:bg-[#065f46] text-white font-bold text-sm rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Sign In to Join Group</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-[11px] text-gray-500">
              Create an account or sign in to start tracking habits with this group.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
