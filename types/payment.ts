import { PaymentMode } from "@/constants/paymentConstants";

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

// New interfaces for the refactored payment flow
export interface PaymentComponent {
  mode: PaymentMode;
  amount: number;
}

export interface BillSettlementRequest {
  customerId: string;
  components: PaymentComponent[];
  creditPortion: number;
  remarks?: string;
  targetDate?: string;
}

export interface CreditClearanceRequest {
  customerId: string;
  components: PaymentComponent[];
  remarks?: string;
}
