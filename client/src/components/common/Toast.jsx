import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

export const Toast = () => {
  const { toast, hideToast } = useUIStore();

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full max-w-sm px-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 450, damping: 30 }}
            className={`pointer-events-auto rounded-2xl p-3.5 shadow-xl border flex items-center justify-between gap-3 ${
              toast.type === 'error'
                ? 'bg-rose-900/95 text-white border-rose-700/80 backdrop-blur-md'
                : toast.type === 'info'
                ? 'bg-teal-900/95 text-white border-teal-700/80 backdrop-blur-md'
                : 'bg-emerald-950/95 text-white border-emerald-700/80 backdrop-blur-md'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {toast.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-rose-300 shrink-0" />
              ) : toast.type === 'info' ? (
                <Info className="w-5 h-5 text-teal-300 shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              )}
              <p className="text-xs sm:text-[13px] font-bold tracking-tight leading-tight truncate">
                {toast.message}
              </p>
            </div>

            <button
              onClick={hideToast}
              className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
