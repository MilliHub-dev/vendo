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

/** `isOpen` is false outside the city's delivery hours. */
export type City = { id: string; name: string; isActive: boolean; isOpen?: boolean };

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
 * Sign-up and login are one flow: email address → emailed code.
 * An account we already know is signed in straight away (`user` is set).
 * A new email gets `user: null` and continues to the name + phone step.
 */
export type VerifyCodeResult = { token: string; user: User | null };
/** `phone` is a contact number in +234 format (riders call it; it isn't used to sign in). */
export type ProfileDetails = { name: string; phone: string };
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
  /** not sent by the live API yet */
  ratingCount?: number;
  etaMinutes: [min: number, max: number];
  /** only known once there is a delivery address; the live API prices it at checkout */
  deliveryFeeKobo?: Kobo;
  imageUrl?: string;
  /** placeholder art until vendors supply photos */
  emoji?: string;
};

/** A choice the customer makes on an item, e.g. "Choose your protein" (pick `min`–`max` options). */
export type OptionGroup = { id: string; name: string; min: number; max: number; options: { id: string; name: string; priceKobo: Kobo }[] };

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
  optionGroups?: OptionGroup[];
};

export type MenuItemWithVendor = MenuItem & { vendorName: string };
export type SearchResults = { vendors: Vendor[]; items: MenuItemWithVendor[] };

export type VendorDetail = { vendor: Vendor; menu: MenuItem[] };

export type OrderItem = { menuItemId: string; name: string; unitPriceKobo: Kobo; quantity: number; note?: string; /** chosen options, e.g. "Chicken, Large" */ options?: string };

export type Rider = { id: string; name: string; phone: string; rating?: number; plateNumber: string; photoUrl?: string };

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
  /** false while the customer still has to pay (status is then `pending_payment`) */
  isPaid?: boolean;
  rider?: Rider;
  /** dispatch only: shown to the sender, entered by the rider at handover */
  deliveryCode?: string;
  /** 1–5, set once the customer rates a delivered order */
  rating?: number;
};

/** `feeKobo` is charged if the customer cancels now; `refundKobo` goes back to them. */
export type CancellationTerms = { canCancel: boolean; feeKobo: Kobo; refundKobo: Kobo; reason?: string };

/** A promo code to try at checkout. */
export type Promo = { code: string; description: string };

export type Quote = {
  /** the server's quote ID; an order is placed against it */
  id?: string;
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
  purpose: 'topup' | 'order_payment' | 'refund' | 'referral';
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
  /** friends who joined but haven't ordered yet / who have earned you a reward (the live API sends counts, not names) */
  pendingCount?: number;
  rewardedCount?: number;
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
  | { type: 'food'; vendorId: string; items: { menuItemId: string; quantity: number; optionIds?: string[]; note?: string }[]; dropoff: Place; promoCode?: string }
  | { type: 'dispatch'; pickup: Place; dropoff: Place; packageSize: PackageSize; packageNote?: string; fragile?: boolean; receiver?: { name: string; phone: string } };

export type CreateOrderRequest = QuoteRequest & { paymentMethod: PaymentMethod; scheduledFor?: string };
