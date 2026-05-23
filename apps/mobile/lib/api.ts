import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? "https://deti-makerlab.ua.pt/new/api";

const TOKEN_KEY = "token";

async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  }

  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOKEN_KEY, token);
      document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=31536000`;
    }
    return;
  }

  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_KEY);
      document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
    }
    return;
  }

  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  if (!res.ok) {
    if (res.status === 401) {
      await removeToken();
    }

    const error = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail ?? "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const auth = {
  me: () => request<User>("/auth/me"),
  loginUrl: () => `${API_BASE}/auth/sso/login`,
};

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

export const equipment = {
  catalog: () => request<EquipmentCatalogItem[]>("/equipment/catalog"),
  catalogAvailable: () =>
    request<EquipmentCatalogItem[]>("/equipment/catalog/available"),
  get: (id: number) => request<EquipmentCatalogItem>(`/equipment/${id}`),
  getProjects: (id: number) =>
    request<{ id: number; name: string; status: string; course?: string }[]>(
      `/equipment/${id}/projects`,
    ),
  syncCatalog: () => request("/equipment/catalog/sync", { method: "POST" }),
};

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
  syncSnipeit: () => request("/requisitions/sync-snipeit", { method: "POST" }),
};

export const users = {
  list: () => request<User[]>("/users"),
  get: (id: number) => request<User>(`/users/${id}`),
  me: () => request<User>("/users/me"),
  projects: (id: number) => request<Project[]>(`/users/${id}/projects`),
  requisitions: (id: number) =>
    request<RequisitionDetail[]>(`/users/${id}/requisitions`),
};

export const notifications = {
  list: () => request<Notification[]>("/users/me/notifications"),
  markRead: (id: number) =>
    request<{ ok: boolean }>(`/users/me/notifications/${id}/read`, {
      method: "POST",
    }),
};

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
