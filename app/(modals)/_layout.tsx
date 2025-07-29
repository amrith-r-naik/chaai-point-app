// app/(modals)/_layout.tsx
import { Stack } from "expo-router";

export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        presentation: "modal",
        gestureEnabled: true,
        animation: "slide_from_right",
      }}
    />
  );
}
