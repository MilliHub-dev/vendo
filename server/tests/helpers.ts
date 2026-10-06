import { randomUUID } from 'node:crypto';
import type { AuthGateway, Identity } from '../src/modules/auth/schema.js';
import type { Profile, ProfileRepository } from '../src/modules/users/schema.js';
import { ApiError } from '../src/lib/errors.js';
import { MemoryLimits } from '../src/integrations/limits.js';
import { MemoryDeliveries } from '../src/integrations/deliveries.js';
import type { Dependencies } from '../src/app.js';
import type { EmailMessage } from '../src/integrations/brevo.js';
import type { AccountRepository, Preferences, Verification } from '../src/modules/accounts/schema.js';

export const alice: Identity = { id: randomUUID(), phone: '+2348144461726' };
export const bob: Identity = { id: randomUUID(), phone: '+2348140454988' };

// Test doubles only: the production app never accepts these tokens or uses this storage.
export function fixtures() {
  const rows = new Map<string, Profile>();
  const requested: string[] = [];
  const sms: string[] = [];
  const emails: EmailMessage[] = [];
  const challenges = new Map<string, Verification & { attempts: number; consumed: boolean }>();
  const preferences = new Map<string, Preferences>();
  const recoveries: { phone: string; email: string; message: string }[] = [];
  const auth: AuthGateway = {
    async requestOtp(phone) { requested.push(phone); },
    async verifyOtp(_phone, token) {
      if (token !== '123456') throw new ApiError(401, 'AUTH_FAILED', 'Invalid or expired code.');
      return { access_token: 'alice', refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer' };
    },
    async refresh() { return { access_token: 'alice', refresh_token: 'new-refresh', expires_in: 3600, token_type: 'bearer' }; },
    async authenticate(token) {
      if (token === 'alice') return alice;
      if (token === 'bob') return bob;
      throw new ApiError(401, 'AUTH_FAILED', 'Invalid or expired session.');
    },
    async logout() {},
  };
  const profiles: ProfileRepository = {
    async bootstrap(id, phone) {
      const existing = rows.get(id);
      if (existing) return existing;
      const profile: Profile = { id, phone, name: null, email: null, email_verified: false, role: 'customer', status: 'active',
        onboarding_step: 'name_required', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      rows.set(id, profile);
      return profile;
    },
    async setName(id, name) {
      const existing = rows.get(id)!;
      const profile: Profile = { ...existing, name, onboarding_step: existing.email ? 'complete' : 'email_required' };
      rows.set(id, profile);
      return profile;
    },
    async setEmail(id, email) {
      if (rows.get(id)?.email !== email) challenges.delete(id);
      const profile: Profile = { ...rows.get(id)!, email, email_verified: false, onboarding_step: 'complete' };
      rows.set(id, profile);
      return profile;
    },
  };
  const accounts: AccountRepository = {
    async issueVerification(id, verification) {
      if (rows.get(id)?.email !== verification.email || rows.get(id)?.email_verified) return false;
      challenges.set(id, { ...verification, attempts: 0, consumed: false }); return true;
    },
    async discardVerification(id, challengeId) { if (challenges.get(id)?.id === challengeId) challenges.delete(id); },
    async verifyEmail(id, challengeId, hash) {
      const challenge = challenges.get(id);
      if (!challenge || challenge.id !== challengeId || challenge.consumed || challenge.attempts >= 5 || challenge.expiresAt <= new Date() || challenge.email !== rows.get(id)?.email) return null;
      challenge.attempts++;
      if (challenge.hash !== hash) return null;
      challenge.consumed = true;
      rows.get(id)!.email_verified = true;
      return rows.get(id)!;
    },
    async getPreferences(id) {
      if (!preferences.has(id)) preferences.set(id, { sms_enabled:false,reminders_enabled:true,theme: 'system', push_enabled: true, email_enabled: true, whatsapp_opt_in: false });
      return preferences.get(id)!;
    },
    async updatePreferences(id, patch) { const updated = { ...await this.getPreferences(id), ...patch }; preferences.set(id, updated); return updated; },
    async requestDeletion(id) { rows.get(id)!.status = 'deactivated'; return randomUUID(); },
    async requestRecovery(phone, email, message) { recoveries.push({ phone, email, message }); },
  };
  const unused=async():Promise<never>=>{throw new Error('Unused');};
  const dependencies: Dependencies = {
    vendors:{portal:unused,register:unused,applications:unused,review:unused,withdraw:unused,stores:unused,store:unused,update:unused,orders:unused,order:unused,summary:unused},
    media:{upload:unused,get:unused,download:unused},
    chat:{list:unused,send:unused,read:unused},
    operations:{adminOrders:unused,adminOrder:unused,cities:unused,saveCity:unused,riders:unused,reassign:unused,cancel:unused,custody:unused,vendorOrders:unused,vendorMenu:unused,saveMenu:unused,vendorOpen:unused,documents:unused,upload:unused,document:unused,reviewDocument:unused,saveTier:unused,tiers:unused,membership:unused,saveBanner:unused,banners:unused,placements:unused,report:unused,audits:unused,health:unused,heartbeat:unused},
    finance:{savePolicy:unused,attachPolicy:unused,settle:unused,account:unused,history:unused,bank:unused,saveBank:unused,withdraw:unused,withdrawals:unused,review:unused,claim:unused,pending:unused,apply:unused,uncertain:unused,enqueue:unused},
    transferGateway:{configured:false,resolve:unused,recipient:unused,submit:unused,verify:unused},
    extras:{savePromo:unused,promos:unused,setReferralPolicy:unused,referrals:unused,applyReferral:unused,rewardReferrals:unused,createTicket:unused,tickets:unused,ticket:unused,reply:unused,resolve:unused,publishLegal:unused,legal:unused,acceptLegal:unused},
    notifications:{sendAdminPush:unused,inbox:unused,read:unused,devices:unused,register:unused,remove:unused,reminders:unused,claim:unused,target:unused,finish:unused,invalidateDevice:unused},notificationTransports:{},
    matching: { async register() { throw new Error('Unused'); }, async rider() { return null; }, async review() { throw new Error('Unused'); }, async presence() { throw new Error('Unused'); }, async locate() { throw new Error('Unused'); }, async currentOffer() { return null; }, async respond() { throw new Error('Unused'); }, async job() { return null; }, async savePolicy() { throw new Error('Unused'); }, async tracking() { throw new Error('Unused'); }, async retry() {}, async cancelSearch() { throw new Error('Unused'); }, async queue() { return []; }, async process() { return {offered:0,expired:0,no_rider:0,offline:0}; } },
    payments: { async prepare() { throw new Error('Unused'); }, async initialized() { throw new Error('Unused'); }, async review() {}, async find() { return null; }, async apply() { throw new Error('Unused'); }, async wallet() { return { currency: 'NGN', balance_kobo: 0, updated_at: null }; }, async history() { return []; }, async checkout() { throw new Error('Unused'); }, async enqueue() {}, async pending() { return []; }, async finishEvents() {}, async refundWallets() { return 0; }, async reconcileRefund() { throw new Error('Unused'); } },
    paymentGateway: { async initialize() { throw new Error('Unused'); }, async verify() { throw new Error('Unused'); }, async verifyRefund() { throw new Error('Unused'); } },
    orders: { async events() { return []; }, async receipt() { throw new Error('Unused'); }, async cancellation() { throw new Error('Unused'); }, async cancel() { throw new Error('Unused'); }, async reschedule() { throw new Error('Unused'); }, async dispute() { return null; }, async resolveDispute() { throw new Error('Unused'); }, async rating() { return null; }, async savePolicy() { throw new Error('Unused'); }, async policy() { return null; }, async riderAction() { throw new Error('Unused'); }, async processDue() { return { expired:0,activated:0,cancelled:0 }; } },
    addresses: { async cities() { return []; }, async city() { return null; }, async saveBoundary() { throw new Error('Unused'); }, async list() { return []; }, async get() { return null; }, async save() { throw new Error('Unused'); }, async delete() {}, async preferredCity() { return null; }, async setCity() {} },
    geocoder: { async search() { return []; }, async reverse() { return []; } },
    dispatch: { async getCity() { return null; }, async packages() { return []; }, async savePackage() { throw new Error('Unused'); }, async saveQuote() { throw new Error('Unused'); }, async createOrder() { throw new Error('Unused'); }, async getCode() { throw new Error('Unused'); }, async complete() { throw new Error('Unused'); } },
    food: { async listVendors() { return { items: [], total: 0 }; }, async getVendor() { return null; }, async getCity() { return null; }, async saveVendor() { throw new Error('Unused'); }, async saveMenu() { throw new Error('Unused'); }, async assignStaff() {}, async saveQuote() { throw new Error('Unused'); }, async createOrder() { throw new Error('Unused'); }, async listOrders() { return []; }, async getOrder() { return null; }, async vendorAction() { throw new Error('Unused'); } },
    routing: { async route() { return { distance_m: 1500, duration_s: 300 }; } },
    auth, profiles, accounts, limits: new MemoryLimits(), deliveries: new MemoryDeliveries(),
    sms: { async send(phone, otp) { sms.push(`${phone}:${otp}`); } },
    email: { async send(message) { emails.push(message); } },
    async readiness() { return true; }, async close() {},
  };
  return { rows, requested, sms, emails, challenges, recoveries, dependencies };
}
