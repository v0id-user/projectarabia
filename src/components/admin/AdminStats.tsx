interface StatsCardProps {
  title: string;
  value: number;
  subtitle?: string;
}

function StatsCard({ title, value, subtitle }: StatsCardProps) {
  return (
    <div className="border border-zinc-200 p-4 hover:bg-zinc-50/30 transition-colors">
      <div className="text-sm font-mono text-zinc-600 mb-1">{title}</div>
      <div className="text-3xl font-bold font-mono text-zinc-900">{value}</div>
      {subtitle && (
        <div className="text-xs font-mono text-zinc-500 mt-1">{subtitle}</div>
      )}
    </div>
  );
}

interface AdminStatsProps {
  stats: {
    totalUsers: number;
    totalPosts: number;
    totalComments: number;
    activeReports: number;
    bannedUsers: number;
    mutedUsers: number;
    moderators: number;
    hiddenPosts: number;
    hiddenComments: number;
    autoHiddenPosts: number;
    autoHiddenComments: number;
  };
}

export default function AdminStats({ stats }: AdminStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatsCard title="إجمالي المستخدمين" value={stats.totalUsers} />
      <StatsCard title="إجمالي المنشورات" value={stats.totalPosts} />
      <StatsCard title="إجمالي التعليقات" value={stats.totalComments} />
      <StatsCard
        title="البلاغات النشطة"
        value={stats.activeReports}
        subtitle={
          stats.activeReports > 0 ? "يتطلب انتباه" : "لا توجد بلاغات جديدة"
        }
      />
      <StatsCard title="المستخدمون المحظورون" value={stats.bannedUsers} />
      <StatsCard title="المستخدمون المكتومون" value={stats.mutedUsers} />
      <StatsCard title="المشرفون" value={stats.moderators} />
      <StatsCard
        title="المحتوى المخفي"
        value={stats.hiddenPosts + stats.hiddenComments}
        subtitle={`منشورات: ${stats.hiddenPosts} | تعليقات: ${stats.hiddenComments}`}
      />
      <StatsCard
        title="مخفي تلقائياً (منشورات)"
        value={stats.autoHiddenPosts}
        subtitle="10+ بلاغات"
      />
      <StatsCard
        title="مخفي تلقائياً (تعليقات)"
        value={stats.autoHiddenComments}
        subtitle="10+ بلاغات"
      />
    </div>
  );
}
