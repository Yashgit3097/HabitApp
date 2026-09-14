import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Upload, Sparkles, Check, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { Avatar } from './Avatar';

export const UpdateAvatarModal = ({
  isOpen,
  onClose,
  targetUser, // { userId, name, username, avatar }
  groupId = null
}) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen || !targetUser) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (JPG, PNG, WebP)');
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

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMsg('Please select a photo to upload');
      return;
    }

    setIsUploading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const formData = new FormData();
      formData.append('avatar', selectedFile);

      const targetUserId = targetUser.userId || targetUser.id || targetUser._id;

      if (groupId) {
        await api.put(`/groups/${groupId}/members/${targetUserId}/avatar`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await api.put('/auth/profile', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      setSuccessMsg('Profile picture updated successfully! 🎉');

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['groupDetails'] });
      queryClient.invalidateQueries({ queryKey: ['groupMonthlySummary'] });
      queryClient.invalidateQueries({ queryKey: ['monthlyReport'] });
      queryClient.invalidateQueries({ queryKey: ['userGroups'] });
      queryClient.invalidateQueries({ queryKey: ['authMe'] });

      setTimeout(() => {
        onClose();
        setSelectedFile(null);
        setPreviewUrl(null);
        setSuccessMsg('');
      }, 1000);
    } catch (err) {
      console.error('Avatar update error:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to update profile picture');
    } finally {
      setIsUploading(false);
    }
  };

  const currentDisplayAvatar = previewUrl || targetUser.avatar;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-70 bg-emerald-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 15 }}
          className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-emerald-100 relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h3 className="font-black text-base text-[#022c22]">Update Profile Picture</h3>
              <p className="text-xs text-gray-400 font-semibold">{targetUser.name}</p>
            </div>
            <button
              onClick={onClose}
              disabled={isUploading}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Avatar Preview & Upload Trigger */}
          <div className="flex flex-col items-center my-4">
            <div className="relative group">
              <div className="w-28 h-28 rounded-full overflow-hidden p-1 bg-gradient-to-tr from-[#10b981] via-[#047857] to-[#022c22] shadow-lg ring-4 ring-emerald-50">
                <Avatar
                  src={currentDisplayAvatar}
                  name={targetUser.name}
                  size="xl"
                  className="w-full h-full object-cover"
                />
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 p-2 rounded-full bg-[#047857] hover:bg-[#065f46] text-white shadow-md border-2 border-white transition-all cursor-pointer hover:scale-105 active:scale-95"
                title="Choose new photo"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <p className="text-[11px] text-gray-400 font-bold mt-2">
              Tap the camera icon or button below to choose a photo
            </p>
          </div>

          {/* Status Messages */}
          {errorMsg && (
            <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 text-center">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mb-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 text-center flex items-center justify-center gap-1.5">
              <Check className="w-4 h-4 text-[#047857] stroke-[3]" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-950 text-xs font-black transition-colors flex items-center justify-center gap-2 border border-emerald-200 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-[#047857]" />
              <span>{selectedFile ? 'Choose Another Photo' : 'Select Photo from Device'}</span>
            </button>

            {selectedFile && (
              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#047857] to-[#10b981] hover:from-[#065f46] hover:to-[#059669] text-white text-xs font-black shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading Photo...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Save New Profile Picture</span>
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
