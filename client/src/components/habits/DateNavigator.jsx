import React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';

export const DateNavigator = ({ selectedDate, onSelectDate }) => {
  // Generate list of dates: 3 days past, today, 3 days future
  const getDaysArray = () => {
    const days = [];
    const today = new Date();
    
    for (let i = -3; i <= 3; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const isToday = i === 0;
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.getDate();

      days.push({
        iso,
        dayName: isToday ? 'Today' : dayName,
        dayNum,
        isToday,
        isFuture: i > 0
      });
    }
    return days;
  };

  const days = getDaysArray();

  return (
    <div className="bg-white rounded-2xl p-2 sm:p-2.5 shadow-xs border border-emerald-100">
      <div className="flex items-center justify-between gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none">
        {days.map((d) => {
          const isSelected = selectedDate === d.iso;
          return (
            <button
              key={d.iso}
              onClick={() => onSelectDate(d.iso)}
              className={`flex-1 min-w-[44px] py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all duration-150 cursor-pointer select-none ${
                isSelected
                  ? 'bg-[#047857] text-white shadow-xs scale-102 font-bold'
                  : d.isToday
                  ? 'bg-emerald-50 text-[#047857] border border-emerald-200 font-bold'
                  : 'bg-transparent text-gray-600 hover:bg-emerald-50/50'
              }`}
            >
              <span
                className={`text-[9px] uppercase font-bold tracking-tight ${
                  isSelected ? 'text-emerald-200' : 'text-gray-400'
                }`}
              >
                {d.dayName}
              </span>
              <span className="text-xs sm:text-sm font-extrabold mt-0.5 leading-none">
                {d.dayNum}
              </span>
              {d.isToday && (
                <span
                  className={`w-1 h-1 rounded-full mt-0.5 ${
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
