import { Customer } from "@/services/customerService";
import { observable } from "@legendapp/state";

export const customerState = observable({
  customers: [] as Customer[],
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
