// apps/mobile/app/(tabs)/project/my-projects.tsx
import React, { useEffect, useState, useCallback } from "react";
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  RefreshControl,
  ActivityIndicator
} from "react-native";
import { useRouter } from "expo-router";
import { Search, Plus, Cpu, ChevronLeft } from "lucide-react-native";

import { projects as projectsApi, requisitions as reqApi, equipment as equipmentApi } from "../../../lib/api";
import type { Project, Requisition } from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";
import Header from "../../../components/Header";

export default function MyProjectsPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [reqsByProject, setReqsByProject] = useState<Record<number, Requisition[]>>({});
  const [assetNames, setAssetNames] = useState<Record<number, string>>({});
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = useCallback(async () => {
    if (!user) return;
    
    try {
      const all = await projectsApi.list();
      const mine = all.filter((p) => p.created_by === user.id);
      setMyProjects(mine);

      // Requisições por projeto
      const reqs: Record<number, Requisition[]> = {};
      await Promise.all(
        mine.map(async (p) => {
          try {
            reqs[p.id] = await reqApi.listByProject(p.id);
          } catch {
            reqs[p.id] = [];
          }
        })
      );
      setReqsByProject(reqs);

      // Nomes dos assets
      const assetIds = [
        ...new Set(
          Object.values(reqs)
            .flat()
            .map((r) => r.snipeit_asset_id)
            .filter((id): id is number => id != null)
        ),
      ];
      
      const names: Record<number, string> = {};
      await Promise.allSettled(
        assetIds.map(async (id) => {
          try {
            const a = await equipmentApi.get(id);
            names[id] = a.name ?? `Asset #${id}`;
          } catch {
            names[id] = `Asset #${id}`;
          }
        })
      );
      setAssetNames(names);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = myProjects.filter((proj) => {
    const status = proj.status || "active";
    const matchesFilter =
      activeFilter === "All" ||
      (activeFilter === "Active" && ["active", "pending"].includes(status.toLowerCase())) ||
      (activeFilter === "Completed" && status.toLowerCase() === "completed");
      
    const matchesSearch = !searchQuery || proj.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <View className="flex-1 bg-[#f4f5f7]">
      <Header />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        {/* Header Section com botão "Back" subtil para mobile */}
        <View className="flex-row items-start mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 mt-1 p-1">
            <ChevronLeft size={24} color="#9CA3AF" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-3xl font-bold text-gray-900 mb-1">My Projects</Text>
            <Text className="text-gray-400 font-medium">Projects you have submitted</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.push("/modal" as any)}
          className="flex-row items-center justify-center gap-2 px-4 py-3.5 bg-gray-900 rounded-xl shadow-sm mb-6 active:bg-gray-800"
        >
          <Plus size={18} color="white" />
          <Text className="text-white font-bold text-sm">New Project</Text>
        </TouchableOpacity>

        {/* Search Input */}
        <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-4 py-3 mb-4">
          <Search size={18} color="#9CA3AF" />
          <TextInput
            className="flex-1 ml-3 text-sm text-gray-800"
            placeholder="Search by name..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Status Filters */}
        <View className="flex-row items-center bg-white border border-gray-200 rounded-full p-1 shadow-sm mb-8 self-start">
          {["All", "Active", "Completed"].map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => setActiveFilter(opt)}
              className={`px-5 py-2 rounded-full ${activeFilter === opt ? "bg-gray-100 border border-gray-200" : ""}`}
            >
              <Text className={`text-sm font-bold ${activeFilter === opt ? "text-gray-900" : "text-gray-400"}`}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        {loading ? (
          <View className="flex-col gap-6">
            {[1, 2, 3].map((i) => (
              <View key={i} className="h-48 bg-gray-200/50 border border-gray-200 rounded-3xl animate-pulse" />
            ))}
          </View>
        ) : filtered.length === 0 ? (
          <View className="py-16 items-center">
            <Text className="text-gray-400 font-medium">No projects found.</Text>
          </View>
        ) : (
          <View className="flex-col gap-6">
            {filtered.map((proj) => (
              <ProjectCard
                key={proj.id}
                project={proj}
                requisitions={reqsByProject[proj.id] ?? []}
                assetNames={assetNames}
                onPress={() => router.push(`/(tabs)/projects/${proj.id}` as any)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// --- COMPONENTE PROJECT CARD ---

function ProjectCard({
  project,
  requisitions,
  assetNames,
  onPress
}: {
  project: Project;
  requisitions: Requisition[];
  assetNames: Record<number, string>;
  onPress: () => void;
}) {
  const statusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
    pending:   { label: "Awaiting Approval", bg: "bg-yellow-50", text: "text-yellow-600", border: "border-yellow-200" },
    active:    { label: "Active", bg: "bg-green-50", text: "text-green-600", border: "border-green-200" },
    completed: { label: "Completed", bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
    rejected:  { label: "Rejected", bg: "bg-red-50", text: "text-red-500", border: "border-red-200" },
    archived:  { label: "Archived", bg: "bg-gray-100", text: "text-gray-500", border: "border-gray-200" },
  };

  const statusKey = (project.status || "active").toLowerCase();
  const sc = statusConfig[statusKey] ?? { label: project.status, bg: "bg-gray-100", text: "text-gray-500", border: "border-gray-200" };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className="border border-gray-200 rounded-3xl overflow-hidden bg-white shadow-sm"
    >
      <View className="p-6 pb-4">
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1 pr-3">
            <Text className="font-bold text-gray-900 text-xl mb-2" numberOfLines={1}>{project.name}</Text>
            <View className={`self-start px-3 py-1 rounded-full border ${sc.bg} ${sc.border}`}>
              <Text className={`text-[10px] font-bold uppercase ${sc.text}`}>{sc.label}</Text>
            </View>
          </View>
        </View>

        <Text className="text-sm text-gray-500 mb-4" numberOfLines={2}>
          {project.description ?? "No description."}
        </Text>

        <View className="flex-row flex-wrap gap-2">
          {project.course && (
            <View className="px-3 py-1 border border-gray-200 rounded-full">
              <Text className="text-gray-500 text-[10px] font-bold uppercase">{project.course}</Text>
            </View>
          )}
          {project.group_number && (
            <View className="px-3 py-1 border border-gray-200 rounded-full">
              <Text className="text-gray-500 text-[10px] font-bold uppercase">Group {project.group_number}</Text>
            </View>
          )}
          {project.academic_year && (
            <View className="px-3 py-1 border border-gray-200 rounded-full">
              <Text className="text-gray-500 text-[10px] font-bold uppercase">{project.academic_year}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Secção de Requisições de Equipamentos */}
      {requisitions.length > 0 && (
        <View className="border-t border-gray-100 bg-gray-50/50 p-6 pt-4">
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            Equipment Requests ({requisitions.length})
          </Text>
          <View className="flex-col">
            {requisitions.map((req, index) => {
              const assetName = req.snipeit_asset_id
                ? (assetNames[req.snipeit_asset_id] ?? `Asset #${req.snipeit_asset_id}`)
                : "Unknown asset";

              let statusLabel = req.status;
              let badgeBg = "bg-gray-100";
              let badgeText = "text-gray-500";

              if (req.status === "pending") {
                statusLabel = "Pending"; badgeBg = "bg-yellow-50"; badgeText = "text-yellow-600";
              } else if (req.status === "reserved") {
                statusLabel = "Reserved"; badgeBg = "bg-purple-50"; badgeText = "text-purple-600";
              } else if (req.status === "returned") {
                statusLabel = "Returned"; badgeBg = "bg-green-50"; badgeText = "text-green-600";
              } else if (req.status === "rejected") {
                statusLabel = "Rejected"; badgeBg = "bg-red-50"; badgeText = "text-red-500";
              } else if (req.status === "checked_out") {
                if (req.expected_checkin) {
                  const due = new Date(req.expected_checkin);
                  const isOverdue = due < new Date();
                  statusLabel = isOverdue
                    ? "Overdue"
                    : `Return by ${due.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`;
                  badgeBg = isOverdue ? "bg-red-50" : "bg-orange-50";
                  badgeText = isOverdue ? "text-red-600" : "text-orange-600";
                } else {
                  statusLabel = "Checked Out";
                  badgeBg = "bg-orange-50"; badgeText = "text-orange-600";
                }
              }

              const isLast = index === requisitions.length - 1;

              return (
                <View 
                  key={req.id} 
                  className={`flex-row items-center justify-between py-2 ${!isLast ? 'border-b border-gray-100' : ''}`}
                >
                  <View className="flex-row items-center flex-1 mr-2">
                    <Cpu size={14} color="#D1D5DB" />
                    <Text className="text-gray-600 text-sm ml-2 flex-1" numberOfLines={1}>
                      {assetName}
                    </Text>
                  </View>
                  <View className={`px-2.5 py-0.5 rounded-full ${badgeBg}`}>
                    <Text className={`text-[10px] font-bold uppercase ${badgeText}`}>
                      {statusLabel}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}