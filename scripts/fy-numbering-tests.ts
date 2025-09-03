/*
  FY/Daily numbering tests for local counters (IST fiscal year Apr–Mar and daily KOT).
  Pure logic test: no DB, mirrors the logic in lib/db.ts: nextLocalNumber.

  Run (one-off):
    npm run test:fy
*/

type CounterStore = Record<string, number>;

function periodKeys(name: "kot" | "bill" | "receipt" | "expense", date: Date) {
  const istMs = date.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  const istDateKey = ist.toISOString().slice(0, 10);
  const istMonth = ist.getUTCMonth(); // 0-11 on IST-shifted date
  const istYear = ist.getUTCFullYear();
  const fiscalStartYear = istMonth >= 3 ? istYear : istYear - 1; // Apr (3) -> next Mar
  const key = name === "kot" ? istDateKey : String(fiscalStartYear);
  return { periodKey: key };
}

function nextLocalNumberPure(
  store: CounterStore,
  name: "kot" | "bill" | "receipt" | "expense",
  date: Date
): number {
  const { periodKey } = periodKeys(name, date);
  const scope = "shop_1"; // matches lib/db.ts assumption
  const k = `${scope}|${periodKey}|${name}`;
  const cur = store[k] || 0;
  store[k] = cur + 1;
  return store[k];
}

function istDateToUtcDate(
  year: number,
  month1: number, // 1-12
  day: number,
  hour: number = 12,
  minute: number = 0,
  second: number = 0
): Date {
  // Create a timestamp that represents the given IST wall-clock time.
  // UTC time = IST time - 5h30m
  const ms = Date.UTC(year, month1 - 1, day, hour, minute, second);
  const utcMs = ms - 5.5 * 60 * 60 * 1000;
  return new Date(utcMs);
}

function assertEq(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${expected}, got ${actual})`);
  }
}

async function testKotDailyReset(baseYear: number) {
  const store: CounterStore = {};
  // Pick a future date to avoid existing counters
  const d1 = istDateToUtcDate(baseYear, 3, 15, 12, 0, 0); // Mar 15, baseYear @ noon IST
  const n1 = nextLocalNumberPure(store, "kot", d1);
  const n2 = nextLocalNumberPure(store, "kot", d1);
  assertEq(n2, n1 + 1, "KOT should increment within same IST day");

  const d2 = istDateToUtcDate(baseYear, 3, 16, 12, 0, 0); // next IST day
  const n3 = nextLocalNumberPure(store, "kot", d2);
  assertEq(n3, 1, "KOT should reset to 1 on next IST day");
}

async function testFiscalYearReset(baseYear: number) {
  const store: CounterStore = {};
  // Choose FY boundary dates in IST: Mar 31 and Apr 1 of baseYear
  const mar31 = istDateToUtcDate(baseYear, 3, 31, 12, 0, 0);
  const apr01 = istDateToUtcDate(baseYear, 4, 1, 12, 0, 0);

  // Bills
  const b1 = nextLocalNumberPure(store, "bill", mar31);
  const b2 = nextLocalNumberPure(store, "bill", mar31);
  assertEq(b2, b1 + 1, "Bill should increment within same FY (IST)");
  const b3 = nextLocalNumberPure(store, "bill", apr01);
  assertEq(b3, 1, "Bill should reset to 1 in new FY (IST)");

  // Receipts
  const r1 = nextLocalNumberPure(store, "receipt", mar31);
  const r2 = nextLocalNumberPure(store, "receipt", mar31);
  assertEq(r2, r1 + 1, "Receipt should increment within same FY (IST)");
  const r3 = nextLocalNumberPure(store, "receipt", apr01);
  assertEq(r3, 1, "Receipt should reset to 1 in new FY (IST)");

  // Expenses
  const e1 = nextLocalNumberPure(store, "expense", mar31);
  const e2 = nextLocalNumberPure(store, "expense", mar31);
  assertEq(e2, e1 + 1, "Expense voucher should increment within same FY (IST)");
  const e3 = nextLocalNumberPure(store, "expense", apr01);
  assertEq(e3, 1, "Expense voucher should reset to 1 in new FY (IST)");
}

async function main() {
  // Use a future year to avoid interference from any existing counters
  const baseYear = new Date().getUTCFullYear() + 3;

  await testKotDailyReset(baseYear);
  await testFiscalYearReset(baseYear);
  console.log("FY/Daily numbering tests: PASS");
}

main().catch((e) => {
  console.error("FY/Daily numbering tests: FAIL", e);
  process.exit(1);
});
