import { Bell, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useNotification } from "@/hooks/useNotification";
import { useNotificationStore } from "@/stores/notification";
import { useState, useRef, useEffect } from "react";

/**
 * Format commenters list in Arabic
 */
function formatCommenters(commenters: string[], count: number): string {
  if (count === 1) {
    return `@${commenters[0]}`;
  }
  if (count === 2) {
    return `@${commenters[0]} و @${commenters[1]}`;
  }
  const others = count - 2;
  return `@${commenters[0]} و @${commenters[1]} و ${others} ${
    others === 1 ? "آخر" : others === 2 ? "آخران" : "آخرون"
  }`;
}

/**
 * Get notification text based on type
 */
function getNotificationText(
  notificationType: "post_comment" | "comment_reply" | undefined,
  commenters: string[],
  commentCount: number,
): string {
  const commentersText = formatCommenters(commenters, commentCount);
  const contextText =
    notificationType === "post_comment" ? "على منشورك" : "على تعليقك";
  return `قام ${commentersText} بالتعليق ${contextText}`;
}

export function BellInbox() {
  const { notifications, unreadCount } = useNotification();
  const { removeNotification, clearNotifications } = useNotificationStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = (notificationId: string) => {
    // Remove notification when clicked (mark as read)
    removeNotification(notificationId);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearNotifications();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon with Badge */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1 text-zinc-300 hover:text-white transition-colors"
        aria-label="الإشعارات"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-white text-[#006CFF] text-[9px] font-mono rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-1 w-80 bg-white border border-zinc-200 shadow-lg rounded z-50">
          {/* Header */}
          <div className="px-3 py-2 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <h3 className="text-xs font-mono text-zinc-900">الإشعارات</h3>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[10px] font-mono text-zinc-500 hover:text-zinc-700 transition-colors"
              >
                مسح الكل
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-3 py-4 text-[10px] text-zinc-500 text-center font-mono">
                لا توجد إشعارات
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {notifications
                  .filter((notification) => {
                    const eventData = notification.eventData;
                    return eventData?.postId && eventData?.postTitle;
                  })
                  .map((notification) => {
                    const eventData = notification.eventData;
                    const notificationType = eventData?.notificationType;
                    const postId = eventData?.postId;
                    const postTitle = eventData?.postTitle;
                    const commenters = eventData?.commenters || [];
                    const commentCount = eventData?.commentCount || 0;

                    const notificationText = getNotificationText(
                      notificationType,
                      commenters,
                      commentCount,
                    );

                    return (
                      <li
                        key={notification.id}
                        className="group relative px-3 py-2.5 hover:bg-zinc-50 transition-colors"
                      >
                        <Link
                          to="/post/i/$postId"
                          params={{ postId }}
                          onClick={() =>
                            handleNotificationClick(notification.id)
                          }
                          className="block"
                        >
                          <div className="pr-5">
                            <div className="text-[10px] font-mono text-zinc-700 leading-relaxed">
                              {notificationText}
                            </div>
                            <div className="text-[9px] font-mono text-zinc-500 mt-1 line-clamp-2">
                              {postTitle}
                            </div>
                            {commentCount > 1 && (
                              <div className="text-[9px] font-mono text-zinc-400 mt-1">
                                {commentCount} تعليق
                              </div>
                            )}
                          </div>
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            removeNotification(notification.id);
                          }}
                          className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-zinc-200 rounded"
                          aria-label="إزالة الإشعار"
                        >
                          <X size={12} className="text-zinc-400" />
                        </button>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
