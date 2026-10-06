import type { MenuItem } from '@/api/types';
import { useCart, type ItemChoice } from '@/store/cart';
import { confirm } from '@/store/confirm';

/** True when the customer has to choose something (e.g. a protein) before the item can be added. */
export const needsChoice = (item: MenuItem) => (item.optionGroups ?? []).some((g) => g.min > 0);

/** Adds to the cart, asking first when the cart already holds another vendor's items. */
export function useAddToCart() {
  const add = useCart((s) => s.add);
  const wouldReplace = useCart((s) => s.wouldReplace);
  const currentVendor = useCart((s) => s.vendorName);

  return (item: MenuItem, vendorName: string, choice?: ItemChoice) => {
    if (!wouldReplace(item.vendorId)) return add(item, vendorName, choice);
    confirm({
      title: 'Start a new cart?',
      message: `Your cart has items from ${currentVendor}. One order comes from one vendor, so adding this will replace them.`,
      confirmLabel: 'Start new cart',
      cancelLabel: 'Keep my cart',
      onConfirm: () => add(item, vendorName, choice),
    });
  };
}
