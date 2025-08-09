import { theme } from "@/constants/theme";
import { Bill, paymentService, Receipt } from "@/services/paymentService";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, CheckCircle, Receipt as ReceiptIcon } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ReceiptScreen() {
  const router = useRouter();
  const {
    billId,
    customerId,
    customerName,
    totalAmount,
    paymentType,
    splitPayments
  } = useLocalSearchParams<{
    billId: string;
    customerId: string;
    customerName: string;
    totalAmount: string;
    paymentType: string;
    splitPayments?: string;
  }>();

  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [bill, setBill] = useState<Bill | null>(null);
  const [error, setError] = useState("");
  const [showPaymentForm, setShowPaymentForm] = useState(true);

  const parsedSplitPayments = splitPayments ? JSON.parse(splitPayments) : [];
  const total = parseFloat(totalAmount || "0");

  const processPayment = async () => {
    try {
      setProcessing(true);
      setError("");
      setShowPaymentForm(false);

      const paymentData = {
        billId,
        customerId,
        customerName,
        totalAmount: total,
        paymentType,
        splitPayments: paymentType === "Split" ? parsedSplitPayments : undefined,
        remarks: remarks.trim() || undefined,
      };

      const result = await paymentService.processPayment(paymentData);
      setReceipt(result.receipt);
      setBill(result.bill);
    } catch (err: any) {
      setError(err.message || "Failed to process payment");
      setShowPaymentForm(true);
      console.error("Payment processing error:", err);
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    // Don't auto-process payment, let user add remarks first
  }, []);

  const handleDone = () => {
    if (!receipt) {
      Alert.alert("Error", "Payment not processed yet");
      return;
    }
    
    // Navigate back to customers list
    router.push("/(tabs)/customers");
  };

  const handleRetry = () => {
    setShowPaymentForm(true);
    setError("");
    setReceipt(null);
    setBill(null);
  };

  // Show payment form with remarks before processing
  if (showPaymentForm && !processing && !receipt) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
        <Stack.Screen
          options={{
            title: "Complete Payment",
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

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {/* Payment Summary */}
          <View style={{
            backgroundColor: "white",
            borderRadius: 16,
            padding: 24,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
            marginBottom: 24,
          }}>
            <Text style={{
              fontSize: 20,
              fontWeight: "600",
              color: theme.colors.text,
              marginBottom: 16,
              textAlign: "center",
            }}>
              Payment Summary
            </Text>

            <View style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 12,
            }}>
              <Text style={{
                fontSize: 14,
                color: theme.colors.textSecondary,
              }}>
                Customer:
              </Text>
              <Text style={{
                fontSize: 14,
                fontWeight: "500",
                color: theme.colors.text,
              }}>
                {customerName}
              </Text>
            </View>

            <View style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 12,
            }}>
              <Text style={{
                fontSize: 14,
                color: theme.colors.textSecondary,
              }}>
                Bill ID:
              </Text>
              <Text style={{
                fontSize: 14,
                fontWeight: "500",
                color: theme.colors.text,
              }}>
                #{billId}
              </Text>
            </View>

            <View style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 16,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: "#f3f4f6",
            }}>
              <Text style={{
                fontSize: 16,
                fontWeight: "600",
                color: theme.colors.text,
              }}>
                Total Amount:
              </Text>
              <Text style={{
                fontSize: 16,
                fontWeight: "700",
                color: theme.colors.text,
              }}>
                ₹{total.toFixed(2)}
              </Text>
            </View>

            {/* Payment Method Details */}
            <View style={{
              backgroundColor: "#f9fafb",
              borderRadius: 8,
              padding: 12,
            }}>
              <Text style={{
                fontSize: 14,
                fontWeight: "500",
                color: theme.colors.text,
                marginBottom: 8,
              }}>
                Payment Method:
              </Text>

              {paymentType === "Split" ? (
                <View>
                  {parsedSplitPayments.map((payment: any, index: number) => (
                    <View key={index} style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}>
                      <Text style={{
                        fontSize: 14,
                        color: theme.colors.textSecondary,
                      }}>
                        {payment.type}:
                      </Text>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: "500",
                        color: theme.colors.text,
                      }}>
                        ₹{payment.amount.toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: theme.colors.text,
                }}>
                  {paymentType}
                </Text>
              )}
            </View>
          </View>

          {/* Remarks Section */}
          <View style={{
            backgroundColor: "white",
            borderRadius: 16,
            padding: 24,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
            marginBottom: 24,
          }}>
            <Text style={{
              fontSize: 16,
              fontWeight: "600",
              color: theme.colors.text,
              marginBottom: 12,
            }}>
              Payment Remarks (Optional)
            </Text>
            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Add any remarks about this payment..."
              multiline
              numberOfLines={4}
              style={{
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 8,
                padding: 12,
                fontSize: 14,
                color: theme.colors.text,
                textAlignVertical: "top",
                minHeight: 100,
              }}
            />
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={{
          backgroundColor: "white",
          borderTopWidth: 1,
          borderTopColor: "#f3f4f6",
          paddingHorizontal: 16,
          paddingVertical: 16,
          flexDirection: "row",
          gap: 12,
        }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              flex: 1,
              backgroundColor: "#f3f4f6",
              paddingVertical: 16,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{
              color: theme.colors.text,
              fontWeight: "600",
              fontSize: 16,
            }}>
              CANCEL
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={processPayment}
            style={{
              flex: 2,
              backgroundColor: "#059669",
              paddingVertical: 16,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{
              color: "white",
              fontWeight: "600",
              fontSize: 16,
            }}>
              PROCESS PAYMENT
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (processing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
        <Stack.Screen
          options={{
            title: "Processing Payment",
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

        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 16 }}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={{
            fontSize: 18,
            fontWeight: "600",
            color: theme.colors.text,
            marginTop: 16,
            textAlign: "center",
          }}>
            Processing Payment...
          </Text>
          <Text style={{
            color: theme.colors.textSecondary,
            marginTop: 8,
            textAlign: "center",
          }}>
            Please wait while we process your payment
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !receipt) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
        <Stack.Screen
          options={{
            title: "Payment Error",
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

        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 16 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>❌</Text>
          <Text style={{
            fontSize: 20,
            fontWeight: "600",
            color: theme.colors.text,
            marginBottom: 8,
            textAlign: "center",
          }}>
            Payment Failed
          </Text>
          <Text style={{
            color: theme.colors.textSecondary,
            textAlign: "center",
            marginBottom: 24,
          }}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={handleRetry}
            style={{
              backgroundColor: "#ef4444",
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: "white", fontWeight: "600" }}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              backgroundColor: "#6b7280",
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "white", fontWeight: "500" }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!receipt || !bill) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
        <Stack.Screen
          options={{
            title: "Receipt",
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

        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 16 }}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={{
            color: theme.colors.textSecondary,
            marginTop: 8,
            textAlign: "center",
          }}>
            Loading receipt...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <Stack.Screen
        options={{
          title: "Payment Receipt",
          headerStyle: { backgroundColor: "white" },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: "600",
            color: theme.colors.text,
          },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/customers")}
              style={{ padding: 8, marginLeft: -8, borderRadius: 8 }}
            >
              <ArrowLeft size={24} color={theme.colors.text} />
            </TouchableOpacity>
          ),
          headerShadowVisible: true,
        }}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Success Icon */}
        <View style={{
          alignItems: "center",
          marginTop: 32,
          marginBottom: 32,
        }}>
          <CheckCircle size={64} color="#059669" />
          <Text style={{
            fontSize: 24,
            fontWeight: "700",
            color: theme.colors.text,
            marginTop: 16,
            textAlign: "center",
          }}>
            Payment Successful!
          </Text>
          <Text style={{
            fontSize: 16,
            color: theme.colors.textSecondary,
            marginTop: 8,
            textAlign: "center",
          }}>
            {paymentType === "Credit" ? "Amount added to customer dues" : "Due amount cleared and added to revenue"}
          </Text>
        </View>

        {/* Receipt Details */}
        <View style={{
          backgroundColor: "white",
          borderRadius: 16,
          padding: 24,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3,
          marginBottom: 24,
        }}>
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}>
            <ReceiptIcon size={24} color="#2563eb" />
            <Text style={{
              fontSize: 20,
              fontWeight: "600",
              color: theme.colors.text,
              marginLeft: 8,
            }}>
              Payment Receipt
            </Text>
          </View>

          <View style={{
            borderTopWidth: 1,
            borderTopColor: "#f3f4f6",
            paddingTop: 16,
          }}>
            <View style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 12,
            }}>
              <Text style={{
                fontSize: 14,
                color: theme.colors.textSecondary,
              }}>
                Receipt No:
              </Text>
              <Text style={{
                fontSize: 14,
                fontWeight: "600",
                color: theme.colors.text,
              }}>
                #{receipt.receiptNo}
              </Text>
            </View>

            <View style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 12,
            }}>
              <Text style={{
                fontSize: 14,
                color: theme.colors.textSecondary,
              }}>
                Bill No:
              </Text>
              <Text style={{
                fontSize: 14,
                fontWeight: "500",
                color: theme.colors.text,
              }}>
                #{bill.billNumber}
              </Text>
            </View>

            <View style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 12,
            }}>
              <Text style={{
                fontSize: 14,
                color: theme.colors.textSecondary,
              }}>
                Customer:
              </Text>
              <Text style={{
                fontSize: 14,
                fontWeight: "500",
                color: theme.colors.text,
              }}>
                {customerName}
              </Text>
            </View>

            <View style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 12,
            }}>
              <Text style={{
                fontSize: 14,
                color: theme.colors.textSecondary,
              }}>
                Date & Time:
              </Text>
              <Text style={{
                fontSize: 14,
                fontWeight: "500",
                color: theme.colors.text,
              }}>
                {new Date(receipt.createdAt).toLocaleDateString("en-IN")} {new Date(receipt.createdAt).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>

            {receipt.remarks && (
              <View style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 12,
              }}>
                <Text style={{
                  fontSize: 14,
                  color: theme.colors.textSecondary,
                }}>
                  Remarks:
                </Text>
                <Text style={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: theme.colors.text,
                  flex: 1,
                  textAlign: "right",
                  marginLeft: 8,
                }}>
                  {receipt.remarks}
                </Text>
              </View>
            )}

            <View style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 16,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: "#f3f4f6",
            }}>
              <Text style={{
                fontSize: 16,
                fontWeight: "600",
                color: theme.colors.text,
              }}>
                Total Amount:
              </Text>
              <Text style={{
                fontSize: 16,
                fontWeight: "700",
                color: theme.colors.text,
              }}>
                ₹{total.toFixed(2)}
              </Text>
            </View>

            {/* Payment Method Details */}
            <View style={{
              backgroundColor: "#f9fafb",
              borderRadius: 8,
              padding: 12,
            }}>
              <Text style={{
                fontSize: 14,
                fontWeight: "500",
                color: theme.colors.text,
                marginBottom: 8,
              }}>
                Payment Method:
              </Text>

              {paymentType === "Split" ? (
                <View>
                  {parsedSplitPayments.map((payment: any, index: number) => (
                    <View key={index} style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}>
                      <Text style={{
                        fontSize: 14,
                        color: theme.colors.textSecondary,
                      }}>
                        {payment.type}:
                      </Text>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: "500",
                        color: theme.colors.text,
                      }}>
                        ₹{payment.amount.toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: theme.colors.text,
                }}>
                  {paymentType}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Thank You Message */}
        <View style={{
          backgroundColor: "#ecfdf5",
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: "#a7f3d0",
          marginBottom: 32,
        }}>
          <Text style={{
            fontSize: 16,
            fontWeight: "500",
            color: "#059669",
            textAlign: "center",
            marginBottom: 4,
          }}>
            Thank you for visiting Chai Point!
          </Text>
          <Text style={{
            fontSize: 14,
            color: "#047857",
            textAlign: "center",
          }}>
            Have a great day! ☕
          </Text>
        </View>
      </ScrollView>

      {/* Done Button */}
      <View style={{
        backgroundColor: "white",
        borderTopWidth: 1,
        borderTopColor: "#f3f4f6",
        paddingHorizontal: 16,
        paddingVertical: 16,
      }}>
        <TouchableOpacity
          onPress={handleDone}
          style={{
            backgroundColor: "#059669",
            paddingVertical: 16,
            borderRadius: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{
            color: "white",
            fontWeight: "600",
            fontSize: 18,
          }}>
            DONE
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
