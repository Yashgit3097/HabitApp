import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Users, Plus, BarChart3, Settings } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { openCreateHabit } = useUIStore();

  const currentPath = location.pathname;

  const tabs = [
    {
      id: 'habits',
      label: 'My Habits',
      path: '/',
      icon: CheckCircle2
    },
    {
      id: 'social',
      label: 'Groups',
      path: '/social',
      icon: Users
    },
    {
      id: 'create',
      label: 'New Habit',
      isAction: true,
      action: openCreateHabit,
      icon: Plus
    },
    {
      id: 'analytics',
      label: 'Insights',
      path: '/analytics',
      icon: BarChart3
    },
    {
      id: 'settings',
      label: 'Account',
      path: '/settings',
      icon: Settings
    }
  ];

  const isActiveTab = (tab) => {
    if (tab.isAction) return false;
    if (tab.path === '/') return currentPath === '/';
    return currentPath.startsWith(tab.path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 p-3 sm:p-4 pointer-events-none flex justify-center">
      <div className="pointer-events-auto floating-nav-dock rounded-3xl sm:rounded-full px-3 py-2 sm:px-4 sm:py-2.5 flex items-center justify-between sm:justify-around gap-1 sm:gap-4 max-w-lg w-full transition-all duration-300">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActiveTab(tab);

          if (tab.isAction) {
            return (
              <motion.button
                key={tab.id}
                id="create-habit-fab-btn"
                onClick={tab.action}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="relative -top-5 sm:-top-6 flex items-center justify-center p-3.5 sm:p-4 rounded-full bg-gradient-to-tr from-[#10b981] to-[#047857] text-white shadow-[0_8px_20px_-4px_rgba(6,95,70,0.4)] ring-4 ring-[#ecfdf5] cursor-pointer select-none"
                aria-label="Create New Habit"
              >
                <Plus className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5]" />
              </motion.button>
            );
          }

          return (
            <motion.button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              whileHover={{ scale: active ? 1.12 : 1.06 }}
              whileTap={{ scale: 0.95 }}
              animate={active ? { scale: 1.1, y: -2 } : { scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 450, damping: 25 }}
              className="relative flex flex-col items-center justify-center px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl cursor-pointer select-none min-w-[62px]"
            >
              {/* Smooth Gliding Active Pill Indicator */}
              {active && (
                <motion.div
                  layoutId="activeTabGlider"
                  className="absolute inset-0 bg-white/20 rounded-2xl border border-white/25 shadow-[inset_0_1px_2px_rgba(255,255,255,0.3)] -z-10"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              {/* Active Tab Glow */}
              {active && (
                <motion.div
                  layoutId="activeTabGlow"
                  className="absolute -bottom-1 w-6 h-1.5 bg-[#10b981] rounded-full blur-[2px]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              <Icon
                className={`transition-colors duration-200 ${
                  active
                    ? 'w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.4)]'
                    : 'w-5 h-5 text-emerald-200/60 hover:text-emerald-100'
                }`}
              />
              <span
                className={`text-[10px] sm:text-[11px] mt-1 font-semibold tracking-tight transition-all duration-200 whitespace-nowrap ${
                  active ? 'text-white font-extrabold opacity-100' : 'text-emerald-200/70 font-medium opacity-80'
                }`}
              >
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};
