import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, KeyRound, AlertCircle, ArrowRight, Check } from 'lucide-react';
import api from '../../api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

export const JoinGroupModal = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const joinMutation = useMutation({
    mutationFn: async (joinCode) => {
      const response = await api.post('/groups/join', { code: joinCode });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['userGroups'] });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      setCode('');
      setErrorMsg('');
      onClose();
      if (data.data?.id || data.data?._id) {
        navigate(`/social/group/${data.data.id || data.data._id}`);
      }
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.message || 'Invalid join code. Please try again.');
    }
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrorMsg('Please enter a join code');
      return;
    }
    joinMutation.mutate(code.trim().toUpperCase());
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-emerald-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-emerald-100 overflow-hidden"
      >
        <div className="px-5 py-3.5 bg-[#065f46] text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#10b981]" />
            <h2 className="text-base font-black tracking-tight">Join Sankalp Group</h2>
          </div>
          <button
            onClick={() => {
              setCode('');
              setErrorMsg('');
              onClose();
            }}
            className="p-1 rounded-lg hover:bg-emerald-700/80 text-emerald-200 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-950 mb-1">
              Enter Group Join Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setErrorMsg('');
              }}
              required
              placeholder="e.g. SANKALP-7X29"
              className="w-full px-4 py-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-base font-black text-[#022c22] uppercase tracking-widest placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:bg-white transition-all text-center"
            />
          </div>

          <p className="text-xs text-gray-500 text-center">
            Ask your group admin for their 8-character joining code or invite link.
          </p>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={joinMutation.isPending}
              className="px-5 py-2 rounded-xl bg-[#047857] hover:bg-[#065f46] text-white font-bold text-xs shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
            >
              {joinMutation.isPending ? 'Joining...' : 'Join Group Now'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
