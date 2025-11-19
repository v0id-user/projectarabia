import {
  createFileRoute,
  redirect,
} from "@tanstack/react-router";
import { validateResetCodeFn } from "@/actions/forgot-password-submit";
import { ChangePasswordForm } from "@/components/auth/forgot-password-form";

export const Route = createFileRoute("/password/$code")({
  beforeLoad: async ({ params }) => {
    const result = await validateResetCodeFn({ data: { code: params.code } });

    if (!result.success) {
      throw redirect({
        to: "/forgot-password",
        search: {
          error: result.error || "رمز التحقق غير صالح أو منتهي الصلاحية",
        },
      });
    }

    return { code: params.code };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { code } = Route.useRouteContext();
  return <ChangePasswordForm code={code} />;
}
