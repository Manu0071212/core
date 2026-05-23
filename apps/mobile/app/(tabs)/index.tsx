// apps/mobile/app/(tabs)/index.tsx
import { useEffect, useState, useRef } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Folder, Cpu, Users, Activity, ArrowUpRight, ChevronRight, Search, X,
} from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import {
  projects as projectsApi,
  equipment as equipmentApi,
  users as usersApi,
  type Project,
  type EquipmentCatalogItem,
  type User,
} from "../../lib/api";

export default function HomePage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [projectList, setProjectList] = useState<Project[]>([]);
  const [catalogList, setCatalogList] = useState<EquipmentCatalogItem[]>([]);
  const [allUsers, setAllUsers]       = useState<User[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [search, setSearch]           = useState("");
  const [searchResults, setSearchResults] = useState<{
    projects: Project[]; equipment: EquipmentCatalogItem[]; users: User[];
  } | null>(null);

  const load = async () => {
    try {
      const [p, e, u] = await Promise.all([
        projectsApi.list().catch(() => []),
        equipmentApi.catalog().catch(() => []),
        usersApi.list().catch(() => []),
      ]);
      setProjectList(p);
      setCatalogList(e);
      setAllUsers(u);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

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
  const pendingProjects = projectList.filter((p) => p.status === "pending").length;
  const availableEquip  = catalogList.filter((e) => e.available).length;
  const recentProjects  = [...projectList]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);

  const statusColor: Record<string, string> = {
    active:    "#16a34a",
    pending:   "#ca8a04",
    rejected:  "#ef4444",
    completed: "#2563eb",
  };

  return (
    <ScrollView
      className="flex-1 bg-[#f4f5f7]"
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#3A922A" />}
    >
      <View className="px-5 pt-6">

        <View className="items-center mb-8 px-2">
          <Text className="text-3xl font-extrabold text-gray-900 text-center leading-tight mb-2">
            DETI{" "}
            <Text className="text-indigo-600">Maker Lab</Text>
          </Text>
          <Text className="text-sm text-gray-500 font-medium text-center mb-6">
            Your space for innovation and research
          </Text>

          <View className="relative w-full">
            <View className="flex-row items-center bg-white border border-gray-200 rounded-full px-5 py-3.5 shadow-sm gap-3">
              <Search size={18} color="#9ca3af" />
              <TextInput
                value={search}
                onChangeText={handleSearch}
                placeholder="Search projects, equipment, users..."
                placeholderTextColor="#9ca3af"
                className="flex-1 text-sm text-gray-900 font-medium"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => handleSearch("")}>
                  <X size={16} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>

            {searchResults && search.trim() && (
              <View className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-3xl shadow-xl z-50 overflow-hidden" style={{ zIndex: 100 }}>
                {searchResults.projects.length === 0 &&
                 searchResults.equipment.length === 0 &&
                 searchResults.users.length === 0 ? (
                  <Text className="text-sm text-gray-400 text-center py-6">No results found</Text>
                ) : (
                  <>
                    {searchResults.projects.length > 0 && (
                      <View>
                        <Text className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center py-2">Projects</Text>
                        {searchResults.projects.slice(0, 3).map((p) => (
                          <TouchableOpacity
                            key={p.id}
                            onPress={() => { setSearchResults(null); setSearch(""); router.push(`/(tabs)/project/${p.id}` as any); }}
                            className="flex-row items-center gap-3 px-5 py-2.5"
                          >
                            <Folder size={16} color="#9ca3af" />
                            <View className="flex-1">
                              <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>{p.name}</Text>
                              <Text className="text-xs text-gray-400 capitalize">{p.status}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    {searchResults.equipment.length > 0 && (
                      <View>
                        <Text className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center py-2">Equipment</Text>
                        {searchResults.equipment.slice(0, 3).map((e) => (
                          <TouchableOpacity
                            key={e.id}
                            onPress={() => { setSearchResults(null); setSearch(""); router.push(`/(tabs)/item/${e.id}` as any); }}
                            className="flex-row items-center gap-3 px-5 py-2.5"
                          >
                            <Cpu size={16} color="#9ca3af" />
                            <View className="flex-1">
                              <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>{e.name}</Text>
                              <Text className="text-xs text-gray-400">{e.available ? "Available" : "In Use"}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    {searchResults.users.length > 0 && (
                      <View>
                        <Text className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center py-2">Users</Text>
                        {searchResults.users.slice(0, 3).map((u) => (
                          <TouchableOpacity
                            key={u.id}
                            onPress={() => { setSearchResults(null); setSearch(""); }}
                            className="flex-row items-center gap-3 px-5 py-2.5"
                          >
                            <Users size={16} color="#9ca3af" />
                            <View className="flex-1">
                              <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>{u.name}</Text>
                              <Text className="text-xs text-gray-400 capitalize">{u.role}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
          </View>
        </View>

        <View className="flex-row flex-wrap gap-3 mb-8">
          {[
            { icon: Folder,   iconColor: "#3b82f6", iconBg: "#eff6ff", value: loading ? "..." : String(activeProjects),  label: "Active Projects",     route: "/(tabs)/projects" },
            { icon: Cpu,      iconColor: "#14b8a6", iconBg: "#f0fdfa", value: loading ? "..." : String(availableEquip),  label: "Available Equipment", route: "/(tabs)/equipment" },
            { icon: Users,    iconColor: "#a855f7", iconBg: "#faf5ff", value: loading ? "..." : String(allUsers.length), label: "Lab Members",         route: "/(tabs)/users" },
            { icon: Activity, iconColor: "#eab308", iconBg: "#fefce8", value: loading ? "..." : String(pendingProjects), label: "Pending Projects",    route: "/(tabs)/projects" },
          ].map(({ icon: Icon, iconColor, iconBg, value, label, route }) => (
            <TouchableOpacity
              key={label}
              onPress={() => router.push(route as any)}
              style={{ width: "47.5%" }}
              className="bg-white rounded-[20px] border border-gray-100 shadow-sm p-4"
            >
              <View className="flex-row justify-between items-start mb-3">
                <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: iconBg }}>
                  <Icon size={20} color={iconColor} />
                </View>
                <ArrowUpRight size={14} color="#d1d5db" />
              </View>
              <Text className="text-2xl font-bold text-gray-900 leading-none mb-1">{value}</Text>
              <Text className="text-xs text-gray-500 font-medium leading-tight">{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="mb-4">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-900">Recent Projects</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/projects" as any)}>
              <Text className="text-indigo-600 font-semibold text-sm">View All →</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View className="flex-row flex-wrap gap-3">
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={{ width: "47.5%" }} className="bg-white rounded-[20px] h-52 border border-gray-100" />
              ))}
            </View>
          ) : recentProjects.length === 0 ? (
            <Text className="text-gray-400 text-center py-10 text-sm">No projects yet.</Text>
          ) : (
            <View className="flex-row flex-wrap gap-3">
              {recentProjects.map((proj) => (
                <TouchableOpacity
                  key={proj.id}
                  style={{ width: "47.5%" }}
                  onPress={() => router.push(`/(tabs)/project/${proj.id}` as any)}
                  className="bg-white rounded-[20px] border border-gray-100 shadow-sm overflow-hidden"
                >
                  <View className="h-24 bg-indigo-50 items-center justify-center">
                    <Folder size={34} color="#a9d9aa" strokeWidth={1.5} />
                  </View>
                  <View className="p-3">
                    <Text className="font-bold text-gray-900 text-sm mb-1" numberOfLines={1}>{proj.name}</Text>
                    <Text className="text-xs text-gray-400 leading-relaxed mb-2" numberOfLines={2}>
                      {proj.description || "No description"}
                    </Text>
                    <View className="flex-row items-center gap-1.5">
                      {proj.course && (
                        <Text className="text-[10px] text-gray-400 font-medium" numberOfLines={1} style={{ maxWidth: 60 }}>
                          {proj.course}
                        </Text>
                      )}
                      {proj.course && <View className="w-1 h-1 rounded-full bg-gray-300" />}
                      <Text className="text-[10px] font-bold capitalize" style={{ color: statusColor[proj.status] ?? "#6b7280" }}>
                        {proj.status}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
