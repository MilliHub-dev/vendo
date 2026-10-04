const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatTime(d: Date): string {
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function dayLabel(d: Date, now = new Date()): string {
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(d) - start(now)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${dayLabel(d)}, ${formatTime(d)}`;
};

/** Hourly pickup slots from 8 AM to 8 PM for the next `days` days, at least an hour from now. */
export function scheduleSlots(now = new Date(), days = 5): { day: string; slots: Date[] }[] {
  const out: { day: string; slots: Date[] }[] = [];
  for (let i = 0; i < days; i++) {
    const slots: Date[] = [];
    for (let h = 8; h <= 20; h++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h);
      if (d.getTime() - now.getTime() >= 3_600_000) slots.push(d);
    }
    if (slots.length) out.push({ day: dayLabel(slots[0], now), slots });
  }
  return out;
}
