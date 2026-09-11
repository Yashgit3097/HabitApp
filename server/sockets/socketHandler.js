import { collections } from '../config/db.js';

export const initSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected to socket: ${socket.id}`);

    // User connects with their user ID
    socket.on('join_user', async (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`👤 User ${userId} joined room user:${userId}`);

        // Automatically join all group rooms the user belongs to for real-time notifications
        try {
          const allGroups = await collections.groups.find();
          const userGroups = allGroups.filter((g) =>
            g.members && g.members.some((m) => (m.userId || m.userId?.toString()) === (userId || userId?.toString()))
          );
          userGroups.forEach((g) => {
            const gId = (g.id || g._id).toString();
            socket.join(`group:${gId}`);
            console.log(`👥 Auto-joined socket ${socket.id} to group room: group:${gId}`);
          });
        } catch (err) {
          console.error('Error auto-joining user groups on socket:', err);
        }
      }
    });

    // Join a group room
    socket.on('join_group', (groupId) => {
      if (groupId) {
        socket.join(`group:${groupId}`);
        console.log(`👥 Socket ${socket.id} joined group room: group:${groupId}`);
      }
    });

    // Leave a group room
    socket.on('leave_group', (groupId) => {
      if (groupId) {
        socket.leave(`group:${groupId}`);
        console.log(`🚪 Socket ${socket.id} left group room: group:${groupId}`);
      }
    });

    // When a new group task is created
    socket.on('create_group_task', (data) => {
      if (data && data.groupId) {
        console.log(`📝 Group task created in room group:${data.groupId}:`, data.title);
        socket.to(`group:${data.groupId}`).emit('group_task_created', data);
        socket.to(`group:${data.groupId}`).emit('group_habit_updated', data);
      }
    });

    // When a habit status is toggled/completed
    socket.on('habit_progress_update', (data) => {
      // Broadcast to group if it's a group habit
      if (data.groupId) {
        socket.to(`group:${data.groupId}`).emit('group_habit_updated', data);
      }
      // Broadcast completed task notification to group members
      if (data.isCompleted && data.groupId) {
        socket.to(`group:${data.groupId}`).emit('task_completed_notification', {
          id: Math.random().toString(36).substring(2, 9),
          userName: data.userName,
          userAvatar: data.userAvatar,
          habitTitle: data.habitTitle,
          groupId: data.groupId,
          groupName: data.groupName,
          timestamp: new Date().toISOString()
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });
};
