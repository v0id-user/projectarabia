import { createFileRoute, redirect } from "@tanstack/react-router";
import { getCurrentUserFn } from "@/actions/getter.auth";
import { getDashboardStatsFn } from "@/actions/admin-queries";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminStats from "@/components/admin/AdminStats";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
  beforeLoad: async () => {
    const user = await getCurrentUserFn();

    if (!user) {
      throw redirect({ to: "/login" });
    }

    const isModerator = user.role === "moderator";
    const isSuperUser =
      user.username === "v0id_user" &&
      user.email === "b11z@v0id.me" &&
      user.verified === true;

    if (!isModerator && !isSuperUser) {
      throw redirect({ to: "/" });
    }

    return { user, isSuperUser };
  },
  loader: async () => {
    const stats = await getDashboardStatsFn();
    return { stats };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { stats } = Route.useLoaderData();
  const { user, isSuperUser } = Route.useRouteContext();

  return (
    <AdminLayout currentPath="/admin">
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="border-b border-zinc-200 pb-4">
          <h2 className="text-xl font-mono text-zinc-900 mb-2">
            مرحباً، {user.username}
          </h2>
          <p className="text-sm font-mono text-zinc-600">
            {isSuperUser
              ? "أنت المشرف الرئيسي لديك صلاحيات كاملة"
              : "أنت مشرف في بابل"}
          </p>
        </div>

        {/* Statistics */}
        <div>
          <h3 className="text-lg font-mono text-zinc-900 mb-3">
            إحصائيات النظام
          </h3>
          <AdminStats stats={stats} />
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-lg font-mono text-zinc-900 mb-3">
            إجراءات سريعة
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              to="/admin/users"
              className="border border-zinc-200 p-4 hover:bg-zinc-50/30 transition-colors"
            >
              <div className="font-mono text-zinc-900 mb-1">
                إدارة المستخدمين
              </div>
              <div className="text-sm font-mono text-zinc-600">
                عرض وإدارة جميع المستخدمين ({stats.totalUsers})
              </div>
            </Link>

            <Link
              to="/admin/moderation"
              className="border border-zinc-200 p-4 hover:bg-zinc-50/30 transition-colors"
            >
              <div className="font-mono text-zinc-900 mb-1">قائمة الإشراف</div>
              <div className="text-sm font-mono text-zinc-600">
                البلاغات والمحتوى المخفي ({stats.activeReports} بلاغ نشط)
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Activity Summary */}
        <div>
          <h3 className="text-lg font-mono text-zinc-900 mb-3">ملخص النشاط</h3>
          <div className="border border-zinc-200 p-4">
            <ul className="space-y-2 font-mono text-sm">
              <li className="flex justify-between border-b border-zinc-200 pb-2">
                <span className="text-zinc-600">محتوى يتطلب مراجعة:</span>
                <span className="text-zinc-900">
                  {stats.activeReports} عنصر
                </span>
              </li>
              <li className="flex justify-between border-b border-zinc-200 pb-2">
                <span className="text-zinc-600">محتوى مخفي تلقائياً:</span>
                <span className="text-zinc-900">
                  {stats.autoHiddenPosts + stats.autoHiddenComments} عنصر
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-zinc-600">مستخدمون محظورون حالياً:</span>
                <span className="text-zinc-900">
                  {stats.bannedUsers} مستخدم
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
