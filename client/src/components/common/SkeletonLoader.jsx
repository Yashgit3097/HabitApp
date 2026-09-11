import React from 'react';

/**
 * Base Shimmer Primitive
 */
export const Skeleton = ({ className = '', rounded = 'rounded-xl' }) => (
  <div
    className={`bg-gradient-to-r from-emerald-100/60 via-gray-200/60 to-emerald-100/60 bg-[length:200%_100%] animate-pulse ${rounded} ${className}`}
  />
);

/**
 * Skeleton Loader for Single Habit Card
 */
export const HabitCardSkeleton = () => (
  <div className="rounded-2xl p-3.5 sm:p-4 bg-white border border-gray-100 shadow-xs space-y-3">
    <div className="flex items-center justify-between gap-3">
      {/* Icon + Title */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <Skeleton className="w-9 h-9 shrink-0" rounded="rounded-xl" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      </div>
      {/* Right Action Button */}
      <Skeleton className="w-8 h-8 shrink-0" rounded="rounded-xl" />
    </div>

    {/* Bottom Progress / Action Skeleton */}
    <div className="pt-2 border-t border-gray-50 flex items-center justify-between">
      <Skeleton className="h-3 w-1/4" />
      <Skeleton className="h-6 w-20" rounded="rounded-lg" />
    </div>
  </div>
);

/**
 * Skeleton Loader for Habit Card List (Dashboard)
 */
export const HabitListSkeleton = ({ count = 3 }) => (
  <div className="grid grid-cols-1 gap-2.5">
    {Array.from({ length: count }).map((_, idx) => (
      <HabitCardSkeleton key={idx} />
    ))}
  </div>
);

/**
 * Skeleton Loader for Group Card (Social View)
 */
export const GroupCardSkeleton = () => (
  <div className="p-3.5 bg-white rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between gap-3">
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <Skeleton className="w-11 h-11 shrink-0" rounded="rounded-full" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-2.5 w-1/3" />
      </div>
    </div>
    <Skeleton className="w-8 h-8 shrink-0" rounded="rounded-xl" />
  </div>
);

/**
 * Skeleton Loader for Group List
 */
export const GroupListSkeleton = ({ count = 3 }) => (
  <div className="grid grid-cols-1 gap-2.5">
    {Array.from({ length: count }).map((_, idx) => (
      <GroupCardSkeleton key={idx} />
    ))}
  </div>
);

/**
 * Skeleton Loader for Group Detail & Matrix View
 */
export const GroupMatrixSkeleton = () => (
  <div className="space-y-4 max-w-3xl mx-auto">
    {/* Top Navigation Row */}
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-24" rounded="rounded-xl" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" rounded="rounded-xl" />
        <Skeleton className="h-8 w-28" rounded="rounded-xl" />
      </div>
    </div>

    {/* Header Banner */}
    <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 rounded-3xl p-5 sm:p-6 text-white shadow-lg space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5 flex-1">
          <Skeleton className="w-14 h-14 shrink-0 bg-emerald-700/60" rounded="rounded-2xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-1/2 bg-emerald-700/60" />
            <Skeleton className="h-3 w-3/4 bg-emerald-700/60" />
            <Skeleton className="h-3 w-1/4 bg-emerald-700/60" />
          </div>
        </div>
      </div>
    </div>

    {/* Date Bar & Tabs */}
    <div className="flex items-center justify-between gap-2">
      <Skeleton className="h-10 w-44" rounded="rounded-2xl" />
      <Skeleton className="h-10 w-48" rounded="rounded-xl" />
    </div>

    {/* Matrix Board Placeholder */}
    <div className="bg-white rounded-3xl p-4 sm:p-6 border border-emerald-100 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Member Avatar Row */}
      <div className="flex gap-3 overflow-x-auto py-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
            <Skeleton className="w-11 h-11" rounded="rounded-full" />
            <Skeleton className="h-2.5 w-12" />
          </div>
        ))}
      </div>

      {/* Tasks Grid */}
      <div className="space-y-2 pt-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-3 bg-gray-50/80 rounded-2xl flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-1/3" />
            <div className="flex gap-2">
              <Skeleton className="w-7 h-7" rounded="rounded-lg" />
              <Skeleton className="w-7 h-7" rounded="rounded-lg" />
              <Skeleton className="w-7 h-7" rounded="rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/**
 * Skeleton Loader for Analytics Page
 */
export const AnalyticsSkeleton = () => (
  <div className="space-y-4 max-w-2xl mx-auto">
    {/* Header */}
    <div className="space-y-1.5">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-3.5 w-72" />
    </div>

    {/* 4 Stat Boxes */}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-3.5 rounded-2xl bg-white border border-gray-100 shadow-2xs flex flex-col items-center gap-2">
          <Skeleton className="w-8 h-8" rounded="rounded-xl" />
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      ))}
    </div>

    {/* Breakdown Card */}
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-emerald-100 space-y-3">
      <Skeleton className="h-5 w-40" />
      <div className="space-y-2.5 pt-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-3 bg-gray-50/80 rounded-xl space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3.5 w-12" />
            </div>
            <Skeleton className="h-2 w-full" rounded="rounded-full" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

/**
 * Skeleton Loader for Join Group Invitation Page
 */
export const JoinGroupSkeleton = () => (
  <div className="max-w-md mx-auto my-8 sm:my-12">
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-emerald-100 text-center space-y-4">
      <Skeleton className="w-20 h-20 mx-auto" rounded="rounded-full" />
      <Skeleton className="h-6 w-3/4 mx-auto" />
      <Skeleton className="h-3.5 w-5/6 mx-auto" />
      <Skeleton className="h-8 w-32 mx-auto" rounded="rounded-full" />
      <Skeleton className="h-11 w-full" rounded="rounded-xl" />
    </div>
  </div>
);
