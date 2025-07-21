import { Customer } from "@/services/customerService";
import { observable } from "@legendapp/state";

export const customerState = observable({
  customers: [] as Customer[],
  loading: false,
  error: "" as string,
  searchQuery: "" as string,
  selectedCustomer: null as Customer | null,
  showAddModal: false,
  showEditModal: false,
});

export const clearCustomerError = () => {
  customerState.error.set("");
};

export const setSelectedCustomer = (customer: Customer | null) => {
  customerState.selectedCustomer.set(customer);
};

export const toggleAddModal = () => {
  customerState.showAddModal.set(!customerState.showAddModal.get());
  if (!customerState.showAddModal.get()) {
    clearCustomerError();
  }
};

export const toggleEditModal = () => {
  customerState.showEditModal.set(!customerState.showEditModal.get());
  if (!customerState.showEditModal.get()) {
    clearCustomerError();
    setSelectedCustomer(null);
  }
};
