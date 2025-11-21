import { useState } from "react";
import { adminUnhidePostFn, adminUnhideCommentFn } from "@/actions/admin-mod";
import type { HiddenContent } from "@/db/queries/admin";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface HiddenContentRowProps {
  content: HiddenContent;
  onUpdate?: () => void;
}

export default function HiddenContentRow({
  content,
  onUpdate,
}: HiddenContentRowProps) {
  const [loading, setLoading] = useState(false);
  const [confirmUnhide, setConfirmUnhide] = useState(false);

  const handleUnhide = async () => {
    if (!confirmUnhide) {
      setConfirmUnhide(true);
      setTimeout(() => setConfirmUnhide(false), 5000);
      return;
    }

    setLoading(true);
    try {
      if (content.contentType === "post") {
        await adminUnhidePostFn({ data: { postId: content.contentId } });
      } else {
        await adminUnhideCommentFn({ data: { commentId: content.contentId } });
      }
      onUpdate?.();
    } catch (error) {
      console.error("Failed to unhide content:", error);
    } finally {
      setLoading(false);
      setConfirmUnhide(false);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(content.hiddenAt), {
    addSuffix: true,
    locale: ar,
  });

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case "auto":
        return "تلقائي";
      case "admin":
        return "مشرف";
      case "user":
        return "مستخدم";
      default:
        return "غير معروف";
    }
  };

  return (
    <tr className="border-b border-zinc-200 hover:bg-zinc-50/30 transition-colors">
      <td className="py-3 px-4 font-mono text-sm text-zinc-600">
        {content.contentType === "post" ? "منشور" : "تعليق"}
      </td>
      <td className="py-3 px-4 font-mono text-sm">
        {content.contentTitle && (
          <div className="font-bold mb-1">{content.contentTitle}</div>
        )}
        <div className="text-zinc-700 line-clamp-2">
          {content.contentText || "لا يوجد نص"}
        </div>
      </td>
      <td className="py-3 px-4 font-mono text-sm text-center">
        {content.authorUsername}
      </td>
      <td className="py-3 px-4 font-mono text-sm text-center">
        {content.reportCount}
      </td>
      <td className="py-3 px-4 font-mono text-sm text-zinc-600">
        {getReasonLabel(content.hiddenReason)}
      </td>
      <td className="py-3 px-4 font-mono text-xs text-zinc-500 text-center">
        {timeAgo}
      </td>
      <td className="py-3 px-4 text-sm">
        <button
          type="button"
          onClick={handleUnhide}
          disabled={loading}
          className={`text-xs font-mono disabled:opacity-50 ${
            confirmUnhide
              ? "text-zinc-900 underline"
              : "text-blue-600 hover:underline"
          }`}
        >
          {confirmUnhide ? "تأكيد الاستعادة" : "استعادة"}
        </button>
      </td>
    </tr>
  );
}
