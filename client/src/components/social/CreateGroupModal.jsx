import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Users, Camera, Sparkles, Shield, AlertCircle } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import api from '../../api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

export const CreateGroupModal = () => {
  const { isCreateGroupOpen, closeCreateGroup } = useUIStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef(null);

  const createGroupMutation = useMutation({
    mutationFn: async (formData) => {
      const response = await api.post('/groups', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['userGroups'] });
      resetForm();
      closeCreateGroup();
      if (data.data?.id || data.data?._id) {
        navigate(`/social/group/${data.data.id || data.data._id}`);
      }
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.message || 'Failed to create group');
    }
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setAvatarFile(null);
    setAvatarPreview('');
    setErrorMsg('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  if (!isCreateGroupOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a group name');
      return;
    }

    const formData = new FormData();
    formData.append('name', name.trim());
    formData.append('description', description.trim());
    if (avatarFile) {
      formData.append('avatar', avatarFile);
    }

    createGroupMutation.mutate(formData);
  };

  const defaultAvatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(
    name || 'sankalp'
  )}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-emerald-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-emerald-100 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#065f46] text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500/30 flex items-center justify-center border border-teal-400/40">
              <Users className="w-4 h-4 text-teal-200" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">Create Sankalp Group</h2>
              <p className="text-[10px] text-emerald-200/80 font-medium">Shared Habit Accountability</p>
            </div>
          </div>
          <button
            onClick={() => {
              resetForm();
              closeCreateGroup();
            }}
            className="p-1 rounded-lg hover:bg-emerald-700/80 text-emerald-200 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Group Profile Picture (DP) Upload */}
          <div className="flex flex-col items-center justify-center">
            <div
              className="relative group cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-20 h-20 rounded-2xl overflow-hidden ring-4 ring-emerald-200 shadow-md bg-emerald-50 flex items-center justify-center border border-emerald-300">
                <img
                  src={avatarPreview || defaultAvatar}
                  alt="Group DP preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <span className="absolute -bottom-1 -right-1 p-1.5 bg-[#047857] text-white rounded-lg shadow-sm">
                <Camera className="w-3 h-3" />
              </span>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <p className="text-[11px] text-emerald-800 font-bold mt-1.5">
              Upload Group DP / Icon
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-950 mb-1">
              Group Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrorMsg('');
              }}
              required
              placeholder="e.g. Sankalp Group, Morning Warriors, Katha Circle"
              className="w-full px-3.5 py-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200 text-sm font-semibold text-[#022c22] focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-950 mb-1">
              Purpose / Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="e.g. Daily group habits with live Green/Red member tracking."
              className="w-full px-3.5 py-2 bg-emerald-50/40 rounded-xl border border-emerald-100 text-xs font-medium text-[#022c22] focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:bg-white transition-all resize-none"
            />
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-start gap-2 text-emerald-900 text-xs font-medium">
            <Sparkles className="w-4 h-4 text-[#10b981] shrink-0 mt-0.5" />
            <span>
              You will automatically become the <strong>Group Admin</strong> with powers to manage members, share joining links & codes.
            </span>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => {
                resetForm();
                closeCreateGroup();
              }}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createGroupMutation.isPending}
              className="px-5 py-2 rounded-xl bg-[#047857] hover:bg-[#065f46] text-white font-bold text-xs shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
            >
              {createGroupMutation.isPending ? 'Creating...' : 'Create & Invite Friends'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
