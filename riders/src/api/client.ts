/**
 * The one door between screens and the backend. Screens use the hooks in ./queries and
 * never know whether data is mock or real. The mock is used for now (UI-first build);
 * add ./http implementing this same interface against server/ and switch with
 * EXPO_PUBLIC_API_MODE=http.
 */
import { mockApi } from './mock';
import type {
  AppNotification,
  Bank,
  ChatMessage,
  City,
  DocumentKind,
  Earnings,
  Job,
  Offer,
  ProfileDetails,
  RegisterRiderRequest,
  Rider,
  Trip,
  User,
  VerifyCodeResult,
  Withdrawal,
  WithdrawalRequest,
} from './types';

export interface ApiClient {
  // sign-up / login — the same phone → code → name + email flow as the customer app
  requestCode(phone: string): Promise<void>;
  verifyCode(phone: string, code: string): Promise<VerifyCodeResult>;
  completeSignUp(details: ProfileDetails): Promise<User>;
  getMe(): Promise<User>;

  // rider application
  listCities(): Promise<City[]>;
  /** null until the rider has registered a vehicle */
  getRider(): Promise<Rider | null>;
  registerRider(body: RegisterRiderRequest): Promise<Rider>;
  /** Real backend: uploads the file to private storage. */
  uploadDocument(kind: DocumentKind): Promise<Rider>;
  submitApplication(): Promise<Rider>;

  // working
  setOnline(online: boolean): Promise<Rider>;
  getCurrentOffer(): Promise<Offer | null>;
  respondToOffer(id: string, action: 'accept' | 'reject'): Promise<Job | null>;
  getJob(): Promise<Job | null>;
  updateJob(action: 'picked_up' | 'on_the_way' | 'delivered'): Promise<Job>;
  /** Dispatch handover. Three wrong codes locks the delivery and sends it to support. */
  confirmDelivery(code: string): Promise<Job>;
  listMessages(): Promise<ChatMessage[]>;
  sendMessage(text: string): Promise<ChatMessage>;

  // money and history
  listTrips(): Promise<Trip[]>;
  getTrip(id: string): Promise<Trip>;
  getEarnings(): Promise<Earnings>;
  listBanks(): Promise<Bank[]>;
  listWithdrawals(): Promise<Withdrawal[]>;
  requestWithdrawal(body: WithdrawalRequest): Promise<Withdrawal>;
  listNotifications(): Promise<AppNotification[]>;
}

export const apiMode = process.env.EXPO_PUBLIC_API_MODE === 'http' ? 'http' : 'mock';

export const api: ApiClient = mockApi;
