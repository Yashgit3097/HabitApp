/**
 * Local Date Utilities for accurate timezone-safe date operations.
 * Prevents UTC shifting issues where past-midnight local times roll back a day.
 */

/**
 * Returns YYYY-MM-DD for a given Date or current local date in the user's local timezone.
 */
export const getLocalDateString = (date = new Date()) => {
  if (!date) return getLocalDateString(new Date());
  const d = typeof date === 'string' ? parseLocalDate(date) : date;
  if (isNaN(d.getTime())) return getLocalDateString(new Date());
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parses YYYY-MM-DD into a local Date instance at local midnight.
 * Avoids UTC parsing bugs with `new Date("YYYY-MM-DD")`.
 */
export const parseLocalDate = (dateStr) => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr !== 'string') return new Date(dateStr);
  
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day, 0, 0, 0, 0);
    }
  }
  return new Date(dateStr);
};

/**
 * Formats a YYYY-MM-DD string into a localized human-readable date.
 */
export const formatDisplayDate = (dateStr, options = {}) => {
  if (!dateStr) return '';
  const d = parseLocalDate(dateStr);
  const defaultOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  };
  return d.toLocaleDateString('en-US', { ...defaultOptions, ...options });
};

/**
 * Checks if a YYYY-MM-DD date is today in the user's local timezone.
 */
export const isToday = (dateStr) => {
  if (!dateStr) return false;
  return dateStr === getLocalDateString(new Date());
};

/**
 * Checks if a YYYY-MM-DD date is yesterday in the user's local timezone.
 */
export const isYesterday = (dateStr) => {
  if (!dateStr) return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return dateStr === getLocalDateString(yesterday);
};

/**
 * Get relative date label (e.g. "Today", "Yesterday", or "Sun, Sep 13")
 */
export const getRelativeDateLabel = (dateStr) => {
  if (!dateStr) return '';
  if (isToday(dateStr)) return 'Today';
  if (isYesterday(dateStr)) return 'Yesterday';
  return formatDisplayDate(dateStr, { weekday: 'short', month: 'short', day: 'numeric' });
};

/**
 * Checks if a YYYY-MM-DD date is within the allowed [-3, +3] days editing window relative to today.
 */
export const isDateWithinEditableWindow = (dateStr) => {
  if (!dateStr) return false;
  const targetDate = parseLocalDate(dateStr);
  const today = parseLocalDate(getLocalDateString(new Date()));
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return Math.abs(diffDays) <= 3;
};

/**
 * Returns difference in days between target date and today (negative = past, positive = future).
 */
export const getDayDifferenceFromToday = (dateStr) => {
  if (!dateStr) return 0;
  const targetDate = parseLocalDate(dateStr);
  const today = parseLocalDate(getLocalDateString(new Date()));
  const diffTime = targetDate.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Generate a list of recent months formatted as YYYY-MM and human labels (e.g. "September 2026").
 */
export const getRecentMonthsList = (count = 12) => {
  const months = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    months.push({ value, label, isCurrentMonth: i === 0 });
  }
  return months;
};
