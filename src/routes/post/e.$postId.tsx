import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import SubmitForm from "@/components/post/post-form";
import { getCurrentUserFn } from "@/actions/getter.auth";
import { useState } from "react";
import type { PostSubmition } from "@/schemas/forms/post";
import { getPostbyIdFn } from "@/actions/get-post";
import { editPostFn } from "@/actions/post-submit";
import { adminEditPostFn } from "@/actions/admin-mod";
import { differenceInMinutes } from "date-fns";
import { EDIT_COOLDOWN_MINUTES, MAX_ABOUT_LENGTH } from "@/constants/limts";
import { logger } from "@/lib/logger";

export const Route = createFileRoute("/post/e/$postId")({
  component: RouteComponent,
  beforeLoad: async () => {
    try {
      logger.info("routes/post/e.$postId:beforeLoad");
      const user = await getCurrentUserFn();
      if (!user) {
        logger.warn("routes/post/e.$postId:beforeLoad:unauthorized");
        throw redirect({ to: "/login" });
      }
      logger.info("routes/post/e.$postId:beforeLoad:success", {
        userId: user.userId,
      });
    } catch (error) {
      if (error instanceof Response) throw error;
      logger.error("routes/post/e.$postId:beforeLoad", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
  loader: async ({ params }) => {
    try {
      logger.info("routes/post/e.$postId:loader", { postId: params.postId });
      const user = await getCurrentUserFn();
      const postData = await getPostbyIdFn({
        data: { postId: params.postId },
      });

      // Check if user is owner or moderator
      if (!postData.post) {
        logger.warn("routes/post/e.$postId:loader:notFound", {
          postId: params.postId,
        });
        throw redirect({ to: "/" });
      }

      const isOwner = user?.userId === postData.post.userId;
      const isModerator = user?.role === "moderator";

      if (!isOwner && !isModerator) {
        logger.warn("routes/post/e.$postId:loader:unauthorized", {
          postId: params.postId,
          userId: user?.userId,
          isOwner,
          isModerator,
        });
        throw redirect({ to: "/" });
      }

      logger.info("routes/post/e.$postId:loader:success", {
        postId: params.postId,
        isOwner,
        isModerator,
      });
      return { ...postData, isOwner, isModerator };
    } catch (error) {
      if (error instanceof Response) throw error;
      logger.error("routes/post/e.$postId:loader", {
        postId: params.postId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});

function RouteComponent() {
  const [error, setError] = useState<string | null>(null);
  const [adminReason, setAdminReason] = useState("");
  const router = useRouter();
  const { post, isOwner, isModerator } = Route.useLoaderData();

  if (!post) {
    return (
      <div className="w-full max-w-4xl mx-auto px-2 py-8">
        <p className="text-center text-zinc-500 font-mono text-sm">
          المنشور غير موجود
        </p>
      </div>
    );
  }

  const isModeratorEdit = isModerator && !isOwner;

  const handleSubmit = async (data: PostSubmition) => {
    try {
      setError(null);

      const createdAtDate = new Date(post.createdAt);
      const now = new Date();
      if (
        differenceInMinutes(now, createdAtDate) > EDIT_COOLDOWN_MINUTES &&
        !isModeratorEdit
      ) {
        setError(
          `انتهت مهلة تعديل المنشور (${EDIT_COOLDOWN_MINUTES} دقيقة فقط)`,
        );
        return;
      }

      // If moderator editing someone else's post, validate reason
      if (isModeratorEdit) {
        if (!adminReason || adminReason.trim().length === 0) {
          setError("سبب التعديل مطلوب للمشرفين");
          return;
        }
        if (adminReason.length > MAX_ABOUT_LENGTH) {
          setError(`سبب التعديل يجب ألا يتجاوز ${MAX_ABOUT_LENGTH} حرفاً`);
          return;
        }

        // Use admin edit function
        const result = await adminEditPostFn({
          data: {
            post: data.post,
            postId: post.id,
            cf_turnstile: data.cf_turnstile,
            reason: adminReason,
          },
        });

        if (result && "success" in result) {
          if (result.success && result.postId) {
            router.navigate({
              to: "/post/i/$postId",
              params: { postId: post.id },
            });
            return;
          } else if (!result.success && result.error) {
            setError(result.error);
            return;
          }
        }
      } else {
        // Regular user edit
        const result = await editPostFn({
          data: {
            post: data.post,
            postId: post.id,
            cf_turnstile: data.cf_turnstile,
          },
        });

        if (result && "success" in result) {
          if (result.success && result.postId) {
            router.navigate({
              to: "/post/i/$postId",
              params: { postId: post.id },
            });
            return;
          } else if (!result.success && result.error) {
            setError(result.error);
            return;
          }
        }
      }

      setError("حدث خطأ أثناء تعديل المنشور");
    } catch (err) {
      setError("حدث خطأ أثناء تعديل المنشور");
      console.error(err);
    }
  };

  return (
    <div className="w-full">
      <h1 className="text-base font-normal mb-4">
        {isModeratorEdit ? "تعديل المنشور (كمشرف)" : "تعديل المنشور"}
      </h1>
      {error && (
        <div className="max-w-2xl p-4 mb-4 bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      )}
      {isModeratorEdit && (
        <div className="max-w-2xl mb-4">
          <span className="block text-sm font-mono mb-2 text-purple-600">
            سبب التعديل (مطلوب للمشرفين) *
          </span>
          <textarea
            value={adminReason}
            onChange={(e) => setAdminReason(e.target.value)}
            placeholder="اكتب سبب التعديل هنا..."
            className="w-full px-3 py-2 text-sm font-mono border border-purple-300 rounded focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 min-h-[80px] resize-y text-right"
            dir="rtl"
            maxLength={MAX_ABOUT_LENGTH}
            required
          />
          <p className="text-xs text-zinc-500 mt-1">
            {adminReason.length}/{MAX_ABOUT_LENGTH} حرف
          </p>
        </div>
      )}
      <SubmitForm onSubmit={handleSubmit} post={post} />
    </div>
  );
}
