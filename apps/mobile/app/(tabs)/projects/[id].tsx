// apps/mobile/app/(tabs)/projects/[id].tsx
import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Linking, Platform
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft, Users, Cpu, Tag, Link as LinkIcon,
  Clock, CheckCircle2, XCircle, AlertCircle, ChevronRight, X, Plus, Search
} from "lucide-react-native";
import {
  projects as projectsApi,
  users as usersApi,
  requisitions as reqApi,
  equipment as equipmentApi,
  type ProjectDetail,
  type User,
  type Requisition,
  type EquipmentCatalogItem
} from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";

function StatusBadge({ status }: { status: string }) {
  const s = (status ?? "active").toLowerCase();
  let bg = "bg-gray-100";
  let text = "text-gray-500";
  let border = "border-gray-200";

  if (s === "active") {
    bg = "bg-green-50"; text = "text-green-600"; border = "border-green-200";
  } else if (s === "pending") {
    bg = "bg-yellow-50"; text = "text-yellow-600"; border = "border-yellow-200";
  } else if (s === "rejected") {
    bg = "bg-red-50"; text = "text-red-500"; border = "border-red-200";
  } else if (s === "completed") {
    bg = "bg-blue-50"; text = "text-blue-600"; border = "border-blue-200";
  } else if (s === "reserved") {
    bg = "bg-purple-50"; text = "text-purple-600"; border = "border-purple-200";
  } else if (s === "archived") {
    bg = "bg-gray-100"; text = "text-gray-500"; border = "border-gray-200";
  } else if (s === "approved") {
    bg = "bg-teal-50"; text = "text-teal-600"; border = "border-teal-200";
  }

  return (
    <View className={`px-3 py-1 rounded-full border ${bg} ${border} self-start`}>
      <Text className={`text-[10px] font-bold uppercase ${text}`}>{status}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <View className="flex-row justify-between items-center py-3 border-b border-gray-100 last:border-0">
      <Text className="text-sm text-gray-400 font-medium">{label}</Text>
      <Text className="text-sm text-gray-800 font-semibold">{value}</Text>
    </View>
  );
}

function TimelineItem({ icon, label, date, color }: {
  icon: React.ReactNode; label: string; date?: string; color: string;
}) {
  return (
    <View className="flex-row items-center gap-3 py-1">
      <View className={color}>{icon}</View>
      <Text className="text-sm font-medium text-gray-700">{label}</Text>
      {date && <Text className="text-xs text-gray-400 ml-auto">{date}</Text>}
    </View>
  );
}

function MemberAvatar({ name, color = "bg-gray-200 text-gray-500" }: { name?: string; color?: string }) {
  const initial = name ? name.charAt(0).toUpperCase() : "?";
  return (
    <View className={`w-9 h-9 rounded-full flex items-center justify-center ${color}`}>
      <Text className="text-sm font-bold text-center">{initial}</Text>
    </View>
  );
}

