export type PaymentType = "Cash" | "UPI" | "Credit" | "Split";

// Split entry types can include advance operations in addition to normal payment modes
export type SplitEntryType =
  | "Cash"
  | "UPI"
  | "Credit"
  | "AdvanceUse" // using existing advance balance towards bill
  | "AdvanceAdd"; // extra money paid into advance wallet (not counted towards bill total)

export interface SplitPayment {
  id: string;
  type: SplitEntryType;
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
