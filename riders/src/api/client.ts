/**
 * The one door between screens and the backend. Screens use the hooks in ./queries;
 * ./http implements this interface against the Vendo API (EXPO_PUBLIC_API_URL).
 */
import { httpApi } from './http';
import type {
  AppNotification,
  Bank,
  ChatMessage,
  City,
  DocumentFile,
  DocumentKind,
  Earnings,
  Job,
  Offer,
  PayoutAccount,
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
  // sign-up / login — the same email → code → name + phone flow as the customer app
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<VerifyCodeResult>;
  completeSignUp(details: ProfileDetails): Promise<User>;
  getMe(): Promise<User>;
  /** Goes offline, stops sharing location, ends the session and forgets the saved sign-in. */
  signOut(): Promise<void>;

  // rider application
  listCities(): Promise<City[]>;
  /** null until the rider has registered a vehicle */
  getRider(): Promise<Rider | null>;
  registerRider(body: RegisterRiderRequest): Promise<Rider>;
  /** Uploads a photo or PDF to private storage. Once every required document is in, the application is under review. */
  uploadDocument(kind: DocumentKind, file: DocumentFile): Promise<Rider>;

  // working
  /** Going online needs the phone's location: the server only accepts a fresh, accurate position inside the rider's city. */
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
  /** The saved payout account, or null if none has been added. */
  getPayoutAccount(): Promise<PayoutAccount | null>;
  listWithdrawals(): Promise<Withdrawal[]>;
  requestWithdrawal(body: WithdrawalRequest): Promise<Withdrawal>;
  listNotifications(): Promise<AppNotification[]>;
}

export const api: ApiClient = httpApi;
