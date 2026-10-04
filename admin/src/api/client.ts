/**
 * The one door between pages and the backend. Pages use the hooks in ./queries.
 * The mock is used for now (UI-first build); add ./http implementing this interface
 * against server/ (the /v1/admin/* endpoints) and switch with NEXT_PUBLIC_API_MODE=http.
 */
import { mockApi } from "./mock/index.ts";
import type { Admin, Audience, AuditEntry, Banner, Broadcast, BroadcastInput, City, CityUpdate, Customer, Order, Overview, PromoCode, ReferralConfig, Rider, Transaction, Vendor, VendorInput, Withdrawal } from "./types";

export interface ApiClient {
  /** Email + password, restricted to the company's email domain. Real backend: add two-factor sign-in. */
  login(email: string, password: string): Promise<{ token: string; admin: Admin }>;

  getOverview(): Promise<Overview>;

  listOrders(): Promise<Order[]>;
  reassignOrder(id: string, riderId: string): Promise<Order>;
  cancelOrder(id: string, reason: string): Promise<Order>;
  refundOrder(id: string, amountKobo: number, reason: string): Promise<Order>;
  resolveDispute(id: string, note: string): Promise<Order>;

  listRiders(): Promise<Rider[]>;
  reviewRider(id: string, decision: "approve" | "reject", note: string): Promise<Rider>;
  setRiderSuspended(id: string, suspended: boolean, reason: string): Promise<Rider>;

  listVendors(): Promise<Vendor[]>;
  saveVendor(input: VendorInput, id?: string): Promise<Vendor>;
  reviewVendor(id: string, decision: "approve" | "reject"): Promise<Vendor>;
  setVendorSuspended(id: string, suspended: boolean, reason: string): Promise<Vendor>;

  listCustomers(): Promise<Customer[]>;
  /** Manual credit or debit of a customer or rider wallet. Always needs a reason; always audit-logged. */
  adjustWallet(party: "customer" | "rider", id: string, direction: "credit" | "debit", amountKobo: number, reason: string): Promise<void>;

  listTransactions(): Promise<Transaction[]>;
  listWithdrawals(): Promise<Withdrawal[]>;
  decideWithdrawal(id: string, decision: "approve" | "decline", note: string): Promise<Withdrawal>;

  listCities(): Promise<City[]>;
  updateCity(id: string, update: CityUpdate): Promise<City>;

  listBanners(): Promise<Banner[]>;
  saveBanner(banner: Omit<Banner, "id">, id?: string): Promise<Banner>;
  listPromoCodes(): Promise<PromoCode[]>;
  savePromoCode(promo: Omit<PromoCode, "id" | "uses">, id?: string): Promise<PromoCode>;
  getReferralConfig(): Promise<ReferralConfig>;
  updateReferralConfig(config: ReferralConfig): Promise<ReferralConfig>;

  listBroadcasts(): Promise<Broadcast[]>;
  /** How many people have the app with notifications on, for this audience and these cities. */
  countAudience(audience: Audience, cityIds: string[]): Promise<number>;
  /** Sends a push notification now, or schedules it when `sendAt` is set. */
  sendBroadcast(input: BroadcastInput): Promise<Broadcast>;
  cancelBroadcast(id: string): Promise<Broadcast>;

  listAudit(): Promise<AuditEntry[]>;
}

export const apiMode = process.env.NEXT_PUBLIC_API_MODE === "http" ? "http" : "mock";

export const api: ApiClient = mockApi;
