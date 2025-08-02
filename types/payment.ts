export type PaymentType = "Cash" | "UPI" | "Credit" | "Split";

export interface SplitPayment {
  id: string;
  type: Exclude<PaymentType, "Split">;
  amount: number;
}

export interface PaymentData {
  billId: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  paymentType: PaymentType;
  splitPayments?: SplitPayment[];
}

export type SplitModalScreen = "list" | "add";
