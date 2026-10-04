/**
 * The one door between screens and the backend.
 *
 * Screens call `api.*` (usually through the hooks in ./queries) and never know whether the
 * data is mock or real. While server/ doesn't exist the mock is used. When it does, add
 * ./http (same interface, calling VENDO_DEVELOPMENT.md §9 endpoints) and switch it on with
 * EXPO_PUBLIC_API_MODE=http.
 */
import { mockApi } from './mock';
import type {
  AppNotification,
  ChatMessage,
  CreateOrderRequest,
  MenuItemWithVendor,
  Order,
  ProfileDetails,
  Promo,
  Quote,
  QuoteRequest,
  ReferralSummary,
  SearchResults,
  SignUpDetails,
  TopUpChannel,
  Tracking,
  User,
  Vendor,
  VendorCategory,
  VendorDetail,
  VerifyCodeResult,
  Wallet,
} from './types';

export interface ApiClient {
  // sign-up / login: phone → code → (new users only) name + email
  /** Sends a 6-digit code by SMS to a Nigerian phone number in +234 format. */
  requestCode(phone: string): Promise<void>;
  verifyCode(phone: string, code: string): Promise<VerifyCodeResult>;
  /** Last sign-up step; creates the profile for a newly verified number. */
  completeSignUp(details: SignUpDetails): Promise<User>;
  getMe(): Promise<User>;
  updateProfile(details: ProfileDetails): Promise<User>;

  listVendors(params?: { category?: VendorCategory }): Promise<Vendor[]>;
  getVendor(id: string): Promise<VendorDetail>;
  /** "Picks for you" on Home. */
  listPicks(): Promise<MenuItemWithVendor[]>;
  search(query: string): Promise<SearchResults>;

  /** Checks a promo code before checkout. Throws if it is unknown, expired or not valid for this customer. */
  checkPromo(code: string): Promise<Promo>;
  quote(body: QuoteRequest): Promise<Quote>;
  createOrder(body: CreateOrderRequest): Promise<Order>;
  listOrders(filter: 'active' | 'past'): Promise<Order[]>;
  getOrder(id: string): Promise<Order>;
  getTracking(orderId: string): Promise<Tracking>;
  cancelOrder(id: string): Promise<Order>;
  rateOrder(id: string, rating: number, comment?: string): Promise<Order>;

  // chat with the rider — open from when a rider is assigned until the order ends, so neither
  // side needs the other's phone number. Real backend: delivered in real time, stored for disputes.
  listMessages(orderId: string): Promise<ChatMessage[]>;
  sendMessage(orderId: string, text: string): Promise<ChatMessage>;

  getWallet(): Promise<Wallet>;
  /** Real backend: starts a Paystack payment and credits the wallet when the webhook confirms it. */
  topUp(amountKobo: number, channel: TopUpChannel): Promise<Wallet>;
  listNotifications(): Promise<AppNotification[]>;

  getReferrals(): Promise<ReferralSummary>;
  /** Adds a friend's referral code after sign-up (allowed until the first order). */
  applyReferralCode(code: string): Promise<ReferralSummary>;
}

export const apiMode = process.env.EXPO_PUBLIC_API_MODE === 'http' ? 'http' : 'mock';

export const api: ApiClient = mockApi;
