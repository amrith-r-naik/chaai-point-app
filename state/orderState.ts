// state/orderState.ts
import { observable } from "@legendapp/state";
import { KotOrder, MenuItem } from "../services/orderService";

export interface OrderState {
  orders: KotOrder[];
  selectedOrder: KotOrder | null;
  isLoading: boolean;
  error: string | null;

  // New order creation state
  isCreatingOrder: boolean;
  selectedCustomerId: string | null;
  selectedItems: {
    item: MenuItem;
    quantity: number;
  }[];

  // Modal states
  showCreateOrderModal: boolean;
  showCustomerModal: boolean;
  showItemsModal: boolean;
  showOrderDetailsModal: boolean;
}

export const orderState = observable<OrderState>({
  orders: [],
  selectedOrder: null,
  isLoading: false,
  error: null,

  isCreatingOrder: false,
  selectedCustomerId: null,
  selectedItems: [],

  showCreateOrderModal: false,
  showCustomerModal: false,
  showItemsModal: false,
  showOrderDetailsModal: false,
});
