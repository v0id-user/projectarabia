import { useState } from "react";
import { banUserFn, unbanUserFn } from "@/actions/admin-mod";
import type { UserWithStatus } from "@/db/queries/admin";

interface UserRowProps {
  user: UserWithStatus;
  isSuperUser: boolean;
  onUpdate?: () => void;
}

export default function UserRow({ user, isSuperUser, onUpdate }: UserRowProps) {
  const [loading, setLoading] = useState(false);
  const [confirmBan, setConfirmBan] = useState(false);

  const now = new Date();
  const isBanned = !!(user.bannedUntil && new Date(user.bannedUntil) > now);
  const isMuted = !!(user.mutedUntil && new Date(user.mutedUntil) > now);

  const handleBan = async () => {
    if (!confirmBan) {
      setConfirmBan(true);
      setTimeout(() => setConfirmBan(false), 5000);
      return;
    }

    setLoading(true);
    try {
      await banUserFn({ data: { userId: user.id } });
      onUpdate?.();
    } catch (error) {
      console.error("Failed to ban user:", error);
    } finally {
      setLoading(false);
      setConfirmBan(false);
    }
  };

  const handleUnban = async () => {
    setLoading(true);
    try {
      await unbanUserFn({ data: { userId: user.id } });
      onUpdate?.();
    } catch (error) {
      console.error("Failed to unban user:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    return role === "moderator" ? "مشرف" : "مستخدم";
  };

  const getStatusLabel = () => {
    if (isBanned) return "محظور";
    if (isMuted) return "مكتوم";
    return "نشط";
  };

  return (
    <tr className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors">
      <td className="py-3 px-4 font-mono text-sm">
        <div className="font-medium">{user.username}</div>
        {user.email && (
          <div className="text-xs text-zinc-500">{user.email}</div>
        )}
      </td>
      <td className="py-3 px-4 font-mono text-sm text-center">
        {Math.round(user.karma)}
      </td>
      <td className="py-3 px-4 font-mono text-sm text-center">
        {getRoleLabel(user.role)}
      </td>
      <td className="py-3 px-4 font-mono text-sm text-center">
        {getStatusLabel()}
        {isBanned && user.banReason && (
          <div className="text-xs text-zinc-500 mt-1">{user.banReason}</div>
        )}
      </td>
      <td className="py-3 px-4 text-sm">
        <div className="flex gap-2 justify-end">
          {isSuperUser &&
            (isBanned ? (
              <button
                type="button"
                onClick={handleUnban}
                disabled={loading}
                className="text-xs font-mono text-blue-600 hover:underline disabled:opacity-50"
              >
                إلغاء الحظر
              </button>
            ) : (
              <button
                type="button"
                onClick={handleBan}
                disabled={loading}
                className={`text-xs font-mono disabled:opacity-50 ${
                  confirmBan
                    ? "text-zinc-900 underline"
                    : "text-zinc-600 hover:underline"
                }`}
              >
                {confirmBan ? "تأكيد الحظر" : "حظر"}
              </button>
            ))}
        </div>
      </td>
    </tr>
  );
}
