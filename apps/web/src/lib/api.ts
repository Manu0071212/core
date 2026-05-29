// apps/web/src/lib/api.ts

// NEXT_PUBLIC_API_URL is set as a Docker build arg (see apps/web/Dockerfile).
// It must be the FULL path prefix to the API as seen by the browser, including
// any deployment base path. This must match NGINX_API_PATH in docker-compose.yml.
// Examples:
//   Deployment under /new:  NEXT_PUBLIC_API_URL=/new/api
//   Deployment at root:     NEXT_PUBLIC_API_URL=/api
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";


function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      document.cookie = "token=; path=/; max-age=0";
      if (token) {
        window.location.reload();
      }
    }
    const error = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail ?? "Request failed");
  }

  return res.json();
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const auth = {
  me: () => request<User>("/auth/me"),
  loginUrl: () => `${API_BASE}/auth/sso/login`,
};

// ─── Projects ────────────────────────────────────────────────────────────────

export const projects = {
  list: () => request<Project[]>("/projects"),
  get: (id: number) => request<ProjectDetail>(`/projects/${id}`),
  pending: () => request<Project[]>("/projects/pending"),
  create: (data: ProjectCreate) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(data) }),
  updateStatus: (id: number, status: string, rejection_reason?: string) =>
    request<Project>(`/projects/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, rejection_reason }),
    }),
  update: (id: number, data: Partial<ProjectCreate>) =>
    request<ProjectDetail>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  addMember: (projectId: number, userId: number) =>
    request(`/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    }),
  removeMember: (projectId: number, userId: number) =>
    request(`/projects/${projectId}/members/${userId}`, { method: "DELETE" }),
};

// ─── Equipment ───────────────────────────────────────────────────────────────

export const equipment = {
  catalog: () => request<EquipmentCatalogItem[]>("/equipment/catalog"),
  catalogAvailable: () => request<EquipmentCatalogItem[]>("/equipment/catalog/available"),
  get: (id: number) => request<EquipmentCatalogItem>(`/equipment/${id}`),
  getProjects: (id: number) => request<{ id: number; name: string; status: string; course?: string }[]>(`/equipment/${id}/projects`),
  syncCatalog: () => request("/equipment/catalog/sync", { method: "POST" }),
};

// ─── Requisitions ────────────────────────────────────────────────────────────

export const requisitions = {
  list: () => request<Requisition[]>("/requisitions"),
  get: (id: number) => request<Requisition>(`/requisitions/${id}`),
  listByProject: (projectId: number) =>
    request<Requisition[]>(`/projects/${projectId}/requisitions`),
  create: (projectId: number, snipeitAssetIds: number[]) =>
    request<Requisition[]>(`/projects/${projectId}/requisitions`, {
      method: "POST",
      body: JSON.stringify({ items: snipeitAssetIds }),
    }),
  approve: (id: number) =>
    request<Requisition>(`/requisitions/${id}/approve`, { method: "POST" }),
  reject: (id: number, reason: string) =>
    request<Requisition>(`/requisitions/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  syncSnipeit: () =>
    request("/requisitions/sync-snipeit", { method: "POST" }),
};

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = {
  list: () => request<User[]>("/users"),
  get: (id: number) => request<User>(`/users/${id}`),
  me: () => request<User>("/users/me"),
  projects: (id: number) => request<Project[]>(`/users/${id}/projects`),
  requisitions: (id: number) => request<RequisitionDetail[]>(`/users/${id}/requisitions`),
};

// ─── Notifications ───────────────────────────────────────────────────────────────────

export const notifications = {
  list: () => request<Notification[]>("/users/me/notifications"),
  markRead: (id: number) =>
    request<{ ok: boolean }>(`/users/me/notifications/${id}/read`, { method: "POST" }),
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  name: string;
  email: string;
  role: "student" | "professor" | "lab_technician";
  nmec?: string;
  course?: string;
  academic_year?: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  course?: string;
  academic_year?: string;
  group_number?: number;
  created_by: number;
  status: string;
  tags?: string;
  links?: string;
  approved_at?: string;
  created_at: string;
}

export interface ProjectMember {
  user_id: number;
  role: string;
}

export interface ProjectDetail extends Project {
  members: ProjectMember[];
}

export interface ProjectMemberCreate {
  user_id: number;
  role: string;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  course?: string;
  academic_year?: string;
  group_number?: number;
  tags?: string;
  links?: string;
  members: ProjectMemberCreate[];
}

export interface EquipmentCatalogItem {
  id: number;
  model_id?: number;
  model_name?: string;
  name: string;
  asset_tag?: string;
  serial?: string;
  category?: string;
  supplier?: string;
  price?: number;
  status: string;
  snipeit_status?: string;
  status_type?: string;
  location?: string;
  image?: string;
  assigned_to?: string;
  available?: boolean;
  expected_checkin?: string;
}
export interface EquipmentModel {
  id: number;
  model_id?: number;
  name: string;
  snipeit_model_id?: number;
}

export interface Equipment {
  id: number;
  model_id: number;
  snipeit_asset_id?: number;
  name?: string;
  asset_tag?: string;
  serial?: string;
  location?: string;
  status: string;
  condition?: string;
  supplier?: string;
  category?: string;
  price?: string | number;
  image?: string;
  last_synced_at?: string;
}

export interface RequisitionItem {
  equipment_id: number;
}

export interface RequisitionItemRead {
  id: number;
  equipment_id: number;
}

export interface Requisition {
  id: number;
  project_id: number;
  requested_by: number;
  snipeit_asset_id?: number;
  status: string;
  rejection_reason?: string;
  approved_at?: string;
  checked_out_at?: string;
  returned_at?: string;
  expected_checkin?: string;
  created_at: string;
}

export interface RequisitionDetail extends Requisition {
  items: RequisitionItemRead[];
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  reference_type?: string;
  reference_id?: number;
  is_read: boolean;
  created_at: string;
}