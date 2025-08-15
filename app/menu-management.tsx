import { CATEGORIES, getCategoryEmoji } from "@/constants/appConstants";
import { theme } from "@/constants/theme";
import { CreateMenuItemData, MenuItem, menuService } from "@/services/menuService";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Edit3, Search, Trash2, X } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StatusBar as RNStatusBar,
  SafeAreaView,
  ScrollView,
  SectionList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ---- Types ----
interface Section { title: string; data: MenuItem[] }

// ---- Row ----
const ITEM_HEIGHT = 60;
const ITEM_SPACING = 6;

const ItemRow: React.FC<{
  item: MenuItem;
  onEdit: (i: MenuItem) => void;
  onDelete: (i: MenuItem) => void;
}> = ({ item, onEdit, onDelete }) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#fff",
      borderRadius: 8,
      paddingHorizontal: 10,
      height: ITEM_HEIGHT,
      marginBottom: ITEM_SPACING,
      borderWidth: 1,
      borderColor: "#e2e5e8",
    }}
  >
    <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: "#f2f3f5", justifyContent: "center", alignItems: "center", marginRight: 10 }}>
      <Text style={{ fontSize: 20 }}>{getCategoryEmoji(item.category || undefined)}</Text>
    </View>
    <View style={{ flex: 1, marginRight: 8 }}>
      <Text style={{ fontSize: 15, fontWeight: "600", color: theme.colors.text }} numberOfLines={1}>{item.name}</Text>
      <Text style={{ fontSize: 13, fontWeight: "700", color: theme.colors.primary, marginTop: 4 }}>₹{item.price}</Text>
    </View>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <TouchableOpacity onPress={() => onEdit(item)} style={{ backgroundColor: theme.colors.primaryLight, padding: 10, borderRadius: 8 }}>
        <Edit3 size={16} color={theme.colors.primary} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onDelete(item)} style={{ backgroundColor: "#fee2e2", padding: 10, borderRadius: 8 }}>
        <Trash2 size={16} color="#dc2626" />
      </TouchableOpacity>
    </View>
  </View>
);

