"use client";

// apps/web/src/app/users/[userId]/page.tsx
import { useState, useEffect, use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Folder, Cpu } from "lucide-react";
import Header from "@/app/components/header";
import {
  users as usersApi,
  projects as projectsApi,
  requisitions as requisitionsApi,
  equipment as equipmentApi,
  type User,
  type Project,
  type Requisition,
} from "@/lib/api";
import { useTranslation } from "react-i18next";

function getStatusStyles(status: string) {
  const s = status.toLowerCase();
  if (s === "active")    return { bg: "bg-green-50",  text: "text-green-600",  dot: "bg-green-500" };
  if (s === "pending")   return { bg: "bg-yellow-50", text: "text-yellow-600", dot: "bg-yellow-500" };
  if (s === "rejected")  return { bg: "bg-red-50",    text: "text-red-600",    dot: "bg-red-500" };
  if (s === "completed") return { bg: "bg-blue-50",   text: "text-blue-600",   dot: "bg-blue-500" };
  return { bg: "bg-gray-50", text: "text-gray-500", dot: "bg-gray-400" };
}

function getReqStatusStyles(status: string, isOverdue: boolean) {
  if (isOverdue) return { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-500" };
  if (status === "pending") return { bg: "bg-yellow-50", text: "text-yellow-600", dot: "bg-yellow-500" };
  if (status === "reserved") return { bg: "bg-purple-50", text: "text-purple-600", dot: "bg-purple-500" };
  if (status === "checked_out") return { bg: "bg-orange-50", text: "text-orange-600", dot: "bg-orange-500" };
  if (status === "returned") return { bg: "bg-green-50", text: "text-green-600", dot: "bg-green-500" };
  if (status === "rejected") return { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-500" };
  return { bg: "bg-gray-50", text: "text-gray-500", dot: "bg-gray-400" };
}

export default function UserDetails({ params }: { params: Promise<{ userId: string }> }) {
  const { t } = useTranslation();
  const { userId } = use(params);

  const [user, setUser]           = useState<User | null>(null);
  const [projects, setProjects]   = useState<Project[]>([]);
  const [reqs, setReqs]           = useState<Requisition[]>([]);
  const [assetNames, setAssetNames]   = useState<Record<number, string>>({});
  const [projectNames, setProjectNames] = useState<Record<number, string>>({});
  const [loading, setLoading]         = useState(true);
  const [notFoundError, setNotFoundError] = useState(false);

  useEffect(() => {
    const id = parseInt(userId);
    if (isNaN(id)) { setNotFoundError(true); return; }

    (async () => {
      try {
        const [u, p] = await Promise.all([
          usersApi.get(id),
          usersApi.projects(id),
        ]);
        setUser(u);

        const sortedProjects = [...p].sort((a, b) => {
          if (a.created_at && b.created_at) {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }
          return b.id - a.id; 
        });
        setProjects(sortedProjects);

        const pNames: Record<number, string> = {};
        p.forEach((proj) => { pNames[proj.id] = proj.name; });
        setProjectNames(pNames);

        const allReqs = await requisitionsApi.list().catch(() => [] as Requisition[]);
        const userReqs = allReqs
          .filter((r) => r.requested_by === id)
          .sort((a, b) => {
             if (a.created_at && b.created_at) {
               return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
             }
             return b.id - a.id;
          });
        setReqs(userReqs);

        const extraPIds = [...new Set(
          userReqs.map((r) => r.project_id).filter((pid) => !pNames[pid])
        )];
        const extraPNames: Record<number, string> = { ...pNames };
        await Promise.allSettled(
          extraPIds.map(async (pid) => {
            const proj = await projectsApi.get(pid).catch(() => null);
            if (proj) extraPNames[pid] = proj.name;
          })
        );
        setProjectNames(extraPNames);

        const assetIds = [...new Set(
          userReqs.map((r) => r.snipeit_asset_id).filter((x): x is number => x != null)
        )];
        const aNames: Record<number, string> = {};
        await Promise.allSettled(
          assetIds.map(async (aid) => {
            try {
              const a = await equipmentApi.get(aid);
              aNames[aid] = a.name ?? `Asset #${aid}`;
            } catch {
              aNames[aid] = `Asset #${aid}`;
            }
          })
        );
        setAssetNames(aNames);

      } catch {
        setNotFoundError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) return (
    <main className="flex-1 bg-[#f4f5f7] p-8 min-h-screen">
      <div className="text-gray-400 animate-pulse mt-8">{t("common.loading")}</div>
    </main>
  );

  if (notFoundError || !user) return notFound();

  const now = new Date();

  return (
    <main className="flex-1 px-4 sm:px-8 py-6 bg-[#f4f5f7] min-h-screen font-sans text-gray-900">
      <Header />
      <Link
        href="/users"
        className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white rounded-xl hover:bg-gray-50 mb-6 text-sm font-medium shadow-sm transition-colors"
      >
        <ArrowLeft size={16} /> {t("usersPage.back")}
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        <div className="lg:col-span-4 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col items-center text-center h-fit">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold text-3xl mb-4">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-xl font-bold mb-1 break-words w-full">{user.name}</h1>
          <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full border mb-5 ${
            user.role === "lab_technician" ? "bg-teal-50 text-teal-600 border-teal-200" :
            user.role === "professor"      ? "bg-purple-50 text-purple-600 border-purple-200" :
            "bg-indigo-50 text-indigo-600 border-indigo-200"
          }`}>
            {user.role === "lab_technician" ? t("usersPage.labTechnician") : 
             user.role === "student" ? t("usersPage.students") : t("usersPage.professors")}
          </span>

          <div className="w-full text-left flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-sm py-2 border-b border-gray-50 gap-1 sm:gap-4">
              <span className="text-gray-400 font-medium shrink-0">{t("usersPage.email")}</span>
              <span className="text-gray-700 font-semibold break-all text-left sm:text-right">{user.email}</span>
            </div>
            {user.nmec && (
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-sm py-2 border-b border-gray-50 gap-1 sm:gap-4">
                <span className="text-gray-400 font-medium shrink-0">{t("usersPage.nmec")}</span>
                <span className="text-gray-700 font-semibold break-words text-left sm:text-right">{user.nmec}</span>
              </div>
            )}
            {user.course && (
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-sm py-2 border-b border-gray-50 gap-1 sm:gap-4">
                <span className="text-gray-400 font-medium shrink-0">{t("usersPage.course")}</span>
                <span className="text-gray-700 font-semibold break-words text-left sm:text-right">{user.course}</span>
              </div>
            )}
            {user.academic_year && (
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-sm py-2 gap-1 sm:gap-4">
                <span className="text-gray-400 font-medium shrink-0">{t("usersPage.year")}</span>
                <span className="text-gray-700 font-semibold break-words text-left sm:text-right">{t("usersPage.yearValue", { year: user.academic_year })}</span>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-5">

          <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Folder size={18} className="text-gray-400" />
              <h2 className="font-bold text-gray-900">{t("usersPage.projects", { count: projects.length })}</h2>
            </div>
            {projects.length === 0 ? (
              <p className="text-gray-400 text-sm">{t("usersPage.noProjects")}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {projects.map((proj) => {
                  const pStyles = getStatusStyles(proj.status);
                  return (
                    <Link key={proj.id} href={`/projects/${proj.id}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors cursor-pointer gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-gray-800 break-words">{proj.name}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5 break-words">
                            {proj.course}
                          </div>
                        </div>
                        <span className={`self-start sm:self-center shrink-0 flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase rounded-full ${pStyles.bg} ${pStyles.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${pStyles.dot}`} />
                          {proj.status}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Cpu size={18} className="text-gray-400" />
              <h2 className="font-bold text-gray-900">{t("usersPage.equipmentRequests", { count: reqs.length })}</h2>
            </div>
            {reqs.length === 0 ? (
              <p className="text-gray-400 text-sm">{t("usersPage.noRequests")}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {reqs.map((req) => {
                  const assetName = req.snipeit_asset_id
                    ? (assetNames[req.snipeit_asset_id] ?? `Asset #${req.snipeit_asset_id}`)
                    : t("usersPage.unknownAsset");
                  const projectName = projectNames[req.project_id] ?? `Project #${req.project_id}`;
                  const reqDate = new Date(req.created_at).toLocaleDateString("en-GB", {
                    day: "2-digit", month: "short", year: "numeric",
                  });

                  let statusLabel = req.status;
                  let isOverdue = false;

                  if (req.status === "pending") { statusLabel = t("statistics.reqStatus.pending"); }
                  else if (req.status === "reserved") { statusLabel = t("statistics.reqStatus.reserved"); }
                  else if (req.status === "returned") { statusLabel = t("statistics.reqStatus.returned"); }
                  else if (req.status === "rejected") { statusLabel = t("statistics.reqStatus.rejected"); }
                  else if (req.status === "checked_out") {
                    statusLabel = t("statistics.reqStatus.checked_out");
                    if (req.expected_checkin) {
                      const due = new Date(req.expected_checkin);
                      isOverdue = due < now;
                      statusLabel = isOverdue
                        ? t("statistics.reqStatus.overdue")
                        : `${t("statistics.reqStatus.returnBy")} ${due.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
                    }
                  }

                  const rStyles = getReqStatusStyles(req.status, isOverdue);

                  return (
                    <div key={req.id} className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="p-2 bg-white border border-gray-100 rounded-lg shrink-0 mt-0.5">
                          <Cpu size={14} className="text-gray-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm text-gray-900 break-words">{assetName}</div>
                          <div className="text-xs text-gray-400 break-words mt-0.5">{projectName}</div>
                        </div>
                      </div>

                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-3 sm:pt-0 border-t border-gray-100 sm:border-t-0 w-full sm:w-auto">
                        <span className="text-xs text-gray-400 whitespace-nowrap">{reqDate}</span>
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase rounded-full break-words max-w-full ${rStyles.bg} ${rStyles.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${rStyles.dot}`} />
                          <span className="break-words">{statusLabel}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      </div>
    </main>
  );
}