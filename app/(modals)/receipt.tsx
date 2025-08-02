import { theme } from "@/constants/theme";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, CheckCircle } from "lucide-react-native";
import React from "react";
import {
  ScrollView,
  Text,
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

  const parsedSplitPayments = splitPayments ? JSON.parse(splitPayments) : [];
  const total = parseFloat(totalAmount || "0");

  const handleDone = () => {
    // Navigate back to the main app
    router.push("/(tabs)/customers");
  };

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
            Thank you for your payment
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
          <Text style={{
            fontSize: 20,
            fontWeight: "600",
            color: theme.colors.text,
            marginBottom: 16,
            textAlign: "center",
          }}>
            Payment Receipt
          </Text>

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
                Bill No:
              </Text>
              <Text style={{
                fontSize: 14,
                fontWeight: "500",
                color: theme.colors.text,
              }}>
                {billId}
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
                {new Date().toLocaleDateString("en-IN")} {new Date().toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
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

        {/* Development Notice */}
        <View style={{
          backgroundColor: "#fef3c7",
          borderRadius: 8,
          padding: 12,
          borderWidth: 1,
          borderColor: "#fbbf24",
          marginBottom: 32,
        }}>
          <Text style={{
            fontSize: 12,
            color: "#92400e",
            textAlign: "center",
          }}>
            🚧 This is a demo receipt page. Full receipt functionality will be implemented later.
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