export default function MenuManagementScreen() {
  const router = useRouter();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const listRef = useRef<SectionList<MenuItem>>(null);

  // Modal state
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [menuForm, setMenuForm] = useState({ name: "", category: "", price: "" });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const data = await menuService.getAllMenuItems();
      setItems(data);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to load menu items");
    } finally {
      setLoading(false);
    }
  };

  // Build sections like in select-items
  const lowered = useMemo(() => items.map(m => ({ m, nameLower: m.name.toLowerCase() })), [items]);
  const sections: Section[] = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term ? lowered.filter(o => o.nameLower.includes(term)).map(o => o.m) : items;
    if (category !== "All") {
      const data = filtered.filter(f => (f.category || "Uncategorized") === category);
      return data.length ? [{ title: category, data }] : [];
    }
    const group: Record<string, MenuItem[]> = {};
    filtered.forEach(m => { const k = m.category || "Uncategorized"; (group[k] = group[k] || []).push(m); });
    const ordered: Section[] = [];
    CATEGORIES.forEach(c => { if (group[c.name]) ordered.push({ title: c.name, data: group[c.name] }); });
    Object.keys(group).filter(k => !CATEGORIES.find(c => c.name === k)).sort().forEach(k => ordered.push({ title: k, data: group[k] }));
    return ordered;
  }, [items, search, category]);

  const categories = useMemo(() => ["All", ...CATEGORIES.map(c => c.name)], []);

  const scrollToCategory = (cat: string) => {
    setCategory(cat);
    if (cat === "All") return;
    if (cat !== "All") {
      const index = sections.findIndex(s => s.title === cat);
      if (index !== -1) {
        try { listRef.current?.scrollToLocation({ sectionIndex: index, itemIndex: 0, animated: true, viewPosition: 0 }); } catch { }
      }
    }
  };

  // Handlers
  const handleAdd = () => {
    setEditingItem(null);
    setMenuForm({ name: "", category: "", price: "" });
    setShowMenuModal(true);
  };
  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setMenuForm({ name: item.name, category: item.category || "", price: String(item.price) });
    setShowMenuModal(true);
  };
  const handleDelete = (item: MenuItem) => {
    Alert.alert("Delete Menu Item", `Are you sure you want to delete "${item.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { try { setLoading(true); await menuService.deleteMenuItem(item.id); await load(); } catch (e: any) { Alert.alert("Error", e.message || "Failed to delete"); } finally { setLoading(false); } } }
    ]);
  };

  const validate = (): string | null => {
    if (!menuForm.name.trim()) return "Item name is required";
    if (!menuForm.category.trim()) return "Category is required";
    if (!menuForm.price.trim()) return "Price is required";
    const p = parseFloat(menuForm.price); if (isNaN(p) || p <= 0) return "Price must be a valid positive number";
    return null;
  };
  const handleSave = async () => {
    const err = validate();
    if (err) return Alert.alert("Validation Error", err);
    try {
      setLoading(true);
      const payload: CreateMenuItemData = { name: menuForm.name.trim(), category: menuForm.category.trim(), price: parseFloat(menuForm.price) };
      if (editingItem) await menuService.updateMenuItem(editingItem.id, payload); else await menuService.createMenuItem(payload);
      setShowMenuModal(false); setEditingItem(null); setMenuForm({ name: "", category: "", price: "" });
      await load();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save menu item");
    } finally { setLoading(false); }
  };

  // Estimate top inset when no SafeAreaProvider is present
  const topInset = Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) : 44;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <StatusBar style="light" />
      {/* filler view placed under the system status bar to control its background color */}
      <View style={{ height: topInset, backgroundColor: theme.colors.primary }} />
      {/* Custom header (below the status-bar filler) */}
      <View style={{ backgroundColor: theme.colors.primary, paddingBottom: 12, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
            <Text style={{ fontSize: 32, color: 'white' }}>{'←'}</Text>
          </TouchableOpacity>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>Manage Menu</Text>
          <TouchableOpacity onPress={handleAdd} style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8 }}>
            <Text style={{ color: 'white', fontWeight: '700' }}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search & Categories */}
      <View style={{ backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#eef1f3" }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#f3f4f6", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
          <Search size={20} color={theme.colors.textSecondary} />
          <TextInput
            placeholder="Search menu items..."
            value={search}
            onChangeText={(t: string) => setSearch(t)}
            style={{ flex: 1, fontSize: 14.5, color: theme.colors.text, marginLeft: 10 }}
            placeholderTextColor={theme.colors.textSecondary}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}><X size={18} color={theme.colors.textSecondary} /></TouchableOpacity>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
          {categories.map(cat => {
            const active = category === cat;
            return (
              <TouchableOpacity key={cat} onPress={() => scrollToCategory(cat)} style={{ paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: active ? theme.colors.primary : "#fff", borderWidth: 1, borderColor: active ? theme.colors.primary : "#e3e5e8", alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                <Text style={{ color: active ? "#fff" : theme.colors.text, fontSize: 13, fontWeight: "600" }}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
            <Text style={{ fontSize: 50, marginBottom: 12 }}>🍽️</Text>
            <Text style={{ fontSize: 17, fontWeight: "600", color: theme.colors.text, marginBottom: 6 }}>No menu items</Text>
            <Text style={{ fontSize: 13.5, color: theme.colors.textSecondary, textAlign: "center", lineHeight: 20 }}>Tap Add to create your first item.</Text>
          </View>
        ) : sections.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
            <Text style={{ fontSize: 46, marginBottom: 10 }}>🔍</Text>
            <Text style={{ fontSize: 16.5, fontWeight: "600", color: theme.colors.text, marginBottom: 6 }}>No matches</Text>
            <Text style={{ fontSize: 13.5, color: theme.colors.textSecondary, textAlign: "center", lineHeight: 20 }}>Try a different search term.</Text>
          </View>
        ) : (
          <SectionList<MenuItem, Section>
            ref={listRef}
            sections={sections}
            keyExtractor={(item: MenuItem) => item.id}
            renderItem={({ item }: { item: MenuItem }) => (
              <ItemRow item={item} onEdit={handleEdit} onDelete={handleDelete} />
            )}
            renderSectionHeader={({ section: { title } }: { section: Section }) => (
              <View style={{ height: 32, justifyContent: "flex-end", paddingBottom: 2 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: theme.colors.text }}>{getCategoryEmoji(title)} {title}</Text>
              </View>
            )}
            stickySectionHeadersEnabled={category === "All"}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 10, paddingBottom: 20 }}
            keyboardDismissMode="on-drag"
          />
        )}
      </View>

      {/* Add/Edit Modal */}
      <Modal visible={showMenuModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowMenuModal(false)}>
        <View style={{ flex: 1, backgroundColor: "white" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
            <TouchableOpacity onPress={() => setShowMenuModal(false)}>
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: "600", color: theme.colors.text }}>{editingItem ? "Edit Menu Item" : "Add Menu Item"}</Text>
            <TouchableOpacity onPress={handleSave} disabled={loading} style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, opacity: loading ? 0.6 : 1 }}>
              {loading ? <ActivityIndicator size="small" color="white" /> : <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>{editingItem ? "Update" : "Add"}</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: 16 }}>
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: theme.colors.text, marginBottom: 8 }}>Item Name *</Text>
              <TextInput value={menuForm.name} onChangeText={(text: string) => setMenuForm({ ...menuForm, name: text })} placeholder="Enter item name" style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, backgroundColor: "white" }} autoCapitalize="words" />
            </View>
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: theme.colors.text, marginBottom: 8 }}>Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity key={c.name} onPress={() => setMenuForm({ ...menuForm, category: c.name })} style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: menuForm.category === c.name ? theme.colors.primary : "#f3f4f6", borderWidth: 1, borderColor: menuForm.category === c.name ? theme.colors.primary : "#e5e7eb", alignItems: "center", justifyContent: "center", marginRight: 8, flexDirection: "row", gap: 6 }}>
                    <Text style={{ fontSize: 16 }}>{c.emoji}</Text>
                    <Text style={{ fontSize: 14, color: menuForm.category === c.name ? "white" : theme.colors.text, fontWeight: menuForm.category === c.name ? "700" : "500" }}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: theme.colors.text, marginBottom: 8 }}>Price (₹) *</Text>
              <TextInput value={menuForm.price} onChangeText={(text: string) => setMenuForm({ ...menuForm, price: text })} placeholder="Enter price" keyboardType="numeric" style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, backgroundColor: "white" }} />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
