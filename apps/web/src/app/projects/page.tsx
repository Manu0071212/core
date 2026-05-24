"use client";

// apps/web/src/app/projects/page.tsx
import { useEffect, useState } from "react";
import { Search, BookOpen, Plus, ChevronRight } from "lucide-react";
import Link from "next/link";
import { projects as projectsApi, auth } from "@/lib/api";
import type { Project } from "@/lib/api";
import Header from "@/app/components/header";
import { useTranslation } from "react-i18next";

const STATUS_FILTERS = ["All", "Pending", "Active", "Completed"];

function getStatusStyles(status: string) {
  const s = status.toLowerCase();
  if (s === "active")    return { bg: "bg-green-50",  text: "text-green-600",  dot: "bg-green-500" };
  if (s === "pending")   return { bg: "bg-yellow-50", text: "text-yellow-600", dot: "bg-yellow-500" };
  if (s === "rejected")  return { bg: "bg-red-50",    text: "text-red-600",    dot: "bg-red-500" };
  if (s === "completed") return { bg: "bg-blue-50",   text: "text-blue-600",   dot: "bg-blue-500" };
  return { bg: "bg-gray-50", text: "text-gray-500", dot: "bg-gray-400" };
}

export default function ProjectsPage() {
  const { t } = useTranslation();
  const [projectList, setProjectList]   = useState<Project[]>([]);
  const [loading, setLoading]           = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery]   = useState("");
  const [isLoggedIn, setIsLoggedIn]     = useState(false);

  useEffect(() => {
    Promise.allSettled([
      projectsApi.list(),
      auth.me(),
    ])
      .then(([projectsRes, meRes]) => {
        if (projectsRes.status === "fulfilled") {
          setProjectList(projectsRes.value);
        }

        setIsLoggedIn(meRes.status === "fulfilled");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = projectList.filter((proj) => {
    const matchesFilter =
      activeFilter === "All" ||
      (proj.status ?? "active").toLowerCase() === activeFilter.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      proj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (proj.course ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <main className="flex-1 px-3 py-4 sm:p-8 bg-[#f4f5f7] min-h-screen font-sans text-gray-900">
        <Header />

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-[32px] font-bold text-gray-900 mb-1 leading-tight">
              {t("projectsPage.title")}
            </h1>
            <p className="text-gray-500 font-medium">
              {t("projectsPage.count", { count: projectList.length })}
            </p>
          </div>
          {isLoggedIn && (
            <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
              <Link
                href="/projects/my-projects"
                className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm h-auto min-h-[44px]"
              >
                <BookOpen size={15} className="shrink-0" />
                <span className="whitespace-normal text-center leading-tight">
                  {t("projectsPage.myProjects")}
                </span>
              </Link>

              <Link
                href="/projects/new"
                className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm h-auto min-h-[44px]"
              >
                <Plus size={16} className="shrink-0" />
                <span className="whitespace-normal text-center leading-tight">
                  {t("projectsPage.newProject")}
                </span>
              </Link>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 mb-6 w-full">
          
          <div className="relative flex-1 w-full">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-12 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none text-sm text-gray-600 placeholder:text-gray-400 transition-all shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              placeholder={t("projectsPage.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((option) => {
              const label = option === "All"
                ? t("equipmentPage.all")
                : t(`statistics.status.${option.toLowerCase()}`, option);
              return (
                <button
                  key={option}
                  onClick={() => setActiveFilter(option)}
                  className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap border transition-all shrink-0 ${
                    activeFilter === option
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-1">
          {t("projectsPage.results", { count: filtered.length })}
        </p>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="border border-transparent rounded-xl p-5 h-20 animate-pulse bg-white" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="bg-[#eceef1] p-4 rounded-full mb-4">
              <Search size={32} className="text-gray-400" />
            </div>
            <p className="text-gray-400 font-medium">
              {t("projectsPage.noResults", "No projects found.")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((proj) => {
              const statusDisplay = proj.status ?? "active";
              const styles = getStatusStyles(statusDisplay);

              return (
                <Link
                  key={proj.id}
                  href={`/projects/${proj.id}`}
                  className="group bg-white border border-transparent hover:border-indigo-100 rounded-2xl p-4 sm:px-5 sm:py-4 flex flex-row items-center justify-between gap-3 sm:gap-4 transition-all shadow-sm hover:shadow-md"
                >
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      {/* Removido o truncate/line-clamp. Adicionado break-words e whitespace-normal */}
                      <h3 className="font-bold text-gray-900 text-base break-words whitespace-normal leading-tight">
                        {proj.name}
                      </h3>
                      {proj.course && (
                        <span className="hidden sm:inline-block px-2.5 py-0.5 bg-gray-100 border border-gray-200 text-gray-500 text-[10px] font-bold uppercase rounded-lg shrink-0">
                          {proj.course}
                        </span>
                      )}
                    </div>

                    <div className="flex sm:hidden flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${styles.bg} ${styles.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                        <span>
                          {t(`statistics.status.${statusDisplay.toLowerCase()}`, statusDisplay)}
                        </span>
                      </span>
                      {proj.course && (
                        <span className="text-[11px] font-bold text-gray-500 uppercase">
                          {proj.course}
                        </span>
                      )}
                    </div>

                    {/* Removido o truncate/line-clamp. Adicionado break-words e whitespace-normal */}
                    <p className="text-sm text-gray-400 break-words whitespace-normal mt-0.5">
                      {proj.description ?? t("projectsPage.noDescription")}
                    </p>

                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-1">
                    <span className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${styles.bg} ${styles.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                      <span>
                        {t(`statistics.status.${statusDisplay.toLowerCase()}`, statusDisplay)}
                      </span>
                    </span>
                    <div className="flex p-2 bg-gray-50 rounded-lg group-hover:bg-indigo-50 transition-colors shrink-0">
                      <ChevronRight size={18} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
    </main>
  );
}