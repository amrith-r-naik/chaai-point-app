import { theme } from "@/constants/theme";
import { CreateMenuItemData, MenuItem, menuService } from "@/services/menuService";
import { router } from "expo-router";
import { ArrowLeft, Edit3, Plus, Trash2, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FABCategorySelector } from "../components/FABCategorySelector";

export default function MenuManagementScreen() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [menuForm, setMenuForm] = useState({
    name: "",
    category: "",
    price: "",
  });

  const categories = [
    { name: "All", emoji: "🍽️" },
    { name: "Tea", emoji: "🍵" },
    { name: "Hot Cups", emoji: "☕" },
    { name: "Mojito", emoji: "🥤" },
    { name: "Refreshers", emoji: "🧊" },
    { name: "Milkshakes", emoji: "🥛" },
    { name: "Maggie", emoji: "🍜" },
    { name: "Quick Bites", emoji: "🍪" },
    { name: "Sandwich", emoji: "🥪" },
    { name: "Burger", emoji: "🍔" },
    { name: "Omlette", emoji: "🍳" },
    { name: "Rolls", emoji: "🌯" },
    { name: "Momos", emoji: "🥟" },
    { name: "Cigarettes", emoji: "🚬" },
  ];

  useEffect(() => {
    loadMenuItems();
  }, []);

  useEffect(() => {
    filterItems();
  }, [menuItems, selectedCategory, searchQuery]);

  const loadMenuItems = async () => {
    try {
      setLoading(true);
      const items = await menuService.getAllMenuItems();
      setMenuItems(items);
    } catch (error) {
      console.error("Error loading menu items:", error);
      Alert.alert("Error", "Failed to load menu items");
    } finally {
      setLoading(false);
    }
  };

  const filterItems = () => {
    const categoryFiltered = selectedCategory === "All" ? menuItems : menuItems.filter(item => item.category === selectedCategory);
    const q = searchQuery.trim().toLowerCase();
    const finalFiltered = q
      ? categoryFiltered.filter(item => item.name.toLowerCase().includes(q) || (item.category || '').toLowerCase().includes(q))
      : categoryFiltered;
    setFilteredItems(finalFiltered);
  };

  const handleCategorySelect = (categoryName: string) => {
    setSelectedCategory(categoryName);
  };

  const handleAddMenuItem = () => {
    setEditingItem(null);
    setMenuForm({ name: "", category: "", price: "" });
    setShowMenuModal(true);
  };

  const handleEditMenuItem = (item: MenuItem) => {
    setEditingItem(item);
    setMenuForm({
      name: item.name,
      category: item.category || "",
      price: item.price.toString(),
    });
    setShowMenuModal(true);
  };

  const handleDeleteMenuItem = (item: MenuItem) => {
    Alert.alert(
      "Delete Menu Item",
      `Are you sure you want to delete "${item.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await menuService.deleteMenuItem(item.id);
              await loadMenuItems();
              Alert.alert("Success", "Menu item deleted successfully");
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to delete menu item");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const validateMenuForm = (): string | null => {
    if (!menuForm.name.trim()) return "Item name is required";
    if (!menuForm.category.trim()) return "Category is required";
    if (!menuForm.price.trim()) return "Price is required";

    const price = parseFloat(menuForm.price);
    if (isNaN(price) || price <= 0) return "Price must be a valid positive number";

    return null;
  };

  const handleSaveMenuItem = async () => {
    const validationError = validateMenuForm();
    if (validationError) {
      Alert.alert("Validation Error", validationError);
      return;
    }

    try {
      setLoading(true);
      const itemData: CreateMenuItemData = {
        name: menuForm.name.trim(),
        category: menuForm.category.trim(),
        price: parseFloat(menuForm.price),
      };

      if (editingItem) {
        await menuService.updateMenuItem(editingItem.id, itemData);
        Alert.alert("Success", "Menu item updated successfully");
      } else {
        await menuService.createMenuItem(itemData);
        Alert.alert("Success", "Menu item added successfully");
      }

      setShowMenuModal(false);
      setMenuForm({ name: "", category: "", price: "" });
      setEditingItem(null);
      await loadMenuItems();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save menu item");
    } finally {
      setLoading(false);
    }
  };

  const renderMenuItem = ({ item }: { item: MenuItem }) => (
    <View
      style={{
        backgroundColor: theme.colors.background,
        marginHorizontal: 16,
        marginVertical: 6,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadows.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: theme.colors.text,
              marginBottom: 4,
            }}
          >
            {item.name}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: theme.colors.textSecondary,
              marginBottom: 8,
            }}
          >
            {item.category}
          </Text>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "bold",
              color: theme.colors.primary,
            }}
          >
            ₹{item.price}
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={() => handleEditMenuItem(item)}
            style={{
              backgroundColor: theme.colors.primaryLight,
              padding: 12,
              borderRadius: 8,
            }}
          >
            <Edit3 size={18} color={theme.colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleDeleteMenuItem(item)}
            style={{
              backgroundColor: "#fee2e2",
              padding: 12,
              borderRadius: 8,
            }}
          >
            <Trash2 size={18} color="#dc2626" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: theme.colors.primary,
          paddingTop: 32,
          paddingBottom: 16,
          paddingHorizontal: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              padding: 8,
              marginRight: 8,
              borderRadius: 8,
              backgroundColor: "rgba(255,255,255,0.1)",
            }}
          >
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: "white",
                fontSize: 24,
                fontWeight: "bold",
              }}
            >
              Menu Management
            </Text>
            <Text
              style={{
                color: "rgba(255,255,255,0.8)",
                fontSize: 14,
                marginTop: 2,
              }}
            >
              {filteredItems.length} items {selectedCategory !== "All" ? `in ${selectedCategory}` : "total"}
            </Text>
          </View>
        </View>
      </View>

      {/* Add New Item Button */}
      <View
        style={{
          padding: 16,
          backgroundColor: "white",
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        {/* Search */}
        <TextInput
          placeholder="Search items or categories"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={{
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            backgroundColor: '#f9fafb',
            marginBottom: 12,
            fontSize: 16,
          }}
          placeholderTextColor="#9ca3af"
        />
        <TouchableOpacity
          onPress={handleAddMenuItem}
          style={{
            backgroundColor: theme.colors.primary,
            paddingVertical: 16,
            borderRadius: 12,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
            ...theme.shadows.sm,
          }}
        >
          <Plus size={24} color="white" />
          <Text
            style={{
              color: "white",
              fontSize: 18,
              fontWeight: "600",
            }}
          >
            Add New Item
          </Text>
        </TouchableOpacity>
      </View>

      {/* Menu Items List */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ marginTop: 16, color: theme.colors.textSecondary }}>
            Loading menu items...
          </Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
          <Text style={{ fontSize: 18, color: theme.colors.textSecondary, textAlign: "center" }}>
            {selectedCategory === "All" ? "No menu items found" : `No items in ${selectedCategory} category`}
          </Text>
          <Text style={{ fontSize: 14, color: theme.colors.textSecondary, textAlign: "center", marginTop: 8 }}>
            Add your first menu item to get started
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderMenuItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      {/* FAB Category Selector */}
      <FABCategorySelector
        categories={categories}
        selectedCategory={selectedCategory}
        onCategorySelect={handleCategorySelect}
      />



      {/* Menu Item Form Modal */}
      <Modal
        visible={showMenuModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMenuModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}
          >
            <TouchableOpacity onPress={() => setShowMenuModal(false)}>
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: "600", color: theme.colors.text }}>
              {editingItem ? "Edit Menu Item" : "Add Menu Item"}
            </Text>
            <TouchableOpacity
              onPress={handleSaveMenuItem}
              disabled={loading}
              style={{
                backgroundColor: theme.colors.primary,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 6,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
                  {editingItem ? "Update" : "Add"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1, padding: 16 }}>
            {/* Item Name */}
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: theme.colors.text,
                  marginBottom: 8,
                }}
              >
                Item Name *
              </Text>
              <TextInput
                value={menuForm.name}
                onChangeText={(text) => setMenuForm({ ...menuForm, name: text })}
                placeholder="Enter item name"
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  fontSize: 16,
                  backgroundColor: "white",
                }}
                autoCapitalize="words"
              />
            </View>

            {/* Category */}
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: theme.colors.text,
                  marginBottom: 8,
                }}
              >
                Category *
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {categories.filter(cat => cat.name !== "All").map((category) => (
                  <TouchableOpacity
                    key={category.name}
                    onPress={() => setMenuForm({ ...menuForm, category: category.name })}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: menuForm.category === category.name ? theme.colors.primary : "#f3f4f6",
                      borderWidth: 1,
                      borderColor: menuForm.category === category.name ? theme.colors.primary : "#e5e7eb",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>{category.emoji}</Text>
                    <Text
                      style={{
                        fontSize: 14,
                        color: menuForm.category === category.name ? "white" : theme.colors.text,
                        fontWeight: menuForm.category === category.name ? "600" : "400",
                      }}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Price */}
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: theme.colors.text,
                  marginBottom: 8,
                }}
              >
                Price (₹) *
              </Text>
              <TextInput
                value={menuForm.price}
                onChangeText={(text) => setMenuForm({ ...menuForm, price: text })}
                placeholder="Enter price"
                keyboardType="numeric"
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  fontSize: 16,
                  backgroundColor: "white",
                }}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
