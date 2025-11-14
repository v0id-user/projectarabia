import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { postFormOpts, type PostSubmition } from "@/schemas/forms/post";
import { useForm } from "@tanstack/react-form";
import { useRef } from "react";
import type { Post } from "@/schemas/db/posts";
import { useSiteKey } from "@/hooks/useSiteKey";

export interface SubmitFormProps {
  onSubmit: (postRequest: PostSubmition) => void;
  post?: Post;
}

export default function PostForm({ onSubmit, post }: SubmitFormProps) {
  const defaultValues = !post
    ? { ...postFormOpts }
    : { defaultValues: { post: post, cf_turnstile: "" } };

  const form = useForm({
    ...defaultValues,
    onSubmit: async ({ value }) => {
      onSubmit(value);
    },
  });
  const ref = useRef<TurnstileInstance | null>(null);
  const siteKey = useSiteKey();

  // Show loading state while site key is being fetched
  if (!siteKey) {
    return (
      <div className="max-w-2xl">
        <div className="text-center text-sm text-gray-600">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="max-w-2xl"
    >
      {/* Title Field */}
      <div className="mb-3">
        <form.Field
          name="post.title"
          validators={{
            onChange: ({ value }) => {
              if (!value || value.trim() === "") {
                return "العنوان مطلوب";
              }
              if (value.length > 128) {
                return "العنوان يجب ألا يتجاوز 128 حرفاً";
              }
              return undefined;
            },
          }}
          // biome-ignore lint/correctness/noChildrenProp: Tanstack Form children prop must be a function and used as a prop
          children={(field) => (
            <>
              <label htmlFor={field.name} className="block text-sm mb-1">
                العنوان <span className="text-red-600">*</span>
              </label>
              <input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="أدخل عنوان المنشور (حتى 128 حرف)"
                className="w-full px-2 py-1 border border-gray-300 text-sm focus:outline-none focus:border-gray-500"
                required
              />
              {field.state.meta.isTouched && !field.state.meta.isValid && (
                <em className="block text-xs text-red-600 mt-1">
                  {field.state.meta.errors.join(", ")}
                </em>
              )}
            </>
          )}
        />
      </div>

      {/* Text/Body Field */}
      <div className="mb-3">
        <form.Field
          name="post.text"
          validators={{
            onChange: ({ value }) => {
              if (!value || value.trim() === "") {
                return "النص مطلوب";
              }
              if (value.length < 50) {
                return "النص يجب أن يكون 50 حرفاً على الأقل";
              }
              if (value.length > 2048) {
                return "النص يجب ألا يتجاوز 2048 حرفاً";
              }
              return undefined;
            },
          }}
          // biome-ignore lint/correctness/noChildrenProp: Tanstack Form children prop must be a function and used as a prop
          children={(field) => (
            <>
              <label htmlFor={field.name} className="block text-sm mb-1">
                النص <span className="text-red-600">*</span>
              </label>
              <textarea
                id={field.name}
                name={field.name}
                value={field.state.value || ""}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="أدخل نص المنشور (مطلوب: 50-2048 حرف)"
                rows={6}
                className="w-full px-2 py-1 border border-gray-300 text-sm focus:outline-none focus:border-gray-500 resize-y"
                required
              />
              {field.state.meta.isTouched && !field.state.meta.isValid && (
                <em className="block text-xs text-red-600 mt-1">
                  {field.state.meta.errors.join(", ")}
                </em>
              )}
            </>
          )}
        />
      </div>

      {/* URL Field (Optional) */}
      <div className="mb-3">
        <form.Field
          name="post.url"
          validators={{
            onChange: ({ value }) => {
              if (value && value.trim() !== "") {
                try {
                  new URL(value);
                } catch {
                  return "الرابط يجب أن يكون صحيحاً";
                }
              }
              return undefined;
            },
          }}
          // biome-ignore lint/correctness/noChildrenProp: Tanstack Form children prop must be a function and used as a prop
          children={(field) => (
            <>
              <label htmlFor={field.name} className="block text-sm mb-1">
                الرابط (اختياري)
              </label>
              <input
                id={field.name}
                name={field.name}
                type="url"
                value={field.state.value || ""}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-2 py-1 border border-gray-300 text-sm focus:outline-none focus:border-gray-500"
              />
              {field.state.meta.isTouched && !field.state.meta.isValid && (
                <em className="block text-xs text-red-600 mt-1">
                  {field.state.meta.errors.join(", ")}
                </em>
              )}
            </>
          )}
        />
      </div>

      {/* Turnstile Field */}
      <div className="mb-4">
        <form.Field
          name="cf_turnstile"
          validators={{
            onChange: ({ value }) => {
              if (!value || value.trim() === "") {
                return "يرجى التحقق من أنك لست روبوت";
              }
              return undefined;
            },
          }}
          // biome-ignore lint/correctness/noChildrenProp: Tanstack Form children prop must be a function and used as a prop
          children={(field) => (
            <>
              <Turnstile
                ref={ref}
                siteKey={siteKey}
                onSuccess={(token) => {
                  field.handleChange(token);
                }}
                options={{
                  refreshExpired: "manual",
                }}
                onExpire={() => ref.current?.reset()}
              />
              {field.state.meta.isTouched && !field.state.meta.isValid && (
                <em className="block text-xs text-red-600 mt-1">
                  {field.state.meta.errors.join(", ")}
                </em>
              )}
            </>
          )}
        />
      </div>

      {/* Submit Button */}
      <form.Subscribe
        selector={(state) => [
          state.canSubmit,
          state.isSubmitting,
          state.values.cf_turnstile,
        ]}
        // biome-ignore lint/correctness/noChildrenProp: Tanstack Form children prop must be a function and used as a prop
        children={([canSubmit, isSubmitting, cfTurnstile]) => {
          const hasToken =
            typeof cfTurnstile === "string" && cfTurnstile.trim() !== "";
          const isDisabled = Boolean(!canSubmit || isSubmitting || !hasToken);

          return (
            <button
              type="submit"
              disabled={isDisabled}
              className="px-3 py-1 text-sm border border-gray-400 enabled:hover:bg-gray-100 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? "جاري الإرسال..." : "إرسال"}
            </button>
          );
        }}
      />
    </form>
  );
}
