# Testing Guide

## Scope and goals

- Validate all user flows across tabs and modals: auth, customers, orders, billing/expenses, payments (including split and credit flows), receipts, admin/menu management, and sync/backup.
- Verify stability on Android (APK), including back button behavior, keyboard handling, and quick interactions (search/category toggles).
- Confirm auto-refresh behavior across screens after changes—no manual reloads required.
- Catch regressions in recent changes:
  - Select Items: category/search mutual exclusivity
  - Split Payment: close icon and Android back dismiss
  - Post-order redirect to Customers (Active tab)
  - Event-driven auto-refresh across lists

## Test environment

- Build: Release APK (version/build number from CI/EAS)
- Devices:
  - Android phones: Android 10, 11, 12+ (at least one mid-tier and one low-tier device)
  - Screen sizes: ~5.5”, ~6.5”+
- Network:
  - Online Wi-Fi
  - Mobile data (optional)
  - Offline/airplane mode (for sync/offline tests)
- App reset:
  - Before each major suite, clear app data or uninstall/reinstall to avoid stale state.
- Test data:
  - Test credentials (provided by QA lead)
  - Seed or create at least:
    - 8–12 menu items across 3–4 categories
    - 4–6 customers with varied names
    - Some existing orders/bills/receipts if available

## High-level test checklist

- Install/open app, login, and bootstrap
- Navigation: tabs, back behavior, modals
- Customers: list, search, add/edit/delete, details
- Orders: create, select items, quantities, submit; post-order redirect
- Billing/Expenses: add expense, view totals, filters (if present)
- Payments: single, split, UPI/cash, credit accrual, credit clearance
- Receipts/bill details: open from history
- Due management/unbilled orders (if applicable)
- Menu management/admin settings
- Auto-refresh across all lists
- Sync/backup/diagnostics (incl. offline then sync)
- Performance and stability: long lists, quick interactions
- Accessibility basics and UI polish
- Error handling and empty states
- Android-specific behaviors (back button, keyboard)

## Core flows and detailed test cases

### 1) Authentication

- Positive login with valid creds
  - Steps: Launch → login → home loads
  - Expected: No errors; initial data loads fully
- Negative: invalid creds
  - Expected: Clear error; no crash
- Session restore after app kill/restart
  - Expected: User remains logged in or sees login if tokens expired

### 2) Navigation and routing

- Tabs: Dashboard, Billing, Customers, Orders
  - Expected: Switch is instant; state persists reasonably per tab
- Modals: All modals open and dismiss properly:
  - Create Order, Select Items, Payment, Receipt Details, Bill Details, Add Expense, Unbilled Orders, Due Management, Customer form
  - Android back closes the top-most modal without crashing or leaving a dim overlay

### 3) Dashboard (Home)

- Data loads with non-empty state
- Add an expense (see Billing) and verify dashboard numbers refresh automatically (no manual refresh)
- Navigate away and back—state remains coherent

### 4) Customers

- List:
  - Displays customers with correct sorting (if any), avatars/initials rendering
  - Search by name; backspace and clear interactions
- Add/edit/delete customer:
  - Validation for empty/invalid input
  - Auto-refresh: list updates immediately after mutation
- Customer details screen
  - Header: name, bills count
  - Credit alert visible only when credit > 0; Clear Credit CTA shown conditionally
  - Quick actions: New Order opens Create Order pre-selecting customer
  - Summary: total billed, bill count, last bill date (formatting DD Mon YYYY HH:MM)
  - Bill history: opens Bill Details; statuses and amounts render correctly
  - Payment history:
    - Payment vs Credit Accrual vs Clearance labels/color chips
    - Open receipts from payments (non-accruals)
    - Empty state messaging when no payments

### 5) Order creation

- From Customer details (New Order) or Orders tab
- Select Items modal:
  - Category/search mutual exclusivity
    - Case A: Select category, then type search → category should clear to “All”, search applies across all
    - Case B: With search active, select a category → search clears, category filter applies
    - No crash when toggling quickly (Android addViewAt crash should not occur)
  - Search dropdown:
    - Recent searches appear, selectable, and update list
    - Clearing “Recent searches” works
  - Quick section: shows recent items when no search and All view
  - Section headers and item rendering stable; scroll performance ok
  - Item add/quantity controls:
    - Add item; adjust +/−; remove; verify totals reflect in bottom bar and selected-items sheet
  - Selected Items sheet:
    - “View” opens sheet; tapping an item scrolls to it; quick notice messages show/close
    - “Done” closes Select Items modal and returns
- Place order (from flow that includes submitting KOT/bill)
  - After successful placement, app should redirect to Customers tab Active view
  - Verify lists refresh across Orders, Customers, Dashboard

### 6) Orders tab

- Orders list loads and auto-refreshes after:
  - New order
  - Payment updates
  - Credit actions
- Open order details if applicable; verify content and back behavior

### 7) Billing and expenses

- Add expense:
  - Validation (amount > 0, required fields)
  - After adding, Billing tab updates automatically and Dashboard updates automatically
