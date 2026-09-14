import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Crown, Maximize2 } from 'lucide-react';

export const ProfilePhotoModal = ({
  isOpen,
  onClose,
  src,
  name = 'User',
  username = '',
  role = null,
  subtitle = ''
}) => {
  if (!isOpen) return null;

  let cleanSrc = src;
  if (cleanSrc && typeof cleanSrc === 'string') {
    cleanSrc = cleanSrc.trim().replace('http://', 'https://');
  }
  const defaultDicebear = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name || username || 'user')}`;
  const imageSrc = cleanSrc || defaultDicebear;

  return (
    <AnimatePresence>
      <div
        onClick={onClose}
        className="fixed inset-0 z-60 bg-emerald-950/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 15 }}
          transition={{ type: 'spring', stiffness: 450, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl border border-emerald-100 flex flex-col items-center text-center relative overflow-hidden cursor-default"
        >
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Glowing Circular Avatar Frame */}
          <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden p-1.5 bg-gradient-to-tr from-[#10b981] via-[#047857] to-[#022c22] shadow-xl my-2 ring-4 ring-emerald-50 shrink-0">
            <img
              src={imageSrc}
              alt={name}
              className="w-full h-full object-cover rounded-full bg-white shadow-inner"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = defaultDicebear;
              }}
            />
          </div>

          <h3 className="text-base font-black text-[#022c22] mt-2 truncate max-w-full px-2">{name}</h3>
          {username && <p className="text-xs text-emerald-700 font-semibold truncate">@{username}</p>}
          {subtitle && <p className="text-[11px] text-gray-400 font-medium mt-0.5">{subtitle}</p>}

          {role === 'admin' && (
            <span className="mt-2 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
              <Crown className="w-3 h-3 fill-current" />
              Group Admin
            </span>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
