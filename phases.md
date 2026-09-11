# Project Roadmap & Execution Phases

This project is divided into **4 distinct, iterative phases** to ensure high visual quality, modular architecture, real-time reliability, and user satisfaction at every step.

---

## 📋 Phase Summary

| Phase | Focus Area | Key Deliverables | Status |
|---|---|---|---|
| **Phase 1** | **Foundation, Auth & App Shell** | Modular Express backend, JWT auth, Multer upload, Socket.io base, Theme system (`:root` colors), Animated Bottom Dock & Top Navbar with Avatar dropdown | ✅ Completed |
| **Phase 2** | **Habit Engine & 5 Habit Types** | Habit CRUD, Habit creation modal (Icons, Frequency, 5 Types: Checkbox, Time, Stopwatch, Count, Yes/No), Daily habit logger, Streak tracker & animations | ✅ Completed |
| **Phase 3** | **Social Groups & Shareable Invites** | Group creation with DP, Join Code & Shareable Link system (`/join/:code`), Group habit publishing to member dashboards, Admin member management | ✅ Completed |
| **Phase 4** | **Real-Time Matrix Board, WebSockets & 24h Notifications** | Socket.io live updates, Green/Red member avatar grid per task, Group completion ratios & analytics, 24h auto-expiring notification feed, Mobile/Desktop polish | ✅ Completed |

---

## 🔍 Detailed Breakdown

### 🌟 Phase 1: Architecture, Backend Foundation & Responsive Shell
- **Backend**:
  - Express.js with feature-based modular folder structure (`modules/auth`, `modules/habits`, `modules/groups`, `modules/notifications`).
  - JWT Authentication (Register, Login, Me, Token Refresh/Verification).
  - Multer image handler with Cloudinary integration & local fallback storage for instant zero-config running.
  - Socket.io server initialization and connection handlers.
- **Frontend**:
  - CSS design tokens in `index.css` matching exact specified palette (`--header`, `--navigation`, `--background`, `--body`, `--footer`, `--text`, `--accent`, `--border`).
  - Zustand auth store with localStorage persistence & TanStack Query client.
  - React Router DOM routes (`/login`, `/register`, `/`, `/social`, `/social/group/:id`, `/join/:code`, `/settings`).
  - Mobile-first App Shell:
    - **Top Navbar**: "Habit" logo, Notification Bell with badge, User Avatar with dropdown (Settings & Logout).
    - **Bottom Navigation Bar**: Floating animated dock where active tab scales up with smooth fluid highlight and micro-animations.

### 🌟 Phase 2: Personal Habit Engine & All 5 Tracking Types
- **Backend**: Habit schema & REST endpoints for creating, editing, reordering, and daily logging.
- **Frontend**:
  - Floating Action Button (+) / Modal to create habit.
  - Icon Picker with categorization and color selections.
  - Frequency Selector (Daily, Weekdays, Weekends, Alternate days, Custom intervals).
  - 5 Habit Types:
    1. **Done / Not Done**: Toggle / Checkbox with burst particle celebration.
    2. **Time Target**: Target duration (e.g. 2:00 hrs) with progress ring.
    3. **Stopwatch / Timer**: Interactive live stopwatch with start/pause/stop and auto-log.
    4. **Count Target**: Increment/decrement stepper (e.g. 10/20 glasses/reps).
    5. **Yes / No**: Question-style confirmation logger.
  - Main Dashboard: Date selector (Today, Past days), filtering, completion streaks.

### 🌟 Phase 3: Social Groups, Join Links & Admin Capabilities
- **Backend**: Group schemas, member roles (Admin / Member), invite token generation, join endpoints.
- **Frontend**:
  - Social Tab UI: Group cards, "Create Group" modal with DP upload.
  - Share link generation (`/join/:code`) with one-click copy and direct URL join flow.
  - Group habit creation (Group tasks automatically display on all member's main habit screen with a Group badge).
  - Admin controls: View member list, view activity, kick inactive members.

### 🌟 Phase 4: Real-time Social Progress Matrix, WebSockets & 24h Notifications
- **WebSockets**:
  - Socket.io room per group (`group:<id>`).
  - Broadcast task completions immediately across connected group members.
- **Live Social Matrix**:
  - Task row display (e.g., "Savarni Katha").
  - Member avatar row below each task:
    - **Green badge/ring**: Completed today.
    - **Red badge/ring**: Incomplete / Pending today.
  - Real-time updates without page refresh.
- **Group Analytics & Ratios**:
  - Overall completion percentage, top consistent members, group compliance streaks.
- **24-Hour Notifications**:
  - Broadcast notification whenever a member completes a task.
  - Notification drawer with auto-filter for notifications older than 24 hours.
- **Performance & UI Lag Prevention**:
  - Memoized matrix components, optimistic UI updates, responsive testing across Mobile, Tablet, and Desktop viewports.

---

## 🔄 Execution Workflow
Each phase will be implemented, verified with live testing, demonstrated to the user, and upon satisfaction, proceed to the subsequent phase.
