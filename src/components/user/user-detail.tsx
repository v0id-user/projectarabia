import { useAuth } from "@/contexts/auth";
import { Link } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useRef, useState } from "react";
import {
  validateEmail,
  validateAbout,
  type ValidationResult,
} from "@/services/validation";
import {
  userProfileFormOpts,
  type UserProfileSubmission,
} from "@/schemas/forms/user-profile";
import { timeAgo, timeUntil } from "@/lib/time";
import { updateUserProfileFn } from "@/actions/user-submit";
import type { UserBadgeWithMetadata } from "@/types/badges";
import { BadgeList } from "../badge";
import {
  promoteUserFn,
  deomoteUserFn,
  banUserFn,
  unbanUserFn,
} from "@/actions/admin-mod";
import type { SafeUserWithStatus } from "@/types/users";
import { useSiteKey } from "@/hooks/useSiteKey";

// Adapter to convert ValidationResult to TanStack Form error format
const toFormError = (result: ValidationResult): string | undefined => {
  return result.valid ? undefined : result.error;
};

export function UserDetail({
  user: _user,
}: {
  user: SafeUserWithStatus & { badges: UserBadgeWithMetadata[] };
}) {
  const { user: currentUser } = useAuth();
  const isOwnProfile = currentUser?.username === _user?.username;
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const siteKey = useSiteKey();

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleProfileUpdate = async ({
    value,
  }: {
    value: UserProfileSubmission;
  }) => {
    setServerError(null);
    setSuccessMessage(null);
    try {
      const response = await updateUserProfileFn({ data: value });

      if (!response.success) {
        setServerError(response.error || "حدث خطأ أثناء تحديث الملف الشخصي");
        turnstileRef.current?.reset();
        return;
      }

      setSuccessMessage("تم تحديث الملف الشخصي بنجاح");

      // Hard reload the page to reflect changes
      window.location.reload();
    } catch (error) {
      if (error instanceof Error) {
        setServerError("حدث خطأ أثناء تحديث الملف الشخصي");
      } else {
        setServerError("حدث خطأ غير معروف أثناء تحديث الملف الشخصي");
      }
      console.error("Error updating user profile:", error);
      setServerError("حدث خطأ أثناء تحديث الملف الشخصي");
      turnstileRef.current?.reset();
      return;
    }
  };

  const handlePromoteUser = async () => {
    const response = await promoteUserFn({
      data: { username: _user?.username },
    });
    if (!response.success) {
      setServerError("حدث خطأ أثناء ترقية المستخدم");
      return;
    }
    setSuccessMessage("تم ترقية المستخدم بنجاح");

    // Hard reload the page to reflect changes
    window.location.reload();
  };

  const handleDepromoteUser = async () => {
    const response = await deomoteUserFn({
      data: { username: _user?.username },
    });
    if (!response.success) {
      setServerError(response.error ?? "حدث خطأ أثناء تخفيض المستخدم");
      return;
    }
    setSuccessMessage("تم تخفيض المستخدم بنجاح");

    // Hard reload the page to reflect changes
    window.location.reload();
  };

  const handleBanUser = async () => {
    const response = await banUserFn({ data: { userId: _user?.userId } });
    if (!response.success) {
      setServerError(response.error || "حدث خطأ أثناء حظر المستخدم");
      return;
    }
    setSuccessMessage("تم حظر المستخدم بنجاح");

    // Hard reload the page to reflect changes
    window.location.reload();
  };

  const handleUnbanUser = async () => {
    const response = await unbanUserFn({ data: { userId: _user?.userId } });
    if (!response.success) {
      setServerError(response.error || "حدث خطأ أثناء إلغاء حظر المستخدم");
      return;
    }
    setSuccessMessage("تم إلغاء حظر المستخدم بنجاح");

    // Hard reload the page to reflect changes
    window.location.reload();
  };

  const profileForm = useForm({
    ...userProfileFormOpts,
    defaultValues: {
      about: _user?.about || "",
      email: _user?.email || "",
      cf_turnstile: "",
    },
    onSubmit: handleProfileUpdate,
  });

  // If viewing someone else's profile
  if (!isOwnProfile) {
    const hasAbout = _user?.about && _user.about.length > 0;
    const isBanned =
      _user?.bannedUntil && new Date(_user.bannedUntil) > new Date();
    return (
      <div className="max-w-2xl px-2 py-3 font-mono text-right" dir="rtl">
        <div className="flex flex-col gap-2">
          {/* Banned Notice */}
          {isBanned && _user?.bannedUntil && (
            <div className="text-xs text-red-700">
              <span className="font-bold">تنبيه: </span>
              هذا المستخدم محظور، ينتهي الحظر {timeUntil(_user.bannedUntil)}
            </div>
          )}

          {/* Basic Info */}
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex gap-2">
              <span className="text-gray-600 whitespace-nowrap">المستخدم:</span>
              <span>{_user?.username || "v0id_user"}</span>
            </div>
            {currentUser?.isOwner && (
              <div className="flex gap-2">
                <span className="font-medium text-purple-600">
                  ادوات الادارة:
                </span>
                {_user?.role !== "moderator" && (
                  <button
                    type="button"
                    className="text-gray-600 underline hover:text-[#006CFF] cursor-pointer"
                    onClick={handlePromoteUser}
                  >
                    ترقية المستخدم
                  </button>
                )}
                {_user?.role === "moderator" && (
                  <button
                    type="button"
                    className="text-gray-600 underline hover:text-[#006CFF] cursor-pointer"
                    onClick={handleDepromoteUser}
                  >
                    تخفيض المستخدم
                  </button>
                )}
                {isBanned ? (
                  <button
                    type="button"
                    className="text-gray-600 underline hover:text-[#006CFF] cursor-pointer"
                    onClick={handleUnbanUser}
                  >
                    فك الحظر عن المستخدم
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-gray-600 underline hover:text-[#006CFF] cursor-pointer"
                    onClick={handleBanUser}
                  >
                    حظر المستخدم لمدة شهر
                  </button>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <span className="text-gray-600 whitespace-nowrap">
                تاريخ الإنشاء:
              </span>
              <span>{timeAgo(_user.createdAt)}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-600 whitespace-nowrap">الكارما:</span>
              <span>{_user?.karma || 0}</span>
            </div>
          </div>

          {/* Badges Section */}
          {_user?.badges && _user.badges.length > 0 && (
            <div className="flex flex-col gap-1 text-xs">
              <span className="text-gray-600 whitespace-nowrap">الشارات:</span>
              <BadgeList badges={_user.badges} />
            </div>
          )}

          {/* About Section */}
          <div className="flex flex-col gap-1 text-xs">
            {hasAbout && (
              <span className="text-gray-600 whitespace-nowrap">عن:</span>
            )}
            <div>
              <span className="text-gray-600 text-xs">
                {_user?.about || ""}
              </span>
            </div>
          </div>

          {/* Links to user's posts and comments */}
          {_user?.username && (
            <div className="flex flex-col gap-1 text-xs">
              <Link
                to="/posts/$username"
                params={{ username: _user.username }}
                className="text-gray-600 underline hover:text-[#006CFF]"
              >
                المنشورات
              </Link>
              <Link
                to="/comments/$username"
                params={{ username: _user.username }}
                className="text-gray-600 underline hover:text-[#006CFF]"
              >
                التعليقات
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Own profile with form
  // Show loading state while site key is being fetched
  if (!siteKey) {
    return (
      <div className="max-w-2xl px-2 py-3 font-mono text-right" dir="rtl">
        <div className="text-center text-sm text-gray-600">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl px-2 py-3 font-mono text-right" dir="rtl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          profileForm.handleSubmit();
        }}
      >
        <div className="flex flex-col gap-2">
          {/* Basic Info */}
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex gap-2">
              <span className="text-gray-600 whitespace-nowrap">المستخدم:</span>
              <span>{_user?.username || "v0id_user"}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-600 whitespace-nowrap">
                تاريخ الإنشاء:
              </span>
              <span>{timeAgo(_user.createdAt)}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-600 whitespace-nowrap">الكارما:</span>
              <span>{_user?.karma || 0}</span>
            </div>
          </div>

          {/* Badges Section */}
          {_user?.badges && _user.badges.length > 0 && (
            <div className="flex flex-col gap-1 text-xs">
              <span className="text-gray-600 whitespace-nowrap">الشارات:</span>
              <BadgeList badges={_user.badges} />
            </div>
          )}

          {/* About Field */}
          <div className="flex flex-col gap-1 text-xs">
            <profileForm.Field
              name="about"
              validators={{
                onChange: ({ value }) => toFormError(validateAbout(value)),
              }}
              // biome-ignore lint/correctness/noChildrenProp: Tanstack Form children prop must be a function and used as a prop
              children={(field) => (
                <>
                  <span className="text-gray-600 whitespace-nowrap">عن:</span>
                  <textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-full border border-gray-300 p-1 text-xs font-mono focus:outline-none focus:border-gray-500"
                    rows={3}
                  />
                  {field.state.meta.isTouched && !field.state.meta.isValid && (
                    <em className="block text-xs text-red-600 mt-1">
                      {field.state.meta.errors.join(", ")}
                    </em>
                  )}
                  <small className="block text-[10px] text-gray-500">
                    {field.state.value.length}/512 حرف
                  </small>
                </>
              )}
            />
          </div>

          {/* Email Field */}
          <div className="flex flex-col gap-1 text-xs">
            <profileForm.Field
              name="email"
              validators={{
                onChange: ({ value }) => toFormError(validateEmail(value)),
              }}
              // biome-ignore lint/correctness/noChildrenProp: Tanstack Form children prop must be a function and used as a prop
              children={(field) => (
                <>
                  <span className="text-gray-600 whitespace-nowrap">
                    البريد:
                  </span>
                  <div className="flex flex-col gap-1">
                    {!_user?.verified ? (
                      _user?.email && (
                        <em className="block text-xs text-yellow-300">
                          قم بتوثيق بريدك الإلكتروني
                        </em>
                      )
                    ) : (
                      <em className="block text-xs text-green-300">
                        تم توثيق بريدك الإلكتروني
                      </em>
                    )}
                    <input
                      id={field.name}
                      name={field.name}
                      type="email"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="border border-gray-300 px-1 py-0.5 text-xs font-mono focus:outline-none focus:border-gray-500"
                    />
                    {field.state.meta.isTouched &&
                      !field.state.meta.isValid && (
                        <em className="block text-xs text-red-600 mt-1">
                          {field.state.meta.errors.join(", ")}
                        </em>
                      )}
                    <div className="text-[10px] text-gray-500">
                      المسؤولون فقط يرون بريدك الإلكتروني. للمشاركة علنًا، أضفه
                      إلى صندوق 'عن'.
                    </div>
                  </div>
                </>
              )}
            />
          </div>

          {/* Turnstile Field */}
          <profileForm.Field
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
                  ref={turnstileRef}
                  siteKey={siteKey}
                  onSuccess={(token) => {
                    field.handleChange(token);
                  }}
                  options={{
                    refreshExpired: "manual",
                  }}
                  onExpire={() => turnstileRef.current?.reset()}
                />
                {field.state.meta.isTouched && !field.state.meta.isValid && (
                  <em className="block text-xs text-red-600 mt-1">
                    {field.state.meta.errors.join(", ")}
                  </em>
                )}
              </>
            )}
          />

          {/* Profile Actions */}
          {_user?.username && (
            <div className="flex flex-col gap-1 text-xs">
              <Link
                to="/posts/$username"
                params={{ username: _user.username }}
                className="text-gray-600 underline hover:text-[#006CFF]"
              >
                المنشورات
              </Link>
              <Link
                to="/comments/$username"
                params={{ username: _user.username }}
                className="text-gray-600 underline hover:text-[#006CFF]"
              >
                التعليقات
              </Link>
              <Link
                to="/voted/$username"
                params={{ username: _user.username }}
                className="text-gray-600 underline hover:text-[#006CFF]"
              >
                المنشورات / التعليقات المصوت عليها
              </Link>
            </div>
          )}

          {/* Server Error Message */}
          {serverError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 p-2 rounded">
              {serverError}
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="text-xs text-green-600 bg-green-50 border border-green-200 p-2 rounded">
              {successMessage}
            </div>
          )}

          {/* Submit Button */}
          <profileForm.Subscribe
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
                  className="border border-gray-400 px-2 py-0.5 text-xs hover:underline hover:text-[#006CFF] hover:border-[#006CFF] disabled:opacity-50 disabled:cursor-not-allowed w-fit"
                >
                  {isSubmitting ? "جاري التحديث..." : "تحديث"}
                </button>
              );
            }}
          />
        </div>
      </form>
    </div>
  );
}
