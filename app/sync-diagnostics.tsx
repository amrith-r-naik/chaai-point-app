import { theme } from "@/constants/theme";
import { runAllSyncDiagnostics, TestResult } from "@/services/syncDiagnostics";
import { syncService } from "@/services/syncService";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface SyncCheckpoint {
  tableName: string;
  lastPushAt: string | null;
  lastPullAt: string | null;
}

export default function SyncDiagnosticsScreen() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [checkpoints, setCheckpoints] = useState<SyncCheckpoint[]>([]);

  useEffect(() => {
    loadCheckpoints();
  }, []);

  const loadCheckpoints = async () => {
    try {
      const data = await syncService.getAllSyncCheckpoints();
      setCheckpoints(data);
    } catch (error) {
      console.error("Failed to load sync checkpoints:", error);
    }
  };

  const run = async () => {
    try {
      setRunning(true);
      const res = await runAllSyncDiagnostics();
      setResults(res);
      // Reload checkpoints after diagnostics
      await loadCheckpoints();
    } finally {
      setRunning(false);
    }
  };

  const formatTime = (isoString: string | null): string => {
    if (!isoString) return "Never";
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch {
      return isoString;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <SafeAreaView edges={["top"]}>
        <View
          style={{
            padding: 16,
            backgroundColor: theme.colors.primary,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: "white", fontSize: 20, fontWeight: "700" }}>
            Sync Diagnostics
          </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: "white" }}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <ScrollView style={{ flex: 1, padding: 16 }}>
        <TouchableOpacity
          onPress={run}
          disabled={running}
          style={{
            backgroundColor: running ? "#9CA3AF" : theme.colors.primary,
            borderRadius: 8,
            paddingVertical: 12,
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          {running ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "white", fontWeight: "600" }}>
              Run All Tests
            </Text>
          )}
        </TouchableOpacity>

        {/* Sync Checkpoints Section */}
        <View
          style={{
            backgroundColor: theme.colors.background,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "bold",
              color: theme.colors.text,
              marginBottom: 12,
            }}
          >
            Last Sync Times
          </Text>
          {checkpoints.length === 0 ? (
            <Text style={{ color: theme.colors.textSecondary }}>
              No sync data yet
            </Text>
          ) : (
            <View>
              {checkpoints.map((cp) => (
                <View
                  key={cp.tableName}
                  style={{
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: theme.colors.text,
                      marginBottom: 4,
                    }}
                  >
                    {cp.tableName}
                  </Text>
                  <View style={{ marginLeft: 8 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#10B981",
                        marginBottom: 2,
                      }}
                    >
                      ↓ Pull: {formatTime(cp.lastPullAt)}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#3B82F6" }}>
                      ↑ Push: {formatTime(cp.lastPushAt)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Diagnostics Results Section */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: "bold",
            color: theme.colors.text,
            marginBottom: 12,
          }}
        >
          Diagnostic Tests
        </Text>
        {results &&
          results.map((r, idx) => (
            <View
              key={idx}
              style={{
                backgroundColor: theme.colors.background,
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: 8,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <Text style={{ fontWeight: "600", color: theme.colors.text }}>
                {r.name}
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  color: r.passed ? "#16a34a" : "#dc2626",
                }}
              >
                {r.passed ? "PASS" : "FAIL"}
              </Text>
              {r.details ? (
                <Text
                  style={{ marginTop: 4, color: theme.colors.textSecondary }}
                >
                  {r.details}
                </Text>
              ) : null}
            </View>
          ))}
      </ScrollView>
    </View>
  );
}
