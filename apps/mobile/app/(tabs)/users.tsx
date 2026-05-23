// apps/mobile/app/(tabs)/users.tsx
import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { Search, Mail } from "lucide-react-native";
import { users as usersApi, type User } from "../../lib/api";

const FILTERS = ["All", "Students", "Professors", "Technician"];

export default function UsersPage() {
  const [list, setList]             = useState<User[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const load = useCallback(async () => {
    try { setList(await usersApi.list()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = list.filter((u) => {
    const matchesFilter =
      activeFilter === "All" ||
      (activeFilter === "Students"   && u.role === "student") ||
      (activeFilter === "Professors" && u.role === "professor") ||
      (activeFilter === "Technician" && u.role === "lab_technician");
    const matchesSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const roleConfig: Record<string, { bg: string; text: string; label: string }> = {
    student:        { bg: "#ebf5ea", text: "#3A922A", label: "Student" },
    professor:      { bg: "#faf5ff", text: "#9333ea", label: "Professor" },
    lab_technician: { bg: "#f0fdf4", text: "#16a34a", label: "Tech" },
  };

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
        <View className="mb-5">
          <Text className="text-[28px] font-bold text-gray-900 mb-0.5">Users</Text>
          <Text className="text-gray-500 text-sm font-medium">{list.length} participants</Text>
        </View>

        <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 gap-3 shadow-sm">
          <Search size={16} color="#9CA3AF" />
          <TextInput
            placeholder="Search by name, email or NMEC..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            className="flex-1 text-sm text-gray-700"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5" contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setActiveFilter(f)}
              className="px-4 py-2 rounded-xl border"
              style={{
                backgroundColor: activeFilter === f ? "#3A922A" : "#fff",
                borderColor: activeFilter === f ? "#3A922A" : "#e5e7eb",
              }}
            >
              <Text style={{ color: activeFilter === f ? "#fff" : "#6b7280" }} className="text-sm font-bold">
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {!loading && (
          <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
            {filtered.length} results
          </Text>
        )}

        {filtered.length === 0 ? (
          <View className="items-center py-20">
            <View className="w-16 h-16 bg-white rounded-full border border-gray-100 items-center justify-center mb-4 shadow-sm">
              <Search size={28} color="#d1d5db" />
            </View>
            <Text className="text-gray-400 font-medium text-sm">No users found.</Text>
          </View>
        ) : (
          <View className="gap-3">
            {filtered.map((u) => {
              const rc = roleConfig[u.role] ?? { bg: "#f3f4f6", text: "#6b7280", label: u.role };
              return (
                <View
                  key={u.id}
                  className="bg-white border border-gray-100 rounded-2xl p-4 flex-row items-start gap-3 shadow-sm"
                >
                  <View
                    className="w-12 h-12 rounded-xl items-center justify-center border border-gray-100 shrink-0"
                    style={{ backgroundColor: "#f9fafb" }}
                  >
                    <Text className="text-gray-500 font-bold text-lg">
                      {u.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View className="flex-1 min-w-0 gap-1">
                    <View className="flex-row justify-between items-start gap-2">
                      <Text className="font-bold text-gray-900 text-base flex-1" numberOfLines={1}>
                        {u.name}
                      </Text>
                      <View
                        className="px-2.5 py-0.5 rounded-lg shrink-0"
                        style={{ backgroundColor: rc.bg }}
                      >
                        <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: rc.text }}>
                          {rc.label}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-center gap-1.5">
                      <Mail size={12} color="#d1d5db" />
                      <Text className="text-xs text-gray-400 font-medium flex-1" numberOfLines={1}>
                        {u.email}
                      </Text>
                    </View>

                    {u.role === "student" && u.nmec && (
                      <Text className="text-[11px] text-gray-400 font-bold">NMEC: {u.nmec}</Text>
                    )}

                    {u.course && (
                      <View className="flex-row mt-0.5">
                        <View className="bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg">
                          <Text className="text-[10px] font-bold text-gray-400 uppercase">{u.course}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
