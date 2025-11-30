import { useAuth } from "@/contexts/auth";
import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { logoutFn } from "@/actions/auth-submit";
import { BellInbox } from "@/components/bell-inbox";

export default function BoardHeader() {
  const { user, isLoading } = useAuth();
  const route = useRouterState({ select: (state) => state.location.pathname });
  const logout = useServerFn(logoutFn);

  // Route matching helpers - organized by priority
  const routes = {
    isHome: route === "/",
    isNewest: route === "/newest",
    isComments: route === "/comments",
    isCommentsUser: route.startsWith("/comments/") && route !== "/comments",
    isPostsUser: route.startsWith("/posts/"),
    isAsk: route === "/ask",
    isShare: route === "/share",
    isPast: route.startsWith("/past"),
    isPost: route === "/post",
    isLogin: route === "/login",
    isPostDetail: route.startsWith("/post/i"),
    isUserProfile: route.startsWith("/user/"),
  };

  // Grouped route checks for cleaner logic
  const shouldShowActiveLinks =
    routes.isHome ||
    routes.isNewest ||
    routes.isPostDetail ||
    routes.isUserProfile ||
    routes.isComments ||
    routes.isCommentsUser ||
    routes.isPostsUser ||
    routes.isAsk ||
    routes.isShare ||
    routes.isPast;

  const shouldShowLogoText =
    routes.isHome ||
    routes.isNewest ||
    routes.isPostDetail ||
    routes.isUserProfile;

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  const ActiveLinks = () => {
    if (!shouldShowActiveLinks) return null;

    const BoardLink = ({
      to,
      children,
    }: {
      to: string;
      children: React.ReactNode;
    }) => {
      return (
        <Link
          to={to}
          className="px-2 py-1 rounded transition-colors hover:text-white"
        >
          {children}
        </Link>
      );
    };

    return (
      <>
        <BoardLink to="/newest">
          <span>الأحدث</span>
        </BoardLink>
        <span className="px-2">|</span>
        <BoardLink to="/comments">
          <span>تعليقات</span>
        </BoardLink>
        <span className="px-2">|</span>
        <BoardLink to="/ask">
          <span>الأسئلة</span>
        </BoardLink>
        <span className="px-2">|</span>
        <BoardLink to="/share">
          <span>المشاركات</span>
        </BoardLink>
        <span className="px-2">|</span>
        <BoardLink to="/past">
          <span>الأرشيف</span>
        </BoardLink>
        <span className="px-2">|</span>
        <BoardLink to="/post">
          <span>نشر</span>
        </BoardLink>
      </>
    );
  };

  const Title = () => {
    if (routes.isPost) {
      return (
        <span className="font-extrabold text-lg text-blue-100 tracking-wide">
          نشر
        </span>
      );
    }
    if (routes.isComments) {
      return (
        <span className="font-semibold text-base text-yellow-100 tracking-wide">
          تعليقات
        </span>
      );
    }
    if (routes.isCommentsUser) {
      const username = route.split("/comments/")[1];
      return (
        <span className="font-semibold text-base text-yellow-100 tracking-wide">
          تعليقات {username}
        </span>
      );
    }
    if (routes.isPostsUser) {
      const username = route.split("/posts/")[1];
      return (
        <span className="font-semibold text-base text-cyan-100 tracking-wide">
          منشورات {username}
        </span>
      );
    }
    if (routes.isAsk) {
      return (
        <span className="font-semibold text-base text-green-100 tracking-wide">
          الأسئلة
        </span>
      );
    }
    if (routes.isShare) {
      return (
        <span className="font-semibold text-base text-purple-100 tracking-wide">
          المشاركات
        </span>
      );
    }
    if (routes.isPast) {
      return (
        <span className="font-semibold text-base text-orange-100 tracking-wide">
          الأرشيف
        </span>
      );
    }
    if (routes.isLogin) {
      return (
        <span className="font-semibold text-base text-yellow-100 tracking-wide">
          تسجيل
        </span>
      );
    }
    return null;
  };

  return (
    <header className="w-full bg-[#006CFF] border-b border-blue-700 text-sm font-mono font-thin text-zinc-300">
      <nav className="max-w-6xl mx-auto px-2 py-1">
        {/* Mobile and Desktop Layout */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 sm:min-h-7">
          {/* Top row: Logo + Auth */}
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <svg
                width="20"
                height="20"
                viewBox="0 0 250 250"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <title>Babel</title>
                <rect
                  x="2.5"
                  y="2.5"
                  width="245"
                  height="245"
                  fill="#006CFF"
                  stroke="white"
                  strokeWidth="5"
                />
                <path
                  d="M120.933 168.495L131.598 179.025V181.86L120.933 192.39L110.268 181.86V179.025L120.933 168.495ZM163.203 103.32L172.248 90.225L173.598 90.9C174.948 96.03 176.028 100.665 176.838 104.805C177.648 108.945 178.233 113.355 178.593 118.035L175.218 121.95L163.203 103.32ZM103.398 153C94.8478 153 87.8728 151.605 82.4728 148.815C77.0728 145.935 73.1578 142.11 70.7278 137.34C68.2978 132.57 67.0828 127.08 67.0828 120.87C67.0828 116.91 67.7578 112.95 69.1078 108.99C70.4578 104.94 72.5278 101.025 75.3178 97.245L76.3978 97.92C75.2278 99.9 74.2828 102.105 73.5628 104.535C72.8428 106.875 72.4828 108.99 72.4828 110.88C72.4828 114.21 74.6428 116.865 78.9628 118.845C83.3728 120.735 90.3928 121.86 100.023 122.22C101.373 122.31 103.533 122.355 106.503 122.355C117.393 122.355 129.903 121.995 144.033 121.275C158.253 120.465 168.963 119.385 176.163 118.035H178.593L168.738 147.195C161.898 148.905 151.728 150.3 138.228 151.38C124.728 152.46 113.118 153 103.398 153Z"
                  fill="#E7F1FF"
                />
              </svg>
              {shouldShowLogoText ? (
                <span
                  className="hidden sm:inline h-6 w-auto"
                  style={{ display: "flex", alignItems: "center" }}
                >
                  <svg
                    width="72"
                    height="36"
                    viewBox="0 0 263 134"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-auto"
                  >
                    <title>Babel</title>
                    <path
                      d="M147.42 16.065L156.06 2.16L158.085 2.835V91.665L150.66 100.98L147.42 16.065ZM173.475 101.25C170.055 101.25 166.815 100.125 163.755 97.875C160.695 95.625 158.085 92.295 155.925 87.885C153.855 83.385 152.595 77.985 152.145 71.685L157.41 63.72C158.04 65.61 159.165 67.05 160.785 68.04C162.405 68.94 164.25 69.525 166.32 69.795C168.39 70.065 170.775 70.2 173.475 70.2C174.285 70.2 174.915 70.56 175.365 71.28C175.905 72 176.175 73.035 176.175 74.385V97.74C176.175 100.08 175.275 101.25 173.475 101.25ZM76.6801 133.245C64.6201 133.245 54.0901 131.805 45.0901 128.925C36.0901 126.045 28.5301 122.085 22.4101 117.045C16.2901 112.005 11.0251 106.02 6.61512 99.09C4.18512 94.59 2.47512 89.955 1.48512 85.185C0.495117 80.415 0.135117 76.005 0.405117 71.955H1.21512C3.01512 75.375 4.95012 78.48 7.02012 81.27C9.09012 84.06 11.4301 86.625 14.0401 88.965C18.0001 92.205 22.8151 95.085 28.4851 97.605C34.1551 100.035 41.0401 101.97 49.1401 103.41C57.3301 104.85 66.5101 105.57 76.6801 105.57C86.8501 105.57 96.6601 105.03 106.11 103.95C115.56 102.87 124.515 101.205 132.975 98.955C141.435 96.615 148.995 93.645 155.655 90.045L158.085 91.665L151.875 115.695C144.135 121.275 133.56 125.595 120.15 128.655C106.74 131.715 92.2501 133.245 76.6801 133.245ZM173.289 109.745L183.954 120.275V123.11L173.289 133.64L162.624 123.11V120.275L173.289 109.745ZM173.429 101.25C171.629 101.25 170.729 100.575 170.729 99.225V72.495C170.729 70.965 171.629 70.2 173.429 70.2C177.209 70.2 180.809 69.885 184.229 69.255C187.739 68.535 190.889 67.545 193.679 66.285L194.219 72.495L180.719 51.57L189.764 38.475L191.114 39.15C192.464 43.47 193.544 47.655 194.354 51.705C195.164 55.755 195.974 60.615 196.784 66.285L187.604 96.795C185.444 98.235 182.969 99.36 180.179 100.17C177.389 100.89 175.139 101.25 173.429 101.25ZM239.58 101.25C234.45 101.25 229.95 99.9 226.08 97.2C222.3 94.41 219.33 90.765 217.17 86.265C215.1 81.675 213.885 76.725 213.525 71.415L209.61 14.175L218.79 -8.04663e-06L220.41 0.539993V66.96C223.56 68.04 226.8 68.85 230.13 69.39C233.46 69.93 236.7 70.2 239.85 70.2C241.47 70.2 242.28 71.235 242.28 73.305V98.415C242.28 99.315 242.1 100.035 241.74 100.575C241.38 101.025 240.66 101.25 239.58 101.25ZM239.471 109.745L250.136 120.275V123.11L239.471 133.64L228.806 123.11V120.275L239.471 109.745ZM239.61 101.25C237.81 101.25 236.91 100.575 236.91 99.225V72.495C236.91 70.965 237.81 70.2 239.61 70.2C243.39 70.2 246.99 69.885 250.41 69.255C253.92 68.535 257.07 67.545 259.86 66.285L260.4 72.495L246.9 51.57L255.945 38.475L257.295 39.15C258.645 43.47 259.725 47.655 260.535 51.705C261.345 55.755 262.155 60.615 262.965 66.285L253.785 96.795C251.625 98.235 249.15 99.36 246.36 100.17C243.57 100.89 241.32 101.25 239.61 101.25Z"
                      fill="white"
                    />
                  </svg>
                </span>
              ) : (
                <Title />
              )}
            </Link>

            {/* Auth section - visible on mobile at top */}
            <div className="flex sm:hidden shrink-0">
              {!routes.isLogin &&
                !isLoading &&
                (user ? (
                  <div className="flex items-center gap-2 text-xs">
                    <BellInbox />
                    <Link
                      to="/user/$username"
                      params={{ username: user.username }}
                      className="font-mono text-zinc-300 hover:underline cursor-pointer"
                    >
                      {user.username}
                    </Link>
                    <span className="font-mono text-zinc-300">|</span>
                    <button
                      type="button"
                      className="font-mono text-zinc-300 hover:underline cursor-pointer"
                      onClick={handleLogout}
                    >
                      خروج
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/login"
                    className="px-2 py-1 rounded transition-colors hover:text-white text-xs"
                  >
                    <span>تسجيل</span>
                  </Link>
                ))}
            </div>
          </div>

          {/* Navigation Links - wrapping on mobile, inline on desktop */}
          <div className="flex flex-wrap items-center gap-x-0 gap-y-1 text-xs sm:text-sm">
            <ActiveLinks />
          </div>

          {/* Auth section - visible on desktop at right */}
          <div className="hidden sm:flex shrink-0 justify-end">
            {!routes.isLogin &&
              !isLoading &&
              (user ? (
                <div className="flex items-center gap-2">
                  <BellInbox />
                  <Link
                    to="/user/$username"
                    params={{ username: user.username }}
                    className="text-xs font-mono text-zinc-300 hover:underline cursor-pointer"
                  >
                    {user.username}
                  </Link>
                  <span className="text-xs font-mono text-zinc-300">|</span>
                  <button
                    type="button"
                    className="text-xs font-mono text-zinc-300 hover:underline cursor-pointer"
                    onClick={handleLogout}
                  >
                    تسجيل الخروج
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="px-2 py-1 rounded transition-colors hover:text-white"
                >
                  <span>تسجيل</span>
                </Link>
              ))}
          </div>
        </div>
      </nav>
    </header>
  );
}
