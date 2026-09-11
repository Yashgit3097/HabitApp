import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Sparkles, Smartphone, Check } from 'lucide-react';

export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);

  useEffect(() => {
    // Check if already running in standalone mode (installed PWA)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Capture standard PWA install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSTip(true);
    }
  };

  // If already installed or dismissed, don't show
  if (isInstalled || isDismissed || (!isInstallable && !isIOS)) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="fixed bottom-20 sm:bottom-22 right-3 left-3 sm:left-auto sm:right-6 z-40 max-w-sm"
      >
        <div className="bg-gradient-to-r from-[#065f46] via-[#047857] to-[#064e3b] text-white p-3.5 rounded-2xl shadow-xl border border-[#6ee7b7]/30 flex items-center justify-between gap-3 backdrop-blur-md">
          {/* Logo & Text */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 p-1 border border-white/20 shrink-0 flex items-center justify-center shadow-inner overflow-hidden">
              <img src="/logo.svg" alt="Habit Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-black text-white tracking-tight">Install Habit App</h4>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-[#10b981] text-[#022c22]">
                  PWA
                </span>
              </div>
              <p className="text-[10px] text-emerald-100/80 font-medium truncate">
                {isIOS ? 'Add to Home Screen for best experience' : 'Fast, offline ready & home screen access'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleInstallClick}
              className="px-3 py-1.5 rounded-xl bg-[#10b981] hover:bg-[#34d399] text-[#022c22] text-xs font-black transition-all flex items-center gap-1 shadow-md hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Install</span>
            </button>

            <button
              onClick={() => setIsDismissed(true)}
              className="p-1.5 text-emerald-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* iOS installation tooltip modal/banner if triggered */}
        {showIOSTip && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 p-3 bg-white text-[#022c22] rounded-xl text-xs border border-emerald-200 shadow-lg"
          >
            <p className="font-bold text-[#065f46] mb-1 flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5" />
              How to Install on iPhone / iPad:
            </p>
            <p className="text-[11px] text-gray-600">
              1. Tap the <strong>Share</strong> icon in Safari bottom bar.<br />
              2. Scroll down and tap <strong>"Add to Home Screen"</strong>.
            </p>
            <button
              onClick={() => setShowIOSTip(false)}
              className="mt-2 w-full py-1 text-center bg-[#047857] text-white font-bold rounded-lg text-[10px] cursor-pointer"
            >
              Got it
            </button>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
