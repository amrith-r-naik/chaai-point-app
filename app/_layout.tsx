import { use$ } from "@legendapp/state/react";
import { Slot, useRouter, useSegments } from "expo-router";
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import { openDatabase } from "../lib/db";
import { debugDatabase } from "../lib/dbDebug";
import { initializeAuth } from "../services/authService";
import { authState } from "../state/authState";
import "./global.css";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const auth = use$(authState);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize database first
        await openDatabase();
        console.log("Database opened successfully");
        await debugDatabase();

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
    if (!auth.isInitialized) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (auth.user && inAuthGroup) {
      // User is signed in but viewing auth screens, redirect to home
      router.replace("/" as any);
    } else if (!auth.user && !inAuthGroup) {
      // User is not signed in but not viewing auth screens, redirect to login
      router.replace("/(auth)/login");
    }
  }, [auth.user, auth.isInitialized, segments, router]);

  // Show loading screen while initializing
  if (!auth.isInitialized) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-lg text-gray-600 mb-2">Initializing...</Text>
        <Text className="text-sm text-gray-400">Setting up your session</Text>
      </View>
    );
  }

  return <Slot />;
}
