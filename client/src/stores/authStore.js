import { create } from 'zustand';
import api from '../api/client';
import { getSocket } from '../api/socket';

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('habit_user') || 'null'),
  token: localStorage.getItem('habit_token') || null,
  isAuthenticated: !!localStorage.getItem('habit_token'),
  isLoading: false,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/login', { username, password });
      const { user, token } = response.data.data;
      
      localStorage.setItem('habit_token', token);
      localStorage.setItem('habit_user', JSON.stringify(user));

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });

      // Connect user to socket room
      const socket = getSocket();
      socket.emit('join_user', user.id || user._id);

      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please check credentials.';
      set({ isLoading: false, error: msg });
      return { success: false, message: msg };
    }
  },

  register: async (formData) => {
    set({ isLoading: true, error: null });
    try {
      // Supports FormData for avatar file upload
      const response = await api.post('/auth/register', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const { user, token } = response.data.data;

      localStorage.setItem('habit_token', token);
      localStorage.setItem('habit_user', JSON.stringify(user));

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });

      // Connect user to socket room
      const socket = getSocket();
      socket.emit('join_user', user.id || user._id);

      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed.';
      set({ isLoading: false, error: msg });
      return { success: false, message: msg };
    }
  },

  updateProfile: async (formData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put('/auth/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const updatedUser = response.data.data;
      localStorage.setItem('habit_user', JSON.stringify(updatedUser));
      set({ user: updatedUser, isLoading: false });
      return { success: true, message: 'Profile updated successfully' };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update profile';
      set({ isLoading: false, error: msg });
      return { success: false, message: msg };
    }
  },

  fetchMe: async () => {
    if (!get().token) return;
    try {
      const response = await api.get('/auth/me');
      const user = response.data.data;
      localStorage.setItem('habit_user', JSON.stringify(user));
      set({ user, isAuthenticated: true });
    } catch (err) {
      if (err.response?.status === 401) {
        get().logout();
      }
    }
  },

  logout: () => {
    localStorage.removeItem('habit_token');
    localStorage.removeItem('habit_user');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null
    });
  },

  clearError: () => set({ error: null })
}));
