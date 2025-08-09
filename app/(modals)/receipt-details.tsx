import { theme } from "@/constants/theme";
import { paymentService } from "@/services/paymentService";
import { authState } from "@/state/authState";
import { use$ } from "@legendapp/state/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, FileText } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function ReceiptDetailsScreen() {
  const router = useRouter();
  const { receiptId } = useLocalSearchParams<{
    receiptId: string;
  }>();

  const [billDetails, setBillDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const auth = use$(authState);

  const loadBillDetails = useCallback(async () => {
    if (!receiptId || !auth.isDbReady) return;

    try {
      setLoading(true);
      setError("");

      const details = await paymentService.getBillDetails(receiptId);
      if (!details) {
        setError("Receipt not found");
        return;
      }

      setBillDetails(details);
    } catch (err: any) {
      setError(err.message || "Failed to load receipt details");
      console.error("Error loading receipt details:", err);
    } finally {
      setLoading(false);
    }
  }, [receiptId, auth.isDbReady]);

  useEffect(() => {
    loadBillDetails();
  }, [loadBillDetails]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
        <Stack.Screen
          options={{
            title: "Receipt Details",
            headerStyle: { backgroundColor: "white" },
            headerTitleStyle: {
              fontSize: 18,
              fontWeight: "600",
              color: theme.colors.text,
            },
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => router.back()}
                style={{ padding: 8, marginLeft: -8, borderRadius: 8 }}
              >
                <ArrowLeft size={24} color={theme.colors.text} />
              </TouchableOpacity>
            ),
            headerShadowVisible: true,
          }}
        />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={{ color: theme.colors.textSecondary, marginTop: 8 }}>
            Loading receipt details...
          </Text>
        </View>
      </View>
    );
  }

  if (error || !billDetails) {
    return (
      <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
        <Stack.Screen
          options={{
            title: "Receipt Details",
            headerStyle: { backgroundColor: "white" },
            headerTitleStyle: {
              fontSize: 18,
              fontWeight: "600",
              color: theme.colors.text,
            },
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => router.back()}
                style={{ padding: 8, marginLeft: -8, borderRadius: 8 }}
              >
                <ArrowLeft size={24} color={theme.colors.text} />
              </TouchableOpacity>
            ),
            headerShadowVisible: true,
          }}
        />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
          <Text style={{
            fontSize: 20,
            fontWeight: "600",
            color: theme.colors.text,
            marginBottom: 8,
          }}>
            Receipt not found
          </Text>
          <Text style={{
            color: theme.colors.textSecondary,
            textAlign: "center",
            marginBottom: 16,
          }}>
            {error || "Unable to load receipt details"}
          </Text>
          <TouchableOpacity
            onPress={loadBillDetails}
            style={{
              backgroundColor: "#2563eb",
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "white", fontWeight: "500" }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <Stack.Screen
        options={{
          title: "Receipt Details",
          headerStyle: { backgroundColor: "white" },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: "600",
            color: theme.colors.text,
          },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ padding: 8, marginLeft: -8, borderRadius: 8 }}
            >
              <ArrowLeft size={24} color={theme.colors.text} />
            </TouchableOpacity>
          ),
          headerShadowVisible: true,
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {/* Receipt Header */}
        <View style={{
          backgroundColor: "white",
          paddingHorizontal: 16,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: "#f3f4f6",
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View>
              <Text style={{
                fontSize: 24,
                fontWeight: "700",
                color: theme.colors.text,
                marginBottom: 4,
              }}>
                Receipt #{billDetails.receipt.receiptNo}
              </Text>
              <Text style={{
                fontSize: 18,
                fontWeight: "600",
                color: theme.colors.text,
                marginBottom: 4,
              }}>
                {billDetails.customer.name}
              </Text>
              {billDetails.customer.contact && (
                <Text style={{
                  color: theme.colors.textSecondary,
                  fontSize: 14,
                }}>
                  {billDetails.customer.contact}
                </Text>
              )}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{
                color: theme.colors.textSecondary,
                fontSize: 14,
              }}>
                {formatDate(billDetails.receipt.createdAt)} {formatTime(billDetails.receipt.createdAt)}
              </Text>
              <View style={{
                backgroundColor: "#ecfdf5",
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
                marginTop: 4,
              }}>
                <Text style={{
                  color: "#059669",
                  fontSize: 12,
                  fontWeight: "600",
                }}>
                  {billDetails.receipt.mode}
                </Text>
              </View>
            </View>
          </View>

          {/* Amount */}
          <View style={{
            backgroundColor: "#f9fafb",
            borderRadius: 12,
            padding: 16,
            marginTop: 16,
          }}>
            <Text style={{
              fontSize: 14,
              color: theme.colors.textSecondary,
              marginBottom: 4,
            }}>
              Amount Paid
            </Text>
            <Text style={{
              fontSize: 32,
              fontWeight: "700",
              color: theme.colors.text,
            }}>
              ₹{billDetails.receipt.amount.toFixed(2)}
            </Text>
          </View>

          {/* Remarks */}
          {billDetails.receipt.remarks && (
            <View style={{
              backgroundColor: "#f0f9ff",
              borderRadius: 12,
              padding: 16,
              marginTop: 12,
            }}>
              <Text style={{
                fontSize: 14,
                color: theme.colors.textSecondary,
                marginBottom: 4,
              }}>
                Remarks
              </Text>
              <Text style={{
                fontSize: 16,
                color: theme.colors.text,
              }}>
                {billDetails.receipt.remarks}
              </Text>
            </View>
          )}
        </View>

          {/* Split Payment Breakdown */}
          {billDetails.splitPayments && billDetails.splitPayments.length > 0 && (
            <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                <Text style={{ fontSize: 20, marginRight: 8 }}>💳</Text>
                <Text style={{
                  fontSize: 18,
                  fontWeight: "600",
                  color: theme.colors.text,
                }}>
                  Payment Breakdown
                </Text>
              </View>

              <View style={{
                backgroundColor: "white",
                borderRadius: 12,
                padding: 16,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 2,
              }}>
                {billDetails.splitPayments.map((split: any, index: number) => (
                  <View
                    key={split.id}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingVertical: 12,
                      borderBottomWidth: index < billDetails.splitPayments.length - 1 ? 1 : 0,
                      borderBottomColor: "#f3f4f6",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <View style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: split.paymentType === "Credit" 
                          ? "#f59e0b" 
                          : split.paymentType === "Cash" 
                            ? "#10b981" 
                            : "#3b82f6",
                        marginRight: 12,
                      }} />
                      <Text style={{
                        fontSize: 16,
                        fontWeight: "500",
                        color: theme.colors.text,
                      }}>
                        {split.paymentType}
                      </Text>
                    </View>
                    <Text style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: theme.colors.text,
                    }}>
                      ₹{split.amount.toFixed(2)}
                    </Text>
                  </View>
                ))}
                
                {/* Total */}
                <View style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: 16,
                  marginTop: 8,
                  borderTopWidth: 2,
                  borderTopColor: "#e5e7eb",
                }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: theme.colors.text,
                  }}>
                    Total Paid
                  </Text>
                  <Text style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: theme.colors.text,
                  }}>
                    ₹{billDetails.receipt.amount.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* KOT Details */}
        {billDetails.kots && billDetails.kots.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
              <FileText size={20} color={theme.colors.text} />
              <Text style={{
                fontSize: 18,
                fontWeight: "600",
                color: theme.colors.text,
                marginLeft: 8,
              }}>
                KOT Details
              </Text>
            </View>

            {billDetails.kots.map((kot: any, index: number) => (
              <View
                key={kot.id}
                style={{
                  backgroundColor: "white",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: theme.colors.text,
                  }}>
                    KOT-{kot.kotNumber}
                  </Text>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: theme.colors.text,
                  }}>
                    ₹{kot.total.toFixed(2)}
                  </Text>
                </View>
                <Text style={{
                  color: theme.colors.textSecondary,
                  fontSize: 14,
                  marginBottom: 8,
                }}>
                  {formatTime(kot.createdAt)}
                </Text>
                <Text style={{
                  color: theme.colors.text,
                  fontSize: 14,
                  lineHeight: 20,
                }}>
                  {kot.items}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Spacer */}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}
