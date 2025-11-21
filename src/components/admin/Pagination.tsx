import { Link } from "@tanstack/react-router";

interface PaginationProps {
  currentPage: number;
  hasMore: boolean;
  total: number;
  itemsPerPage: number;
  basePath: string;
  searchParams?: Record<string, unknown>;
}

export default function Pagination({
  currentPage,
  hasMore,
  total,
  itemsPerPage,
  basePath,
  searchParams = {},
}: PaginationProps) {
  const totalPages = Math.ceil(total / itemsPerPage);

  return (
    <div className="flex justify-between items-center py-4 px-2 border-t border-zinc-200">
      <div className="flex gap-4">
        {currentPage > 1 && (
          <Link
            to={basePath}
            search={{ ...searchParams, p: currentPage - 1 }}
            className="text-sm font-mono text-blue-600 hover:underline"
          >
            ← السابق
          </Link>
        )}
        {hasMore && (
          <Link
            to={basePath}
            search={{ ...searchParams, p: currentPage + 1 }}
            className="text-sm font-mono text-blue-600 hover:underline"
          >
            التالي →
          </Link>
        )}
      </div>

      <div className="text-sm font-mono text-zinc-500">
        صفحة {currentPage} من {totalPages} ({total} عنصر)
      </div>
    </div>
  );
}
