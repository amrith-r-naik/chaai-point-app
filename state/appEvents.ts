import { observable } from "@legendapp/state";

export interface AppEventsState {
  customersVersion: number;
  ordersVersion: number;
  paymentsVersion: number;
  expensesVersion: number;
  billsVersion: number;
  anyVersion: number; // bump on any mutation affecting dashboards/lists
}

export const appEvents = observable<AppEventsState>({
  customersVersion: 0,
  ordersVersion: 0,
  paymentsVersion: 0,
  expensesVersion: 0,
  billsVersion: 0,
  anyVersion: 0,
});

export const signalChange = {
  customers: () => appEvents.customersVersion.set((v) => v + 1),
  orders: () => appEvents.ordersVersion.set((v) => v + 1),
  payments: () => appEvents.paymentsVersion.set((v) => v + 1),
  expenses: () => appEvents.expensesVersion.set((v) => v + 1),
  bills: () => appEvents.billsVersion.set((v) => v + 1),
  any: () => appEvents.anyVersion.set((v) => v + 1),
};
