"use client";

// apps/web/src/app/page.tsx
import { useEffect, useState, useRef } from "react";
import { Search, Folder, Cpu, Users, Activity, X, ArrowUpRight, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { projects as projectsApi, equipment as equipmentApi, auth, users as usersApi } from "@/lib/api";
import type { Project, User, EquipmentCatalogItem } from "@/lib/api";
import Header from "@/app/components/header";
import { useTranslation } from "react-i18next";

function HomeContent() {
  const { t } = useTranslation();
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [catalogList, setCatalogList] = useState<EquipmentCatalogItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [user, setUser]               = useState<User | null>(null);
  const [userCount, setUserCount]     = useState(0);
  const [search, setSearch]           = useState("");
  const [allUsers, setAllUsers]       = useState<User[]>([]);
  const [searchResults, setSearchResults] = useState<{
    projects: Project[];
    equipment: EquipmentCatalogItem[];
    users: User[];
  } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const me = await auth.me();
        setUser(me);
      } catch {
        setUser(null);
      }

      try {
        const [p, e, u] = await Promise.all([
          projectsApi.list().catch(() => []),
          equipmentApi.catalog().catch(() => []),
          usersApi.list().catch(() => []),
        ]);
        setProjectList(p);
        setCatalogList(e);
        setUserCount(u.length);
        setAllUsers(u);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchResults(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSearch = (q: string) => {
    setSearch(q);
    if (!q.trim()) { setSearchResults(null); return; }
    const ql = q.toLowerCase();
    setSearchResults({
      projects:  projectList.filter((p) => p.name.toLowerCase().includes(ql)),
      equipment: catalogList.filter((e) => e.name.toLowerCase().includes(ql)),
      users:     allUsers.filter((u) => u.name.toLowerCase().includes(ql)),
    });
  };

  const activeProjects  = projectList.filter((p) => p.status === "active").length;
  const checkedOut         = catalogList.filter((e) => e.status === "checked_out").length;
  const availableEquip  = catalogList.filter((e) => e.available).length;
  const recentProjects  = [...projectList]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);

  return (
    <main className="flex-1 px-3 py-4 sm:p-8 bg-[#f4f5f7] min-h-screen font-sans text-gray-900">
        <Header />

        <div className="flex flex-col items-center text-center mb-10 mt-4 px-1 sm:px-2">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-3 text-gray-900 leading-tight">
            {t("home.title")}{" "}
            <span className="text-indigo-600">{t("home.titleHighlight")}</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-500 mb-8 font-medium max-w-xl">
            {t("home.subtitle")}
          </p>

          <div className="relative w-full max-w-2xl" ref={searchRef}>
            <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t("home.searchPlaceholder")}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-12 pr-10 py-3.5 rounded-full border border-gray-200 bg-white text-gray-900 font-medium text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm placeholder:text-gray-400"
            />
            {search && (
              <button
                onClick={() => handleSearch("")}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}

            {searchResults && search.trim() && (
              <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-gray-200 rounded-3xl shadow-xl z-50 overflow-hidden max-h-[420px] overflow-y-auto py-2">
                {searchResults.projects.length === 0 &&
                searchResults.equipment.length === 0 &&
                searchResults.users.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">
                    {t("home.noResults", { query: search })}
                  </div>
                ) : (
                  <>
                    {searchResults.projects.length > 0 && (
                      <div>
                        <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">
                          {t("home.projects")}
                        </div>
                        {searchResults.projects.slice(0, 4).map((p) => (
                          <Link key={p.id} href={`/projects/${p.id}`} onClick={() => setSearchResults(null)}>
                            <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors">
                              <Folder size={16} className="text-gray-400 shrink-0" />
                              <div className="flex-1 min-w-0 text-left">
                                <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                                <div className="text-xs text-gray-400 capitalize">{p.status}</div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                    {searchResults.equipment.length > 0 && (
                      <div>
                        <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center mt-1">
                          {t("home.equipment")}
                        </div>
                        {searchResults.equipment.slice(0, 4).map((e) => (
                          <Link key={e.id} href={`/equipment/${e.id}`} onClick={() => setSearchResults(null)}>
                            <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors">
                              <Cpu size={16} className="text-gray-400 shrink-0" />
                              <div className="flex-1 min-w-0 text-left">
                                <div className="text-sm font-medium text-gray-900 truncate">{e.name}</div>
                                <div className="text-xs text-gray-400">{e.available ? t("home.available") : t("home.inUse")}</div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                    {searchResults.users.length > 0 && (
                      <div>
                        <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center mt-1">
                          {t("home.users")}
                        </div>
                        {searchResults.users.slice(0, 4).map((u) => (
                          <Link key={u.id} href={`/users/${u.id}`} onClick={() => setSearchResults(null)}>
                            <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors">
                              <Users size={16} className="text-gray-400 shrink-0" />
                              <div className="flex-1 min-w-0 text-left">
                                <div className="text-sm font-medium text-gray-900 truncate">{u.name}</div>
                                <div className="text-xs text-gray-400 capitalize">{u.role}</div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <Link href="/projects" className="block">
            <StatCard
              icon={<Folder size={20} className="text-blue-500" />}
              iconBg="bg-blue-50"
              value={loading ? "..." : String(activeProjects)}
              label={t("home.activeProjects")}
            />
          </Link>
          <Link href="/equipment" className="block">
            <StatCard
              icon={<Cpu size={20} className="text-teal-500" />}
              iconBg="bg-teal-50"
              value={loading ? "..." : String(availableEquip)}
              label={t("home.availableEquipment")}
            />
          </Link>
          <Link href="/users" className="block">
            <StatCard
              icon={<Users size={20} className="text-purple-500" />}
              iconBg="bg-purple-50"
              value={loading ? "..." : String(userCount)}
              label={t("home.labMembers")}
            />
          </Link>
          <Link href="/equipment" className="block">
            <StatCard
              icon={<Activity size={20} className="text-yellow-500" />}
              iconBg="bg-yellow-50"
              value={loading ? "..." : String(checkedOut)}
              label={t("home.checkedOut")}
            />
          </Link>
        </div>

        <div>
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-xl font-bold text-gray-900">{t("home.recentProjects")}</h2>
            <Link href="/projects" className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm">
              {t("home.viewAll")} →
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-[20px] h-[220px] animate-pulse" />
              ))}
            </div>
          ) : recentProjects.length === 0 ? (
            <p className="text-gray-400 text-center py-12">{t("home.noProjects")}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recentProjects.map((proj) => (
                <Link key={proj.id} href={`/projects/${proj.id}`}>
                  <ProjectCard
                    title={proj.name}
                    desc={proj.description ?? ""}
                    status={proj.status}
                    course={proj.course ?? ""}
                    noDescText={t("home.noDescription")}
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400 animate-pulse">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}

function StatCard({
  icon, iconBg, value, label,
}: {
  icon: React.ReactNode; iconBg: string; value: string; label: string;
}) {
  return (
    <div className="group bg-white p-5 rounded-[20px] border border-gray-100 shadow-sm flex flex-col justify-between h-32 sm:h-36 cursor-pointer hover:shadow-md hover:border-gray-200 transition-all duration-200">
      <div className="flex justify-between items-start">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <ArrowUpRight size={16} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div>
        <div className="text-2xl sm:text-3xl font-bold text-gray-900 leading-none mb-1">{value}</div>
        <div className="text-xs sm:text-sm text-gray-500 font-medium leading-tight">{label}</div>
      </div>
    </div>
  );
}

function ProjectCard({
  title, desc, status, course, noDescText,
}: {
  title: string; desc: string; status: string; course: string; noDescText: string;
}) {
  const statusColor: Record<string, string> = {
    active:    "text-green-600",
    pending:   "text-yellow-600",
    rejected:  "text-red-500",
    completed: "text-blue-600",
    archived:  "text-gray-400",
  };

  return (
    <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full cursor-pointer hover:shadow-md hover:border-gray-200 transition-all duration-200">
      <div className="h-[100px] sm:h-[120px] bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center">
        <Folder size={36} strokeWidth={1.5} className="text-indigo-300" />
      </div>
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-gray-900 text-sm mb-1 truncate">{title}</h3>
          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{desc || noDescText}</p>
        </div>
        <div className="flex items-center gap-1.5 mt-3 text-xs font-medium text-gray-400">
          {course && <span className="truncate max-w-[80px]">{course}</span>}
          {course && <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0" />}
          <span className={`capitalize font-semibold ${statusColor[status] ?? "text-gray-500"}`}>
            {status}
          </span>
        </div>
      </div>
    </div>
  );
}