"use client";

// apps/web/src/app/components/sidebar.tsx
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Folder,
  Cpu,
  Users,
  BarChart3,
  BookText,
  Wrench,
  Menu,
  X,
  Package,
  ExternalLink,
  Globe,
  ChevronLeft,
  ChevronRight,
  Bell,
  Check,
  LogOut,
} from "lucide-react";
import { auth, notifications as notificationsApi, equipment as equipmentApi } from "@/lib/api";
import type { User, Notification } from "@/lib/api";
import { useTranslation } from "react-i18next";

export default function Sidebar() {
  const { t, i18n } = useTranslation();

  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [notifs, setNotifs] = useState<Notification[]>([]);

  const [notifOpen, setNotifOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const [assetNames, setAssetNames] = useState<Record<number, string>>({});

  const notifRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoaded(true);
      return;
    }

    auth.me()
      .then(async (u: User) => {
        setUser(u);

        const ns = await notificationsApi
          .list()
          .catch(() => [] as Notification[]);

        setNotifs(ns);

        const assetIds = [
          ...new Set(
            ns
              .filter(
                (n) =>
                  n.reference_type === "equipment_request" &&
                  n.reference_id != null
              )
              .map((n) => n.reference_id!)
          ),
        ];

        if (assetIds.length > 0) {
          const names: Record<number, string> = {};

          await Promise.allSettled(
            assetIds.map(async (id) => {
              try {
                const req = await fetch(
                  `${process.env.NEXT_PUBLIC_API_URL ?? "/api"}/requisitions/${id}`,
                  {
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
                  }
                ).then((r) => r.json());

                if (req?.snipeit_asset_id) {
                  const asset = await equipmentApi.get(
                    req.snipeit_asset_id
                  );

                  names[id] =
                    asset.name ?
                    asset.name :
                    `Asset #${req.snipeit_asset_id}`;
                }
              } catch {}
            })
          );

          setAssetNames(names);
        }
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (langRef.current  && !langRef.current.contains(e.target as Node))  setLangOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleLogout() {
    localStorage.removeItem("token");
    document.cookie = "token=; path=/; max-age=0";
    window.location.reload();
  }

  async function markRead(id: number) {
    await notificationsApi.markRead(id).catch(() => {});
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  }

  async function markAllRead() {
    await Promise.allSettled(notifs.filter((n) => !n.is_read).map((n) => notificationsApi.markRead(n.id)));
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  const typeStyles: Record<string, { border: string; dot: string; title: string }> = {
    approval: { border: "border-l-4 border-indigo-400 bg-indigo-50",  dot: "bg-indigo-500",  title: "text-indigo-800" },
    warning:  { border: "border-l-4 border-yellow-400 bg-yellow-50", dot: "bg-yellow-500", title: "text-yellow-800" },
    reminder: { border: "border-l-4 border-orange-400 bg-orange-50", dot: "bg-orange-500", title: "text-orange-800" },
    info:     { border: "border-l-4 border-blue-400 bg-blue-50",     dot: "bg-blue-500",   title: "text-blue-800"   },
  };

  const getStyle = (n: Notification) =>
    n.is_read ? { border: "bg-white", dot: "bg-gray-300", title: "text-gray-700" }
              : (typeStyles[n.type] ?? typeStyles.info);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // When Next.js basePath is set (e.g. /new), usePathname() returns paths
  // WITHOUT the basePath prefix — e.g. '/auth/callback', not '/new/auth/callback'.
  if (pathname.startsWith("/auth")) return null;

  const menuItems = [
    { name: t("sidebar.dashboard"),  href: "/",           icon: <LayoutDashboard size={20} /> },
    { name: t("sidebar.projects"),   href: "/projects",   icon: <Folder size={20} /> },
    { name: t("sidebar.equipment"),  href: "/equipment",  icon: <Cpu size={20} /> },
    { name: t("sidebar.users"),      href: "/users",      icon: <Users size={20} /> },
    { name: t("sidebar.statistics"), href: "/statistics", icon: <BarChart3 size={20} /> },
    { name: t("sidebar.ledger"),     href: "/ledger",     icon: <BookText size={20} /> },
  ];

  const unread = notifs.filter((n) => !n.is_read).length;

  const LANGS = [
    { code: "en", label: "English", flag: "🇬🇧" },
    { code: "pt", label: "Português", flag: "🇵🇹" },
  ];
  const currentLang = (i18n.language ?? "en").substring(0, 2);

  const NavContent = ({ collapsed }: { collapsed: boolean }) => (
    <>
      <Link
        href="/"
        className={`flex items-center h-16 shrink-0 mb-2 ${collapsed ? "justify-center px-4" : "px-5 gap-3"}`}
      >
        <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/deti-maker-lab.png`} alt="DETI MakerLab" className="w-9 h-9 object-contain shrink-0" />
        {!collapsed && (
          <span className="font-bold text-base text-indigo-600 truncate">DETI Maker Lab</span>
        )}
      </Link>

      <div className="h-px bg-gray-100 mb-3 mx-3" />

      <nav className="flex-1 overflow-y-auto flex flex-col gap-0.5 px-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center rounded-xl text-sm font-medium transition-all duration-150 ${
                collapsed ? "justify-center py-3 px-2" : "gap-3 px-3 py-2.5"
              } ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}
              title={collapsed ? item.name : ""}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}

        {user?.role === "lab_technician" && (
          <>
            {!collapsed ? (
              <div className="mt-6 mb-1 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {t("sidebar.management")}
              </div>
            ) : (
              <div className="h-px bg-gray-100 my-3 mx-1" />
            )}
            <Link
              href="/admin"
              className={`flex items-center rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-all ${
                collapsed ? "justify-center py-3 px-2" : "gap-3 px-3 py-2.5"
              } ${pathname === "/admin" ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 hover:text-white" : ""}`}
              title={collapsed ? t("sidebar.technicianPortal") : ""}
            >
              <Wrench size={20} className="shrink-0" />
              {!collapsed && <span>{t("sidebar.technicianPortal")}</span>}
            </Link>

            <a
              href={process.env.NEXT_PUBLIC_SNIPEIT_URL ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-all ${
                collapsed ? "justify-center py-3 px-2" : "gap-3 px-3 py-2.5"
              }`}
              title={collapsed ? t("sidebar.inventory") : ""}
            >
              <Package size={20} className="shrink-0" />
              {!collapsed && (
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span>{t("sidebar.inventory")}</span>
                  <ExternalLink size={13} className="text-gray-400 shrink-0 ml-1" />
                </div>
              )}
            </a>
          </>
        )}
      </nav>

      <div className="p-3 border-t border-gray-100 flex flex-col gap-1.5 shrink-0">

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex border border-gray-100 rounded-xl p-2 w-full justify-center bg-gray-50 hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
          title={isCollapsed ? t("sidebar.expandSidebar") : t("sidebar.collapseSidebar")}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </>
  );

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-gray-100">
        <div className="grid grid-cols-3 items-center h-full px-4">
          
          <div className="flex items-center justify-start">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <Menu size={22} />
            </button>
          </div>

          <Link
            href="/"
            className="flex items-center justify-center gap-2 min-w-0"
          >
            <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/deti-maker-lab.png`} alt="DETI MakerLab" className="w-8 h-8 object-contain shrink-0" />
          </Link>

          <div className="flex items-center justify-end gap-1">
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangOpen((v) => !v)}
                className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all ${
                  langOpen
                    ? "text-indigo-600 bg-indigo-50"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Globe size={16} />
              </button>

              {langOpen && (
                <div className="absolute right-0 top-11 w-44 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden py-1">
                  {LANGS.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        i18n.changeLanguage(lang.code);
                        setLangOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                        currentLang === lang.code
                          ? "bg-indigo-50 text-indigo-600 font-semibold"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="text-base">{lang.flag}</span>
                      <span>{lang.label}</span>

                      {currentLang === lang.code && (
                        <Check size={13} className="ml-auto text-indigo-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {user && (
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen((v) => !v)}
                  className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-all ${
                    notifOpen
                      ? "text-indigo-600 bg-indigo-50"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Bell size={17} />

                  {unread > 0 && (
                    <span className="absolute top-0 right-0 w-4 h-4 bg-indigo-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div
                    className="absolute right-0 top-11 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden"
                    style={{ width: "20rem" }}
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/80">
                      <div className="flex items-center gap-2">
                        <Bell size={14} className="text-gray-400" />
                        <span className="text-sm font-bold text-gray-800">
                          {t("header.notifications")}
                        </span>

                        {unread > 0 && (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] font-bold rounded-full">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                      {notifs.length === 0 ? (
                        <div className="px-5 py-8 text-center">
                          <Bell size={22} className="text-gray-200 mx-auto mb-2" />
                          <p className="text-sm text-gray-400">
                            {t("header.noNotifications")}
                          </p>
                        </div>
                      ) : (
                        notifs.map((n) => {
                          const s = getStyle(n);

                          let message = n.message;

                          if (
                            n.reference_type === "equipment_request" &&
                            n.reference_id &&
                            assetNames[n.reference_id]
                          ) {
                            message = message.replace(
                              /asset #\d+/g,
                              assetNames[n.reference_id]
                            );
                          }

                          return (
                            <button
                              key={n.id}
                              onClick={() => !n.is_read && markRead(n.id)}
                              className={`w-full text-left px-4 py-3 transition-all relative ${s.border}`}
                            >
                              {!n.is_read && (
                                <span
                                  className={`absolute top-4 right-4 w-2 h-2 rounded-full ${s.dot}`}
                                />
                              )}

                              <div className={`text-xs font-bold mb-1 pr-5 ${s.title}`}>
                                {n.title}
                              </div>

                              <div className="text-xs text-gray-500 leading-relaxed pr-5 break-words whitespace-normal">
                                {message}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all ${
                    userMenuOpen
                      ? "bg-gray-100"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-11 w-56 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden py-1">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {user.name}
                      </p>

                      {user.email && (
                        <p className="text-xs text-gray-500 truncate">
                          {user.email}
                        </p>
                      )}
                    </div>

                    <div className="py-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut size={16} />
                        {t("header.logout")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => {
                  localStorage.setItem(
                    "returnUrl",
                    window.location.pathname + window.location.search
                  );
                  window.location.href = auth.loginUrl();
                }}
                className="px-3 h-9 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </div>

      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex"
          onClick={(e) => { if (e.target === e.currentTarget) setIsMobileOpen(false); }}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

          <div className="relative w-64 h-full bg-white flex flex-col shadow-xl">
            <button
              onClick={() => setIsMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
            <NavContent collapsed={false} />
          </div>
        </div>
      )}

      <aside
        className={`hidden lg:flex flex-col h-screen sticky top-0 border-r border-gray-100 bg-white transition-all duration-300 shrink-0 z-30 ${
          isCollapsed ? "w-[72px]" : "w-60"
        }`}
      >
        <NavContent collapsed={isCollapsed} />
      </aside>

      <div className="lg:hidden h-14 shrink-0" />
    </>
  );
}