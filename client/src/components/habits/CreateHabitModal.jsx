import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CheckCircle2,
  Clock,
  Timer,
  Hash,
  HelpCircle,
  Sparkles,
  Flame,
  BookOpen,
  Dumbbell,
  Heart,
  Droplet,
  Brain,
  Coffee,
  Moon,
  Sun,
  Target,
  Trophy,
  Smile,
  Music,
  Shield,
  Footprints,
  Utensils,
  Zap,
  Repeat
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import api from '../../api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../../api/socket';

const AVAILABLE_ICONS = [
  { id: 'CheckCircle2', component: CheckCircle2, label: 'Check' },
  { id: 'Flame', component: Flame, label: 'Fire' },
  { id: 'Sparkles', component: Sparkles, label: 'Sankalp' },
  { id: 'BookOpen', component: BookOpen, label: 'Reading' },
  { id: 'Dumbbell', component: Dumbbell, label: 'Workout' },
  { id: 'Heart', component: Heart, label: 'Health' },
  { id: 'Droplet', component: Droplet, label: 'Water' },
  { id: 'Brain', component: Brain, label: 'Meditation' },
  { id: 'Clock', component: Clock, label: 'Time' },
  { id: 'Coffee', component: Coffee, label: 'Morning' },
  { id: 'Moon', component: Moon, label: 'Sleep' },
  { id: 'Sun', component: Sun, label: 'Sunlight' },
  { id: 'Target', component: Target, label: 'Focus' },
  { id: 'Trophy', component: Trophy, label: 'Victory' },
  { id: 'Smile', component: Smile, label: 'Gratitude' },
  { id: 'Music', component: Music, label: 'Katha / Music' },
  { id: 'Shield', component: Shield, label: 'Discipline' },
  { id: 'Footprints', component: Footprints, label: 'Walking' },
  { id: 'Utensils', component: Utensils, label: 'Diet / Fast' },
  { id: 'Zap', component: Zap, label: 'Energy' }
];

const AVAILABLE_COLORS = [
  { id: 'emerald', hex: '#10b981', label: 'Emerald' },
  { id: 'forest', hex: '#047857', label: 'Forest' },
  { id: 'cyan', hex: '#06b6d4', label: 'Cyan' },
  { id: 'blue', hex: '#3b82f6', label: 'Blue' },
  { id: 'violet', hex: '#8b5cf6', label: 'Violet' },
  { id: 'rose', hex: '#f43f5e', label: 'Rose' },
  { id: 'amber', hex: '#f59e0b', label: 'Amber' },
  { id: 'indigo', hex: '#6366f1', label: 'Indigo' }
];

const HABIT_TYPES = [
  {
    id: 'boolean',
    title: 'Done / Not Done',
    description: 'Simple check-off toggle with celebration burst',
    icon: CheckCircle2
  },
  {
    id: 'time_target',
    title: 'Target Time (e.g. 2:00)',
    description: 'Set a daily duration goal (hours & minutes)',
    icon: Clock
  },
  {
    id: 'timer',
    title: 'Stopwatch / Timer',
    description: 'Start watch, pause, stop & log live elapsed time',
    icon: Timer
  },
  {
    id: 'count',
    title: 'Numeric Count (10, 20...)',
    description: 'Track reps, glasses, steps, or custom units',
    icon: Hash
  },
  {
    id: 'yes_no',
    title: 'Yes / No Question',
    description: 'Daily reflection or affirmation question',
    icon: HelpCircle
  }
];

const FREQUENCIES = [
  { id: 'daily', label: 'Every Day' },
  { id: 'alternate', label: 'Alternate Days (Day after day)' },
  { id: 'weekdays', label: 'Weekdays (Mon-Fri)' },
  { id: 'weekends', label: 'Weekends (Sat-Sun)' }
];

import { useAuthStore } from '../../stores/authStore';

