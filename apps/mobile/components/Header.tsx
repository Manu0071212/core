import React, { useEffect, useState } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Modal, 
  ScrollView, 
  Pressable, 
  ActivityIndicator, 
  Platform 
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

// Importações do teu projeto
import { notifications as notificationsApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";

// Essencial para o redirecionamento de autenticação em ambiente Web
WebBrowser.maybeCompleteAuthSession();

export default function Header() {
  const { user, setTokenAndLoad } = useAuth();
  const router = useRouter();

  // Estados
  const [notifs, setNotifs] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadedNotifs, setLoadedNotifs] = useState(false);

  // Carregar notificações quando o user está logado
  useEffect(() => {
    if (user) {
      notificationsApi.list()
        .then(setNotifs)
        .catch((err) => console.error("[Header] Notif Error:", err))
        .finally(() => setLoadedNotifs(true));
    } else {
      setLoadedNotifs(true);
    }
  }, [user]);

  const unreadCount = notifs.filter((n) => !n.is_read).length;

  // Lógica de Login idêntica ao login.tsx
  const handleSSO = async () => {
    setLoading(true);
    try {
      if (Platform.OS === "web") {
        const currentUrl = window.location.origin;
        window.location.href = `https://deti-makerlab.ua.pt/api/auth/sso/login/mobile?web_redirect=${encodeURIComponent(
          currentUrl + "/auth/callback"
        )}`;
      } else {
        // Nativo — usa deep link (ex: detimakerlab://auth)
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
            // Opcional: Garante que a UI atualiza na rota correta
            router.replace("/");
          }
        }
      }
    } catch (e) {
      console.error("[Header] Login Error:", e);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id: number) => {
    try {
      await notificationsApi.markRead(id);
      setNotifs((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error("[Header] MarkRead Error:", err);
    }
  };

  if (!loadedNotifs && user) return <View className="h-10" />;

  return (
    <View className="flex-row justify-end items-center gap-4 px-5 py-4 bg-[#f4f5f7]">
      {user ? (
        <>
          {/* Botão de Notificações */}
          <TouchableOpacity
            onPress={() => setShowNotifs(true)}
            className="relative p-2"
          >
            <Feather name="bell" size={24} color="#9ca3af" />
            {unreadCount > 0 && (
              <View className="absolute top-1 right-1 w-4 h-4 bg-purple-500 rounded-full items-center justify-center border-2 border-[#f4f5f7]">
                <Text className="text-white text-[8px] font-bold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Botão de Perfil */}
          <TouchableOpacity 
            onPress={() => user && router.push(`/(tabs)/users/${user.id}` as any)}
            className="p-2"
          >
            <Feather name="user" size={26} color="#9ca3af" />
          </TouchableOpacity>

          {/* Modal de Listagem de Notificações */}
          <Modal
            visible={showNotifs}
            transparent
            animationType="fade"
            onRequestClose={() => setShowNotifs(false)}
          >
            <Pressable
              className="flex-1 bg-black/30 justify-center items-center px-6"
              onPress={() => setShowNotifs(false)}
            >
              <Pressable className="bg-white w-full max-h-[70%] rounded-[32px] shadow-2xl overflow-hidden">
                <View className="flex-row justify-between items-center px-6 py-5 border-b border-gray-50">
                  <Text className="font-bold text-gray-900 text-lg">Notifications</Text>
                  <TouchableOpacity onPress={() => setShowNotifs(false)}>
                    <Feather name="x" size={22} color="#9ca3af" />
                  </TouchableOpacity>
                </View>

                <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
                  {notifs.length === 0 ? (
                    <View className="py-12 items-center">
                      <Feather name="inbox" size={40} color="#e5e7eb" />
                      <Text className="text-gray-400 mt-2 font-medium">All caught up!</Text>
                    </View>
                  ) : (
                    notifs.map((n) => (
                      <TouchableOpacity
                        key={n.id}
                        onPress={() => markRead(n.id)}
                        className={`p-4 mb-3 rounded-2xl border ${
                          n.is_read 
                            ? "bg-white border-gray-100" 
                            : "bg-purple-50 border-purple-100 shadow-sm shadow-purple-100"
                        }`}
                      >
                        <View className="flex-row justify-between items-start">
                          <View className="flex-1">
                            <Text className={`text-sm font-bold mb-1 ${n.is_read ? "text-gray-700" : "text-purple-900"}`}>
                              {n.title}
                            </Text>
                            <Text className="text-xs text-gray-500 leading-4">{n.message}</Text>
                          </View>
                          {!n.is_read && <View className="w-2 h-2 bg-purple-500 rounded-full ml-2 mt-1" />}
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>
        </>
      ) : (
        /* Botão de Login com o mesmo comportamento do login.tsx */
        <TouchableOpacity
          onPress={handleSSO}
          disabled={loading}
          className="bg-indigo-600 px-7 py-2.5 rounded-full shadow-sm shadow-indigo-200 active:bg-indigo-700"
          style={{ opacity: loading ? 0.7 : 1 }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white font-bold text-sm">Login</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
