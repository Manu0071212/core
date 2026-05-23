// apps/mobile/app/(tabs)/ledger.tsx
import { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, ScrollView, TextInput, ActivityIndicator, RefreshControl } from "react-native";
import { Search, LogOut, LogIn } from "lucide-react-native";
import { requisitions as reqApi, projects as projectsApi, users as usersApi, equipment as equipmentApi, type Requisition } from "../../lib/api";

interface LedgerEvent {
  key: string; type: "checkout" | "return"; date: string;
  projectName: string; userName: string; assetName: string; req_id: number;
}

export default function LedgerPage() {
  const [events, setEvents]     = useState<LedgerEvent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]     = useState("");

  const load = useCallback(async () => {
    try {
      const allReqs = await reqApi.list() as Requisition[];
      const relevant = allReqs.filter((r) => r.checked_out_at || r.returned_at);
      const pIds = [...new Set(relevant.map((r) => r.project_id))];
      const uIds = [...new Set(relevant.map((r) => r.requested_by))];
      const aIds = [...new Set(relevant.map((r) => r.snipeit_asset_id).filter((x): x is number => x != null))];
      const [pRes, uRes, aRes] = await Promise.all([
        Promise.allSettled(pIds.map((id) => projectsApi.get(id))),
        Promise.allSettled(uIds.map((id) => usersApi.get(id))),
        Promise.allSettled(aIds.map((id) => equipmentApi.get(id))),
      ]);
      const pNames: Record<number, string> = {};
      pRes.forEach((r, i) => { if (r.status === "fulfilled") pNames[pIds[i]] = r.value.name; });
      const uNames: Record<number, string> = {};
      uRes.forEach((r, i) => { if (r.status === "fulfilled") uNames[uIds[i]] = r.value.name; });
      const aNames: Record<number, string> = {};
      aRes.forEach((r, i) => { if (r.status === "fulfilled") aNames[aIds[i]] = r.value.name ?? `Asset #${aIds[i]}`; });

      const evts: LedgerEvent[] = [];
      for (const req of relevant) {
        const projectName = pNames[req.project_id]   ?? `Project #${req.project_id}`;
        const userName    = uNames[req.requested_by] ?? `User #${req.requested_by}`;
        const assetName   = req.snipeit_asset_id ? (aNames[req.snipeit_asset_id] ?? `Asset #${req.snipeit_asset_id}`) : "Unknown";
        if (req.checked_out_at) evts.push({ key: `co-${req.id}`, type: "checkout", date: req.checked_out_at, projectName, userName, assetName, req_id: req.id });
        if (req.returned_at)    evts.push({ key: `rt-${req.id}`, type: "return",   date: req.returned_at,    projectName, userName, assetName, req_id: req.id });
      }
      evts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEvents(evts);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return events;
    const q = search.toLowerCase();
    return events.filter((e) => e.assetName.toLowerCase().includes(q) || e.userName.toLowerCase().includes(q) || e.projectName.toLowerCase().includes(q));
  }, [events, search]);

  if (loading) return <View className="flex-1 items-center justify-center bg-[#f4f5f7]"><ActivityIndicator size="large" color="#3A922A" /></View>;

  return (
    <ScrollView
      className="flex-1 bg-[#f4f5f7]"
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text className="text-2xl font-bold text-gray-900 mb-1">Ledger</Text>
      <Text className="text-sm text-gray-400 mb-4">Equipment transaction history</Text>
      <View className="flex-row items-center bg-white border border-gray-100 rounded-xl px-4 py-2.5 mb-4 gap-3">
        <Search size={16} color="#9CA3AF" />
        <TextInput placeholder="Search..." placeholderTextColor="#9CA3AF" value={search} onChangeText={setSearch} className="flex-1 text-sm text-gray-800" />
      </View>
      {filtered.length === 0 ? (
        <Text className="text-gray-400 text-center py-12">{search ? "No results." : "No transactions yet."}</Text>
      ) : filtered.map((evt) => {
        const isCheckout = evt.type === "checkout";
        return (
          <View key={evt.key} className="bg-white border border-gray-100 rounded-2xl p-4 mb-3 flex-row items-center gap-3">
            <View className={`w-10 h-10 rounded-xl items-center justify-center ${isCheckout ? "bg-orange-50" : "bg-green-50"}`}>
              {isCheckout ? <LogOut size={18} color="#F97316" /> : <LogIn size={18} color="#16A34A" />}
            </View>
            <View className="flex-1 min-w-0">
              <View className="flex-row items-center gap-2 mb-1">
                <View className={`px-2 py-0.5 rounded-full ${isCheckout ? "bg-orange-50" : "bg-green-50"}`}>
                  <Text className={`text-[10px] font-bold uppercase ${isCheckout ? "text-orange-600" : "text-green-600"}`}>
                    {isCheckout ? "Checkout" : "Return"}
                  </Text>
                </View>
                <Text className="text-sm font-bold text-gray-900 flex-1" numberOfLines={1}>{evt.assetName}</Text>
              </View>
              <Text className="text-xs text-gray-400">
                {evt.userName} → {evt.projectName}
              </Text>
            </View>
            <Text className="text-xs text-gray-400 shrink-0">
              {new Date(evt.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}
