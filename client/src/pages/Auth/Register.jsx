import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, UserPlus, Lock, User, Camera, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export const Register = () => {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('Building positive habits every day 🚀');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');

  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !username || !password) return;

    const formData = new FormData();
    formData.append('name', name);
    formData.append('username', username);
    formData.append('password', password);
    formData.append('bio', bio);
    if (avatarFile) {
      formData.append('avatar', avatarFile);
    }

    const res = await register(formData);
    if (res.success) {
      navigate('/');
    }
  };

  const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
    username || 'user'
  )}`;

  return (
    <div className="min-h-screen bg-[#ecfdf5] flex flex-col justify-center items-center p-4 sm:p-6 py-10">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#10b981] to-[#047857] text-white shadow-xl mb-3">
          <Sparkles className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#022c22] tracking-tight">
          Create Your <span className="text-[#047857]">Habit</span> Account
        </h1>
        <p className="text-xs sm:text-sm font-medium text-emerald-800/80 mt-1 max-w-xs mx-auto">
          Track personal goals and join groups with friends.
        </p>
      </div>

      {/* Register Card */}
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-emerald-100/80">
        <div className="flex items-center gap-2 mb-6 pb-3 border-b border-emerald-50">
          <UserPlus className="w-5 h-5 text-[#047857]" />
          <h2 className="text-xl font-bold text-[#022c22]">Get Started</h2>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar Upload Preview */}
          <div className="flex flex-col items-center justify-center pb-2">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-emerald-200 ring-offset-2 ring-offset-white shadow-md bg-emerald-50 flex items-center justify-center">
                <img
                  src={avatarPreview || defaultAvatar}
                  alt="Avatar preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <span className="absolute -bottom-1 -right-1 p-1.5 bg-[#047857] text-white rounded-full shadow-md">
                <Camera className="w-3.5 h-3.5" />
              </span>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <p className="text-[11px] text-emerald-800 font-semibold mt-2">
              Upload Profile Picture (Optional)
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearError();
              }}
              required
              placeholder="e.g. Yash Patel"
              className="w-full px-4 py-3 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 text-sm font-semibold text-[#022c22] focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600/70" />
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  clearError();
                }}
                required
                placeholder="e.g. yashpatel"
                className="w-full pl-11 pr-4 py-3 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 text-sm font-semibold text-[#022c22] focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600/70" />
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError();
                }}
                required
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 text-sm font-semibold text-[#022c22] focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:bg-white transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-[#047857] to-[#10b981] text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:from-[#065f46] hover:to-[#059669] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Switch to Login */}
        <div className="mt-6 text-center">
          <p className="text-xs font-semibold text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-[#047857] font-bold hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
