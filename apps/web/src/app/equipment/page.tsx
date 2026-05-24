"use client";

// apps/web/src/app/equipment/page.tsx
import { useEffect, useMemo, useState } from "react";
import { Search, ChevronDown, ChevronRight, Package } from "lucide-react";
import Link from "next/link";
import Header from "@/app/components/header";
import { equipment as equipmentApi, type EquipmentCatalogItem } from "@/lib/api";
import { useTranslation } from "react-i18next";

const statusFilters = ["All", "Available", "Reserved", "Checked Out", "Maintenance"];

function normalizeStatus(status?: string | null): string {
  if (!status) return "unknown";
  const s = status.toLowerCase();
  if (s === "available") return "available";
  if (s === "reserved") return "reserved";
  if (s === "checked_out" || s === "checked out") return "checked out";
  if (s === "maintenance" || s === "repair" || s === "retired") return "maintenance";
  return "unknown";
}

const statusBadge: Record<string, { bg: string; dot: string; labelKey: string }> = {
  available:     { bg: "bg-green-50 text-green-600",    dot: "bg-green-500",  labelKey: "available" },
  reserved:      { bg: "bg-purple-50 text-purple-600",  dot: "bg-purple-500", labelKey: "reserved" },
  "checked out": { bg: "bg-orange-50 text-orange-600", dot: "bg-orange-500", labelKey: "checkedOut" },
  maintenance:   { bg: "bg-yellow-50 text-yellow-600", dot: "bg-yellow-500", labelKey: "maintenance" },
  unknown:       { bg: "bg-gray-100 text-gray-500",    dot: "bg-gray-400",   labelKey: "unknown" },
};

