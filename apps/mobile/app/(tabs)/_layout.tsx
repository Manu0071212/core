// apps/mobile/app/(tabs)/_layout.tsx
import { Tabs, Redirect } from "expo-router";
import { useWindowDimensions, View, TouchableOpacity, Text, ActivityIndicator } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Home, Folder, Cpu, Users, BookText, Wrench, LogOut, Package, BarChart3 } from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";

export default function TabsLayout() {
  const { user, role, isLoading, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile  = width < 768;
  const router    = useRouter();
  const pathname  = usePathname();

  if (isLoading) return (
    <View className="flex-1 items-center justify-center bg-[#f4f5f7]">
      <ActivityIndicator size="large" color="#3A922A" />
    </View>
  );

  const isTech = role === "lab_technician";

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
            <NavItem icon={Users}    route="/(tabs)/users"   label="Users" />
            <NavItem icon={BookText} route="/(tabs)/statistics"  label="Statistics" />
            <NavItem icon={BookText} route="/(tabs)/ledger"  label="Ledger" />
            <View className="h-px bg-gray-100 my-3" />
            <NavItem icon={Wrench}   route="/(tabs)/admin"   label="Admin Portal" />
            {/*{isTech && <>
              <NavItem icon={BookText} route="/(tabs)/ledger"  label="Ledger" />
              <View className="h-px bg-gray-100 my-3" />
              <NavItem icon={Wrench}   route="/(tabs)/admin"   label="Admin Portal" />
            </>*/}
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
          <Tabs.Screen name="index"     options={{ title: "Home",      tabBarIcon: ({ color }) => <Home size={22} color={color} /> }} />
          <Tabs.Screen name="projects"  options={{ title: "Projects",  tabBarIcon: ({ color }) => <Folder size={22} color={color} /> }} />
          <Tabs.Screen name="equipment" options={{ title: "Equipment", tabBarIcon: ({ color }) => <Cpu size={22} color={color} /> }} />
          <Tabs.Screen name="users"     options={{ title: "Users",     tabBarIcon: ({ color }) => <Users size={22} color={color} /> }} />
          <Tabs.Screen name="ledger"    options={{ title: "Ledger",     tabBarIcon: ({ color }) => <BookText size={22} color={color} /> }} />
          <Tabs.Screen name="admin"     options={{ title: "Admin",     tabBarIcon: ({ color }) => <Wrench size={22} color={color} /> }} />
        </Tabs>
      </View>
    </View>
  );
}
