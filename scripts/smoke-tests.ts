/*
  Lightweight smoke tests to validate expenses split/credit logic and dashboards.
  Run with: npx ts-node scripts/smoke-tests.ts (or transpile via ts-node/register if configured)
*/
import { db, openDatabase, runIntegrityAudit, withTransaction } from "@/lib/db";
import { dashboardService } from "@/services/dashboardService";
import { expenseService } from "@/services/expenseService";

async function main() {
  await openDatabase();
  if (!db) throw new Error("DB not ready");
  // Isolated run in a transaction and rollback so it leaves no residue
  try {
    await withTransaction(async () => {
      // Create a split expense: 300 Cash, 200 UPI, 500 Credit
      const { expenseId } = await expenseService.createExpense({
        amount: 1000,
        towards: "Test Inventory",
        splitPayments: [
          { type: "Cash", amount: 300 },
          { type: "UPI", amount: 200 },
          { type: "Credit", amount: 500 },
        ],
        remarks: "smoke",
      });

      const details1 = await expenseService.getExpense(expenseId);
      console.log("Expense created:", {
        paid: details1.paidAmount,
        accrued: details1.creditAccrued,
        cleared: details1.creditCleared,
        outstanding: details1.creditOutstanding,
        status: details1.status,
      });

      // Clear 300 via Cash
      await expenseService.clearExpenseCredit(expenseId, [
        { type: "Cash", amount: 300 },
      ]);
      const details2 = await expenseService.getExpense(expenseId);
      console.log("After clearance:", {
        paid: details2.paidAmount,
        accrued: details2.creditAccrued,
        cleared: details2.creditCleared,
        outstanding: details2.creditOutstanding,
        status: details2.status,
      });

      // Dashboard checks
      const stats = await dashboardService.getDashboardStats();
      console.log("Dashboard expense stats:", {
        expensePaid: stats.expensePaid,
        expenseCreditAccrued: stats.expenseCreditAccrued,
        expenseCreditCleared: stats.expenseCreditCleared,
        expenseOutstandingCredit: stats.expenseOutstandingCredit,
      });

      const audit = await runIntegrityAudit();
      console.log("Integrity:", audit.expenseIssues);

      // Throw to rollback (keep DB clean)
      throw new Error("Rollback intentionally (smoke tests)");
    });
  } catch {
    // expected rollback
  }
  const dt = Date.now();
  console.log("Smoke tests completed at", new Date(dt).toISOString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
