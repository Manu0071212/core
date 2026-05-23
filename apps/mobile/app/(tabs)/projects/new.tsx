// apps/mobile/app/projects/new.tsx
import { useState, useEffect } from "react";
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft, Plus, X, Tag, Link as LinkIcon,
  Users, Cpu, FileText, ShieldCheck, Search
} from "lucide-react-native";
import {
  auth,
  projects as projectsApi,
  requisitions as requisitionsApi,
  users as usersApi,
  equipment as equipmentApi,
  type User,
  type EquipmentCatalogItem,
} from "../../../lib/api";

const MEMBER_ROLES = ["member", "observer", "advisor"];

interface MemberEntry { user: User; role: string; }
interface EquipmentEntry { model: EquipmentCatalogItem; }

export default function NewProjectPage() {
  const router = useRouter();

  // Estados de Dados
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [catalog, setCatalog] = useState<EquipmentCatalogItem[]>([]);
  
  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados do Formulário
  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [groupNumber, setGroupNumber] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<EquipmentEntry[]>([]);

  const [searchMember, setSearchMember] = useState("");
  const [searchSupervisor, setSearchSupervisor] = useState("");
  const [equipSearch, setEquipSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [me, allUsers, cat] = await Promise.all([
          auth.me(),
          usersApi.list(),
          equipmentApi.catalogAvailable(),
        ]);
        setCurrentUser(me);
        setSupervisors(allUsers.filter((u) => u.role === "professor"));
        setAvailableUsers(allUsers.filter((u) => u.role === "student" && u.id !== me.id));
        setCatalog(cat);
      } catch (err: any) {
        setError("Failed to load data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleAddLink = () => {
    if (linkInput.trim() && !links.includes(linkInput.trim())) {
      setLinks([...links, linkInput.trim()]);
      setLinkInput("");
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError("Project name is required."); return; }
    if (!members.some((m) => m.role === "supervisor")) {
      setError("Please add at least one supervisor."); return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const project = await projectsApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        course: course.trim() || undefined,
        academic_year: academicYear.trim() || undefined,
        group_number: groupNumber ? parseInt(groupNumber) : undefined,
        tags: tags.length ? tags.join(",") : undefined,
        links: links.length ? links.join(",") : undefined,
        members: members.map((m) => ({ user_id: m.user.id, role: m.role })),
      });

      if (equipmentItems.length > 0) {
        await requisitionsApi.create(project.id, equipmentItems.map((e) => e.model.id));
      }
      router.replace(`/projects/${project.id}` as any);
    } catch (err: any) {
      setError(err.message ?? "Error creating project.");
      setSubmitting(false);
    }
  };

  if (loading) return (
    <View className="flex-1 items-center justify-center bg-[#f4f5f7]">
      <ActivityIndicator color="#3A922A" />
    </View>
  );

  const inputClass = "bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium text-gray-900";

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-[#f4f5f7]"
    >
      <ScrollView className="flex-1 px-4 py-6" keyboardShouldPersistTaps="handled">
        
        <TouchableOpacity onPress={() => router.back()} className="flex-row items-center mb-6">
          <ArrowLeft size={20} color="#6B7280" />
          <Text className="ml-2 text-gray-500 font-semibold">Back</Text>
        </TouchableOpacity>

        <View className="mb-8">
          <Text className="text-2xl font-extrabold text-gray-900">New Project</Text>
          <Text className="text-gray-500 text-sm">Fill in details for approval.</Text>
        </View>

        <View className="gap-y-5 pb-20">
          
          {/* Section: Project Info */}
          <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <View className="flex-row items-center mb-4 gap-2">
              <FileText size={18} color="#3A922A" />
              <Text className="font-bold text-gray-900">Project Information</Text>
            </View>
            
            <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1">Project Name *</Text>
            <TextInput 
              className={inputClass} 
              placeholder="e.g. Autonomous Solar Drone"
              value={name}
              onChangeText={setName}
            />

            <View className="flex-row gap-x-2 mt-4">
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1">Course</Text>
                <TextInput className={inputClass} placeholder="MIECT" value={course} onChangeText={setCourse} />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1">Year</Text>
                <TextInput className={inputClass} placeholder="24/25" value={academicYear} onChangeText={setAcademicYear} />
              </View>
            </View>

            <Text className="text-[10px] font-bold text-gray-400 uppercase mt-4 mb-1">Description</Text>
            <TextInput 
              className={`${inputClass} h-24 text-top`} 
              multiline 
              placeholder="Describe goals..." 
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Section: Supervisors */}
          <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <View className="flex-row items-center mb-4 gap-2">
              <ShieldCheck size={18} color="#D97706" />
              <Text className="font-bold text-gray-900">Supervisors *</Text>
            </View>

            {members.filter(m => m.role === 'supervisor').map(m => (
              <View key={m.user.id} className="flex-row items-center justify-between p-3 bg-amber-50 rounded-xl mb-2">
                <Text className="text-sm font-semibold text-gray-800">{m.user.name}</Text>
                <TouchableOpacity onPress={() => setMembers(members.filter(x => x.user.id !== m.user.id))}>
                  <X size={16} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            ))}

            <View className="relative mt-2">
              <Search size={14} color="#9CA3AF" style={{position:'absolute', left: 12, top: 15, zIndex: 10}} />
              <TextInput 
                className={`${inputClass} pl-10`} 
                placeholder="Search professors..." 
                value={searchSupervisor}
                onChangeText={setSearchSupervisor}
              />
            </View>
            
            {searchSupervisor.length > 0 && (
              <View className="bg-white border border-gray-100 rounded-xl mt-1 max-h-40 overflow-hidden">
                {supervisors.filter(u => u.name.toLowerCase().includes(searchSupervisor.toLowerCase())).map(u => (
                  <TouchableOpacity 
                    key={u.id} 
                    className="p-3 border-b border-gray-50 flex-row justify-between"
                    onPress={() => {
                      if(!members.find(m => m.user.id === u.id)) setMembers([...members, {user: u, role: 'supervisor'}]);
                      setSearchSupervisor("");
                    }}
                  >
                    <Text className="text-sm">{u.name}</Text>
                    <Plus size={16} color="#3A922A" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Section: Team */}
          <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <View className="flex-row items-center mb-4 gap-2">
              <Users size={18} color="#0D9488" />
              <Text className="font-bold text-gray-900">Team Members</Text>
            </View>

            {/* Current User */}
            <View className="flex-row items-center justify-between p-3 bg-indigo-50 rounded-xl mb-2">
              <Text className="text-sm font-semibold text-indigo-700">{currentUser?.name} (You)</Text>
              <Text className="text-[10px] font-bold uppercase text-indigo-500">Leader</Text>
            </View>

            {members.filter(m => m.role !== 'supervisor').map(m => (
              <View key={m.user.id} className="flex-row items-center justify-between p-3 bg-gray-50 rounded-xl mb-2">
                <View>
                  <Text className="text-sm font-semibold text-gray-800">{m.user.name}</Text>
                  <Text className="text-[10px] text-gray-400 uppercase">{m.role}</Text>
                </View>
                <TouchableOpacity onPress={() => setMembers(members.filter(x => x.user.id !== m.user.id))}>
                  <X size={16} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            ))}

            <TextInput 
              className={`${inputClass} mt-2`} 
              placeholder="Add member by name..." 
              value={searchMember}
              onChangeText={setSearchMember}
            />
            {searchMember.length > 0 && (
              <View className="bg-white border border-gray-100 rounded-xl mt-1">
                {availableUsers.filter(u => u.name.toLowerCase().includes(searchMember.toLowerCase())).map(u => (
                  <TouchableOpacity 
                    key={u.id} 
                    className="p-3 border-b border-gray-50 flex-row justify-between"
                    onPress={() => {
                      if(!members.find(m => m.user.id === u.id)) setMembers([...members, {user: u, role: 'member'}]);
                      setSearchMember("");
                    }}
                  >
                    <Text className="text-sm">{u.name}</Text>
                    <Plus size={16} color="#0D9488" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Section: Equipment */}
          <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <View className="flex-row items-center mb-4 gap-2">
              <Cpu size={18} color="#059669" />
              <Text className="font-bold text-gray-900">Equipment Request</Text>
            </View>
            
            {equipmentItems.map(e => (
              <View key={e.model.id} className="flex-row items-center justify-between p-3 bg-emerald-50 rounded-xl mb-2">
                <Text className="text-sm text-emerald-800 flex-1" numberOfLines={1}>{e.model.name}</Text>
                <TouchableOpacity onPress={() => setEquipmentItems(equipmentItems.filter(x => x.model.id !== e.model.id))}>
                  <X size={16} color="#059669" />
                </TouchableOpacity>
              </View>
            ))}

            <TextInput 
              className={inputClass} 
              placeholder="Search equipment..." 
              value={equipSearch}
              onChangeText={setEquipSearch}
            />
            {equipSearch.length > 0 && (
              <View className="bg-white border border-gray-100 rounded-xl mt-1">
                {catalog.filter(e => e.name.toLowerCase().includes(equipSearch.toLowerCase())).slice(0, 5).map(e => (
                  <TouchableOpacity 
                    key={e.id} 
                    className="p-3 border-b border-gray-50 flex-row justify-between"
                    onPress={() => {
                      if(!equipmentItems.find(x => x.model.id === e.id)) setEquipmentItems([...equipmentItems, {model: e}]);
                      setEquipSearch("");
                    }}
                  >
                    <Text className="text-sm">{e.name}</Text>
                    <Plus size={16} color="#059669" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Section: Tags & Links (Simplified for Mobile) */}
          <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <View className="flex-row items-center mb-4 gap-2">
              <Tag size={18} color="#2563EB" />
              <Text className="font-bold text-gray-900">Tags & Links</Text>
            </View>

            <View className="flex-row gap-2 mb-4">
              <TextInput 
                className={`${inputClass} flex-1`} 
                placeholder="Add tag..." 
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={handleAddTag}
              />
              <TouchableOpacity onPress={handleAddTag} className="bg-gray-900 p-3 rounded-xl">
                <Plus size={20} color="white" />
              </TouchableOpacity>
            </View>

            <View className="flex-row flex-wrap gap-2 mb-4">
              {tags.map(t => (
                <View key={t} className="bg-blue-50 px-3 py-1.5 rounded-full flex-row items-center border border-blue-100">
                  <Text className="text-xs text-blue-600 mr-2">{t}</Text>
                  <TouchableOpacity onPress={() => setTags(tags.filter(x => x !== t))}>
                    <X size={12} color="#2563EB" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View className="flex-row gap-2">
              <TextInput 
                className={`${inputClass} flex-1`} 
                placeholder="https://..." 
                value={linkInput}
                onChangeText={setLinkInput}
                onSubmitEditing={handleAddLink}
              />
              <TouchableOpacity onPress={handleAddLink} className="bg-gray-900 p-3 rounded-xl">
                <LinkIcon size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {error && (
            <View className="p-4 bg-red-50 rounded-xl border border-red-100">
              <Text className="text-red-600 text-sm font-medium text-center">{error}</Text>
            </View>
          )}

          <TouchableOpacity 
            onPress={handleSubmit}
            disabled={submitting}
            className={`py-4 rounded-2xl items-center ${submitting ? 'bg-indigo-200' : 'bg-indigo-600'}`}
          >
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-lg">Submit Project Request</Text>
            )}
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
