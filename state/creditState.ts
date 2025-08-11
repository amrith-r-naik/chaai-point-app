import { CustomerCredit } from "@/services/creditService";
import { observable } from "@legendapp/state";

/**
 * Global Credit State Management
 * Manages credit balances and synchronizes updates across all screens
 */

export interface CreditStateData {
  totalCreditBalance: number;
  customersWithCredit: CustomerCredit[];
  lastUpdated: number;
}

export const creditState = observable({
  data: {
    totalCreditBalance: 0,
    customersWithCredit: [],
    lastUpdated: 0,
  } as CreditStateData,
  loading: false,
  error: "" as string,
});

/**
 * Actions to update credit state
 */
export const creditStateActions = {
  /**
   * Set credit data from service
   */
  setCreditData: (data: Partial<CreditStateData>) => {
    creditState.data.set({
      ...creditState.data.get(),
      ...data,
      lastUpdated: Date.now(),
    });
  },

  /**
   * Update specific customer credit balance
   */
  updateCustomerCredit: (customerId: string, newBalance: number) => {
    const current = creditState.data.get();
    const updatedCustomers = current.customersWithCredit.map(customer => 
      customer.customerId === customerId 
        ? { ...customer, creditBalance: newBalance }
        : customer
    ).filter(customer => customer.creditBalance > 0); // Remove customers with 0 balance

    const totalBalance = updatedCustomers.reduce((sum, customer) => sum + customer.creditBalance, 0);

    creditState.data.set({
      totalCreditBalance: totalBalance,
      customersWithCredit: updatedCustomers,
      lastUpdated: Date.now(),
    });
  },

  /**
   * Remove customer from credit list (when balance becomes 0)
   */
  removeCustomerCredit: (customerId: string) => {
    const current = creditState.data.get();
    const updatedCustomers = current.customersWithCredit.filter(
      customer => customer.customerId !== customerId
    );
    const totalBalance = updatedCustomers.reduce((sum, customer) => sum + customer.creditBalance, 0);

    creditState.data.set({
      totalCreditBalance: totalBalance,
      customersWithCredit: updatedCustomers,
      lastUpdated: Date.now(),
    });
  },

  /**
   * Mark as loading
   */
  setLoading: (loading: boolean) => {
    creditState.loading.set(loading);
  },

  /**
   * Set error
   */
  setError: (error: string) => {
    creditState.error.set(error);
  },

  /**
   * Clear error
   */
  clearError: () => {
    creditState.error.set("");
  },

  /**
   * Trigger refresh across all screens
   */
  triggerRefresh: () => {
    creditState.data.lastUpdated.set(Date.now());
  },
};

/**
 * Hook to check if credit data needs refresh
 */
export const useCreditRefreshTrigger = () => {
  return creditState.data.lastUpdated.get();
};

/**
 * Hook to get total credit balance
 */
export const useTotalCreditBalance = () => {
  return creditState.data.totalCreditBalance.get();
};

/**
 * Hook to get customers with credit
 */
export const useCustomersWithCredit = (): CustomerCredit[] => {
  return creditState.data.customersWithCredit.get();
};

/**
 * Hook to get credit loading state
 */
export const useCreditLoading = () => {
  return creditState.loading.get();
};
