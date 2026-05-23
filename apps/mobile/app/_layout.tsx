// apps/mobile/app/_layout.tsx
import "../global.css";
import { useEffect } from "react";
import { useRouter, useSegments, Slot } from "expo-router";
import * as Linking from "expo-linking";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { saveToken } from "../lib/api";

function RootNavigator() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Deep links – apenas guarda o token, não valida nem navega
  useEffect(() => {
    const sub = Linking.addEventListener("url", async ({ url }) => {
      const parsed = Linking.parse(url);
      const token = parsed.queryParams?.token;
      if (typeof token === "string") await saveToken(token);
    });

    Linking.getInitialURL().then(async (url) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      const token = parsed.queryParams?.token;
      if (typeof token === "string") await saveToken(token);
    });

    return () => sub.remove();
  }, []);

  // Redirecionamento baseado no estado de autenticação
  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === "login";
    if (user && inAuth) router.replace("/(tabs)");
  }, [user, isLoading, segments]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
