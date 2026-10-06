import { useCancellationTerms, useCancelOrder } from '@/api/queries';
import type { Order } from '@/api/types';
import { confirm } from '@/store/confirm';

import { formatNaira } from './money';

/**
 * Cancelling an order: ask the server what it costs right now, show that to the customer,
 * and cancel only if they agree to that exact fee.
 */
export function useCancelFlow(order: Pick<Order, 'id' | 'isPaid'> | undefined) {
  const terms = useCancellationTerms();
  const cancel = useCancelOrder();

  const start = () => {
    if (!order) return;
    terms.mutate(order.id, {
      onSuccess: (t) => {
        if (!t.canCancel) return confirm({ title: 'This order can’t be cancelled', message: t.reason ?? 'It’s too far along to cancel. Message support if something is wrong.', confirmLabel: 'OK', cancelLabel: 'Close', onConfirm: () => {} });
        const refund = order.isPaid ? ` ${formatNaira(t.refundKobo)} will be refunded.` : '';
        confirm({
          title: 'Cancel this order?',
          message: (t.feeKobo > 0 ? `A cancellation fee of ${formatNaira(t.feeKobo)} applies.` : 'Cancelling now is free.') + refund,
          confirmLabel: 'Yes, cancel order',
          cancelLabel: 'Keep order',
          destructive: true,
          onConfirm: () => cancel.mutate({ id: order.id, acceptedFeeKobo: t.feeKobo }),
        });
      },
    });
  };

  return { start, busy: terms.isPending || cancel.isPending, error: terms.error?.message ?? cancel.error?.message ?? null };
}
