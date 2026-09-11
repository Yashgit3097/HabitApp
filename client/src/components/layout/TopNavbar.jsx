import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Settings, LogOut, Sparkles, User, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { Avatar } from '../common/Avatar';

export const TopNavbar = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { notifications, toggleNotificationDrawer, isNotificationDrawerOpen } = useUIStore();
  
  const [isAvatarDropdownOpen, setIsAvatarDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsAvatarDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setIsAvatarDropdownOpen(false);
    logout();
    navigate('/login');
  };

  const handleSettings = () => {
    setIsAvatarDropdownOpen(false);
    navigate('/settings');
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#065f46] text-white shadow-[0_4px_20px_-4px_rgba(6,95,70,0.4)] border-b border-[#047857]/70 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Name Logo */}
        <div 
          onClick={() => navigate('/')} 
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <img
            src="/logo.svg"
            alt="Habit Logo"
            className="w-10 h-10 rounded-2xl shadow-[0_4px_12px_rgba(6,95,70,0.35)] transform group-hover:scale-105 group-active:scale-95 transition-all"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white font-['Outfit']">
                Habit
              </h1>
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-800/90 text-emerald-200 border border-emerald-500/40 shadow-xs">
                Sankalp
              </span>
            </div>
            <p className="text-[11px] text-emerald-200/80 font-semibold leading-none hidden sm:block">
              Daily Discipline & Shared Accountability
            </p>
          </div>
        </div>

        {/* Right Section: Notifications & User Avatar */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Notifications Bell */}
          <button
            id="notification-bell-btn"
            onClick={toggleNotificationDrawer}
            className={`relative p-2.5 rounded-2xl transition-all duration-200 cursor-pointer ${
              isNotificationDrawerOpen
                ? 'bg-emerald-700 text-white shadow-inner ring-2 ring-[#10b981]/50'
                : 'bg-emerald-800/60 hover:bg-emerald-700/80 text-emerald-100 hover:text-white'
            }`}
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-rose-500 text-white text-xs font-black rounded-full flex items-center justify-center animate-pulse border-2 border-[#065f46] shadow-sm">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Avatar with Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              id="user-avatar-btn"
              onClick={() => setIsAvatarDropdownOpen(!isAvatarDropdownOpen)}
              className="flex items-center gap-2 p-0.5 rounded-full hover:ring-3 hover:ring-[#10b981] transition-all cursor-pointer focus:outline-none"
              aria-label="User menu"
            >
              <Avatar
                src={user?.avatar}
                name={user?.name || user?.username || 'Habit User'}
                size="sm"
              />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {isAvatarDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute right-0 mt-2.5 w-64 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-emerald-100 py-2.5 z-50 text-[#022c22]"
                >
                  {/* User Info Header */}
                  <div className="px-4 py-3 border-b border-emerald-50 bg-emerald-50/50 rounded-t-2xl flex items-center gap-3">
                    <Avatar
                      src={user?.avatar}
                      name={user?.name || user?.username || 'User'}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#022c22] truncate">
                        {user?.name || 'Habit User'}
                      </p>
                      <p className="text-xs text-emerald-700 font-semibold truncate">
                        @{user?.username || 'username'}
                      </p>
                    </div>
                  </div>

                  <div className="py-1.5 px-1.5">
                    <button
                      onClick={handleSettings}
                      className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-bold text-gray-700 hover:bg-emerald-50 hover:text-emerald-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-emerald-600" />
                      Settings & Profile
                    </button>

                    <div className="my-1 border-t border-gray-100" />

                    <button
                      onClick={handleLogout}
                      className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      Log Out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};
