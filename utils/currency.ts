export const formatCurrency = (amount: number): string => {
  const value = Math.abs(amount);
  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
  return amount < 0 ? `-${formatted}` : formatted;
};

export const getCurrencyFontSize = (
  amount: number,
  baseFontSize: number = 18
): number => {
  const formatted = formatCurrency(amount);
  const length = formatted.length;
  if (length <= 8) return baseFontSize;
  if (length <= 12) return baseFontSize * 0.85;
  if (length <= 16) return baseFontSize * 0.75;
  return baseFontSize * 0.65;
};
