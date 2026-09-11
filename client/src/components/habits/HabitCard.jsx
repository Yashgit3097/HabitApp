import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Clock,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Minus,
  Check,
  X,
  Trash2,
  MoreVertical,
  Flame,
  Users,
  Sparkles,
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
  Pencil
} from 'lucide-react';
import api from '../../api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const ICON_MAP = {
  CheckCircle2,
  Flame,
  Sparkles,
  BookOpen,
  Dumbbell,
  Heart,
  Droplet,
  Brain,
  Clock,
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
  Zap
};

export const HabitCard = ({ habit, selectedDate }) => {
  const queryClient = useQueryClient();
  const [showOptions, setShowOptions] = useState(false);
  const [showManualTime, setShowManualTime] = useState(false);
  const [manualInputMins, setManualInputMins] = useState('');

  // Today's log data
  const log = habit.todayLog || { isCompleted: false, value: 0 };
  const isDone = log.isCompleted;

  // Stopwatch state for 'timer' habit type
  const [timerSeconds, setTimerSeconds] = useState(log.value || 0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    setTimerSeconds(log.value || 0);
  }, [log.value]);

  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isTimerRunning]);

  // Mutation for logging habit
  const logMutation = useMutation({
    mutationFn: async ({ isCompleted, value }) => {
      const response = await api.post(`/habits/${habit.id || habit._id}/log`, {
        date: selectedDate,
        isCompleted,
        value
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['groupDetails'] });
      if (variables.isCompleted && !isDone) {
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.8 },
          colors: ['#10b981', '#34d399', '#047857', '#6ee7b7']
        });
      }
    }
  });

  // Mutation for deleting habit
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/habits/${habit.id || habit._id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
    }
  });

  const triggerToggleDone = () => {
    logMutation.mutate({
      isCompleted: !isDone,
      value: !isDone ? 1 : 0
    });
  };

  const updateCountValue = (delta) => {
    const currentVal = log.value || 0;
    const newVal = Math.max(0, currentVal + delta);
    const completed = newVal >= habit.targetValue;
    logMutation.mutate({
      isCompleted: completed,
      value: newVal
    });
  };

  const updateTimeValue = (addedMins) => {
    const currentMins = log.value || 0;
    const newMins = Math.max(0, currentMins + addedMins);
    const completed = newMins >= habit.targetValue;
    logMutation.mutate({
      isCompleted: completed,
      value: newMins
    });
  };

  const handleManualTimeSubmit = (e) => {
    if (e) e.preventDefault();
    const mins = parseInt(manualInputMins, 10);
    if (isNaN(mins) || mins < 0) return;
    const completed = mins >= (habit.targetValue || 1);
    logMutation.mutate({
      isCompleted: completed,
      value: mins
    });
    setShowManualTime(false);
    setManualInputMins('');
  };

  const saveTimerStopwatch = () => {
    setIsTimerRunning(false);
    const mins = Math.floor(timerSeconds / 60);
    const completed = mins >= (habit.targetValue || 1);
    logMutation.mutate({
      isCompleted: completed,
      value: timerSeconds
    });
  };

  const handleManualTimerSubmit = (e) => {
    if (e) e.preventDefault();
    const mins = parseInt(manualInputMins, 10);
    if (isNaN(mins) || mins < 0) return;
    const totalSecs = mins * 60;
    setTimerSeconds(totalSecs);
    setIsTimerRunning(false);
    const completed = mins >= (habit.targetValue || 1);
    logMutation.mutate({
      isCompleted: completed,
      value: totalSecs
    });
    setShowManualTime(false);
    setManualInputMins('');
  };

  const formatStopwatch = (totalSecs) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const IconComponent = ICON_MAP[habit.icon] || Sparkles;

  return (
    <div
      className={`rounded-2xl p-3.5 sm:p-4 transition-all duration-200 border ${
        isDone
          ? 'bg-emerald-50/70 border-emerald-300 shadow-xs'
          : 'bg-white border-gray-200/80 shadow-xs hover:border-emerald-300'
      }`}
    >
      {/* Habit Header */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Icon Badge */}
          <div
            style={{ backgroundColor: `${habit.color}15`, color: habit.color }}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100 shadow-2xs"
          >
            <IconComponent className="w-4 h-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4
                className={`text-sm sm:text-[15px] font-extrabold text-[#022c22] truncate ${
                  isDone ? 'line-through text-emerald-800/60 font-semibold' : ''
                }`}
              >
                {habit.title}
              </h4>
              {habit.groupName && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 shrink-0">
                  <Users className="w-2.5 h-2.5" />
                  {habit.groupName}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-semibold">
              <span className="capitalize">{habit.frequency}</span>
              <span>•</span>
              <span className="capitalize">{habit.type.replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        {/* Right Toggle Button & Menu */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Universal 1-Click Complete / Undo Button */}
          <button
            onClick={triggerToggleDone}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              isDone
                ? 'bg-[#10b981] text-white shadow-xs hover:bg-rose-500'
                : 'bg-gray-100 text-gray-400 hover:bg-emerald-100 hover:text-[#047857]'
            }`}
            title={isDone ? 'Completed! Click to undo' : 'Click to complete'}
          >
            <Check className="w-4 h-4 stroke-[3]" />
          </button>

          {/* Options Menu (Only if user owns habit or is group admin) */}
          {habit.canManage !== false && (
            <div className="relative">
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                title="Manage Habit"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {showOptions && (
                <div className="absolute right-0 top-7 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30 min-w-[120px]">
                  <button
                    onClick={() => {
                      setShowOptions(false);
                      deleteMutation.mutate();
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete {habit.groupId ? 'Group Task' : 'Habit'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Habit Body Controls (Compact) */}

      {/* 1. Time Target */}
      {habit.type === 'time_target' && (
        <div className="mt-2.5 pt-2 border-t border-gray-100 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-600">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#047857]" />
              {log.value || 0} / {habit.targetValue} mins
            </span>
            <span className="text-[#047857]">
              {Math.min(100, Math.round(((log.value || 0) / (habit.targetValue || 1)) * 100))}%
            </span>
          </div>

          <div className="w-full h-1.5 bg-emerald-100/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#10b981] rounded-full transition-all duration-200"
              style={{
                width: `${Math.min(100, ((log.value || 0) / (habit.targetValue || 1)) * 100)}%`
              }}
            />
          </div>

          {showManualTime ? (
            <form onSubmit={handleManualTimeSubmit} className="flex items-center gap-1.5 pt-1">
              <input
                type="number"
                min="0"
                placeholder="Mins (e.g. 60)"
                value={manualInputMins}
                onChange={(e) => setManualInputMins(e.target.value)}
                className="w-24 px-2.5 py-1 text-xs font-bold border border-emerald-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#10b981] bg-white text-[#022c22]"
                autoFocus
              />
              <span className="text-[11px] font-bold text-gray-500">mins</span>
              <button
                type="submit"
                className="px-2.5 py-1 bg-[#047857] hover:bg-[#065f46] text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer ml-auto shadow-2xs"
              >
                Log Time
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowManualTime(false);
                  setManualInputMins('');
                }}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-1.5 pt-0.5">
              <button
                onClick={() => updateTimeValue(15)}
                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#047857] text-[11px] font-bold rounded-lg border border-emerald-200 transition-colors cursor-pointer"
              >
                +15m
              </button>
              <button
                onClick={() => updateTimeValue(30)}
                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#047857] text-[11px] font-bold rounded-lg border border-emerald-200 transition-colors cursor-pointer"
              >
                +30m
              </button>
              <button
                onClick={() => {
                  setShowManualTime(true);
                  setManualInputMins(log.value ? log.value.toString() : '');
                }}
                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#047857] text-[11px] font-bold rounded-lg border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1"
                title="Write time manually"
              >
                <Pencil className="w-2.5 h-2.5" />
                <span>Manual</span>
              </button>
              <button
                onClick={() => {
                  if (isDone) {
                    logMutation.mutate({ isCompleted: false, value: 0 });
                  } else {
                    logMutation.mutate({ isCompleted: true, value: habit.targetValue });
                  }
                }}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ml-auto ${
                  isDone
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                    : 'bg-[#047857] hover:bg-[#065f46] text-white'
                }`}
              >
                {isDone ? 'Undo' : 'Complete Goal'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Stopwatch */}
      {habit.type === 'timer' && (
        <>
          {showManualTime ? (
            <form onSubmit={handleManualTimerSubmit} className="mt-2.5 pt-2 border-t border-gray-100 flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-gray-500">Log:</span>
              <input
                type="number"
                min="0"
                placeholder="Mins (e.g. 45)"
                value={manualInputMins}
                onChange={(e) => setManualInputMins(e.target.value)}
                className="w-24 px-2.5 py-1 text-xs font-bold border border-emerald-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#10b981] bg-white text-[#022c22]"
                autoFocus
              />
              <span className="text-[11px] font-bold text-gray-500">mins</span>
              <button
                type="submit"
                className="px-2.5 py-1 bg-[#047857] hover:bg-[#065f46] text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer ml-auto shadow-2xs"
              >
                Save & Complete
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowManualTime(false);
                  setManualInputMins('');
                }}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="px-2 py-1 bg-emerald-950 text-emerald-300 font-mono text-xs font-black rounded-lg tracking-wider">
                  {formatStopwatch(timerSeconds)}
                </div>
                <span className="text-[10px] text-gray-500 font-medium">
                  Target: {habit.targetValue}m
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {!isTimerRunning ? (
                  <button
                    onClick={() => setIsTimerRunning(true)}
                    className="px-2 py-1 bg-[#10b981] hover:bg-[#059669] text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    Start
                  </button>
                ) : (
                  <button
                    onClick={() => setIsTimerRunning(false)}
                    className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Pause className="w-3 h-3 fill-current" />
                    Pause
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsTimerRunning(false);
                    setTimerSeconds(0);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  title="Reset"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>

                <button
                  onClick={saveTimerStopwatch}
                  className="px-2 py-1 bg-[#047857] hover:bg-[#065f46] text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Save
                </button>

                <button
                  onClick={() => {
                    setShowManualTime(true);
                    const currentMins = Math.floor(timerSeconds / 60);
                    setManualInputMins(currentMins > 0 ? currentMins.toString() : '');
                  }}
                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#047857] text-[11px] font-bold rounded-lg border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1"
                  title="Write time manually"
                >
                  <Pencil className="w-2.5 h-2.5" />
                  <span>Manual</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 3. Numeric Count */}
      {habit.type === 'count' && (
        <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-black text-[#022c22]">{log.value || 0}</span>
            <span className="text-xs text-gray-500 font-semibold">
              / {habit.targetValue} {habit.targetUnit || 'reps'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => updateCountValue(-1)}
              className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center font-bold text-xs transition-colors cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              onClick={() => updateCountValue(1)}
              className="w-7 h-7 rounded-lg bg-[#047857] hover:bg-[#065f46] text-white flex items-center justify-center font-bold text-xs transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={() => updateCountValue(5)}
              className="px-2 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-[#047857] text-[10px] font-black transition-colors cursor-pointer"
            >
              +5
            </button>
          </div>
        </div>
      )}

      {/* 4. Yes / No Question */}
      {habit.type === 'yes_no' && (
        <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-gray-700 truncate">
            {habit.question || `Did you complete this today?`}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* YES BUTTON: Marks Task Completed */}
            <button
              onClick={() => {
                if (!isDone) {
                  logMutation.mutate({ isCompleted: true, value: 1 });
                }
              }}
              disabled={logMutation.isPending}
              className={`px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${
                isDone
                  ? 'bg-[#10b981] text-white shadow-sm ring-2 ring-emerald-300 scale-102'
                  : 'bg-emerald-50 text-[#047857] hover:bg-emerald-100 border border-emerald-200'
              }`}
              title="Click Yes to complete task"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Yes</span>
            </button>

            {/* NO BUTTON: Marks Task Incomplete */}
            <button
              onClick={() => {
                if (isDone) {
                  logMutation.mutate({ isCompleted: false, value: 0 });
                }
              }}
              disabled={logMutation.isPending}
              className={`px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${
                !isDone
                  ? 'bg-rose-500 text-white shadow-sm ring-2 ring-rose-300 scale-102'
                  : 'bg-gray-100 text-gray-500 hover:bg-rose-50 hover:text-rose-600'
              }`}
              title="Click No to mark as incomplete"
            >
              <X className="w-3.5 h-3.5 stroke-[3]" />
              <span>No</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
