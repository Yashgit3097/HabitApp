import { create } from 'zustand';

export const useUIStore = create((set, get) => ({
  activeTab: 'habits', // 'habits', 'social', 'analytics', 'settings'
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Modals
  isCreateHabitOpen: false,
  openCreateHabit: () => set({ isCreateHabitOpen: true }),
  closeCreateHabit: () => set({ isCreateHabitOpen: false }),

  isCreateGroupOpen: false,
  openCreateGroup: () => set({ isCreateGroupOpen: true }),
  closeCreateGroup: () => set({ isCreateGroupOpen: false }),

  // Notifications Drawer
  isNotificationDrawerOpen: false,
  openNotificationDrawer: () => set({ isNotificationDrawerOpen: true }),
  closeNotificationDrawer: () => set({ isNotificationDrawerOpen: false }),
  toggleNotificationDrawer: () => set((state) => ({ isNotificationDrawerOpen: !state.isNotificationDrawerOpen })),

  // Live Notifications (Filtered strictly to 24h)
  notifications: JSON.parse(localStorage.getItem('habit_notifications') || '[]'),

  addNotification: (notification) => {
    const current = get().notifications;
    const newNotification = {
      id: notification.id || Math.random().toString(36).substring(2, 9),
      title: notification.title || 'Task Completed',
      message: notification.message || `${notification.userName || 'Someone'} completed ${notification.habitTitle || 'a task'}!`,
      userName: notification.userName,
      userAvatar: notification.userAvatar,
      habitTitle: notification.habitTitle,
      groupName: notification.groupName,
      timestamp: notification.timestamp || new Date().toISOString(),
      read: false
    };

    // Filter out notifications older than 24 hours
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const updated = [newNotification, ...current].filter(
      (n) => new Date(n.timestamp).getTime() > twentyFourHoursAgo
    );

    localStorage.setItem('habit_notifications', JSON.stringify(updated));
    set({ notifications: updated });
  },

  markNotificationsRead: () => {
    const updated = get().notifications.map((n) => ({ ...n, read: true }));
    localStorage.setItem('habit_notifications', JSON.stringify(updated));
    set({ notifications: updated });
  },

  clearOldNotifications: () => {
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const updated = get().notifications.filter(
      (n) => new Date(n.timestamp).getTime() > twentyFourHoursAgo
    );
    localStorage.setItem('habit_notifications', JSON.stringify(updated));
    set({ notifications: updated });
  }
}));
