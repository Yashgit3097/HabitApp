import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Edit3, Save, MessageSquare } from 'lucide-react';
import api from '../../api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../../stores/uiStore';

export const EditReportModal = ({ report, isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  const [adminRemarks, setAdminRemarks] = useState(report?.adminRemarks || '');

  const updateMutation = useMutation({
    mutationFn: async () => {
      const reportId = report.id || report._id || 'temp';
      const res = await api.put(`/reports/${reportId}`, {
        ...report,
        adminRemarks: adminRemarks.trim()
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthlyReport'] });
      showToast('Monthly report updated successfully!', 'success');
      onClose();
    },
    onError: (err) => {
      showToast(err.response?.data?.message || 'Failed to update report', 'error');
    }
  });

  if (!isOpen || !report) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-emerald-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-emerald-100 overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#065f46] via-[#047857] to-[#065f46] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-emerald-200" />
            <h3 className="font-extrabold text-sm sm:text-base">Edit Monthly Report</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-emerald-700/80 text-emerald-200 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-950 mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#047857]" />
              <span>Admin / Creator Remarks & Feedback</span>
            </label>
            <textarea
              rows={4}
              value={adminRemarks}
              onChange={(e) => setAdminRemarks(e.target.value)}
              placeholder="Add personal notes, guidance, or acknowledgment for this month's discipline..."
              className="w-full px-3.5 py-2.5 bg-emerald-50/50 rounded-2xl border border-emerald-200 text-xs font-medium text-[#022c22] focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:bg-white transition-all"
            />
          </div>

          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-semibold">
            💡 As the habit creator or group admin, updates saved here will be permanently attached to this month's official report document.
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate()}
            className="px-5 py-2 rounded-xl bg-[#047857] hover:bg-[#065f46] text-white text-xs font-bold transition-all shadow-sm cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
