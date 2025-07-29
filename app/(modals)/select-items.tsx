// app/(modals)/select-items.tsx
import { use$ } from "@legendapp/state/react";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft, Minus, Plus, Search, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "../../constants/theme";
import { MenuItem, orderService } from "../../services/orderService";
import { orderState } from "../../state/orderState";

function ItemCard({
  item,
  onSelect,
  selectedQuantity,
}: {
  item: MenuItem;
  onSelect: (item: MenuItem, quantity: number) => void;
  selectedQuantity: number;
}) {
  const [quantity, setQuantity] = useState(selectedQuantity || 1);

  const handleSelect = () => {
    onSelect(item, quantity);
  };

  const incrementQuantity = () => {
    const newQuantity = quantity + 1;
    setQuantity(newQuantity);
    if (selectedQuantity > 0) {
      onSelect(item, newQuantity);
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      const newQuantity = quantity - 1;
      setQuantity(newQuantity);
      if (selectedQuantity > 0) {
        onSelect(item, newQuantity);
      }
    } else if (selectedQuantity > 0) {
      // Remove item when quantity becomes 0
      onSelect(item, 0);
    }
  };

  const getCategoryEmoji = (category: string | null) => {
    if (!category) return "🍽️";
    switch (category.toLowerCase()) {
      case "tea":
        return "🍵";
      case "coffee":
        return "☕";
      case "pasta":
        return "🍝";
      case "snacks":
        return "🍟";
      case "dessert":
        return "🍰";
      case "beverage":
        return "🥤";
      default:
        return "🍽️";
    }
  };

  const getCategoryColor = (category: string | null) => {
    if (!category) return { bg: "#f3f4f6", text: "#6b7280" };
    switch (category.toLowerCase()) {
      case "tea":
      case "coffee":
      case "beverage":
        return { bg: "#fef3c7", text: "#d97706" };
      case "pasta":
      case "food":
        return { bg: "#fce7f3", text: "#be185d" };
      case "snacks":
        return { bg: "#fef2e2", text: "#ea580c" };
      case "dessert":
        return { bg: "#f3e8ff", text: "#9333ea" };
      default:
        return { bg: "#f3f4f6", text: "#6b7280" };
    }
  };

  const categoryStyle = getCategoryColor(item.category);

  return (
    <View
      style={{
        backgroundColor: "white",
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: selectedQuantity > 0 ? 2 : 1,
        borderColor: selectedQuantity > 0 ? theme.colors.primary : "#e5e7eb",
      }}
    >
      <View style={{ flexDirection: "row" }}>
        {/* Item Image Placeholder */}
        <View
          style={{
            width: 80,
            height: 80,
            backgroundColor: categoryStyle.bg,
            borderRadius: 12,
            justifyContent: "center",
            alignItems: "center",
            marginRight: 16,
            position: "relative",
          }}
        >
          <Text style={{ fontSize: 32 }}>
            {getCategoryEmoji(item.category)}
          </Text>

          {/* Category Badge */}
          {item.category && (
            <View
              style={{
                position: "absolute",
                bottom: -6,
                backgroundColor: categoryStyle.text,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "white", fontSize: 10, fontWeight: "600" }}>
                {item.category.toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Item Details */}
        <View style={{ flex: 1, justifyContent: "space-between" }}>
          <View>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: theme.colors.text,
                marginBottom: 4,
              }}
            >
              {item.name}
            </Text>

            <Text
              style={{
                fontSize: 20,
                fontWeight: "800",
                color: theme.colors.primary,
                marginBottom: 12,
              }}
            >
              ₹{item.price}
            </Text>
          </View>

          {/* Quantity Controls */}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {selectedQuantity > 0 ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: theme.colors.primaryLight,
                  borderRadius: 25,
                  paddingHorizontal: 4,
                  paddingVertical: 4,
                }}
              >
                <TouchableOpacity
                  onPress={decrementQuantity}
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: theme.colors.primary,
                    borderRadius: 18,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                  activeOpacity={0.7}
                >
                  <Minus size={18} color="white" />
                </TouchableOpacity>

                <Text
                  style={{
                    marginHorizontal: 16,
                    fontSize: 18,
                    fontWeight: "700",
                    color: theme.colors.primary,
                    minWidth: 24,
                    textAlign: "center",
                  }}
                >
                  {quantity}
                </Text>

                <TouchableOpacity
                  onPress={incrementQuantity}
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: theme.colors.primary,
                    borderRadius: 18,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                  activeOpacity={0.7}
                >
                  <Plus size={18} color="white" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleSelect}
                style={{
                  backgroundColor: theme.colors.primary,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 25,
                  flexDirection: "row",
                  alignItems: "center",
                  shadowColor: theme.colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}
                activeOpacity={0.8}
              >
                <Plus size={18} color="white" style={{ marginRight: 6 }} />
                <Text
                  style={{ color: "white", fontWeight: "600", fontSize: 16 }}
                >
                  Add
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

function SelectedItemChip({
  selectedItem,
  onQuantityChange,
  onPress,
}: {
  selectedItem: { item: MenuItem; quantity: number };
  onQuantityChange: (item: MenuItem, quantity: number) => void;
  onPress: () => void;
}) {
  const { item, quantity } = selectedItem;

  const getCategoryEmoji = (category: string | null) => {
    if (!category) return "🍽️";
    switch (category.toLowerCase()) {
      case "tea":
        return "🍵";
      case "coffee":
        return "☕";
      case "pasta":
        return "🍝";
      case "snacks":
        return "🍟";
      case "dessert":
        return "🍰";
      case "beverage":
        return "🥤";
      default:
        return "🍽️";
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: "white",
        borderRadius: 12,
        padding: 12,
        marginRight: 12,
        minWidth: 80,
        borderWidth: 2,
        borderColor: theme.colors.border,
        overflow: "hidden",
      }}
      activeOpacity={0.8}
    >
      <View style={{ alignItems: "center" }}>
        {/* Item Icon */}
        <Text style={{ fontSize: 24, marginBottom: 4 }}>
          {getCategoryEmoji(item.category)}
        </Text>

        {/* Item Name */}
        <Text
          style={{
            fontSize: 12,
            fontWeight: "600",
            color: theme.colors.text,
            textAlign: "center",
            marginBottom: 6,
          }}
          numberOfLines={1}
        >
          {item.name}
        </Text>

        {/* Quantity Badge */}
        <View
          style={{
            backgroundColor: theme.colors.primary,
            borderBottomLeftRadius: 4,
            height: 24,
            width: 24,
            justifyContent: "center",
            alignItems: "center",
            position: "absolute",
            top: -13,
            right: -13,
          }}
        >
          <Text
            style={{
              color: "white",
              fontWeight: "600",
              fontSize: 12,
            }}
          >
            {quantity}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SelectItemsScreen() {
  const router = useRouter();
  const orderStateData = use$(orderState);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const flatListRef = React.useRef<FlatList>(null);

  useEffect(() => {
    loadMenuItems();
  }, []);

  const loadMenuItems = async () => {
    try {
      const items = await orderService.getHardcodedMenuItems();
      setMenuItems(items);
    } catch (error) {
      console.error("Error loading menu items:", error);
    }
  };

  const handleSelectItem = (item: MenuItem, quantity: number) => {
    const currentItems = orderStateData.selectedItems;
    const existingIndex = currentItems.findIndex(
      (selectedItem) => selectedItem.item.id === item.id
    );

    if (quantity === 0) {
      // Remove item
      if (existingIndex !== -1) {
        const newItems = [...currentItems];
        newItems.splice(existingIndex, 1);
        orderState.selectedItems.set(newItems);
      }
    } else {
      // Add or update item
      if (existingIndex !== -1) {
        const newItems = [...currentItems];
        newItems[existingIndex] = { item, quantity };
        orderState.selectedItems.set(newItems);
      } else {
        orderState.selectedItems.set([...currentItems, { item, quantity }]);
      }
    }
  };

  const getSelectedQuantity = (itemId: string): number => {
    const selectedItem = orderStateData.selectedItems.find(
      (si) => si.item.id === itemId
    );
    return selectedItem ? selectedItem.quantity : 0;
  };

  const scrollToItem = (itemId: string) => {
    const itemIndex = filteredItems.findIndex((item) => item.id === itemId);
    if (itemIndex !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index: itemIndex,
        animated: true,
        viewPosition: 0.5,
      });
    }
  };

  const categories = ["All", "Tea", "Coffee", "Pasta", "Snacks", "Dessert"];

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalSelectedItems = orderStateData.selectedItems.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const totalAmount = orderStateData.selectedItems.reduce(
    (total, selectedItem) =>
      total + selectedItem.item.price * selectedItem.quantity,
    0
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <Stack.Screen
        options={{
          title: "Select Items",
          headerStyle: {
            backgroundColor: "white",
          },
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: "600",
            color: theme.colors.text,
          },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                padding: 8,
                marginLeft: -8,
                borderRadius: 8,
              }}
            >
              <ArrowLeft size={24} color={theme.colors.text} />
            </TouchableOpacity>
          ),
          // TODO:CHANGE THIS TO DONE BUTTON
          headerRight: () => (
            <TouchableOpacity
              onPress={() => {
                router.back();
              }}
              style={{
                padding: 8,
                marginRight: -8,
                borderRadius: 8,
                backgroundColor: theme.colors.primary,
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontWeight: "600",
                }}
              >
                Done
              </Text>
            </TouchableOpacity>
          ),
          headerShadowVisible: true,
        }}
      />

      <View style={{ flex: 1 }}>
        {/* Search and Categories */}
        <View
          style={{
            backgroundColor: "white",
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          {/* Search Bar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#f3f4f6",
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              marginBottom: 16,
            }}
          >
            <Search size={20} color={theme.colors.textSecondary} />
            <TextInput
              placeholder="Search menu items..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                flex: 1,
                fontSize: 16,
                color: theme.colors.text,
                marginLeft: 12,
              }}
              placeholderTextColor={theme.colors.textSecondary}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                activeOpacity={0.7}
              >
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Tabs */}
          <View style={{ flexDirection: "row" }}>
            <FlatList
              data={categories}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item}
              renderItem={({ item: category }) => (
                <TouchableOpacity
                  onPress={() => setSelectedCategory(category)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 20,
                    marginRight: 8,
                    backgroundColor:
                      selectedCategory === category
                        ? theme.colors.primary
                        : "transparent",
                    borderWidth: 1,
                    borderColor:
                      selectedCategory === category
                        ? theme.colors.primary
                        : "#e5e7eb",
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontWeight: "600",
                      color:
                        selectedCategory === category
                          ? "white"
                          : theme.colors.textSecondary,
                    }}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={{ paddingRight: 16 }}
            />
          </View>
        </View>

        {/* Selected Items Horizontal List */}
        {orderStateData.selectedItems.length > 0 && (
          <View
            style={{
              backgroundColor: "white",
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: "#f3f4f6",
            }}
          >
            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: theme.colors.text,
                }}
              >
                Selected Items ({totalSelectedItems})
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: theme.colors.textSecondary,
                }}
              >
                Tap to find item in menu
              </Text>
            </View>

            <FlatList
              data={orderStateData.selectedItems}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.item.id}
              renderItem={({ item: selectedItem }) => (
                <SelectedItemChip
                  selectedItem={selectedItem}
                  onQuantityChange={handleSelectItem}
                  onPress={() => scrollToItem(selectedItem.item.id)}
                />
              )}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            />
          </View>
        )}

        {/* Items List */}
        <View style={{ flex: 1 }}>
          {filteredItems.length === 0 ? (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                paddingHorizontal: 32,
              }}
            >
              <Text style={{ fontSize: 64, marginBottom: 16 }}>🍽️</Text>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "600",
                  color: theme.colors.text,
                  marginBottom: 8,
                  textAlign: "center",
                }}
              >
                {searchQuery ? "No items found" : "No items available"}
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  color: theme.colors.textSecondary,
                  textAlign: "center",
                  lineHeight: 24,
                }}
              >
                {searchQuery
                  ? `Try searching for something else or check a different category.`
                  : "Our menu items will appear here once they're loaded."}
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={filteredItems}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ItemCard
                  item={item}
                  onSelect={handleSelectItem}
                  selectedQuantity={getSelectedQuantity(item.id)}
                />
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 32,
              }}
              onScrollToIndexFailed={(info) => {
                // Handle scroll failure gracefully
                const wait = new Promise((resolve) => setTimeout(resolve, 500));
                wait.then(() => {
                  flatListRef.current?.scrollToIndex({
                    index: info.index,
                    animated: true,
                    viewPosition: 0.5,
                  });
                });
              }}
            />
          )}
        </View>
      </View>
    </View>
  );
}
