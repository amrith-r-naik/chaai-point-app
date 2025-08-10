import { PaymentTypeModal } from "@/components/payment/PaymentTypeModal";
import { SplitPaymentModal } from "@/components/payment/SplitPaymentModal";
import { ENABLE_NEW_PAYMENT_FLOW, PaymentMode, SettlementType } from "@/constants/paymentConstants";
import { theme } from "@/constants/theme";
import { usePaymentState } from "@/hooks/usePaymentState";
import { paymentService } from "@/services/paymentService";
import { authState } from "@/state/authState";
import { PaymentType } from "@/types/payment";
import { use$ } from "@legendapp/state/react";
import { router, useLocalSearchParams } from "expo-router";
import {
    ArrowLeft,
    Calendar,
    ChevronDown,
    ChevronRight,
    Clock,
    CreditCard,
    DollarSign,
    FileText,
    History,
    Receipt,
    TrendingUp,
    Wallet
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

interface BillData {
  id: string;
  billNumber: string;
  date: string;
  time: string;
  total: number;
  settlementType: SettlementType;
  paidPortion: number;
  creditPortion: number;
  kots: KOTData[];
}

interface KOTData {
  id: string;
  kotNumber: string;
  time: string;
  items: string;
  total: number;
}

interface PaymentHistoryItem {
  id: string;
  timestamp: string;
  type: PaymentMode;
  amount: number;
  splitBreakdown?: { mode: PaymentMode; amount: number }[];
  receiptId?: string;
}

interface CustomerStats {
  totalBills: number;
  totalAmount: number;
  paidAmount: number;
  creditAmount: number;
  creditBalance: number;
}

export default function EnhancedCustomerDetailsScreen() {
  const { customerId, customerName } = useLocalSearchParams<{
    customerId: string;
    customerName: string;
  }>();

  const [bills, setBills] = useState<BillData[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedBills, setExpandedBills] = useState<Set<string>>(new Set());
  const [showCreditClearModal, setShowCreditClearModal] = useState(false);
  const [clearanceAmount, setClearanceAmount] = useState('');
  const [clearanceRemarks, setClearanceRemarks] = useState('');
  const [processingClearance, setProcessingClearance] = useState(false);
  const [showPaymentTypeModal, setShowPaymentTypeModal] = useState(false);

  // Initialize payment state for credit clearance
  const creditClearancePaymentState = usePaymentState({ 
    totalAmount: parseFloat(clearanceAmount) || 0 
  });

  const {
    selectedPaymentType,
    showSplitPayment,
    splitPayments,
    handlePaymentTypeSelect,
    validatePayment,
    setSelectedPaymentType,
    setShowSplitPayment,
  } = creditClearancePaymentState;
  
  const auth = use$(authState);

  const loadCustomerData = useCallback(async () => {
    if (!customerId || !auth.isDbReady) return;

    try {
      setLoading(true);

      // Load bills and KOT hierarchy
      const customerBills = await loadCustomerBills(customerId);
      setBills(customerBills);

      // Load payment history
      const history = await loadPaymentHistory(customerId);
      setPaymentHistory(history);

      // Calculate stats
      const customerStats = calculateStats(customerBills);
      const creditBalance = await paymentService.getCustomerCreditBalance(customerId);
      setStats({ ...customerStats, creditBalance });

    } catch (error) {
      console.error("Error loading customer data:", error);
      Alert.alert("Error", "Failed to load customer data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customerId, auth.isDbReady]);

  const loadCustomerBills = async (customerId: string): Promise<BillData[]> => {
    // This would implement the bill + KOT hierarchy loading
    // For now, return mock data structure
    return [];
  };

  const loadPaymentHistory = async (customerId: string): Promise<PaymentHistoryItem[]> => {
    const payments = await paymentService.getPaymentHistory(customerId);
    
    return payments.map(payment => ({
      id: payment.id,
      timestamp: payment.createdAt,
      type: payment.mode as PaymentMode,
      amount: payment.amount,
      receiptId: payment.billId || undefined,
    }));
  };

  const calculateStats = (bills: BillData[]): Omit<CustomerStats, 'creditBalance'> => {
    let totalBills = bills.length;
    let totalAmount = 0;
    let paidAmount = 0;
    let creditAmount = 0;

    bills.forEach(bill => {
      totalAmount += bill.total;
      paidAmount += bill.paidPortion;
      creditAmount += bill.creditPortion;
    });

    return {
      totalBills,
      totalAmount,
      paidAmount,
      creditAmount,
    };
  };

  useEffect(() => {
    loadCustomerData();
  }, [loadCustomerData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadCustomerData();
  };

  const toggleBillExpanded = (billId: string) => {
    const newExpanded = new Set(expandedBills);
    if (newExpanded.has(billId)) {
      newExpanded.delete(billId);
    } else {
      newExpanded.add(billId);
    }
    setExpandedBills(newExpanded);
  };

  const handleClearCreditPress = () => {
    if (!stats || stats.creditBalance <= 0) {
      Alert.alert("No Credit", "This customer has no outstanding credit balance.");
      return;
    }

    setClearanceAmount(stats.creditBalance.toString());
    setSelectedPaymentType(null);
    setShowCreditClearModal(true);
  };

  const handleSelectPaymentType = (type: PaymentType) => {
    handlePaymentTypeSelect(type);
    setShowPaymentTypeModal(false);
  };

  const processCreditClearance = async () => {
    if (!ENABLE_NEW_PAYMENT_FLOW) {
      Alert.alert("Error", "Credit clearance not available in legacy mode");
      return;
    }

    const amount = parseFloat(clearanceAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    if (amount > (stats?.creditBalance || 0)) {
      Alert.alert("Error", "Amount exceeds credit balance");
      return;
    }

    if (!selectedPaymentType) {
      Alert.alert("Error", "Please select a payment method");
      return;
    }

    if (!validatePayment()) {
      Alert.alert("Error", "Invalid payment configuration");
      return;
    }

    try {
      setProcessingClearance(true);

      let components;
      if (selectedPaymentType === "Split") {
        // Convert split payments to components
        components = splitPayments
          .filter(split => split.type !== "Credit")
          .map(split => ({
            mode: split.type === "Cash" ? PaymentMode.CASH : PaymentMode.UPI,
            amount: split.amount
          }));
      } else {
        // Single payment mode
        components = [{
          mode: selectedPaymentType === "Cash" ? PaymentMode.CASH : PaymentMode.UPI,
          amount: amount
        }];
      }

      const result = await paymentService.clearCredit(customerId, components, clearanceRemarks);
      
      Alert.alert("Success", result.toastMessage);
      setShowCreditClearModal(false);
      setClearanceAmount('');
      setClearanceRemarks('');
      setSelectedPaymentType(null);
      loadCustomerData(); // Refresh data

    } catch (error: any) {
      console.error("Credit clearance error:", error);
      Alert.alert("Error", error.message || "Failed to clear credit");
    } finally {
      setProcessingClearance(false);
    }
  };

  const getSettlementBadge = (type: SettlementType) => {
    switch (type) {
      case SettlementType.FULLY_PAID:
        return { bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0', label: 'Fully Paid' };
      case SettlementType.PARTIALLY_PAID:
        return { bg: '#fef3c7', text: '#d97706', border: '#fde68a', label: 'Partially Paid' };
      case SettlementType.FULLY_CREDIT:
        return { bg: '#fee2e2', text: '#dc2626', border: '#fecaca', label: 'Fully Credit' };
    }
  };

  const getPaymentTypeBadge = (type: PaymentMode) => {
    switch (type) {
      case PaymentMode.CREDIT:
        return { bg: '#fef3c7', text: '#d97706', label: '+ Credit' };
      case PaymentMode.CREDIT_CLEAR:
        return { bg: '#dcfce7', text: '#16a34a', label: 'Credit Clear' };
      case PaymentMode.CASH:
      case PaymentMode.UPI:
      case PaymentMode.SPLIT:
        return { bg: '#e0f2fe', text: '#0369a1', label: 'Paid' };
      default:
        return { bg: '#f3f4f6', text: '#6b7280', label: type };
    }
  };

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderBillItem = ({ item }: { item: BillData }) => {
    const isExpanded = expandedBills.has(item.id);
    const badgeStyle = getSettlementBadge(item.settlementType);

    return (
      <View style={{
        backgroundColor: theme.colors.background,
        marginHorizontal: 16,
        marginVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadows.sm,
      }}>
        <TouchableOpacity
          onPress={() => toggleBillExpanded(item.id)}
          style={{ padding: 16 }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: theme.colors.text,
                  marginRight: 8,
                }}>
                  Bill #{item.billNumber}
                </Text>
                <View style={{
                  backgroundColor: badgeStyle.bg,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: badgeStyle.border,
                }}>
                  <Text style={{
                    fontSize: 10,
                    fontWeight: "600",
                    color: badgeStyle.text,
                  }}>
                    {badgeStyle.label}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                <Calendar size={14} color={theme.colors.textSecondary} />
                <Text style={{
                  fontSize: 14,
                  color: theme.colors.textSecondary,
                  marginLeft: 4,
                }}>
                  {formatDate(item.date)} at {item.time}
                </Text>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{
                  fontSize: 18,
                  fontWeight: "bold",
                  color: theme.colors.primary,
                }}>
                  {formatCurrency(item.total)}
                </Text>

                {item.settlementType === SettlementType.PARTIALLY_PAID && (
                  <Text style={{
                    fontSize: 12,
                    color: theme.colors.textSecondary,
                  }}>
                    Paid: {formatCurrency(item.paidPortion)} • Credit: {formatCurrency(item.creditPortion)}
                  </Text>
                )}
              </View>
            </View>

            <View style={{ marginLeft: 8 }}>
              {isExpanded ? 
                <ChevronDown size={20} color={theme.colors.textSecondary} /> :
                <ChevronRight size={20} color={theme.colors.textSecondary} />
              }
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={{
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            paddingHorizontal: 16,
            paddingBottom: 16,
          }}>
            <Text style={{
              fontSize: 14,
              fontWeight: "600",
              color: theme.colors.text,
              marginBottom: 8,
            }}>
              KOTs ({item.kots.length})
            </Text>
            {item.kots.map((kot) => (
              <View key={kot.id} style={{
                backgroundColor: "#f9fafb",
                padding: 12,
                borderRadius: 8,
                marginBottom: 8,
              }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600" }}>KOT #{kot.kotNumber}</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600" }}>{formatCurrency(kot.total)}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                  <Clock size={12} color={theme.colors.textSecondary} />
                  <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginLeft: 4 }}>
                    {kot.time}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                  {kot.items}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderPaymentItem = ({ item }: { item: PaymentHistoryItem }) => {
    const badgeStyle = getPaymentTypeBadge(item.type);

    return (
      <TouchableOpacity
        onPress={() => {
          if (item.receiptId) {
            router.push({
              pathname: "/(modals)/receipt-details",
              params: { receiptId: item.receiptId }
            });
          }
        }}
        style={{
          backgroundColor: theme.colors.background,
          marginHorizontal: 16,
          marginVertical: 4,
          borderRadius: 8,
          padding: 12,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <View style={{
                backgroundColor: badgeStyle.bg,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 6,
                marginRight: 8,
              }}>
                <Text style={{
                  fontSize: 10,
                  fontWeight: "600",
                  color: badgeStyle.text,
                }}>
                  {badgeStyle.label}
                </Text>
              </View>
              <Text style={{
                fontSize: 12,
                color: theme.colors.textSecondary,
              }}>
                {formatDate(item.timestamp)} at {formatTime(item.timestamp)}
              </Text>
            </View>

            {item.splitBreakdown && (
              <Text style={{
                fontSize: 12,
                color: theme.colors.textSecondary,
                marginBottom: 4,
              }}>
                {item.splitBreakdown.map(split => 
                  `${split.mode} ${formatCurrency(split.amount)}`
                ).join(' • ')}
              </Text>
            )}
          </View>

          <Text style={{
            fontSize: 16,
            fontWeight: "600",
            color: item.type === PaymentMode.CREDIT ? '#d97706' : theme.colors.text,
          }}>
            {formatCurrency(item.amount)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ marginTop: 16, color: theme.colors.textSecondary }}>
            Loading customer details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      {/* Header */}
      <View style={{
        backgroundColor: theme.colors.primary,
        paddingTop: 20,
        paddingBottom: 40,
        paddingHorizontal: 16,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              padding: 8,
              marginRight: 8,
              borderRadius: 8,
              backgroundColor: "rgba(255,255,255,0.1)",
            }}
          >
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <Text style={{
            color: "white",
            fontSize: 24,
            fontWeight: "bold",
            flex: 1,
          }}>
            {customerName}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, marginTop: -20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Credit Summary Widget */}
        {stats && stats.creditBalance > 0 && (
          <View style={{
            backgroundColor: "#fef3c7",
            marginHorizontal: 16,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderLeftWidth: 4,
            borderLeftColor: "#d97706",
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Wallet size={20} color="#d97706" />
                  <Text style={{ color: "#92400e", fontWeight: "700", fontSize: 16 }}>
                    Outstanding Credit
                  </Text>
                </View>
                <Text style={{ color: "#d97706", fontSize: 24, fontWeight: "bold" }}>
                  {formatCurrency(stats.creditBalance)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleClearCreditPress}
                style={{
                  backgroundColor: "#d97706",
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: "white", fontWeight: "600" }}>
                  Clear Credit
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Overview Stats */}
        {stats && (
          <View style={{
            backgroundColor: "white",
            marginHorizontal: 16,
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            ...theme.shadows.sm,
          }}>
            <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16, color: theme.colors.text }}>
              Overview
            </Text>

            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginBottom: 4 }}>
                  Total Bills
                </Text>
                <Text style={{ fontSize: 20, fontWeight: "bold", color: theme.colors.text }}>
                  {stats.totalBills}
                </Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginBottom: 4 }}>
                  Total Value
                </Text>
                <Text style={{ fontSize: 20, fontWeight: "bold", color: theme.colors.text }}>
                  {formatCurrency(stats.totalAmount)}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{
                flex: 1,
                backgroundColor: "#dcfce7",
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#bbf7d0",
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <TrendingUp size={16} color="#16a34a" />
                  <Text style={{ color: "#16a34a", fontSize: 12, fontWeight: "600" }}>
                    Paid
                  </Text>
                </View>
                <Text style={{ color: "#16a34a", fontSize: 14, fontWeight: "600" }}>
                  {formatCurrency(stats.paidAmount)}
                </Text>
              </View>

              <View style={{
                flex: 1,
                backgroundColor: "#fef3c7",
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#fde68a",
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <CreditCard size={16} color="#d97706" />
                  <Text style={{ color: "#d97706", fontSize: 12, fontWeight: "600" }}>
                    Credit
                  </Text>
                </View>
                <Text style={{ color: "#d97706", fontSize: 14, fontWeight: "600" }}>
                  {formatCurrency(stats.creditAmount)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Bills & KOT Hierarchy */}
        <View style={{
          backgroundColor: "white",
          marginHorizontal: 16,
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          ...theme.shadows.sm,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <FileText size={20} color={theme.colors.text} />
            <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.colors.text }}>
              Bills & KOTs
            </Text>
          </View>

          {bills.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 32 }}>
              <Receipt size={48} color={theme.colors.textSecondary} />
              <Text style={{ color: theme.colors.textSecondary, textAlign: "center", marginTop: 12 }}>
                No bills found for this customer
              </Text>
            </View>
          ) : (
            <FlatList
              data={bills}
              keyExtractor={(item) => item.id}
              renderItem={renderBillItem}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* Payment History */}
        <View style={{
          backgroundColor: "white",
          marginHorizontal: 16,
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
          ...theme.shadows.sm,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <History size={20} color={theme.colors.text} />
            <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.colors.text }}>
              Payment History
            </Text>
          </View>

          {paymentHistory.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 32 }}>
              <DollarSign size={48} color={theme.colors.textSecondary} />
              <Text style={{ color: theme.colors.textSecondary, textAlign: "center", marginTop: 12 }}>
                No payment history found
              </Text>
            </View>
          ) : (
            <FlatList
              data={paymentHistory.slice(0, 10)}
              keyExtractor={(item) => item.id}
              renderItem={renderPaymentItem}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>

      {/* Credit Clearance Modal */}
      <Modal
        visible={showCreditClearModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCreditClearModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <View style={{
            backgroundColor: 'white',
            borderRadius: 16,
            padding: 24,
            margin: 20,
            width: '90%',
            maxWidth: 400,
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: 'bold',
              marginBottom: 16,
              color: theme.colors.text,
            }}>
              Clear Credit Balance
            </Text>

            <Text style={{
              fontSize: 14,
              color: theme.colors.textSecondary,
              marginBottom: 8,
            }}>
              Amount to Clear (Max: {formatCurrency(stats?.creditBalance || 0)})
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
                fontSize: 16,
              }}
              placeholder="Enter amount"
              value={clearanceAmount}
              onChangeText={setClearanceAmount}
              keyboardType="numeric"
            />

            <Text style={{
              fontSize: 14,
              color: theme.colors.textSecondary,
              marginBottom: 8,
            }}>
              Payment Method
            </Text>
            <TouchableOpacity
              onPress={() => setShowPaymentTypeModal(true)}
              style={{
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
                backgroundColor: selectedPaymentType ? theme.colors.primary + '10' : 'transparent',
              }}
            >
              <Text style={{
                color: selectedPaymentType ? theme.colors.primary : theme.colors.textSecondary,
                fontSize: 16,
              }}>
                {selectedPaymentType || "Select payment method"}
              </Text>
            </TouchableOpacity>

            <Text style={{
              fontSize: 14,
              color: theme.colors.textSecondary,
              marginBottom: 8,
            }}>
              Remarks (Optional)
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
                fontSize: 14,
              }}
              placeholder="Add remarks..."
              value={clearanceRemarks}
              onChangeText={setClearanceRemarks}
              multiline
              numberOfLines={3}
            />

            <View style={{
              flexDirection: 'row',
              gap: 12,
            }}>
              <TouchableOpacity
                onPress={() => setShowCreditClearModal(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <Text style={{
                  textAlign: 'center',
                  color: theme.colors.text,
                }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={processCreditClearance}
                disabled={processingClearance || !selectedPaymentType || !clearanceAmount}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: (!selectedPaymentType || !clearanceAmount || processingClearance) ? '#9ca3af' : theme.colors.primary,
                  opacity: processingClearance ? 0.7 : 1,
                }}
              >
                {processingClearance ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={{
                    textAlign: 'center',
                    color: 'white',
                    fontWeight: '600',
                  }}>
                    Clear Credit
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Type Modal for Credit Clearance */}
      <PaymentTypeModal
        visible={showPaymentTypeModal}
        onCancel={() => setShowPaymentTypeModal(false)}
        onSelectPayment={handleSelectPaymentType}
        excludeOptions={["Credit"]}
      />

      {/* Split Payment Modal for Credit Clearance */}
      <SplitPaymentModal
        visible={showSplitPayment}
        screen={creditClearancePaymentState.splitModalScreen}
        splitPayments={splitPayments}
        creditAmount={creditClearancePaymentState.creditAmount}
        newSplitType={creditClearancePaymentState.newSplitType}
        newSplitAmount={creditClearancePaymentState.newSplitAmount}
        onScreenChange={creditClearancePaymentState.setSplitModalScreen}
        onSplitTypeChange={creditClearancePaymentState.setNewSplitType}
        onAmountChange={creditClearancePaymentState.setNewSplitAmount}
        onAddSplit={creditClearancePaymentState.handleAddNewSplit}
        onConfirmSplit={creditClearancePaymentState.handleConfirmAddSplit}
        onRemoveSplit={creditClearancePaymentState.handleRemoveSplit}
        onProceed={() => setShowSplitPayment(false)}
      />
    </SafeAreaView>
  );
}
