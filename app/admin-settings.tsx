import { theme } from "@/constants/theme";
import { openDatabase, runIntegrityAudit } from "@/lib/db";
import { adminService } from "@/services/adminService";
import {
  CreateMenuItemData,
  MenuItem,
  menuService,
} from "@/services/menuService";
import { settingsService } from "@/services/settingsService";
import { runAllSyncDiagnostics, TestResult } from "@/services/syncDiagnostics";
import { authState } from "@/state/authState";
import { use$ } from "@legendapp/state/react";
import { router } from "expo-router";
import { Database, Lock, Settings, Trash2, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AdminSettingsScreen() {
  const auth = use$(authState);
  const [loading, setLoading] = useState(false);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [menuForm, setMenuForm] = useState({
    name: "",
    category: "",
    price: "",
  });
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditResult, setAuditResult] = useState<{
    billIssues: any[];
    creditIssues: any[];
  } | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [autoApplyAdvance, setAutoApplyAdvance] = useState<boolean>(false);
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagResults, setDiagResults] = useState<TestResult[] | null>(null);
  const [showDiagModal, setShowDiagModal] = useState(false);

  const categories = [
    "Tea",
    "Hot Cups",
    "Mojito",
    "Refreshers",
    "Milkshakes",
    "Maggie",
    "Quick Bites",
    "Sandwich",
    "Burger",
    "Omlette",
    "Rolls",
    "Momos",
    "Cigarettes",
  ];

  // Sync & Backup controls moved to Dashboard

  useEffect(() => {
    // Auth required
    if (!auth.user) {
      router.replace("/(auth)/login");
      return;
    }

    loadTableCounts();
    loadMenuItems();
    loadSettings();
    // Sync & Backup state removed here; handled on Dashboard
  }, [auth.user]);

  const loadMenuItems = async () => {
    try {
      const items = await menuService.getAllMenuItems();
      setMenuItems(items);
    } catch (error) {
      console.error("Error loading menu items:", error);
    }
  };

  const loadSettings = async () => {
    try {
      const auto = await settingsService.getBool(
        "advance.autoApplyOnBilling",
        false
      );
      setAutoApplyAdvance(auto);
    } catch (e) {
      console.warn("[settings] load failed", e);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const toggleAutoApplyAdvance = async () => {
    try {
      const next = !autoApplyAdvance;
      setAutoApplyAdvance(next);
      await settingsService.setBool("advance.autoApplyOnBilling", next);
    } catch (e: any) {
      Alert.alert("Error", e?.message || String(e));
    }
  };

  // Show access denied screen for unauthenticated users
  if (!auth.user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: "#fee2e2",
              width: 80,
              height: 80,
              borderRadius: 40,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <Lock size={40} color="#dc2626" />
          </View>

          <Text
            style={{
              fontSize: 24,
              fontWeight: "bold",
              color: "#dc2626",
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            Access Denied
          </Text>

          <Text
            style={{
              fontSize: 16,
              color: theme.colors.textSecondary,
              textAlign: "center",
              lineHeight: 24,
              marginBottom: 32,
            }}
          >
            You don&apos;t have permission to access admin settings. Only admin
            users can access this area.
          </Text>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                backgroundColor: theme.colors.background,
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <Text style={{ color: theme.colors.text, fontWeight: "600" }}>
                Go Back
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.replace("/")}
              style={{
                backgroundColor: theme.colors.primary,
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "white", fontWeight: "600" }}>
                Go to Dashboard
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const loadTableCounts = async () => {
    try {
      const counts = await adminService.getTableCounts();
      setTableCounts(counts);
    } catch (error) {
      console.error("Error loading table counts:", error);
    }
  };

  const handleClearAllTables = () => {
    Alert.alert(
      "Clear All Business Data",
      "This will permanently delete ALL business data (orders, customers, menu items, payments, etc.) but will preserve user accounts. This action cannot be undone. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Data",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await adminService.clearAllTables();
              await loadTableCounts();
              Alert.alert(
                "Success",
                "All business data cleared successfully. User accounts preserved."
              );
            } catch (error) {
              Alert.alert("Error", `Failed to clear data: ${error}`);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSetupDemoData = () => {
    Alert.alert(
      "Setup Demo Data",
      "This will clear all existing business data (but preserve user accounts) and add demo menu items and customers. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Setup",
          onPress: async () => {
            try {
              setLoading(true);
              await adminService.setupDemoData();
              await loadTableCounts();
              Alert.alert(
                "Success",
                "Demo data setup completed. User accounts preserved."
              );
            } catch (error) {
              Alert.alert("Error", `Failed to setup demo data: ${error}`);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleAddDemoMenuItems = () => {
    Alert.alert(
      "Seed Menu Items",
      "This will insert the standard menu items into the database. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Seed",
          onPress: async () => {
            try {
              setLoading(true);
              await menuService.addDemoMenuItems();
              await loadTableCounts();
              Alert.alert("Success", "Menu items added successfully");
            } catch (error) {
              Alert.alert("Error", `Failed to seed menu items: ${error}`);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleAddDemoCustomers = () => {
    Alert.alert(
      "Add Demo Customers",
      "This will add demo customers to the database. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Add",
          onPress: async () => {
            try {
              setLoading(true);
              await adminService.addDemoCustomers();
              await loadTableCounts();
              Alert.alert("Success", "Demo customers added successfully");
            } catch (error) {
              Alert.alert("Error", `Failed to add demo customers: ${error}`);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleClearMenuItems = () => {
    Alert.alert(
      "Clear Menu Items",
      "This will delete all menu items. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await menuService.clearAllMenuItems();
              await loadTableCounts();
              await loadMenuItems();
              Alert.alert("Success", "Menu items cleared successfully");
            } catch (error) {
              Alert.alert("Error", `Failed to clear menu items: ${error}`);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRunAudit = async () => {
    try {
      setAuditRunning(true);
      setAuditError(null);
      await openDatabase();
      const result = await runIntegrityAudit();
      setAuditResult(result);
    } catch (e: any) {
      setAuditError(e?.message || String(e));
    } finally {
      setAuditRunning(false);
    }
  };

  const handleRunSyncDiagnostics = async () => {
    try {
      setDiagRunning(true);
      const results = await runAllSyncDiagnostics();
      setDiagResults(results);
      setShowDiagModal(true);
    } catch (e: any) {
      Alert.alert("Diagnostics Failed", e?.message || String(e));
    } finally {
      setDiagRunning(false);
    }
  };

  // Sync & Backup actions removed from Admin Settings

  // Menu Management Functions
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleAddMenuItem = () => {
    setEditingItem(null);
    setMenuForm({ name: "", category: "", price: "" });
    setShowMenuModal(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleEditMenuItem = (item: MenuItem) => {
    setEditingItem(item);
    setMenuForm({
      name: item.name,
      category: item.category || "",
      price: item.price.toString(),
    });
    setShowMenuModal(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
              await loadTableCounts();
              Alert.alert("Success", "Menu item deleted successfully");
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.message || "Failed to delete menu item"
              );
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
    if (isNaN(price) || price <= 0)
      return "Price must be a valid positive number";

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
      await loadTableCounts();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save menu item");
    } finally {
      setLoading(false);
    }
  };

  const AdminCard = ({
    title,
    description,
    icon: Icon,
    onPress,
    destructive = false,
    disabled = false,
  }: {
    title: string;
    description: string;
    icon: any;
    onPress: () => void;
    destructive?: boolean;
    disabled?: boolean;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        backgroundColor: theme.colors.background,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: destructive ? "#fee2e2" : theme.colors.border,
        opacity: disabled || loading ? 0.6 : 1,
        ...theme.shadows.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: destructive
              ? "#fee2e2"
              : theme.colors.primaryLight,
            justifyContent: "center",
            alignItems: "center",
            marginRight: 12,
          }}
        >
          <Icon
            size={24}
            color={destructive ? "#dc2626" : theme.colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: destructive ? "#dc2626" : theme.colors.text,
              marginBottom: 4,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: theme.colors.textSecondary,
              lineHeight: 20,
            }}
          >
            {description}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const StatCard = ({ label, count }: { label: string; count: number }) => (
    <View
      style={{
        backgroundColor: theme.colors.background,
        padding: 16,
        borderRadius: 12,
        marginRight: 12,
        minWidth: 100,
        alignItems: "center",
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadows.sm,
      }}
    >
      <Text
        style={{
          fontSize: 24,
          fontWeight: "bold",
          color: theme.colors.primary,
          marginBottom: 4,
        }}
      >
        {count}
      </Text>
      <Text
        style={{
          fontSize: 12,
          color: theme.colors.textSecondary,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Header inside Safe Area to avoid overlap with status bar/notch */}
      <SafeAreaView
        edges={["top"]}
        style={{ backgroundColor: theme.colors.primary }}
      >
        <View
          style={{
            backgroundColor: theme.colors.primary,
            paddingTop: 32,
            paddingBottom: 24,
            paddingHorizontal: 24,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Settings size={28} color="white" />
            <Text
              style={{
                color: "white",
                fontSize: 24,
                fontWeight: "bold",
                marginLeft: 12,
              }}
            >
              Admin Settings
            </Text>
          </View>
          <Text
            style={{
              color: "rgba(255,255,255,0.8)",
              fontSize: 14,
              marginTop: 4,
            }}
          >
            Manage your application data and settings
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView style={{ flex: 1, padding: 24 }}>
        {/* Database Statistics */}
        <View style={{ marginBottom: 32 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: theme.colors.text,
              marginBottom: 16,
            }}
          >
            Database Overview
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <StatCard label="Users" count={tableCounts.users || 0} />
            <StatCard label="Customers" count={tableCounts.customers || 0} />
            <StatCard label="Menu Items" count={tableCounts.menu_items || 0} />
            <StatCard label="Orders" count={tableCounts.kot_orders || 0} />
            <StatCard label="Order Items" count={tableCounts.kot_items || 0} />
            <StatCard label="Expenses" count={tableCounts.expenses || 0} />
          </ScrollView>
        </View>

        {/* Menu Management */}
        <View style={{ marginBottom: 32 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: theme.colors.text,
              marginBottom: 16,
            }}
          >
            Menu Management ({menuItems.length} items)
          </Text>

          {/* Manage Button */}
          <TouchableOpacity
            onPress={() => router.push("/menu-management")}
            style={{
              backgroundColor: theme.colors.primary,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 16,
              paddingHorizontal: 20,
              borderRadius: 12,
              ...theme.shadows.sm,
            }}
          >
            <Settings size={20} color="white" />
            <Text
              style={{
                color: "white",
                fontSize: 16,
                fontWeight: "600",
                marginLeft: 8,
              }}
            >
              Manage Menu Items
            </Text>
          </TouchableOpacity>
        </View>

        {/* Database Management */}
        <Text
          style={{
            fontSize: 18,
            fontWeight: "bold",
            color: theme.colors.text,
            marginBottom: 16,
          }}
        >
          Database Management
        </Text>
        <AdminCard
          title="Clear All Business Data"
          description="⚠️ Permanently delete ALL business data. User accounts are preserved."
          icon={Trash2}
          onPress={handleClearAllTables}
          destructive
        />

        {/* Sync Diagnostics */}
        {process.env.NODE_ENV === "development" && (
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                color: theme.colors.text,
                marginBottom: 12,
              }}
            >
              Sync Diagnostics
            </Text>
            <TouchableOpacity
              onPress={handleRunSyncDiagnostics}
              disabled={diagRunning}
              style={{
                backgroundColor: theme.colors.primary,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 8,
                opacity: diagRunning ? 0.6 : 1,
                ...theme.shadows.sm,
              }}
            >
              <Database size={18} color="white" />
              <Text
                style={{ color: "white", fontWeight: "600", marginLeft: 8 }}
              >
                {diagRunning ? "Running…" : "Run Sync Diagnostics"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {process.env.NODE_ENV === "development" && (
          <>
            <View style={{ marginBottom: 32 }}>
              {__DEV__ && (
                <AdminCard
                  title="Seed Menu Items"
                  description="Insert standard menu items into the database"
                  icon={Database}
                  onPress={handleAddDemoMenuItems}
                />
              )}
            </View>

            {/* Integrity Audit */}
            <View style={{ marginBottom: 32 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "bold",
                  color: theme.colors.text,
                  marginBottom: 8,
                }}
              >
                Integrity Audit
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: theme.colors.textSecondary,
                  marginBottom: 12,
                }}
              >
                Check for mismatched bill totals and incorrect customer credit
                balances.
              </Text>

              <View style={{ flexDirection: "row", gap: 12, marginBottom: 8 }}>
                <TouchableOpacity
                  onPress={handleRunAudit}
                  disabled={auditRunning}
                  style={{
                    backgroundColor: theme.colors.primary,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    alignSelf: "flex-start",
                    opacity: auditRunning ? 0.6 : 1,
                    ...theme.shadows.sm,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "600" }}>
                    {auditRunning ? "Running…" : "Run Audit"}
                  </Text>
                </TouchableOpacity>

                {auditResult && (
                  <TouchableOpacity
                    onPress={() => setAuditResult(null)}
                    style={{
                      backgroundColor: theme.colors.background,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      alignSelf: "flex-start",
                    }}
                  >
                    <Text
                      style={{ color: theme.colors.text, fontWeight: "600" }}
                    >
                      Clear
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {auditError && (
                <Text style={{ color: "#dc2626", marginBottom: 8 }}>
                  {auditError}
                </Text>
              )}

              {auditResult && (
                <View
                  style={{
                    marginTop: 8,
                    backgroundColor: theme.colors.background,
                    padding: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    ...theme.shadows.sm,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: theme.colors.text,
                      marginBottom: 8,
                    }}
                  >
                    Summary
                  </Text>
                  <Text
                    style={{
                      color: theme.colors.textSecondary,
                      marginBottom: 12,
                    }}
                  >
                    Bills with mismatched totals:{" "}
                    {auditResult.billIssues.length} • Customers with incorrect
                    credit: {auditResult.creditIssues.length}
                  </Text>

                  {auditResult.billIssues.length === 0 &&
                  auditResult.creditIssues.length === 0 ? (
                    <View style={{ paddingVertical: 4 }}>
                      <Text style={{ color: "#16a34a", fontWeight: "600" }}>
                        No issues found.
                      </Text>
                    </View>
                  ) : (
                    <>
                      {auditResult.billIssues.length > 0 && (
                        <View style={{ marginTop: 8 }}>
                          <Text
                            style={{
                              fontWeight: "600",
                              color: theme.colors.text,
                              marginBottom: 6,
                            }}
                          >
                            Bill Issues
                          </Text>
                          {auditResult.billIssues
                            .slice(0, 10)
                            .map((b: any, idx: number) => (
                              <View
                                key={idx}
                                style={{
                                  paddingVertical: 6,
                                  borderTopWidth: idx ? 1 : 0,
                                  borderTopColor: theme.colors.border,
                                }}
                              >
                                <Text
                                  style={{ color: theme.colors.textSecondary }}
                                >
                                  Bill ID: {b.billId}
                                </Text>
                                <Text
                                  style={{ color: theme.colors.textSecondary }}
                                >
                                  Stored: ₹{b.stored} • Recomputed: ₹
                                  {b.recomputed} • Paid: ₹{b.paid} • Credit: ₹
                                  {b.credit}
                                </Text>
                              </View>
                            ))}
                          {auditResult.billIssues.length > 10 && (
                            <Text
                              style={{
                                color: theme.colors.textSecondary,
                                marginTop: 6,
                              }}
                            >
                              +{auditResult.billIssues.length - 10} more…
                            </Text>
                          )}
                        </View>
                      )}

                      {auditResult.creditIssues.length > 0 && (
                        <View style={{ marginTop: 12 }}>
                          <Text
                            style={{
                              fontWeight: "600",
                              color: theme.colors.text,
                              marginBottom: 6,
                            }}
                          >
                            Customer Credit Issues
                          </Text>
                          {auditResult.creditIssues
                            .slice(0, 10)
                            .map((c: any, idx: number) => (
                              <View
                                key={idx}
                                style={{
                                  paddingVertical: 6,
                                  borderTopWidth: idx ? 1 : 0,
                                  borderTopColor: theme.colors.border,
                                }}
                              >
                                <Text
                                  style={{ color: theme.colors.textSecondary }}
                                >
                                  Customer ID: {c.customerId}
                                </Text>
                                <Text
                                  style={{ color: theme.colors.textSecondary }}
                                >
                                  Stored: ₹{c.stored} • Expected: ₹{c.expected}
                                </Text>
                              </View>
                            ))}
                          {auditResult.creditIssues.length > 10 && (
                            <Text
                              style={{
                                color: theme.colors.textSecondary,
                                marginTop: 6,
                              }}
                            >
                              +{auditResult.creditIssues.length - 10} more…
                            </Text>
                          )}
                        </View>
                      )}
                    </>
                  )}
                </View>
              )}
            </View>
          </>
        )}

        {loading && (
          <View
            style={{
              backgroundColor: theme.colors.background,
              padding: 20,
              borderRadius: 12,
              alignItems: "center",
              marginBottom: 20,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text
              style={{
                marginTop: 12,
                color: theme.colors.textSecondary,
                fontSize: 16,
              }}
            >
              Processing...
            </Text>
          </View>
        )}
      </ScrollView>

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
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: theme.colors.text,
              }}
            >
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
                <Text
                  style={{ color: "white", fontSize: 16, fontWeight: "600" }}
                >
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
                onChangeText={(text: string) =>
                  setMenuForm({ ...menuForm, name: text })
                }
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
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category}
                    onPress={() => setMenuForm({ ...menuForm, category })}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor:
                        menuForm.category === category
                          ? theme.colors.primary
                          : "#f3f4f6",
                      borderWidth: 1,
                      borderColor:
                        menuForm.category === category
                          ? theme.colors.primary
                          : "#e5e7eb",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color:
                          menuForm.category === category
                            ? "white"
                            : theme.colors.text,
                        fontWeight:
                          menuForm.category === category ? "600" : "400",
                      }}
                    >
                      {category}
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
                onChangeText={(text: string) =>
                  setMenuForm({ ...menuForm, price: text })
                }
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

      {/* Sync Diagnostics Modal */}
      <Modal
        visible={showDiagModal}
        animationType="slide"
        onRequestClose={() => setShowDiagModal(false)}
        presentationStyle="pageSheet"
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
            <TouchableOpacity onPress={() => setShowDiagModal(false)}>
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: theme.colors.text,
              }}
            >
              Sync Diagnostics
            </Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView style={{ flex: 1, padding: 16 }}>
            {!diagResults && (
              <Text style={{ color: theme.colors.textSecondary }}>
                No results yet.
              </Text>
            )}
            {diagResults &&
              diagResults.map((r, i) => (
                <View
                  key={`${r.name}-${i}`}
                  style={{
                    backgroundColor: "white",
                    borderWidth: 1,
                    borderColor: r.passed ? "#d1fae5" : "#fee2e2",
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <Text
                    style={{
                      fontWeight: "600",
                      color: r.passed ? "#065f46" : "#991b1b",
                      marginBottom: 6,
                    }}
                  >
                    {r.name}
                  </Text>
                  <Text style={{ color: theme.colors.textSecondary }}>
                    {r.passed ? "Passed" : "Failed"}
                    {r.details ? ` • ${r.details}` : ""}
                  </Text>
                </View>
              ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
