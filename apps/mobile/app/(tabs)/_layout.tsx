// apps/mobile/app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { useWindowDimensions, View, TouchableOpacity, Text, ActivityIndicator } from "react-native";
import * as Linking from "expo-linking";
import { useRouter, usePathname } from "expo-router";
import { Home, Folder, Cpu, BookText, LogOut, User as UserIcon } from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";

export default function TabsLayout() {
  const { isLoading, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile  = width < 768;
  const router    = useRouter();
  const pathname  = usePathname();

  if (isLoading) return (
    <View className="flex-1 items-center justify-center bg-[#f4f5f7]">
      <ActivityIndicator size="large" color="#3A922A" />
    </View>
  );

  const NavItem = ({ icon: Icon, route, label }: { icon: any; route: string; label: string }) => {
    const isActive = pathname === route || (route === "/(tabs)" && pathname === "/");
    return (
      <TouchableOpacity
        onPress={() => router.push(route as any)}
        className={`flex-row items-center gap-3 px-4 py-3 rounded-xl mb-1 ${isActive ? "bg-indigo-600" : "hover:bg-gray-50"}`}
      >
        <Icon size={20} color={isActive ? "#fff" : "#6B7280"} />
        <Text className={`text-sm font-medium ${isActive ? "text-white" : "text-gray-500"}`}>{label}</Text>
      </TouchableOpacity>
    );
  };



  return (
    <View className="flex-1 flex-row bg-[#f4f5f7]">
      {/* Sidebar — só desktop/tablet */}
      {!isMobile && (
        <View className="w-56 bg-white border-r border-gray-100 flex flex-col py-6 px-3 h-full">
          <View className="flex-row items-center gap-2 px-4 mb-6">
            <View className="w-8 h-8 bg-indigo-600 rounded-xl items-center justify-center">
              <Text className="text-white font-black text-xs">DM</Text>
            </View>
            <Text className="font-bold text-indigo-600 text-sm">DETI Maker Lab</Text>
          </View>

          <View className="flex-1">
            <NavItem icon={Home}    route="/(tabs)"           label="Dashboard" />
            <NavItem icon={Folder}  route="/(tabs)/projects"  label="Projects" />
            <NavItem icon={Cpu}     route="/(tabs)/equipment" label="Equipment" />
            <NavItem icon={BookText} route="/(tabs)/ledger"  label="Ledger" />
            <NavItem icon={UserIcon} route="/(tabs)/user"      label="Profile" />
          </View>

          <TouchableOpacity
            onPress={logout}
            className="flex-row items-center gap-3 px-4 py-3 rounded-xl"
          >
            <LogOut size={18} color="#EF4444" />
            <Text className="text-red-500 text-sm font-medium">Logout</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tabs area */}
      <View className="flex-1">
        <Tabs screenOptions={{
          headerShown: isMobile,
          headerTitle: "DETI Maker Lab",
          headerStyle: { backgroundColor: "#fff" },
          headerTitleStyle: { fontWeight: "bold", color: "#111827" },
          tabBarStyle: isMobile ? { borderTopColor: "#E5E7EB" } : { display: "none" },
          tabBarActiveTintColor: "#3A922A",
          tabBarInactiveTintColor: "#9CA3AF",
        }}>
          <Tabs.Screen name="index"     options={{ title: "Dashboard", tabBarIcon: ({ color }) => <Home size={22} color={color} /> }} />
          <Tabs.Screen name="projects"  options={{ title: "Projects",  tabBarIcon: ({ color }) => <Folder size={22} color={color} /> }} />
          <Tabs.Screen name="equipment" options={{ title: "Equipment", tabBarIcon: ({ color }) => <Cpu size={22} color={color} /> }} />
          <Tabs.Screen name="ledger"    options={{ title: "Ledger",     tabBarIcon: ({ color }) => <BookText size={22} color={color} /> }} />
          <Tabs.Screen name="user"      options={{ title: "Profile",    tabBarIcon: ({ color }) => <UserIcon size={22} color={color} /> }} />

          <Tabs.Screen name="admin" options={{ href: null }} />
          <Tabs.Screen name="statistics" options={{ href: null }} />
          <Tabs.Screen name="users" options={{ href: null }} />
          <Tabs.Screen name="item/[id]" options={{ href: null }} />
          <Tabs.Screen name="users/[id]" options={{ href: null }} />
          <Tabs.Screen name="projects/[id]" options={{ href: null }} />
          <Tabs.Screen name="projects/new" options={{ href: null }} />
          <Tabs.Screen name="projects/my-projects" options={{ href: null }} />
        </Tabs>
      </View>
    </View>
  );
}
