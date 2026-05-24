"use client";

// apps/web/src/app/components/header.tsx
import { useEffect, useState, useRef } from "react";
import { Bell, Check, Globe, LogOut, ChevronDown } from "lucide-react";
import { auth, notifications as notificationsApi, equipment as equipmentApi } from "@/lib/api";
import type { User, Notification } from "@/lib/api";
import { useTranslation } from "react-i18next";

export default function Header() {
  const { t, i18n } = useTranslation();
  const [user, setUser]         = useState<User | null>(null);
  const [loaded, setLoaded]     = useState(false);
  const [notifs, setNotifs]     = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [langOpen, setLangOpen]   = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [assetNames, setAssetNames] = useState<Record<number, string>>({});
  const notifRef = useRef<HTMLDivElement>(null);
  const langRef  = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    auth.me()
      .then(async (u: User) => {
        setUser(u);
        const ns = await notificationsApi.list().catch(() => [] as Notification[]);
        setNotifs(ns);

        const assetIds = [...new Set(
          ns
            .filter((n) => n.reference_type === "equipment_request" && n.reference_id != null)
            .map((n) => n.reference_id!)
        )];
        if (assetIds.length > 0) {
          const names: Record<number, string> = {};
          await Promise.allSettled(
            assetIds.map(async (id) => {
              try {
                const req = await fetch(`/new/api/requisitions/${id}`, {
                  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
                }).then((r) => r.json());
                if (req?.snipeit_asset_id) {
                  const asset = await equipmentApi.get(req.snipeit_asset_id);
                  names[id] = asset.name ? asset.name : `Asset #${req.snipeit_asset_id}`;
                  console.log(asset.name ? asset.name : `Asset #${req.snipeit_asset_id}`);
                }
              } catch {
                // keep as is
              }
            })
          );
          setAssetNames(names);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoaded(true));
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

  if (!loaded) return <div className="flex justify-end mb-6 h-10" />;

  const unread = notifs.filter((n) => !n.is_read).length;

  const LANGS = [
    { code: "en", label: "English", flag: "🇬🇧" },
    { code: "pt", label: "Português", flag: "🇵🇹" },
  ];
  const currentLang = (i18n.language ?? "en").substring(0, 2);

  return (
    <div className="hidden lg:flex justify-end items-center gap-2 mb-6">
      <div className="relative" ref={langRef}>
        <button
          onClick={() => setLangOpen((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all text-sm font-medium ${
            langOpen
              ? "text-indigo-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          title={t("common.language")}
        >
          <Globe size={15} />
          <span className="uppercase font-bold text-xs">{currentLang}</span>
        </button>

        {langOpen && (
          <div className="absolute right-0 top-11 w-44 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden py-1">
            {LANGS.map((lang) => (
              <button
                key={lang.code}
                onClick={() => { i18n.changeLanguage(lang.code); setLangOpen(false); }}
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

      {user ? (
        <>
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                notifOpen
                  ? "text-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
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
              <div className="absolute right-0 top-12 w-84 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden" style={{ width: "22rem" }}>
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/80">
                  <div className="flex items-center gap-2">
                    <Bell size={14} className="text-gray-400" />
                    <span className="text-sm font-bold text-gray-800">{t("header.notifications")}</span>
                    {unread > 0 && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] font-bold rounded-full">{unread}</span>
                    )}
                  </div>
                  {unread > 0 && (
                    <button
                      onClick={markAllRead}
                      className="flex items-center gap-1 text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
                    >
                      <Check size={11} /> {t("header.markAllRead")}
                    </button>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                  {notifs.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                      <Bell size={24} className="text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">{t("header.noNotifications")}</p>
                    </div>
                  ) : notifs.map((n) => {
                    const s = getStyle(n);
                    let message = n.message;
                    if (n.reference_type === "equipment_request" && n.reference_id && assetNames[n.reference_id]) {
                      message = message.replace(/asset #\d+/g, assetNames[n.reference_id]);
                    }
                    return (
                      <button
                        key={n.id}
                        onClick={() => !n.is_read && markRead(n.id)}
                        className={`w-full text-left px-5 py-3.5 transition-all relative ${s.border} ${n.is_read ? "hover:bg-gray-50" : "hover:brightness-95"}`}
                      >
                        {!n.is_read && (
                          <span className={`absolute top-4 right-4 w-2 h-2 rounded-full ${s.dot}`} />
                        )}
                        <div className={`text-xs font-bold mb-0.5 pr-5 ${s.title}`}>{n.title}</div>
                        <div className="text-xs text-gray-500 leading-relaxed pr-5 break-words whitespace-normal">{message}</div>
                        <div className="text-[10px] text-gray-400 mt-1.5">
                          {new Date(n.created_at).toLocaleDateString("pt-PT", {
                            day: "numeric", month: "short",
                            hour: "2-digit", minute: "2-digit"
                          })}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
                userMenuOpen ? "bg-gray-100" : "hover:bg-gray-50"
              }`}
            >
              <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-semibold text-gray-700 hidden sm:block max-w-[120px] truncate">
                {user.name.split(" ")[0]}
              </span>
              <ChevronDown size={14} className="text-gray-400 hidden sm:block" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-12 w-56 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden py-1">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                  <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
                  {user.email && <p className="text-xs text-gray-500 truncate">{user.email}</p>}
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
        </>
      ) : (
        <button
          onClick={() => {
            localStorage.setItem("returnUrl", window.location.pathname + window.location.search);
            window.location.href = auth.loginUrl();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors"
        >
          {t("header.login")}
        </button>
      )}
    </div>
  );
}