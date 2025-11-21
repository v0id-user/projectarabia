import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface AdminLayoutProps {
  children: ReactNode;
  currentPath?: string;
}

export default function AdminLayout({
  children,
  currentPath,
}: AdminLayoutProps) {
  const navItems = [
    { path: "/admin", label: "لوحة التحكم", exact: true },
    { path: "/admin/users", label: "المستخدمون", exact: false },
    { path: "/admin/moderation", label: "الإشراف", exact: false },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Admin Header */}
      <div className="border-b border-zinc-200 py-3 px-2 mb-4">
        <h1 className="text-lg font-mono text-zinc-900">لوحة إدارة بابل</h1>
      </div>

      {/* Navigation */}
      <div className="flex gap-4 mb-4 border-b border-zinc-200 pb-2 px-2">
        {navItems.map((item) => {
          const isActive = item.exact
            ? currentPath === item.path
            : currentPath?.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`text-sm font-mono transition-colors ${
                isActive
                  ? "text-zinc-900 underline"
                  : "text-zinc-600 hover:underline"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Content */}
      <div className="px-2">{children}</div>
    </div>
  );
}
