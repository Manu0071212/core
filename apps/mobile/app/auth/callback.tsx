// apps/mobile/app/auth/callback.tsx

import { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { useLocalSearchParams, useRouter, useRootNavigationState } from "expo-router";
import { saveToken } from "../../lib/api";          // <-- importa só o helper

export default function AuthCallback() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const navigatorReady = rootNavigationState?.key != null;

  useEffect(() => {
  if (!navigatorReady) return;
  if (!token) {
    console.log('[Callback] No token in URL');
    router.replace("/login");
    return;
  }
  console.log('[Callback] Token received:', token.substring(0, 20) + '...');
  saveToken(token)
    .then(() => {
      console.log('[Callback] Token saved successfully');
      router.replace("/(tabs)");
    })
    .catch((err) => {
      console.log('[Callback] Error saving token:', err);
      router.replace("/login");
    });
}, [token, navigatorReady]);

  return (
    <View className="flex-1 items-center justify-center bg-[#f4f5f7]">
      <ActivityIndicator size="large" color="#3A922A" />
      <Text className="text-gray-400 mt-4 text-sm">Authenticating...</Text>
    </View>
  );
}
