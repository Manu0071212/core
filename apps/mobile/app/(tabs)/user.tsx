// apps/mobile/app/(tabs)/user.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import {
  User as UserIcon,
  LogOut,
  Bell,
  BellOff,
  Check,
  Shield,
  BookOpen,
  Calendar,
  Layers,
  Mail,
  UserCheck
} from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { notifications as notificationsApi, type Notification } from "../../lib/api";

WebBrowser.maybeCompleteAuthSession();

function InfoRow({ label, value, icon: Icon }: { label: string; value?: string | number | null; icon: any }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <View className="flex-row justify-between items-center py-3.5 border-b border-gray-100 last:border-0">
      <View className="flex-row items-center gap-2.5">
        <Icon size={16} color="#9CA3AF" />
        <Text className="text-sm text-gray-500 font-medium">{label}</Text>
      </View>
      <Text className="text-sm text-gray-800 font-semibold">{value}</Text>
    </View>
  );
}

export default function UserProfilePage() {
  const { user, logout, setTokenAndLoad } = useAuth();
  const [notificationsList, setNotificationsList] = useState<Notification[]>([]);
  const [refreshing, setRefreshing]             = useState(false);
  const [authLoading, setAuthLoading]             = useState(false);
  const [authError, setAuthError]                 = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const list = await notificationsApi.list();
      // Sort by created_at descending
      const sorted = [...list].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setNotificationsList(sorted);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);

  useEffect(() => {
    if (user) {
      loadNotifications();
    } else {
      setNotificationsList([]);
    }
  }, [user, loadNotifications]);

  const handleSSO = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      if (Platform.OS === "web") {
        const currentUrl = window.location.origin;
        window.location.href = `https://deti-makerlab.ua.pt/api/auth/sso/login/mobile?web_redirect=${encodeURIComponent(
          currentUrl + "/auth/callback"
        )}`;
      } else {
        const redirectUri = Linking.createURL("auth");
        const result = await WebBrowser.openAuthSessionAsync(
          "https://deti-makerlab.ua.pt/api/auth/sso/login/mobile",
          redirectUri
        );
        if (result.type === "success" && result.url) {
          const parsed = Linking.parse(result.url);
          const token = parsed.queryParams?.token as string | undefined;
          if (token) {
            await setTokenAndLoad(token);
          } else {
            setAuthError("No token received from login callback.");
          }
        } else if (result.type === "cancel") {
          setAuthError("Sign in session cancelled.");
        }
      }
    } catch (e: any) {
      setAuthError(e.message ?? "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationsApi.markRead(id);
      setNotificationsList((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  // 1. STATE: NOT AUTHENTICATED
  if (!user) {
    return (
      <View className="flex-1 bg-[#f4f5f7] justify-center items-center px-6">
        <View className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-sm border border-gray-100 items-center">
          <View className="w-16 h-16 bg-gray-50 rounded-2xl items-center justify-center mb-6">
            <UserIcon size={32} color="#6B7280" />
          </View>

          <Text className="text-2xl font-bold text-gray-900 mb-2">My Profile</Text>
          <Text className="text-sm text-gray-400 text-center mb-6 leading-relaxed">
            Please sign in to access your profile details, equipment requests, and notifications.
          </Text>

          {authError && (
            <View className="w-full bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">
              <Text className="text-red-600 text-sm text-center font-medium">{authError}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleSSO}
            disabled={authLoading}
            className="w-full bg-indigo-600 py-4 rounded-2xl items-center active:bg-indigo-700 shadow-sm"
            style={{ opacity: authLoading ? 0.7 : 1 }}
          >
            {authLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-base">Sign in with UA Account</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 2. STATE: AUTHENTICATED
  const userInitials = user.name ? user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() : "?";

  return (
    <ScrollView
      className="flex-1 bg-[#f4f5f7]"
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3A922A" />}
    >
      {/* Profile Header card */}
      <View className="bg-white rounded-3xl p-6 border border-gray-100 mb-5 shadow-sm items-center">
        <View className="w-20 h-20 bg-indigo-600 rounded-full items-center justify-center mb-4 shadow-inner">
          <Text className="text-white text-3xl font-extrabold">{userInitials}</Text>
        </View>
        <Text className="text-2xl font-bold text-gray-900 mb-1">{user.name}</Text>
        <Text className="text-sm font-medium text-gray-400 capitalize">{user.role.replace("_", " ")}</Text>
      </View>

      {/* User Details card */}
      <View className="bg-white rounded-3xl p-6 border border-gray-100 mb-5 shadow-sm">
        <Text className="text-base font-bold text-gray-900 mb-4">Account Information</Text>
        <InfoRow label="Email" value={user.email} icon={Mail} />
        <InfoRow label="NMec" value={user.nmec} icon={UserCheck} />
        <InfoRow label="Role" value={user.role.replace("_", " ")} icon={Shield} />
        <InfoRow label="Course" value={user.course} icon={BookOpen} />
        <InfoRow label="Academic Year" value={user.academic_year} icon={Calendar} />
      </View>

      {/* Notifications Card */}
      <View className="bg-white rounded-3xl p-6 border border-gray-100 mb-6 shadow-sm">
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-row items-center gap-2">
            <Bell size={18} color="#9CA3AF" />
            <Text className="text-base font-bold text-gray-900">Notifications</Text>
          </View>
          {notificationsList.filter((n) => !n.is_read).length > 0 && (
            <View className="bg-indigo-100 px-2 py-0.5 rounded-full">
              <Text className="text-[10px] font-bold text-indigo-600">
                {notificationsList.filter((n) => !n.is_read).length} New
              </Text>
            </View>
          )}
        </View>

        {notificationsList.length === 0 ? (
          <View className="py-10 items-center justify-center">
            <BellOff size={28} color="#D1D5DB" className="mb-2" />
            <Text className="text-gray-400 text-sm font-medium">You're all caught up!</Text>
          </View>
        ) : (
          <View className="gap-3">
            {notificationsList.map((notif) => (
              <View
                key={notif.id}
                className={`p-4 rounded-2xl border ${
                  notif.is_read ? "bg-gray-50 border-gray-100" : "bg-indigo-50/50 border-indigo-100"
                } flex-row items-start justify-between gap-3`}
              >
                <View className="flex-1">
                  <View className="flex-row items-center gap-1.5 mb-1.5 flex-wrap">
                    {!notif.is_read && <View className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                    <Text className={`text-sm ${notif.is_read ? "font-semibold text-gray-700" : "font-bold text-gray-900"}`}>
                      {notif.title}
                    </Text>
                  </View>
                  <Text className="text-xs text-gray-500 leading-relaxed mb-1">{notif.message}</Text>
                  <Text className="text-[9px] font-bold text-gray-400 uppercase">
                    {new Date(notif.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </Text>
                </View>

                {!notif.is_read && (
                  <TouchableOpacity
                    onPress={() => handleMarkAsRead(notif.id)}
                    className="p-1.5 bg-white border border-gray-200 rounded-lg shadow-sm active:bg-gray-50 shrink-0"
                  >
                    <Check size={14} color="#4F46E5" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Logout button */}
      <TouchableOpacity
        onPress={logout}
        className="bg-red-50 border border-red-200 py-4 rounded-2xl items-center flex-row justify-center gap-2 active:bg-red-100/70"
      >
        <LogOut size={18} color="#EF4444" />
        <Text className="text-red-500 font-bold text-base">Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
