import { Link, useRouter } from "@tanstack/react-router";
import { timeAgo } from "@/lib/time";
import { useAuth } from "@/contexts/auth";
import { useState, useEffect, useRef } from "react";
import { reportFn, unreportFn } from "@/actions/report.flagging";
import { deletePostFn } from "@/actions/post-submit";
import { voteSubmit, unvoteSubmit } from "@/actions/vote-submit";
import { adminHidePostFn } from "@/actions/admin-mod";
import { BadgeList } from "../badge";
import type { PostWithUsername } from "@/types/posts";
import { differenceInMinutes } from "date-fns";
import { EDIT_COOLDOWN_MINUTES } from "@/constants/limts";

export interface PostDetailProps {
  post: PostWithUsername;
  commentsLength: number;
}

export default function PostDetail({ post, commentsLength }: PostDetailProps) {
  // Extract domain from URL if it exists
  const domain = post.url
    ? new URL(post.url).hostname.replace("www.", "")
    : null;
  const { user } = useAuth();
  const router = useRouter();
  const [didReported, setDidReported] = useState(post.didReport);
  const [didVote, setDidVote] = useState(post.didVote);
  const [voteCount, setVoteCount] = useState(post.votes);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [confirmAdminHide, setConfirmAdminHide] = useState(false);
  const [adminHideReason, setAdminHideReason] = useState("");
  const [adminHideError, setAdminHideError] = useState<string | null>(null);
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
      setVoteCount((prev) => prev + 1);

      // if didn't vote, vote
      const result = await voteSubmit({
        data: {
          postId: post.postId,
        },
      });
      if (!result.success) {
        // Rollback on failure
        setDidVote(false);
        setVoteCount((prev) => prev - 1);
      }
    } else {
      // Optimistic update
      setDidVote(false);
      setVoteCount((prev) => prev - 1);

      // if voted, unvote
      const result = await unvoteSubmit({
        data: {
          postId: post.postId,
        },
      });
      if (!result.success) {
        // Rollback on failure
        setDidVote(true);
        setVoteCount((prev) => prev + 1);
      }
    }
  };

  const handleReport = async () => {
    if (!didReported) {
      // if didn't report, report
      const result = await reportFn({
        data: {
          report: {
            postId: post.postId,
          },
        },
      });
      if (result.success) {
        // Toggle the reporting state
        setDidReported(!didReported);
      }
    } else {
      // if reported, unreport
      const result = await unreportFn({
        data: {
          report: {
            postId: post.postId,
          },
        },
      });
      if (result.success) {
        // Toggle the reporting state
        setDidReported(!didReported);
      }
    }
  };

  const handleDelete = async () => {
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
    const result = await deletePostFn({
      data: { postId: post.postId },
    });
    if (result.success) {
      // Redirect to home page
      router.navigate({ to: "/" });
    }

    // Clear timer if delete was confirmed
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
    }
  };

  const handleAdminHide = async () => {
    // First click: show reason input
    if (!confirmAdminHide) {
      setConfirmAdminHide(true);
      setAdminHideError(null);
      // Auto-reset after 30 seconds
      adminHideTimerRef.current = setTimeout(() => {
        setConfirmAdminHide(false);
        setAdminHideReason("");
        setAdminHideError(null);
      }, 30000);
      return;
    }

    // Validate reason
    if (!adminHideReason || adminHideReason.trim().length === 0) {
      setAdminHideError("سبب الإخفاء مطلوب");
      return;
    }

    if (adminHideReason.length > 512) {
      setAdminHideError("السبب يجب ألا يتجاوز 512 حرفاً");
      return;
    }

    // Second interaction: actually hide
    const result = await adminHidePostFn({
      data: { postId: post.postId, reason: adminHideReason },
    });

    if (result.success) {
      // Redirect to home page
      router.navigate({ to: "/" });
    } else {
      setAdminHideError(result.error || "حدث خطأ أثناء إخفاء المنشور");
    }

    // Clear timer if hide was confirmed
    if (adminHideTimerRef.current) {
      clearTimeout(adminHideTimerRef.current);
    }
  };

  const handleCancelAdminHide = () => {
    setConfirmAdminHide(false);
    setAdminHideReason("");
    setAdminHideError(null);
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

  return (
    <div className="w-full px-2 py-3 text-xs font-mono">
      {/* Title and domain */}
      <div className="flex items-start gap-2 mb-2">
        {/* Upvote arrow */}
        {!didVote && (
          <div className="pt-0.5 shrink-0">
            <button
              type="button"
              onClick={handleVote}
              disabled={!isLoggedIn || user?.username === post.username}
              className="text-zinc-400 hover:text-[#006CFF] transition-colors text-xs leading-none p-0 m-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ▲
            </button>
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-baseline gap-1 flex-wrap mb-1">
            {post.url ? (
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-900 hover:text-[#006CFF] transition-colors font-normal text-sm leading-snug"
              >
                {post.title}
              </a>
            ) : (
              <span className="text-zinc-900 font-normal text-sm leading-snug">
                {post.title}
              </span>
            )}
            {post.updatedAt &&
              differenceInMinutes(
                new Date(post.updatedAt),
                new Date(post.createdAt),
              ) >= 5 && (
                <em className="text-[10px] text-zinc-400">
                  (معدل {timeAgo(post.updatedAt)})
                </em>
              )}
            {domain && (
              <a
                href={post.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-zinc-400 hover:text-zinc-600 hover:underline transition-colors"
              >
                ({domain})
              </a>
            )}
          </div>
          {/* Metadata */}
          <div className="text-[10px] text-zinc-500 flex items-center gap-1 flex-wrap">
            <span>
              {voteCount}{" "}
              {voteCount === 1
                ? "نقطة"
                : voteCount === 2
                  ? "نقطتين"
                  : voteCount > 2 && voteCount <= 10
                    ? "نقاط"
                    : "نقطة"}
            </span>
            <span className="text-zinc-400">•</span>
            <Link
              to="/user/$username"
              params={{ username: post.username }}
              className="hover:text-[#006CFF] hover:underline transition-colors"
            >
              {post.username}
            </Link>
            {post.userBadges.length > 0 && (
              <BadgeList badges={post.userBadges} />
            )}
            {isLoggedIn &&
              user.username === post.username &&
              differenceInMinutes(new Date(), new Date(post.createdAt)) <
                EDIT_COOLDOWN_MINUTES && (
                <>
                  <span className="text-zinc-400">•</span>
                  <Link
                    to="/post/e/$postId"
                    params={{ postId: post.postId }}
                    className="hover:text-[#006CFF] hover:underline transition-colors cursor-pointer"
                  >
                    تعديل
                  </Link>
                  <span className="text-zinc-400">•</span>
                  <button
                    type="button"
                    className={`${
                      confirmDelete ? "text-red-600 font-bold" : "text-zinc-500"
                    } hover:text-red-500 hover:underline transition-colors cursor-pointer`}
                    onClick={handleDelete}
                  >
                    {confirmDelete ? "تأكيد الحذف" : "حذف"}
                  </button>
                </>
              )}
            <span className="text-zinc-400">•</span>
            <span>{timeAgo(post.createdAt)}</span>
            {isLoggedIn && didVote && (
              <>
                <span className="text-zinc-400">•</span>
                <button
                  type="button"
                  onClick={handleVote}
                  className="text-zinc-500 hover:text-red-500 hover:underline transition-colors cursor-pointer"
                >
                  إلغاء التصويت
                </button>
              </>
            )}
            {isLoggedIn && (
              <>
                <span className="text-zinc-400">•</span>
                {didReported ? (
                  <button
                    type="button"
                    className="text-zinc-400 hover:text-red-500 hover:underline transition-colors cursor-pointer"
                    onClick={handleReport}
                  >
                    الغاء الإبلاغ
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-zinc-400 hover:text-red-500 hover:underline transition-colors cursor-pointer"
                    onClick={handleReport}
                  >
                    إبلاغ
                  </button>
                )}
              </>
            )}
            <span className="text-zinc-400">•</span>
            {commentsLength === 0
              ? "بلا تعليقات"
              : commentsLength === 1
                ? "تعليق واحد"
                : commentsLength === 2
                  ? "تعليقان"
                  : commentsLength <= 10
                    ? `${commentsLength} تعليقات`
                    : `${commentsLength} تعليق`}
          </div>

          {/* Moderator Tools */}
          {isModerator && post.username !== user?.username && (
            <div className="text-[10px] text-zinc-500 flex items-start gap-1 flex-wrap mt-1">
              <span className="font-medium text-purple-600">
                ادوات الادارة:
              </span>
              <Link
                to="/post/e/$postId"
                params={{ postId: post.postId }}
                className="hover:text-purple-600 hover:underline transition-colors cursor-pointer"
              >
                تعديل المنشور
              </Link>
              <span className="text-zinc-400">•</span>
              {!confirmAdminHide ? (
                <button
                  type="button"
                  onClick={handleAdminHide}
                  className="text-zinc-500 hover:text-red-600 hover:underline transition-colors cursor-pointer"
                >
                  إخفاء المنشور
                </button>
              ) : (
                <div className="flex flex-col gap-1 w-full mt-1">
                  <textarea
                    value={adminHideReason}
                    onChange={(e) => setAdminHideReason(e.target.value)}
                    placeholder="سبب الإخفاء (مطلوب)"
                    className="w-full px-2 py-1.5 text-xs font-mono border border-zinc-300 rounded focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 min-h-[60px] resize-y text-right"
                    dir="rtl"
                    maxLength={512}
                  />
                  {adminHideError && (
                    <span className="text-red-500 text-[10px]">
                      {adminHideError}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAdminHide}
                      className="px-2 py-0.5 text-[10px] border border-red-500 text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                    >
                      تأكيد الإخفاء
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelAdminHide}
                      className="px-2 py-0.5 text-[10px] text-zinc-600 hover:text-zinc-900 transition-colors"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Text content for Ask/text posts */}
      {post.text && (
        <div className="text-zinc-500 text-xs leading-relaxed mt-3 pr-7 whitespace-pre-wrap">
          {post.text}
        </div>
      )}
    </div>
  );
}
