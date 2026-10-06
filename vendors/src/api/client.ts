import type {
  AppNotification,
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
  // sign-up / login — the email → code → name + phone flow
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<VerifyCodeResult>;
  completeSignUp(details: ProfileDetails): Promise<User>;
  getMe(): Promise<User>;

  // the store
  listCities(): Promise<City[]>;
  /** null until the vendor has registered a store */
  getStore(): Promise<Store | null>;
  listStores(): Promise<Store[]>;
  registerStore(body: RegisterStoreRequest): Promise<Store>;
  updateStore(body: StoreUpdate): Promise<Store>;
  setOpen(open: boolean): Promise<Store>;
  /**
   * Uploads a picture and returns its URL, to save with updateStore or saveMenuItem.
   * JPEG, PNG or WebP up to 2 MiB. Real backend: stores the file (Supabase Storage) and returns a public URL.
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
  /** Banks a payout account can be held at (Paystack's list through our server; a bundled list of major banks if that isn't available). */
  listBanks(): Promise<{ code: string; name: string }[]>;
  logout(): Promise<void>;
  requestWithdrawal(amountKobo: number): Promise<void>;
  saveBankAccount(account: Omit<BankAccount, 'bankName'>): Promise<Payouts>;
  listReviews(): Promise<Review[]>;
  listNotifications(): Promise<AppNotification[]>;
}

export { api } from './http';
