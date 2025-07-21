import { Slot } from "expo-router";
import React, { useEffect } from "react";
import { openDatabase } from "../lib/db";
import { debugDatabase } from "../lib/dbDebug";
import "./global.css";

export default function RootLayout() {
  useEffect(() => {
    openDatabase().then(async () => {
      console.log("Database opened successfully");

      // Debug the current database state
      await debugDatabase();

      // TEMPORARY: Recreate the database with correct schema
      // Remove this after running once!
      // const { recreateDatabase, seedTestUser } = await import("../lib/dbDebug");
      // await recreateDatabase();
      // await seedTestUser();
      // console.log("Database recreated and test user seeded");
    });
  }, []);

  return <Slot />;
}
