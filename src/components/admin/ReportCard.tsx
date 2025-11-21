import { useState } from "react";
import { adminHidePostFn, adminHideCommentFn } from "@/actions/admin-mod";
import type { ReportWithContext } from "@/db/queries/admin";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface ReportCardProps {
  report: ReportWithContext;
  onUpdate?: () => void;
}

export default function ReportCard({ report, onUpdate }: ReportCardProps) {
  const [loading, setLoading] = useState(false);
  const [confirmHide, setConfirmHide] = useState(false);

  const handleHide = async () => {
    if (!confirmHide) {
      setConfirmHide(true);
      setTimeout(() => setConfirmHide(false), 5000);
      return;
    }

    setLoading(true);
    try {
      if (report.contentType === "post") {
        await adminHidePostFn({
          data: { postId: report.contentId, reason: "مخفي من لوحة التحكم" },
        });
      } else {
        await adminHideCommentFn({
          data: { commentId: report.contentId },
        });
      }
      onUpdate?.();
    } catch (error) {
      console.error("Failed to hide content:", error);
    } finally {
      setLoading(false);
      setConfirmHide(false);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(report.createdAt), {
    addSuffix: true,
    locale: ar,
  });

  return (
    <div className="border border-zinc-200 p-4 mb-3 hover:bg-zinc-50/30 transition-colors">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-600">
            {report.contentType === "post" ? "منشور" : "تعليق"}
          </span>
          <span className="text-sm font-mono text-zinc-500">{timeAgo}</span>
        </div>
        <div className="text-sm font-bold font-mono text-zinc-900">
          {report.reportCount} بلاغ
        </div>
      </div>

      {/* Content */}
      <div className="mb-3">
        {report.contentTitle && (
          <div className="font-mono font-bold text-sm mb-2">
            {report.contentTitle}
          </div>
        )}
        <div className="font-mono text-sm text-zinc-700 line-clamp-3">
          {report.contentText || "لا يوجد نص"}
        </div>
        <div className="text-xs font-mono text-zinc-500 mt-2">
          بواسطة: {report.authorUsername}
        </div>
      </div>

      {/* Reporters */}
      <div className="mb-3">
        <div className="text-xs font-mono text-zinc-600 mb-1">
          المبلغون ({report.reporters.length}):
        </div>
        <div className="text-xs font-mono text-zinc-500">
          {report.reporters
            .slice(0, 5)
            .map((r) => r.username)
            .join(", ")}
          {report.reporters.length > 5 &&
            ` و ${report.reporters.length - 5} آخرون`}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleHide}
          disabled={loading}
          className={`text-sm font-mono disabled:opacity-50 ${
            confirmHide
              ? "text-zinc-900 underline"
              : "text-zinc-600 hover:underline"
          }`}
        >
          {confirmHide ? "تأكيد الإخفاء" : "إخفاء"}
        </button>
      </div>
    </div>
  );
}