export default function EquipmentPage() {
  const { t } = useTranslation();
  const [activeStatus, setActiveStatus] = useState("All");
  const [activeCategory, setActiveCategory] = useState("All Categories");
  const [isCatOpen, setIsCatOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [equipment, setEquipment] = useState<EquipmentCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await equipmentApi.catalog();
        const list = Array.isArray(data) ? data : (data as any)?.rows || [];
        setEquipment(
          list
            .filter((item: any) => item != null && item.id != null)
            .map((item: any): EquipmentCatalogItem => ({
              id: Number(item.id),
              model_id: item.model_id,
              model_name: item.model_name,
              name: item.name ?? t("equipmentPage.unnamedEquipment"),
              asset_tag: item.asset_tag,
              serial: item.serial,
              category: item.category ?? t("equipmentPage.uncategorized"),
              supplier: item.supplier,
              price: item.price ?? undefined,
              status: item.status ?? "unknown",
              snipeit_status: item.snipeit_status,
              status_type: item.status_type,
              location: item.location ?? t("equipmentPage.unknownRoom"),
              image: item.image ?? undefined,
              assigned_to: item.assigned_to,
              available: item.available ?? false,
              expected_checkin: item.expected_checkin,
            }))
        );
      } catch (e) {
        console.error("Error loading equipment", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const dynamicCategories = useMemo(() => {
    const cats = new Set(equipment.map(item => item.category).filter((c): c is string => Boolean(c)));
    return ["All Categories", ...Array.from(cats).sort()];
  }, [equipment]);

  const filteredEquipment = useMemo(() => {
    return equipment.filter((item) => {
      const uiStatus = normalizeStatus(item.status);
      const matchesStatus =
        activeStatus === "All" || uiStatus === activeStatus.toLowerCase();
      const matchesCat =
        activeCategory === "All Categories" || item.category === activeCategory;
      const matchesSearch =
        !search || item.name.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesCat && matchesSearch;
    });
  }, [equipment, activeStatus, activeCategory, search]);

  return (
    <main className="flex-1 px-3 py-4 sm:p-8 bg-[#f4f5f7] min-h-screen font-sans text-gray-900">
      <Header />

      <div className="mb-6">
        <h1 className="text-2xl sm:text-[32px] font-bold text-gray-900 mb-1 leading-tight">
          {t("equipmentPage.title")}
        </h1>
        <p className="text-gray-500 font-medium">
          {t("equipmentPage.itemsInInventory", { count: equipment.length })}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 mb-6 w-full">
        
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-12 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none text-sm text-gray-600 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
            placeholder={t("equipmentPage.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 lg:w-auto w-full">
          <div className="relative w-full sm:w-auto shrink-0 z-10">
            <button
              onClick={() => setIsCatOpen(!isCatOpen)}
              className="flex items-center justify-between gap-2 w-full lg:w-48 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <span className="truncate">
                {activeCategory === "All Categories" ? t("equipmentPage.allCategories") : activeCategory}
              </span>
              <ChevronDown size={16} className={`transition-transform shrink-0 text-gray-400 ${isCatOpen ? "rotate-180" : ""}`} />
            </button>

            {isCatOpen && (
              <div className="absolute top-full left-0 mt-2 w-full lg:w-56 bg-white border border-gray-200 rounded-2xl shadow-xl py-1 max-h-60 overflow-y-auto scrollbar-hide">
                {dynamicCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setActiveCategory(cat); setIsCatOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                      activeCategory === cat ? "text-indigo-600 font-bold" : "text-gray-600"
                    }`}
                  >
                    {cat === "All Categories" ? t("equipmentPage.allCategories") : cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 w-full">
            {statusFilters.map((opt) => (
              <button
                key={opt}
                onClick={() => setActiveStatus(opt)}
                className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap border transition-all shrink-0 ${
                  activeStatus === opt
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {opt === "All" ? t("equipmentPage.all") : 
                 opt === "Available" ? t("equipmentPage.available", "Available") : 
                 opt === "Reserved" ? t("equipmentPage.reserved", "Reserved") : 
                 opt === "Checked Out" ? t("equipmentPage.checkedOut", "Checked Out") : 
                 t("equipmentPage.maintenance", "Maintenance")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="px-1 mb-3">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            {t("equipmentPage.results", { count: filteredEquipment.length })}
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="border border-transparent rounded-2xl p-5 h-24 animate-pulse bg-white" />
            ))}
          </div>
        ) : filteredEquipment.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="bg-[#eceef1] p-4 rounded-full mb-4">
              <Search size={32} className="text-gray-400" />
            </div>
            <p className="text-gray-400 font-medium">
              {t("equipmentPage.noResults", "No equipment found.")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredEquipment.map((item) => {
              const uiStatus = normalizeStatus(item.status);
              const badge = statusBadge[uiStatus] ?? statusBadge["unknown"];

              return (
                <Link
                  key={item.id}
                  href={`/equipment/${item.id}`}
                  className="group flex items-start sm:items-center justify-between bg-white border border-transparent hover:border-indigo-100 rounded-2xl p-4 sm:px-5 sm:py-4 transition-all shadow-sm hover:shadow-md"
                >
                  <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-50 flex items-center justify-center rounded-xl border border-gray-100 overflow-hidden shrink-0 group-hover:bg-white transition-colors mt-0.5 sm:mt-0">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={24} className="text-gray-300" />
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-1.5 sm:gap-0.5 min-w-0 flex-1">
                      <div className="flex items-start sm:items-center gap-2 min-w-0">
                        <h3 className="font-bold text-gray-900 text-base break-words min-w-0">
                          {item.name}
                        </h3>
                        {item.category && (
                          <span className="hidden sm:inline-block px-2.5 py-0.5 bg-gray-100 border border-gray-200 text-gray-500 text-[10px] font-bold rounded-lg uppercase shrink-0 mt-1 sm:mt-0">
                            {item.category}
                          </span>
                        )}
                      </div>

                      <div className="flex sm:hidden">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${badge.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          <span>{t(`equipmentPage.${badge.labelKey}`)}</span>
                        </span>
                      </div>

                      {item.category && (
                        <div className="flex sm:hidden min-w-0">
                          <span className="text-[11px] font-bold text-gray-500 uppercase break-words min-w-0">
                            {item.category}
                          </span>
                        </div>
                      )}

                      <div className="text-sm text-gray-400 font-medium flex items-start gap-1.5 min-w-0 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-200 shrink-0 mt-1.5" />
                        <span className="break-words min-w-0">{item.location ?? t("equipmentPage.unknownLocation")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-2 h-full self-center">
                    {item.price != null && (
                      <div className="hidden sm:block text-sm font-bold text-gray-900 mr-2">€{item.price}</div>
                    )}
                    
                    <span className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${badge.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      <span className="inline-block">{t(`equipmentPage.${badge.labelKey}`)}</span>
                    </span>
                    
                    <div className="flex p-2 bg-gray-50 rounded-lg group-hover:bg-indigo-50 transition-colors">
                      <ChevronRight size={18} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}