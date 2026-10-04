/**
 * Admin-side data shapes, following VENDO_DEVELOPMENT.md §6 and the PRD's admin
 * dashboard (§5). All money is integer kobo; times are ISO UTC.
 */
import type { Kobo } from "@/lib/money";

export type Role = "super_admin" | "ops" | "finance" | "support";
export type Admin = { id: string; name: string; email: string; role: Role };

export type OrderType = "food" | "dispatch";
export type OrderStatus = "awaiting_vendor" | "searching_rider" | "rider_assigned" | "picked_up" | "on_the_way" | "delivered" | "cancelled" | "disputed";
/** The PRD's five feed filters. */
export type OrderGroup = "pending" | "active" | "completed" | "cancelled" | "disputed";
export type PaymentMethod = "wallet" | "card" | "transfer";

export type Order = {
  id: string;
  code: string;
  type: OrderType;
  status: OrderStatus;
  cityId: string;
  customer: { id: string; name: string; phone: string };
  vendorName?: string;
  riderId?: string;
  riderName?: string;
  pickup: string;
  dropoff: string;
  subtotalKobo: Kobo;
  deliveryFeeKobo: Kobo;
  /** Vendo's cut of the food subtotal */
  commissionKobo: Kobo;
  totalKobo: Kobo;
  paymentMethod: PaymentMethod;
  refundedKobo: Kobo;
  createdAt: string;
  /** audit trail: every status change and admin action, oldest first */
  timeline: { label: string; at: string; by: string }[];
  issue?: string;
};

export type Approval = "pending" | "approved" | "rejected" | "suspended";
export type Presence = "offline" | "online" | "on_trip";
export type DocumentKind = "gov_id" | "bike_registration" | "photo";

export type Rider = {
  id: string;
  name: string;
  phone: string;
  cityId: string;
  vehicle: string;
  plateNumber: string;
  approval: Approval;
  note?: string;
  presence: Presence;
  rating: number;
  trips: number;
  acceptanceRate: number;
  balanceKobo: Kobo;
  joinedAt: string;
  documents: { kind: DocumentKind; status: "submitted" | "approved" | "rejected" }[];
  /** position on the live-map diagram, 0–1 in each direction */
  position: { x: number; y: number };
};

export type Tier = "basic" | "standard" | "premium";
export type VendorCategory = "restaurant" | "fast_food" | "drinks" | "groceries" | "pharmacy";
export type Vendor = {
  id: string;
  name: string;
  category: VendorCategory;
  cityId: string;
  address: string;
  ownerName: string;
  phone: string;
  approval: "under_review" | "approved" | "suspended";
  isOpen: boolean;
  commissionRate: number;
  tier: Tier;
  rating: number;
  menuItems: number;
  orders30d: number;
  revenue30dKobo: Kobo;
};
export type VendorInput = Pick<Vendor, "name" | "category" | "cityId" | "address" | "ownerName" | "phone" | "commissionRate" | "tier">;

export type Customer = { id: string; name: string; phone: string; cityId: string; orders: number; spentKobo: Kobo; walletKobo: Kobo; joinedAt: string };

export type TransactionKind = "topup" | "order_payment" | "refund" | "rider_earning" | "commission" | "withdrawal" | "adjustment";
export type Transaction = {
  id: string;
  reference: string;
  kind: TransactionKind;
  party: string;
  direction: "credit" | "debit";
  amountKobo: Kobo;
  channel: "card" | "transfer" | "ussd" | "wallet" | "system";
  status: "success" | "pending" | "failed";
  createdAt: string;
  note?: string;
};

export type Withdrawal = { id: string; riderId: string; riderName: string; amountKobo: Kobo; bankName: string; accountNumber: string; status: "pending" | "paid" | "declined"; createdAt: string; note?: string };

export type City = {
  id: string;
  name: string;
  isActive: boolean;
  baseFareKobo: Kobo;
  perKmKobo: Kobo;
  minOrderKobo: Kobo;
  surgeOn: boolean;
  surgeMultiplier: number;
  opensAt: string;
  closesAt: string;
};
export type CityUpdate = Partial<Omit<City, "id" | "name">>;

export type Banner = { id: string; title: string; cityIds: string[]; active: boolean; startsAt: string; endsAt: string };
export type PromoCode = { id: string; code: string; description: string; kind: "percent" | "amount" | "free_delivery"; value: number; active: boolean; uses: number; maxUses: number };
export type ReferralConfig = { enabled: boolean; referrerRewardKobo: Kobo; refereeDiscountKobo: Kobo };

export type AuditEntry = { id: string; at: string; admin: string; role: Role; action: string; target: string; detail: string };

export type Overview = {
  today: { orders: number; revenueKobo: Kobo; commissionKobo: Kobo; activeRiders: number; activeCustomers: number; fulfilmentRate: number };
  /** last 14 days, oldest first */
  days: { date: string; orders: number; revenueKobo: Kobo }[];
  cities: { cityId: string; name: string; orders: number; revenueKobo: Kobo; onlineRiders: number; fulfilmentRate: number }[];
  topVendors: { name: string; orders: number; revenueKobo: Kobo }[];
  topRiders: { name: string; trips: number; rating: number }[];
  retention: { newCustomers: number; returningCustomers: number };
  queues: { riderApprovals: number; vendorApprovals: number; withdrawals: number; disputes: number };
};

export type Audience = "customers" | "riders" | "vendors";
/** where tapping the notification takes the person (customer app only) */
export type PushLink = "home" | "food" | "send" | "wallet" | "orders";
export type BroadcastInput = { title: string; body: string; audience: Audience; cityIds: string[]; link: PushLink; /** ISO time; omit to send now */ sendAt?: string };
export type Broadcast = Omit<BroadcastInput, "sendAt"> & { id: string; status: "sent" | "scheduled" | "cancelled"; sendAt: string; recipients: number; opened: number; sentBy: string };
