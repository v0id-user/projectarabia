import { Link } from "@tanstack/react-router";
import { timeAgo } from "@/lib/time";
import type { PostWithOrder } from "@/thealgorithm/ranking";
import { useAuth } from "@/contexts/auth";
import { reportFn, unreportFn } from "@/actions/report.flagging";
import { voteSubmit, unvoteSubmit } from "@/actions/vote-submit";
import { usePostsStore } from "@/stores/posts";
import { useState } from "react";

export default function PostRow({ post, rank }: PostWithOrder) {
  // Extract domain from URL if it exists
  const domain = post.url
    ? new URL(post.url).hostname.replace("www.", "")
    : null;

  const { user } = useAuth();
  const { updatePostVote } = usePostsStore();
  const [didReport, setDidReport] = useState(post.didReport);
  const [didVote, setDidVote] = useState(post.didVote);
  const isLoggedIn = user !== null;

  const handleVote = async () => {
    if (!user) {
      return;
    }

    if (!didVote) {
      // Optimistic update
      setDidVote(true);
      updatePostVote(post.postId, true, 1);

      // if didn't vote, vote
      const result = await voteSubmit({
        data: {
          postId: post.postId,
        },
      });
      if (!result.success) {
        // Rollback on failure
        setDidVote(false);
        updatePostVote(post.postId, false, -1);
      }
    } else {
      // Optimistic update
      setDidVote(false);
      updatePostVote(post.postId, false, -1);

      // if voted, unvote
      const result = await unvoteSubmit({
        data: {
          postId: post.postId,
        },
      });
      if (!result.success) {
        // Rollback on failure
        setDidVote(true);
        updatePostVote(post.postId, true, 1);
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
            postId: post.postId,
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
            postId: post.postId,
          },
        },
      });

      if (result.success) {
        // Toggle the reporting state
        setDidReport(!didReport);
      }
    }
  };

  return (
    <div className="flex w-full items-center gap-1.5 py-1 px-2 text-xs font-mono hover:bg-zinc-50/30 transition-colors">
      {/* Rank number */}
      {rank && (
        <span className="text-zinc-400 text-[10px] pt-0.5 w-5 text-right shrink-0">
          {rank}.
        </span>
      )}
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
      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title and domain */}
        <div className="flex items-baseline gap-1 flex-wrap">
          {post.url ? (
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-900 hover:text-[#006CFF] transition-colors font-normal text-xs leading-snug"
            >
              {post.title}
            </a>
          ) : (
            <Link
              to="/post/i/$postId"
              params={{ postId: post.postId }}
              className="text-zinc-900 hover:text-[#006CFF] transition-colors font-normal text-xs leading-snug"
            >
              {post.title}
            </Link>
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
        <div className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-1 flex-wrap">
          <span>
            {post.votes}{" "}
            {post.votes === 1
              ? "نقطة"
              : post.votes === 2
                ? "نقطتين"
                : post.votes > 2 && post.votes <= 10
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
          {isLoggedIn && (
            <>
              <span className="text-zinc-400">•</span>
              <span>
                {didReport ? (
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
              </span>
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
          <span className="text-zinc-400">•</span>
          <Link
            to="/post/i/$postId"
            params={{ postId: post.postId }}
            className="hover:text-[#006CFF] hover:underline transition-colors"
          >
            {post.commentCount === 0
              ? "بلا تعليقات"
              : post.commentCount === 1
                ? "تعليق واحد"
                : post.commentCount === 2
                  ? "تعليقان"
                  : post.commentCount <= 10
                    ? `${post.commentCount} تعليقات`
                    : `${post.commentCount} تعليق`}
          </Link>
        </div>
      </div>
    </div>
  );
}
