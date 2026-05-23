// apps/mobile/app/(tabs)/project/[id].tsx
import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Users, Cpu, Tag, ChevronRight } from "lucide-react-native";
import { projects as projectsApi, users as usersApi, requisitions as reqApi, equipment as equipmentApi, type ProjectDetail, type User, type Requisition } from "../../../lib/api";

export default function ProjectDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const [project, setProject]       = useState<ProjectDetail | null>(null);
  const [memberUsers, setMemberUsers] = useState<Record<number, User>>({});
  const [reqs, setReqs]             = useState<Requisition[]>([]);
  const [assetNames, setAssetNames] = useState<Record<number, string>>({});
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const proj = await projectsApi.get(Number(id));
        setProject(proj);

        const memberIds = [...new Set((proj.members ?? []).map((m) => m.user_id))];
        const results = await Promise.allSettled(memberIds.map((uid) => usersApi.get(uid)));
        const map: Record<number, User> = {};
        results.forEach((r, i) => { if (r.status === "fulfilled") map[memberIds[i]] = r.value; });
        setMemberUsers(map);

        const projectReqs = await reqApi.listByProject(Number(id)).catch(() => [] as Requisition[]);
        setReqs(projectReqs);

        const assetIds = [...new Set(projectReqs.map((r) => r.snipeit_asset_id).filter((x): x is number => x != null))];
        const names: Record<number, string> = {};
        await Promise.allSettled(assetIds.map(async (aid) => {
          try { const a = await equipmentApi.get(aid); names[aid] = a.name ?? `Asset #${aid}`; }
          catch { names[aid] = `Asset #${aid}`; }
        }));
        setAssetNames(names);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <View className="flex-1 items-center justify-center bg-[#f4f5f7]"><ActivityIndicator size="large" color="#3A922A" /></View>;
  if (!project) return <View className="flex-1 items-center justify-center"><Text className="text-gray-400">Project not found.</Text></View>;

  const supervisors = (project.members ?? []).filter((m) => m.role === "supervisor");
  const members     = (project.members ?? []).filter((m) => m.role !== "supervisor");
  const tags        = project.tags ? project.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];

  return (
    <ScrollView className="flex-1 bg-[#f4f5f7]" contentContainerStyle={{ padding: 16 }}>
      <TouchableOpacity onPress={() => router.back()} className="flex-row items-center gap-2 mb-4">
        <ArrowLeft size={18} color="#6B7280" />
        <Text className="text-gray-500 text-sm font-medium">Back</Text>
      </TouchableOpacity>

      {/* Header */}
      <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
        <View className="flex-row items-center gap-2 mb-2 flex-wrap">
          <Text className="text-xl font-bold text-gray-900 flex-1">{project.name}</Text>
          <View className={`px-2 py-0.5 rounded-full ${
            project.status === "active" ? "bg-green-50" :
            project.status === "pending" ? "bg-yellow-50" : "bg-gray-100"
          }`}>
            <Text className={`text-[10px] font-bold uppercase ${
              project.status === "active" ? "text-green-600" :
              project.status === "pending" ? "text-yellow-600" : "text-gray-500"
            }`}>{project.status}</Text>
          </View>
        </View>
        <Text className="text-sm text-gray-400 leading-relaxed">{project.description || "No description."}</Text>
        {project.course && <Text className="text-xs text-gray-400 mt-2 font-medium">{project.course}</Text>}
      </View>

      {/* Team */}
      <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
        <View className="flex-row items-center gap-2 mb-4">
          <Users size={18} color="#9CA3AF" />
          <Text className="font-bold text-gray-900">Team ({(project.members ?? []).length})</Text>
        </View>
        {supervisors.map((m) => {
          const u = memberUsers[m.user_id];
          return (
            <View key={m.user_id} className="flex-row items-center justify-between bg-blue-50 rounded-xl p-3 mb-2">
              <View className="flex-row items-center gap-3">
                <View className="w-8 h-8 bg-blue-200 rounded-full items-center justify-center">
                  <Text className="text-blue-700 font-bold text-sm">{u?.name?.charAt(0) ?? "?"}</Text>
                </View>
                <View>
                  <Text className="font-semibold text-sm text-gray-800">{u?.name ?? `User #${m.user_id}`}</Text>
                  <Text className="text-xs text-gray-400">{u?.email ?? ""}</Text>
                </View>
              </View>
              <Text className="text-xs font-bold text-blue-600 uppercase">Supervisor</Text>
            </View>
          );
        })}
        {members.map((m) => {
          const u = memberUsers[m.user_id];
          return (
            <View key={m.user_id} className="flex-row items-center justify-between bg-gray-50 rounded-xl p-3 mb-2">
              <View className="flex-row items-center gap-3">
                <View className="w-8 h-8 bg-gray-200 rounded-full items-center justify-center">
                  <Text className="text-gray-600 font-bold text-sm">{u?.name?.charAt(0) ?? "?"}</Text>
                </View>
                <View>
                  <Text className="font-semibold text-sm text-gray-800">{u?.name ?? `User #${m.user_id}`}</Text>
                  <Text className="text-xs text-gray-400">{u?.email ?? ""}</Text>
                </View>
              </View>
              <Text className="text-[10px] font-bold text-gray-500 uppercase bg-gray-100 px-2 py-0.5 rounded-full">{m.role}</Text>
            </View>
          );
        })}
      </View>

      {/* Equipment Requests */}
      <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
        <View className="flex-row items-center gap-2 mb-4">
          <Cpu size={18} color="#9CA3AF" />
          <Text className="font-bold text-gray-900">Equipment Requests ({reqs.length})</Text>
        </View>
        {reqs.length === 0 ? (
          <Text className="text-gray-400 text-sm">No requests yet.</Text>
        ) : reqs.map((req) => {
          const now = new Date();
          const assetName = req.snipeit_asset_id
            ? (assetNames[req.snipeit_asset_id] ?? `Asset #${req.snipeit_asset_id}`)
            : "Unknown";
          let statusLabel = req.status;
          let statusColor = "bg-gray-100";
          let statusText  = "text-gray-500";
          if (req.status === "pending")    { statusColor = "bg-yellow-50";  statusText = "text-yellow-600"; statusLabel = "Pending"; }
          if (req.status === "reserved")   { statusColor = "bg-purple-50";  statusText = "text-purple-600"; statusLabel = "Reserved"; }
          if (req.status === "returned")   { statusColor = "bg-green-50";   statusText = "text-green-600";  statusLabel = "Returned"; }
          if (req.status === "rejected")   { statusColor = "bg-red-50";     statusText = "text-red-500";    statusLabel = "Rejected"; }
          if (req.status === "checked_out") {
            if (req.expected_checkin) {
              const due = new Date(req.expected_checkin);
              const overdue = due < now;
              statusColor = overdue ? "bg-red-50" : "bg-orange-50";
              statusText  = overdue ? "text-red-600" : "text-orange-600";
              statusLabel = overdue ? "Overdue" : `Due ${due.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`;
            } else {
              statusColor = "bg-orange-50"; statusText = "text-orange-600"; statusLabel = "Checked Out";
            }
          }
          return (
            <View key={req.id} className="flex-row items-center justify-between bg-gray-50 rounded-xl p-3 mb-2">
              <View className="flex-row items-center gap-2 flex-1 mr-2">
                <Cpu size={13} color="#D1D5DB" />
                <Text className="text-sm text-gray-700 font-medium flex-1" numberOfLines={1}>{assetName}</Text>
              </View>
              <View className={`px-2 py-0.5 rounded-full ${statusColor}`}>
                <Text className={`text-[10px] font-bold uppercase ${statusText}`}>{statusLabel}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Tags */}
      {tags.length > 0 && (
        <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
          <View className="flex-row items-center gap-2 mb-3">
            <Tag size={16} color="#9CA3AF" />
            <Text className="font-bold text-gray-900">Tags</Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {tags.map((t) => (
              <View key={t} className="bg-gray-50 border border-gray-100 px-3 py-1 rounded-full">
                <Text className="text-xs text-gray-600 font-medium">{t}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
