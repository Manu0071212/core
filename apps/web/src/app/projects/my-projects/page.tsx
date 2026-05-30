"use client";

// apps/web/src/app/projects/my-projects/page.tsx
import { useEffect, useState } from "react";
import { Search, Plus, Cpu } from "lucide-react";
import Link from "next/link";
import { projects as projectsApi, requisitions as reqApi, equipment as equipmentApi, auth, requisitions as requisitionsApi } from "@/lib/api";
import type { Project, Requisition } from "@/lib/api";
import Header from "@/app/components/header";
import { useTranslation } from "react-i18next";

const FILTERS = ["All", "Pending", "Active", "Completed", "Rejected"];

export default function MyProjectsPage() {
  const { t } = useTranslation();
  const [myProjects, setMyProjects]         = useState<Project[]>([]);
  const [reqsByProject, setReqsByProject]   = useState<Record<number, Requisition[]>>({});
  const [assetNames, setAssetNames]         = useState<Record<number, string>>({});
  const [loading, setLoading]               = useState(true);
  const [activeFilter, setActiveFilter]     = useState("All");
  const [searchQuery, setSearchQuery]       = useState("");

  useEffect(() => {
    (async () => {
      try {
        const user = await auth.me();
        const all  = await projectsApi.list();
        const mine = all.filter((p) => p.created_by === user.id);
        setMyProjects(mine);

        const reqs: Record<number, Requisition[]> = {};
        await Promise.all(
          mine.map(async (p) => {
            try { reqs[p.id] = await reqApi.listByProject(p.id); }
            catch { reqs[p.id] = []; }
          })
        );
        setReqsByProject(reqs);

        const assetIds = [...new Set(
          Object.values(reqs).flat()
            .map((r) => r.snipeit_asset_id)
            .filter((id): id is number => id != null)
        )];
        const names: Record<number, string> = {};
        await Promise.allSettled(
          assetIds.map(async (id) => {
            try { const a = await equipmentApi.get(id); names[id] = a.name ?? `Asset #${id}`; }
            catch { names[id] = `Asset #${id}`; }
          })
        );
        setAssetNames(names);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    requisitionsApi.syncSnipeit().catch(console.error);
  }, []);

  const filtered = myProjects.filter((proj) => {
    const matchesFilter =
      activeFilter === "All" ||
      proj.status.toLowerCase() === activeFilter.toLowerCase();
    return matchesFilter && proj.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <main className="flex-1 bg-[#f4f5f7] min-h-screen font-sans text-gray-900">
      <div className="px-4 py-6">
        <Header />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold mb-0.5">{t("projectsPage.myProjects")}</h1>
            <p className="text-gray-400 text-xs sm:text-sm font-medium">{t("projectsPage.myProjectsSubtitle")}</p>
          </div>
          <Link
            href="/projects/new"
            className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm text-sm"
          >
            <Plus size={16} /> {t("projectsPage.newProject")}
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 mb-6 w-full">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-12 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none text-sm text-gray-600 placeholder:text-gray-400 transition-all shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              placeholder={t("projectsPage.searchNamePlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap border transition-all shrink-0 ${
                  activeFilter === f
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
              >
                {f === "All" ? t("usersPage.all") : t(`projectsPage.status.${f.toLowerCase()}` as any)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border border-gray-200 rounded-2xl h-32 animate-pulse bg-gray-50" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">{t("projectsPage.noProjects")}</div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map((proj) => (
              <ProjectCard
                key={proj.id}
                project={proj}
                requisitions={reqsByProject[proj.id] ?? []}
                assetNames={assetNames}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function ProjectCard({
  project,
  requisitions,
  assetNames,
}: {
  project: Project;
  requisitions: Requisition[];
  assetNames: Record<number, string>;
}) {
  const { t } = useTranslation();
  const now = new Date();

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending:     { label: t("projectsPage.status.awaitingApproval"), color: "bg-yellow-50 text-yellow-600 border-yellow-200" },
    active:      { label: t("projectsPage.status.active"),            color: "bg-green-50 text-green-600 border-green-200" },
    completed:   { label: t("projectsPage.status.completed"),         color: "bg-blue-50 text-blue-600 border-blue-200" },
    rejected:    { label: t("projectsPage.status.rejected"),          color: "bg-red-50 text-red-500 border-red-200" },
    archived:    { label: t("projectsPage.status.archived"),          color: "bg-gray-100 text-gray-500 border-gray-200" },
  };
  const sc = statusConfig[project.status] ?? { label: project.status, color: "bg-gray-100 text-gray-500 border-gray-200" };

  return (
    <Link href={`/projects/${project.id}`} className="block">
      <div className="border border-gray-200 rounded-[24px] overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer">

        <div className="p-6 pb-4">
          <div className="flex flex-col mb-3">
            <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap sm:flex-nowrap w-full">
              <h3 className="font-bold text-gray-900 text-xl break-words min-w-0 flex-1">{project.name}</h3>
              <span className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${sc.color}`}>
                {sc.label}
              </span>
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-4 line-clamp-2">
            {project.description ?? t("projectsPage.noDescription")}
          </p>

          <div className="flex gap-2 flex-wrap">
            {project.course && (
              <span className="px-3 py-1 border border-gray-200 text-gray-500 text-[10px] font-bold uppercase rounded-full">
                {project.course}
              </span>
            )}
            {project.group_number && (
              <span className="px-3 py-1 border border-gray-200 text-gray-500 text-[10px] font-bold uppercase rounded-full">
                {t("projectsPage.group")} {project.group_number}
              </span>
            )}
            {project.academic_year && (
              <span className="px-3 py-1 border border-gray-200 text-gray-500 text-[10px] font-bold uppercase rounded-full">
                {project.academic_year}
              </span>
            )}
          </div>
        </div>

        {requisitions.length > 0 && (
          <div className="border-t border-gray-100 bg-white p-6 pt-4">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              {t("projectsPage.equipmentRequests", { count: requisitions.length })}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {requisitions.map((req) => {
                const assetName = req.snipeit_asset_id
                  ? (assetNames[req.snipeit_asset_id] ?? `${t("ledgerPage.asset")} #${req.snipeit_asset_id}`)
                  : t("ledgerPage.unknownAsset");

                let statusLabel = req.status;
                let badgeColor  = "bg-gray-100 text-gray-500";

                if (req.status === "pending") {
                  statusLabel = t("projectsPage.status.pending");
                  badgeColor  = "bg-yellow-50 text-yellow-600";
                } else if (req.status === "reserved") {
                  statusLabel = t("projectsPage.status.reserved");
                  badgeColor  = "bg-purple-50 text-purple-600";
                } else if (req.status === "returned") {
                  statusLabel = t("projectsPage.status.returned");
                  badgeColor  = "bg-green-50 text-green-600";
                } else if (req.status === "rejected") {
                  statusLabel = t("projectsPage.status.rejected");
                  badgeColor  = "bg-red-50 text-red-500";
                } else if (req.status === "checked_out") {
                  if (req.expected_checkin) {
                    const due       = new Date(req.expected_checkin);
                    const isOverdue = due < now;
                    statusLabel = isOverdue
                      ? t("projectsPage.status.overdue")
                      : `${t("projectsPage.returnBy")} ${due.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`;
                    badgeColor = isOverdue ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600";
                  } else {
                    statusLabel = t("projectsPage.status.checkedOut");
                    badgeColor  = "bg-orange-50 text-orange-600";
                  }
                }

                return (
                  <div key={req.id} className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-start sm:items-center justify-between text-sm gap-3">
                    <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
                      <Cpu size={13} className="text-gray-300 shrink-0 mt-0.5 sm:mt-0" />
                      <span className="text-gray-600 break-words">{assetName}</span>
                    </div>
                    <span className={`shrink-0 mt-0.5 sm:mt-0 px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full ${badgeColor}`}>
                      {statusLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}