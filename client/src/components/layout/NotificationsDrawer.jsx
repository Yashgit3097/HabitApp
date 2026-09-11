import React, { useEffect } from 'react';
import { X, CheckCircle2, Clock, Trash2, BellOff } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { Avatar } from '../common/Avatar';

export const NotificationsDrawer = () => {
  const {
    notifications,
    isNotificationDrawerOpen,
    closeNotificationDrawer,
    markNotificationsRead,
    clearOldNotifications
  } = useUIStore();

  useEffect(() => {
    // Automatically purge notifications older than 24 hours on open
    clearOldNotifications();
  }, [clearOldNotifications]);

  if (!isNotificationDrawerOpen) return null;

  const formatTimeAgo = (dateString) => {
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-emerald-950/40 backdrop-blur-xs transition-opacity"
        onClick={closeNotificationDrawer}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-emerald-100">
          {/* Drawer Header */}
          <div className="p-4 bg-[#065f46] text-white flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#10b981]" />
              <h2 className="font-bold text-lg tracking-tight">Recent Activity</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-700 text-emerald-200 font-medium">
                Last 24h
              </span>
            </div>
            <button
              onClick={closeNotificationDrawer}
              className="p-1 rounded-lg hover:bg-emerald-700 text-emerald-200 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Subheader action bar */}
          <div className="px-4 py-2 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between text-xs text-emerald-800">
            <span>Real-time task completions from your groups</span>
            {notifications.length > 0 && (
              <button
                onClick={markNotificationsRead}
                className="font-semibold text-[#047857] hover:underline cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {notifications.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-emerald-800/60">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                  <BellOff className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="font-bold text-emerald-900 text-base">No completed tasks yet today</p>
                <p className="text-xs text-emerald-700 mt-1 max-w-xs">
                  When you or your group members complete habits, live updates will appear here automatically and clear after 24 hours.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 rounded-2xl border transition-all duration-200 flex items-start gap-3 ${
                    n.read
                      ? 'bg-emerald-50/30 border-emerald-100/60 opacity-90'
                      : 'bg-emerald-50/90 border-emerald-200 shadow-xs'
                  }`}
                >
                  <Avatar
                    src={n.userAvatar}
                    name={n.userName || 'Member'}
                    size="sm"
                    status="completed"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#022c22]">
                      <span className="font-bold text-[#047857]">{n.userName || 'A member'}</span> completed{' '}
                      <span className="text-emerald-950 font-bold bg-emerald-200/60 px-1.5 py-0.5 rounded">
                        {n.habitTitle || 'their habit'}
                      </span>
                    </p>
                    {n.groupName && (
                      <p className="text-xs text-emerald-700 font-medium mt-0.5">
                        Group: {n.groupName}
                      </p>
                    )}
                    <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-1">
                      <Clock className="w-3 h-3 text-emerald-600" />
                      <span>{formatTimeAgo(n.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