export const CreateHabitModal = () => {
  const { isCreateHabitOpen, closeCreateHabit } = useUIStore();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('Sparkles');
  const [color, setColor] = useState('#10b981');
  const [frequency, setFrequency] = useState('daily');
  const [type, setType] = useState('boolean');
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const currentUserId = user?.id || user?._id;

  // Fetch user groups to offer group assignment (only groups where user is Admin)
  const { data: allUserGroups = [] } = useQuery({
    queryKey: ['userGroups'],
    queryFn: async () => {
      const res = await api.get('/groups');
      return res.data?.data || [];
    },
    enabled: isCreateHabitOpen
  });

  const adminGroups = allUserGroups.filter((g) => g.adminId === currentUserId);

  // Specific type configurations
  const [targetHours, setTargetHours] = useState('1');
  const [targetMinutes, setTargetMinutes] = useState('0');
  const [countTarget, setCountTarget] = useState('10');
  const [countUnit, setCountUnit] = useState('reps');
  const [questionText, setQuestionText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const createMutation = useMutation({
    mutationFn: async (habitData) => {
      const response = await api.post('/habits', habitData);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['groupDetails'] });

      // Emit real-time WebSocket event
      if (data?.data?.groupId) {
        const socket = getSocket();
        socket.emit('create_group_task', data.data);
      }

      resetForm();
      closeCreateHabit();
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.message || 'Failed to create habit');
    }
  });

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setIcon('Sparkles');
    setColor('#10b981');
    setFrequency('daily');
    setType('boolean');
    setSelectedGroupId('');
    setTargetHours('1');
    setTargetMinutes('0');
    setCountTarget('10');
    setCountUnit('reps');
    setQuestionText('');
    setErrorMsg('');
  };

  if (!isCreateHabitOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please enter a habit title');
      return;
    }

    let targetValue = 1;
    let targetUnit = '';

    if (type === 'time_target') {
      const totalMins = parseInt(targetHours || '0', 10) * 60 + parseInt(targetMinutes || '0', 10);
      targetValue = totalMins || 60;
      targetUnit = 'mins';
    } else if (type === 'count') {
      targetValue = parseInt(countTarget || '1', 10);
      targetUnit = countUnit.trim() || 'units';
    } else if (type === 'timer') {
      targetValue = parseInt(targetMinutes || '30', 10);
      targetUnit = 'mins';
    }

    const matchedGroup = allUserGroups.find((g) => (g.id || g._id) === selectedGroupId);

    createMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      icon,
      color,
      frequency,
      type,
      targetValue,
      targetUnit,
      groupId: selectedGroupId || null,
      groupName: matchedGroup ? matchedGroup.name : '',
      question: questionText.trim() || (type === 'yes_no' ? `Did you do ${title.trim()} today?` : '')
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-emerald-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-emerald-100 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#065f46] text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/30 flex items-center justify-center border border-emerald-400/40">
              <Sparkles className="w-4 h-4 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Create Habit / Sankalp</h2>
              <p className="text-[11px] text-emerald-200/80 font-medium">Personal Discipline Goal</p>
            </div>
          </div>
          <button
            onClick={() => {
              resetForm();
              closeCreateHabit();
            }}
            className="p-1.5 rounded-xl hover:bg-emerald-700/80 text-emerald-200 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold">
              {errorMsg}
            </div>
          )}

          {/* Title & Description */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-950 mb-1.5">
                Habit Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setErrorMsg('');
                }}
                required
                placeholder="e.g. Savarni Katha, Morning Yoga, Drink 3L Water"
                className="w-full px-4 py-3 bg-emerald-50/60 rounded-2xl border border-emerald-200 text-sm font-semibold text-[#022c22] focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:bg-white transition-all"
              />
            </div>

            {adminGroups.length > 0 && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-emerald-950 mb-1.5">
                  Assign to Sankalp Group (Admin Only)
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-emerald-50/60 rounded-2xl border border-emerald-200 text-xs font-bold text-[#022c22] focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:bg-white transition-all"
                >
                  <option value="">Personal Habit (Only for me)</option>
                  {adminGroups.map((g) => (
                    <option key={g.id || g._id} value={g.id || g._id}>
                      Group: {g.name} (Admin)
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 font-semibold mt-1">
                  As group admin, this habit will automatically appear on the main dashboard for all group members!
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-950 mb-1.5">
                Short Description / Motivation (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Build mental clarity and focus every morning"
                className="w-full px-4 py-2.5 bg-emerald-50/40 rounded-2xl border border-emerald-100 text-xs font-medium text-[#022c22] focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Habit Type Selection (5 Types) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-950 mb-2">
              Habit Tracking Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {HABIT_TYPES.map((t) => {
                const IconComponent = t.icon;
                const isSelected = type === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setType(t.id)}
                    className={`p-3 rounded-2xl border text-left transition-all duration-200 flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 border-[#10b981] ring-2 ring-[#10b981]/40 shadow-xs'
                        : 'bg-white border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        isSelected ? 'bg-[#047857] text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-[#022c22] leading-tight">{t.title}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{t.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Configuration per Habit Type */}
          {type === 'time_target' && (
            <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#047857]">
                Set Daily Duration Target
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <span className="text-[11px] text-gray-500 font-semibold block mb-1">Hours</span>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={targetHours}
                    onChange={(e) => setTargetHours(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-xl border border-emerald-200 text-sm font-bold text-[#022c22]"
                  />
                </div>
                <span className="text-lg font-bold text-gray-400 mt-4">:</span>
                <div className="flex-1">
                  <span className="text-[11px] text-gray-500 font-semibold block mb-1">Minutes</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    step="5"
                    value={targetMinutes}
                    onChange={(e) => setTargetMinutes(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-xl border border-emerald-200 text-sm font-bold text-[#022c22]"
                  />
                </div>
              </div>
            </div>
          )}

          {type === 'count' && (
            <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#047857]">
                Set Numeric Goal Target
              </label>
              <div className="flex items-center gap-3">
                <div className="w-1/2">
                  <span className="text-[11px] text-gray-500 font-semibold block mb-1">Target Count</span>
                  <input
                    type="number"
                    min="1"
                    value={countTarget}
                    onChange={(e) => setCountTarget(e.target.value)}
                    placeholder="e.g. 10, 20"
                    className="w-full px-3 py-2 bg-white rounded-xl border border-emerald-200 text-sm font-bold text-[#022c22]"
                  />
                </div>
                <div className="w-1/2">
                  <span className="text-[11px] text-gray-500 font-semibold block mb-1">Unit Name</span>
                  <input
                    type="text"
                    value={countUnit}
                    onChange={(e) => setCountUnit(e.target.value)}
                    placeholder="e.g. reps, glasses, pages"
                    className="w-full px-3 py-2 bg-white rounded-xl border border-emerald-200 text-sm font-bold text-[#022c22]"
                  />
                </div>
              </div>
            </div>
          )}

          {type === 'yes_no' && (
            <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#047857]">
                Custom Yes / No Question
              </label>
              <input
                type="text"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder={`e.g. Did you complete ${title || 'your meditation'} today?`}
                className="w-full px-3 py-2 bg-white rounded-xl border border-emerald-200 text-sm font-medium text-[#022c22]"
              />
            </div>
          )}

          {/* Frequency Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-950 mb-2">
              Frequency
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FREQUENCIES.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => setFrequency(f.id)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-center border cursor-pointer ${
                    frequency === f.id
                      ? 'bg-[#047857] text-white border-[#047857] shadow-xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Icon Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-950 mb-2">
              Select Icon
            </label>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 p-2.5 bg-gray-50/70 rounded-2xl border border-gray-200">
              {AVAILABLE_ICONS.map((item) => {
                const IconComp = item.component;
                const isSelected = icon === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setIcon(item.id)}
                    title={item.label}
                    className={`p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#047857] text-white ring-2 ring-emerald-400 shadow-sm scale-110'
                        : 'text-gray-600 hover:bg-white hover:text-emerald-800'
                    }`}
                  >
                    <IconComp className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Palette */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-950 mb-2">
              Habit Color Accent
            </label>
            <div className="flex items-center gap-2.5">
              {AVAILABLE_COLORS.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setColor(c.hex)}
                  title={c.label}
                  style={{ backgroundColor: c.hex }}
                  className={`w-7 h-7 rounded-full transition-transform cursor-pointer shadow-xs ${
                    color === c.hex ? 'ring-3 ring-emerald-950 ring-offset-2 scale-115' : 'hover:scale-105'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                resetForm();
                closeCreateHabit();
              }}
              className="px-5 py-2.5 rounded-2xl border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-6 py-2.5 rounded-2xl bg-[#047857] hover:bg-[#065f46] text-white font-bold text-xs shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-60 flex items-center gap-2"
            >
              {createMutation.isPending ? 'Saving...' : 'Save & Track Habit'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
