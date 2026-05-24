"use client";

// apps/web/src/app/projects/new/page.tsx
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Plus, X, Tag, Link as LinkIcon,
  Users, Cpu, FileText, ShieldCheck, Search,
} from "lucide-react";
import Header from "@/app/components/header";
import {
  auth,
  projects as projectsApi,
  requisitions as requisitionsApi,
  users as usersApi,
  equipment as equipmentApi,
  type User,
  type EquipmentCatalogItem,
} from "@/lib/api";
import { useTranslation } from "react-i18next";

const MEMBER_ROLES = ["member", "observer", "advisor"];

interface MemberEntry { user: User; role: string; }
interface EquipmentEntry { model: EquipmentCatalogItem; }

function PeoplePicker({
  label, placeholder, users, onAdd, accent = "indigo",
}: {
  label: string;
  placeholder: string;
  users: User[];
  onAdd: (user: User) => void;
  accent?: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
      <div className="relative mb-2">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 transition-colors"
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {search && (
        <div className="flex flex-col gap-1 max-h-44 overflow-y-auto border border-gray-100 rounded-xl bg-white shadow-sm">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">{placeholder === "Search available equipment..." ? "No results." : "No results."}</p>
          ) : filtered.map((u) => (
            <button
              key={u.id}
              onClick={() => { onAdd(u); setSearch(""); }}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
            >
              <div className={`w-8 h-8 rounded-full bg-${accent}-100 text-${accent}-600 flex items-center justify-center text-sm font-bold shrink-0`}>
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-800 truncate">{u.name}</div>
                <div className="text-xs text-gray-400 truncate">{u.email}</div>
              </div>
              <Plus size={14} className="text-gray-400 shrink-0 ml-auto" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewProjectPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [currentUser, setCurrentUser]     = useState<User | null>(null);
  const [supervisors, setSupervisors]     = useState<User[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [catalog, setCatalog]             = useState<EquipmentCatalogItem[]>([]);
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const [name, setName]               = useState("");
  const [course, setCourse]           = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [groupNumber, setGroupNumber] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags]               = useState<string[]>([]);
  const [tagInput, setTagInput]       = useState("");
  const [links, setLinks]             = useState<string[]>([]);
  const [linkInput, setLinkInput]     = useState("");
  const [members, setMembers]         = useState<MemberEntry[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<EquipmentEntry[]>([]);
  const [equipSearch, setEquipSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [me, allUsers, cat] = await Promise.all([
          auth.me(),
          usersApi.list(),
          equipmentApi.catalogAvailable(),
        ]);
        if (cancelled) return;
        setCurrentUser(me);
        setSupervisors(allUsers.filter((u) => u.role === "professor"));
        setAvailableUsers(allUsers.filter((u) => u.role === "student" && u.id !== me.id));
        setCatalog(cat);
      } catch (err: any) {
        if (cancelled) return;
        if (err?.message?.includes("401") || err?.message?.includes("Unauthorized")) {
          router.push("/");
        } else {
          setError(err?.message ?? "Failed to load page data.");
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [router]);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const addLink = () => {
    const l = linkInput.trim();
    if (l && !links.includes(l)) setLinks([...links, l]);
    setLinkInput("");
  };

  const addSupervisor = (user: User) => {
    if (members.find((m) => m.user.id === user.id)) return;
    setMembers([...members, { user, role: "supervisor" }]);
  };

  const addMember = (user: User) => {
    if (members.find((m) => m.user.id === user.id)) return;
    setMembers([...members, { user, role: "member" }]);
  };

  const updateMemberRole = (userId: number, role: string) =>
    setMembers(members.map((m) => (m.user.id === userId ? { ...m, role } : m)));

  const addEquipment = (model: EquipmentCatalogItem) => {
    if (equipmentItems.find((e) => e.model.id === model.id)) return;
    setEquipmentItems([...equipmentItems, { model }]);
    setEquipSearch("");
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError("Project name is required."); return; }
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
      router.push(`/projects/${project.id}`);
    } catch (err: any) {
      setError(err.message ?? "Failed to create project.");
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-gray-400 placeholder:font-normal";

  const supervisorList  = members.filter((m) => m.role === "supervisor");
  const memberList      = members.filter((m) => m.role !== "supervisor");
  const filteredEquip   = catalog
    .filter((m) => !equipmentItems.find((e) => e.model.id === m.id))
    .filter((m) => !equipSearch || m.name.toLowerCase().includes(equipSearch.toLowerCase()));

  return (
    <main className="flex-1 bg-[#f4f5f7] px-4 sm:px-8 py-6 min-h-screen font-sans text-gray-900">
      <Header />
      <div className="w-full pb-12">

        <Link
          href="/projects"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 mb-6 text-sm font-semibold text-gray-600 shadow-sm transition-colors"
        >
          <ArrowLeft size={15} /> {t("projectsPage.new.back")}
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-1">{t("projectsPage.new.title")}</h1>
          <p className="text-gray-500 text-sm">{t("projectsPage.new.subtitle")}</p>
        </div>

        <div className="flex flex-col gap-5">

          <section className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><FileText size={17} /></div>
              <h2 className="font-bold text-gray-900">{t("projectsPage.new.projectInformation")}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">
                  {t("projectsPage.new.projectName")} <span className="text-red-400">*</span>
                </label>
                <input className={inputClass} placeholder={t("projectsPage.new.projectNamePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">{t("projectsPage.new.course")}</label>
                <input className={inputClass} placeholder={t("projectsPage.new.coursePlaceholder")} value={course} onChange={(e) => setCourse(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">{t("projectsPage.new.academicYear")}</label>
                <input className={inputClass} placeholder={t("projectsPage.new.academicYearPlaceholder")} value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">{t("projectsPage.new.groupNumber")}</label>
                <input type="number" className={inputClass} placeholder={t("projectsPage.new.groupNumberPlaceholder")} value={groupNumber} onChange={(e) => setGroupNumber(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">{t("projectsPage.new.description")}</label>
                <textarea rows={3} className={`${inputClass} resize-none`} placeholder={t("projectsPage.new.descriptionPlaceholder")} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg"><ShieldCheck size={17} /></div>
              <h2 className="font-bold text-gray-900">{t("projectsPage.new.supervisors")} <span className="text-red-400">*</span></h2>
            </div>

            {supervisorList.length > 0 && (
              <div className="flex flex-col gap-2 mb-4">
                {supervisorList.map((m) => (
                  <div key={m.user.id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-200 text-amber-700 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                        {m.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-gray-800 truncate">{m.user.name}</div>
                        <div className="text-xs text-gray-400 truncate">{m.user.email}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setMembers(members.filter((x) => x.user.id !== m.user.id))}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors shrink-0 ml-2"
                    >
                      <X size={14} className="text-gray-400 hover:text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <PeoplePicker
              label={t("projectsPage.new.addSupervisor")}
              placeholder={t("projectsPage.new.searchSupervisorPlaceholder")}
              users={supervisors.filter((s) => !members.find((m) => m.user.id === s.id))}
              onAdd={addSupervisor}
              accent="amber"
            />
          </section>

          <section className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-1.5 bg-teal-50 text-teal-600 rounded-lg"><Users size={17} /></div>
              <h2 className="font-bold text-gray-900">{t("projectsPage.new.teamMembers")}</h2>
            </div>

            <div className="flex flex-col gap-2 mb-4">
              {currentUser && (
                <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-200 text-indigo-700 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-gray-800 truncate">
                        {currentUser.name} <span className="text-gray-400 text-xs font-normal">{t("projectsPage.new.you")}</span>
                      </div>
                      <div className="text-xs text-gray-400 truncate">{currentUser.email}</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase rounded-full shrink-0">{t("projectsPage.new.leader")}</span>
                </div>
              )}

              {memberList.map((m) => (
                <div key={m.user.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-xl">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                      {m.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-gray-800 truncate">{m.user.name}</div>
                      <div className="text-xs text-gray-400 truncate">{m.user.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <select
                      className="text-xs font-bold text-gray-600 uppercase bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none cursor-pointer"
                      value={m.role}
                      onChange={(e) => updateMemberRole(m.user.id, e.target.value)}
                    >
                      {MEMBER_ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setMembers(members.filter((x) => x.user.id !== m.user.id))}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X size={14} className="text-gray-400 hover:text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <PeoplePicker
              label={t("projectsPage.new.addMember")}
              placeholder={t("projectsPage.new.searchMemberPlaceholder")}
              users={availableUsers.filter((u) => !members.find((m) => m.user.id === u.id))}
              onAdd={addMember}
              accent="teal"
            />
          </section>

          <section className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Cpu size={17} /></div>
              <h2 className="font-bold text-gray-900">{t("projectsPage.new.equipmentRequest")}</h2>
              <span className="text-xs text-gray-400 font-medium ml-1">{t("projectsPage.new.optional")}</span>
            </div>

            {equipmentItems.length > 0 && (
              <div className="flex flex-col gap-2 mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{t("projectsPage.new.selected", { count: equipmentItems.length })}</p>
                {equipmentItems.map((e) => (
                  <div key={e.model.id} className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-1.5 bg-white rounded-lg border border-emerald-100 shrink-0">
                        <Cpu size={13} className="text-emerald-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-800 break-words">{e.model.name}</div>
                        <div className="text-xs text-gray-400 break-words mt-0.5">
                          {e.model.asset_tag ? `${e.model.asset_tag} · ` : ""}
                          {e.model.location ?? t("projectsPage.new.noLocation")}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setEquipmentItems(equipmentItems.filter((x) => x.model.id !== e.model.id))}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors shrink-0 ml-2"
                    >
                      <X size={14} className="text-gray-400 hover:text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{t("projectsPage.new.addEquipment")}</p>
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 transition-colors"
                  placeholder={t("projectsPage.new.searchEquipmentPlaceholder")}
                  value={equipSearch}
                  onChange={(e) => setEquipSearch(e.target.value)}
                />
              </div>

              {equipSearch && (
                <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto border border-gray-100 rounded-xl bg-white shadow-sm">
                  {filteredEquip.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">No results.</p>
                  ) : filteredEquip.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => addEquipment(m)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="p-1.5 bg-gray-50 rounded-lg border border-gray-100 shrink-0">
                        <Cpu size={13} className="text-gray-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-800 break-words">{m.name}</div>
                        <div className="text-xs text-gray-400 break-words mt-0.5">
                          {m.asset_tag ? `${m.asset_tag} · ` : ""}
                          {m.location ?? t("projectsPage.new.noLocation")}
                        </div>
                      </div>
                      <Plus size={14} className="text-gray-400 shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {catalog.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-3 bg-gray-50 rounded-xl border border-gray-100">
                  {t("projectsPage.new.noEquipmentAvailable")}
                </p>
              )}
            </div>
          </section>

          <section className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Tag size={17} /></div>
              <h2 className="font-bold text-gray-900">{t("projectsPage.new.tags")}</h2>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                className={`${inputClass} flex-1`}
                placeholder={t("projectsPage.new.tagsPlaceholder")}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              />
              <button onClick={addTag} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-gray-700 transition-colors">
                <Plus size={16} />
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span key={t} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-100 text-gray-600 text-xs font-medium rounded-full">
                    {t}
                    <button onClick={() => setTags(tags.filter((x) => x !== t))}>
                      <X size={11} className="hover:text-red-400" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg"><LinkIcon size={17} /></div>
              <h2 className="font-bold text-gray-900">{t("projectsPage.new.links")}</h2>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                className={`${inputClass} flex-1`}
                placeholder={t("projectsPage.new.linksPlaceholder")}
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLink())}
              />
              <button onClick={addLink} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-gray-700 transition-colors">
                <Plus size={16} />
              </button>
            </div>
            {links.length > 0 && (
              <div className="flex flex-col gap-2">
                {links.map((l) => (
                  <div key={l} className="flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                    <a href={l} target="_blank" rel="noreferrer" className="text-sm text-indigo-500 hover:underline truncate max-w-[90%]">
                      {l.replace(/^https?:\/\//, "")}
                    </a>
                    <button onClick={() => setLinks(links.filter((x) => x !== l))}>
                      <X size={13} className="text-gray-300 hover:text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {error && (
            <div className="px-5 py-3.5 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <Link
              href="/projects"
              className="px-6 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors text-center"
            >
              {t("projectsPage.new.cancel")}
            </Link>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {submitting ? t("projectsPage.new.submitting") : t("projectsPage.new.submit")}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}