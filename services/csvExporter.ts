// services/csvExporter.ts
// CSV formatting and file export utility

import { ColumnConfig } from "@/types/reports";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

/**
 * Escapes a value for CSV format
 * - Wraps in quotes if contains comma, quote, or newline
 * - Escapes internal quotes by doubling them
 */
function escapeCSVValue(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  // Check if value needs quoting
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    // Escape quotes by doubling them and wrap in quotes
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Formats a number as Indian Rupees (no symbol, just formatted)
 */
export function formatINR(amount: number): string {
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formats a date string for display in reports
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Formats a date for filename (YYYY-MM-DD)
 */
export function formatDateForFilename(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return date.toISOString().split("T")[0];
  } catch {
    return dateStr.replace(/[^0-9-]/g, "");
  }
}

/**
 * Converts an array of objects to CSV string
 */
export function toCSV<T extends Record<string, any>>(
  data: T[],
  columns: ColumnConfig<T>[]
): string {
  if (data.length === 0) {
    // Return just headers if no data
    return columns.map((col) => escapeCSVValue(col.header)).join(",");
  }

  // Build header row
  const headerRow = columns.map((col) => escapeCSVValue(col.header)).join(",");

  // Build data rows
  const dataRows = data.map((row) => {
    return columns
      .map((col) => {
        const rawValue = row[col.key];
        const formattedValue = col.format
          ? col.format(rawValue, row)
          : rawValue;
        return escapeCSVValue(formattedValue);
      })
      .join(",");
  });

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Generates a filename for a report
 */
export function generateReportFilename(
  reportName: string,
  startDate: string,
  endDate: string,
  extension: string = "csv"
): string {
  const sanitizedName = reportName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  const start = formatDateForFilename(startDate);
  const end = formatDateForFilename(endDate);

  return `${sanitizedName}_${start}_to_${end}.${extension}`;
}

/**
 * Generates a ZIP filename for all reports
 */
export function generateZipFilename(
  startDate: string,
  endDate: string
): string {
  const start = formatDateForFilename(startDate);
  const end = formatDateForFilename(endDate);
  return `chaai_point_reports_${start}_to_${end}.zip`;
}

/**
 * Saves CSV content to a file and returns the file URI
 */
export async function saveCSVToFile(
  content: string,
  filename: string
): Promise<string> {
  const directory = FileSystem.documentDirectory;
  if (!directory) {
    throw new Error("Document directory not available");
  }

  const filePath = `${directory}${filename}`;

  await FileSystem.writeAsStringAsync(filePath, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return filePath;
}

/**
 * Checks if sharing is available on this device
 */
export async function isSharingAvailable(): Promise<boolean> {
  return await Sharing.isAvailableAsync();
}

/**
 * Shares a file using the native share sheet
 */
export async function shareFile(
  fileUri: string,
  options?: { mimeType?: string; dialogTitle?: string }
): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error("Sharing is not available on this device");
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: options?.mimeType || "text/csv",
    dialogTitle: options?.dialogTitle || "Export Report",
    UTI: "public.comma-separated-values-text", // iOS UTI for CSV
  });
}

/**
 * Complete export flow: Generate CSV, save to file, and share
 */
export async function exportAndShare<T extends Record<string, any>>(
  data: T[],
  columns: ColumnConfig<T>[],
  filename: string,
  dialogTitle?: string
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    // Generate CSV content
    const csvContent = toCSV(data, columns);

    // Save to file
    const filePath = await saveCSVToFile(csvContent, filename);

    // Share the file
    await shareFile(filePath, {
      mimeType: "text/csv",
      dialogTitle: dialogTitle || `Export ${filename}`,
    });

    return { success: true, filePath };
  } catch (error) {
    console.error("[CSV Export] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Export failed",
    };
  }
}

/**
 * Delete a file from the document directory
 */
export async function deleteFile(fileUri: string): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    }
  } catch (error) {
    console.warn("[CSV Export] Failed to delete file:", error);
  }
}

/**
 * Clean up old report files from the document directory
 */
export async function cleanupOldReports(): Promise<void> {
  try {
    const directory = FileSystem.documentDirectory;
    if (!directory) return;

    const files = await FileSystem.readDirectoryAsync(directory);
    const reportFiles = files.filter(
      (f) => f.endsWith(".csv") || f.endsWith(".zip")
    );

    // Delete report files older than 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    for (const file of reportFiles) {
      const filePath = `${directory}${file}`;
      const info = await FileSystem.getInfoAsync(filePath);
      if (info.exists && info.modificationTime) {
        if (info.modificationTime * 1000 < sevenDaysAgo) {
          await deleteFile(filePath);
        }
      }
    }
  } catch (error) {
    console.warn("[CSV Export] Cleanup failed:", error);
  }
}

/**
 * Estimates time to process rows based on current speed
 */
export function estimateRemainingTime(
  totalRows: number,
  processedRows: number,
  elapsedMs: number
): number {
  if (processedRows === 0 || elapsedMs === 0) {
    // Default estimate: assume 100 rows per second
    return Math.ceil(totalRows / 100);
  }

  const msPerRow = elapsedMs / processedRows;
  const remainingRows = totalRows - processedRows;
  const remainingMs = remainingRows * msPerRow;

  return Math.max(1, Math.ceil(remainingMs / 1000)); // At least 1 second
}

/**
 * Format seconds into human-readable time
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) {
    return `~${seconds} second${seconds !== 1 ? "s" : ""}`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `~${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }

  return `~${minutes}m ${remainingSeconds}s`;
}

// Export the CSV exporter as a singleton-like object
export const csvExporter = {
  toCSV,
  saveCSVToFile,
  shareFile,
  exportAndShare,
  deleteFile,
  cleanupOldReports,
  generateReportFilename,
  generateZipFilename,
  formatINR,
  formatDate,
  formatDateForFilename,
  estimateRemainingTime,
  formatTimeRemaining,
  isSharingAvailable,
};
