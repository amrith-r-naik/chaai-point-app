import { use$ } from "@legendapp/state/react";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { openDatabase } from "../lib/db";
import { debugDatabase } from "../lib/dbDebug";
import { validateSessionInBackground } from "../services/authService";
import { authState, loadUserSession } from "../state/authState";
import "./global.css";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  // Granular state subscriptions for optimized re-renders
  const user = use$(authState.user);
  const isInitialized = use$(authState.isInitialized);
  const initError = use$(authState.error);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // PHASE 1: Database initialization (local-only, fast)
        await openDatabase();
        authState.isDbReady.set(true);

        // Debug only in development
        if (__DEV__) {
          await debugDatabase();
        }

        // PHASE 2: Load cached session immediately (instant, no network)
        const cachedUser = await loadUserSession();
        if (cachedUser) {
          // User found in cache - navigate immediately
          authState.user.set(cachedUser);
        }

        // Mark initialized BEFORE network calls for instant UI
        authState.isInitialized.set(true);

        // PHASE 3: Background session validation (non-blocking)
        // This validates the Supabase session and updates role if needed
        validateSessionInBackground();
      } catch (error) {
        console.error("App initialization error:", error);
        authState.error.set(
          error instanceof Error ? error.message : "Initialization failed"
        );
        authState.isInitialized.set(true); // Allow app to show error state
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

  // Show error state if initialization failed
  if (initError && !user) {
    return (
      <View className="flex-1 justify-center items-center bg-white px-6">
        <Text className="text-lg text-red-600 mb-2">Initialization Error</Text>
        <Text className="text-sm text-gray-500 text-center mb-4">
          {initError}
        </Text>
        <Text className="text-xs text-gray-400 text-center">
          Please restart the app. If the problem persists, try reinstalling.
        </Text>
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
