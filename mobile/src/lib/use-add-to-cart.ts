import type { MenuItem } from '@/api/types';
import { useCart } from '@/store/cart';
import { confirm } from '@/store/confirm';

/** Adds to the cart, asking first when the cart already holds another vendor's items. */
export function useAddToCart() {
  const add = useCart((s) => s.add);
  const wouldReplace = useCart((s) => s.wouldReplace);
  const currentVendor = useCart((s) => s.vendorName);

  return (item: MenuItem, vendorName: string, quantity = 1, note?: string) => {
    if (!wouldReplace(item.vendorId)) return add(item, vendorName, quantity, note);
    confirm({
      title: 'Start a new cart?',
      message: `Your cart has items from ${currentVendor}. One order comes from one vendor, so adding this will replace them.`,
      confirmLabel: 'Start new cart',
      cancelLabel: 'Keep my cart',
      onConfirm: () => add(item, vendorName, quantity, note),
    });
  };
}