- Filters/date ranges (if present):
  - Applying filter changes totals
  - Navigate away/back—filter state sensible
- Performance with many expenses

### 8) Payments

- From order/bill:
  - Single payment Cash → receipt generated; amounts correct
  - Single payment UPI → receipt generated; amounts correct
- Split payment modal:
  - Open from payment flow
  - Add split entries (Cash/UPI/Credit)
  - Delete split entries
  - Validation on amount sum vs due
  - “PROCEED” disabled until valid
  - Close icon in the top-right dismisses modal
  - Android back dismisses modal (no crash)
- Credit flows:
  - Credit sale (Accrual): increases customer credit balance; no immediate receipt in bill payment list
  - Credit clearance: via Customer details Clear Credit or Payment modal clearance
  - After clearance, verify:
    - Credit balance decreases accordingly
    - Payment history shows “Clearance”
    - Receipts generated correctly
- Receipts:
  - Open receipt details from payment history and bill views
  - Values match paid amounts and dates; back behaves

### 9) Due management and unbilled orders

- Due management:
  - Load dues list; mark due as paid; verify credit/payment updates and auto-refresh
- Unbilled orders:
  - Open list; convert to bill or clean up as per flow; auto-refresh lists

### 10) Admin settings and menu management

- Menu management:
  - Add/edit/delete items
  - Category assignment and emoji render in Select Items
  - Price updates reflect in new orders immediately (auto-refresh)
- Admin settings:
  - Navigate through settings; any toggles or diagnostics work without crash

### 11) Sync, backup, and diagnostics

- Offline capture:
  - Go offline → create/edit customers, add expenses, create orders
  - Return online → verify data syncs; no duplicates; totals correct
- Multi-device sanity (if testers can use two devices; see docs/TESTING-sync-multi-device.md):
  - Mutations on Device A reflect on Device B after sync
  - Conflict behavior (last write wins or defined strategy) is consistent
- Sync diagnostics screen:
  - Open logs; run any health checks; no crashes
- Backup/restore (if exposed): run and verify no data loss

### 12) Auto-refresh validations

- After each mutation (create/edit/delete in services), verify:
  - Customers tab updates
  - Orders tab updates
  - Billing/Expenses updates
  - Dashboard updates
- No unnecessary reload loops; scrolling position reasonable

### 13) Performance and stability

- Large lists (≥200 items/orders):
  - Scrolling smooth; no UI jank
- Rapid interactions:
  - Type quickly in Select Items with a category selected—no crashes
  - Add/remove split items quickly—stable
- Memory/leaks: navigate across app for 10–15 minutes—no degradation or crashes

### 14) Accessibility and UI

- Tap targets ≥44px; important actions prominent
- Contrast on primary buttons and alert banners
- Label clarity and currency formatting (₹ with grouping)
- Keyboard:
  - Search dismisses keyboard on submit; no overlap of UI
  - Input validation messages readable

### 15) Edge cases and negative tests

- Empty states:
  - No customers; no menu items; no orders; no payments—friendly messages
- Special characters/emoji in names and items
- Very long names and category names—truncate gracefully
- Zero/negative input for amounts—blocked with clear errors
- Date/time correctness with local device time changes

## Regression focus (recent changes)

- Select Items:
  - Category/search exclusivity works; no Android view insertion crash
- Split Payment:
  - Close icon visible and dismisses modal; Android back dismisses modal; proceed disabled until valid
- Post-order redirect:
  - After placing order, app routes to Customers tab Active
- Auto-refresh:
  - Orders, Customers, Billing, Dashboard all reflect changes instantly

## Defect reporting

Include:

- App version/build, device model, OS version
- Steps to reproduce (numbered), expected vs actual
- Screenshots/video (screen recording for list/scroll issues)
- Logs if possible:
  - If available, capture via adb logcat filtered by app package
  - Note timestamps of issue occurrence

## Pass criteria

- All core flows succeed without crashes
- No blockers or major usability issues
- All regression focus items pass in multiple runs
- Auto-refresh consistent across modules
- Acceptable performance on mid-tier Android devices

## Quick smoke suite (10–15 minutes)

- Login → Dashboard loads
- Add an expense → Dashboard/Billing update
- Add a customer → Customers list updates
- New order:
  - Select Items: type with category selected (category clears); select category with search active (search clears)
  - Add two items; place order → redirect to Customers Active
- Open customer details:
  - Bill history present
  - Payment history opens a receipt
- Open split payment modal:
  - Add two splits; close with X; reopen; proceed; back button dismiss works
- Due Management: mark one due paid
- No crashes during the above

## Developer smoke (optional)

- Run Sync Diagnostics screen: from app, open `sync-diagnostics` and tap Run All Tests
- Run Node smoke tests locally (validates expense split/credit and dashboard):
  - Ensure TypeScript path aliases resolve for Node (e.g., ts-node with tsconfig paths) or run inside Expo if preferred
  - The smoke script runs inside a transaction and intentionally rolls back—no persistent data changes
  - See `scripts/smoke-tests.ts` for details
