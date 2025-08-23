import { theme } from "@/constants/theme";
import { runAllSyncDiagnostics, TestResult } from "@/services/syncDiagnostics";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SyncDiagnosticsScreen() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);

  const run = async () => {
    try {
      setRunning(true);
      const res = await runAllSyncDiagnostics();
      setResults(res);
    } finally {
      setRunning(false);
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
            marginBottom: 12,
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
