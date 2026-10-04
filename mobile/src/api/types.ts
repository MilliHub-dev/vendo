/**
 * API data shapes, following VENDO_DEVELOPMENT.md §6 (database) and §9 (API).
 * All money is integer kobo. All times are ISO strings in UTC.
 */
import type { Kobo } from '@/lib/money';

export type OrderType = 'food' | 'dispatch';

export type OrderStatus =
  | 'scheduled'
  | 'pending_payment'
  | 'awaiting_vendor'
  | 'searching_rider'
  | 'rider_assigned'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled'
  | 'disputed';

export type PaymentMethod = 'wallet' | 'card' | 'transfer';
export type PackageSize = 'document' | 'small' | 'large';
export type VendorCategory = 'restaurant' | 'fast_food' | 'drinks' | 'groceries' | 'pharmacy';

export type LatLng = { lat: number; lng: number };

export type City = { id: string; name: string; isActive: boolean };

export type Place = LatLng & {
  /** street / area line found for the pin */
  address: string;
  /** landmark or directions for the rider — addresses alone are often not enough */
  note?: string;
};

export type SavedAddress = Place & { id: string; label: string };

export type User = {
  id: string;
  name: string;
  phone: string;
  email: string;
  cityId: string;
  referralCode: string;
};

/**
 * Sign-up and login are one flow: phone number → SMS code.
 * A number we already know is signed in straight away (`user` is set).
 * A new number gets `user: null` and continues to the name + email step.
 */
export type VerifyCodeResult = { token: string; user: User | null };
export type ProfileDetails = { name: string; email: string };
export type SignUpDetails = ProfileDetails & { referralCode?: string };

export type Vendor = {
  id: string;
  name: string;
  category: VendorCategory;
  cuisine: string;
  cityId: string;
  address: string;
  location: LatLng;
  isOpen: boolean;
  rating: number;
  ratingCount: number;
  etaMinutes: [min: number, max: number];
  deliveryFeeKobo: Kobo;
  imageUrl?: string;
  /** placeholder art until vendors supply photos */
  emoji?: string;
};

export type MenuItem = {
  id: string;
  vendorId: string;
  name: string;
  description: string;
  priceKobo: Kobo;
  category: string;
  isAvailable: boolean;
  imageUrl?: string;
  emoji?: string;
};

export type MenuItemWithVendor = MenuItem & { vendorName: string };
export type SearchResults = { vendors: Vendor[]; items: MenuItemWithVendor[] };

export type VendorDetail = { vendor: Vendor; menu: MenuItem[] };

export type OrderItem = { menuItemId: string; name: string; unitPriceKobo: Kobo; quantity: number; note?: string };

export type Rider = { id: string; name: string; phone: string; rating: number; plateNumber: string; photoUrl?: string };

export type Order = {
  id: string;
  /** human-friendly, e.g. VD-8F3K2 */
  code: string;
  type: OrderType;
  status: OrderStatus;
  createdAt: string;
  scheduledFor?: string;
  pickup: Place;
  dropoff: Place;
  vendor?: Pick<Vendor, 'id' | 'name'>;
  items: OrderItem[];
  packageSize?: PackageSize;
  packageNote?: string;
  receiver?: { name: string; phone: string };
  subtotalKobo: Kobo;
  deliveryFeeKobo: Kobo;
  discountKobo: Kobo;
  totalKobo: Kobo;
  paymentMethod: PaymentMethod;
  rider?: Rider;
  /** dispatch only: shown to the sender, entered by the rider at handover */
  deliveryCode?: string;
  /** 1–5, set once the customer rates a delivered order */
  rating?: number;
};

/** A promo code the server has accepted. */
export type Promo = { code: string; description: string };

export type Quote = {
  /** why there is a discount, e.g. "Promo VENDO10" or "Referral welcome discount" */
  discountLabel?: string;
  distanceMeters: number;
  etaMinutes: number;
  subtotalKobo: Kobo;
  deliveryFeeKobo: Kobo;
  discountKobo: Kobo;
  totalKobo: Kobo;
};

export type Tracking = { status: OrderStatus; rider?: LatLng & { heading: number }; etaMinutes?: number; distanceMeters?: number };

export type WalletTransaction = {
  id: string;
  direction: 'credit' | 'debit';
  amountKobo: Kobo;
  purpose: 'topup' | 'order_payment' | 'refund';
  label: string;
  reference: string;
  createdAt: string;
};

export type Wallet = { balanceKobo: Kobo; transactions: WalletTransaction[] };

export type ReferralSummary = {
  code: string;
  shareUrl: string;
  /** wallet credit you get when a friend completes their first order */
  referrerRewardKobo: Kobo;
  /** discount a new customer gets on their first order */
  refereeDiscountKobo: Kobo;
  earnedKobo: Kobo;
  /** the code this customer signed up with, if any */
  appliedCode: string | null;
  /** a code can be added only before the first order */
  canApply: boolean;
  friends: { name: string; status: 'joined' | 'rewarded'; joinedAt: string }[];
};

/** A message between the customer and the rider on one order. */
export type ChatMessage = { id: string; orderId: string; from: 'customer' | 'rider'; text: string; createdAt: string };

export type TopUpChannel = 'card' | 'transfer' | 'ussd';

export type AppNotification = { id: string; title: string; body: string; createdAt: string; orderId?: string };

// ---- request bodies ----

export type QuoteRequest =
  | { type: 'food'; vendorId: string; items: { menuItemId: string; quantity: number }[]; dropoff: Place; promoCode?: string }
  | { type: 'dispatch'; pickup: Place; dropoff: Place; packageSize: PackageSize };

export type CreateOrderRequest = QuoteRequest & {
  paymentMethod: PaymentMethod;
  scheduledFor?: string;
  packageNote?: string;
  receiver?: { name: string; phone: string };
};
