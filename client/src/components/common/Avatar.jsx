import React from 'react';

export const Avatar = ({
  src,
  name = 'User',
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
  status = null, // 'completed' | 'pending' | 'online' | null
  className = ''
}) => {
  const sizeClasses = {
    xs: 'w-7 h-7 text-xs',
    sm: 'w-9 h-9 text-sm',
    md: 'w-11 h-11 text-base',
    lg: 'w-14 h-14 text-lg',
    xl: 'w-20 h-20 text-2xl'
  };

  const statusBorderClasses = {
    completed: 'ring-3 ring-emerald-500 ring-offset-2 ring-offset-[#ecfdf5]',
    pending: 'ring-3 ring-rose-500 ring-offset-2 ring-offset-[#ecfdf5]',
    online: 'ring-2 ring-emerald-400'
  };

  const fallbackInitial = name ? name.charAt(0).toUpperCase() : 'U';
  const defaultDicebear = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name || 'user')}`;

  let cleanSrc = src;
  if (cleanSrc && typeof cleanSrc === 'string') {
    cleanSrc = cleanSrc.trim();
    if (cleanSrc.startsWith('http://res.cloudinary.com')) {
      cleanSrc = cleanSrc.replace('http://', 'https://');
    }
  }

  const imageSrc = cleanSrc || defaultDicebear;

  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      <div
        className={`rounded-full overflow-hidden flex items-center justify-center bg-emerald-100 text-emerald-950 font-bold border border-emerald-300 shadow-sm transition-all duration-300 ${sizeClasses[size]} ${status ? statusBorderClasses[status] : ''}`}
      >
        <img
          src={imageSrc}
          alt={name}
          className="w-full h-full object-cover rounded-full"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = defaultDicebear;
          }}
        />
      </div>

      {status === 'completed' && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center shadow-xs" title="Completed">
          <svg className="w-2 h-2 text-white fill-current" viewBox="0 0 20 20">
            <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
          </svg>
        </span>
      )}

      {status === 'pending' && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-rose-500 border-2 border-white rounded-full shadow-xs" title="Remaining today" />
      )}
    </div>
  );
};