export default function ProjectDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const { user: currentUser } = useAuth();

  const [project, setProject]       = useState<ProjectDetail | null>(null);
  const [memberUsers, setMemberUsers] = useState<Record<number, User>>({});
  const [reqs, setReqs]             = useState<Requisition[]>([]);
  const [assetNames, setAssetNames] = useState<Record<number, string>>({});
  const [loading, setLoading]       = useState(true);

  // Modal visibility states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReqModal, setShowReqModal]   = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  // Edit form states
  const [editName, setEditName]                 = useState("");
  const [editDescription, setEditDescription]   = useState("");
  const [editCourse, setEditCourse]             = useState("");
  const [editAcademicYear, setEditAcademicYear] = useState("");
  const [editGroupNumber, setEditGroupNumber]   = useState("");
  const [editTags, setEditTags]                 = useState<string[]>([]);
  const [editLinks, setEditLinks]               = useState<string[]>([]);
  const [tagInput, setTagInput]                 = useState("");
  const [linkInput, setLinkInput]               = useState("");
  const [saving, setSaving]                     = useState(false);
  const [editError, setEditError]               = useState<string | null>(null);

  // Requisitions selection states
  const [catalog, setCatalog]                 = useState<EquipmentCatalogItem[]>([]);
  const [selectedEquip, setSelectedEquip]     = useState<EquipmentCatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog]   = useState(false);
  const [submittingReq, setSubmittingReq]     = useState(false);
  const [reqError, setReqError]               = useState<string | null>(null);
  const [equipSearch, setEquipSearch]         = useState("");

  // Complete status saving state
  const [completing, setCompleting]           = useState(false);

  const loadProjectDetails = useCallback(async () => {
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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProjectDetails();
  }, [loadProjectDetails]);

  useEffect(() => {
    reqApi.syncSnipeit().catch(console.error);
  }, []);

  // Fetch catalog when Requisition modal opens
  useEffect(() => {
    if (!showReqModal) return;
    setLoadingCatalog(true);
    setReqError(null);
    equipmentApi.catalogAvailable()
      .then(setCatalog)
      .catch((err) => {
        console.error(err);
        setReqError("Failed to load equipment catalog.");
      })
      .finally(() => setLoadingCatalog(false));
  }, [showReqModal]);

  if (loading) return (
    <View className="flex-1 items-center justify-center bg-[#f4f5f7]">
      <ActivityIndicator size="large" color="#3A922A" />
    </View>
  );

  if (!project) return (
    <View className="flex-1 items-center justify-center bg-[#f4f5f7]">
      <Text className="text-gray-400 font-medium">Project not found.</Text>
    </View>
  );

  const supervisors = (project.members ?? []).filter((m) => m.role === "supervisor");
  const members     = (project.members ?? []).filter((m) => m.role !== "supervisor");
  const tags        = project.tags ? project.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
  const links       = project.links ? project.links.split(",").map((l) => l.trim()).filter(Boolean) : [];
  const createdAt   = new Date(project.created_at).toLocaleDateString("pt-PT", {
    year: "numeric", month: "long", day: "numeric"
  });

  const isMember = currentUser !== null &&
    (project.members ?? []).some((m) => m.user_id === currentUser.id);

  // Link open handler
  const openLink = async (url: string) => {
    try {
      let formattedUrl = url.trim();
      if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = `https://${formattedUrl}`;
      }
      const supported = await Linking.canOpenURL(formattedUrl);
      if (supported) {
        await Linking.openURL(formattedUrl);
      } else {
        console.warn("Cannot open URI: " + formattedUrl);
      }
    } catch (err) {
      console.error("An error occurred opening link:", err);
    }
  };

  // Edit Modal tag/link management
  const addTag = () => {
    const t = tagInput.trim();
    if (t && !editTags.includes(t)) {
      setEditTags([...editTags, t]);
    }
    setTagInput("");
  };

  const addLink = () => {
    const l = linkInput.trim();
    if (l && !editLinks.includes(l)) {
      setEditLinks([...editLinks, l]);
    }
    setLinkInput("");
  };

  // API submit actions
  const handleSaveProject = async () => {
    if (!editName.trim()) {
      setEditError("Project name is required.");
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      const updated = await projectsApi.update(project.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        course: editCourse.trim() || undefined,
        academic_year: editAcademicYear.trim() || undefined,
        group_number: editGroupNumber ? parseInt(editGroupNumber) : undefined,
        tags: editTags.length ? editTags.join(",") : undefined,
        links: editLinks.length ? editLinks.join(",") : undefined
      });
      setProject(updated);
      setShowEditModal(false);
    } catch (err: any) {
      setEditError(err.message ?? "Failed to save project.");
    } finally {
      setSaving(false);
    }
  };

  const handleRequestEquipment = async () => {
    if (selectedEquip.length === 0) {
      setReqError("Please select at least one equipment item.");
      return;
    }
    setSubmittingReq(true);
    setReqError(null);
    try {
      await reqApi.create(project.id, selectedEquip.map((i) => i.id));
      await loadProjectDetails();
      setShowReqModal(false);
    } catch (err: any) {
      setReqError(err.message ?? "Failed to submit request.");
    } finally {
      setSubmittingReq(false);
    }
  };

  const handleCompleteProject = async () => {
    setCompleting(true);
    try {
      await projectsApi.updateStatus(project.id, "completed");
      setProject({ ...project, status: "completed" });
      setShowCompleteModal(false);
    } catch (err: any) {
      alert(err.message ?? "Failed to complete project.");
    } finally {
      setCompleting(false);
    }
  };

  const filteredCatalog = catalog
    .filter((m) => !selectedEquip.find((i) => i.id === m.id))
    .filter((m) => !equipSearch || m.name.toLowerCase().includes(equipSearch.toLowerCase()));

  return (
    <View className="flex-1 bg-[#f4f5f7]">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <TouchableOpacity onPress={() => router.back()} className="flex-row items-center gap-2 mb-4">
          <ArrowLeft size={18} color="#6B7280" />
          <Text className="text-gray-500 text-sm font-medium">Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4 shadow-sm">
          <View className="flex-row items-center gap-2 mb-2 flex-wrap">
            <Text className="text-xl font-bold text-gray-900 flex-1">{project.name}</Text>
            <StatusBadge status={project.status} />
          </View>
          <Text className="text-sm text-gray-400 leading-relaxed mb-1">{project.description || "No description."}</Text>
          {project.course && <Text className="text-xs text-gray-400 mt-1 font-medium">{project.course}</Text>}
        </View>

        {/* Action Buttons for Members */}
        {isMember && ["pending", "active"].includes(project.status) && (
          <View className="flex-row flex-wrap gap-2 mb-4">
            {project.status === "active" && (
              <TouchableOpacity
                onPress={() => setShowCompleteModal(true)}
                className="flex-row items-center gap-1.5 px-3.5 py-2.5 bg-white border border-green-200 rounded-xl"
              >
                <CheckCircle2 size={14} color="#16a34a" />
                <Text className="text-green-600 font-bold text-xs">Complete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                setSelectedEquip([]);
                setReqError(null);
                setEquipSearch("");
                setShowReqModal(true);
              }}
              className="flex-row items-center gap-1.5 px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl"
            >
              <Cpu size={14} color="#374151" />
              <Text className="text-gray-700 font-bold text-xs">Request Equipment</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setEditName(project.name);
                setEditDescription(project.description ?? "");
                setEditCourse(project.course ?? "");
                setEditAcademicYear(project.academic_year ?? "");
                setEditGroupNumber(project.group_number?.toString() ?? "");
                setEditTags(project.tags ? project.tags.split(",").map(t => t.trim()).filter(Boolean) : []);
                setEditLinks(project.links ? project.links.split(",").map(l => l.trim()).filter(Boolean) : []);
                setEditError(null);
                setShowEditModal(true);
              }}
              className="flex-row items-center gap-1.5 px-3.5 py-2.5 bg-gray-900 rounded-xl"
            >
              <Text className="text-white font-bold text-xs">Edit Project</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Project Info */}
        <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4 shadow-sm">
          <Text className="font-bold text-gray-900 text-base mb-3">Project Info</Text>
          <InfoRow label="Course" value={project.course} />
          <InfoRow label="Academic Year" value={project.academic_year} />
          <InfoRow label="Group Number" value={project.group_number} />
        </View>

        {/* Team */}
        <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4 shadow-sm">
          <View className="flex-row items-center gap-2 mb-4">
            <Users size={18} color="#9CA3AF" />
            <Text className="font-bold text-gray-900">Team ({(project.members ?? []).length})</Text>
          </View>
          {supervisors.map((m) => {
            const u = memberUsers[m.user_id];
            return (
              <View key={m.user_id} className="flex-row items-center justify-between bg-blue-50 rounded-xl p-3 mb-2 border border-blue-100">
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <MemberAvatar name={u?.name} color="bg-blue-200 text-blue-700" />
                  <View className="flex-1">
                    <Text className="font-semibold text-sm text-gray-800" numberOfLines={1}>{u?.name ?? `User #${m.user_id}`}</Text>
                    <Text className="text-xs text-gray-400" numberOfLines={1}>{u?.email ?? ""}</Text>
                  </View>
                </View>
                <Text className="text-[10px] font-bold text-blue-600 uppercase shrink-0">Supervisor</Text>
              </View>
            );
          })}
          {members.map((m) => {
            const u = memberUsers[m.user_id];
            return (
              <View key={m.user_id} className="flex-row items-center justify-between bg-gray-50 rounded-xl p-3 mb-2 border border-gray-100">
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <MemberAvatar name={u?.name} />
                  <View className="flex-1">
                    <Text className="font-semibold text-sm text-gray-800" numberOfLines={1}>{u?.name ?? `User #${m.user_id}`}</Text>
                    <Text className="text-xs text-gray-400" numberOfLines={1}>{u?.email ?? ""}</Text>
                  </View>
                </View>
                <Text className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                  m.role === "leader" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"
                }`}>{m.role}</Text>
              </View>
            );
          })}
        </View>

        {/* Equipment Requests */}
        <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4 shadow-sm">
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
              <View key={req.id} className="flex-row items-center justify-between bg-gray-50 rounded-xl p-3 mb-2 border border-gray-100">
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

        {/* Links */}
        {links.length > 0 && (
          <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4 shadow-sm">
            <View className="flex-row items-center gap-2 mb-3">
              <LinkIcon size={16} color="#9CA3AF" />
              <Text className="font-bold text-gray-900">Links</Text>
            </View>
            <View className="gap-2">
              {links.map((l) => (
                <TouchableOpacity
                  key={l}
                  onPress={() => openLink(l)}
                  className="flex-row items-center gap-1.5 py-1"
                >
                  <ChevronRight size={14} color="#6366F1" />
                  <Text className="text-sm text-indigo-500 font-semibold underline truncate flex-1">{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4 shadow-sm">
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

        {/* Timeline */}
        <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4 shadow-sm">
          <View className="flex-row items-center gap-2 mb-3">
            <Clock size={16} color="#9CA3AF" />
            <Text className="font-bold text-gray-900">Timeline</Text>
          </View>
          <View className="gap-3">
            <TimelineItem
              icon={<CheckCircle2 size={14} color="#9CA3AF" />}
              label="Created"
              date={createdAt}
              color="text-gray-400"
            />
            {project.approved_at && (
              <TimelineItem
                icon={<CheckCircle2 size={14} color="#16A34A" />}
                label="Approved"
                date={new Date(project.approved_at).toLocaleDateString("pt-PT")}
                color="text-green-600"
              />
            )}
            {project.status === "rejected" && (
              <TimelineItem icon={<XCircle size={14} color="#EF4444" />} label="Rejected" color="text-red-500" />
            )}
            {project.status === "active" && (
              <TimelineItem icon={<AlertCircle size={14} color="#16A34A" />} label="Active" color="text-green-600" />
            )}
            {project.status === "completed" && (
              <TimelineItem icon={<CheckCircle2 size={14} color="#2563EB" />} label="Completed" color="text-blue-600" />
            )}
          </View>
        </View>
      </ScrollView>

      {/* MODAL: EDIT PROJECT */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View className="flex-1 bg-black/40 justify-end md:justify-center md:items-center p-0 md:p-4">
          <View className="bg-white w-full max-h-[90%] rounded-t-[24px] md:rounded-[24px] shadow-xl overflow-hidden">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <Text className="text-lg font-bold text-gray-900">Edit Project</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView className="px-6 py-6" contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled">
              <View>
                <Text className="text-xs font-bold text-gray-400 uppercase mb-1">Project Name *</Text>
                <TextInput
                  className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium text-gray-900"
                  value={editName}
                  onChangeText={setEditName}
                />
              </View>

              <View>
                <Text className="text-xs font-bold text-gray-400 uppercase mb-1">Description</Text>
                <TextInput
                  className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 h-24 text-top"
                  multiline
                  value={editDescription}
                  onChangeText={setEditDescription}
                />
              </View>

              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Text className="text-xs font-bold text-gray-400 uppercase mb-1">Course</Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium text-gray-900"
                    value={editCourse}
                    onChangeText={setEditCourse}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-gray-400 uppercase mb-1">Academic Year</Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium text-gray-900"
                    placeholder="e.g. 24/25"
                    value={editAcademicYear}
                    onChangeText={setEditAcademicYear}
                  />
                </View>
              </View>

              <View>
                <Text className="text-xs font-bold text-gray-400 uppercase mb-1">Group Number</Text>
                <TextInput
                  className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium text-gray-900"
                  keyboardType="numeric"
                  value={editGroupNumber}
                  onChangeText={setEditGroupNumber}
                />
              </View>

              <View>
                <Text className="text-xs font-bold text-gray-400 uppercase mb-1">Tags</Text>
                <View className="flex-row gap-2 mb-2">
                  <TextInput
                    className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-950"
                    placeholder="Add tag..."
                    value={tagInput}
                    onChangeText={setTagInput}
                    onSubmitEditing={addTag}
                  />
                  <TouchableOpacity onPress={addTag} className="p-3 bg-gray-900 text-white rounded-xl justify-center items-center">
                    <Plus size={16} color="white" />
                  </TouchableOpacity>
                </View>
                {editTags.length > 0 && (
                  <View className="flex-row flex-wrap gap-2">
                    {editTags.map((t) => (
                      <View key={t} className="flex-row items-center gap-1.5 px-3 py-1 bg-gray-50 border border-gray-100 rounded-full">
                        <Text className="text-xs text-gray-600 font-medium">{t}</Text>
                        <TouchableOpacity onPress={() => setEditTags(editTags.filter((x) => x !== t))}>
                          <X size={12} color="#9CA3AF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View>
                <Text className="text-xs font-bold text-gray-400 uppercase mb-1">Links</Text>
                <View className="flex-row gap-2 mb-2">
                  <TextInput
                    className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-950"
                    placeholder="https://..."
                    value={linkInput}
                    onChangeText={setLinkInput}
                    onSubmitEditing={addLink}
                  />
                  <TouchableOpacity onPress={addLink} className="p-3 bg-gray-900 text-white rounded-xl justify-center items-center">
                    <Plus size={16} color="white" />
                  </TouchableOpacity>
                </View>
                {editLinks.length > 0 && (
                  <View className="gap-2">
                    {editLinks.map((l) => (
                      <View key={l} className="flex-row items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <Text className="text-xs text-blue-500 flex-1 mr-2" numberOfLines={1}>{l}</Text>
                        <TouchableOpacity onPress={() => setEditLinks(editLinks.filter((x) => x !== l))}>
                          <X size={14} color="#9CA3AF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {editError && (
                <View className="p-3 bg-red-50 border border-red-100 rounded-xl">
                  <Text className="text-red-500 text-sm font-semibold">{editError}</Text>
                </View>
              )}
            </ScrollView>

            {/* Modal Footer */}
            <View className="flex-row gap-3 px-6 py-4 border-t border-gray-100">
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                className="flex-1 py-3.5 border border-gray-200 rounded-xl items-center"
              >
                <Text className="text-gray-600 font-semibold text-sm">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveProject}
                disabled={saving}
                className="flex-1 py-3.5 bg-gray-900 rounded-xl items-center disabled:opacity-50"
              >
                {saving ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-semibold text-sm">Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: REQUEST EQUIPMENT */}
      <Modal
        visible={showReqModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowReqModal(false)}
      >
        <View className="flex-1 bg-black/40 justify-end md:justify-center md:items-center p-0 md:p-4">
          <View className="bg-white w-full max-h-[90%] rounded-t-[24px] md:rounded-[24px] shadow-xl overflow-hidden flex-col">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <View>
                <Text className="text-lg font-bold text-gray-900">Request Equipment</Text>
                <Text className="text-xs text-gray-400 mt-0.5">Select items from the catalog</Text>
              </View>
              <TouchableOpacity onPress={() => setShowReqModal(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <View className="flex-1 px-6 py-4 flex-col gap-4">
              {loadingCatalog ? (
                <View className="py-8 justify-center items-center">
                  <ActivityIndicator color="#3A922A" />
                  <Text className="text-gray-400 text-sm mt-2 font-medium">Loading catalog...</Text>
                </View>
              ) : catalog.length === 0 ? (
                <View className="items-center py-10">
                  <Cpu size={24} color="#9CA3AF" />
                  <Text className="text-sm font-semibold text-gray-600 mt-2">No equipment available</Text>
                </View>
              ) : (
                <View className="flex-1 flex-col gap-4 min-h-0">
                  {/* Selected Items */}
                  {selectedEquip.length > 0 && (
                    <View className="max-h-[35%] shrink-0">
                      <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Selected ({selectedEquip.length})</Text>
                      <ScrollView nestedScrollEnabled={true}>
                        <View className="gap-2">
                          {selectedEquip.map((item) => (
                            <View key={item.id} className="flex-row items-center justify-between p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                              <View className="flex-1 flex-row items-center gap-3">
                                <Cpu size={14} color="#6366F1" />
                                <View className="flex-1">
                                  <Text className="text-sm font-semibold text-gray-800" numberOfLines={1}>{item.name}</Text>
                                  <Text className="text-xs text-gray-400">{item.asset_tag || "No Tag"}{item.location ? ` · ${item.location}` : ""}</Text>
                                </View>
                              </View>
                              <TouchableOpacity onPress={() => setSelectedEquip(selectedEquip.filter((i) => i.id !== item.id))}>
                                <X size={16} color="#9CA3AF" />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  )}

                  {/* Catalog Search & List */}
                  <View className="flex-1 min-h-0">
                    <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Add Equipment</Text>
                    <View className="flex-row items-center bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 mb-3 gap-2">
                      <Search size={15} color="#9CA3AF" />
                      <TextInput
                        className="flex-1 text-sm font-medium text-gray-950"
                        placeholder="Search equipment..."
                        value={equipSearch}
                        onChangeText={setEquipSearch}
                      />
                    </View>
                    <ScrollView nestedScrollEnabled={true} className="flex-1">
                      <View className="gap-2">
                        {filteredCatalog.length === 0 ? (
                          <Text className="text-xs text-gray-400 text-center py-4">No matching equipment found.</Text>
                        ) : (
                          filteredCatalog.map((item) => (
                            <TouchableOpacity
                              key={item.id}
                              onPress={() => setSelectedEquip([...selectedEquip, item])}
                              className="flex-row items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100"
                            >
                              <View className="flex-1 flex-row items-center gap-3">
                                <Cpu size={14} color="#9CA3AF" />
                                <View className="flex-1">
                                  <Text className="text-sm font-semibold text-gray-800" numberOfLines={1}>{item.name}</Text>
                                  <Text className="text-xs text-gray-400">{item.asset_tag || "No Tag"}{item.location ? ` · ${item.location}` : ""}</Text>
                                </View>
                              </View>
                              <Plus size={16} color="#9CA3AF" />
                            </TouchableOpacity>
                          ))
                        )}
                      </View>
                    </ScrollView>
                  </View>
                </View>
              )}

              {reqError && (
                <View className="p-3 bg-red-50 border border-red-100 rounded-xl mt-1">
                  <Text className="text-red-500 text-sm font-semibold">{reqError}</Text>
                </View>
              )}
            </View>

            {/* Modal Footer */}
            <View className="flex-row gap-3 px-6 py-4 border-t border-gray-100">
              <TouchableOpacity
                onPress={() => setShowReqModal(false)}
                className="flex-1 py-3.5 border border-gray-200 rounded-xl items-center"
              >
                <Text className="text-gray-600 font-semibold text-sm">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRequestEquipment}
                disabled={submittingReq || selectedEquip.length === 0}
                className="flex-1 py-3.5 bg-indigo-600 rounded-xl items-center disabled:opacity-50"
              >
                {submittingReq ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-semibold text-sm">
                    Submit Request{selectedEquip.length > 0 ? ` (${selectedEquip.length})` : ""}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: COMPLETE PROJECT CONFIRMATION */}
      <Modal
        visible={showCompleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCompleteModal(false)}
      >
        <View className="flex-1 bg-black/40 justify-center items-center p-4">
          <View className="bg-white w-full max-w-md rounded-[24px] p-6 shadow-xl">
            <Text className="text-xl font-bold text-gray-900 mb-2">Mark as Completed</Text>
            <Text className="text-gray-500 text-sm mb-6 leading-relaxed">
              Are you sure you want to mark the project "{project.name}" as completed?
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowCompleteModal(false)}
                className="flex-1 py-3 border border-gray-200 rounded-xl items-center"
              >
                <Text className="text-gray-600 font-semibold text-sm">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCompleteProject}
                disabled={completing}
                className="flex-1 py-3 bg-green-500 rounded-xl items-center disabled:opacity-50"
              >
                {completing ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-semibold text-sm">Complete Project</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
