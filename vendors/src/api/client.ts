/**
 * The one door between screens and the backend. Screens use the hooks in ./queries.
 * The mock is used for now (UI-first build); add ./http implementing this interface
 * against server/ and switch with EXPO_PUBLIC_API_MODE=http.
 */
import { mockApi } from './mock';
import type {
  AppNotification,
  Bank,
  BankAccount,
  City,
  Dashboard,
  ImageKind,
  MenuItem,
  MenuItemInput,
  Order,
  Payouts,
  ProfileDetails,
  RegisterStoreRequest,
  Review,
  Store,
  StoreUpdate,
  User,
  VerifyCodeResult,
} from './types';

export interface ApiClient {
  // sign-up / login — the same phone → code → name + email flow as the other apps
  requestCode(phone: string): Promise<void>;
  verifyCode(phone: string, code: string): Promise<VerifyCodeResult>;
  completeSignUp(details: ProfileDetails): Promise<User>;
  getMe(): Promise<User>;

  // the store
  listCities(): Promise<City[]>;
  /** null until the vendor has registered a store */
  getStore(): Promise<Store | null>;
  /** TODO(server): vendors are currently created by an admin; self-registration needs an endpoint. */
  registerStore(body: RegisterStoreRequest): Promise<Store>;
  updateStore(body: StoreUpdate): Promise<Store>;
  setOpen(open: boolean): Promise<Store>;
  /**
   * Uploads a picture and returns its URL, to save with updateStore or saveMenuItem.
   * JPEG, PNG or WebP up to 5 MB. Real backend: stores the file (Supabase Storage) and returns a public URL.
   */
  uploadImage(file: Blob, kind: ImageKind): Promise<string>;

  // orders
  listOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order>;
  acceptOrder(id: string, prepMinutes: number): Promise<Order>;
  rejectOrder(id: string, reason: string): Promise<Order>;
  markReady(id: string): Promise<Order>;

  // menu
  listMenu(): Promise<MenuItem[]>;
  saveMenuItem(item: MenuItemInput, id?: string): Promise<MenuItem>;
  setItemAvailable(id: string, available: boolean): Promise<MenuItem>;
  deleteMenuItem(id: string): Promise<void>;

  // business
  getDashboard(): Promise<Dashboard>;
  getPayouts(): Promise<Payouts>;
  listBanks(): Promise<Bank[]>;
  saveBankAccount(account: Omit<BankAccount, 'bankName'>): Promise<Payouts>;
  listReviews(): Promise<Review[]>;
  listNotifications(): Promise<AppNotification[]>;
}

export const apiMode = process.env.EXPO_PUBLIC_API_MODE === 'http' ? 'http' : 'mock';

export const api: ApiClient = mockApi;
