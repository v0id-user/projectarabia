import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { getCurrentUserFn } from "@/actions/getter.auth";
import { getReportsListFn, getHiddenContentFn } from "@/actions/admin-queries";
import AdminLayout from "@/components/admin/AdminLayout";
import ReportCard from "@/components/admin/ReportCard";
import HiddenContentRow from "@/components/admin/HiddenContentRow";
import Pagination from "@/components/admin/Pagination";
import { z } from "zod";

const searchSchema = z.object({
  p: z.number().optional().default(1).catch(1),
  tab: z.enum(["reports", "hidden"]).optional().default("reports"),
  type: z.enum(["all", "post", "comment"]).optional().default("all"),
});

export const Route = createFileRoute("/admin/moderation")({
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
    tab: search.tab,
    type: search.type,
  }),
  loader: async ({ deps }) => {
    if (deps.tab === "reports") {
      const reports = await getReportsListFn({
        data: {
          page: deps.page,
          limit: 50,
        },
      });
      return { tab: "reports" as const, data: reports };
    } else {
      const hidden = await getHiddenContentFn({
        data: {
          type: deps.type,
          page: deps.page,
          limit: 50,
        },
      });
      return { tab: "hidden" as const, data: hidden };
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  const loaderData = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  const currentPage = search.p || 1;
  const currentTab = search.tab || "reports";

  const handleTabChange = (tab: "reports" | "hidden") => {
    navigate({
      to: "/admin/moderation",
      search: { tab, p: 1, type: search.type },
    });
  };

  const handleTypeChange = (type: "all" | "post" | "comment") => {
    navigate({
      to: "/admin/moderation",
      search: { ...search, type, p: 1 },
    });
  };

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    // Force a reload
    navigate({
      to: "/admin/moderation",
      search: { ...search },
      replace: true,
    });
  };

  return (
    <AdminLayout currentPath="/admin/moderation">
      <div className="space-y-4" key={refreshKey}>
        {/* Page Header */}
        <div className="flex justify-between items-center border-b border-zinc-200 pb-4">
          <h2 className="text-xl font-mono text-zinc-900">قائمة الإشراف</h2>
          <button
            type="button"
            onClick={handleRefresh}
            className="text-sm font-mono text-blue-600 hover:underline"
          >
            تحديث
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-zinc-200">
          <button
            type="button"
            onClick={() => handleTabChange("reports")}
            className={`pb-2 text-sm font-mono transition-colors ${
              currentTab === "reports"
                ? "text-zinc-900 underline"
                : "text-zinc-600 hover:underline"
            }`}
          >
            البلاغات
            {loaderData.tab === "reports" &&
              loaderData.data.total > 0 &&
              ` (${loaderData.data.total})`}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("hidden")}
            className={`pb-2 text-sm font-mono transition-colors ${
              currentTab === "hidden"
                ? "text-zinc-900 underline"
                : "text-zinc-600 hover:underline"
            }`}
          >
            المحتوى المخفي
            {loaderData.tab === "hidden" &&
              loaderData.data.total > 0 &&
              ` (${loaderData.data.total})`}
          </button>
        </div>

        {/* Reports Tab */}
        {currentTab === "reports" && loaderData.tab === "reports" && (
          <div className="space-y-4">
            <div className="border border-zinc-200 p-4">
              <p className="text-sm font-mono text-zinc-600">
                عرض المنشورات والتعليقات التي تم الإبلاغ عنها. المحتوى الذي يحصل
                على 10 بلاغات أو أكثر يتم إخفاؤه تلقائياً.
              </p>
            </div>

            {loaderData.data.reports.length === 0 ? (
              <div className="border border-zinc-200 p-8 text-center">
                <p className="text-sm font-mono text-zinc-500">
                  لا توجد بلاغات حالياً
                </p>
              </div>
            ) : (
              <>
                {loaderData.data.reports.map((report) => (
                  <ReportCard
                    key={report.reportId}
                    report={report}
                    onUpdate={handleRefresh}
                  />
                ))}

                {/* Pagination */}
                {loaderData.data.total > 50 && (
                  <Pagination
                    currentPage={currentPage}
                    hasMore={loaderData.data.hasMore}
                    total={loaderData.data.total}
                    itemsPerPage={50}
                    basePath="/admin/moderation"
                    searchParams={{ tab: "reports" }}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* Hidden Content Tab */}
        {currentTab === "hidden" && loaderData.tab === "hidden" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="border border-zinc-200 p-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-mono text-zinc-600">
                  نوع المحتوى:
                </span>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => handleTypeChange("all")}
                    className={`text-sm font-mono transition-colors ${
                      search.type === "all"
                        ? "text-zinc-900 underline"
                        : "text-zinc-600 hover:underline"
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange("post")}
                    className={`text-sm font-mono transition-colors ${
                      search.type === "post"
                        ? "text-zinc-900 underline"
                        : "text-zinc-600 hover:underline"
                    }`}
                  >
                    منشورات
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange("comment")}
                    className={`text-sm font-mono transition-colors ${
                      search.type === "comment"
                        ? "text-zinc-900 underline"
                        : "text-zinc-600 hover:underline"
                    }`}
                  >
                    تعليقات
                  </button>
                </div>
              </div>
            </div>

            {/* Hidden Content Table */}
            <div className="border border-zinc-200 overflow-hidden">
              <table className="w-full">
                <thead className="border-b border-zinc-200">
                  <tr>
                    <th className="py-3 px-4 text-right text-sm font-mono font-bold">
                      النوع
                    </th>
                    <th className="py-3 px-4 text-right text-sm font-mono font-bold">
                      المحتوى
                    </th>
                    <th className="py-3 px-4 text-center text-sm font-mono font-bold">
                      الكاتب
                    </th>
                    <th className="py-3 px-4 text-center text-sm font-mono font-bold">
                      البلاغات
                    </th>
                    <th className="py-3 px-4 text-right text-sm font-mono font-bold">
                      السبب
                    </th>
                    <th className="py-3 px-4 text-center text-sm font-mono font-bold">
                      متى
                    </th>
                    <th className="py-3 px-4 text-right text-sm font-mono font-bold">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loaderData.data.content.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 px-4 text-center text-sm font-mono text-zinc-500"
                      >
                        لا يوجد محتوى مخفي
                      </td>
                    </tr>
                  ) : (
                    loaderData.data.content.map((content) => (
                      <HiddenContentRow
                        key={content.contentId}
                        content={content}
                        onUpdate={handleRefresh}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {loaderData.data.total > 50 && (
              <Pagination
                currentPage={currentPage}
                hasMore={loaderData.data.hasMore}
                total={loaderData.data.total}
                itemsPerPage={50}
                basePath="/admin/moderation"
                searchParams={{ tab: "hidden", type: search.type }}
              />
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
