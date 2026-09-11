import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { collections, connectDB } from '../config/db.js';

dotenv.config();

const syncMemberAvatars = async () => {
  try {
    console.log('🔄 Starting sync of member avatars from users to groups...');
    await connectDB();

    const allUsers = await collections.users.find();
    const allGroups = await collections.groups.find();

    console.log(`👥 Found ${allUsers.length} users and ${allGroups.length} groups.`);

    let updatedGroupsCount = 0;

    for (const group of allGroups) {
      if (!group.members || !Array.isArray(group.members)) continue;

      let changed = false;
      const updatedMembers = group.members.map((m) => {
        const memberUserId = (m.userId || m.id || m._id)?.toString();
        const user = allUsers.find(
          (u) => (u.id || u._id)?.toString() === memberUserId
        );

        if (user && user.avatar && user.avatar !== m.avatar) {
          console.log(`✨ Updating member ${m.name} avatar in group "${group.name}" -> ${user.avatar}`);
          changed = true;
          return {
            ...m,
            userId: memberUserId,
            name: user.name || m.name,
            username: user.username || m.username,
            avatar: user.avatar
          };
        }
        return m;
      });

      if (changed) {
        await collections.groups.updateOne(
          { id: group.id || group._id },
          { members: updatedMembers }
        );
        updatedGroupsCount++;
      }
    }

    console.log(`🎉 Finished avatar sync! Updated ${updatedGroupsCount} groups.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error syncing avatars:', err);
    process.exit(1);
  }
};

syncMemberAvatars();
