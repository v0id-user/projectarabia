import { useForm } from "@tanstack/react-form";
import { Link, useRouter } from "@tanstack/react-router";
import {
  forgotPasswordFormOpts,
  changePasswordFormOpts,
} from "@/schemas/auth/forgot-password";
import {
  forgotPasswordFn,
  changePasswordFn,
} from "@/actions/forgot-password-submit";
import {
  validateEmail,
  validatePassword,
  type ValidationResult,
} from "@/services/validation";
import { useState } from "react";

// Adapter to convert ValidationResult to TanStack Form error format
const toFormError = (result: ValidationResult): string | undefined => {
  return result.valid ? undefined : result.error;
};

export function ForgotPasswordForm() {
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    ...forgotPasswordFormOpts,
    onSubmit: async ({ value }) => {
      setError(null);
      const result = await forgotPasswordFn({ data: value });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    },
  });

  if (success) {
    return (
      <div className="max-w-2xl p-4">
        <div className="mb-4">
          <h2 className="text-lg mb-4">
            تم إرسال رابط إعادة تعيين كلمة المرور
          </h2>
          <p className="text-sm mb-4">
            إذا كان البريد الإلكتروني موجودًا في نظامنا، فسيتم إرسال رابط إعادة
            تعيين كلمة المرور إليه.
          </p>
          <Link
            to="/login"
            className="text-sm underline text-blue-600 hover:text-blue-800"
          >
            العودة إلى تسجيل الدخول
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl p-4">
      <div className="mb-8">
        <h2 className="text-lg mb-4">نسيت كلمة المرور</h2>
        <p className="text-sm mb-4">
          أدخل بريدك الإلكتروني وسنرسل لك رابطًا لإعادة تعيين كلمة المرور.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          {/* Email Field */}
          <div className="mb-3">
            <form.Field
              name="email"
              validators={{
                onChange: ({ value }) => {
                  if (!value || value.trim() === "") {
                    return "البريد الإلكتروني مطلوب";
                  }
                  return toFormError(validateEmail(value));
                },
              }}
              // biome-ignore lint/correctness/noChildrenProp: Tanstack Form children prop must be a function and used as a prop
              children={(field) => (
                <>
                  <label
                    htmlFor={`forgot-password-${field.name}`}
                    className="block text-sm mb-1"
                  >
                    البريد الإلكتروني:
                  </label>
                  <input
                    id={`forgot-password-${field.name}`}
                    name={field.name}
                    type="email"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
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

          {error && (
            <div className="mb-3">
              <em className="block text-xs text-red-600">{error}</em>
            </div>
          )}

          {/* Submit Button */}
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
            // biome-ignore lint/correctness/noChildrenProp: Tanstack Form children prop must be a function and used as a prop
            children={([canSubmit, isSubmitting]) => (
              <button
                type="submit"
                disabled={!canSubmit || isSubmitting}
                className="px-3 py-1 text-sm border border-gray-400 enabled:hover:bg-gray-100 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "جاري الإرسال..." : "إرسال رابط إعادة التعيين"}
              </button>
            )}
          />
        </form>
        <div className="mt-4">
          <Link
            to="/login"
            className="text-sm underline text-blue-600 hover:text-blue-800"
          >
            العودة إلى تسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ChangePasswordForm({ code }: { code: string }) {
  const router = useRouter();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    ...changePasswordFormOpts,
    defaultValues: {
      code,
      password: "",
    },
    onSubmit: async ({ value }) => {
      setError(null);
      const result = await changePasswordFn({ data: value });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        // Redirect to login after a short delay
        setTimeout(() => {
          router.navigate({ to: "/login" });
        }, 2000);
      }
    },
  });

  if (success) {
    return (
      <div className="max-w-2xl p-4">
        <div className="mb-4">
          <h2 className="text-lg mb-4">تم تغيير كلمة المرور بنجاح</h2>
          <p className="text-sm mb-4">
            تم تغيير كلمة المرور بنجاح. سيتم توجيهك إلى صفحة تسجيل الدخول...
          </p>
          <Link
            to="/login"
            className="text-sm underline text-blue-600 hover:text-blue-800"
          >
            الانتقال إلى تسجيل الدخول
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl p-4">
      <div className="mb-8">
        <h2 className="text-lg mb-4">إعادة تعيين كلمة المرور</h2>
        <p className="text-sm mb-4">أدخل كلمة مرور جديدة لحسابك.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          {/* Password Field */}
          <div className="mb-3">
            <form.Field
              name="password"
              validators={{
                onChange: ({ value }) => {
                  if (!value || value.trim() === "") {
                    return "كلمة المرور مطلوبة";
                  }
                  return toFormError(validatePassword(value));
                },
              }}
              // biome-ignore lint/correctness/noChildrenProp: Tanstack Form children prop must be a function and used as a prop
              children={(field) => (
                <>
                  <label
                    htmlFor={`change-password-${field.name}`}
                    className="block text-sm mb-1"
                  >
                    كلمة المرور الجديدة:
                  </label>
                  <input
                    id={`change-password-${field.name}`}
                    name={field.name}
                    type="password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 text-sm focus:outline-none focus:border-gray-500"
                  />
                  {field.state.meta.isTouched && !field.state.meta.isValid && (
                    <em className="block text-xs text-red-600 mt-1">
                      {field.state.meta.errors.join(", ")}
                    </em>
                  )}
                  <small className="block text-xs text-gray-500 mt-1">
                    8 أحرف على الأقل، حرف كبير وصغير ورقم
                  </small>
                </>
              )}
            />
          </div>

          {error && (
            <div className="mb-3">
              <em className="block text-xs text-red-600">{error}</em>
            </div>
          )}

          {/* Submit Button */}
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
            // biome-ignore lint/correctness/noChildrenProp: Tanstack Form children prop must be a function and used as a prop
            children={([canSubmit, isSubmitting]) => (
              <button
                type="submit"
                disabled={!canSubmit || isSubmitting}
                className="px-3 py-1 text-sm border border-gray-400 enabled:hover:bg-gray-100 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "جاري التغيير..." : "تغيير كلمة المرور"}
              </button>
            )}
          />
        </form>
        <div className="mt-4">
          <Link
            to="/login"
            className="text-sm underline text-blue-600 hover:text-blue-800"
          >
            العودة إلى تسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  );
}

