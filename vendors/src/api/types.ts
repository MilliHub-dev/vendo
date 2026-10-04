/**
 * Vendor-side data shapes. Order actions, menu and availability follow the server's
 * vendor API (server/docs/openapi.json: /v1/vendor/*). All money is integer kobo; times are ISO UTC.
 */
import type { Kobo } from '@/lib/money';

export type User = { id: string; name: string; phone: string; email: string };
export type ProfileDetails = { name: string; email: string };
export type VerifyCodeResult = { token: string; user: User | null };

export type Approval = 'under_review' | 'approved' | 'rejected' | 'suspended';
export type StoreCategory = 'restaurant' | 'fast_food' | 'drinks' | 'groceries' | 'pharmacy';
export type Tier = 'basic' | 'standard' | 'premium';
export type City = { id: string; name: string };

/** One row per weekday, 0 = Sunday. Times are 24h "HH:MM" in the store's local time. */
export type DayHours = { day: number; open: boolean; from: string; to: string };

export type Store = {
  id: string;
  approval: Approval;
  approvalNote?: string;
  name: string;
  category: StoreCategory;
  /** short line customers see under the name, e.g. "Northern Nigerian" */
  cuisine: string;
  description: string;
  cityId: string;
  address: string;
  /** the vendor's own switch: taking orders right now or not */
  isOpen: boolean;
  hours: DayHours[];
  rating: number;
  ratingCount: number;
  /** share of the food subtotal Vendo keeps, e.g. 0.15 */
  commissionRate: number;
  tier: Tier;
  /** square logo and wide banner customers see on the store page; absent until uploaded */
  logoUrl?: string;
  bannerUrl?: string;
};

export type ImageKind = 'logo' | 'banner' | 'menu_item';

export type RegisterStoreRequest = Pick<Store, 'name' | 'category' | 'cuisine' | 'description' | 'cityId' | 'address' | 'hours'>;
/** `null` for logoUrl / bannerUrl removes the image. */
export type StoreUpdate = Partial<Pick<Store, 'name' | 'cuisine' | 'description' | 'address' | 'hours'>> & { logoUrl?: string | null; bannerUrl?: string | null };

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  priceKobo: Kobo;
  category: string;
  isAvailable: boolean;
  /** shown when the item has no photo */
  emoji: string;
  imageUrl?: string;
};
export type MenuItemInput = Omit<MenuItem, 'id'>;

/** new → preparing → ready → picked_up → delivered; or rejected / cancelled. */
export type OrderStatus = 'new' | 'preparing' | 'ready' | 'picked_up' | 'delivered' | 'rejected' | 'cancelled';

export type Order = {
  id: string;
  code: string;
  status: OrderStatus;
  /** first name only — vendors don't get customers' contact details */
  customerName: string;
  items: { name: string; quantity: number; unitPriceKobo: Kobo; note?: string }[];
  subtotalKobo: Kobo;
  commissionKobo: Kobo;
  /** what the store receives for this order: subtotal − commission */
  payoutKobo: Kobo;
  createdAt: string;
  /** new orders only: accept or reject before this, or the order is cancelled and refunded */
  respondBy?: string;
  prepMinutes?: number;
  readyBy?: string;
  rider?: { name: string; plateNumber: string };
  rejectReason?: string;
};

export type Dashboard = {
  today: { orders: number; salesKobo: Kobo; payoutKobo: Kobo };
  week: { orders: number; salesKobo: Kobo };
  /** last 7 days, oldest first */
  days: { date: string; salesKobo: Kobo; orders: number }[];
  topItems: { name: string; quantity: number }[];
};

export type Bank = { code: string; name: string };
export type BankAccount = { bankCode: string; bankName: string; accountNumber: string; accountName: string };
export type Payout = { id: string; amountKobo: Kobo; status: 'scheduled' | 'paid'; date: string; orders: number };
export type Payouts = { balanceKobo: Kobo; nextPayoutDate: string; account: BankAccount | null; history: Payout[] };

export type Review = { id: string; customerName: string; rating: number; comment: string; createdAt: string };
export type AppNotification = { id: string; title: string; body: string; createdAt: string };
