import { use$ } from "@legendapp/state/react";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { openDatabase } from "../lib/db";
import { debugDatabase } from "../lib/dbDebug";
import { initializeAuth } from "../services/authService";
import { authState } from "../state/authState";
import "./global.css";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  // Granular state subscriptions for optimized re-renders
  const user = use$(authState.user);
  const isInitialized = use$(authState.isInitialized);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize database first
        await openDatabase();
        console.log("Database opened successfully");
        await debugDatabase();
        // No user bootstrap: use Supabase Auth sign-in only
        // await seedTestCustomers();
        // await seedTestMenuItems();
        // await seedTestOrders();

        // Mark database as ready
        authState.isDbReady.set(true);

        // Add a small delay to ensure everything is properly initialized
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Then initialize auth (check for existing session)
        await initializeAuth();
      } catch (error) {
        console.error("App initialization error:", error);
        authState.isInitialized.set(true);
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (user && inAuthGroup) {
      // User is signed in but viewing auth screens, redirect to home
      router.replace("/" as any);
    } else if (!user && !inAuthGroup) {
      // User is not signed in but not viewing auth screens, redirect to login
      router.replace("/(auth)/login");
    }
  }, [user, isInitialized, segments, router]);

  // Auto-sync removed - using manual Push/Pull only

  // Show loading screen while initializing
  if (!isInitialized) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-lg text-gray-600 mb-2">Initializing...</Text>
        <Text className="text-sm text-gray-400">Setting up your session</Text>
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen
        name="(modals)"
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen name="admin-settings" options={{ headerShown: false }} />
      <Stack.Screen name="menu-management" options={{ headerShown: false }} />
      <Stack.Screen name="customer-details" options={{ headerShown: false }} />
      <Stack.Screen name="order-summary" options={{ headerShown: false }} />
    </Stack>
  );
}
