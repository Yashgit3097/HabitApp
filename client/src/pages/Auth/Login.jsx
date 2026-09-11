import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, LogIn, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export const Login = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    const res = await login(username, password);
    if (res.success) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#ecfdf5] flex flex-col justify-center items-center p-4 sm:p-6">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#10b981] to-[#047857] text-white shadow-xl mb-4 transform hover:rotate-6 transition-transform">
          <Sparkles className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-black text-[#022c22] tracking-tight">
          Welcome to <span className="text-[#047857]">Habit</span>
        </h1>
        <p className="text-sm font-medium text-emerald-800/80 mt-1 max-w-xs mx-auto">
          Build unbreakable habits with your friends through shared accountability.
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-emerald-100/80">
        <div className="flex items-center gap-2 mb-6 pb-3 border-b border-emerald-50">
          <LogIn className="w-5 h-5 text-[#047857]" />
          <h2 className="text-xl font-bold text-[#022c22]">Sign In</h2>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="e.g. yash"
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
                <span>Sign In to Habit</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Switch to Register */}
        <div className="mt-6 text-center">
          <p className="text-xs font-semibold text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#047857] font-bold hover:underline">
              Create one now
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
