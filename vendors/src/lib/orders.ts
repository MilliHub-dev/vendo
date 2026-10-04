import type { DayHours, Order, OrderStatus } from '@/api/types';

export const statusLabel: Record<OrderStatus, string> = {
  new: 'New',
  preparing: 'Preparing',
  ready: 'Ready for pickup',
  picked_up: 'With rider',
  delivered: 'Delivered',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export type OrderTab = 'new' | 'preparing' | 'ready' | 'past';
export const tabOf = (status: OrderStatus): OrderTab => (status === 'new' ? 'new' : status === 'preparing' ? 'preparing' : status === 'ready' ? 'ready' : 'past');

export const itemCount = (order: Order) => order.items.reduce((n, i) => n + i.quantity, 0);

export const secondsLeft = (iso: string | undefined, now: number) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 1000)) : 0);
export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "08:00" → "8:00 AM" */
export function formatHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** e.g. "Mon–Sat · 8:00 AM – 9:00 PM", or "Varies by day" when days differ. */
export function summariseHours(hours: DayHours[]): string {
  const open = hours.filter((d) => d.open);
  if (open.length === 0) return 'Closed every day';
  const same = open.every((d) => d.from === open[0].from && d.to === open[0].to);
  const days = open.length === 7 ? 'Every day' : `${open.length} days a week`;
  return same ? `${days} · ${formatHour(open[0].from)} – ${formatHour(open[0].to)}` : `${days} · hours vary`;
}
