// apps/mobile/app/(tabs)/item/[id].tsx
import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { 
  ArrowLeft, MapPin, DollarSign, Hash, Package, 
  FolderOpen, History, LogOut, LogIn 
} from "lucide-react-native";
import { 
  equipment as equipmentApi, 
  requisitions as requisitionsApi, 
  projects as projectsApi, 
  users as usersApi,
  type EquipmentCatalogItem, 
  type Requisition 
} from "../../../lib/api";

type ProjectInfo = { id: number; name: string; status: string; course?: string };

interface HistoryEvent {
  type: "checkout" | "return";
  date: string;
  projectName: string;
  userName: string;
  req_id: number;
}

export default function EquipmentDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const equipmentId = Number(id);
  const router = useRouter();

  const [item, setItem] = useState<EquipmentCatalogItem | null>(null);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!equipmentId) return;

    (async () => {
      try {
        const asset = await equipmentApi.get(equipmentId);
        setItem(asset as EquipmentCatalogItem);

        // Fetch all requisitions and filter for this asset
        const allReqs = await requisitionsApi.list() as Requisition[];
        const assetReqs = allReqs.filter(
          (r) => r.snipeit_asset_id === equipmentId &&
                 ["reserved", "checked_out", "returned"].includes(r.status)
        );

        // Load unique projects and users
        const projectIds = [...new Set(assetReqs.map((r) => r.project_id))];
        const userIds    = [...new Set(assetReqs.map((r) => r.requested_by))];

        const [projResults, userResults] = await Promise.all([
          Promise.allSettled(projectIds.map((pid) => projectsApi.get(pid))),
          Promise.allSettled(userIds.map((uid) => usersApi.get(uid))),
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

        // Set Unique Projects
        setProjects(Object.values(pMap));

        // Build History Events
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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f4f5f7]">
        <ActivityIndicator size="large" color="#3A922A" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f4f5f7] p-4">
        <View className="bg-red-50 border border-red-200 p-4 rounded-xl w-full">
          <Text className="text-red-700 text-center">Error: {error}</Text>
        </View>
      </View>
    );
  }

  if (!item) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f4f5f7]">
        <Text className="text-gray-400">Not found.</Text>
      </View>
    );
  }

  const name = item.name || `Equipment #${item.id}`;
  const price = item.price != null ? `€${item.price}` : "—";
  const reference = item.asset_tag || `REF-${String(item.id).padStart(3, "0")}`;

  const getStatusStyles = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":      return { bg: "bg-green-50", text: "text-green-600" };
      case "pending":     return { bg: "bg-yellow-50", text: "text-yellow-600" };
      case "rejected":    return { bg: "bg-red-50", text: "text-red-500" };
      case "completed":   return { bg: "bg-blue-50", text: "text-blue-600" };
      case "reserved":    return { bg: "bg-purple-50", text: "text-purple-600" };
      case "checked_out": return { bg: "bg-orange-50", text: "text-orange-600" };
      case "returned":    return { bg: "bg-gray-50", text: "text-gray-500" };
      case "available":   return { bg: "bg-green-50", text: "text-green-600" };
      default:            return { bg: "bg-gray-100", text: "text-gray-500" };
    }
  };

  const itemStatusStyle = getStatusStyles(item.status ?? "");
  const imageUrl = item.image 
    ? (item.image.startsWith("http") ? item.image : `https://inventory.deti-makerlab.ua.pt/uploads/assets/${item.image}`)
    : null;

  return (
    <ScrollView className="flex-1 bg-[#f4f5f7]" contentContainerStyle={{ padding: 16 }}>
      {/* Header / Back */}
      <TouchableOpacity onPress={() => router.back()} className="flex-row items-center gap-2 mb-4">
        <ArrowLeft size={18} color="#6B7280" />
        <Text className="text-gray-500 text-sm font-medium">Back</Text>
      </TouchableOpacity>

      {/* Hero Section */}
      <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4 shadow-sm">
        <View className="h-48 bg-gray-50 items-center justify-center border-b border-gray-100">
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} className="w-full h-full" resizeMode="contain" />
          ) : (
            <Package size={60} color="#E5E7EB" />
          )}
        </View>
        <View className="p-5">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xl font-bold text-gray-900 flex-1 mr-2">{name}</Text>
            <View className={`px-3 py-1 rounded-full ${itemStatusStyle.bg}`}>
              <Text className={`text-xs font-bold uppercase ${itemStatusStyle.text}`}>{item.status}</Text>
            </View>
          </View>
          <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wide bg-gray-100 self-start px-3 py-1 rounded-full">
            {item.category ?? "Uncategorized"}
          </Text>
        </View>
      </View>

      {/* Details Section */}
      <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4 shadow-sm">
        <Text className="font-bold text-lg text-gray-900 mb-4">Details</Text>
        {[
          { icon: DollarSign, label: "Price",     value: price },
          { icon: Hash,       label: "Reference", value: reference },
          { icon: MapPin,     label: "Location",  value: item.location ?? "N/A" },
        ].map(({ icon: Icon, label, value }) => (
          <View key={label} className="flex-row items-center justify-between py-3 border-b border-gray-50 last:border-0">
            <View className="flex-row items-center gap-3">
              <Icon size={18} color="#9CA3AF" />
              <Text className="text-sm text-gray-500 font-medium">{label}</Text>
            </View>
            <Text className="text-sm text-gray-900 font-semibold">{value}</Text>
          </View>
        ))}
      </View>

      {/* Projects Section */}
      <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4 shadow-sm">
        <View className="flex-row items-center gap-2 mb-4">
          <FolderOpen size={18} color="#9CA3AF" />
          <Text className="font-bold text-lg text-gray-900">Projects ({projects.length})</Text>
        </View>
        
        {projects.length === 0 ? (
          <Text className="text-sm text-gray-400">No projects yet.</Text>
        ) : (
          projects.map((proj) => {
            const projStyle = getStatusStyles(proj.status);
            return (
              <TouchableOpacity 
                key={proj.id} 
                onPress={() => router.push(`/projects/${proj.id}` as any)}
                className="flex-row items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 mb-2"
              >
                <View className="flex-1 mr-2">
                  <Text className="font-semibold text-sm text-gray-800">{proj.name}</Text>
                  {proj.course && <Text className="text-xs text-gray-400 mt-0.5">{proj.course}</Text>}
                </View>
                <View className={`px-3 py-1 rounded-full ${projStyle.bg}`}>
                  <Text className={`text-[10px] font-bold uppercase ${projStyle.text}`}>{proj.status}</Text>
                </View>
              </TouchableOpacity>
            )
          })
        )}
      </View>

      {/* Full History Section */}
      <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-8 shadow-sm">
        <View className="flex-row items-center gap-2 mb-4">
          <History size={18} color="#9CA3AF" />
          <Text className="font-bold text-lg text-gray-900">Full History ({history.length})</Text>
        </View>

        {history.length === 0 ? (
          <Text className="text-sm text-gray-400">No history yet.</Text>
        ) : (
          history.map((evt) => {
            const isCheckout = evt.type === "checkout";
            const iconBg = isCheckout ? "bg-orange-50" : "bg-green-50";
            const iconColor = isCheckout ? "#F97316" : "#16A34A"; // orange-500 / green-600
            const badgeBg = isCheckout ? "bg-orange-50" : "bg-green-50";
            const badgeText = isCheckout ? "text-orange-500" : "text-green-600";

            return (
              <View 
                key={`${evt.type}-${evt.req_id}`} 
                className="flex-row items-center py-3 border-b border-gray-50 last:border-0"
              >
                <View className={`w-8 h-8 rounded-lg items-center justify-center mr-3 ${iconBg}`}>
                  {isCheckout ? <LogOut size={14} color={iconColor} /> : <LogIn size={14} color={iconColor} />}
                </View>
                
                <View className="flex-1 justify-center">
                  <View className="flex-row items-center gap-2">
                    <View className={`px-2 py-0.5 rounded-full ${badgeBg}`}>
                      <Text className={`text-[10px] font-bold uppercase ${badgeText}`}>
                        {isCheckout ? "Checkout" : "Return"}
                      </Text>
                    </View>
                    <Text className="text-sm font-semibold text-gray-800 flex-1" numberOfLines={1}>
                      {evt.projectName}
                    </Text>
                  </View>
                  <Text className="text-xs text-gray-400 mt-1">{evt.userName}</Text>
                </View>
                
                <Text className="text-xs text-gray-400 ml-2 text-right">
                  {new Date(evt.date).toLocaleDateString("en-GB", {
                    day: "2-digit", month: "short", year: "numeric"
                  })}
                </Text>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
