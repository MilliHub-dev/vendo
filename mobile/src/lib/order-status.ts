import type { OrderStatus, OrderType } from '@/api/types';

/** The steps a customer sees on the tracking screen, in order. */
export const trackingSteps: { status: OrderStatus; label: string }[] = [
  { status: 'rider_assigned', label: 'Rider assigned' },
  { status: 'picked_up', label: 'Picked up' },
  { status: 'on_the_way', label: 'On the way' },
  { status: 'delivered', label: 'Delivered' },
];

const labels: Record<OrderStatus, string> = {
  scheduled: 'Scheduled',
  pending_payment: 'Awaiting payment',
  awaiting_vendor: 'Waiting for the vendor',
  searching_rider: 'Finding a rider',
  rider_assigned: 'Rider assigned',
  picked_up: 'Picked up',
  on_the_way: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  disputed: 'Under review',
};

export const statusLabel = (status: OrderStatus) => labels[status];

export const isActive = (status: OrderStatus) => !['delivered', 'cancelled', 'disputed'].includes(status);

/** Customers can cancel until the rider has the item. */
export const canCancel = (status: OrderStatus) =>
  ['scheduled', 'pending_payment', 'awaiting_vendor', 'searching_rider', 'rider_assigned'].includes(status);

/** Customer and rider can message each other from assignment until the order ends. */
export const canChat = (status: OrderStatus) => ['rider_assigned', 'picked_up', 'on_the_way'].includes(status);

/** How many tracking steps are complete (0–4). */
export function trackingProgress(status: OrderStatus): number {
  const i = trackingSteps.findIndex((s) => s.status === status);
  return i < 0 ? 0 : i + 1;
}

export const orderTypeLabel = (type: OrderType) => (type === 'food' ? 'Food order' : 'Dispatch');
