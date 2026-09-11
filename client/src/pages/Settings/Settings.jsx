import React, { useState, useRef } from 'react';
import { Settings as SettingsIcon, User, Camera, Shield, LogOut, Check, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Avatar } from '../../components/common/Avatar';

export const Settings = () => {
  const { user, updateProfile, logout, isLoading } = useAuthStore();

  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSuccessMsg('');

    const formData = new FormData();
    formData.append('name', name);
    formData.append('bio', bio);
    if (avatarFile) {
      formData.append('avatar', avatarFile);
    }

    const res = await updateProfile(formData);
    if (res.success) {
      setSuccessMsg('Profile updated successfully! ✨');
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-black text-[#022c22] tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-[#047857]" />
          Account & Profile Settings
        </h2>
        <p className="text-xs sm:text-sm text-emerald-800 font-medium">
          Customize your display profile, avatar, and account preferences.
        </p>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-emerald-100">
        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-[#047857] text-xs font-bold animate-in fade-in duration-200">
            <Check className="w-4 h-4 text-[#10b981]" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b border-gray-100">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <Avatar
                src={avatarPreview || user?.avatar}
                name={user?.name || user?.username}
                size="xl"
              />
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <span className="absolute -bottom-1 -right-1 p-2 bg-[#047857] text-white rounded-full shadow-md">
                <Camera className="w-4 h-4" />
              </span>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <div className="text-center sm:text-left">
              <h3 className="font-bold text-[#022c22] text-base">{user?.name}</h3>
              <p className="text-xs text-gray-500">@{user?.username}</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 text-xs font-bold text-[#047857] hover:underline cursor-pointer"
              >
                Change Avatar Image
              </button>
            </div>
          </div>

          {/* Name & Username */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 bg-emerald-50/50 rounded-2xl border border-emerald-200 text-sm font-semibold text-[#022c22] focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1.5">
                Username (Read-only)
              </label>
              <input
                type="text"
                value={`@${user?.username || ''}`}
                disabled
                className="w-full px-4 py-3 bg-gray-100 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1.5">
                Bio / Personal Sankalp
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="What is your main daily goal?"
                className="w-full px-4 py-3 bg-emerald-50/50 rounded-2xl border border-emerald-200 text-sm font-semibold text-[#022c22] focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:bg-white transition-all resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={logout}
              className="px-4 py-2.5 rounded-2xl bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-600" />
              Sign Out
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 rounded-2xl bg-[#047857] hover:bg-[#065f46] text-white font-bold text-xs shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-60 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
