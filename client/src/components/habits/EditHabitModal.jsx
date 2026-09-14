import React, { useState, useEffect } from 'react';
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
  Save,
  Pencil
} from 'lucide-react';
import api from '../../api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../../stores/uiStore';

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

const FREQUENCIES = [
  { id: 'daily', label: 'Every Day' },
  { id: 'alternate', label: 'Alternate Days' },
  { id: 'weekdays', label: 'Weekdays (Mon-Fri)' },
  { id: 'weekends', label: 'Weekends (Sat-Sun)' }
];

export const EditHabitModal = ({ habit, isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('Sparkles');
  const [color, setColor] = useState('#10b981');
  const [frequency, setFrequency] = useState('daily');
  const [targetValue, setTargetValue] = useState('1');
  const [targetUnit, setTargetUnit] = useState('');
  const [question, setQuestion] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (habit) {
      setTitle(habit.title || '');
      setDescription(habit.description || '');
      setIcon(habit.icon || 'Sparkles');
      setColor(habit.color || '#10b981');
      setFrequency(habit.frequency || 'daily');
      setTargetValue(habit.targetValue ? habit.targetValue.toString() : '1');
      setTargetUnit(habit.targetUnit || '');
      setQuestion(habit.question || '');
      setErrorMsg('');
    }
  }, [habit, isOpen]);

  const updateMutation = useMutation({
    mutationFn: async (updatedData) => {
      const habitId = habit.id || habit._id;
      const res = await api.put(`/habits/${habitId}`, updatedData);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['monthlyReport'] });
      queryClient.invalidateQueries({ queryKey: ['groupDetails'] });
      showToast('Habit updated successfully!', 'success');
      onClose();
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.message || 'Failed to update habit');
    }
  });

  if (!isOpen || !habit) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Habit title cannot be empty');
      return;
    }

    let parsedTarget = targetValue;
    if (habit.type === 'count' || habit.type === 'time_target' || habit.type === 'timer') {
      parsedTarget = Number(targetValue) || 1;
    }

    updateMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      icon,
      color,
      frequency,
      targetValue: parsedTarget,
      targetUnit: targetUnit.trim(),
      question: question.trim()
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-emerald-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-emerald-100 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#065f46] text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/30 flex items-center justify-center border border-emerald-400/40">
              <Pencil className="w-4 h-4 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Edit Habit / Task</h2>
              <p className="text-[11px] text-emerald-200/80 font-medium">
                {habit.groupId ? `Group Task (${habit.groupName || 'Group'})` : 'Personal Habit'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
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

          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-950 mb-1.5">
              Habit Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-emerald-50/60 rounded-2xl border border-emerald-200 text-sm font-semibold text-[#022c22] focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:bg-white"
            />
          </div>

          {/* Short Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-950 mb-1.5">
              Short Description / Motivation
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Build mental clarity and focus every morning"
              className="w-full px-4 py-2 bg-emerald-50/40 rounded-2xl border border-emerald-100 text-xs font-medium text-[#022c22] focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:bg-white"
            />
          </div>

          {/* Type Specific Target Adjustments */}
          {habit.type === 'count' && (
            <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#047857]">
                Target Count Goal
              </label>
              <div className="flex items-center gap-3">
                <div className="w-1/2">
                  <span className="text-[11px] text-gray-500 font-semibold block mb-1">Target Count</span>
                  <input
                    type="number"
                    min="1"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-xl border border-emerald-200 text-sm font-bold text-[#022c22]"
                  />
                </div>
                <div className="w-1/2">
                  <span className="text-[11px] text-gray-500 font-semibold block mb-1">Unit Name</span>
                  <input
                    type="text"
                    value={targetUnit}
                    onChange={(e) => setTargetUnit(e.target.value)}
                    placeholder="e.g. reps, glasses"
                    className="w-full px-3 py-2 bg-white rounded-xl border border-emerald-200 text-sm font-bold text-[#022c22]"
                  />
                </div>
              </div>
            </div>
          )}

          {habit.type === 'time_target' && (
            <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#047857]">
                Daily Duration Target (Minutes)
              </label>
              <input
                type="number"
                min="1"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="w-full px-3 py-2 bg-white rounded-xl border border-emerald-200 text-sm font-bold text-[#022c22]"
              />
            </div>
          )}

          {habit.type === 'time_of_day' && (
            <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#047857]">
                Target Check-in Time
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="e.g. 05:00 AM"
                  className="flex-1 px-3 py-2 bg-white rounded-xl border border-emerald-200 text-sm font-black text-[#022c22]"
                />
                {['05:00 AM', '06:00 AM', '12:00 PM', '10:00 PM'].map((preset) => (
                  <button
                    type="button"
                    key={preset}
                    onClick={() => setTargetValue(preset)}
                    className="px-2 py-1 rounded-lg text-[10px] font-black bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}

          {habit.type === 'yes_no' && (
            <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#047857]">
                Custom Yes/No Question
              </label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. Did you complete this today?"
                className="w-full px-3 py-2 bg-white rounded-xl border border-emerald-200 text-sm font-medium text-[#022c22]"
              />
            </div>
          )}

          {/* Frequency */}
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

          {/* Actions */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-6 py-2.5 rounded-2xl bg-[#047857] hover:bg-[#065f46] text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-60 flex items-center gap-2"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{updateMutation.isPending ? 'Saving...' : 'Update Habit'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
