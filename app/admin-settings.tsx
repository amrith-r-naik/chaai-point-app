import { theme } from "@/constants/theme";
import {
  analyzeDatabase,
  getWalStatus,
  openDatabase,
  performDatabaseMaintenance,
  runIntegrityAudit,
  vacuumDatabase,
  walCheckpoint,
} from "@/lib/db";
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
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  ChevronRight,
  Database,
  LayoutGrid,
  Lock,
  RefreshCw,
  Trash2,
  Utensils,
  X,
  Zap
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AdminSettingsScreen() {
  // Granular state subscription for optimized re-renders
  const user = use$(authState.user);
  const [loading, setLoading] = useState(false);
  // Defer heavy content rendering until after navigation completes
  const [isReady, setIsReady] = useState(false);
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
    expenseIssues: any[];
  } | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [autoApplyAdvance, setAutoApplyAdvance] = useState<boolean>(false);
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagResults, setDiagResults] = useState<TestResult[] | null>(null);
  const [showDiagModal, setShowDiagModal] = useState(false);
  const [maintenanceRunning, setMaintenanceRunning] = useState(false);
  const [walStatus, setWalStatus] = useState<{
    walPages: number;
    walSizeBytes: number;
  } | null>(null);
  const [showAdvancedDB, setShowAdvancedDB] = useState(false);

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
    if (!user) {
      router.replace("/(auth)/login");
      return;
    }

    // Defer heavy data loading until after navigation animation completes
    const task = InteractionManager.runAfterInteractions(async () => {
      setIsReady(true);
      // Open database once, then load data sequentially to avoid lock conflicts
      try {
        await openDatabase();
        await loadTableCounts();
        await loadMenuItems();
        await loadSettings();
        await loadWalStatus();
      } catch (e) {
        console.warn("Failed to load admin data:", e);
      }
    });

    return () => task.cancel();
    // Sync & Backup state removed here; handled on Dashboard
  }, [user]);

  const loadWalStatus = async () => {
    try {
      const status = await getWalStatus();
      setWalStatus(status);
    } catch (e) {
      console.warn("Failed to load WAL status:", e);
    }
  };

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

  const loadTableCounts = async () => {
    try {
      const counts = await adminService.getTableCounts();
      setTableCounts(counts);
    } catch (error) {
      console.error("Error loading table counts:", error);
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
  if (!user) {
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

  // Show loading state while heavy content is being prepared
  if (!isReady) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ marginTop: 12, color: theme.colors.textSecondary }}>
            Loading settings...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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

              // Ask if user wants to clear cloud data too
              Alert.alert(
                "Clear Cloud Data?",
                "Local data has been cleared and sync checkpoints reset. Do you want to clear cloud data as well? If yes, cloud will be cleared. If no, next PULL will restore data from cloud.",
                [
                  { text: "Keep Cloud Data", style: "cancel" },
                  {
                    text: "Clear Cloud Too",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        setLoading(true);
                        await adminService.clearCloudData();
                        Alert.alert(
                          "Success",
                          "Cloud data cleared successfully"
                        );
                      } catch (error) {
                        Alert.alert("Error", `Failed to clear cloud: ${error}`);
                      } finally {
                        setLoading(false);
                      }
                    },
                  },
                ]
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
      "Add Sample Menu Items",
      "This will insert standard menu items (Tea, Coffee, Snacks, etc.) into the database. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Add",
          onPress: async () => {
            try {
              setLoading(true);
              await menuService.addDemoMenuItems();
              await loadTableCounts();
              await loadMenuItems();
              Alert.alert("Success", "Sample menu items added successfully");
            } catch (error) {
              Alert.alert("Error", `Failed to add sample menu items: ${error}`);
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

  // Dev-only: Hard delete all local menu items (no cloud changes)
  const handleHardDeleteLocalMenuItems = () => {
    if (process.env.NODE_ENV !== "development") return;
    Alert.alert(
      "Hard Delete Local Menu Items",
      "This will PERMANENTLY delete all menu items from the local device database only. It will NOT change cloud data. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await menuService.clearAllMenuItems();
              await loadTableCounts();
              await loadMenuItems();
              Alert.alert(
                "Success",
                "All local menu items deleted (cloud unchanged)"
              );
            } catch (error: any) {
              Alert.alert(
                "Error",
                error?.message ||
                "Failed to delete local menu items. If items are referenced in orders, delete those first or clear all business data."
              );
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
      setAuditResult(null);
      await openDatabase();
      const result = await runIntegrityAudit();
      setAuditResult(result);
      if (result.billIssues.length === 0 && result.creditIssues.length === 0 && result.expenseIssues.length === 0) {
        Alert.alert("Audit Complete", "✅ No integrity issues found.");
      }
    } catch (e: any) {
      setAuditError(e?.message || String(e));
      Alert.alert("Audit Failed", e?.message || String(e));
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

  // Database Maintenance Functions (Phase 2.3)
  const handleRunMaintenance = async () => {
    Alert.alert(
      "Run Database Maintenance",
      "This will run ANALYZE, VACUUM, and WAL checkpoint. This may take a few seconds and briefly block database operations. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Run Maintenance",
          onPress: async () => {
            try {
              setMaintenanceRunning(true);
              await openDatabase();
              const result = await performDatabaseMaintenance();
              await loadWalStatus();

              const spaceReclaimed = result.vacuum.spaceReclaimed
                ? `${(result.vacuum.spaceReclaimed / 1024).toFixed(1)}KB`
                : "N/A";

              Alert.alert(
                "Maintenance Complete",
                `✅ Database maintenance finished in ${result.totalDurationMs.toFixed(0)}ms\n\n` +
                `ANALYZE: ${result.analyze.success ? "✓" : "✗"} (${result.analyze.durationMs.toFixed(0)}ms)\n` +
                `VACUUM: ${result.vacuum.success ? "✓" : "✗"} (${result.vacuum.durationMs.toFixed(0)}ms)\n` +
                `Space reclaimed: ${spaceReclaimed}\n` +
                `WAL Checkpoint: ${result.checkpoint.success ? "✓" : "✗"} (${result.checkpoint.durationMs.toFixed(0)}ms)`
              );
            } catch (e: any) {
              Alert.alert("Maintenance Failed", e?.message || String(e));
            } finally {
              setMaintenanceRunning(false);
            }
          },
        },
      ]
    );
  };

  const handleVacuumOnly = async () => {
    try {
      setMaintenanceRunning(true);
      await openDatabase();
      const result = await vacuumDatabase();
      if (result.success) {
        const spaceReclaimed =
          result.sizeBefore && result.sizeAfter
            ? `${((result.sizeBefore - result.sizeAfter) / 1024).toFixed(1)}KB`
            : "N/A";
        Alert.alert(
          "VACUUM Complete",
          `Completed in ${result.durationMs.toFixed(0)}ms\nSpace reclaimed: ${spaceReclaimed}`
        );
      } else {
        Alert.alert("VACUUM Failed", "See console for details");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || String(e));
    } finally {
      setMaintenanceRunning(false);
    }
  };

  const handleAnalyzeOnly = async () => {
    try {
      setMaintenanceRunning(true);
      await openDatabase();
      const result = await analyzeDatabase();
      if (result.success) {
        Alert.alert(
          "ANALYZE Complete",
          `Query planner statistics updated in ${result.durationMs.toFixed(0)}ms`
        );
      } else {
        Alert.alert("ANALYZE Failed", "See console for details");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || String(e));
    } finally {
      setMaintenanceRunning(false);
    }
  };

  const handleWalCheckpoint = async () => {
    try {
      setMaintenanceRunning(true);
      await openDatabase();
      const result = await walCheckpoint("TRUNCATE");
      await loadWalStatus();
      if (result.success) {
        Alert.alert(
          "WAL Checkpoint Complete",
          `Flushed ${result.pagesWritten} pages in ${result.durationMs.toFixed(0)}ms`
        );
      } else {
        Alert.alert(
          "WAL Checkpoint Partial",
          `${result.pagesRemaining} pages remaining. Database may be busy.`
        );
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || String(e));
    } finally {
      setMaintenanceRunning(false);
    }
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

  const validateMenuForm = (): string | null => {
    if (!menuForm.name.trim()) return "Item name is required";
    if (!menuForm.category.trim()) return "Category is required";
    if (!menuForm.price.trim()) return "Price is required";

    const price = parseFloat(menuForm.price);
    if (isNaN(price) || price <= 0)
      return "Price must be a valid positive number";

    return null;
  };

  // UI Components
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

  const ActionCard = ({
    title,
    description,
    icon: Icon,
    onPress,
    color = theme.colors.primary,
  }: {
    title: string;
    description: string;
    icon: any;
    onPress: () => void;
    color?: string;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "white",
        padding: 20,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadows.sm,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          backgroundColor: `${color}15`,
          justifyContent: "center",
          alignItems: "center",
          marginRight: 16,
        }}
      >
        <Icon size={28} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 17, fontWeight: "700", color: theme.colors.text, marginBottom: 4 }}>
          {title}
        </Text>
        <Text style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 }}>
          {description}
        </Text>
      </View>
      <ChevronRight size={20} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <Text
      style={{
        fontSize: 14,
        fontWeight: "700",
        color: theme.colors.textSecondary,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginTop: 24,
        marginBottom: 12,
        marginLeft: 4,
      }}
    >
      {title}
    </Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      {/* Header */}
      <SafeAreaView
        edges={["top"]}
        style={{
          backgroundColor: "white",
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
            height: 56,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              justifyContent: "center",
              alignItems: "center",
              marginRight: 8,
              borderRadius: 20,
            }}
          >
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "bold", color: theme.colors.text }}>
            Admin Dashboard
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Database Statistics */}
        <Text
          style={{
            fontSize: 14,
            fontWeight: "700",
            color: theme.colors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 12,
            marginLeft: 4,
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


        {/* Primary Management */}
        <SectionHeader title="Management" />

        <ActionCard
          title="Menu Management"
          description="Edit items, update prices, and manage categories."
          icon={Utensils}
          onPress={() => router.push("/menu-management")}
          color={theme.colors.primary}
        />

        <ActionCard
          title="Reports & Analytics"
          description="View sales reports, export CSVs, and analyze trends."
          icon={BarChart3}
          onPress={() => router.push("/reports")}
          color="#8B5CF6"
        />

        <SectionHeader title="System Health" />

        <View
          style={{
            backgroundColor: "white",
            padding: 16,
            borderRadius: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: theme.colors.border,
            ...theme.shadows.sm,
          }}
        >
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                backgroundColor: "#ECFDF5",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Database size={28} color="#10B981" />
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: theme.colors.text }}>
                    Database Health
                  </Text>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                    WAL: {walStatus?.walPages ?? "..."} pages ({walStatus ? (walStatus.walSizeBytes / 1024).toFixed(1) : "0"} KB)
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleRunMaintenance}
                  disabled={maintenanceRunning}
                  style={{
                    backgroundColor: theme.colors.primary + "15",
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                  }}
                >
                  {maintenanceRunning ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <Text style={{ color: theme.colors.primary, fontWeight: "600", fontSize: 13 }}>Optimize</Text>
                  )}
                </TouchableOpacity>
              </View>


            </View>

          </View>
          <TouchableOpacity
            onPress={() => setShowAdvancedDB(!showAdvancedDB)}
            style={{ marginTop: 12, alignSelf: "flex-start" }}
          >
            <Text style={{ fontSize: 12, color: theme.colors.textSecondary, textDecorationLine: "underline" }}>
              {showAdvancedDB ? "Hide Advanced Tools" : "Show Advanced Tools"}
            </Text>
          </TouchableOpacity>

          {showAdvancedDB && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              <DBButton title="ANALYZE" onPress={handleAnalyzeOnly} />
              <DBButton title="VACUUM" onPress={handleVacuumOnly} />
              <DBButton title="CHECKPOINT" onPress={handleWalCheckpoint} />
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={handleRunSyncDiagnostics}
          disabled={diagRunning}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "white",
            padding: 20,
            borderRadius: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: theme.colors.border,
            ...theme.shadows.sm,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: `#0EA5E915`,
              justifyContent: "center",
              alignItems: "center",
              marginRight: 16,
            }}
          >
            {diagRunning ? (<ActivityIndicator size={"small"} color="#add1e1ff" />) : (<RefreshCw size={28} color="#0EA5E9" />)}
          </View>
          {diagRunning ? (<View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: theme.colors.textLight, marginBottom: 4 }}>
              Running Sync Diagnostics...
            </Text>
          </View>) : (<View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: theme.colors.text, marginBottom: 4 }}>
              Sync Diagnostics
            </Text>
            <Text style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 }}>
              Check cloud connectivity and resolve sync issues.
            </Text>
          </View>)}
        </TouchableOpacity>

        <View style={{ height: 12 }} />

        {/* Development & Danger Zone */}
        <SectionHeader title="Danger Zone" />

        <View style={{ backgroundColor: "#FEF2F2", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#FCA5A5" }}>

          {/* Add Standard Menu Items */}
          <TouchableOpacity
            onPress={handleAddDemoMenuItems}
            style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12 }}
          >
            <LayoutGrid size={20} color="#DC2626" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#991B1B" }}>Add Default Menu Items</Text>
              <Text style={{ fontSize: 12, color: "#B91C1C" }}>Populate the menu with standard items.</Text>
            </View>
          </TouchableOpacity>

          <View style={{ height: 1, backgroundColor: "#FCA5A5", marginVertical: 4 }} />

          {/* Clear Menu */}
          <TouchableOpacity
            onPress={handleClearMenuItems}
            style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12 }}
          >
            <Trash2 size={20} color="#DC2626" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#991B1B" }}>Clear Menu</Text>
              <Text style={{ fontSize: 12, color: "#B91C1C" }}>Delete all menu items.</Text>
            </View>
          </TouchableOpacity>

          <View style={{ height: 1, backgroundColor: "#FCA5A5", marginVertical: 4 }} />

          {/* Clear All Data */}
          <TouchableOpacity
            onPress={handleClearAllTables}
            style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12 }}
          >
            <AlertTriangle size={20} color="#DC2626" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#991B1B" }}>Reset Business Data</Text>
              <Text style={{ fontSize: 12, color: "#B91C1C" }}>Permanently delete all orders and data.</Text>
            </View>
          </TouchableOpacity>

          {process.env.NODE_ENV === "development" && (
            <>
              <View style={{ height: 1, backgroundColor: "#FCA5A5", marginVertical: 4 }} />
              {/* Add Demo Data (Full Seeding) */}
              <TouchableOpacity
                onPress={handleSetupDemoData}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12 }}
              >
                <Zap size={20} color="#DC2626" />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: "#991B1B" }}>Setup Full Demo Data</Text>
                  <Text style={{ fontSize: 12, color: "#B91C1C" }}>Wipe database and seed 3 months of history.</Text>
                </View>
              </TouchableOpacity>

              {/* Integrity Audit */}
              <View style={{ height: 1, backgroundColor: "#FCA5A5", marginVertical: 4 }} />
              {auditRunning ? (
                <TouchableOpacity
                  disabled
                  onPress={handleRunAudit}
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12 }}
                >
                  <ActivityIndicator size={"small"} color="#e7a8a8ff" />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: "#e7a8a8ff" }}>Running Integrity Audit...</Text>
                    <Text style={{ fontSize: 12, color: "#e7a8a8ff" }}>Checking for data consistency.</Text>
                  </View>
                </TouchableOpacity>) : (
                <TouchableOpacity
                  onPress={handleRunAudit}
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12 }}
                >
                  <Activity size={20} color="#DC2626" />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: "#991B1B" }}>Run Integrity Audit</Text>
                    <Text style={{ fontSize: 12, color: "#B91C1C" }}>Check for data consistency.</Text>
                  </View>
                </TouchableOpacity>)}</>
          )}
        </View>

        {/* Audit Results */}
        {(auditResult || auditError) && (
          <View style={{ marginTop: 20, padding: 16, backgroundColor: "white", borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: "bold" }}>Integrity Audit Result</Text>
              <TouchableOpacity onPress={() => { setAuditResult(null); setAuditError(null); }}>
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {auditError && (
              <Text style={{ color: "#DC2626", marginBottom: 8, fontSize: 14 }}>
                ❌ Error: {auditError}
              </Text>
            )}

            {auditResult && (
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 14, color: auditResult.billIssues.length > 0 ? "#DC2626" : "#059669", fontWeight: "500" }}>
                  • Bills: {auditResult.billIssues.length > 0 ? `${auditResult.billIssues.length} mismatch(es)` : "No issues"}
                </Text>
                <Text style={{ fontSize: 14, color: auditResult.creditIssues.length > 0 ? "#DC2626" : "#059669", fontWeight: "500" }}>
                  • Customer Credits: {auditResult.creditIssues.length > 0 ? `${auditResult.creditIssues.length} mismatch(es)` : "No issues"}
                </Text>
                <Text style={{ fontSize: 14, color: auditResult.expenseIssues.length > 0 ? "#DC2626" : "#059669", fontWeight: "500" }}>
                  • Expenses: {auditResult.expenseIssues.length > 0 ? `${auditResult.expenseIssues.length} mismatch(es)` : "No issues"}
                </Text>

                {(auditResult.billIssues.length > 0 || auditResult.creditIssues.length > 0 || auditResult.expenseIssues.length > 0) && (
                  <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 4, fontStyle: "italic" }}>
                    Check console logs for specific IDs and details.
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* Loading Overlay */}
      {loading && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View style={{ backgroundColor: "white", padding: 24, borderRadius: 16, alignItems: "center" }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={{ marginTop: 16, fontWeight: "600", color: theme.colors.text }}>Processing...</Text>
          </View>
        </View>
      )}

      {/* Menu Item Form Modal - Kept minimal for now, or could be extracted */}
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
                placeholder="0.00"
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
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDiagModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
          <View
            style={{
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>
              Diagnostics Results
            </Text>
            <TouchableOpacity onPress={() => setShowDiagModal(false)}>
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: 16 }}>
            {diagResults?.map((r, i) => (
              <View
                key={i}
                style={{
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: r.passed ? "#ecfdf5" : "#fef2f2",
                  borderWidth: 1,
                  borderColor: r.passed ? "#a7f3d0" : "#fecaca",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontWeight: "600" }}>{r.name}</Text>
                  <Text
                    style={{
                      color: r.passed ? "green" : "red",
                      fontWeight: "bold",
                    }}
                  >
                    {r.passed ? "PASS" : "FAIL"}
                  </Text>
                </View>
                <Text style={{ color: theme.colors.textSecondary }}>
                  {r.details || "No details available"}
                </Text>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const DBButton = ({ title, onPress }: { title: string; onPress: () => void }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      flex: 1,
      padding: 8,
      backgroundColor: "white",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      alignItems: "center",
      ...theme.shadows.sm,
    }}
  >
    <Text style={{ fontSize: 11, fontWeight: "600", color: theme.colors.textSecondary }}>{title}</Text>
  </TouchableOpacity>
);

const styles = {
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text,
  },
} as const;
