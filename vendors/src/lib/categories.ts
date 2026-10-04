import type { StoreCategory } from '@/api/types';

export const SUPPORT_WHATSAPP = 'https://wa.me/2348144461726';

export const storeCategories: { value: StoreCategory; label: string; emoji: string }[] = [
  { value: 'restaurant', label: 'Restaurant', emoji: '🍛' },
  { value: 'fast_food', label: 'Fast food', emoji: '🍢' },
  { value: 'drinks', label: 'Drinks', emoji: '🥤' },
  { value: 'groceries', label: 'Groceries', emoji: '🛒' },
  { value: 'pharmacy', label: 'Pharmacy', emoji: '💊' },
];

export const tierLabel = { basic: 'Basic', standard: 'Standard', premium: 'Premium' };

/** Icons shown for menu items that have no photo. */
export const foodEmoji = ['🍛', '🍲', '🍚', '🥘', '🍗', '🍢', '🥩', '🍖', '🍔', '🍟', '🌯', '🥞', '🫘', '🥗', '🍞', '🥚', '🍰', '🍩', '🥤', '🍹', '🥛', '☕', '🧃', '💊'];
