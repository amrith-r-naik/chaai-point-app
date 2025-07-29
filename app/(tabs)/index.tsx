import { Button, Card, Loading, Typography } from "@/components/ui";
import { theme } from "@/constants/theme";
import { logoutUser } from "@/services/authService";
import { authState } from "@/state/authState";
import { use$ } from "@legendapp/state/react";
import { router } from "expo-router";
import {
  BarChart3,
  Hash,
  Headphones,
  LogOut,
  Mail,
  Settings,
  Shield,
} from "lucide-react-native";
import React from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onPress?: () => void;
  iconBgColor?: string;
  iconColor?: string;
}

const QuickAction: React.FC<QuickActionProps> = ({
  title,
  description,
  icon,
  onPress,
  iconBgColor = theme.colors.primaryLight,
  iconColor = theme.colors.primary,
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      backgroundColor: "white",
      padding: 16,
      borderRadius: theme.borderRadius.lg,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...theme.shadows.sm,
    }}
    activeOpacity={0.7}
  >
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View
        style={{
          width: 48,
          height: 48,
          backgroundColor: iconBgColor,
          borderRadius: theme.borderRadius.md,
          justifyContent: "center",
          alignItems: "center",
          marginRight: 16,
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Typography
          variant="body"
          weight="semibold"
          style={{ marginBottom: 2 }}
        >
          {title}
        </Typography>
        <Typography variant="caption" color="textSecondary">
          {description}
        </Typography>
      </View>
      <Typography variant="h4" color="textSecondary">
        →
      </Typography>
    </View>
  </TouchableOpacity>
);

export default function HomeScreen() {
  const auth = use$(authState);
  const insets = useSafeAreaInsets();

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await logoutUser();
            router.replace("/(auth)/login");
          } catch (error) {
            console.error("Logout error:", error);
            Alert.alert("Error", "Failed to logout. Please try again.");
          }
        },
      },
    ]);
  };

  if (!auth.user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <Loading message="Loading your dashboard..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View
          style={{
            backgroundColor: theme.colors.primary,
            paddingTop: insets.top + 20,
            paddingBottom: 32,
            paddingHorizontal: 24,
            borderBottomLeftRadius: theme.borderRadius.xl,
            borderBottomRightRadius: theme.borderRadius.xl,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <View style={{ flex: 1 }}>
              <Typography
                variant="h2"
                style={{ color: "white", marginBottom: 4 }}
              >
                Welcome Back! 👋
              </Typography>
              <Typography style={{ color: "rgba(255,255,255,0.8)" }}>
                Good to see you again
              </Typography>
            </View>
            <Button
              title="Logout"
              onPress={handleLogout}
              variant="secondary"
              size="sm"
              style={{
                backgroundColor: "rgba(255,255,255,0.2)",
                borderColor: "rgba(255,255,255,0.3)",
              }}
              textStyle={{ color: "white" }}
              icon={<LogOut size={16} color="white" />}
            />
          </View>
        </View>

        {/* Profile Card */}
        <View style={{ paddingHorizontal: 24, marginTop: -16 }}>
          <Card shadow="md" rounded="xl" style={{ marginBottom: 24 }}>
            <Typography variant="h4" style={{ marginBottom: 16 }}>
              Profile Information
            </Typography>

            <View style={{ gap: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.borderLight,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Hash
                    size={16}
                    color={theme.colors.textSecondary}
                    style={{ marginRight: 8 }}
                  />
                  <Typography color="textSecondary">User ID:</Typography>
                </View>
                <Typography
                  variant="caption"
                  style={{
                    fontFamily: "monospace",
                    backgroundColor: theme.colors.surface,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 4,
                  }}
                >
                  {auth.user.id}
                </Typography>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.borderLight,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Mail
                    size={16}
                    color={theme.colors.textSecondary}
                    style={{ marginRight: 8 }}
                  />
                  <Typography color="textSecondary">Email:</Typography>
                </View>
                <Typography>{auth.user.email}</Typography>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 8,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Shield
                    size={16}
                    color={theme.colors.textSecondary}
                    style={{ marginRight: 8 }}
                  />
                  <Typography color="textSecondary">Role:</Typography>
                </View>
                <View
                  style={{
                    backgroundColor: theme.colors.primaryLight,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: theme.borderRadius.full,
                  }}
                >
                  <Typography
                    variant="caption"
                    color="primary"
                    weight="semibold"
                    style={{ textTransform: "capitalize" }}
                  >
                    {auth.user.role}
                  </Typography>
                </View>
              </View>
            </View>
          </Card>
        </View>

        {/* Quick Actions */}
        <View style={{ paddingHorizontal: 24 }}>
          <Typography variant="h4" style={{ marginBottom: 16 }}>
            Quick Actions
          </Typography>

          <View style={{ gap: 8 }}>
            <QuickAction
              title="View Dashboard"
              description="Check your analytics"
              icon={<BarChart3 size={24} color={theme.colors.success} />}
              iconBgColor={theme.colors.successLight}
              iconColor={theme.colors.success}
            />

            {/* Admin Settings - Only show for admin users */}
            {auth.user?.role === "admin" && (
              <QuickAction
                title="Admin Settings"
                description="Manage menu items and database"
                icon={<Settings size={24} color="#8b5cf6" />}
                iconBgColor="#f3e8ff"
                iconColor="#8b5cf6"
                onPress={() => router.push("/admin-settings")}
              />
            )}

            <QuickAction
              title="Support"
              description="Get help when you need it"
              icon={<Headphones size={24} color={theme.colors.warning} />}
              iconBgColor={theme.colors.warningLight}
              iconColor={theme.colors.warning}
            />
          </View>
        </View>

        {/* Bottom Spacing for Tab Bar */}
        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
