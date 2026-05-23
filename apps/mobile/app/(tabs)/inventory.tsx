import { useCallback, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import * as Linking from "expo-linking";
import { Package, ExternalLink } from "lucide-react-native";

const INVENTORY_URL = "https://deti-makerlab.ua.pt/new/snipe-it";

export default function InventoryPage() {
  const openInventory = useCallback(() => {
    Linking.openURL(INVENTORY_URL);
  }, []);

  useEffect(() => {
    openInventory();
  }, [openInventory]);

  return (
    <View className="flex-1 bg-[#f4f5f7] items-center justify-center px-6">
      <View className="w-16 h-16 rounded-2xl bg-indigo-50 items-center justify-center mb-5">
        <Package size={30} color="#3A922A" />
      </View>
      <Text className="text-xl font-bold text-gray-900 mb-2">Inventory</Text>
      <Text className="text-sm text-gray-500 text-center mb-6">
        Opening the Maker Lab inventory system.
      </Text>
      <TouchableOpacity
        onPress={openInventory}
        className="flex-row items-center gap-2 bg-indigo-600 px-5 py-3 rounded-xl"
      >
        <ExternalLink size={16} color="#fff" />
        <Text className="text-white text-sm font-bold">Open Inventory</Text>
      </TouchableOpacity>
    </View>
  );
}
