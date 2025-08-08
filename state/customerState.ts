import { Customer } from "@/services/customerService";
import { observable } from "@legendapp/state";

// Extended customer interface for state management
export interface ExtendedCustomer extends Customer {
  totalOrders?: number;
  totalAmount?: number;
  paidAmount?: number;
  creditAmount?: number;
  paidOrders?: number;
  creditOrders?: number;
}

export const customerState = observable({
  customers: [] as ExtendedCustomer[],
  loading: false,
  error: "" as string,
  searchQuery: "" as string,
  selectedCustomer: null as Customer | null,
});

export const clearCustomerError = () => {
  customerState.error.set("");
};

export const setSelectedCustomer = (customer: Customer | null) => {
  customerState.selectedCustomer.set(customer);
};
