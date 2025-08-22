import { supabase } from "@/lib/supabase";
import * as FileSystem from "expo-file-system";

function toDbPath(dbName = "chaai-point.db") {
  // Expo SQLite stores DBs under <documentDirectory>/SQLite/
  return `${FileSystem.documentDirectory}SQLite/${dbName}`;
}

function isoForFilename(d: Date = new Date()) {
  // Make a filename-safe ISO (no colons)
  return d.toISOString().replace(/[:]/g, "-");
}

function base64ToUint8(base64: string): Uint8Array {
  // Polyfill atob for React Native using global Buffer if available
  // Fallback: manual decode
  const binary = (globalThis as any).atob
    ? (globalThis as any).atob(base64)
    : Buffer.from(base64, "base64").toString("binary");
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const backupService = {
  async backupNow(shopId = "shop_1") {
    const dbPath = toDbPath();
    const exists = await FileSystem.getInfoAsync(dbPath);
    if (!exists.exists) {
      throw new Error(`Database not found at ${dbPath}`);
    }
    // Read as base64 and convert to bytes for upload
    const base64 = await FileSystem.readAsStringAsync(dbPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const bytes = base64ToUint8(base64);
    const fileName = `chaai-point-${isoForFilename()}.db`;
    const objectPath = `${shopId}/${fileName}`;

    const { error } = await supabase.storage
      .from("backups")
      .upload(objectPath, bytes, {
        contentType: "application/octet-stream",
        upsert: false,
      });
    if (error) {
      console.error("[backup] upload failed", { error });
      throw error;
    }
    return { objectPath, bytes: bytes.byteLength };
  },

  async listBackups(shopId = "shop_1") {
    const { data, error } = await supabase.storage
      .from("backups")
      .list(shopId, { limit: 50, sortBy: { column: "name", order: "desc" } });
    if (error) throw error;
    return data || [];
  },

  async getLatestBackup(shopId = "shop_1") {
    const files = await this.listBackups(shopId);
    if (!files.length) return null;
    // Names contain ISO-like timestamp; desc sort gives latest first
    return files[0];
  },
};
