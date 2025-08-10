// Centralized application constants & enums
// Keep this file lean and only for shared immutable config.

export const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Credit", "Split"] as const;
export type PaymentMode = typeof PAYMENT_MODES[number];

// Displayable (non-transaction) payment options (exclude internal Split handling where needed)
export const PRIMARY_PAYMENT_OPTIONS: PaymentMode[] = ["Cash", "UPI", "Card", "Bank Transfer", "Credit"];

export interface CategoryMeta {
  name: string;
  emoji: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { name: "Tea", emoji: "🍵" },
  { name: "Hot Cups", emoji: "☕" },
  { name: "Mojito", emoji: "🥤" },
  { name: "Refreshers", emoji: "🧊" },
  { name: "Milkshakes", emoji: "🥛" },
  { name: "Maggie", emoji: "🍜" },
  { name: "Quick Bites", emoji: "🍪" },
  { name: "Sandwich", emoji: "🥪" },
  { name: "Burger", emoji: "🍔" },
  { name: "Omlette", emoji: "🍳" },
  { name: "Rolls", emoji: "🌯" },
  { name: "Momos", emoji: "🥟" },
  { name: "Cigarettes", emoji: "🚬" },
];

export const CATEGORY_EMOJI_MAP: Record<string, string> = CATEGORIES.reduce(
  (acc, c) => {
    acc[c.name.toLowerCase()] = c.emoji;
    return acc;
  },
  {} as Record<string, string>
);

export const getCategoryEmoji = (category?: string | null): string => {
  if (!category) return "🍽️";
  return CATEGORY_EMOJI_MAP[category.toLowerCase()] || "🍽️";
};

// Money formatting: we store integer rupees only.
export const formatCurrency = (amount: number): string => `₹${amount}`;

export const DATE_FORMAT_LOCALE = "en-IN";

export const formatDateTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString(DATE_FORMAT_LOCALE, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};
