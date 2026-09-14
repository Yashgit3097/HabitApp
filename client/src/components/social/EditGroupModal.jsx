import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Upload, Trash2, Check, Loader2, Sparkles, Shield, AlertTriangle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { Avatar } from '../common/Avatar';

export const EditGroupModal = ({ isOpen, onClose, group }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (group) {
      setName(group.name || '');
      setDescription(group.description || '');
      setSelectedFile(null);
      setPreviewUrl(null);
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [group, isOpen]);

  if (!isOpen || !group) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size must be less than 5MB');
      return;
    }

    setErrorMsg('');
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleGenerateIdenticon = () => {
    const randomSeed = Math.random().toString(36).substring(7);
    const newAvatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name.trim() || randomSeed)}`;
    setSelectedFile(null);
    setPreviewUrl(newAvatar);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Group name is required');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const groupId = group.id || group._id;
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('description', description.trim());

      if (selectedFile) {
        formData.append('avatar', selectedFile);
      } else if (previewUrl && !selectedFile) {
        formData.append('avatarUrl', previewUrl);
      }

      await api.put(`/groups/${groupId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccessMsg('Group updated successfully! ✨');
      queryClient.invalidateQueries({ queryKey: ['groupDetails'] });
      queryClient.invalidateQueries({ queryKey: ['userGroups'] });
      queryClient.invalidateQueries({ queryKey: ['groupMonthlySummary'] });

      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      console.error('Update group error:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to update group');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${group.name}"? All group habits and records will be removed.`)) {
      return;
    }

    setIsDeleting(true);
    setErrorMsg('');

    try {
      const groupId = group.id || group._id;
      await api.delete(`/groups/${groupId}`);
      queryClient.invalidateQueries({ queryKey: ['userGroups'] });
      onClose();
      navigate('/social');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to delete group');
      setIsDeleting(false);
    }
  };

  const currentAvatar = previewUrl || group.avatar;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-70 bg-emerald-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 15 }}
          className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-emerald-100 relative overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h3 className="font-black text-base text-[#022c22]">Edit Group Settings</h3>
              <p className="text-xs text-gray-400 font-semibold">Update group name, description and group photo</p>
            </div>
            <button
              onClick={onClose}
              disabled={isSaving || isDeleting}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="flex-1 overflow-y-auto py-4 space-y-4">
            {/* Group Avatar Edit */}
            <div className="flex flex-col items-center">
              <div className="relative group">
                <div className="w-24 h-24 rounded-3xl overflow-hidden p-1 bg-gradient-to-tr from-[#10b981] via-[#047857] to-[#022c22] shadow-md ring-4 ring-emerald-50">
                  <Avatar
                    src={currentAvatar}
                    name={name || group.name}
                    size="xl"
                    className="w-full h-full object-cover rounded-2xl"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 rounded-full bg-[#047857] hover:bg-[#065f46] text-white shadow-md border-2 border-white transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                  title="Upload group photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="flex items-center gap-2 mt-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#047857] text-[11px] font-bold transition-colors cursor-pointer"
                >
                  Upload Photo
                </button>
                <button
                  type="button"
                  onClick={handleGenerateIdenticon}
                  className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Random Icon</span>
                </button>
              </div>
            </div>

            {/* Group Name Input */}
            <div>
              <label className="block text-xs font-black text-emerald-950 mb-1">Group Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sankalp Group 🙏🏻"
                className="w-full px-3.5 py-2.5 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs font-bold text-[#022c22] focus:outline-none focus:ring-2 focus:ring-[#10b981]"
              />
            </div>

            {/* Group Description */}
            <div>
              <label className="block text-xs font-black text-emerald-950 mb-1">Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Group purpose, shared rules, and sankalp goals..."
                className="w-full px-3.5 py-2 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs font-semibold text-[#022c22] focus:outline-none focus:ring-2 focus:ring-[#10b981] resize-none"
              />
            </div>

            {/* Group Join Code (Readonly) */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                  Group Join Code
                </span>
                <span className="font-mono text-xs font-black text-emerald-950">{group.joinCode}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(group.joinCode);
                  setSuccessMsg('Join code copied to clipboard!');
                  setTimeout(() => setSuccessMsg(''), 2000);
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-100/70 hover:bg-emerald-200 text-[#047857] text-[11px] font-bold cursor-pointer transition-colors"
              >
                Copy Code
              </button>
            </div>

            {/* Status alerts */}
            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 text-center">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 text-center flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4 text-[#047857] stroke-[3]" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Danger Zone: Delete Group */}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
              <div className="text-left">
                <p className="text-xs font-black text-rose-700">Delete Group</p>
                <p className="text-[10px] text-gray-400 font-semibold">Permanently remove this group</p>
              </div>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors flex items-center gap-1.5 border border-rose-200 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete</span>
              </button>
            </div>

            {/* Save Buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving || isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#047857] to-[#10b981] hover:from-[#065f46] hover:to-[#059669] text-white text-xs font-black shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
