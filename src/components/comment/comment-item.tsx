import { Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import CommentForm from "./comment-form";
import type { CommentSubmission } from "@/schemas/forms/comment";
import { timeAgo } from "@/lib/time";
import { useAuth } from "@/contexts/auth";
import { reportFn, unreportFn } from "@/actions/report.flagging";
import { voteSubmit, unvoteSubmit } from "@/actions/vote-submit";
import { deleteCommentFn, editCommentFn } from "@/actions/comment-submit";
import { adminHideCommentFn } from "@/actions/admin-mod";
import { useCommentsStore } from "@/stores/comments";
import { commentSubmitFn } from "@/actions/comment-submit";
import type { Comment } from "@/components/comment/comment-thread";
import { differenceInMinutes } from "date-fns";
import {
  EDIT_COOLDOWN_MINUTES,
  MAX_COMMENT_TEXT_LENGTH,
} from "@/constants/limts";

export interface CommentItemProps {
  postId: string;
  depth: number;
  comment: Comment;
  children?: React.ReactNode;
  postHidden?: boolean;
}

export default function CommentItem({
  postId,
  depth,
  comment,
  children,
  postHidden = false,
}: CommentItemProps) {
  const { user } = useAuth();
  const { addComment, updateComment, updateCommentVote, hideComment } =
    useCommentsStore();
  const [collapsed, setCollapsed] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [didReport, setDidReport] = useState(comment.didReport);
  const [didVote, setDidVote] = useState(comment.didVote);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmAdminHide, setConfirmAdminHide] = useState(false);
  const adminHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLoggedIn = user !== null;
  const isModerator = user?.role === "moderator";

  const handleReplySubmit = async (submission: CommentSubmission) => {
    if (!user) return;

    const result = await commentSubmitFn({ data: submission });

    if (result.success && result.comment) {
      // Add comment to store with username
      addComment({
        ...result.comment,
        username: comment.username,
        didReport: false,
        didVote: false,
        hidden: result.comment.hidden ?? false,
        updatedAt: result.comment.updatedAt ?? "",
      });
      setShowReplyForm(false);
    }
  };

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
        // Toggle the reporting state
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
        // Toggle the reporting state
        setDidReport(!didReport);
      }
    }
  };

  const handleDelete = async () => {
    if (!user) {
      return;
    }

    // First click: ask for confirmation
    if (!confirmDelete) {
      setConfirmDelete(true);
      // Auto-reset after 5 seconds
      deleteTimerRef.current = setTimeout(() => {
        setConfirmDelete(false);
      }, 5000);
      return;
    }

    // Second click: actually delete
    const result = await deleteCommentFn({
      data: { commentId: comment.id },
    });
    if (result.success) {
      // Hide comment in store
      hideComment(comment.id);
    }

    // Clear timer if delete was confirmed
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
    }
  };

  const handleEditComment = async () => {
    if (!user) return;

    // Validate
    if (!editText || editText.trim().length < 2) {
      setEditError("التعليق قصير جداً");
      return;
    }

    if (editText.length > MAX_COMMENT_TEXT_LENGTH) {
      setEditError(
        `التعليق طويل جداً (الحد الأقصى ${MAX_COMMENT_TEXT_LENGTH} حرف)`,
      );
      return;
    }

    const createdAtDate = new Date(comment.createdAt);
    const now = new Date();
    if (differenceInMinutes(now, createdAtDate) > EDIT_COOLDOWN_MINUTES) {
      setEditError(
        `انتهت مهلة تعديل التعليق (${EDIT_COOLDOWN_MINUTES} دقيقة فقط)`,
      );
      return;
    }

    // Call server action
    const result = await editCommentFn({
      data: { commentId: comment.id, text: editText },
    });

    if (result.success) {
      // Update zustand store with new timestamp
      updateComment(comment.id, editText, new Date());
      setIsEditing(false);
      setEditError(null);
    } else {
      setEditError(result.error || "حدث خطأ أثناء تعديل التعليق");
    }
  };

  const handleCancelEdit = () => {
    setEditText(comment.text);
    setIsEditing(false);
    setEditError(null);
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
      // Hide comment in store
      hideComment(comment.id);
    }

    // Clear timer if hide was confirmed
    if (adminHideTimerRef.current) {
      clearTimeout(adminHideTimerRef.current);
    }
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
      }
      if (adminHideTimerRef.current) {
        clearTimeout(adminHideTimerRef.current);
      }
    };
  }, []);

  // Calculate indentation (40px = 5 levels, so 8px per level)
  const indentSize = depth * 8;

  // If comment is hidden, render a placeholder
  if (comment.hidden) {
    return (
      <div className="w-full" style={{ paddingRight: `${indentSize}px` }}>
        <div className="flex items-start gap-1.5 py-1.5 text-xs font-mono">
          {/* Left border for nested comments */}
          {depth > 0 && <div className="w-px bg-zinc-200 self-stretch mr-1" />}

          <div className="flex-1 min-w-0">
            {/* Minimal header for deleted comments */}
            <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-1">
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                className="text-zinc-400 hover:text-zinc-600 transition-colors font-mono cursor-pointer"
              >
                [{collapsed ? "+" : "-"}]
              </button>
              <span className="text-zinc-400 italic">[تم حذف هذا التعليق]</span>
            </div>

            {/* Show children even if parent is deleted */}
            {!collapsed && children && <div className="mt-1">{children}</div>}
          </div>
        </div>
      </div>
    );
  }

  // Normal comment rendering
  return (
    <div className="w-full" style={{ paddingRight: `${indentSize}px` }}>
      <div className="flex items-start gap-1.5 py-1.5 text-xs font-mono">
        {/* Left border for nested comments */}
        {depth > 0 && <div className="w-px bg-zinc-200 self-stretch mr-1" />}

        <div className="flex-1 min-w-0">
          {/* Comment header */}
          <div className="flex items-center gap-1 text-[10px] text-zinc-500 mb-1">
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="text-zinc-400 hover:text-zinc-600 transition-colors font-mono cursor-pointer"
            >
              [{collapsed ? "+" : "-"}]
            </button>
            <Link
              to="/user/$username"
              params={{ username: comment.username }}
              className="hover:text-[#006CFF] hover:underline transition-colors"
            >
              {comment.username}
            </Link>
            <span className="text-zinc-400">•</span>
            <span>{timeAgo(comment.createdAt)}</span>
            {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
              <>
                <span className="text-zinc-400">•</span>
                <span
                  className="text-zinc-400 italic"
                  title={`معدّل ${timeAgo(comment.updatedAt)}`}
                >
                  (معدّل {timeAgo(comment.updatedAt)})
                </span>
              </>
            )}
            <span className="text-zinc-400">•</span>
            {!didVote ? (
              <button
                type="button"
                onClick={handleVote}
                disabled={!isLoggedIn || user?.username === comment.username}
                className="text-zinc-400 hover:text-[#006CFF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ▲ {comment.votes}
              </button>
            ) : (
              <span className="text-zinc-400">
                {comment.votes}{" "}
                {comment.votes === 1
                  ? "نقطة"
                  : comment.votes === 2
                    ? "نقطتين"
                    : "نقاط"}
              </span>
            )}
          </div>

          {/* Comment content (hidden when collapsed) */}
          {!collapsed && (
            <>
              {/* Comment text or edit form */}
              {isEditing ? (
                <div className="mb-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs font-mono border border-zinc-300 rounded focus:outline-none focus:border-[#006CFF] focus:ring-1 focus:ring-[#006CFF] min-h-[80px] resize-y text-right"
                    dir="rtl"
                  />
                  {editError && (
                    <span className="text-red-500 text-[10px] mt-1 block">
                      {editError}
                    </span>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={handleEditComment}
                      className="px-2 py-0.5 text-[10px] border border-gray-400 hover:bg-gray-100 cursor-pointer transition-colors"
                    >
                      حفظ
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-3 py-1 text-[10px] font-mono text-zinc-600 hover:text-zinc-900 transition-colors"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-zinc-800 text-xs leading-relaxed mb-2 whitespace-pre-wrap">
                  {comment.text}
                </div>
              )}

              {/* Actions */}
              {!isEditing && (
                <div className="flex items-center gap-2 mb-2">
                  {isLoggedIn && didVote && (
                    <>
                      <button
                        type="button"
                        onClick={handleVote}
                        className="text-[10px] text-zinc-500 hover:text-red-500 hover:underline transition-colors cursor-pointer"
                      >
                        إلغاء التصويت
                      </button>
                      <span className="text-zinc-400">•</span>
                    </>
                  )}
                  {isLoggedIn && !postHidden && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowReplyForm(!showReplyForm)}
                        className="text-[10px] cursor-pointer text-zinc-500 hover:text-[#006CFF] hover:underline transition-colors"
                      >
                        رد
                      </button>
                      <span className="text-zinc-400">•</span>
                    </>
                  )}
                  {isLoggedIn &&
                    user?.username === comment.username &&
                    differenceInMinutes(
                      new Date(),
                      new Date(comment.createdAt),
                    ) < EDIT_COOLDOWN_MINUTES && (
                      <>
                        {!postHidden && (
                          <>
                            <button
                              type="button"
                              onClick={() => setIsEditing(true)}
                              className="text-[10px] text-zinc-500 hover:text-[#006CFF] hover:underline transition-colors cursor-pointer"
                            >
                              تعديل
                            </button>
                            <span className="text-zinc-400">•</span>
                          </>
                        )}
                        <button
                          type="button"
                          className={`text-[10px] ${
                            confirmDelete
                              ? "text-red-600 font-bold"
                              : "text-zinc-500"
                          } hover:text-red-500 hover:underline transition-colors cursor-pointer`}
                          onClick={handleDelete}
                        >
                          {confirmDelete ? "تأكيد الحذف" : "حذف"}
                        </button>
                        <span className="text-zinc-400">•</span>
                      </>
                    )}
                  {isLoggedIn &&
                    (didReport ? (
                      <button
                        type="button"
                        className="text-[10px] text-zinc-500 hover:text-red-500 hover:underline transition-colors cursor-pointer"
                        onClick={handleReport}
                      >
                        الغاء الإبلاغ
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-[10px] text-zinc-500 hover:text-red-500 hover:underline transition-colors cursor-pointer"
                        onClick={handleReport}
                      >
                        إبلاغ
                      </button>
                    ))}
                  {isModerator && user?.username !== comment.username && (
                    <>
                      <span className="text-zinc-400">•</span>
                      <button
                        type="button"
                        className={`text-[10px] ${
                          confirmAdminHide
                            ? "text-purple-600 font-bold"
                            : "text-purple-500"
                        } hover:text-purple-700 hover:underline transition-colors cursor-pointer`}
                        onClick={handleAdminHide}
                      >
                        {confirmAdminHide
                          ? "تأكيد الإخفاء (مشرف)"
                          : "إخفاء (مشرف)"}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Reply form */}
              {showReplyForm && !postHidden && (
                <div className="mb-2">
                  <CommentForm
                    parentId={comment.id}
                    onSubmit={handleReplySubmit}
                    onCancel={() => setShowReplyForm(false)}
                    placeholder="اكتب ردك..."
                    isReply={true}
                    postId={postId}
                  />
                </div>
              )}

              {/* Nested replies */}
              {children && <div className="mt-1">{children}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
