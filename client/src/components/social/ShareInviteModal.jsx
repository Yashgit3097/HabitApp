import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Copy, Check, Share2, Link as LinkIcon, MessageCircle, Sparkles, QrCode } from 'lucide-react';
import { Avatar } from '../common/Avatar';

export const ShareInviteModal = ({ group, isOpen, onClose }) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen || !group) return null;

  const joinCode = group.joinCode || 'SANKALP-7X29';
  const joinLink = `${window.location.origin}/join/${joinCode}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(joinCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `🌟 Join our habit tracking group "${group.name}" on Habit!\n\nUse Join Code: *${joinCode}*\nOr tap this direct link: ${joinLink}\n\nLet's stay disciplined and track our daily Sankalp together! 💪`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-emerald-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-emerald-100 overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#065f46] text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-[#10b981]" />
            <h2 className="text-base font-black tracking-tight">Invite Friends & Family</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-emerald-700/80 text-emerald-200 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Group Card Header */}
          <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 flex items-center gap-3">
            <Avatar src={group.avatar} name={group.name} size="md" />
            <div className="flex-1 min-w-0">
              <h3 className="font-extrabold text-[#022c22] text-sm truncate">{group.name}</h3>
              <p className="text-[11px] text-emerald-800 font-semibold">
                {group.members?.length || 1} Active Member{group.members?.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Join Code Box */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-950 mb-1">
              Group Join Code
            </label>
            <div className="flex items-center justify-between p-3 bg-emerald-950 rounded-2xl text-white font-mono shadow-inner border border-emerald-800">
              <span className="text-lg font-black tracking-widest text-[#34d399] select-all">
                {joinCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="px-3 py-1.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-[#022c22] font-sans font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Code
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Shareable Direct Link */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-950 mb-1">
              Direct Invitation Link
            </label>
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-2xl border border-gray-200">
              <LinkIcon className="w-4 h-4 text-gray-400 shrink-0 ml-1.5" />
              <input
                type="text"
                readOnly
                value={joinLink}
                className="flex-1 bg-transparent text-xs font-semibold text-gray-700 outline-none truncate"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded-xl bg-[#047857] hover:bg-[#065f46] text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? 'Copied' : 'Copy Link'}
              </button>
            </div>
          </div>

          {/* Social Share Buttons */}
          <div className="pt-2">
            <button
              onClick={handleWhatsAppShare}
              className="w-full py-2.5 px-4 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              Share to WhatsApp
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
