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
  Pencil,
  Send
} from 'lucide-react';
import api from '../../api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../../stores/uiStore';
import { emitHabitUpdate } from '../../api/socket';

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
  const { showToast } = useUIStore();
  const [showOptions, setShowOptions] = useState(false);

  // Today's log data from props
  const log = habit.todayLog || { isCompleted: false, value: 0 };

  // Local optimistic state for 0ms immediate responsiveness
  const [isDone, setIsDone] = useState(!!log.isCompleted);
  const [currentValue, setCurrentValue] = useState(log.value || 0);

  // Direct manual inputs
  const [countInput, setCountInput] = useState(log.value ? log.value.toString() : '');
  const [timeInputMins, setTimeInputMins] = useState(log.value ? log.value.toString() : '');
  const [timeOfDayInput, setTimeOfDayInput] = useState(
    typeof log.value === 'string' && log.value ? log.value : habit.targetValue || '05:00 AM'
  );

  // Stopwatch state for 'timer' habit type
  const [timerSeconds, setTimerSeconds] = useState(typeof log.value === 'number' ? log.value : 0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef(null);

  // Sync state when props change
  useEffect(() => {
    setIsDone(!!log.isCompleted);
    setCurrentValue(log.value || 0);
    if (log.value) {
      setCountInput(log.value.toString());
      setTimeInputMins(log.value.toString());
      if (typeof log.value === 'string') {
        setTimeOfDayInput(log.value);
      }
    }
    if (habit.type === 'timer' && typeof log.value === 'number') {
      setTimerSeconds(log.value || 0);
    }
  }, [log.isCompleted, log.value, habit.type]);

  // Stopwatch interval
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

  // Optimistic Mutation for logging habit with 0ms UI delay
  const logMutation = useMutation({
    mutationFn: async ({ isCompleted, value }) => {
      const habitId = habit.id || habit._id;
      const response = await api.post(`/habits/${habitId}/log`, {
        date: selectedDate,
        isCompleted,
        value
      });
      return response.data;
    },
    onMutate: async ({ isCompleted, value }) => {
      const habitId = habit.id || habit._id;

      // 1. Instant local state
      setIsDone(isCompleted);
      setCurrentValue(value);

      // 2. Confetti on completion
      if (isCompleted && !isDone) {
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.8 },
          colors: ['#10b981', '#34d399', '#047857', '#6ee7b7']
        });
      }

      // 3. Cancel active queries & snapshot previous cache
      await queryClient.cancelQueries({ queryKey: ['habits', selectedDate] });
      const previousHabits = queryClient.getQueryData(['habits', selectedDate]);

      // 4. Optimistically update React Query cache immediately
      queryClient.setQueryData(['habits', selectedDate], (old) => {
        if (!old || !old.data) return old;
        const updated = old.data.map((h) => {
          if ((h.id || h._id) === habitId) {
            return {
              ...h,
              todayLog: {
                ...(h.todayLog || {}),
                isCompleted,
                value,
                date: selectedDate
              }
            };
          }
          return h;
        });
        return { ...old, data: updated };
      });

      // 5. Emit socket update immediately so group members see live update
      if (habit.groupId) {
        emitHabitUpdate({
          groupId: habit.groupId,
          habitId,
          habitTitle: habit.title,
          groupName: habit.groupName,
          isCompleted,
          value,
          date: selectedDate
        });
      }

      return { previousHabits };
    },
    onError: (err, variables, context) => {
      // Rollback cache on failure
      if (context?.previousHabits) {
        queryClient.setQueryData(['habits', selectedDate], context.previousHabits);
      }
      setIsDone(!!log.isCompleted);
      setCurrentValue(log.value || 0);
      showToast(err.response?.data?.message || 'Failed to sync habit. Please try again.', 'error');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['habits', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['groupDetails'] });
    }
  });

  // Delete habit mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/habits/${habit.id || habit._id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['groupDetails'] });
      showToast('Habit deleted', 'info');
    }
  });

  // Universal 1-click toggle
  const triggerToggleDone = () => {
    const nextDone = !isDone;
    let nextVal = nextDone ? 1 : 0;
    if (habit.type === 'count') {
      nextVal = nextDone ? habit.targetValue || 1 : 0;
    } else if (habit.type === 'time_target') {
      nextVal = nextDone ? habit.targetValue || 30 : 0;
    } else if (habit.type === 'time_of_day') {
      nextVal = nextDone ? timeOfDayInput || habit.targetValue : '';
    }

    logMutation.mutate({
      isCompleted: nextDone,
      value: nextVal
    });
  };

  // Submit direct manual count
  const handleDirectCountSubmit = (e) => {
    if (e) e.preventDefault();
    const val = parseInt(countInput || '0', 10);
    if (isNaN(val) || val < 0) return;
    const completed = val > 0;
    logMutation.mutate({
      isCompleted: completed,
      value: val
    });
  };

  // Step count with +/-
  const stepCount = (delta) => {
    const current = typeof currentValue === 'number' ? currentValue : 0;
    const nextVal = Math.max(0, current + delta);
    setCountInput(nextVal.toString());
    logMutation.mutate({
      isCompleted: nextVal > 0,
      value: nextVal
    });
  };

  // Submit direct manual duration
  const handleDirectTimeSubmit = (e) => {
    if (e) e.preventDefault();
    const mins = parseInt(timeInputMins || '0', 10);
    if (isNaN(mins) || mins < 0) return;
    const completed = mins > 0;
    logMutation.mutate({
      isCompleted: completed,
      value: mins
    });
  };

  // Quick add minutes
  const addTimeMinutes = (added) => {
    const current = typeof currentValue === 'number' ? currentValue : 0;
    const nextVal = Math.max(0, current + added);
    setTimeInputMins(nextVal.toString());
    logMutation.mutate({
      isCompleted: nextVal > 0,
      value: nextVal
    });
  };

  // Submit specific time of day
  const handleTimeOfDaySubmit = (e) => {
    if (e) e.preventDefault();
    const timeVal = timeOfDayInput.trim() || habit.targetValue || '05:00 AM';
    logMutation.mutate({
      isCompleted: true,
      value: timeVal
    });
  };

  // Stopwatch handlers
  const saveTimerStopwatch = () => {
    setIsTimerRunning(false);
    logMutation.mutate({
      isCompleted: timerSeconds > 0,
      value: timerSeconds
    });
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
      className={`rounded-2xl p-3.5 sm:p-4 transition-all duration-150 border ${
        isDone
          ? 'bg-emerald-50/80 border-emerald-300 shadow-xs'
          : 'bg-white border-gray-200/85 shadow-xs hover:border-emerald-300'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            style={{ backgroundColor: `${habit.color || '#10b981'}15`, color: habit.color || '#10b981' }}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100 shadow-2xs"
          >
            <IconComponent className="w-4 h-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4
                className={`text-sm sm:text-[15px] font-black text-[#022c22] truncate transition-colors ${
                  isDone ? 'line-through text-emerald-800/65 font-bold' : ''
                }`}
              >
                {habit.title}
              </h4>
              {habit.groupName && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 shrink-0">
                  <Users className="w-2.5 h-2.5" />
                  {habit.groupName}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-semibold">
              <span className="capitalize">{habit.frequency}</span>
              <span>•</span>
              <span className="capitalize">
                {habit.type === 'time_of_day' ? 'Specific Time' : habit.type.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Right Toggle Button & Options Menu */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={triggerToggleDone}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              isDone
                ? 'bg-[#10b981] text-white shadow-xs hover:bg-rose-500 ring-2 ring-emerald-300 scale-102'
                : 'bg-gray-100 text-gray-400 hover:bg-emerald-100 hover:text-[#047857]'
            }`}
            title={isDone ? 'Completed! Click to undo' : 'Click to complete'}
          >
            <Check className="w-4 h-4 stroke-[3]" />
          </button>

          {habit.canManage !== false && (
            <div className="relative">
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
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

      {/* Direct Manual Controls for Each Habit Type */}

      {/* 1. YES / NO QUESTION */}
      {habit.type === 'yes_no' && (
        <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-gray-700 truncate">
            {habit.question || `Did you complete this today?`}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => logMutation.mutate({ isCompleted: true, value: 1 })}
              className={`px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${
                isDone
                  ? 'bg-[#10b981] text-white shadow-sm ring-2 ring-emerald-300 scale-102'
                  : 'bg-emerald-50 text-[#047857] hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Yes</span>
            </button>

            <button
              onClick={() => logMutation.mutate({ isCompleted: false, value: 0 })}
              className={`px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${
                !isDone
                  ? 'bg-rose-500 text-white shadow-sm ring-2 ring-rose-300 scale-102'
                  : 'bg-gray-100 text-gray-500 hover:bg-rose-50 hover:text-rose-600'
              }`}
            >
              <X className="w-3.5 h-3.5 stroke-[3]" />
              <span>No</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. NUMERIC COUNT (Direct Input Box + Stepper + Complete Button) */}
      {habit.type === 'count' && (
        <div className="mt-2.5 pt-2 border-t border-gray-100 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-600">
            <span>
              Target: <strong className="text-emerald-900 font-black">{habit.targetValue} {habit.targetUnit || 'units'}</strong>
            </span>
            <span className={isDone ? 'text-emerald-700 font-black' : 'text-gray-500'}>
              Logged: {currentValue || 0} / {habit.targetValue}
            </span>
          </div>

          <form onSubmit={handleDirectCountSubmit} className="flex items-center gap-2 flex-wrap">
            {/* Quick +/- Stepper */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => stepCount(-1)}
                className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center font-bold text-xs transition-colors cursor-pointer"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => stepCount(1)}
                className="w-7 h-7 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-[#047857] flex items-center justify-center font-bold text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => stepCount(5)}
                className="px-1.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#047857] font-black text-[10px] border border-emerald-200 cursor-pointer"
              >
                +5
              </button>
            </div>

            {/* Direct Input Field */}
            <div className="flex-1 min-w-[90px] flex items-center gap-1">
              <input
                type="number"
                min="0"
                value={countInput}
                onChange={(e) => setCountInput(e.target.value)}
                placeholder="Enter count"
                className="w-full px-2.5 py-1 bg-white rounded-lg border border-emerald-300 text-xs font-black text-[#022c22] focus:outline-none focus:ring-1 focus:ring-[#10b981]"
              />
              <span className="text-[10px] font-bold text-gray-400 shrink-0">
                {habit.targetUnit || ''}
              </span>
            </div>

            {/* Complete / Save Button */}
            <button
              type="submit"
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer shrink-0 ${
                isDone
                  ? 'bg-[#10b981] text-white shadow-xs hover:bg-[#059669]'
                  : 'bg-[#047857] hover:bg-[#065f46] text-white shadow-xs'
              }`}
            >
              {isDone ? 'Saved ✓' : 'Complete / Log'}
            </button>
          </form>
        </div>
      )}

      {/* 3. DURATION TARGET (Direct Minutes Input + Quick Adds + Complete Button) */}
      {habit.type === 'time_target' && (
        <div className="mt-2.5 pt-2 border-t border-gray-100 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-600">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#047857]" />
              Logged: {currentValue || 0} / {habit.targetValue} mins
            </span>
            <span className="text-[#047857] font-black">
              {Math.min(100, Math.round(((Number(currentValue) || 0) / (habit.targetValue || 1)) * 100))}%
            </span>
          </div>

          <div className="w-full h-1.5 bg-emerald-100/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#10b981] rounded-full transition-all duration-200"
              style={{
                width: `${Math.min(100, ((Number(currentValue) || 0) / (habit.targetValue || 1)) * 100)}%`
              }}
            />
          </div>

          <form onSubmit={handleDirectTimeSubmit} className="flex items-center gap-2 flex-wrap pt-0.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => addTimeMinutes(15)}
                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#047857] text-[11px] font-bold rounded-lg border border-emerald-200 transition-colors cursor-pointer"
              >
                +15m
              </button>
              <button
                type="button"
                onClick={() => addTimeMinutes(30)}
                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#047857] text-[11px] font-bold rounded-lg border border-emerald-200 transition-colors cursor-pointer"
              >
                +30m
              </button>
            </div>

            <div className="flex-1 min-w-[85px] flex items-center gap-1">
              <input
                type="number"
                min="0"
                value={timeInputMins}
                onChange={(e) => setTimeInputMins(e.target.value)}
                placeholder="Mins"
                className="w-full px-2.5 py-1 bg-white rounded-lg border border-emerald-300 text-xs font-black text-[#022c22] focus:outline-none focus:ring-1 focus:ring-[#10b981]"
              />
              <span className="text-[10px] font-bold text-gray-400">m</span>
            </div>

            <button
              type="submit"
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer shrink-0 ${
                isDone
                  ? 'bg-[#10b981] text-white shadow-xs hover:bg-[#059669]'
                  : 'bg-[#047857] hover:bg-[#065f46] text-white shadow-xs'
              }`}
            >
              {isDone ? 'Saved ✓' : 'Complete Goal'}
            </button>
          </form>
        </div>
      )}

      {/* 4. SPECIFIC TIME OF DAY (e.g. 05:00 AM, 12:00 AM) */}
      {habit.type === 'time_of_day' && (
        <div className="mt-2.5 pt-2 border-t border-gray-100 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-600">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#047857]" />
              Target Time: <strong className="text-emerald-950 font-black">{habit.targetValue || '05:00 AM'}</strong>
            </span>
            {isDone && (
              <span className="text-emerald-700 font-black bg-emerald-100 px-2 py-0.5 rounded-md text-[10px]">
                Done: {currentValue || habit.targetValue}
              </span>
            )}
          </div>

          <form onSubmit={handleTimeOfDaySubmit} className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-[120px]">
              <input
                type="text"
                value={timeOfDayInput}
                onChange={(e) => setTimeOfDayInput(e.target.value)}
                placeholder="e.g. 05:00 AM"
                className="w-full px-2.5 py-1 bg-white rounded-lg border border-emerald-300 text-xs font-black text-[#022c22] focus:outline-none focus:ring-1 focus:ring-[#10b981]"
              />
            </div>

            <button
              type="submit"
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer shrink-0 ${
                isDone
                  ? 'bg-[#10b981] text-white shadow-xs'
                  : 'bg-[#047857] hover:bg-[#065f46] text-white shadow-xs'
              }`}
            >
              {isDone ? 'Checked In ✓' : 'Confirm & Complete'}
            </button>

            {isDone && (
              <button
                type="button"
                onClick={() => logMutation.mutate({ isCompleted: false, value: '' })}
                className="px-2 py-1 bg-gray-100 hover:bg-rose-50 text-gray-600 hover:text-rose-600 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Undo
              </button>
            )}
          </form>
        </div>
      )}

      {/* 5. STOPWATCH TIMER */}
      {habit.type === 'timer' && (
        <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 bg-emerald-950 text-emerald-300 font-mono text-xs font-black rounded-lg tracking-wider shadow-2xs">
              {formatStopwatch(timerSeconds)}
            </div>
            <span className="text-[10px] text-gray-500 font-medium">
              Target: {habit.targetValue}m
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {!isTimerRunning ? (
              <button
                type="button"
                onClick={() => setIsTimerRunning(true)}
                className="px-2.5 py-1 bg-[#10b981] hover:bg-[#059669] text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
              >
                <Play className="w-3 h-3 fill-current" />
                Start
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsTimerRunning(false)}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
              >
                <Pause className="w-3 h-3 fill-current" />
                Pause
              </button>
            )}

            <button
              type="button"
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
              type="button"
              onClick={saveTimerStopwatch}
              className="px-3 py-1 bg-[#047857] hover:bg-[#065f46] text-white text-[11px] font-black rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              Save & Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
