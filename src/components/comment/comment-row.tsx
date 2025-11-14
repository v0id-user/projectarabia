import { Link } from "@tanstack/react-router";
import { timeAgo } from "@/lib/time";
import type { CommentWithContext } from "@/services/comments";
import { useAuth } from "@/contexts/auth";
import { reportFn, unreportFn } from "@/actions/report.flagging";
import { voteSubmit, unvoteSubmit } from "@/actions/vote-submit";
import { adminHideCommentFn } from "@/actions/admin-mod";
import { useCommentFeedsStore } from "@/stores/comment-feeds";
import { useState, useEffect, useRef } from "react";

interface CommentRowProps {
  comment: CommentWithContext;
}

export default function CommentRow({ comment }: CommentRowProps) {
  const { user } = useAuth();
  const { updateCommentVote } = useCommentFeedsStore();
  const [didReport, setDidReport] = useState(comment.didReport);
  const [didVote, setDidVote] = useState(comment.didVote);
  const [confirmAdminHide, setConfirmAdminHide] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const adminHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLoggedIn = user !== null;
  const isModerator = user?.role === "moderator";

  const handleVote = async () => {
    if (!user) {
      return;
    }

    if (!didVote) {
      // Optimistic update
      setDidVote(true);
      updateCommentVote(comment.id, true, 1);

      // if didn't vote, vote
      const result = await voteSubmit({
        data: {
          commentId: comment.id,
        },
      });
      if (!result.success) {
        // Rollback on failure
        setDidVote(false);
        updateCommentVote(comment.id, false, -1);
      }
    } else {
      // Optimistic update
      setDidVote(false);
      updateCommentVote(comment.id, false, -1);

      // if voted, unvote
      const result = await unvoteSubmit({
        data: {
          commentId: comment.id,
        },
      });
      if (!result.success) {
        // Rollback on failure
        setDidVote(true);
        updateCommentVote(comment.id, true, 1);
      }
    }
  };

  const handleReport = async () => {
    if (!user) {
      return;
    }

    if (!didReport) {
      // if didn't report, report
      const result = await reportFn({
        data: {
          report: {
            commentId: comment.id,
          },
        },
      });

      if (result.success) {
        setDidReport(!didReport);
      }
    } else {
      // if reported, unreport
      const result = await unreportFn({
        data: {
          report: {
            commentId: comment.id,
          },
        },
      });

      if (result.success) {
        setDidReport(!didReport);
      }
    }
  };

  const handleAdminHide = async () => {
    if (!user) return;

    // First click: ask for confirmation
    if (!confirmAdminHide) {
      setConfirmAdminHide(true);
      // Auto-reset after 5 seconds
      adminHideTimerRef.current = setTimeout(() => {
        setConfirmAdminHide(false);
      }, 5000);
      return;
    }

    // Second click: actually hide
    const result = await adminHideCommentFn({
      data: { commentId: comment.id },
    });

    if (result.success) {
      // Mark as hidden to hide from view
      setIsHidden(true);
    }

    // Clear timer if hide was confirmed
    if (adminHideTimerRef.current) {
      clearTimeout(adminHideTimerRef.current);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (adminHideTimerRef.current) {
        clearTimeout(adminHideTimerRef.current);
      }
    };
  }, []);

  // If hidden by admin, don't render
  if (isHidden) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-1.5 py-2 px-2 text-xs font-mono hover:bg-zinc-50/30 transition-colors border-b border-zinc-100">
      {/* Header */}
      <div className="flex items-center gap-1 text-[10px] text-zinc-500 flex-wrap">
        <Link
          to="/user/$username"
          params={{ username: comment.username }}
          className="hover:text-[#006CFF] hover:underline transition-colors font-medium"
        >
          {comment.username}
        </Link>
        <span className="text-zinc-400">•</span>
        <span>{timeAgo(comment.createdAt)}</span>
        <span className="text-zinc-400">•</span>
        <span className="text-zinc-400">على:</span>
        <Link
          to="/post/i/$postId"
          params={{ postId: comment.postId }}
          className="hover:text-[#006CFF] hover:underline transition-colors"
        >
          {comment.postTitle}
        </Link>
      </div>

      {/* Quoted parent comment (if this is a reply) */}
      {comment.parentText && (
        <div className="bg-zinc-100 border-r-2 border-zinc-300 pr-2 py-1 my-1">
          <div className="text-[10px] text-zinc-600 whitespace-pre-wrap">
            {comment.parentText.split("\n").map((line, _i) => (
              <div key={crypto.randomUUID()}>| {line}</div>
            ))}
          </div>
        </div>
      )}

      {/* Comment text */}
      <div className="text-zinc-800 text-xs leading-relaxed whitespace-pre-wrap">
        {comment.text}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
        {!didVote ? (
          <button
            type="button"
            onClick={handleVote}
            disabled={!isLoggedIn || user?.username === comment.username}
            className="hover:text-[#006CFF] hover:underline transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ▲ {comment.votes}
          </button>
        ) : (
          <span>
            {comment.votes}{" "}
            {comment.votes === 1
              ? "نقطة"
              : comment.votes === 2
                ? "نقطتين"
                : comment.votes > 2 && comment.votes <= 10
                  ? "نقاط"
                  : "نقطة"}
          </span>
        )}
        {isLoggedIn && didVote && (
          <>
            <span className="text-zinc-400">•</span>
            <button
              type="button"
              onClick={handleVote}
              className="hover:text-red-500 hover:underline transition-colors cursor-pointer"
            >
              إلغاء التصويت
            </button>
          </>
        )}
        {isLoggedIn && (
          <>
            <span className="text-zinc-400">•</span>
            {didReport ? (
              <button
                type="button"
                className="hover:text-red-500 hover:underline transition-colors cursor-pointer"
                onClick={handleReport}
              >
                الغاء الإبلاغ
              </button>
            ) : (
              <button
                type="button"
                className="hover:text-red-500 hover:underline transition-colors cursor-pointer"
                onClick={handleReport}
              >
                إبلاغ
              </button>
            )}
          </>
        )}
        {isModerator && user?.username !== comment.username && (
          <>
            <span className="text-zinc-400">•</span>
            <button
              type="button"
              className={`${
                confirmAdminHide
                  ? "text-purple-600 font-bold"
                  : "text-purple-500"
              } hover:text-purple-700 hover:underline transition-colors cursor-pointer`}
              onClick={handleAdminHide}
            >
              {confirmAdminHide ? "تأكيد الإخفاء (مشرف)" : "إخفاء (مشرف)"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
