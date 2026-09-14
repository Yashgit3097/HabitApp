import { io } from 'socket.io-client';

let socket = null;

// Render backend URL directly configured
const BACKEND_URL = 'https://habitapp-al74.onrender.com';

export const getSocket = () => {
  if (!socket) {
    socket = io(BACKEND_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('⚡ Socket connected to server:', socket.id);
      const user = JSON.parse(localStorage.getItem('habit_user') || 'null');
      if (user && (user.id || user._id)) {
        socket.emit('join_user', user.id || user._id);
      }
    });

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
    });
  }

  return socket;
};

export const joinGroupRoom = (groupId) => {
  const s = getSocket();
  if (s && groupId) {
    s.emit('join_group', groupId);
  }
};

export const leaveGroupRoom = (groupId) => {
  const s = getSocket();
  if (s && groupId) {
    s.emit('leave_group', groupId);
  }
};

export const emitHabitUpdate = (data) => {
  const s = getSocket();
  if (s) {
    s.emit('habit_progress_update', data);
  }
};
