import { Bell } from "lucide-react";
import { useNotification } from "@/hooks/useNotification";
import { useState, useRef, useEffect } from "react";

export function BellInbox() {
  const { notifications, unreadCount } = useNotification();
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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon with Badge */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1 text-zinc-600 hover:text-[#006CFF] transition-colors"
        aria-label="الإشعارات"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#006CFF] text-white text-[9px] font-mono rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 mt-1 w-64 bg-white border border-zinc-200 shadow-sm z-50">
          {/* Header */}
          <div className="px-2 py-1.5 border-b border-zinc-200 bg-zinc-50">
            <h3 className="text-xs font-mono text-zinc-900">الإشعارات</h3>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-2 py-3 text-[10px] text-zinc-500 text-center font-mono">
                لا توجد إشعارات
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className="px-2 py-2 hover:bg-zinc-50/30 transition-colors"
                  >
                    <div className="text-[10px] font-mono text-zinc-700">
                      {notification.eventType}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
