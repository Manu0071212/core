"use client";

// apps/web/src/app/equipment/[equipmentId]/page.tsx
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Image as ImageIcon, History,
  DollarSign, Hash, MapPin, FolderOpen,
  LogOut, LogIn,
} from "lucide-react";
import { equipment as equipmentApi, requisitions as requisitionsApi, projects as projectsApi, users as usersApi } from "@/lib/api";
import type { Requisition } from "@/lib/api";
import Header from "@/app/components/header";
import { useTranslation } from "react-i18next";

type EquipmentDetail = {
  id: number;
  name?: string;
  asset_tag?: string;
  category?: string;
  price?: string | number;
  location?: string;
  status: string;
  image?: string;
};

type ProjectInfo = { id: number; name: string; status: string; course?: string };

interface HistoryEvent {
  type: "checkout" | "return";
  date: string;
  projectName: string;
  userName: string;
  req_id: number;
}

export default function EquipmentDetailsPage() {
  const { t } = useTranslation();
  const params = useParams<{ equipmentId: string }>();
  const equipmentId = Number(params?.equipmentId);

  const [item, setItem]           = useState<EquipmentDetail | null>(null);
  const [projects, setProjects]   = useState<ProjectInfo[]>([]);
  const [history, setHistory]     = useState<HistoryEvent[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!equipmentId) return;
    (async () => {
      try {
        const asset = await equipmentApi.get(equipmentId);
        setItem(asset as EquipmentDetail);

        const allReqs = await requisitionsApi.list() as Requisition[];
        const assetReqs = allReqs.filter(
          (r) => r.snipeit_asset_id === equipmentId &&
                 ["reserved", "checked_out", "returned"].includes(r.status)
        );

        const projectIds = [...new Set(assetReqs.map((r) => r.project_id))];
        const userIds    = [...new Set(assetReqs.map((r) => r.requested_by))];

        const [projResults, userResults] = await Promise.all([
          Promise.allSettled(projectIds.map((id) => projectsApi.get(id))),
          Promise.allSettled(userIds.map((id) => usersApi.get(id))),
        ]);

        const pMap: Record<number, ProjectInfo> = {};
        projResults.forEach((r, i) => {
          if (r.status === "fulfilled") {
            pMap[projectIds[i]] = {
              id: r.value.id,
              name: r.value.name,
              status: r.value.status,
              course: r.value.course,
            };
          }
        });

        const uMap: Record<number, string> = {};
        userResults.forEach((r, i) => {
          if (r.status === "fulfilled") uMap[userIds[i]] = r.value.name;
        });

        setProjects(Object.values(pMap));

        const evts: HistoryEvent[] = [];
        for (const req of assetReqs) {
          const projectName = pMap[req.project_id]?.name ?? `Project #${req.project_id}`;
          const userName    = uMap[req.requested_by]     ?? `User #${req.requested_by}`;
          if (req.checked_out_at) {
            evts.push({ type: "checkout", date: req.checked_out_at, projectName, userName, req_id: req.id });
          }
          if (req.returned_at) {
            evts.push({ type: "return", date: req.returned_at, projectName, userName, req_id: req.id });
          }
        }
        evts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setHistory(evts);

      } catch (e: any) {
        setError(e?.message || "Error loading equipment");
      } finally {
        setLoading(false);
      }
    })();
  }, [equipmentId]);

  useEffect(() => {
    requisitionsApi.syncSnipeit().catch(console.error);
  }, []);

  if (loading) return <main className="p-8 text-gray-400 animate-pulse"><Header />{t("equipmentPage.loading")}</main>;
  if (error)   return <main className="p-8"><Header /><div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">{t("equipmentPage.error")}{error}</div></main>;
  if (!item)   return <main className="p-8"><Header /><div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-yellow-700 text-sm">{t("equipmentPage.notFound")}</div></main>;

  const name      = item.name || `Equipment #${item.id}`;
  const price     = item.price != null && item.price !== "" ? `${item.price}€` : "—";
  const reference = item.asset_tag || `REF-${String(item.id).padStart(3, "0")}`;

  const statusColor: Record<string, string> = {
    active:      "bg-green-50 text-green-600",
    pending:     "bg-yellow-50 text-yellow-600",
    rejected:    "bg-red-50 text-red-500",
    completed:   "bg-blue-50 text-blue-600",
    reserved:    "bg-purple-50 text-purple-600",
    checked_out: "bg-orange-50 text-orange-600",
    returned:    "bg-gray-50 text-gray-500",
  };

  return (
    <main className="flex-1 bg-[#f4f5f7] p-8 min-h-screen font-sans text-gray-900">
      <Header />

      <Link href="/equipment" className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors mb-8 text-sm font-medium">
        <ArrowLeft size={18} /> {t("equipmentPage.back")}
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col gap-6">
          <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm bg-white">
            <div className="h-64 bg-gray-50 flex items-center justify-center border-b border-gray-100 overflow-hidden">
              {item.image ? (
                <img src={item.image.startsWith("http") ? item.image : `${process.env.NEXT_PUBLIC_SNIPEIT_URL ?? ""}/uploads/assets/${item.image}`}
                  alt={name} className="h-full w-full object-contain" />
              ) : (
                <ImageIcon size={80} className="text-gray-200" />
              )}
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold">{name}</h1>
                  <span className="inline-block mt-2 px-3 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase rounded-full">
                    {item.category ?? t("equipmentPage.uncategorized")}
                  </span>
                </div>
                <span className="px-3 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase rounded-full">
                  {item.status}
                </span>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-2xl p-6 shadow-sm bg-white">
            <h2 className="text-lg font-bold mb-6">{t("equipmentPage.details")}</h2>
            <div className="space-y-4">
              <DetailRow icon={<DollarSign size={20} />} label={t("equipmentPage.price")}     value={price} />
              <DetailRow icon={<Hash size={20} />}       label={t("equipmentPage.reference")} value={reference} />
              <DetailRow icon={<MapPin size={20} />}     label={t("equipmentPage.location")}  value={item.location ?? t("equipmentPage.na")} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">

          <div className="border border-gray-200 rounded-2xl p-6 shadow-sm bg-white">
            <div className="flex items-center gap-2 mb-6">
              <FolderOpen size={20} className="text-gray-400" />
              <h2 className="text-lg font-bold">{t("equipmentPage.projects", { count: projects.length })}</h2>
            </div>
            {projects.length === 0 ? (
              <p className="text-sm text-gray-400">{t("equipmentPage.noProjects")}</p>
            ) : (
              projects.map((proj) => (
                <Link key={proj.id} href={`/projects/${proj.id}`}>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors cursor-pointer mb-2">
                    <div>
                      <div className="font-semibold text-sm text-gray-800">{proj.name}</div>
                      {proj.course && <div className="text-xs text-gray-400 mt-0.5">{proj.course}</div>}
                    </div>
                    <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full ${statusColor[proj.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {proj.status}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="border border-gray-200 rounded-2xl p-6 shadow-sm bg-white">
            <div className="flex items-center gap-2 mb-6">
              <History size={20} className="text-gray-400" />
              <h2 className="text-lg font-bold">{t("equipmentPage.fullHistory", { count: history.length })}</h2>
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-gray-400">{t("equipmentPage.noHistory")}</p>
            ) : (
              history.map((evt) => {
                const isCheckout = evt.type === "checkout";
                return (
                  <div key={`${evt.type}-${evt.req_id}`}
                    className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          isCheckout ? "bg-orange-50 text-orange-500" : "bg-green-50 text-green-600"
                        }`}>
                          {isCheckout ? t("equipmentPage.checkout") : t("equipmentPage.return")}
                        </span>
                        <span className="text-sm font-semibold text-gray-800 truncate">{evt.projectName}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{evt.userName}</div>
                    </div>
                    <div className="text-xs text-gray-400 shrink-0 text-right">
                      {new Date(evt.date).toLocaleDateString("en-GB", {
                        day: "2-digit", month: "short", year: "numeric"
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-gray-500">
      <div className="flex items-center gap-3">
        <span className="text-gray-400">{icon}</span>
        <span className="font-medium">{label}</span>
      </div>
      <span className="text-gray-900 font-semibold">{value}</span>
    </div>
  );
}