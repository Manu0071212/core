// apps/mobile/app/(tabs)/projects.tsx
import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Search, ChevronRight, Plus, BookOpen, Folder } from "lucide-react-native";
import { projects as projectsApi, type Project } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const STATUS_FILTERS = ["All", "Pending", "Active", "Completed", "Rejected"];

function getStatusStyles(status: string) {
  const s = (status ?? "active").toLowerCase();
  if (s === "active")    return { bg: "#f0fdf4", text: "#16a34a", dot: "#22c55e" };
  if (s === "pending")   return { bg: "#fefce8", text: "#ca8a04", dot: "#eab308" };
  if (s === "rejected")  return { bg: "#fef2f2", text: "#dc2626", dot: "#ef4444" };
  if (s === "completed") return { bg: "#eff6ff", text: "#2563eb", dot: "#3b82f6" };
  return { bg: "#f9fafb", text: "#6b7280", dot: "#9ca3af" };
}

export default function ProjectsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [list, setList]           = useState<Project[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState("");
  const [filter, setFilter]       = useState("All");

  const load = useCallback(async () => {
    try {
      const data = await projectsApi.list();
      setList(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = list.filter((p) => {
    const matchesFilter = filter === "All" ||
      (p.status ?? "active").toLowerCase() === filter.toLowerCase();
    const matchesSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.course ?? "").toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <View className="flex-1 bg-[#f4f5f7]">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#3A922A" />
        }
      >
        <View className="flex-row flex-wrap justify-between items-start gap-3 mb-5">
          <View>
            <Text className="text-[28px] font-bold text-gray-900 mb-0.5">Projects</Text>
            <Text className="text-gray-500 text-sm font-medium">{list.length} projects total</Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/projects/my-projects" as any)}
              className="flex-row items-center gap-1.5 bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-sm"
            >
              <BookOpen size={15} color="#374151" />
              <Text className="text-gray-700 font-bold text-sm">Mine</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/projects/new" as any)}
              className="flex-row items-center gap-1.5 bg-indigo-600 px-3 py-2 rounded-xl shadow-sm"
            >
              <Plus size={15} color="white" />
              <Text className="text-white font-bold text-sm">New</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 gap-3 shadow-sm">
          <Search size={16} color="#9CA3AF" />
          <TextInput
            placeholder="Search projects or courses..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            className="flex-1 text-sm text-gray-700"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5" contentContainerStyle={{ gap: 8 }}>
          {STATUS_FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              className="px-4 py-2 rounded-xl border"
              style={{
                backgroundColor: filter === f ? "#3A922A" : "#fff",
                borderColor: filter === f ? "#3A922A" : "#e5e7eb",
              }}
            >
              <Text style={{ color: filter === f ? "#fff" : "#6b7280" }} className="text-sm font-bold">
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
          {filtered.length} results
        </Text>

        {loading ? (
          <View className="gap-3">
            {[1, 2, 3, 4].map((i) => (
              <View key={i} className="h-20 bg-white rounded-2xl border border-gray-100" />
            ))}
          </View>
        ) : filtered.length === 0 ? (
          <View className="items-center py-20">
            <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-4">
              <Search size={28} color="#9ca3af" />
            </View>
            <Text className="text-gray-400 font-medium text-sm">No projects found.</Text>
          </View>
        ) : (
          <View className="gap-2.5">
            {filtered.map((proj) => {
              const styles = getStatusStyles(proj.status);
              return (
                <TouchableOpacity
                  key={proj.id}
                  onPress={() => router.push(`/(tabs)/project/${proj.id}` as any)}
                  className="bg-white border border-gray-100 rounded-2xl px-4 py-3.5 shadow-sm flex-row items-center justify-between gap-3"
                >
                  <View className="flex-1 gap-1.5 min-w-0">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text className="font-bold text-gray-900 text-base flex-shrink" numberOfLines={1}>
                        {proj.name}
                      </Text>
                      {proj.course && (
                        <View className="bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-lg">
                          <Text className="text-[10px] font-bold text-gray-500 uppercase">{proj.course}</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs text-gray-400 font-medium" numberOfLines={1}>
                      {proj.description ?? "No description provided."}
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-2 shrink-0">
                    <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: styles.bg }}>
                      <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: styles.dot }} />
                      <Text className="text-[10px] font-bold uppercase" style={{ color: styles.text }}>
                        {proj.status ?? "active"}
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
