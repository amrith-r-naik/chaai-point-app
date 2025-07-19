import { openDatabase } from "@/lib/db";
import { Stack } from "expo-router";
import { useEffect } from "react";
import "./global.css";

export default function RootLayout() {
  useEffect(() => {
    openDatabase()
      .then(() => {
        console.log("SQLite DB Ready");
      })
      .catch((error) => {
        console.error("Failed to open database:", error);
      });
  }, []);
  return <Stack />;
}
