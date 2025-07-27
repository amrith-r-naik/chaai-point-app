import { logoutUser } from "@/services/authService";
import { authState } from "@/state/authState";
import { use$ } from "@legendapp/state/react";
import { router } from "expo-router";
import React from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function HomeScreen() {
  const auth = use$(authState);

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
      <View className="flex-1 justify-center items-center bg-gray-100">
        <Text className="text-lg text-gray-600">Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-blue-600 pt-12 pb-6 px-6">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-white text-2xl font-bold">
              Welcome Back! 👋
            </Text>
            <Text className="text-blue-100 text-sm mt-1">
              Good to see you again
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-blue-700 px-4 py-2 rounded-lg"
          >
            <Text className="text-white font-medium">Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* User Profile Card */}
      <View className="mx-6 -mt-4 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <Text className="text-lg font-bold text-gray-800 mb-4">
          Profile Information
        </Text>

        <View className="space-y-3">
          <View className="flex-row justify-between py-2 border-b border-gray-100">
            <Text className="text-gray-600 font-medium">User ID:</Text>
            <Text className="text-gray-800 font-mono text-sm">
              {auth.user.id}
            </Text>
          </View>

          <View className="flex-row justify-between py-2 border-b border-gray-100">
            <Text className="text-gray-600 font-medium">Email:</Text>
            <Text className="text-gray-800">{auth.user.email}</Text>
          </View>

          <View className="flex-row justify-between py-2">
            <Text className="text-gray-600 font-medium">Role:</Text>
            <View className="bg-blue-100 px-3 py-1 rounded-full">
              <Text className="text-blue-800 font-medium capitalize">
                {auth.user.role}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View className="mx-6 mt-6">
        <Text className="text-lg font-bold text-gray-800 mb-4">
          Quick Actions
        </Text>

        <View className="space-y-3">
          <TouchableOpacity className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <View className="flex-row items-center">
              <View className="bg-green-100 p-2 rounded-lg mr-3">
                <Text className="text-green-600 text-lg">📊</Text>
              </View>
              <View className="flex-1">
                <Text className="text-gray-800 font-medium">
                  View Dashboard
                </Text>
                <Text className="text-gray-500 text-sm">
                  Check your analytics
                </Text>
              </View>
              <Text className="text-gray-400">→</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <View className="flex-row items-center">
              <View className="bg-purple-100 p-2 rounded-lg mr-3">
                <Text className="text-purple-600 text-lg">⚙️</Text>
              </View>
              <View className="flex-1">
                <Text className="text-gray-800 font-medium">Settings</Text>
                <Text className="text-gray-500 text-sm">
                  Manage your preferences
                </Text>
              </View>
              <Text className="text-gray-400">→</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <View className="flex-row items-center">
              <View className="bg-orange-100 p-2 rounded-lg mr-3">
                <Text className="text-orange-600 text-lg">📱</Text>
              </View>
              <View className="flex-1">
                <Text className="text-gray-800 font-medium">Support</Text>
                <Text className="text-gray-500 text-sm">
                  Get help and assistance
                </Text>
              </View>
              <Text className="text-gray-400">→</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sample Content */}
      <View className="mx-6 mt-6 mb-8">
        <Text className="text-lg font-bold text-gray-800 mb-4">
          Sample Content
        </Text>

        <View className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <Text className="text-gray-700 leading-6">
            This is your home screen! You&apos;re successfully logged in as{" "}
            <Text className="font-semibold text-blue-600">
              {auth.user.email}
            </Text>
            {". "}
            This screen demonstrates the post-login flow with user session
            persistence. Your session will be maintained even if you close and
            reopen the app.
          </Text>

          <View className="mt-4 p-4 bg-gray-50 rounded-lg">
            <Text className="text-sm text-gray-600 font-medium mb-2">
              🚀 What&apos;s next?
            </Text>
            <Text className="text-sm text-gray-600 leading-5">
              You can now add your app&apos;s main features, navigation, and
              business logic. The authentication system is ready and will
              persist user sessions automatically.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
