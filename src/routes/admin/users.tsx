import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { getCurrentUserFn } from "@/actions/getter.auth";
import { getUsersListFn } from "@/actions/admin-queries";
import AdminLayout from "@/components/admin/AdminLayout";
import UserRow from "@/components/admin/UserRow";
import Pagination from "@/components/admin/Pagination";
import { z } from "zod";

const searchSchema = z.object({
  p: z.number().optional().default(1).catch(1),
  role: z.enum(["all", "user", "moderator"]).optional().default("all"),
  status: z.enum(["all", "banned", "muted"]).optional().default("all"),
  search: z.string().optional(),
});

export const Route = createFileRoute("/admin/users")({
  validateSearch: searchSchema,
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
  loaderDeps: ({ search }) => ({
    page: search.p,
    role: search.role,
    status: search.status,
    searchUsername: search.search,
  }),
  loader: async ({ deps }) => {
    const result = await getUsersListFn({
      data: {
        page: deps.page,
        limit: 50,
        roleFilter: deps.role,
        statusFilter: deps.status,
        searchUsername: deps.searchUsername,
      },
    });
    return result;
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { users, total, hasMore } = Route.useLoaderData();
  const { isSuperUser } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [searchInput, setSearchInput] = useState(search.search || "");
  const [refreshKey, setRefreshKey] = useState(0);

  const currentPage = search.p || 1;

  const handleFilterChange = (
    key: "role" | "status",
    value: "all" | "user" | "moderator" | "banned" | "muted",
  ) => {
    navigate({
      to: "/admin/users",
      search: { ...search, [key]: value, p: 1 },
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({
      to: "/admin/users",
      search: { ...search, search: searchInput || undefined, p: 1 },
    });
  };

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <AdminLayout currentPath="/admin/users">
      <div className="space-y-4">
        {/* Page Header */}
        <div className="flex justify-between items-center border-b border-zinc-200 pb-4">
          <h2 className="text-xl font-mono text-zinc-900">إدارة المستخدمين</h2>
          <div className="text-sm font-mono text-zinc-500">{total} مستخدم</div>
        </div>

        {/* Filters and Search */}
        <div className="border border-zinc-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Role Filter */}
            <div>
              <span className="text-sm font-mono text-zinc-600 block mb-2">
                الدور
              </span>
              <select
                value={search.role}
                onChange={(e) =>
                  handleFilterChange(
                    "role",
                    e.target.value as "all" | "user" | "moderator",
                  )
                }
                className="w-full px-3 py-2 border border-zinc-300 rounded font-mono text-sm"
              >
                <option value="all">الكل</option>
                <option value="user">مستخدمون</option>
                <option value="moderator">مشرفون</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <span className="text-sm font-mono text-zinc-600 block mb-2">
                الحالة
              </span>
              <select
                value={search.status}
                onChange={(e) =>
                  handleFilterChange(
                    "status",
                    e.target.value as "all" | "banned" | "muted",
                  )
                }
                className="w-full px-3 py-2 border border-zinc-300 rounded font-mono text-sm"
              >
                <option value="all">الكل</option>
                <option value="banned">محظورون</option>
                <option value="muted">مكتومون</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <span className="text-sm font-mono text-zinc-600 block mb-2">
                بحث
              </span>
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="اسم المستخدم"
                  className="flex-1 px-3 py-2 border border-zinc-300 rounded font-mono text-sm"
                />
                <button
                  type="submit"
                  className="px-4 py-2 border border-zinc-300 font-mono text-sm text-zinc-900 hover:bg-zinc-50 transition-colors"
                >
                  بحث
                </button>
              </form>
            </div>
          </div>

          {/* Active Filters */}
          {(search.role !== "all" ||
            search.status !== "all" ||
            search.search) && (
            <div className="flex gap-2 items-center">
              <span className="text-xs font-mono text-zinc-600">
                الفلاتر النشطة:
              </span>
              {search.role !== "all" && (
                <span className="text-xs font-mono text-zinc-600">
                  الدور: {search.role === "moderator" ? "مشرفون" : "مستخدمون"}
                </span>
              )}
              {search.status !== "all" && (
                <span className="text-xs font-mono text-zinc-600">
                  الحالة: {search.status === "banned" ? "محظورون" : "مكتومون"}
                </span>
              )}
              {search.search && (
                <span className="text-xs font-mono text-zinc-600">
                  بحث: {search.search}
                </span>
              )}
              <button
                type="button"
                onClick={() =>
                  navigate({
                    to: "/admin/users",
                    search: { p: 1, role: "all", status: "all" },
                  })
                }
                className="text-xs font-mono text-blue-600 hover:underline"
              >
                مسح الفلاتر
              </button>
            </div>
          )}
        </div>

        {/* Users Table */}
        <div className="border border-zinc-200 overflow-hidden">
          <table className="w-full" key={refreshKey}>
            <thead className="border-b border-zinc-200">
              <tr>
                <th className="py-3 px-4 text-right text-sm font-mono font-bold">
                  المستخدم
                </th>
                <th className="py-3 px-4 text-center text-sm font-mono font-bold">
                  الكارما
                </th>
                <th className="py-3 px-4 text-center text-sm font-mono font-bold">
                  الدور
                </th>
                <th className="py-3 px-4 text-center text-sm font-mono font-bold">
                  الحالة
                </th>
                <th className="py-3 px-4 text-right text-sm font-mono font-bold">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 px-4 text-center text-sm font-mono text-zinc-500"
                  >
                    لا يوجد مستخدمون
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    isSuperUser={isSuperUser}
                    onUpdate={handleRefresh}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 50 && (
          <Pagination
            currentPage={currentPage}
            hasMore={hasMore}
            total={total}
            itemsPerPage={50}
            basePath="/admin/users"
            searchParams={{
              role: search.role,
              status: search.status,
              search: search.search,
            }}
          />
        )}
      </div>
    </AdminLayout>
  );
}
