/**
 * The one door between screens and the backend.
 *
 * Screens call `api.*` (usually through the hooks in ./queries). The implementation in
 * ./http talks to the Vendo API at EXPO_PUBLIC_API_URL; this interface is its contract.
 */
import { httpApi } from './http';
import type {
  AppNotification,
  CancellationTerms,
  ChatMessage,
  City,
  CreateOrderRequest,
  MenuItemWithVendor,
  Order,
  ProfileDetails,
  Promo,
  Quote,
  QuoteRequest,
  Place,
  ReferralSummary,
  SavedAddress,
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
  // sign-up / login: email → code → (new users only) name + phone
  /** Emails a 6-digit code to the address. */
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<VerifyCodeResult>;
  /** Last sign-up step; creates the profile for a newly verified number. */
  completeSignUp(details: SignUpDetails): Promise<User>;
  getMe(): Promise<User>;
  updateProfile(details: ProfileDetails): Promise<User>;
  /** Ends the session on the server and forgets the saved sign-in. */
  signOut(): Promise<void>;

  /** Cities Vendo delivers in. Vendors, fares and the service area depend on the chosen one. */
  listCities(): Promise<City[]>;

  // places: search runs through our server (which holds the map provider), within the chosen city
  searchPlaces(query: string): Promise<Place[]>;
  listAddresses(): Promise<SavedAddress[]>;
  saveAddress(label: string, place: Place): Promise<SavedAddress>;
  deleteAddress(id: string): Promise<void>;
  /** Remembers the customer's city on their account, so it is restored at the next sign-in. */
  setCity(city: Pick<City, 'id' | 'name'>): Promise<void>;

  listVendors(params?: { category?: VendorCategory }): Promise<Vendor[]>;
  getVendor(id: string): Promise<VendorDetail>;
  /** "Picks for you" on Home. */
  listPicks(): Promise<MenuItemWithVendor[]>;
  search(query: string): Promise<SearchResults>;

  /** Checks a promo code before checkout. Throws if it is unknown, expired or not valid for this customer. */
  checkPromo(code: string): Promise<Promo>;
  quote(body: QuoteRequest): Promise<Quote>;
  /** Places the order and takes payment. If payment isn't completed the order comes back unpaid (`isPaid: false`). */
  createOrder(body: CreateOrderRequest): Promise<Order>;
  /** Pays for an order that was placed but not paid for. */
  payOrder(id: string): Promise<Order>;
  listOrders(filter: 'active' | 'past'): Promise<Order[]>;
  getOrder(id: string): Promise<Order>;
  getTracking(orderId: string): Promise<Tracking>;
  /** What cancelling would cost right now. Show it before the customer confirms. */
  getCancellationTerms(id: string): Promise<CancellationTerms>;
  /** `acceptedFeeKobo` is the fee the customer was shown; the server refuses if it has changed. */
  cancelOrder(id: string, acceptedFeeKobo: number): Promise<Order>;
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

export const api: ApiClient = httpApi;
