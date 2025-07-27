// TODO: Improve the ux of this page

// components/SelectItemsModal.tsx
import { use$ } from "@legendapp/state/react";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MenuItem, orderService } from "../services/orderService";
import { orderState } from "../state/orderState";

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
    }
  };

  return (
    <View className="bg-white p-4 rounded-lg border border-gray-200 mb-3 shadow-sm">
      <View className="flex-row">
        {/* Item Image Placeholder */}
        <View className="w-20 h-20 bg-orange-100 rounded-lg justify-center items-center mr-4">
          <Text className="text-2xl">
            {item.category === "Tea"
              ? "🍵"
              : item.category === "Pasta"
                ? "🍝"
                : item.category === "Snacks"
                  ? "🍟"
                  : "🍽️"}
          </Text>
        </View>

        {/* Item Details */}
        <View className="flex-1">
          <Text className="text-lg font-semibold text-gray-900 mb-1">
            {item.name}
          </Text>
          <Text className="text-lg font-bold text-gray-900 mb-2">
            ₹{item.price}
          </Text>

          {/* Quantity Controls */}
          <View className="flex-row items-center">
            {selectedQuantity > 0 ? (
              <>
                <TouchableOpacity
                  onPress={decrementQuantity}
                  className="w-8 h-8 bg-gray-200 rounded-full justify-center items-center"
                >
                  <Text className="text-gray-700 font-bold">-</Text>
                </TouchableOpacity>
                <Text className="mx-3 text-lg font-semibold">{quantity}</Text>
                <TouchableOpacity
                  onPress={incrementQuantity}
                  className="w-8 h-8 bg-gray-200 rounded-full justify-center items-center"
                >
                  <Text className="text-gray-700 font-bold">+</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={handleSelect}
                className="bg-blue-500 px-4 py-2 rounded-lg"
              >
                <Text className="text-white font-medium">Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

export default function SelectItemsModal() {
  const orderStateData = use$(orderState);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    if (orderStateData.showItemsModal) {
      loadMenuItems();
    }
  }, [orderStateData.showItemsModal]);

  const loadMenuItems = async () => {
    try {
      const items = await orderService.getHardcodedMenuItems();
      setMenuItems(items);
    } catch (error) {
      console.error("Error loading menu items:", error);
    }
  };

  const closeModal = () => {
    orderState.showItemsModal.set(false);
    setSearchQuery("");
    setSelectedCategory("All");
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

  const categories = ["All", "Tea", "Pasta", "Snacks"];

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <Modal
      visible={orderStateData.showItemsModal}
      animationType="slide"
      transparent={false}
    >
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="bg-white px-4 py-3 border-b border-gray-200">
          <View className="flex-row items-center mb-3">
            <TouchableOpacity onPress={closeModal} className="mr-3 p-1">
              <Text className="text-xl">←</Text>
            </TouchableOpacity>
            <Text className="text-xl font-semibold text-gray-900 flex-1">
              Select Items
            </Text>
          </View>

          {/* Search Bar */}
          <View className="flex-row items-center mb-3">
            <View className="flex-1 bg-gray-100 rounded-lg px-3 py-2 mr-3">
              <TextInput
                placeholder="Type name to search"
                value={searchQuery}
                onChangeText={setSearchQuery}
                className="text-base text-gray-900"
              />
            </View>
            <TouchableOpacity className="p-2">
              <Text className="text-gray-400">🔍</Text>
            </TouchableOpacity>
          </View>

          {/* Category Tabs */}
          <View className="flex-row">
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                onPress={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg mr-2 ${
                  selectedCategory === category ? "bg-blue-500" : "bg-gray-100"
                }`}
              >
                <Text
                  className={`font-medium ${
                    selectedCategory === category
                      ? "text-white"
                      : "text-gray-700"
                  }`}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Items List */}
        <View className="flex-1 px-4 pt-4">
          {filteredItems.length === 0 ? (
            <View className="flex-1 justify-center items-center">
              <Text className="text-gray-500 text-center">
                {searchQuery ? "No items found" : "No items available"}
              </Text>
            </View>
          ) : (
            <FlatList
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
              contentContainerStyle={{ paddingBottom: 100 }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
