import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { TopNavbar } from './TopNavbar';
import { BottomNav } from './BottomNav';
import { NotificationsDrawer } from './NotificationsDrawer';
import { PWAInstallPrompt } from '../common/PWAInstallPrompt';
import { getSocket } from '../../api/socket';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';

export const AppLayout = () => {
  const { user } = useAuthStore();
  const { addNotification } = useUIStore();
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    if (user && (user.id || user._id)) {
      socket.emit('join_user', user.id || user._id);
    }

    // Handle completed notification broadcast
    const handleNotification = (data) => {
      console.log('🔔 Received task completion notification:', data);
      addNotification(data);
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['groupDetails'] });
    };

    // Handle real-time group task created / habit updated sync
    const handleHabitsSync = (data) => {
      console.log('⚡ Real-time habit update received on socket:', data);
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['userGroups'] });
      queryClient.invalidateQueries({ queryKey: ['groupDetails'] });
    };

    socket.on('task_completed_notification', handleNotification);
    socket.on('user_habits_updated', handleHabitsSync);
    socket.on('group_task_created', handleHabitsSync);
    socket.on('group_habit_updated', handleHabitsSync);
    socket.on('member_joined', handleHabitsSync);
    socket.on('member_removed', handleHabitsSync);

    return () => {
      socket.off('task_completed_notification', handleNotification);
      socket.off('user_habits_updated', handleHabitsSync);
      socket.off('group_task_created', handleHabitsSync);
      socket.off('group_habit_updated', handleHabitsSync);
      socket.off('member_joined', handleHabitsSync);
      socket.off('member_removed', handleHabitsSync);
    };
  }, [user, addNotification, queryClient]);

  return (
    <div className="min-h-screen flex flex-col bg-[#ecfdf5] text-[#022c22]">
      {/* Top Navbar */}
      <TopNavbar />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 pb-28 sm:p-6 sm:pb-32">
        <Outlet />
      </main>

      {/* Floating PWA Install Prompt */}
      <PWAInstallPrompt />

      {/* Slide-out Notifications Drawer */}
      <NotificationsDrawer />

      {/* Animated Bottom Dock */}
      <BottomNav />
    </div>
  );
};
