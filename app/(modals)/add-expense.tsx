import { theme } from "@/constants/theme";
import { dashboardService } from "@/services/dashboardService";
import {
  CreditCard,
  DollarSign,
  FileText,
  Receipt,
  Smartphone,
  Tag,
  Wallet,
  X
} from "lucide-react-native";
import React, { useState } from "react";
import {
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: screenWidth } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  scrollContent: {
    padding: 24,
    gap: 24
  },
  section: {
    gap: 12
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  inputContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  inputFocused: {
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.1,
  },
  textInput: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500'
  },
  textInputMultiline: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  paymentModeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8
  },
  paymentModeCard: {
    flex: 1,
    minWidth: (screenWidth - 72) / 2,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: 'white',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  paymentModeCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.15,
  },
  paymentModeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#f8fafc'
  },
  paymentModeIconSelected: {
    backgroundColor: theme.colors.primary,
  },
  paymentModeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    flex: 1
  },
  paymentModeTextSelected: {
    color: theme.colors.primary,
  },
  amountPrefix: {
    position: 'absolute',
    left: 20,
    top: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    zIndex: 1
  },
  amountInput: {
    paddingLeft: 40
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  addButtonDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
  },
  addButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  quickAmountContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap'
  },
  quickAmountChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b'
  }
});

const paymentModes = [
  { id: "Cash", label: "Cash", icon: Wallet },
  { id: "UPI", label: "UPI", icon: Smartphone },
  { id: "Card", label: "Card", icon: CreditCard },
  { id: "Bank Transfer", label: "Bank Transfer", icon: Receipt },
  { id: "Other", label: "Other", icon: DollarSign },
];

const quickAmounts = [100, 500, 1000, 2000, 5000];

const expenseCategories = [
  "Rent", "Utilities", "Supplies", "Marketing", "Travel",
  "Food & Beverages", "Equipment", "Maintenance", "Staff", "Other"
];

interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onExpenseAdded: () => void;
}

export default function AddExpenseModal({
  visible,
  onClose,
  onExpenseAdded,
}: AddExpenseModalProps) {
  const [amount, setAmount] = useState("");
  const [towards, setTowards] = useState("");
  const [mode, setMode] = useState("Cash");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const resetForm = () => {
    setAmount("");
    setTowards("");
    setMode("Cash");
    setRemarks("");
    setFocusedInput(null);
  };

  const handleAddExpense = async () => {
    if (!amount.trim() || !towards.trim()) {
      Alert.alert("Error", "Please fill amount and expense category");
      return;
    }

    const expenseAmount = parseFloat(amount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      await dashboardService.addExpense({
        amount: Math.round(expenseAmount),
        towards: towards.trim(),
        mode,
        remarks: remarks.trim() || undefined,
      });

      Alert.alert("Success", "Expense added successfully");
      resetForm();
      onExpenseAdded();
      onClose();
    } catch (error) {
      console.error("Error adding expense:", error);
      Alert.alert("Error", "Failed to add expense. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleQuickAmount = (quickAmount: number) => {
    setAmount(quickAmount.toString());
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              backgroundColor: theme.colors.primaryLight,
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <Receipt size={24} color={theme.colors.primary} />
            </View>
            <Text style={styles.headerTitle}>Add Expense</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <X size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
          {/* Amount Section */}
          <View style={styles.section}>
            <View style={styles.sectionTitle}>
              <DollarSign size={20} color="#334155" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#334155' }}>
                Amount *
              </Text>
            </View>
            <View style={[
              styles.inputContainer,
              focusedInput === 'amount' && styles.inputFocused
            ]}>
              <Text style={styles.amountPrefix}>₹</Text>
              <TextInput
                style={[styles.textInput, styles.amountInput]}
                placeholder="0.00"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                onFocus={() => setFocusedInput('amount')}
                onBlur={() => setFocusedInput(null)}
                autoFocus
              />
            </View>
            
            {/* Quick Amount Buttons */}
            <View style={styles.quickAmountContainer}>
              {quickAmounts.map((quickAmount) => (
                <TouchableOpacity
                  key={quickAmount}
                  style={styles.quickAmountChip}
                  onPress={() => handleQuickAmount(quickAmount)}
                >
                  <Text style={styles.quickAmountText}>₹{quickAmount}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Category Section */}
          <View style={styles.section}>
            <View style={styles.sectionTitle}>
              <Tag size={20} color="#334155" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#334155' }}>
                Expense Category *
              </Text>
            </View>
            <View style={[
              styles.inputContainer,
              focusedInput === 'category' && styles.inputFocused
            ]}>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Rent, Utilities, Supplies"
                value={towards}
                onChangeText={setTowards}
                onFocus={() => setFocusedInput('category')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>
            
            {/* Category Suggestions */}
            <View style={styles.quickAmountContainer}>
              {expenseCategories.slice(0, 6).map((category) => (
                <TouchableOpacity
                  key={category}
                  style={styles.quickAmountChip}
                  onPress={() => setTowards(category)}
                >
                  <Text style={styles.quickAmountText}>{category}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Payment Mode Section */}
          <View style={styles.section}>
            <View style={styles.sectionTitle}>
              <CreditCard size={20} color="#334155" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#334155' }}>
                Payment Method
              </Text>
            </View>
            <View style={styles.paymentModeGrid}>
              {paymentModes.map((paymentMode) => {
                const IconComponent = paymentMode.icon;
                const isSelected = mode === paymentMode.id;
                
                return (
                  <TouchableOpacity
                    key={paymentMode.id}
                    style={[
                      styles.paymentModeCard,
                      isSelected && styles.paymentModeCardSelected
                    ]}
                    onPress={() => setMode(paymentMode.id)}
                  >
                    <View style={[
                      styles.paymentModeIcon,
                      isSelected && styles.paymentModeIconSelected
                    ]}>
                      <IconComponent 
                        size={20} 
                        color={isSelected ? 'white' : '#64748b'} 
                      />
                    </View>
                    <Text style={[
                      styles.paymentModeText,
                      isSelected && styles.paymentModeTextSelected
                    ]}>
                      {paymentMode.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Remarks Section */}
          <View style={styles.section}>
            <View style={styles.sectionTitle}>
              <FileText size={20} color="#334155" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#334155' }}>
                Remarks (Optional)
              </Text>
            </View>
            <View style={[
              styles.inputContainer,
              focusedInput === 'remarks' && styles.inputFocused
            ]}>
              <TextInput
                style={[styles.textInput, styles.textInputMultiline]}
                placeholder="Additional notes about this expense..."
                value={remarks}
                onChangeText={setRemarks}
                multiline
                numberOfLines={4}
                onFocus={() => setFocusedInput('remarks')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.addButton,
              loading && styles.addButtonDisabled
            ]}
            onPress={handleAddExpense}
            disabled={loading}
          >
            <Receipt size={20} color="white" />
            <Text style={styles.addButtonText}>
              {loading ? "Adding Expense..." : "Add Expense"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
