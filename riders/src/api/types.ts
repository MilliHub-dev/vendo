/**
 * Rider-side data shapes. They follow the server's rider API (server/docs/openapi.json:
 * /v1/riders/*, /v1/rider/orders/*), in camelCase. All money is integer kobo; times are ISO UTC.
 */
import type { Kobo } from '@/lib/money';

export type LatLng = { lat: number; lng: number };
export type Place = LatLng & { address: string; note?: string };

export type User = { id: string; name: string; phone: string; email: string };
/** `phone` is a contact number in +234 format; riders sign in with their email. */
export type ProfileDetails = { name: string; phone: string };
export type VerifyCodeResult = { token: string; user: User | null };

/** `pending`: vehicle registered, documents still to add. `under_review`: everything is in and the team is checking it. */
export type Approval = 'pending' | 'under_review' | 'approved' | 'rejected' | 'suspended';
export type Presence = 'offline' | 'online' | 'on_trip';
export type VehicleType = 'motorcycle' | 'bicycle' | 'car';
/** The server's document kinds. */
export type DocumentKind = 'identity' | 'license' | 'vehicle';
/** A file picked on the phone, ready to upload. */
export type DocumentFile = { base64: string; mime: 'image/jpeg' | 'image/png' | 'application/pdf' };
export type DocumentStatus = 'missing' | 'submitted' | 'approved' | 'rejected';

export type RiderDocument = { kind: DocumentKind; status: DocumentStatus; note?: string };

export type Rider = {
  approval: Approval;
  approvalNote?: string;
  presence: Presence;
  cityId: string;
  vehicleType: VehicleType;
  plateNumber: string;
  /** not sent by the server yet */
  rating?: number;
  totalTrips?: number;
  /** offers accepted ÷ offers received, 0–1 */
  acceptanceRate?: number;
  documents: RiderDocument[];
};

export type RegisterRiderRequest = { cityId: string; vehicleType: VehicleType; plateNumber: string };
export type City = { id: string; name: string };

export type OrderType = 'food' | 'dispatch';
export type PackageSize = 'document' | 'small' | 'large';
export type JobStatus = 'rider_assigned' | 'picked_up' | 'on_the_way' | 'delivered' | 'cancelled';

/** A delivery offered to this rider. They have until `expiresAt` to accept. */
export type Offer = {
  id: string;
  orderId: string;
  type: OrderType;
  expiresAt: string;
  /** rider → pickup */
  distanceToPickupM: number;
  /** pickup → drop-off, straight-line */
  tripDistanceM: number;
  pickup: Place;
  dropoff: Place;
  /** what the rider earns; the server doesn't send this on offers yet */
  earningKobo?: Kobo;
  /** food: vendor name and item count; dispatch: what the package is */
  summary: string;
};

export type Job = {
  id: string;
  code: string;
  type: OrderType;
  status: JobStatus;
  pickup: Place;
  dropoff: Place;
  /** who to hand the order to. Food orders don't share the customer's number: use the in-app chat. */
  contact?: { name: string; phone: string };
  vendorName?: string;
  items?: { name: string; quantity: number }[];
  package?: { size: PackageSize; description: string; fragile: boolean };
  /** known once the delivery is settled; not sent while the job is running */
  earningKobo?: Kobo;
  tripDistanceM: number;
  /** dispatch: the receiver's code must be entered to complete the delivery */
  requiresCode: boolean;
  /** not sent by the server; it locks the delivery after too many wrong codes */
  codeAttemptsLeft?: number;
  acceptedAt: string;
};

/** A completed, paid delivery. The server's earnings history gives the amount and time; route details aren't included yet. */
export type Trip = { id: string; code: string; type?: OrderType; title: string; pickup?: string; dropoff?: string; earningKobo: Kobo; distanceM?: number; completedAt: string };

export type Earnings = {
  balanceKobo: Kobo;
  today: { trips: number; earnedKobo: Kobo };
  week: { trips: number; earnedKobo: Kobo };
  /** last 7 days, oldest first */
  days: { date: string; earnedKobo: Kobo }[];
  /** set per city on the server and enforced there; not sent to the app yet */
  minWithdrawalKobo?: Kobo;
  /** money held back (e.g. during a dispute) */
  heldKobo?: Kobo;
};

export type WithdrawalStatus = 'pending' | 'completed' | 'failed';
export type Withdrawal = { id: string; amountKobo: Kobo; bankName: string; accountNumber: string; status: WithdrawalStatus; createdAt: string; note?: string };
/** The rider's saved payout account (account number masked). */
export type PayoutAccount = { bankCode: string; bankName: string; lastFour: string; accountName: string };
/** `bankCode` + `accountNumber` are sent when the payout account is new or being changed; the server confirms the account name with the bank. */
export type WithdrawalRequest = { amountKobo: Kobo; bankCode?: string; accountNumber?: string };
export type Bank = { code: string; name: string };

export type ChatMessage = { id: string; from: 'rider' | 'customer'; text: string; createdAt: string };
export type AppNotification = { id: string; title: string; body: string; createdAt: string };
