// apps/mobile/app/users/[id].tsx
import { useState, useEffect } from "react";
import { 
  View, Text, ScrollView, TouchableOpacity, 
  ActivityIndicator, SafeAreaView, Platform 
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Folder, Cpu, Mail, Hash, BookOpen, GraduationCap } from "lucide-react-native";
import {
  users as usersApi,
  projects as projectsApi,
  requisitions as requisitionsApi,
  equipment as equipmentApi,
  type User,
  type Project,
  type Requisition,
} from "../../../lib/api";

function getStatusStyles(status: string) {
  const s = status.toLowerCase();
  if (s === "active") return { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" };
  if (s === "pending") return { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500" };
  if (s === "rejected") return { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" };
  return { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" };
}

function getReqStatusStyles(status: string, isOverdue: boolean) {
  if (isOverdue) return { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" };
  if (status === "checked_out") return { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" };
  if (status === "returned") return { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" };
  return { bg: "bg-indigo-100", text: "text-indigo-700", dot: "bg-indigo-500" };
}

export default function UserDetailsMobile() {
  const { id: userId } = useLocalSearchParams();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [reqs, setReqs] = useState<Requisition[]>([]);
  const [assetNames, setAssetNames] = useState<Record<number, string>>({});
  const [projectNames, setProjectNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const id = parseInt(userId as string);
      if (isNaN(id)) return;

      try {
        const [u, p, allReqs] = await Promise.all([
          usersApi.get(id),
          usersApi.projects(id),
          requisitionsApi.list(),
        ]);

        setUser(u);
        setProjects(p);

        const pNames: Record<number, string> = {};
        p.forEach(proj => { pNames[proj.id] = proj.name; });
        setProjectNames(pNames);

        const userReqs = allReqs.filter(r => r.requested_by === id);
        setReqs(userReqs);

        const assetIds = [...new Set(userReqs.map(r => r.snipeit_asset_id).filter(Boolean))];
        const aNames: Record<number, string> = {};
        await Promise.allSettled(assetIds.map(async (aid) => {
          const a = await equipmentApi.get(aid!);
          aNames[aid!] = a.name || `Asset #${aid}`;
        }));
        setAssetNames(aNames);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [userId]);

  if (loading) return (
    <View className="flex-1 items-center justify-center bg-[#f4f5f7]">
      <ActivityIndicator size="large" color="#3A922A" />
    </View>
  );

  if (!user) return null;

  return (
    <SafeAreaView className="flex-1 bg-[#f4f5f7]">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        
        <View className="px-6 py-4 flex-row items-center">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="p-2 bg-white rounded-full shadow-sm border border-gray-100"
          >
            <ArrowLeft size={20} color="#111827" />
          </TouchableOpacity>
          <Text className="ml-4 text-lg font-bold text-gray-900">User Profile</Text>
        </View>

        <View className="mx-4 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 items-center">
          <View className="w-24 h-24 bg-indigo-50 rounded-full items-center justify-center mb-4 border-4 border-white shadow-md">
            <Text className="text-indigo-600 font-bold text-4xl">
              {user.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          
          <Text className="text-xl font-extrabold text-gray-900">{user.name}</Text>
          <View className={`mt-2 px-4 py-1 rounded-full ${
             user.role === "professor" ? "bg-purple-100" : "bg-indigo-100"
          }`}>
            <Text className={`text-[10px] font-black uppercase ${
              user.role === "professor" ? "text-purple-600" : "text-indigo-600"
            }`}>
              {user.role}
            </Text>
          </View>

          <View className="w-full mt-6 gap-y-4">
            <InfoRow icon={<Mail size={16} color="#9CA3AF" />} label="Email" value={user.email} />
            {user.nmec && <InfoRow icon={<Hash size={16} color="#9CA3AF" />} label="NMEC" value={user.nmec.toString()} />}
            {user.course && <InfoRow icon={<BookOpen size={16} color="#9CA3AF" />} label="Course" value={user.course} />}
            {user.academic_year && <InfoRow icon={<GraduationCap size={16} color="#9CA3AF" />} label="Year" value={`${user.academic_year}º Year`} />}
          </View>
        </View>

        <View className="mt-8 px-4">
          <View className="flex-row items-center gap-2 mb-4 px-2">
            <Folder size={18} color="#6B7280" />
            <Text className="font-bold text-gray-900 text-base">Projects ({projects.length})</Text>
          </View>

          {projects.map((proj) => {
            const styles = getStatusStyles(proj.status);
            return (
              <TouchableOpacity 
                key={proj.id}
                onPress={() => router.push(`/projects/${proj.id}` as any)}
                className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 flex-row items-center justify-between shadow-sm"
              >
                <View className="flex-1 mr-4">
                  <Text className="font-bold text-gray-800 text-sm" numberOfLines={1}>{proj.name}</Text>
                  <Text className="text-xs text-gray-400 mt-1">{proj.course}</Text>
                </View>
                <View className={`px-3 py-1 rounded-full flex-row items-center ${styles.bg}`}>
                  <View className={`w-1.5 h-1.5 rounded-full mr-1.5 ${styles.dot}`} />
                  <Text className={`text-[10px] font-bold uppercase ${styles.text}`}>{proj.status}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View className="mt-8 px-4">
          <View className="flex-row items-center gap-2 mb-4 px-2">
            <Cpu size={18} color="#6B7280" />
            <Text className="font-bold text-gray-900 text-base">Equipment ({reqs.length})</Text>
          </View>

          {reqs.map((req) => {
            const isOverdue = req.expected_checkin ? new Date(req.expected_checkin) < new Date() : false;
            const styles = getReqStatusStyles(req.status, isOverdue);
            const assetName = assetNames[req.snipeit_asset_id!] || `Asset #${req.snipeit_asset_id}`;

            return (
              <View 
                key={req.id}
                className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm"
              >
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-1">
                    <Text className="font-bold text-gray-800 text-sm">{assetName}</Text>
                    <Text className="text-[10px] text-gray-400 mt-1 uppercase font-medium">
                      {projectNames[req.project_id] || "No Project"}
                    </Text>
                  </View>
                  <View className={`px-2.5 py-1 rounded-full ${styles.bg}`}>
                    <Text className={`text-[10px] font-black uppercase ${styles.text}`}>
                      {isOverdue ? "Overdue" : req.status.replace("_", " ")}
                    </Text>
                  </View>
                </View>
                
                <View className="pt-3 border-t border-gray-50 flex-row justify-between items-center">
                  <Text className="text-[10px] text-gray-400">Requested on {new Date(req.created_at).toLocaleDateString()}</Text>
                  {req.expected_checkin && (
                    <Text className={`text-[10px] font-bold ${isOverdue ? 'text-red-500' : 'text-gray-500'}`}>
                      Due: {new Date(req.expected_checkin).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <View className="flex-row items-center gap-2">
        {icon}
        <Text className="text-gray-400 text-xs font-medium">{label}</Text>
      </View>
      <Text className="text-gray-800 text-xs font-bold shrink-1 text-right ml-4" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
