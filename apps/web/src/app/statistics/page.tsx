"use client";

// apps/web/src/app/statistics/page.tsx
import { useEffect, useState } from "react";
import { projects as projectsApi, equipment as equipmentApi, users as usersApi, requisitions as requisitionsApi } from "@/lib/api";
import type { Project, EquipmentCatalogItem, User, Requisition } from "@/lib/api";
import { FolderOpen, Cpu, Users, TrendingUp, CheckCircle2, BarChart2 } from "lucide-react";
import Header from "@/app/components/header";
import { useTranslation } from "react-i18next";

function StatCard({ label, value, sub, icon, color }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <div className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-1">{value}</div>
      <div className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
      {sub && <div className="text-[10px] sm:text-xs text-gray-400 mt-2 font-medium">{sub}</div>}
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 sm:gap-3 group">
      <div className="w-20 sm:w-28 text-xs sm:text-sm text-gray-600 font-medium truncate shrink-0 transition-colors group-hover:text-gray-900">
        {label}
      </div>
      <div className="flex-1 bg-gray-200 rounded-full h-2 sm:h-2.5 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ease-out ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-6 sm:w-8 text-[10px] sm:text-xs font-bold text-gray-500 text-right shrink-0">{value}</div>
    </div>
  );
}

export default function StatisticsPage() {
  const { t } = useTranslation();
  const [projects, setProjects]       = useState<Project[]>([]);
  const [equipment, setEquipment]     = useState<EquipmentCatalogItem[]>([]);
  const [users, setUsers]             = useState<User[]>([]);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    Promise.allSettled([
      projectsApi.list(),
      equipmentApi.catalog(),
      usersApi.list(),
      requisitionsApi.list(),
    ]).then(([p, e, u, r]) => {
      if (p.status === "fulfilled") setProjects(p.value);
      if (e.status === "fulfilled") setEquipment(e.value);
      if (u.status === "fulfilled") setUsers(u.value);
      if (r.status === "fulfilled") setRequisitions(r.value);
    }).finally(() => setLoading(false));
  }, []);

  const activeProjects    = projects.filter((p) => p.status === "active").length;
  const pendingProjects   = projects.filter((p) => p.status === "pending").length;
  const completedProjects = projects.filter((p) => p.status === "completed").length;
  const rejectedProjects  = projects.filter((p) => p.status === "rejected").length;

  const availableEquipment = equipment.filter((e) => e.available).length;
  const checkedOut         = equipment.filter((e) => e.status === "checked_out").length;

  const students     = users.filter((u) => u.role === "student").length;
  const professors   = users.filter((u) => u.role === "professor").length;
  const technicians  = users.filter((u) => u.role === "lab_technician").length;

  const pendingReqs    = requisitions.filter((r) => r.status === "pending").length;
  const reservedReqs   = requisitions.filter((r) => r.status === "reserved").length;
  const checkedOutReqs = requisitions.filter((r) => r.status === "checked_out").length;
  const returnedReqs   = requisitions.filter((r) => r.status === "returned").length;
  const rejectedReqs   = requisitions.filter((r) => r.status === "rejected").length;

  const courseCounts: Record<string, number> = {};
  projects.forEach((p) => { if (p.course) courseCounts[p.course] = (courseCounts[p.course] ?? 0) + 1; });
  const topCourses = Object.entries(courseCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCourse  = topCourses[0]?.[1] ?? 1;

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { label: d.toLocaleDateString("pt-PT", { month: "short" }), year: d.getFullYear(), month: d.getMonth() };
  });
  const projectsPerMonth = months.map(({ label, year, month }) => ({
    label,
    count: projects.filter((p) => {
      const d = new Date(p.created_at);
      return d.getFullYear() === year && d.getMonth() === month;
    }).length,
  }));
  const maxMonth = Math.max(...projectsPerMonth.map((m) => m.count), 1);

  if (loading) return (
    <div className="flex-1 p-4 sm:p-8 bg-[#f4f5f7] min-h-screen font-sans text-gray-900 flex items-center justify-center">
        <div className="text-gray-400 font-medium animate-pulse flex flex-col items-center gap-3 -mt-20">
            <BarChart2 size={32} className="animate-bounce text-blue-400" />
            {t("statistics.loading")}
        </div>
    </div>
  );

  return (
    <main className="flex-1 p-4 sm:p-8 bg-[#f4f5f7] min-h-screen font-sans text-gray-900 overflow-x-hidden">
      <Header/>
      
      <div className="mb-6 sm:mb-8 mt-2 sm:mt-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-1 sm:mb-2">{t("statistics.title")}</h1>
        <p className="text-sm sm:text-base text-gray-500 font-medium">{t("statistics.subtitle")}</p>
      </div>

      <div className="flex flex-col gap-6 sm:gap-8">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <StatCard label={t("statistics.totalProjects")}  value={projects.length}     sub={`${activeProjects} ${t("statistics.activeProjects")}`}      icon={<FolderOpen size={24} />} color="bg-blue-100 text-blue-600" />
          <StatCard label={t("statistics.equipmentItems")} value={equipment.length}    sub={`${availableEquipment} ${t("statistics.itemsAvailable")}`}  icon={<Cpu size={24} />}        color="bg-teal-100 text-teal-600" />
          <StatCard label={t("statistics.labMembers")}     value={users.length}        sub={`${students} ${t("statistics.registeredStudents")}`}        icon={<Users size={24} />}      color="bg-purple-100 text-purple-600" />
          <StatCard label={t("statistics.requisitions")}    value={requisitions.length} sub={`${pendingReqs} ${t("statistics.pendingRequests")}`}        icon={<TrendingUp size={24} />} color="bg-amber-100 text-amber-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-5 sm:mb-6">
              <div className="p-2 bg-gray-50 rounded-lg"><FolderOpen size={18} className="text-gray-500" /></div>
              <h2 className="font-bold text-base sm:text-lg text-gray-800">{t("statistics.projectStatus")}</h2>
            </div>
            <div className="flex flex-col gap-3 sm:gap-4">
              <Bar label={t("statistics.status.active")}    value={activeProjects}    max={projects.length} color="bg-green-500" />
              <Bar label={t("statistics.status.pending")}   value={pendingProjects}   max={projects.length} color="bg-yellow-500" />
              <Bar label={t("statistics.status.completed")} value={completedProjects} max={projects.length} color="bg-blue-500" />
              <Bar label={t("statistics.status.rejected")}  value={rejectedProjects}  max={projects.length} color="bg-red-500" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-5 sm:mb-6">
              <div className="p-2 bg-gray-50 rounded-lg"><Cpu size={18} className="text-gray-500" /></div>
              <h2 className="font-bold text-base sm:text-lg text-gray-800">{t("statistics.equipmentStatus")}</h2>
            </div>
            <div className="flex flex-col gap-3 sm:gap-4">
              <Bar label={t("statistics.status.available")}   value={availableEquipment} max={equipment.length} color="bg-teal-500" />
              <Bar label={t("statistics.status.checkedOut")} value={checkedOut}         max={equipment.length} color="bg-orange-500" />
            </div>
            <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs sm:text-sm mb-2 sm:mb-3">
                <span className="text-gray-500 font-medium">{t("statistics.utilisationRate")}</span>
                <span className="font-bold text-gray-800">
                  {equipment.length > 0 ? Math.round((checkedOut / equipment.length) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 sm:h-3">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-500 transition-all duration-1000"
                  style={{ width: `${equipment.length > 0 ? (availableEquipment / equipment.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-5 sm:mb-6">
              <div className="p-2 bg-gray-50 rounded-lg"><Users size={18} className="text-gray-500" /></div>
              <h2 className="font-bold text-base sm:text-lg text-gray-800">{t("statistics.userRoles")}</h2>
            </div>
            <div className="flex flex-col gap-3 sm:gap-4">
              <Bar label={t("statistics.roles.students")}    value={students}    max={users.length} color="bg-purple-500" />
              <Bar label={t("statistics.roles.professors")}  value={professors}  max={users.length} color="bg-blue-500" />
              <Bar label={t("statistics.roles.technicians")} value={technicians} max={users.length} color="bg-gray-400" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-6 sm:mb-8">
              <div className="p-2 bg-gray-50 rounded-lg"><BarChart2 size={18} className="text-gray-500" /></div>
              <h2 className="font-bold text-base sm:text-lg text-gray-800">{t("statistics.projectsCreated")}</h2>
            </div>
            <div className="flex items-end gap-2 sm:gap-4 h-32 sm:h-36 mt-4">
              {projectsPerMonth.map(({ label, count }) => (
                <div key={label} className="flex-1 flex flex-col items-center gap-1 sm:gap-2 group">
                  <div className="text-xs sm:text-sm font-bold text-gray-400 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">{count > 0 ? count : ""}</div>
                  <div
                    className="w-full max-w-[32px] sm:max-w-[40px] bg-blue-100 rounded-t-lg transition-all duration-700 ease-out relative overflow-hidden"
                    style={{ height: `${(count / maxMonth) * 100}px`, minHeight: count > 0 ? "8px" : "4px" }}
                  >
                    <div className="absolute bottom-0 w-full h-full bg-blue-500 opacity-90 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-5 sm:mb-6">
              <div className="p-2 bg-gray-50 rounded-lg"><TrendingUp size={18} className="text-gray-500" /></div>
              <h2 className="font-bold text-base sm:text-lg text-gray-800">{t("statistics.topCourses")}</h2>
            </div>
            {topCourses.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 italic text-sm sm:text-base">{t("statistics.noCourseData")}</div>
            ) : (
              <div className="flex flex-col gap-4 sm:gap-5">
                {topCourses.map(([course, count]) => (
                  <Bar key={course} label={course} value={count} max={maxCourse} color="bg-indigo-500" />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm mb-8">
          <div className="flex items-center gap-3 mb-5 sm:mb-6">
            <div className="p-2 bg-gray-50 rounded-lg"><CheckCircle2 size={18} className="text-gray-500" /></div>
            <h2 className="font-bold text-base sm:text-lg text-gray-800">{t("statistics.reqSummary")}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-6">
            {[
              { label: t("statistics.reqStatus.pending"),     value: pendingReqs,    color: "bg-yellow-50 text-yellow-600 border border-yellow-100" },
              { label: t("statistics.reqStatus.reserved"),    value: reservedReqs,   color: "bg-purple-50 text-purple-600 border border-purple-100" },
              { label: t("statistics.reqStatus.checkedOut"), value: checkedOutReqs, color: "bg-orange-50 text-orange-600 border border-orange-100" },
              { label: t("statistics.reqStatus.returned"),    value: returnedReqs,   color: "bg-green-50 text-green-600 border border-green-100" },
              { label: t("statistics.reqStatus.rejected"),    value: rejectedReqs,   color: "bg-red-50 text-red-600 border border-red-100" },
            ].map(({ label, value, color }, idx) => (
              <div key={idx} className={`rounded-2xl p-4 sm:p-6 text-center shadow-sm hover:-translate-y-1 hover:shadow-md transition-all cursor-default flex flex-col justify-center ${color}`}>
                <div className="text-3xl sm:text-4xl font-black mb-1 sm:mb-2">{value}</div>
                <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider opacity-80">{label}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}