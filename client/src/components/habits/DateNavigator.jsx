import React, { useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

export const DateNavigator = ({ selectedDate, onSelectDate }) => {
  const scrollContainerRef = useRef(null);
  const selectedButtonRef = useRef(null);
  const dateInputRef = useRef(null);

  const todayIso = new Date().toISOString().split('T')[0];

  // Generate scrollable date array (30 days past to 14 days future)
  const getDaysArray = () => {
    const days = [];
    const today = new Date();

    for (let i = -30; i <= 14; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const isToday = i === 0;
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
      const dayNum = d.getDate();

      days.push({
        iso,
        dayName: isToday ? 'Today' : dayName,
        monthName,
        dayNum,
        isToday,
        isFuture: i > 0,
        rawDate: d
      });
    }
    return days;
  };

  const days = getDaysArray();

  // Smoothly center the selected date in the scroll container
  useEffect(() => {
    if (selectedButtonRef.current && scrollContainerRef.current) {
      selectedButtonRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  }, [selectedDate]);

  // Navigate one day back/forward
  const shiftDay = (delta) => {
    const current = new Date(selectedDate || todayIso);
    current.setDate(current.getDate() + delta);
    onSelectDate(current.toISOString().split('T')[0]);
  };

  // Format header title (e.g., September 2026)
  const activeDateObj = new Date(selectedDate || todayIso);
  const monthYearLabel = activeDateObj.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="bg-white rounded-2xl p-2.5 sm:p-3 shadow-xs border border-emerald-100/90 space-y-2">
      {/* Top Header Bar with Month/Year, Jump to Today, Direct Calendar Picker, and Step Arrows */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs font-black text-[#022c22] hover:text-[#047857] transition-colors cursor-pointer group"
            title="Pick a specific date"
          >
            <CalendarIcon className="w-3.5 h-3.5 text-[#047857] group-hover:scale-110 transition-transform" />
            <span>{monthYearLabel}</span>
          </button>

          {/* Hidden HTML5 Native Date Picker */}
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && onSelectDate(e.target.value)}
            className="sr-only"
          />

          {selectedDate !== todayIso && (
            <button
              type="button"
              onClick={() => onSelectDate(todayIso)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100/80 hover:bg-emerald-200 text-[#047857] text-[10px] font-black transition-colors cursor-pointer"
              title="Jump to Today"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Today</span>
            </button>
          )}
        </div>

        {/* Step Arrows */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftDay(-1)}
            className="w-6 h-6 rounded-lg bg-gray-50 hover:bg-emerald-50 text-gray-600 hover:text-[#047857] border border-gray-200/80 hover:border-emerald-200 flex items-center justify-center transition-colors cursor-pointer"
            title="Previous Day"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => shiftDay(1)}
            className="w-6 h-6 rounded-lg bg-gray-50 hover:bg-emerald-50 text-gray-600 hover:text-[#047857] border border-gray-200/80 hover:border-emerald-200 flex items-center justify-center transition-colors cursor-pointer"
            title="Next Day"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Horizontally Scrollable Date Pills Strip */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 px-0.5 scroll-smooth snap-x"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {days.map((d) => {
          const isSelected = selectedDate === d.iso;

          return (
            <button
              key={d.iso}
              ref={isSelected ? selectedButtonRef : null}
              type="button"
              onClick={() => onSelectDate(d.iso)}
              className={`shrink-0 min-w-[50px] sm:min-w-[54px] py-1.5 px-1.5 rounded-xl flex flex-col items-center justify-center transition-all duration-150 cursor-pointer select-none snap-center ${
                isSelected
                  ? 'bg-[#047857] text-white shadow-sm scale-102 font-bold ring-2 ring-emerald-300'
                  : d.isToday
                  ? 'bg-emerald-50 text-[#047857] border border-emerald-200 font-bold hover:bg-emerald-100'
                  : 'bg-gray-50/70 text-gray-600 border border-gray-100 hover:bg-emerald-50/60 hover:text-[#047857]'
              }`}
            >
              <span
                className={`text-[9px] uppercase font-bold tracking-tight ${
                  isSelected ? 'text-emerald-200' : 'text-gray-400'
                }`}
              >
                {d.dayName}
              </span>
              <span className="text-xs sm:text-sm font-black mt-0.5 leading-none">
                {d.dayNum}
              </span>
              <span
                className={`text-[8px] font-semibold mt-0.5 ${
                  isSelected ? 'text-emerald-100' : 'text-gray-400'
                }`}
              >
                {d.monthName}
              </span>
              {d.isToday && (
                <span
                  className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                    isSelected ? 'bg-emerald-200' : 'bg-[#047857]'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
