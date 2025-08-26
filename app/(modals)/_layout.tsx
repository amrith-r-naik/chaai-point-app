// app/(modals)/_layout.tsx
import { Stack } from "expo-router";

export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        presentation: "modal",
        gestureEnabled: true,
        // Use a lighter animation for better perceived performance on Android
        animation: "fade_from_bottom",
      }}
    />
  );
}
