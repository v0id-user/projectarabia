import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import {
  loginFormOpts,
  registerFormOpts,
  type LoginSubmission,
  type RegisterSubmission,
} from "@/schemas/auth/login";
import { useForm } from "@tanstack/react-form";
import { useRef } from "react";
import {
  validateUsername,
  validatePassword,
  type ValidationResult,
} from "@/services/validation";
import { useSiteKey } from "@/hooks/useSiteKey";
// Adapter to convert ValidationResult to TanStack Form error format
const toFormError = (result: ValidationResult): string | undefined => {
  return result.valid ? undefined : result.error;
};

export interface LoginFormProps {
  onLogin: (loginRequest: LoginSubmission) => void;
  onRegister: (registerRequest: RegisterSubmission) => void;
}

export default function LoginForm({ onLogin, onRegister }: LoginFormProps) {
  const loginForm = useForm({
    ...loginFormOpts,
    onSubmit: async ({ value }) => {
      onLogin(value);
    },
  });
  const loginRef = useRef<TurnstileInstance | null>(null);
  const registerForm = useForm({
    ...registerFormOpts,
    onSubmit: async ({ value }) => {
      onRegister(value);
    },
  });
  const registerRef = useRef<TurnstileInstance | null>(null);

  const siteKey = useSiteKey();

  // Show loading state while site key is being fetched
  if (!siteKey) {
    return (
      <div className="max-w-2xl p-4">
        <div className="text-center text-sm text-gray-600">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl p-4">
      {/* Login Form */}
      <div className="mb-8">
        <h2 className="text-lg mb-4">تسجيل الدخول</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            loginForm.handleSubmit();
          }}
        >
          {/* Username Field */}
          <div className="mb-3">
            <loginForm.Field
              name="username"
              validators={{
                onChange: ({ value }) => {
                  if (!value || value.trim() === "") {
                    return "اسم المستخدم مطلوب";
                  }
                  return undefined;
                },
              }}
              // biome-ignore lint/correctness/noChildrenProp: Tanstack Form children prop must be a function and used as a prop
              children={(field) => (
                <>
                  <label
                    htmlFor={`login-${field.name}`}
                    className="block text-sm mb-1"
                  >
                    اسم المستخدم:
                  </label>
                  <input
                    id={`login-${field.name}`}
                    name={field.name}
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

          {/* Password Field */}
          <div className="mb-3">
            <loginForm.Field
              name="password"
              validators={{
                onChange: ({ value }) => {
                  if (!value || value.trim() === "") {
                    return "كلمة المرور مطلوبة";
                  }
                  return undefined;
                },
              }}
              // biome-ignore lint/correctness/noChildrenProp: Tanstack Form children prop must be a function and used as a prop
              children={(field) => (
                <>
                  <label
                    htmlFor={`login-${field.name}`}
                    className="block text-sm mb-1"
                  >
                    كلمة المرور:
                  </label>
                  <input
                    id={`login-${field.name}`}
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
                </>
              )}
            />
          </div>

          {/* Turnstile Field */}
          <div className="mb-4">
            <loginForm.Field
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
                    ref={loginRef}
                    siteKey={siteKey}
                    onSuccess={(token) => {
                      field.handleChange(token);
                    }}
                    options={{
                      refreshExpired: "manual",
                    }}
                    onExpire={() => loginRef.current?.reset()}
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
          <loginForm.Subscribe
            selector={(state) => [
              state.canSubmit,
              state.isSubmitting,
              state.values.cf_turnstile,
            ]}
            // biome-ignore lint/correctness/noChildrenProp: Tanstack Form children prop must be a function and used as a prop
            children={([canSubmit, isSubmitting, cfTurnstile]) => {
              const hasToken =
                typeof cfTurnstile === "string" && cfTurnstile.trim() !== "";
              const isDisabled = Boolean(
                !canSubmit || isSubmitting || !hasToken,
              );

              return (
                <button
                  type="submit"
                  disabled={isDisabled}
                  className="px-3 py-1 text-sm border border-gray-400 enabled:hover:bg-gray-100 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? "جاري الدخول..." : "تسجيل الدخول"}
                </button>
              );
            }}
          />
        </form>
      </div>

      {/* Register Form */}
      <div className="mb-8">
        <h2 className="text-lg mb-4">إنشاء حساب</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            registerForm.handleSubmit();
          }}
        >
          {/* Username Field */}
          <div className="mb-3">
            <registerForm.Field
              name="username"
              validators={{
                onChange: ({ value }) => toFormError(validateUsername(value)),
              }}
              // biome-ignore lint/correctness/noChildrenProp: Tanstack Form children prop must be a function and used as a prop
              children={(field) => (
                <>
                  <label
                    htmlFor={`register-${field.name}`}
                    className="block text-sm mb-1"
                  >
                    اسم المستخدم:
                  </label>
                  <input
                    id={`register-${field.name}`}
                    name={field.name}
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
                    حروف إنجليزية صغيرة وأرقام وشرطات سفلية فقط (2-15 حرف)
                  </small>
                </>
              )}
            />
          </div>

          {/* Password Field */}
          <div className="mb-3">
            <registerForm.Field
              name="password"
              validators={{
                onChange: ({ value }) => toFormError(validatePassword(value)),
              }}
              // biome-ignore lint/correctness/noChildrenProp: Tanstack Form children prop must be a function and used as a prop
              children={(field) => (
                <>
                  <label
                    htmlFor={`register-${field.name}`}
                    className="block text-sm mb-1"
                  >
                    كلمة المرور:
                  </label>
                  <input
                    id={`register-${field.name}`}
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

          {/* Turnstile Field */}
          <div className="mb-4">
            <registerForm.Field
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
                    ref={registerRef}
                    siteKey={siteKey}
                    onSuccess={(token) => {
                      field.handleChange(token);
                    }}
                    options={{
                      refreshExpired: "manual",
                    }}
                    onExpire={() => registerRef.current?.reset()}
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
          <registerForm.Subscribe
            selector={(state) => [
              state.canSubmit,
              state.isSubmitting,
              state.values.cf_turnstile,
            ]}
            // biome-ignore lint/correctness/noChildrenProp: Tanstack Form children prop must be a function and used as a prop
            children={([canSubmit, isSubmitting, cfTurnstile]) => {
              const hasToken =
                typeof cfTurnstile === "string" && cfTurnstile.trim() !== "";
              const isDisabled = Boolean(
                !canSubmit || isSubmitting || !hasToken,
              );

              return (
                <button
                  type="submit"
                  disabled={isDisabled}
                  className="px-3 py-1 text-sm border border-gray-400 enabled:hover:bg-gray-100 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? "جاري الإنشاء..." : "إنشاء حساب"}
                </button>
              );
            }}
          />
        </form>
      </div>
    </div>
  );
}
