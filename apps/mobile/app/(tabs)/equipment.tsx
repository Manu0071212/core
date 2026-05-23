// apps/mobile/app/(tabs)/equipment.tsx
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Image, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Search, ChevronRight, Package, ChevronDown } from "lucide-react-native";
import { equipment as equipmentApi, type EquipmentCatalogItem } from "../../lib/api";

const STATUS_FILTERS = ["All", "Available", "Reserved", "Checked Out", "Maintenance"];

function normalizeStatus(status?: string | null): string {
  if (!status) return "unknown";
  const s = status.toLowerCase();
  if (s === "available")                         return "available";
  if (s === "reserved")                          return "reserved";
  if (s === "checked_out" || s === "checked out") return "checked out";
  if (s === "maintenance" || s === "repair" || s === "retired") return "maintenance";
  return "unknown";
}

const statusBadge: Record<string, { bg: string; dot: string; text: string; label: string }> = {
  available:     { bg: "#f0fdf4", dot: "#22c55e", text: "#16a34a", label: "Available" },
  reserved:      { bg: "#faf5ff", dot: "#a855f7", text: "#9333ea", label: "Reserved" },
  "checked out": { bg: "#fff7ed", dot: "#f97316", text: "#ea580c", label: "Checked Out" },
  maintenance:   { bg: "#fefce8", dot: "#eab308", text: "#ca8a04", label: "Maintenance" },
  unknown:       { bg: "#f3f4f6", dot: "#9ca3af", text: "#6b7280", label: "Unknown" },
};

export default function EquipmentPage() {
  const router = useRouter();
  const [catalog, setCatalog]           = useState<EquipmentCatalogItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [search, setSearch]             = useState("");
  const [activeStatus, setActiveStatus] = useState("All");
  const [activeCategory, setActiveCategory] = useState("All Categories");
  const [catOpen, setCatOpen]           = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await equipmentApi.catalog();
      setCatalog(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => {
    const cats = new Set(
      catalog.map((i) => i.category).filter((cat): cat is string => Boolean(cat)),
    );
    return ["All Categories", ...Array.from(cats).sort()];
  }, [catalog]);

  const filtered = useMemo(() => catalog.filter((item) => {
    const uiStatus = normalizeStatus(item.status);
    const matchesStatus =
      activeStatus === "All" || uiStatus === activeStatus.toLowerCase();
    const matchesCat =
      activeCategory === "All Categories" || item.category === activeCategory;
    const matchesSearch =
      !search || item.name.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesCat && matchesSearch;
  }), [catalog, activeStatus, activeCategory, search]);

  if (loading) return (
    <View className="flex-1 items-center justify-center bg-[#f4f5f7]">
      <ActivityIndicator size="large" color="#3A922A" />
    </View>
  );

  return (
    <View className="flex-1 bg-[#f4f5f7]">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#3A922A" />
        }
      >
        {/* Header */}
        <View className="mb-5">
          <Text className="text-[28px] font-bold text-gray-900 mb-0.5">Equipment</Text>
          <Text className="text-gray-500 text-sm font-medium">{catalog.length} items in inventory</Text>
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 gap-3 shadow-sm">
          <Search size={16} color="#9CA3AF" />
          <TextInput
            placeholder="Search equipment..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            className="flex-1 text-sm text-gray-700"
          />
        </View>

        {/* Category dropdown */}
        <TouchableOpacity
          onPress={() => setCatOpen(!catOpen)}
          className="flex-row items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 shadow-sm"
        >
          <Text className="text-sm font-bold text-gray-700">
            {activeCategory === "All Categories" ? "All Categories" : activeCategory}
          </Text>
          <ChevronDown size={16} color="#9ca3af" style={{ transform: [{ rotate: catOpen ? "180deg" : "0deg" }] }} />
        </TouchableOpacity>

        {catOpen && (
          <View className="bg-white border border-gray-200 rounded-2xl mb-3 shadow-sm overflow-hidden">
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => { setActiveCategory(cat); setCatOpen(false); }}
                className="px-4 py-3 border-b border-gray-50 last:border-0"
              >
                <Text
                  className="text-sm"
                  style={{
                    color: activeCategory === cat ? "#3A922A" : "#374151",
                    fontWeight: activeCategory === cat ? "700" : "400",
                  }}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5" contentContainerStyle={{ gap: 8 }}>
          {STATUS_FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setActiveStatus(f)}
              className="px-4 py-2 rounded-xl border"
              style={{
                backgroundColor: activeStatus === f ? "#3A922A" : "#fff",
                borderColor: activeStatus === f ? "#3A922A" : "#e5e7eb",
              }}
            >
              <Text style={{ color: activeStatus === f ? "#fff" : "#6b7280" }} className="text-sm font-bold whitespace-nowrap">
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
          {filtered.length} results
        </Text>

        {filtered.length === 0 ? (
          <View className="items-center py-20">
            <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-4">
              <Search size={28} color="#9ca3af" />
            </View>
            <Text className="text-gray-400 font-medium text-sm">No equipment found.</Text>
          </View>
        ) : (
          <View className="gap-2.5">
            {filtered.map((item) => {
              const uiStatus = normalizeStatus(item.status);
              const badge = statusBadge[uiStatus] ?? statusBadge["unknown"];
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => router.push(`/(tabs)/item/${item.id}` as any)}
                  className="bg-white border border-gray-100 rounded-2xl p-4 flex-row items-center gap-3 shadow-sm"
                >
                  <View className="w-14 h-14 bg-gray-50 rounded-xl items-center justify-center border border-gray-100 overflow-hidden shrink-0">
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={{ width: 56, height: 56 }} resizeMode="contain" />
                    ) : (
                      <Package size={24} color="#d1d5db" />
                    )}
                  </View>

                  <View className="flex-1 min-w-0 gap-0.5">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text className="font-bold text-gray-900 text-base flex-shrink" numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.category && (
                        <View className="bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-lg">
                          <Text className="text-[10px] font-bold text-gray-500 uppercase">{item.category}</Text>
                        </View>
                      )}
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <View className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                      <Text className="text-xs text-gray-400 font-medium" numberOfLines={1}>
                        {item.location ?? "Unknown location"}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center gap-2 shrink-0">
                    {item.price != null && (
                      <Text className="text-sm font-bold text-gray-900 hidden">€{item.price}</Text>
                    )}
                    <View
                      className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: badge.bg }}
                    >
                      <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: badge.dot }} />
                      <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: badge.text }}>
                        {badge.label === "Checked Out" ? "Out" : badge.label}
                      </Text>
                    </View>
                    <View className="w-8 h-8 bg-gray-50 rounded-lg items-center justify-center">
                      <ChevronRight size={16} color="#d1d5db" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
